// Kut motorunun temel tipleri.
// Kural kaynagi: KURALLAR.md

/** KURALLAR.md §1 — destedeki dort renk. */
export type Renk = 'kirmizi' | 'siyah' | 'mavi' | 'sari';

export const RENKLER = ['kirmizi', 'siyah', 'mavi', 'sari'] as const satisfies readonly Renk[];

/** KURALLAR.md §1 — 1'den 13'e sayilar. */
export type Sayi = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export const SAYILAR = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as const satisfies readonly Sayi[];

/**
 * Fiziksel tas ornegini gosteren benzersiz kimlik.
 * CLAUDE.md motor kurali #6: destede her tastan iki kopya var, bu yuzden
 * `renk + sayi` bir tasi tanimlamaya yetmez.
 */
export type TasId = string;

/** Bir tasin iki fiziksel kopyasindan hangisi oldugu. */
export type Kopya = 'a' | 'b';

export interface NormalTas {
  readonly id: TasId;
  readonly tip: 'normal';
  readonly renk: Renk;
  readonly sayi: Sayi;
}

/** KURALLAR.md §2 — joker. Destede iki adet. Gosterge yoktur; okey dogrudan bu tastir. */
export interface OkeyTas {
  readonly id: TasId;
  readonly tip: 'okey';
}

export type Tas = NormalTas | OkeyTas;

/** Koltuk sirasi. Sira daima 0 → 1 → 2 → 3 → 0 yonunde ilerler. */
export type OyuncuId = 0 | 1 | 2 | 3;

export const OYUNCULAR = [0, 1, 2, 3] as const satisfies readonly OyuncuId[];

/** KURALLAR.md §3 — 16 tur, sabit sirayla. */
export type TurNo = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;

export const TURLAR = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
] as const satisfies readonly TurNo[];

/** Her oyuncu icin bir deger tutan kayit. */
export type OyuncuKaydi<T> = Readonly<Record<OyuncuId, T>>;

/**
 * KURALLAR.md §4 — oyun SAAT YONUNDE doner: atilan tasi atanin SAGINDAKI
 * oyuncu alir. Koltuklar 0,1,2,3 diye numaralandigi icin oyun yonu koltuk
 * numarasini azaltir. Yon tek yerde tanimli; sira, dagitim ve calma
 * onceliginin tamami buradan turuyor.
 */
export const SIRA_YONU = -1;

/** `oyuncu`'dan `ofset` koltuk ileride oturan oyuncu (koltuk numarasi yonunde). */
export function koltukOfseti(oyuncu: OyuncuId, ofset: number): OyuncuId {
  return (((((oyuncu + ofset) % 4) + 4) % 4)) as OyuncuId;
}

/** Oyun yonunde `adim` sira ileride oynayan oyuncu. */
export function siradaIleri(oyuncu: OyuncuId, adim: number): OyuncuId {
  return koltukOfseti(oyuncu, adim * SIRA_YONU);
}

/**
 * Sirasi gelen oyuncunun attigi tasi bedelsiz alacak olan oyuncu — yani
 * atanin sagindaki. KURALLAR.md §5'teki "2 numarali (sirasi onda)".
 */
export function sonrakiOyuncu(oyuncu: OyuncuId): OyuncuId {
  return siradaIleri(oyuncu, 1);
}

export function oyuncuKaydiOlustur<T>(uret: (oyuncu: OyuncuId) => T): OyuncuKaydi<T> {
  return { 0: uret(0), 1: uret(1), 2: uret(2), 3: uret(3) };
}
