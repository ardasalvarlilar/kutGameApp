// Pot ve odul.
//
// Masaya oturan her INSAN girisi potun icine koyar; kazanan potu alir,
// kaybedenler giris ucretini kaybeder. Pottan once MASA UCRETI kesilir —
// uygulamanin geliri bu.
//
// %20 bilerek secildi: QT Okey'in oranlarini hesaplayinca %37–60 cikiyor.
// Onun yarisindan az, ama "her 5 cipten 1'i masaya" — cebe bir sey kaliyor.
// Ucret olmasa ekonomi sifir toplamli olurdu: iyi oynayan hic cip almaz,
// cip yalnizca el degistirirdi.
//
// BOTLAR POTA GIRMEZ. Girseydi bot cipi sunucunun cebinden basilmis olurdu
// ve "tek basima uc botla oyna, kazan" cip basmanin yolu olurdu. Bot (ya da
// masadan kacan oyuncunun yerine gecen bot) maci kazanirsa onun payi yanar.

/** Pottan kesilen masa ucreti (yuzde). */
export const MASA_UCRETI_YUZDESI = 20;

/** Odeyenlerin girisleri toplami. */
export function potHesapla(odeyenSayisi: number, giris: number): number {
  return odeyenSayisi * giris;
}

/** Masa ucreti dusuldukten sonra kazananlara kalan. */
export function odulHavuzu(pot: number): number {
  return Math.floor((pot * (100 - MASA_UCRETI_YUZDESI)) / 100);
}

/**
 * Bir kazananin payi.
 *
 * Beraberlikte havuz kazananlar arasinda esit bolunur — bot kazananlar da
 * SAYILIR (payi yanar), yoksa insanla berabere kalan bot insana bedava pay
 * vermis olurdu.
 */
export function kazananPayi(pot: number, kazananSayisi: number): number {
  if (kazananSayisi <= 0) return 0;
  return Math.floor(odulHavuzu(pot) / kazananSayisi);
}
