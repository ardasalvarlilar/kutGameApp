// Masanin temposu — sira bir sonraki oyuncuya NE ZAMAN gecer (KURALLAR.md §9 0.13).
//
// Bir sira tek hamle degil: bot (ya da hizli bir oyuncu) cekip, iki kut
// indirip, tas atiyor ve durum bir anda degisiyor. Ekran ise bunlari TEK TEK
// ucuruyor (taslar sirayla). Sira hemen gecerse sirasi gelen, atilan tas daha
// ekranda belirmeden onu cekiyordu: kimse ne atildigini goremiyor, "istiyorum"
// diyemiyordu (§5).
//
// Cozum: sira, az once oynananlar ekranda gosterildikten SONRA geciyor. Sure
// buradan hesaplaniyor — saf, testli, sunucu ve cevrimdisi surucu AYNI hesabi
// kullaniyor. Ekranin ucus animasyonu da suresini buradan aliyor
// (`UcanTas.tsx`): tahmin ile animasyon ayni sayiya bakiyor, biri degisip
// digeri unutulamiyor.
//
// Motorda degil: motor zaman bilmiyor (CLAUDE.md motor kurali #1).

import type { TasHareketi } from '@kut/engine';

/** Bir tasin masada ucma suresi (ms). Ucuslar SIRAYLA oynuyor. */
export const UCUS_SURESI_MS = 340;

/**
 * Atilan tas yere konduktan sonra, sira gecmeden once taninan gorme payi (ms).
 *
 * Bu olmasa atilan tas ekranda belirdigi AN sirasi gelen onu alabilirdi;
 * digerleri tasi gorup "istiyorum" demeye firsat bulamazdi (§5).
 */
export const GORME_PAYI_MS = 1_000;

/**
 * Hareketlerin ekranda oynamasi icin gereken sure (ms). Hareket yoksa 0.
 *
 * Her tas bir ucus: cekim ve atma birer, indirme ve isleme tas sayisi kadar.
 * Atis varsa ustune gorme payi.
 */
export function gosterimSuresi(hareketler: readonly TasHareketi[]): number {
  let ucus = 0;
  let atildi = false;
  for (const hareket of hareketler) {
    if (hareket.tip === 'cekim') {
      ucus += 1;
    } else if (hareket.tip === 'atma') {
      ucus += 1;
      atildi = true;
    } else {
      ucus += hareket.taslar.length;
    }
  }
  if (ucus === 0) return 0;
  return ucus * UCUS_SURESI_MS + (atildi ? GORME_PAYI_MS : 0);
}

/** `gorulen` sira numarasindan sonraki hareketler — son gosterimden beri olanlar. */
export function yeniHareketler(
  hareketler: readonly TasHareketi[],
  gorulen: number,
): readonly TasHareketi[] {
  return hareketler.filter((hareket) => hareket.sira > gorulen);
}
