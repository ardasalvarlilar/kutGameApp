// Socket.io katmani: kimlik dogrulama, oda olaylari, oyun olaylari.
//
// Sunucu OTORITER. Istemci hicbir zaman "su oldu" demiyor, "sunu yapmak
// istiyorum" diyor; karari motor veriyor.
//
// Her oyuncu iki odada birden: masanin odasi (`masa:<id>`, herkese acik
// yayinlar icin) ve kendi kisisel odasi (`oyuncu:<id>`, `viewFor` ciktisi
// icin). Ikinci oda sart — gorunum kisiye ozel, ortak yayin sizinti olurdu.
//
// Yardimcilar bilerek MODUL SEVIYESINDE ve `io`yu parametre aliyor: masayi
// baslatan soket kopsa bile eli bitiren geri cagri calisabilmeli. Baglantiya
// kapatilmis olsalardi, masayi kuran kisi cikinca el sonu islenmezdi.

import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import {
  AKSIYON_TIPLERI,
  macKazanani,
  oyuncuKaydiOlustur,
  type OyuncuId,
  type TurNo,
} from '@kut/engine';
import { kayit } from '../kayit.js';
import { ElKaydi } from '../modeller/ElKaydi.js';
import { Masa } from '../modeller/Masa.js';
import { jetonuCoz } from '../servisler/kimlikServisi.js';
import { elIsle, macIsle } from '../servisler/ilerlemeServisi.js';
import {
  MasaHatasi,
  acikMasam,
  baslayabilirMi,
  hazirDurumu,
  hizliMasa,
  masaGorunumu,
  masaKur,
  masadanCik,
  masayaKatil,
} from '../servisler/masaServisi.js';
import { Oyuncu } from '../modeller/Oyuncu.js';
import { basarili, basarisiz, type Yanit } from '../tipler/protokol.js';
import { MasaOturumu, type Oturan } from './masaOturumu.js';

/** Canli oturumlar — masaId -> oturum. Bellekte; kalici olan el kaydi. */
const oturumlar = new Map<string, MasaOturumu>();

/**
 * Sunucu kapaniyor mu?
 *
 * `io.close()` butun soketleri dusuruyor ve her biri `disconnect` isleyicisini
 * calistiriyor; o isleyici de Mongo'ya gidiyor. Ama kapanis sirasinda Mongo
 * baglantisi da kapaniyor — yarista kalan sorgu `MongoNotConnectedError`
 * firlatip SURECI DUSURUYORDU. Her dagitimda gorulen bu cokusun sebebi buydu.
 *
 * Bayrak, kapanista temizlik yapmaya calismayi engelliyor: zaten yapacak bir
 * sey yok, canli durum bellekte ve gidiyor. Acilista `yarimMasalariKapat`
 * geride kalan masalari topluyor.
 */
let kapaniyor = false;

/** Kapanis basladi: artik veritabanina dokunan isleyici calismasin. */
export function kapanisaGec(): void {
  kapaniyor = true;
}

/** El bitince sonraki elin dagitilmasi icin beklenen sure (ms). */
const TUR_ARASI_MS = 6_000;

const katilSemasi = z.object({ kod: z.string().trim().min(3).max(12) });
const kurSemasi = z.object({ ozel: z.boolean().optional() });
const hazirSemasi = z.object({ hazir: z.boolean() });
const aksiyonSemasi = z.object({
  aksiyon: z
    .object({
      // `z.string()` DEGIL, kapali liste. Motorun `reduce`u tanimadigi bir
      // `tip` icin hicbir dalla eslesmiyor ve `undefined` donuyor; sunucu da
      // `sonuc.ok` okumaya calisip dusuyordu. Yani kimliği dogrulanmis
      // herhangi bir istemci tek paketle sunucuyu kapatabiliyordu.
      // Liste motordan geliyor (`AKSIYON_TIPLERI`) ve orada birlesime
      // kilitli — biri degisip digeri unutulamaz.
      tip: z.enum(AKSIYON_TIPLERI),
      oyuncu: z.number().int().min(0).max(3),
    })
    // Alanlarin geri kalanini motor dogruluyor: `tasId` elinde mi, `perId`
    // yerde mi... Hepsini burada tekrarlamak iki ayri kural kaynagi olurdu.
    .passthrough(),
  hamleNo: z.number().int().nonnegative(),
});

function oyuncuId(soket: Socket): string {
  return soket.data.oyuncuId as string;
}

/** Hata mesajini istemciye guvenle gecirir; beklenmeyeni gizler. */
function hataMesaji(hata: unknown): string {
  if (hata instanceof MasaHatasi) return hata.message;
  kayit.hata('Beklenmeyen soket hatasi', hata);
  return 'Beklenmeyen bir hata oldu';
}

// --- Masa akisi --------------------------------------------------------------

/** Masa durumunu tum masaya yayar. */
async function masayiYay(io: Server, masaId: string): Promise<void> {
  const masa = await Masa.findById(masaId);
  if (masa === null) return;
  const oturum = oturumlar.get(masaId);
  io.to(`masa:${masaId}`).emit(
    'masa:durum',
    await masaGorunumu(masa, {
      ...(oturum === undefined ? {} : { bagliOlanlar: oturum.bagliOlanlar }),
    }),
  );
}

/** Dort kisi hazirsa eli baslatir. */
async function gerekirseBaslat(io: Server, masaId: string): Promise<void> {
  if (oturumlar.has(masaId)) return;
  const masa = await Masa.findById(masaId);
  if (masa === null || !baslayabilirMi(masa)) return;

  masa.durum = 'oynaniyor';
  await masa.save();

  const oturanlar: Oturan[] = masa.koltuklar
    .slice()
    .sort((a, b) => a.no - b.no)
    .map((koltuk) => ({
      koltuk: koltuk.no as OyuncuId,
      oyuncuId: String(koltuk.oyuncu),
      bagli: true,
    }));

  const oturum = new MasaOturumu(io, {
    masaId,
    oturanlar,
    tur: masa.tur as TurNo,
    onElBitti: (biten) => elBittiginde(io, biten),
  });
  oturumlar.set(masaId, oturum);
  await masayiYay(io, masaId);
  oturum.baslat();
  kayit.bilgi('El başladı', { masaId, tur: masa.tur });
}

/**
 * El kapandi: kaydi yaz, puanlari isle, siradaki tura gec.
 * Motor kurali #2 sayesinde `tohum + aksiyonlar` eli birebir geri kurar.
 */
async function elBittiginde(io: Server, oturum: MasaOturumu): Promise<void> {
  const masa = await Masa.findById(oturum.masaId);
  if (masa === null) {
    oturum.kapat();
    oturumlar.delete(oturum.masaId);
    return;
  }

  const bilgi = oturum.oyun.elBilgisi;
  const sonuc = oturum.oyun.sonuc;
  const sirali = oturum.oturanlar.slice().sort((a, b) => a.koltuk - b.koltuk);

  await ElKaydi.create({
    masa: masa._id,
    tur: bilgi.tur,
    tohum: bilgi.tohum,
    baslayan: bilgi.baslayan,
    oturanlar: sirali.map((o) => o.oyuncuId),
    aksiyonlar: bilgi.aksiyonlar,
    sonuc,
  });

  if (sonuc !== null) {
    for (const oturan of oturum.oturanlar) {
      const onceki = masa.puanlar.get(String(oturan.koltuk)) ?? 0;
      masa.puanlar.set(String(oturan.koltuk), onceki + sonuc.puanlar[oturan.koltuk]);
    }
    void elIsle({
      oyuncuIdler: sirali.map((o) => o.oyuncuId),
      kazananId: sonuc.kazanan === null ? null : (oturum.oyuncusu(sonuc.kazanan)?.oyuncuId ?? null),
    });
  }

  // Mac 16. TUR oynanip bitince biter (KURALLAR.md §3). El sayisina bakmak
  // yanlis olurdu: ayni tur yeniden dagitilabiliyor.
  const macBitti = masa.tur >= 16;

  // Toplam puanlari motorun bekledigi sekle cevir; eksik koltuk 0 sayilir.
  const toplamlar = oyuncuKaydiOlustur((koltuk) => masa.puanlar.get(String(koltuk)) ?? 0);
  const macKazananlari = macBitti ? macKazanani(toplamlar) : [];

  if (macBitti) {
    masa.durum = 'bitti';
    // Istemciler son tabloyu okusun diye birkac dakika daha duruyor.
    masa.set('kapanmaZamani', new Date(Date.now() + 5 * 60_000));
  } else {
    masa.tur += 1;
  }
  await masa.save();

  if (sonuc !== null) {
    io.to(`masa:${oturum.masaId}`).emit('oyun:elSonu', {
      sonuc,
      masa: await masaGorunumu(masa, { bagliOlanlar: oturum.bagliOlanlar }),
      macKazananlari,
      sonrakiElSn: macBitti ? null : Math.round(TUR_ARASI_MS / 1000),
    });
  }
  await masayiYay(io, oturum.masaId);

  if (macBitti) {
    void macIsle(
      sirali.map((o) => o.oyuncuId),
      macKazananlari
        .map((koltuk) => oturum.oyuncusu(koltuk)?.oyuncuId)
        .filter((id): id is string => id !== undefined),
    );
    oturum.kapat();
    oturumlar.delete(oturum.masaId);
    kayit.bilgi('Maç bitti', { masaId: oturum.masaId });
    return;
  }

  // Sonraki el hemen degil, sonucu gorsunler diye kisa bir ara.
  const sonrakiTur = masa.tur as TurNo;
  oturum.sonrakiElePlanla(TUR_ARASI_MS, () => {
    // Ara sirasinda masa kapandiysa (herkes cikti) yeni el dagitma.
    if (!oturumlar.has(oturum.masaId)) return;
    oturum.yeniEl(sonrakiTur);
    void masayiYay(io, oturum.masaId);
  });
}

/** Masa artik oynanamiyor: oturumu kapat, oyuncuları bilgilendir. */
function oturumuBitir(io: Server, masaId: string, sebep: string): void {
  const oturum = oturumlar.get(masaId);
  if (oturum === undefined) return;
  oturum.kapat();
  oturumlar.delete(masaId);
  io.to(`masa:${masaId}`).emit('masa:ayrildi', { sebep });
}

// --- Baglanti ----------------------------------------------------------------

export function soketiKur(io: Server): void {
  // --- Kimlik ---------------------------------------------------------------
  // Baglanti kurulmadan once dogrulanir; jetonsuz soket hic acilmaz.
  io.use(async (soket, sonraki) => {
    const jeton = (soket.handshake.auth as { jeton?: string } | undefined)?.jeton;
    if (typeof jeton !== 'string') return sonraki(new Error('Jeton gerekli'));

    const icerik = jetonuCoz(jeton);
    if (icerik === null) return sonraki(new Error('Jeton geçersiz'));

    const oyuncu = await Oyuncu.findById(icerik.oyuncuId).select('ad engelli').lean();
    if (oyuncu === null) return sonraki(new Error('Oyuncu bulunamadı'));
    if (oyuncu.engelli) return sonraki(new Error('Hesabın askıya alınmış'));

    soket.data.oyuncuId = icerik.oyuncuId;
    soket.data.ad = oyuncu.ad;
    soket.data.masaId = null;
    sonraki();
  });

  io.on('connection', (soket) => {
    const kimlik = oyuncuId(soket);
    void soket.join(`oyuncu:${kimlik}`);
    kayit.bilgi(`Bağlandı: ${soket.data.ad as string}`, { kimlik });

    /**
     * Devam eden bir elde oyuncuya durumu geri verir.
     *
     * Yeniden baglanmanin butun isi burada: gorunum kisisel odaya degil
     * DOGRUDAN bu sokete gidiyor, cunku ayni oyuncunun eski (olu) soketi
     * hala odada olabilir ve iki kopya gondermenin anlami yok.
     */
    const oyunuGeriVer = (masaId: string): void => {
      const oturum = oturumlar.get(masaId);
      if (oturum === undefined) return;

      oturum.baglantiDurumu(kimlik, true);
      const koltuk = oturum.koltugu(kimlik);
      if (koltuk === null) return;

      soket.emit('oyun:gorunum', { gorunum: oturum.oyun.gorunum(koltuk), hamleNo: 0 });
      const bitis = oturum.oyun.siraBitisi;
      if (bitis !== null) {
        soket.emit('oyun:sure', {
          siradaki: oturum.oyun.siradaki,
          bitisZamani: bitis,
          sure: oturum.oyun.siraSuresi(),
          sunucuZamani: Date.now(),
        });
      }
    };

    /** Soketi masanin odasina alir ve kimligini isaretler. */
    const odayaGir = async (masaId: string): Promise<void> => {
      soket.data.masaId = masaId;
      await soket.join(`masa:${masaId}`);
    };

    // --- Masa olaylari -------------------------------------------------------

    // Acilis ve yeniden baglanmanin tek ucu: "hangi masadayim?"
    soket.on('masa:benim', async (_girdi: unknown, yanit: (s: Yanit<unknown>) => void) => {
      try {
        const masa = await acikMasam(kimlik);
        if (masa === null) return yanit(basarili({ masa: null }));

        const masaId = String(masa._id);
        await odayaGir(masaId);
        const oturum = oturumlar.get(masaId);
        const gorunum = await masaGorunumu(masa, {
          ...(oturum === undefined ? {} : { bagliOlanlar: oturum.bagliOlanlar }),
        });
        yanit(basarili({ masa: gorunum }));
        oyunuGeriVer(masaId);
        await masayiYay(io, masaId);
      } catch (hata) {
        yanit(basarisiz(hataMesaji(hata)));
      }
    });

    soket.on('masa:kur', async (girdi: unknown, yanit: (s: Yanit<unknown>) => void) => {
      const cozum = kurSemasi.safeParse(girdi ?? {});
      try {
        const masa = await masaKur(kimlik, cozum.success ? (cozum.data.ozel ?? true) : true);
        const masaId = String(masa._id);
        await odayaGir(masaId);
        yanit(basarili({ masa: await masaGorunumu(masa) }));
      } catch (hata) {
        yanit(basarisiz(hataMesaji(hata)));
      }
    });

    soket.on('masa:katil', async (girdi: unknown, yanit: (s: Yanit<unknown>) => void) => {
      const cozum = katilSemasi.safeParse(girdi);
      if (!cozum.success) return yanit(basarisiz('Masa kodu geçersiz'));
      try {
        const masa = await masayaKatil(cozum.data.kod, kimlik);
        const masaId = String(masa._id);
        await odayaGir(masaId);

        const oturum = oturumlar.get(masaId);
        yanit(
          basarili({
            masa: await masaGorunumu(masa, {
              ...(oturum === undefined ? {} : { bagliOlanlar: oturum.bagliOlanlar }),
            }),
          }),
        );
        // Yeniden baglanma: oturum varsa koltugu geri ver ve durumu gonder.
        oyunuGeriVer(masaId);
        await masayiYay(io, masaId);
        await gerekirseBaslat(io, masaId);
      } catch (hata) {
        yanit(basarisiz(hataMesaji(hata)));
      }
    });

    soket.on('masa:hizli', async (_girdi: unknown, yanit: (s: Yanit<unknown>) => void) => {
      try {
        const masa = await hizliMasa(kimlik);
        const masaId = String(masa._id);
        await odayaGir(masaId);
        yanit(basarili({ masa: await masaGorunumu(masa) }));
        oyunuGeriVer(masaId);
        await masayiYay(io, masaId);
        await gerekirseBaslat(io, masaId);
      } catch (hata) {
        yanit(basarisiz(hataMesaji(hata)));
      }
    });

    soket.on('masa:hazir', async (girdi: unknown, yanit: (s: Yanit<unknown>) => void) => {
      const cozum = hazirSemasi.safeParse(girdi);
      if (!cozum.success) return yanit(basarisiz('Geçersiz istek'));
      try {
        const masa = await hazirDurumu(kimlik, cozum.data.hazir);
        const masaId = String(masa._id);
        yanit(basarili({ masa: await masaGorunumu(masa) }));
        await masayiYay(io, masaId);
        await gerekirseBaslat(io, masaId);
      } catch (hata) {
        yanit(basarisiz(hataMesaji(hata)));
      }
    });

    soket.on('masa:cik', async (_girdi: unknown, yanit: (s: Yanit<unknown>) => void) => {
      try {
        const mevcut = await acikMasam(kimlik);
        if (mevcut === null) {
          soket.data.masaId = null;
          return yanit(basarili(null));
        }

        const masaId = String(mevcut._id);
        // Oyun basladiysa koltuk KALIR (MIMARI.md §3): dort koltuk dolu
        // olmadan motor ilerleyemez. Sunucu onun yerine oynar; geri gelen
        // `masa:benim` ile ayni koltuga oturur.
        if (mevcut.durum === 'oynaniyor') {
          oturumlar.get(masaId)?.baglantiDurumu(kimlik, false);
          await soket.leave(`masa:${masaId}`);
          soket.data.masaId = null;
          await masayiYay(io, masaId);
          return yanit(basarili(null));
        }

        const masa = await masadanCik(kimlik);
        await soket.leave(`masa:${masaId}`);
        soket.data.masaId = null;
        if (masa !== null) {
          if (masa.durum === 'bitti') oturumuBitir(io, masaId, 'Masa kapandı');
          await masayiYay(io, masaId);
        }
        yanit(basarili(null));
      } catch (hata) {
        yanit(basarisiz(hataMesaji(hata)));
      }
    });

    // --- Oyun olaylari -------------------------------------------------------

    soket.on('oyun:aksiyon', (girdi: unknown, yanit: (s: Yanit<unknown>) => void) => {
      const cozum = aksiyonSemasi.safeParse(girdi);
      if (!cozum.success) return yanit(basarisiz('Geçersiz aksiyon'));

      const masaId = soket.data.masaId as string | null;
      if (masaId === null) return yanit(basarisiz('Bir masada değilsin'));

      const oturum = oturumlar.get(masaId);
      if (oturum === undefined) return yanit(basarisiz('Masada oyun yok'));

      const sonuc = oturum.aksiyon(kimlik, cozum.data.aksiyon as never, cozum.data.hamleNo);
      yanit(sonuc.ok ? basarili(null) : basarisiz(sonuc.hata ?? 'Hamle reddedildi'));
    });

    // --- Kopma ---------------------------------------------------------------
    // Koltuk BOSALMAZ (MIMARI.md §3): oyun durmaz, sure normal isler ve
    // dolunca oyuncunun yerine oynanir. Geri baglanan ayni koltuga oturur.
    soket.on('disconnect', async () => {
      const masaId = soket.data.masaId as string | null;
      kayit.bilgi(`Ayrıldı: ${soket.data.ad as string}`, { kimlik });
      if (masaId === null || kapaniyor) return;

      // Ayni oyuncunun baska bir soketi hala aciksa (uygulama yeniden
      // yuklendi, iki sekme) baglanti kopmus SAYILMAZ.
      const baskaSoket = (await io.in(`oyuncu:${kimlik}`).fetchSockets()).some(
        (baska) => baska.id !== soket.id,
      );
      if (baskaSoket) return;

      oturumlar.get(masaId)?.baglantiDurumu(kimlik, false);

      // Oyun baslamadiysa koltugu bosalt; bekleyen masa kilitlenmesin.
      const masa = await Masa.findById(masaId);
      if (masa !== null && masa.durum === 'bekliyor') {
        const kalan = await masadanCik(kimlik);
        if (kalan !== null && kalan.durum === 'bitti') oturumuBitir(io, masaId, 'Masa kapandı');
      }
      await masayiYay(io, masaId);
    });
  });
}

/** Test ve kapanis icin: acik oturumlari temizler. */
export function oturumlariKapat(): void {
  for (const oturum of oturumlar.values()) oturum.kapat();
  oturumlar.clear();
}

export { acikMasam };
