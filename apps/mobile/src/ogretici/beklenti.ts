// Bir adimin ne bekledigi ve beklentinin karsilanip karsilanmadigi.
//
// Adimlar kullanicinin GERCEKTEN hamle yapmasini bekliyor ("bir tasi surukleyip
// yigina birak"), bu yuzden ilerlemenin olcutu bir dugme degil oyunun kendisi.
// Olcut, adimin BASINDAKI ozet ile SIMDIKI ozetin karsilastirilmasi: "acmis
// olmak" degil, "bu adimda acmis olmak" onemli.
//
// Saf: yalnizca `OyuncuGorunumu` okuyor, hicbir sey degistirmiyor.

import type { OyuncuGorunumu } from '@kut/engine';
import { yetkiler } from '../yetkiler';

export type Beklenti =
  /** Anlatan adim — ILERI dugmesiyle gecilir. */
  | 'ileri'
  /** Kullanici turun sartini yere indirdi. */
  | 'actim'
  /** Kullanici tas atti, sira gecti. */
  | 'attim'
  /** Kullanici tas cekti — sirasi geldiginde once bu olmak zorunda (§4). */
  | 'cektim'
  /** Kullanici yerdeki bir pere tas isledi. */
  | 'isledim'
  /** Kullanici yerden okey cekti. */
  | 'okeyAldim'
  /**
   * Tur donup sira kullaniciya geri geldi.
   *
   * Once burada "yerde okey belirdi" bekleniyordu ve KILITLENIYORDU: 3
   * numarali okeyle acar acmaz beklenti karsilaniyor, ogretici "sira sende,
   * tas cek" adimina geciyor, o adimda da fren iniyordu — 2 ve 1 numarali hic
   * oynamadan masa duruyordu. Beklenti artik turun TAMAMLANMASI.
   */
  | 'siramGeldi'
  /** Talep penceresi acildi ve kullanici "istiyorum" diyebiliyor. */
  | 'calabilirim'
  /**
   * Kullanici "istiyorum" dedi.
   *
   * "Tasi ALDI" degil: tas, oncelik sirasi kendisine gelirse geliyor (§5) ve
   * daha oncelikli bir yer tutucu onu gecebilir. Ogreticinin bekleyecegi sey
   * kullanicinin ELINDE olan sey olmali.
   */
  | 'talepEttim'
  /**
   * Talebim SONUCLANDI — pencere kapandi, tas ya bana geldi ya baskasina.
   *
   * Ayri bir adim olmak zorunda: §5'e gore talep, SIRASI GELEN oyuncu
   * hamlesini yapinca sonuclaniyor. "Istiyorum" adiminda masa donuk (kullanici
   * balonu okurken kaymasin diye) ve o donuklukta talep havada asili
   * kaliyordu — ne calinan tas ne ceza tasi geliyordu, oyun kilitlenmis
   * gorunuyordu. Bu adim freni acip sonucu bekliyor.
   */
  | 'talebimSonuclandi';

export interface OyunOzeti {
  readonly actim: boolean;
  readonly siraBende: boolean;
  /** Cekme yapildi mi — sira bendeyken `atma` fazi "cektim" demek. */
  readonly atmaFazinda: boolean;
  readonly yerdekiTasSayisi: number;
  readonly istakamdakiOkeySayisi: number;
  readonly talepEdebilirim: boolean;
  readonly talepEttim: boolean;
}

export function ozetle(gorunum: OyuncuGorunumu): OyunOzeti {
  const ben = gorunum.ben;
  return {
    actim: gorunum.acmisMi[ben],
    siraBende: gorunum.siradaki === ben,
    atmaFazinda: gorunum.faz === 'atma',
    yerdekiTasSayisi: gorunum.yer.reduce((toplam, per) => toplam + per.taslar.length, 0),
    istakamdakiOkeySayisi: gorunum.istakam.filter((tas) => tas.tip === 'okey').length,
    talepEdebilirim: yetkiler(gorunum).talepEdebilir,
    talepEttim: gorunum.pencere?.talepler.includes(ben) ?? false,
  };
}

/**
 * Adim gecilebilir mi?
 *
 * `once` adimin basinda alinan ozet. Fark bakmanin sebebi: kullanici o adima
 * gelmeden once zaten acmis olabilir (bir onceki adimda), o zaman adim
 * aninda gecilmis sayilirdi.
 */
export function beklentiKarsilandi(
  beklenti: Beklenti,
  once: OyunOzeti,
  simdi: OyunOzeti,
): boolean {
  switch (beklenti) {
    case 'ileri':
      return false;
    case 'actim':
      return !once.actim && simdi.actim;
    // "Sira benden CIKTI" — "bu adimda cikti" degil.
    //
    // Tolerans bilerek: kullanici anlatilan adimin ustune tasi erken atabiliyor
    // (indirdikten sonra sirasini bitirmek dogal bir refleks). Olcut
    // `once.siraBende && !simdi.siraBende` iken bu durumda beklenti bir daha
    // hic karsilanmiyor ve ogretici masayi donuk tutarak kilitleniyordu.
    case 'attim':
      return !simdi.siraBende;
    case 'cektim':
      return simdi.siraBende && !once.atmaFazinda && simdi.atmaFazinda;
    case 'isledim':
      return simdi.yerdekiTasSayisi > once.yerdekiTasSayisi;
    case 'okeyAldim':
      return simdi.istakamdakiOkeySayisi > once.istakamdakiOkeySayisi;
    case 'siramGeldi':
      return !once.siraBende && simdi.siraBende;
    case 'calabilirim':
      return simdi.talepEdebilirim;
    case 'talepEttim':
      return simdi.talepEttim;
    // "Tasi aldim" DEGIL "talebim sonuclandi": daha oncelikli biri gecmis
    // olabilir (§5) ve o zaman da adim ilerlemeli.
    case 'talebimSonuclandi':
      return once.talepEttim && !simdi.talepEttim;
  }
}

/**
 * Bu adim yer tutucularin oynamasini mi bekliyor?
 *
 * Kullanicidan hamle bekleyen adimlarda masa DURUYOR: balonu okurken rakip
 * hamlesi ekrani degistirmesin. Rakibin hamlesini bekleyen adimlarda ise
 * fren aciliyor.
 */
export function yerTutucularOynasin(beklenti: Beklenti): boolean {
  return (
    beklenti === 'siramGeldi' ||
    beklenti === 'calabilirim' ||
    beklenti === 'talebimSonuclandi'
  );
}
