// Masa kurma, katilma, cikma — Mongo tarafi.
//
// Canli oyun durumu burada DEGIL (bkz. servisler/oyunServisi.ts). Bu servis
// yalnizca "kim nerede oturuyor" sorusunu cevapliyor.
//
// Aynı Wi-Fi keşfi yerine ODA KODU secildi (MIMARI.md §5): ayni odada da,
// farkli sehirde de ayni sekilde calisir ve hicbir ag iznine ihtiyac duymaz.

import { Types } from 'mongoose';
import { config } from '../config.js';
import { Masa, type MasaBelgesi } from '../modeller/Masa.js';
import { Oyuncu } from '../modeller/Oyuncu.js';
import { engelliBiriVarMi } from './moderasyonServisi.js';
import type { KoltukGorunumu, MasaGorunumu } from '../tipler/protokol.js';
import type { OyuncuId } from '@kut/engine';

/** Karisabilecek harfler yok: 0/O, 1/I/L cikarildi — kod sesli soyleniyor. */
const KOD_ALFABESI = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export const MASA_KAPASITESI = 4;

export class MasaHatasi extends Error {}

function kodUret(uzunluk: number): string {
  let kod = '';
  for (let i = 0; i < uzunluk; i++) {
    kod += KOD_ALFABESI[Math.floor(Math.random() * KOD_ALFABESI.length)];
  }
  return kod;
}

/** Cakisma ihtimaline karsi birkac kez dener; hepsi tutmazsa hata. */
async function benzersizKod(): Promise<string> {
  for (let deneme = 0; deneme < 8; deneme++) {
    const kod = kodUret(config.oda.kodUzunlugu);
    if ((await Masa.countDocuments({ kod })) === 0) return kod;
  }
  throw new MasaHatasi('Masa kodu üretilemedi, tekrar dene');
}

/** Bos koltuklarin en kucugu; masa doluysa null. */
function bosKoltuk(masa: MasaBelgesi): OyuncuId | null {
  const dolu = new Set(masa.koltuklar.map((koltuk) => koltuk.no));
  for (let no = 0; no < MASA_KAPASITESI; no++) {
    if (!dolu.has(no)) return no as OyuncuId;
  }
  return null;
}

export interface MasaGorunumuSecenekleri {
  /** Su an soketi acik olan oyuncu kimlikleri. */
  readonly bagliOlanlar?: ReadonlySet<string>;
}

/** Mongo belgesini istemcinin gordugu sekle cevirir. */
export async function masaGorunumu(
  masa: MasaBelgesi & { _id: unknown },
  secenekler: MasaGorunumuSecenekleri = {},
): Promise<MasaGorunumu> {
  const kimlikler = masa.koltuklar.map((koltuk) => koltuk.oyuncu);
  const oyuncular = await Oyuncu.find({ _id: { $in: kimlikler } }).select('ad').lean();
  const adlar = new Map(oyuncular.map((o) => [String(o._id), o.ad]));

  const koltuklar: KoltukGorunumu[] = masa.koltuklar
    .slice()
    .sort((a, b) => a.no - b.no)
    .map((koltuk) => {
      const oyuncuId = String(koltuk.oyuncu);
      return {
        no: koltuk.no as OyuncuId,
        oyuncuId,
        ad: adlar.get(oyuncuId) ?? 'Oyuncu',
        hazir: koltuk.hazir,
        bagli: secenekler.bagliOlanlar?.has(oyuncuId) ?? true,
      };
    });

  const puanlar: Record<number, number> = {};
  for (const [anahtar, deger] of masa.puanlar.entries()) puanlar[Number(anahtar)] = deger;

  return {
    masaId: String(masa._id),
    kod: masa.kod,
    durum: masa.durum,
    sahipId: String(masa.sahip),
    tur: masa.tur,
    ozel: masa.ozel,
    koltuklar,
    puanlar,
  };
}

/** Oyuncunun icinde oldugu acik masa; yoksa null. */
export async function acikMasam(oyuncuId: string) {
  return Masa.findOne({
    'koltuklar.oyuncu': new Types.ObjectId(oyuncuId),
    durum: { $ne: 'bitti' },
  });
}

export async function masaKur(oyuncuId: string, ozel = true) {
  if ((await acikMasam(oyuncuId)) !== null) {
    throw new MasaHatasi('Zaten bir masadasın; önce oradan çık');
  }
  const kod = await benzersizKod();
  return Masa.create({
    kod,
    sahip: new Types.ObjectId(oyuncuId),
    ozel,
    // Masayi acan koltugunda HAZIR baslar: dort kisi toplandiginda bir de
    // "ben hazirim" turu beklemek, dort arkadasin es zamanli olmasini
    // gerektiriyordu. Isteyen `masa:hazir` ile geri alabilir.
    koltuklar: [{ no: 0, oyuncu: new Types.ObjectId(oyuncuId), hazir: true }],
    // Kimse katilmazsa kendiliginden silinsin; ilk katilimda temizlenir.
    kapanmaZamani: new Date(Date.now() + config.oda.bosMasaOmruMs),
  });
}

/**
 * Hizli eslesme: kod bilmeden oynamak isteyeni bekleyen bir ACIK masaya
 * oturtur; yoksa yeni bir acik masa acar.
 *
 * En dolu masa oncelikli (`koltuklar` cok olan): oyuncular tek bir masada
 * toplansin, dort ayri masada birer kisi beklemesin. Az oyuncu varken bu
 * fark, oyunun hic baslamamasiyla baslamasi arasindaki fark oluyor.
 */
export async function hizliMasa(oyuncuId: string) {
  const mevcut = await acikMasam(oyuncuId);
  if (mevcut !== null) return mevcut;

  const adaylar = await Masa.find({ durum: 'bekliyor', ozel: false }).sort({ createdAt: 1 });
  const siralanmis = adaylar
    .filter((masa) => masa.koltuklar.length < MASA_KAPASITESI)
    .sort((a, b) => b.koltuklar.length - a.koltuklar.length);

  // Engelli biri oturuyorsa o masa atlanir (App Store 1.2). Kontrol burada da
  // yapiliyor cunku `masayaKatil` hata firlatir; hizli eslesmede hata degil
  // BIR SONRAKI MASA istiyoruz — oyuncu neden reddedildigini anlamak zorunda
  // kalmasin.
  for (const masa of siralanmis) {
    const oturanlar = masa.koltuklar.map((k) => String(k.oyuncu));
    if (await engelliBiriVarMi(oyuncuId, oturanlar)) continue;
    return masayaKatil(masa.kod, oyuncuId);
  }
  return masaKur(oyuncuId, false);
}

/** Ayni anda oturmaya calisan oyuncular icin kac kez denenecek. */
const KOLTUK_DENEMESI = 8;

/**
 * Masaya oturur.
 *
 * Koltuk secimi ATOMIK olmak zorunda. Once `findOne` ile okuyup sonra
 * `save()` demek klasik oku-degistir-yaz yarisi: dort arkadas kodu ayni anda
 * girdiginde ikisi de ayni belgeyi okuyup ayni bos koltugu secebiliyor. Bu
 * gercekten yasandi — iki oyuncu 1 numarali koltukta otururken 3 numara bos
 * kaldi; ikisi ayni eli gordu, bos koltugu da sunucu oynadi.
 *
 * Cozum: `findOneAndUpdate` filtresine "bu koltuk HALA bos ve masa HALA dolu
 * degil" sartini koymak. Mongo bu kontrolu ve yazmayi tek islemde yapiyor.
 * Kaybeden istemci null aliyor ve bir sonraki bos koltuk icin yeniden
 * deniyor.
 */
export async function masayaKatil(kod: string, oyuncuId: string) {
  const temizKod = kod.trim().toUpperCase();
  const kimlik = new Types.ObjectId(oyuncuId);

  for (let deneme = 0; deneme < KOLTUK_DENEMESI; deneme++) {
    const masa = await Masa.findOne({ kod: temizKod });
    if (masa === null) throw new MasaHatasi('Böyle bir masa yok');
    if (masa.durum === 'bitti') throw new MasaHatasi('Bu masa kapandı');

    const zatenVar = masa.koltuklar.some((koltuk) => String(koltuk.oyuncu) === oyuncuId);
    if (zatenVar) return masa; // Yeniden baglanma: koltugu duruyor.

    if (masa.durum === 'oynaniyor') throw new MasaHatasi('Masada oyun başlamış');

    const baskaMasa = await acikMasam(oyuncuId);
    if (baskaMasa !== null) throw new MasaHatasi('Zaten bir masadasın; önce oradan çık');

    const koltuk = bosKoltuk(masa);
    if (koltuk === null) throw new MasaHatasi('Masa dolu');

    // Engelin GERCEK bir karsiligi olmali (App Store 1.2). Engelledigin ya da
    // seni engelleyen biriyle ayni masaya oturmuyorsun — kodu bilse bile.
    const oturanlar = masa.koltuklar.map((k) => String(k.oyuncu));
    if (await engelliBiriVarMi(oyuncuId, oturanlar)) {
      throw new MasaHatasi('Bu masada engellediğin bir oyuncu var');
    }

    const guncel = await Masa.findOneAndUpdate(
      {
        _id: masa._id,
        durum: 'bekliyor',
        // Koltuk HALA bos mu? Dizide o numaradan bir eleman olmamali.
        'koltuklar.no': { $ne: koltuk },
        // Masa HALA dolu degil mi? Bu olmadan bes kisi oturabilirdi.
        $expr: { $lt: [{ $size: '$koltuklar' }, MASA_KAPASITESI] },
        // Ayni oyuncu iki koltuga oturmasin (iki cihaz, cift dokunus).
        'koltuklar.oyuncu': { $ne: kimlik },
      },
      {
        $push: { koltuklar: { no: koltuk, oyuncu: kimlik, hazir: true } },
        // Artik bos degil: kendiliginden silinme kalksin.
        $unset: { kapanmaZamani: '' },
      },
      { new: true },
    );

    // null: baskasi bu koltugu bizden once kaptı. Yeniden oku ve dene.
    if (guncel !== null) return guncel;
  }

  throw new MasaHatasi('Masa şu an çok yoğun, tekrar dene');
}

/**
 * Masadan cikma.
 *
 * Oyun BASLAMISSA koltuk bosalmaz (MIMARI.md §3): dort koltuk dolu olmadan
 * motor ilerleyemez, cikan biri masayi kilitlerdi. Cikan oyuncunun yerine
 * sunucu oynar; geri gelirse ayni koltuga oturur. Bu yuzden `oynaniyor`
 * durumunda bu fonksiyon hicbir sey yapmaz ve null doner — cagiran, koltugu
 * korurken soketi odadan cikarir.
 */
export async function masadanCik(oyuncuId: string) {
  const masa = await acikMasam(oyuncuId);
  if (masa === null) return null;
  if (masa.durum === 'oynaniyor') return null;

  // Mongoose alt-belge dizisine duz dizi atanamiyor; `set` ile veriyoruz.
  masa.set(
    'koltuklar',
    masa.koltuklar.filter((koltuk) => String(koltuk.oyuncu) !== oyuncuId),
  );

  if (masa.koltuklar.length === 0) {
    // Son kisi de cikti: masa hemen kapanir.
    masa.durum = 'bitti';
    masa.set('kapanmaZamani', new Date());
  } else if (String(masa.sahip) === oyuncuId) {
    // Sahip cikarsa masa sahipsiz kalmasin; en kucuk koltuk devralir.
    const yeniSahip = masa.koltuklar.slice().sort((a, b) => a.no - b.no)[0];
    if (yeniSahip !== undefined) masa.sahip = yeniSahip.oyuncu;
  }
  await masa.save();
  return masa;
}

export async function hazirDurumu(oyuncuId: string, hazir: boolean) {
  const masa = await acikMasam(oyuncuId);
  if (masa === null) throw new MasaHatasi('Bir masada değilsin');

  const koltuk = masa.koltuklar.find((k) => String(k.oyuncu) === oyuncuId);
  if (koltuk === undefined) throw new MasaHatasi('Bu masada koltuğun yok');

  koltuk.hazir = hazir;
  await masa.save();
  return masa;
}

/** Oyun baslayabilir mi? Dort koltuk dolu ve hepsi hazir olmali. */
export function baslayabilirMi(masa: MasaBelgesi): boolean {
  return (
    masa.durum === 'bekliyor' &&
    masa.koltuklar.length === MASA_KAPASITESI &&
    masa.koltuklar.every((koltuk) => koltuk.hazir)
  );
}

/**
 * Acilista yarim kalmis masalari kapatir.
 *
 * Canli oyun durumu BELLEKTE (servisler/oyunServisi.ts). Sunucu yeniden
 * baslayinca o durum gider; Mongo'da `oynaniyor` kalan masa artik geri
 * kurulamaz. Temizlemezsek oyuncular sonsuza kadar "zaten bir masadasin"
 * hatasi alir ve hicbir masaya oturamaz.
 *
 * El kayitlari SILINMEZ — onlar zaten kalici (modeller/ElKaydi.ts).
 */
export async function yarimMasalariKapat(): Promise<number> {
  const sonuc = await Masa.updateMany(
    { durum: { $ne: 'bitti' } },
    { $set: { durum: 'bitti', kapanmaZamani: new Date() } },
  );
  return sonuc.modifiedCount;
}
