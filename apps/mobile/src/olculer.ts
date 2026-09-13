// Masadaki olculer — tas boyutlari ve yerlesim hesabi.
//
// Bu bir KURAL DEGIL, yerlesim matematigi. Modul saf tutuldu: React Native
// import etmiyor, boylece vitest okuyabiliyor (kosucu yalnizca
// src/**/*.test.ts aliyor, RN bilesenleri girmiyor).
//
// Cozdugu problem: sol ve sag oyuncunun yere indirdigi perler masanin
// ortasina DOGRU uzuyor. KURALLAR.md §2'ye gore bir seri 1'de baslayip
// 13'te durur, yani bir perde en fazla 13 tas yan yana gelebilir — on
// dorduncu bir tas olamaz. Sabit tas eniyle 13'luk bir seri yan sutuna
// sigmiyor, sonu kirpiliyordu. Tas eni artik masanin OLCULEN eninden
// turetiliyor ve ortadaki deste ile atik obegine ayrilan yer korunuyor.

import { kapasite } from './duzen';

export type TasBoyu = 'buyuk' | 'orta' | 'kucuk';

export interface TasOlcusu {
  readonly en: number;
  readonly boy: number;
  readonly yuvarlak: number;
  readonly yazi: number;
  readonly nokta: number;
}

/**
 * Tek bir olcu — enden turetilir. Oranlar tasin gorunumunu her boyda
 * ayni tutar; `OLCULER`'daki uc kademe de bu fonksiyondan cikiyor.
 */
export function tasOlcusu(en: number): TasOlcusu {
  const detay = Math.max(2, Math.round(en / 6.5));
  return {
    en,
    boy: Math.round(en * 1.4),
    yuvarlak: detay,
    yazi: Math.round(en * 0.6),
    nokta: detay,
  };
}

/**
 * Uc kademe — ISTAKADA kademe olarak, digerlerinde (deste, atik, ucan tas)
 * hep sabit boyut olarak kullaniliyor.
 *
 * `buyuk` istakanin NORMAL boyu: 14-16 taslik bir elde hep bu kullanilir,
 * Okey 101 Plus'taki kadar buyuk ve net olsun diye bilerek 25'ten 30'a
 * cikarildi. Calma yuzunden istakada 24+ tas birikince (KURALLAR.md §5)
 * `orta`ya, o da yetmezse `kucuk`e dusuluyor — bkz. Masa.tsx'teki kademe
 * secimi. Tas TEK TEK kuculmuyor: ya `buyuk`, ya `orta`, ya `kucuk`.
 */
export const OLCULER: Record<TasBoyu, TasOlcusu> = {
  buyuk: tasOlcusu(30),
  orta: tasOlcusu(20),
  kucuk: tasOlcusu(17),
};

/** Istaka kademe sirasi — buyukten kucuge, sigana kadar denenir. */
export const TAS_BOYU_SIRASI: readonly TasBoyu[] = ['buyuk', 'orta', 'kucuk'];

/** Bir slotun eni — tas eni + aradaki bosluk. Istaka ve surukleme burayi kullanir. */
export function slotEni(tas: TasOlcusu): number {
  return tas.en + 2;
}

/** Bir slotun boyu — tas boyu + aradaki bosluk. */
export function slotBoyu(tas: TasOlcusu): number {
  return tas.boy + 5;
}

export interface IstakaKademesi {
  readonly ad: TasBoyu;
  readonly sutunSayisi: number;
}

/**
 * Istaka kademesi + o kademedeki sutun sayisi.
 *
 * `genislik` olculen ıstaka piksel eni, `gerekliSlot` su an sigdirilmasi
 * gereken slot sayisi (tas sayisi + gruplar arasi bosluklar — SERİ DİZ/KÜT
 * DİZ ile acilan bosluklar da buna dahil edilmeli, yoksa "ekran hala dolu
 * degil ama yer yok" durumuna dusulur). Buyukten kucuge dogru dener, ilk
 * sigani secer; hicbiri sigmiyorsa en kucukte kalir (duzenTazele o durumda
 * bosluklari kapatip elinden geleni sigdirir — bkz. Masa.tsx).
 *
 * Kademe TEK TEK degil, ucer ucer degisir (KURALLAR.md disi bir UX karari):
 * 14 taslik normal elde hep 'buyuk' kalir, ancak sigmayinca 'orta'ya, o da
 * yetmeyince 'kucuk'e duser. Her tas calindiginda piksel piksel kuculmek
 * hem cirkin hem de gereksiz — cogu elde hic gerekmiyor.
 */
export function istakaKademesi(
  genislik: number,
  gerekliSlot: number,
  enAzSutun: number,
): IstakaKademesi {
  let sonuc: IstakaKademesi = { ad: 'buyuk', sutunSayisi: enAzSutun };
  for (const ad of TAS_BOYU_SIRASI) {
    const aday = Math.max(enAzSutun, Math.floor(genislik / slotEni(OLCULER[ad])));
    sonuc = { ad, sutunSayisi: aday };
    if (kapasite(aday) >= gerekliSlot) break;
  }
  return sonuc;
}

// --- Yerlesim sabitleri ------------------------------------------------------
// Stil dosyalari bu sayilari buradan okur; tek kaynak burasi.

/** KURALLAR.md §2 — seri 1'de baslar, 13'te durur: bir perde en fazla 13 tas. */
export const EN_UZUN_PER = 13;

/** masa'nin ic dolgusu (tek yan). */
export const MASA_DOLGU = 5;
/** ortaSira'nin bosluklari: sol|merkez ve merkez|sag. */
export const ORTA_BOSLUK = 4;
/** Dikey oyuncu seridinin eni. */
export const SERIT_EN = 22;
/** Serit ile per alani arasi. */
export const SUTUN_BOSLUK = 3;
/** Bir per kutusunun cercevesi: dolgu 2 + kenarlik 1, iki yandan. */
export const PER_CERCEVE = 6;
/** Perdeki taslarin arasi. */
export const PER_TAS_BOSLUK = 1;
/** Iki komsu per arasi. */
export const PER_ARASI = 5;

/** Ortadaki deste ile atik obegi arasi. */
export const ORTA_ARASI = 10;
/** Atik obeginde gorunen katman sayisi ve kaymasi — derinlik hissi. */
export const KATMAN_SINIRI = 4;
export const KATMAN_KAYMASI = 2;

/**
 * Merkeze ayrilan en az yer. Dokumu:
 *   deste     20 + 3×2 dolgu            = 26
 *   bosluk                              = 10  (ORTA_ARASI)
 *   atik obegi 20 + 4×2 katman + 2×2 kenarlik = 32
 *   adet rozetinin sagdan tasmasi       =  8
 *                                         --
 *                                         76  + 8 nefes payi
 */
export const MERKEZ_EN_AZ = 84;

/** Tas bu enin altina inerse sayi okunmuyor. */
export const EN_AZ_TAS_EN = 11;
/** Yan sutunlarda tavan — 'kucuk' olcusu. */
export const EN_COK_YAN_TAS_EN = 17;
/** Ust/alt siralarda tavan. Orada yer bol, yine de iki per yan yana dursun. */
export const EN_COK_YATAY_TAS_EN = 17;

// --- Hesaplar ----------------------------------------------------------------

function kisitla(deger: number, enAz: number, enCok: number): number {
  return Math.min(enCok, Math.max(enAz, deger));
}

/** `adet` tasin bir per kutusunda kapladigi en — cerceve dahil. */
export function perGenisligi(tasEni: number, adet: number): number {
  if (adet <= 0) return 0;
  return adet * tasEni + (adet - 1) * PER_TAS_BOSLUK + PER_CERCEVE;
}

/** Verilen ene `EN_UZUN_PER` tasin sigacagi en buyuk tas eni. */
function sigdir(kullanilabilir: number): number {
  const taslara = kullanilabilir - PER_CERCEVE - (EN_UZUN_PER - 1) * PER_TAS_BOSLUK;
  return Math.floor(taslara / EN_UZUN_PER);
}

/** Sol ve sag oyuncunun per alanina dusen en — serit haric. */
export function yanPerAlaniEni(masaEni: number): number {
  const ic = masaEni - 2 * MASA_DOLGU - 2 * ORTA_BOSLUK - MERKEZ_EN_AZ;
  return Math.floor(ic / 2) - SERIT_EN - SUTUN_BOSLUK;
}

/** Sol/sag sutunun tamami — serit dahil. Sutunun `maxWidth`'i budur. */
export function yanSutunEni(masaEni: number): number {
  return SERIT_EN + SUTUN_BOSLUK + Math.max(0, yanPerAlaniEni(masaEni));
}

/**
 * Sol/sag oyuncunun perlerindeki tas eni.
 * 13'luk bir seri yandaki istakadan ortadaki yigina kadar sigmali.
 */
export function yanTasEni(masaEni: number): number {
  if (masaEni <= 0) return EN_COK_YAN_TAS_EN;
  return kisitla(sigdir(yanPerAlaniEni(masaEni)), EN_AZ_TAS_EN, EN_COK_YAN_TAS_EN);
}

/**
 * Ust (karsi) ve alt (ben) siralardaki tas eni. Orada per masanin eni
 * boyunca uzayabiliyor; olcu iki uzun perin yan yana sigmasina gore secilir.
 */
export function yatayTasEni(masaEni: number): number {
  if (masaEni <= 0) return EN_COK_YATAY_TAS_EN;
  const ic = masaEni - 2 * MASA_DOLGU;
  return kisitla(
    sigdir(Math.floor((ic - PER_ARASI) / 2)),
    EN_AZ_TAS_EN,
    EN_COK_YATAY_TAS_EN,
  );
}
