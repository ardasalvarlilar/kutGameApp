// Yapilandirilabilir kural ayarlari.
//
// KURALLAR.md §9'daki yedi madde 2026-08-27'de karara baglandi. Kararlar
// asagida VARSAYILAN_AYARLAR icinde, her biri madde numarasiyla duruyor.
// Deger olarak parametrik biraktik: bir karar degisirse tek satir donuyor,
// motorun geri kalanina dokunulmuyor.

export interface KuralAyarlari {
  /**
   * KURALLAR.md §5 talep penceresi / §9.6 (karara baglandi: 3000 ms).
   * Tas atildiktan sonra sirasi gelen oyuncunun desteden cekmesi bu sure
   * kadar engellenir; digerlerine garanti tepki suresi verir.
   * Tur 15'te ayni sure yerden tas almayi da engeller (bkz. ciftCalmaHakki).
   */
  readonly talepPenceresiMs: number;

  /**
   * KURALLAR.md §5 "Talep gorunurlugu" — sirasi gelen oyuncu digerlerinin
   * talebini gorur. Oda ayari, varsayilan acik.
   */
  readonly talepGorunurlugu: boolean;

  /**
   * Tur 15'e ozgu "cifti bende" hakki (KURALLAR.md 0.2, §5).
   * Atilan tasin birebir esini elinde tutan oyuncu, sirasi gelen oyuncunun
   * bedelsiz hakki dahil butun oncelikleri gecer.
   */
  readonly ciftCalmaHakki: boolean;

  /**
   * KURALLAR.md §8 — isler tas atma cezasi.
   * Yerdeki bir pere islenebilecek bir tasi atan oyuncu bu kadar puan yazar.
   * Carpana GIRMEZ, calma cezasi gibi en sonda eklenir. 0 yapilirsa kural kapanir.
   */
  readonly islerTasCezasi: number;

  /**
   * KURALLAR.md §9.5 (karara baglandi: oder).
   * Eli bitiren oyuncu da caldigi taslarin 5'er puanini oder: -100 + 5 × calis.
   */
  readonly kazananCalmaCezasiOder: boolean;

  /**
   * KURALLAR.md §9.4 (karara baglandi: kimse almaz).
   * Deste tukenip el kimse bitirmeden kapandiginda -100 alan olmaz.
   */
  readonly desteTukendigindeKazananVar: boolean;

  /**
   * KURALLAR.md §9.4 ikinci kisim (karara baglandi: eklenir).
   * Deste tukense de calma cezalari puana eklenir.
   */
  readonly desteTukendigindeCalmaCezasi: boolean;

  /**
   * KURALLAR.md §9.3 (karara baglandi: isler).
   * Tur 16'da kimse yere per indirmedigi icin teknik olarak kimse "acmis"
   * olmaz; buna ragmen bitiren disindaki herkes cezasinin iki katini yazar.
   */
  readonly tur16AcamadiCarpani: boolean;

  /**
   * KURALLAR.md §9.7 (karara baglandi: gecerli).
   * Tur 16'da da bitiren oyuncu son tas olarak okey attiysa carpan calisir;
   * "acamadin" carpaniyla birlikte ×4 eder.
   */
  readonly tur16OkeyleBitmeCarpani: boolean;

  /**
   * KURALLAR.md §9 0.4 — sira suresi KADEMELERI (ms), uzundan kisaya.
   *
   * Ilk kademe herkesin normal suresidir. Bir oyuncu suresini doldurup
   * yerine oynanirsa bir alt kademeye duser ve sirasi her geldiginde o
   * sureyi kullanir; son kademeye indikten sonra daha asagi inmez.
   * Oyalayani cezalandirir, hizli oyuncuyu etkilemez.
   *
   * Sure, sira oyuncuya gectiginde baslar ve her TAS CEKME'den sonra
   * bastan baslar: cekmek icin ayri, atmak icin ayri sure verir.
   *
   * Motorda SAYAC YOK (CLAUDE.md #1: zamanlayici yok). Burasi yalnizca oda
   * ayarinin degeri; geri sayimi surucu/sunucu tutar, motora yine `suAn`
   * tasiyan normal bir aksiyon gelir.
   */
  readonly siraSureleriMs: readonly number[];
}

export const VARSAYILAN_AYARLAR: KuralAyarlari = {
  talepPenceresiMs: 3000,
  siraSureleriMs: [30000, 20000, 10000],
  islerTasCezasi: 50,
  talepGorunurlugu: true,
  ciftCalmaHakki: true,
  kazananCalmaCezasiOder: true,
  desteTukendigindeKazananVar: false,
  desteTukendigindeCalmaCezasi: true,
  tur16AcamadiCarpani: true,
  tur16OkeyleBitmeCarpani: true,
};

export function ayarlariBirlestir(degisiklikler: Partial<KuralAyarlari>): KuralAyarlari {
  return { ...VARSAYILAN_AYARLAR, ...degisiklikler };
}
