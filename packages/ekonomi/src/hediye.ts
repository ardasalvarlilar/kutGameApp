// Hediye cip — oyuncu uzakta kaldikca biriken, geri gelince toplanan cip.
//
// Her saat 100 cip birikir; birikim 48 saatte (4.800 cip) durur. Tavan
// bilerek var: bir hafta gelmeyen 16.800 degil 4.800 alir. Duzenli gelen
// oyuncu, arada kaybolandan fazlasini topluyor.
//
// Yalnizca TAM saatler sayilir ve artan dakikalar KAYBOLMAZ: 2 saat 40
// dakikada toplayan 200 cip alir, 40 dakika bir sonrakine sayilir. Tavanda
// ise fazlasi yanar — tavanin anlami bu.
//
// Reklam: toplanan miktar reklam izlenirse REKLAM_CARPANI kadar olur. Ek
// kismi sunucu reklam agi dogrulayinca veriyor (bkz. server reklamServisi).
//
// Zaman disaridan veriliyor (`suAn`): paket saf kalmali, `Date.now` yok.

export const SAATLIK_HEDIYE = 100;
export const HEDIYE_TAVANI_SAAT = 48;
export const REKLAM_CARPANI = 2;

export const SAAT_MS = 3_600_000;

export interface Birikim {
  /** Toplanabilecek tam saat (tavanla sinirli). */
  readonly saat: number;
  readonly miktar: number;
  readonly tavanda: boolean;
  /** Bir sonraki saatin dolmasina kalan ms; tavandaysa null. */
  readonly sonrakiSaatMs: number | null;
}

export function birikim(sonToplama: number, suAn: number): Birikim {
  const gecen = Math.max(0, suAn - sonToplama);
  const tamSaat = Math.floor(gecen / SAAT_MS);
  const tavanda = tamSaat >= HEDIYE_TAVANI_SAAT;
  const saat = Math.min(tamSaat, HEDIYE_TAVANI_SAAT);
  return {
    saat,
    miktar: saat * SAATLIK_HEDIYE,
    tavanda,
    sonrakiSaatMs: tavanda ? null : SAAT_MS - (gecen % SAAT_MS),
  };
}

/**
 * Toplamadan sonra saatin yeni baslangici.
 *
 * Tavanda degilse yalnizca toplanan saatler ilerletilir (artan dakikalar
 * kalir); tavandaysa saat simdiden baslar (fazlasi yanar).
 */
export function toplamaSonrasi(sonToplama: number, suAn: number): number {
  const { saat, tavanda } = birikim(sonToplama, suAn);
  return tavanda ? suAn : sonToplama + saat * SAAT_MS;
}

/** Reklam izlenirse EKLENECEK miktar (toplanana ek olarak). */
export function reklamEki(miktar: number): number {
  return miktar * (REKLAM_CARPANI - 1);
}
