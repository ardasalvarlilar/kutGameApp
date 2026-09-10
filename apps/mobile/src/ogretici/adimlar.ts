// Ogreticinin adim listesi.
//
// Saf veri: hangi ogeye isik tutulacak ve hangi metin gosterilecek. Metinler
// dogrudan degil SOZLUK ANAHTARI olarak duruyor — ogretici de her ekran gibi
// iki dilli.
//
// Bu dosyada oyun mantigi YOK. Adimin ne zaman gecilecegi (kullanicinin
// hamlesini bekleyen adimlar) ayri bir alanda tutulacak; su an yalnizca
// anlatan adimlar var.

import type { MetinAnahtari } from '../dil';
import type { Beklenti } from './beklenti';
import type { OgreticiHedefi } from './hedefKaydi';

export interface OgreticiAdimi {
  /** Kodda ve testte adima referans vermek icin. */
  readonly ad: string;
  /** Isik tutulacak oge; null ise balon ekranin ortasinda durur. */
  readonly hedef: OgreticiHedefi | null;
  readonly baslik: MetinAnahtari;
  readonly metin: MetinAnahtari;
  /** Kuralin ince yeri — balonun altinda ayri satirda. */
  readonly ekBilgi?: MetinAnahtari;
  /**
   * Adimin ne bekledigi. `ileri` disindaki her deger kullanicinin (ya da yer
   * tutucularin) gercek hamlesini bekliyor; ILERI dugmesi gorunmuyor, yerine
   * GEC duruyor.
   */
  readonly bekler: Beklenti;
}

/**
 * Adimlarin SIRASI oyunun akisina bagli, keyfi degil:
 *
 *   ac → at        acilis hamlesinden sonra tas atmak zorunlu (§1/§4)
 *   → rakipler     3 numarali okeyle aciyor; §6 zaten "bir tur donmeden
 *                  isleme yapilamaz" diyor, yani bu bekleme kuralin kendisi
 *   → isle/okeyAl  sira geri geldiginde ikisi de mumkun
 *   → calma        pencere ancak baskasi atinca aciliyor (§5)
 */
export const OGRETICI_ADIMLARI: readonly OgreticiAdimi[] = [
  {
    ad: 'hosgeldin',
    hedef: null,
    baslik: 'ogretici.hosgeldinBaslik',
    metin: 'ogretici.hosgeldinMetin',
    bekler: 'ileri',
  },
  {
    ad: 'tur',
    hedef: 'tur',
    baslik: 'ogretici.turBaslik',
    metin: 'ogretici.turMetin',
    bekler: 'ileri',
  },
  {
    ad: 'sart',
    hedef: 'sart',
    baslik: 'ogretici.sartBaslik',
    metin: 'ogretici.sartMetin',
    ekBilgi: 'ogretici.sartEk',
    bekler: 'ileri',
  },
  {
    ad: 'istaka',
    hedef: 'istaka',
    baslik: 'ogretici.istakaBaslik',
    metin: 'ogretici.istakaMetin',
    bekler: 'ileri',
  },
  {
    ad: 'ac',
    hedef: 'ac',
    baslik: 'ogretici.acBaslik',
    metin: 'ogretici.acMetin',
    ekBilgi: 'ogretici.acEk',
    bekler: 'actim',
  },
  {
    ad: 'at',
    hedef: 'orta',
    baslik: 'ogretici.atBaslik',
    metin: 'ogretici.atMetin',
    ekBilgi: 'ogretici.atEk',
    bekler: 'attim',
  },
  {
    ad: 'rakipler',
    hedef: null,
    baslik: 'ogretici.rakiplerBaslik',
    metin: 'ogretici.rakiplerMetin',
    bekler: 'siramGeldi',
  },
  {
    ad: 'cek',
    hedef: 'orta',
    baslik: 'ogretici.cekBaslik',
    metin: 'ogretici.cekMetin',
    ekBilgi: 'ogretici.cekEk',
    bekler: 'cektim',
  },
  {
    ad: 'isle',
    hedef: 'isle',
    baslik: 'ogretici.isleBaslik',
    metin: 'ogretici.isleMetin',
    ekBilgi: 'ogretici.isleEk',
    bekler: 'isledim',
  },
  {
    ad: 'okeyAl',
    hedef: 'okeyAl',
    baslik: 'ogretici.okeyAlBaslik',
    metin: 'ogretici.okeyAlMetin',
    ekBilgi: 'ogretici.okeyAlEk',
    bekler: 'okeyAldim',
  },
  // İNDİR yalnizca SIRA SENDEYKEN calisiyor, bu yuzden burada — okeyi aldiktan
  // hemen sonra, ayni sirada.
  //
  // Atma adimiyla BIRLESIK: ikisi ayriyken kullanici indirdikten sonra tasi da
  // atiyor (sirayi bitirmek dogal refleks), ama adim hala ILERI bekledigi icin
  // masa donuk kaliyor ve sira gelen oyuncu oynayamiyordu. Tek adim, tek cikis
  // sarti: siranin bitmesi.
  {
    ad: 'indir',
    hedef: 'indir',
    baslik: 'ogretici.indirBaslik',
    metin: 'ogretici.indirMetin',
    ekBilgi: 'ogretici.indirEk',
    bekler: 'attim',
  },
  {
    ad: 'calmaBekle',
    hedef: null,
    baslik: 'ogretici.calmaBekleBaslik',
    metin: 'ogretici.calmaBekleMetin',
    bekler: 'calabilirim',
  },
  {
    ad: 'istiyorum',
    hedef: 'istiyorum',
    baslik: 'ogretici.istiyorumBaslik',
    metin: 'ogretici.istiyorumMetin',
    ekBilgi: 'ogretici.istiyorumEk',
    bekler: 'talepEttim',
  },
  {
    ad: 'calmaSonuc',
    hedef: 'istaka',
    baslik: 'ogretici.calmaSonucBaslik',
    metin: 'ogretici.calmaSonucMetin',
    ekBilgi: 'ogretici.calmaSonucEk',
    bekler: 'talebimSonuclandi',
  },
  {
    ad: 'ciftimVar',
    hedef: 'ciftimVar',
    baslik: 'ogretici.ciftimVarBaslik',
    metin: 'ogretici.ciftimVarMetin',
    ekBilgi: 'ogretici.ciftimVarEk',
    bekler: 'ileri',
  },
  {
    ad: 'bitti',
    hedef: null,
    baslik: 'ogretici.bittiBaslik',
    metin: 'ogretici.bittiMetin',
    bekler: 'ileri',
  },
];
