// Deneyim (XP) ve seviye.
//
// Deneyim YALNIZCA TAMAMLANAN MACTAN geliyor, siraya gore. Masadan kendi
// istegiyle ayrilan hic almiyor (koltugu bota gecti, maci o bitirmedi);
// baglantisi kopup geri gelen ise alir — koltugu hic bosalmadi.
//
// Seviye atlamak her seferinde 50 XP daha pahali: 1→2 100 XP, 2→3 150,
// 3→4 200... Ortalama bir mac ~62 XP getiriyor (100/75/50/25'in ortalamasi):
// seviye 10 ~43 mac, seviye 30 ~370 mac. 16 turluk bir mac uzun surdugu icin
// daha dik bir egri ust kademeleri fiilen erisilmez yapardi.

/** Siraya gore mac deneyimi: 1., 2., 3., 4. */
export const SIRA_DENEYIMI = [100, 75, 50, 25] as const;

export const MAKS_SEVIYE = 100;

const ILK_ATLAMA = 100;
const ATLAMA_ARTISI = 50;

/** `seviye`den bir sonrakine gecmek icin gereken XP. */
export function seviyeAtlamaBedeli(seviye: number): number {
  return ILK_ATLAMA + ATLAMA_ARTISI * (seviye - 1);
}

/** Bu seviyeye ULASMAK icin gereken toplam XP. Seviye 1 = 0. */
export function seviyeEsigi(seviye: number): number {
  const n = seviye - 1;
  return ILK_ATLAMA * n + (ATLAMA_ARTISI * n * (n - 1)) / 2;
}

/** Toplam deneyimden seviye. MAKS_SEVIYE'de durur. */
export function seviyeHesapla(deneyim: number): number {
  let seviye = 1;
  while (seviye < MAKS_SEVIYE && seviyeEsigi(seviye + 1) <= deneyim) seviye += 1;
  return seviye;
}

export interface SeviyeIlerlemesi {
  readonly seviye: number;
  /** Bu seviyede biriktirilen XP. */
  readonly buSeviyede: number;
  /** Sonraki seviye icin gereken XP; son seviyedeyse null. */
  readonly gereken: number | null;
}

export function seviyeIlerlemesi(deneyim: number): SeviyeIlerlemesi {
  const seviye = seviyeHesapla(deneyim);
  return {
    seviye,
    buSeviyede: deneyim - seviyeEsigi(seviye),
    gereken: seviye >= MAKS_SEVIYE ? null : seviyeAtlamaBedeli(seviye),
  };
}

/**
 * Mac sonu siralamasi: her oyuncunun kacinci oldugu (0 = birinci).
 *
 * KURALLAR.md §8 — en DUSUK toplam kazanir. Beraberlikte ikisi de ustteki
 * sirayi alir (1, 1, 3, 4): esit puanda birini ikinciye itmek keyfi olurdu.
 */
export function macSiralari(toplamlar: readonly number[]): readonly number[] {
  return toplamlar.map((toplam) => toplamlar.filter((baska) => baska < toplam).length);
}

/** Siraya gore kazanilan deneyim. */
export function macDeneyimi(sira: number): number {
  return SIRA_DENEYIMI[Math.min(sira, SIRA_DENEYIMI.length - 1)] as number;
}
