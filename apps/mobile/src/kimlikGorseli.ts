// Avatarin iki "karari": bas harfler ve renk.
//
// Bilesenden AYRI bir dosyada, `ses.ts` / `sesCalar.ts` ayrimiyla ayni
// gerekce: vitest yalnizca saf mantigi kosuyor, React Native bilesenleri o
// kosucuya girmiyor (vitest.config.ts). Karar burada, cizim `bilesenler/
// Avatar.tsx`te.

import { renkler, tasRenkleri } from './tema';

/** Oyunun kendi paleti disina cikmamak icin tas renkleri. */
const PALET = [tasRenkleri.kirmizi, tasRenkleri.mavi, tasRenkleri.sari, renkler.onay];

/**
 * Adin bas harfleri.
 *
 * Yalnizca HARFLE baslayan kelimeler sayiliyor. Varsayilan misafir adi
 * "Oyuncu 0908" gibi bir sey ve ham "ilk + son kelime" kurali orada "O0"
 * uretiyordu — rakami bas harf gibi gostermek adi okunmaz yapiyor.
 */
export function basHarfler(ad: string): string {
  const harfliler = ad
    .trim()
    .split(/\s+/)
    .filter((kelime) => /^\p{L}/u.test(kelime));

  if (harfliler.length === 0) return '?';
  const ilk = (harfliler[0] as string).slice(0, 1);
  if (harfliler.length === 1) return ilk.toLocaleUpperCase('tr-TR');
  const son = (harfliler[harfliler.length - 1] as string).slice(0, 1);
  return (ilk + son).toLocaleUpperCase('tr-TR');
}

/**
 * Addan deterministik renk (FNV-1a).
 *
 * Sunucuda saklanacak bir alan gerekmiyor: ayni oyuncu her ekranda ayni
 * renkte gorunuyor.
 */
export function avatarRengi(ad: string): string {
  let karma = 0x811c9dc5;
  for (let i = 0; i < ad.length; i++) {
    karma ^= ad.charCodeAt(i);
    karma = Math.imul(karma, 0x01000193);
  }
  return PALET[Math.abs(karma) % PALET.length] as string;
}
