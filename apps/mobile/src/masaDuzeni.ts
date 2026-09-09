// Koltuklarin ekrandaki dort konumu.
//
// Ayri dosya cunku saf ve testli olmali: yerlesim yanlis olursa oyuncu koltuk
// secerken kimin sagina oturdugunu yanlis goruyor, ve bunu ancak el
// basladiginda fark ediyor.
//
// `referans` GUNEYDE (altta) oturur, geri kalani `siradaIleri` ile oyun
// yonunde dizilir: dogu = referansin SAGINDAKI, yani attigi tasi bedelsiz alan
// oyuncu (KURALLAR.md §4). Yon motordan geliyor — burada kopyalanmiyor.
//
// Iki cagiran, iki farkli referans:
//   Masa.tsx      — `gorunum.ben`: herkes kendini altta gorur.
//   Bekleme.tsx   — SABIT 0: koltuk secerken plan donmemeli, yoksa baska
//                   koltuga gecmek ekranda hic degismiyor gibi gorunuyor.

import { siradaIleri, type OyuncuId } from '@kut/engine';

export type Konum = 'guney' | 'dogu' | 'kuzey' | 'bati';

export type MasaKonumlari = Readonly<Record<Konum, OyuncuId>>;

/** Bekleme odasinin sabit plani: 1 numarali koltuk her zaman altta. */
export const SABIT_REFERANS: OyuncuId = 0;

export function masaKonumlari(referans: OyuncuId): MasaKonumlari {
  return {
    guney: referans,
    dogu: siradaIleri(referans, 1),
    kuzey: siradaIleri(referans, 2),
    bati: siradaIleri(referans, 3),
  };
}
