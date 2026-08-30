// Tohumlu, deterministik rastgelelik.
// CLAUDE.md motor kurali #2: motorda Math.random() ve Date.now() YASAK.
// Ayni tohum + ayni aksiyon listesi her zaman ayni oyunu uretmelidir.

export interface Rng {
  /** [0, 1) araliginda bir sonraki deger. */
  next(): number;
}

/**
 * mulberry32 — 32 bit durumlu, hizli ve tekrarlanabilir uretici.
 * Motorun disindan gelen tohumla calisir, kendi basina entropi uretmez.
 */
export function rngOlustur(tohum: number): Rng {
  let durum = tohum | 0;
  return {
    next(): number {
      durum = (durum + 0x6d2b79f5) | 0;
      let t = Math.imul(durum ^ (durum >>> 15), 1 | durum);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/**
 * Metinden deterministik tohum (FNV-1a). Sunucu oda kimliginden tohum
 * uretmek isterse kullanir; motorun kendisi tohumu disaridan alir.
 */
export function tohumla(metin: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < metin.length; i++) {
    hash ^= metin.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash | 0;
}

/** Fisher-Yates. Girdi dizisini degistirmez. */
export function karistir<T>(dizi: readonly T[], rng: Rng): readonly T[] {
  const sonuc = [...dizi];
  for (let i = sonuc.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    const gecici = sonuc[i] as T;
    sonuc[i] = sonuc[j] as T;
    sonuc[j] = gecici;
  }
  return sonuc;
}
