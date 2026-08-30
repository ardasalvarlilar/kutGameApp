// Suresi dolan oyuncunun yerine ne oynanir?
//
// Bu bir KURAL DEGIL, politika — motorun disinda duruyor ve yalnizca
// `viewFor` projeksiyonunu okuyor (CLAUDE.md kurali #3). Gecerlilik karari
// daima motorun; burasi yalnizca "hangi hamle" diyor.
//
// Saf: yan etkisi yok, ayni gorunum her zaman ayni hamleyi verir. Bilerek
// deterministik — motor kurali #2 ile ayni gerekce: el kaydindan yeniden
// oynatilabilmesi lazim.
//
// NOT: apps/mobile'daki `sure.ts` + `bot.ts` ayni isi tek oyunculu mod icin
// yapiyor. Ikisi bugun ayri duruyor; sunucu otorite oldugu icin fark oyunu
// bozmuyor. Ortak bir "politika" paketine cikarilmasi MIMARI.md'de not edildi.

import { okeyMi, tasPuani, type Aksiyon, type OyuncuGorunumu, type OyuncuId, type Tas, type TurNo } from '@kut/engine';

export type { Aksiyon, OyuncuId, TurNo };

/**
 * En az ise yarayan tas. Sirasiyla kacinir:
 *   1. okey (25 puan, en degerli tas)
 *   2. isler tas (KURALLAR.md §8 — atmak 50 puan ceza)
 * Kalanlardan en yuksek puanlisi gider; el sonu cezasi kucululsun diye.
 *
 * Katmanlar gevser cunku bir tas ATILMAK ZORUNDA: hepsi isler bile olsa
 * sira kilitlenmemeli.
 */
export function atilacakTas(gorunum: OyuncuGorunumu): Tas | null {
  const el = gorunum.istakam;
  if (el.length === 0) return null;

  const isler = new Set(gorunum.islerTaslarim);
  const katmanlar: readonly ((tas: Tas) => boolean)[] = [
    (tas) => !okeyMi(tas) && !isler.has(tas.id),
    (tas) => !okeyMi(tas),
    () => true,
  ];

  for (const katman of katmanlar) {
    const adaylar = el.filter(katman);
    if (adaylar.length === 0) continue;
    return [...adaylar].sort((a, b) => tasPuani(b) - tasPuani(a))[0] ?? null;
  }
  return null;
}

/**
 * Sure dolunca gonderilecek BIR SONRAKI aksiyon; yapacak sey yoksa null.
 *
 * Tek adim doner cunku ikinci adim birincinin sonucuna bagli: cekilen tas ele
 * girdikten sonra atilacak tas degisir. Cagiran dongude kullanir.
 *
 * Kurtarmanin FAZA UYGUN olmasi sart: cekme fazinda "at" demek motorca
 * reddedilir ve sira kilitlenir.
 */
export function atilacakTasSec(
  gorunum: OyuncuGorunumu,
  oyuncu: OyuncuId,
  suAn: number,
): Aksiyon | null {
  if (gorunum.faz === 'el-bitti') return null;
  if (gorunum.siradaki !== oyuncu) return null;

  // Cekmeden atilamaz (§4). Yerden almak bir tercihtir; sure dolunca en
  // tarafsiz hamle desteden cekmektir.
  if (gorunum.faz === 'cekme') return { tip: 'CEK_DESTEDEN', oyuncu, suAn };

  const tas = atilacakTas(gorunum);
  return tas === null ? null : { tip: 'AT', oyuncu, tasId: tas.id, suAn };
}
