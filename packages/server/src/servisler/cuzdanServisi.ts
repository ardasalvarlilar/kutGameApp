// Cip bakiyesi — Mongo tarafi.
//
// Kurallar (kim hangi masaya, pot nasil bolunur) `@kut/ekonomi`de; bu servis
// yalnizca bakiyeyi GUVENLE degistiriyor:
//
//  - Dusum ATOMIK. "Yetiyor mu?" kontrolu ve dusum tek `findOneAndUpdate`:
//    okuyup sonra yazmak, ayni anda iki masaya giren oyuncunun bakiyesini
//    eksiye dusurebilirdi (koltuk yarisindaki ayni hata, bkz. masayaKatil).
//  - Her degisim deftere yaziliyor (modeller/CipHareketi.ts). Defter yazilamazsa
//    bakiye degisikligi GERI ALINMIYOR — defter denetim icin, oyunun kendisi
//    icin degil; bir Mongo yazmasi yuzunden odul kaybolmamali.

import { createHash } from 'node:crypto';
import {
  BASLANGIC_CIPI,
  HEDIYE_TAVANI_SAAT,
  REKLAM_CARPANI,
  SAATLIK_HEDIYE,
  birikim,
  reklamEki,
  toplamaSonrasi,
} from '@kut/ekonomi';
import { BaslangicHakki } from '../modeller/BaslangicHakki.js';
import { CipHareketi, type CipSebebi } from '../modeller/CipHareketi.js';
import { Oyuncu } from '../modeller/Oyuncu.js';
import { ReklamFisi } from '../modeller/ReklamFisi.js';
import { kayit } from '../kayit.js';

export class CuzdanHatasi extends Error {}

async function deftereYaz(
  oyuncuId: string,
  miktar: number,
  sebep: CipSebebi,
  bakiye: number,
  masaId?: string,
  aciklama?: string,
): Promise<void> {
  try {
    await CipHareketi.create({
      oyuncu: oyuncuId,
      miktar,
      sebep,
      bakiye,
      ...(masaId === undefined ? {} : { masa: masaId }),
      ...(aciklama === undefined ? {} : { aciklama }),
    });
  } catch (hata) {
    kayit.uyari('Cip hareketi deftere yazilamadi', { oyuncuId, miktar, sebep, hata });
  }
}

/** Bakiyeye ekler. Yeni bakiyeyi doner; oyuncu yoksa (hesabini sildi) null. */
export async function cipEkle(
  oyuncuId: string,
  miktar: number,
  sebep: CipSebebi,
  masaId?: string,
  aciklama?: string,
): Promise<number | null> {
  const guncel = await Oyuncu.findOneAndUpdate(
    { _id: oyuncuId },
    { $inc: { 'cuzdan.cip': miktar } },
    { new: true, projection: { cuzdan: 1 } },
  );
  if (guncel === null) return null;
  await deftereYaz(oyuncuId, miktar, sebep, guncel.cuzdan.cip, masaId, aciklama);
  return guncel.cuzdan.cip;
}

/** Bakiyeden duser — yalnizca YETIYORSA. Yetmiyorsa hicbir sey yapmaz, null. */
export async function cipDus(
  oyuncuId: string,
  miktar: number,
  sebep: CipSebebi,
  masaId?: string,
  aciklama?: string,
): Promise<number | null> {
  const guncel = await Oyuncu.findOneAndUpdate(
    { _id: oyuncuId, 'cuzdan.cip': { $gte: miktar } },
    { $inc: { 'cuzdan.cip': -miktar } },
    { new: true, projection: { cuzdan: 1 } },
  );
  if (guncel === null) return null;
  await deftereYaz(oyuncuId, -miktar, sebep, guncel.cuzdan.cip, masaId, aciklama);
  return guncel.cuzdan.cip;
}

export interface Tahsilat {
  readonly odeyenler: readonly string[];
  /** Bakiyesi yetmeyenler. Bos degilse KIMSEDEN tahsil edilmemistir. */
  readonly yetersizler: readonly string[];
}

/**
 * Masadaki insanlarin girisini tahsil eder — hepsinden ya da hicbirinden.
 *
 * Biri oduyemezse odeyenlere iade edilir ve el baslamaz. Yarim tahsilatla
 * baslayan bir el, pot hesabini ve iadeyi ayri ayri takip etmek demek olurdu.
 *
 * Oturduktan sonra bakiyenin dusmesi normalde imkansiz (oyuncu ayni anda tek
 * masada), ama iki cihazdan giris ya da elle yapilan bir duzeltme bunu
 * yapabilir; o durumda masa kilitlenmemeli.
 */
export async function girisleriTahsilEt(
  masaId: string,
  oyuncuIdler: readonly string[],
  giris: number,
): Promise<Tahsilat> {
  const odeyenler: string[] = [];
  const yetersizler: string[] = [];
  for (const oyuncuId of oyuncuIdler) {
    const bakiye = await cipDus(oyuncuId, giris, 'masa-giris', masaId);
    (bakiye === null ? yetersizler : odeyenler).push(oyuncuId);
  }
  if (yetersizler.length === 0) return { odeyenler, yetersizler };

  for (const oyuncuId of odeyenler) await cipEkle(oyuncuId, giris, 'masa-iadesi', masaId);
  return { odeyenler: [], yetersizler };
}

// --- Baslangic cipi: CIHAZ basina bir kez -----------------------------------
//
// Hesap basina verilseydi, hesabini silip yeniden acan ya da ayni telefonda
// ikinci e-posta hesabi acan her seferinde 15 bin cip alirdi; bu cipler maci
// kaybederek bir ana hesaba aktarilabiliyor. Uygulamayi silip kurmak ise
// artik yeni hesap bile acmiyor: cihaz kimligi yeniden kurulumda degismiyor
// (istemci ag/depo.ts) ve misafir girisi ayni hesabi donduruyor.

function cihazOzeti(cihazKimligi: string): string {
  return createHash('sha256').update(cihazKimligi).digest('hex');
}

/**
 * Cihaz baslangic cipini henuz almadiysa hakkini kullanir ve true doner.
 *
 * Benzersiz indeks yarisi da cozuyor: ayni cihazdan iki hesap ayni anda
 * acilirsa ikincisi E11000 alir. Cihaz kimligi olmayan kayit (istemci her
 * zaman gonderiyor; yalnizca elle yapilan API cagrisi) baslangic cipi almaz.
 */
export async function baslangicHakkiKullan(cihazKimligi: string | undefined): Promise<boolean> {
  if (cihazKimligi === undefined) return false;
  try {
    await BaslangicHakki.create({ ozet: cihazOzeti(cihazKimligi) });
    return true;
  } catch (hata) {
    if ((hata as { code?: unknown }).code === 11000) return false;
    throw hata;
  }
}

/** Yeni hesabin baslangic cipi deftere. Bakiyeyi hesap acan yol veriyor. */
export async function baslangicKaydet(oyuncuId: string): Promise<void> {
  await deftereYaz(oyuncuId, BASLANGIC_CIPI, 'baslangic', BASLANGIC_CIPI);
}

/**
 * Cihaz kaydi ekonomiden ONCE acilmis misafirleri "baslangic cipini aldi"
 * sayar — hepsi aldi (cipGocu). Yalnizca defter bosken kosuyor: bir kez
 * doldurulduktan sonra her yeni hesap zaten kendi kaydini yaziyor.
 */
export async function baslangicHaklariniDoldur(): Promise<number> {
  if ((await BaslangicHakki.estimatedDocumentCount()) > 0) return 0;
  const misafirler = await Oyuncu.find({ 'saglayicilar.tip': 'misafir' })
    .select('saglayicilar')
    .lean();
  const ozetler = misafirler.flatMap((o) =>
    o.saglayicilar.filter((s) => s.tip === 'misafir').map((s) => ({ ozet: cihazOzeti(s.disKimlik) })),
  );
  if (ozetler.length === 0) return 0;
  const sonuc = await BaslangicHakki.insertMany(ozetler, { ordered: false }).catch(
    (hata: { insertedDocs?: unknown[] }) => hata.insertedDocs ?? [],
  );
  return sonuc.length;
}

// --- Hediye cip --------------------------------------------------------------
//
// Kurallar @kut/ekonomi hediye.ts'te. Burada saat SUNUCUNUN: telefonun saati
// ileri alinarak birikim kazanilamaz.

/** Reklam fisinin omru: reklam o sure icinde izlenmezse ek hak yanar. */
const FIS_OMRU_MS = 30 * 60_000;

export interface HediyeDurumu {
  readonly miktar: number;
  readonly saat: number;
  readonly tavanda: boolean;
  readonly sonrakiSaatMs: number | null;
  readonly saatlik: number;
  readonly tavanSaat: number;
  readonly reklamCarpani: number;
}

export interface HediyeSonucu {
  readonly kazanilan: number;
  /** Toplamadan sonraki bakiye. */
  readonly cip: number;
  /** Reklam izlenirse bozdurulacak fis. */
  readonly fis: { readonly kimlik: string; readonly ekMiktar: number; readonly sonKullanma: string };
}

export async function hediyeDurumu(oyuncuId: string, suAn = Date.now()): Promise<HediyeDurumu> {
  const oyuncu = await Oyuncu.findById(oyuncuId).select('cuzdan').lean();
  if (oyuncu === null) throw new CuzdanHatasi('oyuncu-bulunamadi');
  return {
    ...birikim(oyuncu.cuzdan.sonHediye.getTime(), suAn),
    saatlik: SAATLIK_HEDIYE,
    tavanSaat: HEDIYE_TAVANI_SAAT,
    reklamCarpani: REKLAM_CARPANI,
  };
}

/**
 * Biriken hediyeyi toplar.
 *
 * Atomik: filtre "son toplama HALA okudugum an" diyor. Iki cihazdan ayni anda
 * basan oyuncu iki kez toplayamaz — ikincisi bos doner.
 */
export async function hediyeTopla(oyuncuId: string, suAn = Date.now()): Promise<HediyeSonucu> {
  const oyuncu = await Oyuncu.findById(oyuncuId).select('cuzdan').lean();
  if (oyuncu === null) throw new CuzdanHatasi('oyuncu-bulunamadi');

  const eski = oyuncu.cuzdan.sonHediye;
  const { miktar } = birikim(eski.getTime(), suAn);
  if (miktar === 0) throw new CuzdanHatasi('hediye-birikmedi');

  const guncel = await Oyuncu.findOneAndUpdate(
    { _id: oyuncuId, 'cuzdan.sonHediye': eski },
    {
      $set: { 'cuzdan.sonHediye': new Date(toplamaSonrasi(eski.getTime(), suAn)) },
      $inc: { 'cuzdan.cip': miktar },
    },
    { new: true, projection: { cuzdan: 1 } },
  );
  if (guncel === null) throw new CuzdanHatasi('hediye-birikmedi');
  await deftereYaz(oyuncuId, miktar, 'hediye', guncel.cuzdan.cip);

  const fis = await ReklamFisi.create({
    oyuncu: oyuncuId,
    ekMiktar: reklamEki(miktar),
    sonKullanma: new Date(suAn + FIS_OMRU_MS),
  });

  return {
    kazanilan: miktar,
    cip: guncel.cuzdan.cip,
    fis: {
      kimlik: String(fis._id),
      ekMiktar: fis.ekMiktar,
      sonKullanma: fis.sonKullanma.toISOString(),
    },
  };
}

/**
 * Hediye saati olmayan eski belgelere simdiki ani yazar: birikim bugunden
 * baslar. Gecmise dogru "48 saat birikmis" saymak, guncellemeyi alan herkese
 * bir anda 4.800 cip dagitmak olurdu.
 */
export async function hediyeSaatiGocu(): Promise<number> {
  const sonuc = await Oyuncu.updateMany(
    { 'cuzdan.sonHediye': { $exists: false } },
    { $set: { 'cuzdan.sonHediye': new Date() } },
  );
  return sonuc.modifiedCount;
}

/**
 * Eski belgeleri tasir: `cuzdan.jeton` → `cuzdan.cip`.
 *
 * Ekonomi acilmadan once kimsenin bakiyesi yoktu (alan hic okunmuyordu, hep
 * 0'di); tasinan her hesap yeni hesap gibi baslangic cipini aliyor. Sart
 * `$exists: false` oldugu icin acilista her seferinde kosmasi zararsiz.
 *
 * `strict: false` gerekli: `cuzdan.jeton` artik semada yok, mongoose onu
 * `$unset`ten sessizce atardi.
 */
export async function cipGocu(): Promise<number> {
  const sonuc = await Oyuncu.updateMany(
    { 'cuzdan.cip': { $exists: false } },
    { $set: { 'cuzdan.cip': BASLANGIC_CIPI }, $unset: { 'cuzdan.jeton': '' } },
    { strict: false },
  );
  return sonuc.modifiedCount;
}

export interface CuzdanDurumu {
  readonly cip: number;
  readonly seviye: number;
  readonly deneyim: number;
}

/** Istemcinin ust barini tazelemesi icin: kimlik -> bakiye ve seviye. */
export async function cuzdanDurumlari(
  oyuncuIdler: readonly string[],
): Promise<Map<string, CuzdanDurumu>> {
  const oyuncular = await Oyuncu.find({ _id: { $in: oyuncuIdler } })
    .select('cuzdan ilerleme')
    .lean();
  return new Map(
    oyuncular.map((o) => [
      String(o._id),
      { cip: o.cuzdan.cip, seviye: o.ilerleme.seviye, deneyim: o.ilerleme.deneyim },
    ]),
  );
}
