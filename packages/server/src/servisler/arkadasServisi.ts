// Arkadaslik: istek gonder, kabul et, reddet, cikar, listele.
//
// Neden var: oyunun kendisi dort kisilik ve arkadaslarla oynanmak icin
// tasarlandi (ozel masa + kod, bkz. bilesenler/Lobi.tsx). Kod paylasmak her
// oturumda yeniden yapilan bir is; arkadas listesi onu bir kez yapip
// kalicilastiriyor.
//
// Uc karar bu dosyanin sekli belirledi:
//
// 1. ARAMA yalnizca ARKADAS KODUYLA. Ad benzersiz degil, e-posta ile arama
//    ise hangi adreslerin kayitli oldugunu sizdirir (bkz. modeller/Oyuncu.ts).
// 2. ENGEL, arkadasligi KESER ve yeni istegi engeller. Iki sistemin
//    birbirini gormemesi, engelledigin kisinin arkadas listende durmasi
//    demek olurdu (App Store 1.2 ile de celisir).
// 3. Karsilikli istek KABUL sayilir. A, B'ye istek attiktan sonra B de A'ya
//    atarsa "zaten istek var" demek anlamsiz: ikisi de istiyor.

import { Types } from 'mongoose';
import { randomInt } from 'node:crypto';
import {
  Arkadaslik,
  ciftiNormalle,
  type ArkadaslikDurumu,
} from '../modeller/Arkadaslik.js';
import { Masa } from '../modeller/Masa.js';
import { Oyuncu } from '../modeller/Oyuncu.js';
import { aralarindaEngelVarMi, engelliKimlikler } from './moderasyonServisi.js';

export class ArkadasHatasi extends Error {}

/** Bir oyuncunun arkadas sayisi siniri. Liste ekrani ve sorgu maliyeti icin. */
const EN_FAZLA_ARKADAS = 200;

/** Ayni anda bekleyebilecek GIDEN istek siniri — spam'a karsi. */
const EN_FAZLA_GIDEN_ISTEK = 50;

/**
 * Kod alfabesi. Masa koduyla ayni gerekce (servisler/masaServisi.ts):
 * karisabilecek harfler yok (0/O, 1/I/L). Kod sesli soyleniyor.
 */
const KOD_ALFABESI = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const KOD_UZUNLUGU = 5;
const KOD_ONEKI = 'KUT-';

function kimlik(deger: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(deger)) throw new ArkadasHatasi('gecersiz-oyuncu');
  return new Types.ObjectId(deger);
}

function kodUret(): string {
  let kod = '';
  for (let i = 0; i < KOD_UZUNLUGU; i++) {
    // `randomInt`: kod tahmin edilebilir olmamali — tahmin edilebilse
    // yabancilar sirayla deneyerek herkese istek atabilirdi.
    kod += KOD_ALFABESI[randomInt(0, KOD_ALFABESI.length)];
  }
  return `${KOD_ONEKI}${kod}`;
}

/** Girilen kodu normalize eder: bosluk, kucuk harf ve eksik onek affedilir. */
export function koduNormalle(girdi: string): string {
  const govde = girdi
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/^KUT/, '');
  return `${KOD_ONEKI}${govde}`;
}

/**
 * Oyuncunun arkadas kodu; yoksa uretip kaydeder.
 *
 * Uretim TEMBEL: hesap acilirken uretmek, kodu hic kullanmayacak oyuncular
 * icin de benzersizlik sorgusu demek olurdu. Cakisma ihtimaline karsi birkac
 * kez denenir; benzersiz indeks son sozu soyler.
 */
export async function arkadasKodu(oyuncuId: string): Promise<string> {
  const oyuncu = await Oyuncu.findById(kimlik(oyuncuId)).select('arkadasKodu');
  if (oyuncu === null) throw new ArkadasHatasi('oyuncu-bulunamadi');
  if (typeof oyuncu.arkadasKodu === 'string' && oyuncu.arkadasKodu.length > 0) {
    return oyuncu.arkadasKodu;
  }

  for (let deneme = 0; deneme < 8; deneme++) {
    const kod = kodUret();
    // `arkadasKodu` alani hala bos olan belgeye yaz: iki es zamanli istek
    // gelirse ikincisi hicbir belge guncellemez ve asagida mevcut kodu okur.
    const yazildi = await Oyuncu.findOneAndUpdate(
      { _id: oyuncu._id, $or: [{ arkadasKodu: { $exists: false } }, { arkadasKodu: null }] },
      { $set: { arkadasKodu: kod } },
      { new: true },
    )
      .select('arkadasKodu')
      .lean()
      .catch(() => null);

    if (yazildi !== null) return yazildi.arkadasKodu as string;

    const guncel = await Oyuncu.findById(oyuncu._id).select('arkadasKodu').lean();
    if (typeof guncel?.arkadasKodu === 'string') return guncel.arkadasKodu;
  }
  throw new ArkadasHatasi('arkadas-kodu-uretilemedi');
}

// --- Ozetler -----------------------------------------------------------------

export interface ArkadasOzeti {
  readonly id: string;
  readonly ad: string;
  /** Son gorulme (ISO). Istemci "3 saat önce" gibi gosteriyor. */
  readonly sonGorulme: string;
  /**
   * Arkadasin su an oturdugu ve KATILINABILIR masanin kodu; yoksa null.
   * Arkadas listesini eyleme donusturen sey bu — "arkadasinin masasina
   * katil" tek dokunusla oluyor, kod sormaya gerek kalmiyor.
   */
  readonly masaKodu: string | null;
}

export interface ArkadasIstegiOzeti {
  readonly id: string;
  readonly ad: string;
  /** Istek ne zaman geldi (ISO). */
  readonly zaman: string;
}

export interface ArkadasDurumu {
  readonly arkadaslar: readonly ArkadasOzeti[];
  /** Bana gelen, cevabimi bekleyen istekler. */
  readonly gelenIstekler: readonly ArkadasIstegiOzeti[];
  /** Benim atip cevap bekledigim istekler. */
  readonly gidenIstekler: readonly ArkadasIstegiOzeti[];
  readonly kodum: string;
}

/** Belgedeki ciftin KARSI tarafi. */
function karsiTaraf(belge: { kucuk: Types.ObjectId; buyuk: Types.ObjectId }, ben: string): string {
  return String(belge.kucuk) === ben ? String(belge.buyuk) : String(belge.kucuk);
}

/**
 * Verilen oyuncularin oturdugu, HENUZ BASLAMAMIS ve dolu olmayan masalar.
 *
 * Tek sorgu: arkadas basina sorgu atmak N+1 olurdu ve liste ekrani her
 * acildiginda kosuyor.
 */
async function katilinabilirMasalar(
  kimlikler: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  if (kimlikler.length === 0) return new Map();

  const masalar = await Masa.find({
    durum: 'bekliyor',
    'koltuklar.oyuncu': { $in: kimlikler.map((id) => new Types.ObjectId(id)) },
  })
    .select('kod koltuklar')
    .lean();

  const harita = new Map<string, string>();
  for (const masa of masalar) {
    // Dolu masaya katilinamaz; kodu gostermek bos umut olurdu.
    if (masa.koltuklar.length >= 4) continue;
    for (const koltuk of masa.koltuklar) harita.set(String(koltuk.oyuncu), masa.kod);
  }
  return harita;
}

/** Oyuncunun arkadaslari, gelen ve giden istekleri — tek cagride. */
export async function arkadasDurumu(oyuncuId: string): Promise<ArkadasDurumu> {
  const ben = kimlik(oyuncuId);
  const benMetin = String(ben);

  const [kayitlar, engelliler, kodum] = await Promise.all([
    Arkadaslik.find({ $or: [{ kucuk: ben }, { buyuk: ben }] })
      .sort({ updatedAt: -1 })
      .lean(),
    // Engellenen biri arkadas listesinde GORUNMEZ. Iliski silinmiyor:
    // engel kalkarsa arkadaslik geri gelsin (App Store 1.2 "geri alabilme").
    engelliKimlikler(oyuncuId),
    arkadasKodu(oyuncuId),
  ]);

  const gorunur = kayitlar.filter((kayit) => !engelliler.has(karsiTaraf(kayit, benMetin)));
  const karsiKimlikler = gorunur.map((kayit) => karsiTaraf(kayit, benMetin));

  const [kisiler, masaKodlari] = await Promise.all([
    Oyuncu.find({ _id: { $in: karsiKimlikler.map((id) => new Types.ObjectId(id)) } })
      .select('ad sonGorulme')
      .lean(),
    katilinabilirMasalar(
      gorunur
        .filter((kayit) => kayit.durum === 'arkadas')
        .map((kayit) => karsiTaraf(kayit, benMetin)),
    ),
  ]);
  const kisiHaritasi = new Map(kisiler.map((kisi) => [String(kisi._id), kisi]));

  const arkadaslar: ArkadasOzeti[] = [];
  const gelenIstekler: ArkadasIstegiOzeti[] = [];
  const gidenIstekler: ArkadasIstegiOzeti[] = [];

  for (const kayit of gorunur) {
    const karsiId = karsiTaraf(kayit, benMetin);
    const kisi = kisiHaritasi.get(karsiId);
    // Silinmis hesap: iliski asili kalmis olabilir, listede gosterme.
    if (kisi === undefined) continue;

    if (kayit.durum === 'arkadas') {
      arkadaslar.push({
        id: karsiId,
        ad: kisi.ad,
        sonGorulme: kisi.sonGorulme.toISOString(),
        masaKodu: masaKodlari.get(karsiId) ?? null,
      });
      continue;
    }

    const ozet: ArkadasIstegiOzeti = {
      id: karsiId,
      ad: kisi.ad,
      zaman: (kayit.createdAt as Date | undefined)?.toISOString() ?? new Date(0).toISOString(),
    };
    if (String(kayit.isteyen) === benMetin) gidenIstekler.push(ozet);
    else gelenIstekler.push(ozet);
  }

  arkadaslar.sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
  return { arkadaslar, gelenIstekler, gidenIstekler, kodum };
}

// --- Arama -------------------------------------------------------------------

export interface BulunanOyuncu {
  readonly id: string;
  readonly ad: string;
  /** Bu oyuncuyla aramdaki durum — istemci dogru dugmeyi gostersin diye. */
  readonly iliski: 'yok' | 'bekliyor' | 'istek-geldi' | 'arkadas' | 'ben';
}

/**
 * Arkadas koduyla oyuncu arar.
 *
 * "Bulunamadi" ile "engelli" AYNI cevabi veriyor: engellendigini karsi tarafa
 * sezdirmek, engellemeyi ise yaramaz hale getirir (moderasyonServisi'ndeki
 * ayni gerekce).
 */
export async function koduAra(oyuncuId: string, kod: string): Promise<BulunanOyuncu | null> {
  const ben = kimlik(oyuncuId);
  const aranan = koduNormalle(kod);
  if (aranan.length !== KOD_ONEKI.length + KOD_UZUNLUGU) return null;

  const bulunan = await Oyuncu.findOne({ arkadasKodu: aranan }).select('ad').lean();
  if (bulunan === null) return null;

  const bulunanId = String(bulunan._id);
  if (bulunanId === String(ben)) {
    return { id: bulunanId, ad: bulunan.ad, iliski: 'ben' };
  }
  if (await aralarindaEngelVarMi(oyuncuId, bulunanId)) return null;

  const cift = ciftiNormalle(ben, new Types.ObjectId(bulunanId));
  const kayit = await Arkadaslik.findOne(cift).lean();

  const iliski: BulunanOyuncu['iliski'] =
    kayit === null
      ? 'yok'
      : kayit.durum === 'arkadas'
        ? 'arkadas'
        : String(kayit.isteyen) === String(ben)
          ? 'bekliyor'
          : 'istek-geldi';

  return { id: bulunanId, ad: bulunan.ad, iliski };
}

// --- Istek akisi -------------------------------------------------------------

/** Mongo'nun benzersiz indeks ihlali. */
function cakismaMi(hata: unknown): boolean {
  return typeof hata === 'object' && hata !== null && (hata as { code?: number }).code === 11000;
}

async function sayimKontrol(ben: Types.ObjectId, hedef: Types.ObjectId): Promise<void> {
  const [benimArkadas, hedefArkadas, benimGiden] = await Promise.all([
    Arkadaslik.countDocuments({ $or: [{ kucuk: ben }, { buyuk: ben }], durum: 'arkadas' }),
    Arkadaslik.countDocuments({ $or: [{ kucuk: hedef }, { buyuk: hedef }], durum: 'arkadas' }),
    Arkadaslik.countDocuments({
      $or: [{ kucuk: ben }, { buyuk: ben }],
      durum: 'bekliyor',
      isteyen: ben,
    }),
  ]);

  if (benimArkadas >= EN_FAZLA_ARKADAS) throw new ArkadasHatasi('arkadas-listen-dolu');
  if (hedefArkadas >= EN_FAZLA_ARKADAS) {
    throw new ArkadasHatasi('karsi-arkadas-listesi-dolu');
  }
  if (benimGiden >= EN_FAZLA_GIDEN_ISTEK) {
    throw new ArkadasHatasi('cok-bekleyen-istek');
  }
}

export type IstekSonucu = 'gonderildi' | 'arkadas-oldunuz' | 'zaten-arkadassiniz';

/**
 * Arkadaslik istegi gonderir.
 *
 * Karsi taraf zaten sana istek attiysa bu cagri ARKADASLIGA cevirir:
 * "zaten bir istek var" demek, ikisi de birbirini isterken oyuncuyu
 * gereksiz bir adima zorlamak olurdu.
 */
export async function istekGonder(oyuncuId: string, hedefId: string): Promise<IstekSonucu> {
  if (oyuncuId === hedefId) throw new ArkadasHatasi('kendine-istek');
  const ben = kimlik(oyuncuId);
  const hedef = kimlik(hedefId);

  if ((await Oyuncu.countDocuments({ _id: hedef })) === 0) {
    throw new ArkadasHatasi('oyuncu-bulunamadi');
  }
  // Engelliye istek atilamaz — iki yon de gecerli (App Store 1.2).
  if (await aralarindaEngelVarMi(oyuncuId, hedefId)) {
    throw new ArkadasHatasi('istek-gonderilemez');
  }
  await sayimKontrol(ben, hedef);

  const cift = ciftiNormalle(ben, hedef);

  try {
    await Arkadaslik.create({ ...cift, isteyen: ben, durum: 'bekliyor' });
    return 'gonderildi';
  } catch (hata) {
    // Belge zaten var. Iki durum olabilir ve ikisi de hata DEGIL.
    if (!cakismaMi(hata)) throw hata;
  }

  const mevcut = await Arkadaslik.findOne(cift);
  if (mevcut === null) throw new ArkadasHatasi('istek-gonderilemedi');
  if (mevcut.durum === 'arkadas') return 'zaten-arkadassiniz';

  // Bekleyen istek BENDEN geliyorsa yeniden gondermenin bir etkisi yok.
  if (String(mevcut.isteyen) === String(ben)) return 'gonderildi';

  // Karsi taraf istemis, ben de istiyorum → arkadassiniz.
  mevcut.durum = 'arkadas';
  mevcut.kabulZamani = new Date();
  await mevcut.save();
  return 'arkadas-oldunuz';
}

/**
 * Gelen istegi kabul eder.
 *
 * Filtre "bana gelmis ve hala bekliyor" diyor: kendi gonderdigin istegi
 * kendin kabul edemezsin (`isteyen: { $ne: ben }`).
 */
export async function istegiKabulEt(oyuncuId: string, hedefId: string): Promise<void> {
  const ben = kimlik(oyuncuId);
  const cift = ciftiNormalle(ben, kimlik(hedefId));

  const sonuc = await Arkadaslik.findOneAndUpdate(
    { ...cift, durum: 'bekliyor', isteyen: { $ne: ben } },
    { $set: { durum: 'arkadas' as ArkadaslikDurumu, kabulZamani: new Date() } },
  );
  if (sonuc === null) throw new ArkadasHatasi('bekleyen-istek-yok');
}

/**
 * Istegi reddeder ya da arkadasligi bitirir.
 *
 * Tek fonksiyon, cunku ikisi de ayni sey: iliskiyi silmek. Ayri uclar
 * yapmak, istemcinin once durumu dogru bilmesini gerektirirdi.
 */
export async function iliskiyiSil(oyuncuId: string, hedefId: string): Promise<void> {
  const cift = ciftiNormalle(kimlik(oyuncuId), kimlik(hedefId));
  await Arkadaslik.deleteOne(cift);
}

/**
 * Hesap silindiginde iliskilerini de siler.
 *
 * Kalirsa: karsi tarafin listesinde adi cozulemeyen bir kayit asili kalir ve
 * kota sayimlarina dahil olur.
 */
export async function iliskileriTemizle(oyuncuId: string): Promise<void> {
  if (!Types.ObjectId.isValid(oyuncuId)) return;
  const ben = new Types.ObjectId(oyuncuId);
  await Arkadaslik.deleteMany({ $or: [{ kucuk: ben }, { buyuk: ben }] });
}
