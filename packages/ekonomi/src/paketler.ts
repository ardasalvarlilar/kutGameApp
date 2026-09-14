// Magazadaki cip paketleri.
//
// Fiyat egrisi Okey 101 Plus'la ayni mertebede: 50 bin cip 39,99 TL. Buyuk
// paket birim basina belirgin ucuz (en kucukten 20 kat) — bu turun bilinen
// modeli ve kucuk paketi "pahali" hissettirmeden buyuge yonlendiriyor.
//
// Kademe basina gercek para (en buyuk paketin biriminde):
//   Caylak 5 bin    ≈ 4 TL  (en kucuk paketle)
//   Usta 150 bin    ≈ 6 TL
//   Efsane 5 milyon ≈ 200 TL
//
// `fiyatTl` YALNIZCA GOSTERIM icin. Satin almada gecerli fiyat magazanindir
// (App Store / Play kendi para birimini ve vergisini uyguluyor); oraya
// `urunKimligi` ile gidiliyor.

export interface CipPaketi {
  /** App Store Connect / Play Console'daki urun kimligi. */
  readonly urunKimligi: string;
  readonly cip: number;
  readonly fiyatTl: number;
}

export const CIP_PAKETLERI: readonly CipPaketi[] = [
  { urunKimligi: 'kut.cip.50bin', cip: 50_000, fiyatTl: 39.99 },
  { urunKimligi: 'kut.cip.200bin', cip: 200_000, fiyatTl: 79.99 },
  { urunKimligi: 'kut.cip.600bin', cip: 600_000, fiyatTl: 149.99 },
  { urunKimligi: 'kut.cip.2milyon', cip: 2_000_000, fiyatTl: 299.99 },
  { urunKimligi: 'kut.cip.7.5milyon', cip: 7_500_000, fiyatTl: 599.99 },
  { urunKimligi: 'kut.cip.30milyon', cip: 30_000_000, fiyatTl: 1_199.99 },
];

/** En kucuk pakete gore kac kat fazla cip (ekrandaki "+%100" rozeti). */
export function paketAvantaji(paket: CipPaketi): number {
  const taban = CIP_PAKETLERI[0] as CipPaketi;
  const birim = paket.cip / paket.fiyatTl;
  const tabanBirim = taban.cip / taban.fiyatTl;
  return Math.round((birim / tabanBirim - 1) * 100);
}
