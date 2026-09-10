// Obegin ustundeki tasin ALTINDA ne var — ekran icin. Saf ve testli.
//
// KURALLAR.md §10.3: projeksiyon yigindan yalnizca en ustteki tasi ve adedi
// veriyor; alttakiler oludur. Bu dogru ve degismiyor. Ama ekranin kisa bir
// ani var ki ustteki tas obekte DEGIL: havada (atilma ucusu suruyor) ya da
// oyuncunun parmaginda (istakasina goturuyor). O anda obekte bir sey
// cizilmeli. Eskiden gri bir kapali tas ciziliyordu ve oyuncu "benim attigim
// tas nereye gitti" diye bakiyordu — oysa o tas yerinde duruyordu.
//
// Oyuncu o tasi az once yiginin ustunde GORDU. Hareket listesi
// (`sonHareketler`) her atisi ve her alisi zaten tasiyor; sirayi buradan
// kurmak projeksiyona yeni bilgi eklemiyor, yalnizca ekranin hafizasi.
//
// Motorun listesi kisa (HAREKET_HAFIZASI = 8); bir bot tek sirada alip acip
// isleyip atabildigi icin ekran gordugu hareketleri kendisi biriktiriyor
// (Masa.tsx). Yine de alttaki tasin atisi elde yoksa sira bilinmiyor ve null
// doner; ekran o zaman kapali tas cizer.

import type { Tas, TasHareketi } from '@kut/engine';

/**
 * @param atikAdedi Masadaki atik sayisi (projeksiyondan). 2'den azsa altta
 *   tas yok demektir — listede onceki elden kalan hareketler olsa bile.
 */
export function atikAltindaki(
  hareketler: readonly TasHareketi[],
  atikUstu: Tas | null,
  atikAdedi: number,
): Tas | null {
  if (atikUstu === null || atikAdedi < 2) return null;

  const yigin: Tas[] = [];
  for (const hareket of hareketler) {
    if (hareket.tip === 'atma') {
      yigin.push(hareket.tas);
      continue;
    }
    // Obekten eksilten iki hareket: bedelsiz alma ve calma (§5).
    if (
      hareket.tip === 'cekim' &&
      (hareket.kaynak === 'atik' || hareket.kaynak === 'calma') &&
      hareket.tas !== null
    ) {
      const id = hareket.tas.id;
      for (let i = yigin.length - 1; i >= 0; i--) {
        if (yigin[i]?.id === id) {
          yigin.splice(i, 1);
          break;
        }
      }
    }
  }

  // Listeden kurulan ust motorunkiyle uyusmuyorsa sira eksik: tahmin etme.
  if (yigin[yigin.length - 1]?.id !== atikUstu.id) return null;
  return yigin[yigin.length - 2] ?? null;
}
