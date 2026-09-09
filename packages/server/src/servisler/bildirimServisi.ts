// Push bildirimleri — Expo Push Service uzerinden.
//
// Neden Expo: uygulama zaten EAS ile derleniyor ve EAS, APNs (iOS) ile FCM
// (Android) kimlik bilgilerini kendisi yonetiyor. Dogrudan APNs'e gitmek hem
// sertifika tasimak hem iki ayri saglayiciyi ayri ayri kodlamak demekti.
// Sunucunun tek yaptigi, Expo'nun HTTP ucuna bir JSON dizisi yollamak.
//
// UC KURAL:
//
//  1. Bildirim OYUNU BOZAMAZ. Gonderim basarisiz olursa hata yukari
//     firlatilmaz, yalnizca gunluge yazilir. Bir el, push servisi diye
//     kesilemez.
//  2. Jeton CIHAZI temsil eder, hesabi degil. Ayni telefondan baska hesaba
//     girilirse jeton tasinir — kopyalanmaz. Aksi halde bildirim eski
//     sahibinin adina yabancinin kilit ekraninda gorunurdu.
//  3. Olu jeton temizlenir. Expo "DeviceNotRegistered" derse (uygulama
//     silinmis, izin geri alinmis) o jeton veritabanindan cikar; yoksa liste
//     zamanla cope doner ve her gonderim yavaslar.
//
// Bildirim TIPI burada YOK — bu dosya yalnizca "gonderme" isini biliyor.
// Hangi olayin bildirim dogurdugu cagiran katmanin karari.

import { config } from '../config.js';
import { kayit } from '../kayit.js';
import { Oyuncu, type BildirimPlatformu } from '../modeller/Oyuncu.js';

/** Expo jetonunun bicimi. Bozuk jetonu veritabanina hic sokmuyoruz. */
const JETON_KALIBI = /^Expo(nent)?PushToken\[[^\]]+\]$/;

export function jetonGecerliMi(jeton: string): boolean {
  return JETON_KALIBI.test(jeton.trim());
}

/** Expo tek istekte sinirli sayida ileti aliyor; listeyi parcalara boler. */
export function yiginaBol<T>(hepsi: readonly T[], boyut: number): readonly (readonly T[])[] {
  if (boyut < 1) return hepsi.length === 0 ? [] : [hepsi];
  const yiginlar: T[][] = [];
  for (let i = 0; i < hepsi.length; i += boyut) {
    yiginlar.push(hepsi.slice(i, i + boyut));
  }
  return yiginlar;
}

export interface BildirimIcerigi {
  readonly baslik: string;
  readonly govde: string;
  /** Uygulama acildiginda nereye gidilecegini soyleyen serbest veri. */
  readonly veri?: Readonly<Record<string, unknown>>;
}

/** Expo'nun bekledigi ileti bicimi. */
interface ExpoIletisi {
  readonly to: string;
  readonly title: string;
  readonly body: string;
  readonly sound: 'default';
  readonly data?: Readonly<Record<string, unknown>>;
}

function iletiKur(jeton: string, icerik: BildirimIcerigi): ExpoIletisi {
  return {
    to: jeton,
    title: icerik.baslik,
    body: icerik.govde,
    sound: 'default',
    ...(icerik.veri === undefined ? {} : { data: icerik.veri }),
  };
}

// --- Jeton yonetimi ----------------------------------------------------------

/**
 * Cihazin jetonunu bu oyuncuya baglar.
 *
 * Once BASKA oyunculardan cekilip aliniyor (kural #2): telefonu odunc veren
 * ya da cikis yapip baska hesapla giren oyuncu, eski hesabin bildirimlerini
 * almaya devam etmemeli.
 */
export async function jetonKaydet(
  oyuncuId: string,
  jeton: string,
  platform: BildirimPlatformu,
): Promise<void> {
  const temiz = jeton.trim();
  if (!jetonGecerliMi(temiz)) throw new BildirimHatasi('gecersiz-bildirim-jetonu');

  // Cihaz baska hesaba bagliysa oradan cikar.
  await Oyuncu.updateMany(
    { _id: { $ne: oyuncuId }, 'bildirimJetonlari.jeton': temiz },
    { $pull: { bildirimJetonlari: { jeton: temiz } } },
  );

  // Ayni jeton bu oyuncuda zaten varsa tazeleyip cik; yoksa ekle.
  const tazelendi = await Oyuncu.updateOne(
    { _id: oyuncuId, 'bildirimJetonlari.jeton': temiz },
    {
      $set: {
        'bildirimJetonlari.$.sonKullanim': new Date(),
        'bildirimJetonlari.$.platform': platform,
      },
    },
  );
  if (tazelendi.matchedCount > 0) return;

  // `$slice` negatif: en YENI cihazlar kalir, en eskiler dizinin basindan
  // dusier. Sinir olmasa kaybolmus cihazlar sonsuza kadar birikirdi.
  await Oyuncu.updateOne(
    { _id: oyuncuId },
    {
      $push: {
        bildirimJetonlari: {
          $each: [{ jeton: temiz, platform, sonKullanim: new Date() }],
          $slice: -config.bildirim.enFazlaCihaz,
        },
      },
    },
  );
}

/** Cikis yapan cihaz: jeton her yerden silinir. */
export async function jetonSil(jeton: string): Promise<void> {
  const temiz = jeton.trim();
  if (temiz === '') return;
  await Oyuncu.updateMany(
    { 'bildirimJetonlari.jeton': temiz },
    { $pull: { bildirimJetonlari: { jeton: temiz } } },
  );
}

export class BildirimHatasi extends Error {}

// --- Gonderim ----------------------------------------------------------------

interface ExpoSonucu {
  readonly status?: string;
  readonly message?: string;
  readonly details?: { readonly error?: string };
}

/**
 * Bir yigin iletiyi Expo'ya yollar ve olu jetonlari bildirir.
 * Hata FIRLATMAZ (kural #1); basarisizligi gunluge yazip gecer.
 */
async function yiginiYolla(iletiler: readonly ExpoIletisi[]): Promise<readonly string[]> {
  try {
    const yanit = await fetch(config.bildirim.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        ...(config.bildirim.erisimJetonu === ''
          ? {}
          : { authorization: `Bearer ${config.bildirim.erisimJetonu}` }),
      },
      body: JSON.stringify(iletiler),
    });

    if (!yanit.ok) {
      kayit.uyari('Push servisi hata dondu', { durum: yanit.status });
      return [];
    }

    const cevap = (await yanit.json()) as { data?: readonly ExpoSonucu[] };
    const sonuclar = cevap.data ?? [];

    // Sonuclar istekle AYNI SIRADA geliyor; olu jetonlari boyle esliyoruz.
    const oluJetonlar: string[] = [];
    sonuclar.forEach((sonuc, sira) => {
      if (sonuc.status === 'ok') return;
      const hedef = iletiler[sira];
      if (hedef === undefined) return;
      if (sonuc.details?.error === 'DeviceNotRegistered') {
        oluJetonlar.push(hedef.to);
        return;
      }
      kayit.uyari('Bildirim gonderilemedi', { sebep: sonuc.message ?? sonuc.details?.error });
    });
    return oluJetonlar;
  } catch (hata) {
    kayit.uyari('Push servisine ulasilamadi', hata);
    return [];
  }
}

/**
 * Verilen oyunculara ayni bildirimi gonderir.
 *
 * Cagiran katman KIMIN bildirim alacagina karar verir — ornegin soketi acik
 * olan oyuncuya gondermek spam olurdu, o eleme burada degil cagiranda.
 *
 * Donen sayi ulasilan CIHAZ sayisidir; hicbir cihazi yoksa 0.
 */
export async function bildirimGonder(
  oyuncuIdler: readonly string[],
  icerik: BildirimIcerigi,
): Promise<number> {
  if (oyuncuIdler.length === 0) return 0;

  const oyuncular = await Oyuncu.find({ _id: { $in: oyuncuIdler } })
    .select('bildirimJetonlari')
    .lean();

  const iletiler = oyuncular
    .flatMap((oyuncu) => oyuncu.bildirimJetonlari.map((kayitli) => kayitli.jeton))
    .filter(jetonGecerliMi)
    .map((jeton) => iletiKur(jeton, icerik));

  if (iletiler.length === 0) return 0;

  const oluJetonlar: string[] = [];
  for (const yigin of yiginaBol(iletiler, config.bildirim.yiginBoyutu)) {
    oluJetonlar.push(...(await yiginiYolla(yigin)));
  }

  // Kural #3 — silinen uygulamalarin jetonlari listede kalmasin.
  if (oluJetonlar.length > 0) {
    await Oyuncu.updateMany(
      { 'bildirimJetonlari.jeton': { $in: oluJetonlar } },
      { $pull: { bildirimJetonlari: { jeton: { $in: oluJetonlar } } } },
    );
    kayit.bilgi('Olu bildirim jetonlari temizlendi', { adet: oluJetonlar.length });
  }

  return iletiler.length - oluJetonlar.length;
}
