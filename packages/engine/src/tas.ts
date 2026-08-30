// Deste uretimi ve tas yardimcilari. KURALLAR.md §1

import {
  RENKLER,
  SAYILAR,
  type Kopya,
  type NormalTas,
  type OkeyTas,
  type Renk,
  type Sayi,
  type Tas,
  type TasId,
} from './tipler';

/** KURALLAR.md §2 — elde kalan okeyin ceza puani. */
export const OKEY_PUANI = 25;

export function tasId(renk: Renk, sayi: Sayi, kopya: Kopya): TasId {
  return `${renk}-${sayi}-${kopya}`;
}

export function okeyId(kopya: Kopya): TasId {
  return `okey-${kopya}`;
}

export function normalTas(renk: Renk, sayi: Sayi, kopya: Kopya): NormalTas {
  return { id: tasId(renk, sayi, kopya), tip: 'normal', renk, sayi };
}

export function okeyTas(kopya: Kopya): OkeyTas {
  return { id: okeyId(kopya), tip: 'okey' };
}

export function okeyMi(tas: Tas): tas is OkeyTas {
  return tas.tip === 'okey';
}

export function normalMi(tas: Tas): tas is NormalTas {
  return tas.tip === 'normal';
}

/**
 * KURALLAR.md §1 — 4 renk × 13 sayi × 2 kopya = 104, arti 2 okey = 106.
 * Uretim sirasi sabittir; karistirma islemi tohumlu RNG ile ayrica yapilir.
 */
export function desteOlustur(): readonly Tas[] {
  const taslar: Tas[] = [];
  for (const renk of RENKLER) {
    for (const sayi of SAYILAR) {
      taslar.push(normalTas(renk, sayi, 'a'));
      taslar.push(normalTas(renk, sayi, 'b'));
    }
  }
  taslar.push(okeyTas('a'));
  taslar.push(okeyTas('b'));
  return taslar;
}

/** KURALLAR.md §8 — tasin puani sayisidir; okey elde kalirsa 25. */
export function tasPuani(tas: Tas): number {
  return tas.tip === 'okey' ? OKEY_PUANI : tas.sayi;
}

export function tasToplami(taslar: readonly Tas[]): number {
  let toplam = 0;
  for (const tas of taslar) toplam += tasPuani(tas);
  return toplam;
}

/**
 * KURALLAR.md §9.1 (karara baglandi) — "cift" birebir ayni tastir:
 * ayni renk + ayni sayi. `kirmizi7 + kirmizi7` cifttir, `kirmizi7 + mavi7` degildir.
 * Iki okey tasi da fiziksel olarak birebir aynidir, dolayisiyla birbirinin esidir.
 */
export function birebirEsMi(a: Tas, b: Tas): boolean {
  if (a.tip === 'okey' && b.tip === 'okey') return true;
  if (a.tip !== 'normal' || b.tip !== 'normal') return false;
  return a.renk === b.renk && a.sayi === b.sayi;
}

export function tasBul(taslar: readonly Tas[], id: TasId): Tas | null {
  for (const tas of taslar) {
    if (tas.id === id) return tas;
  }
  return null;
}

/** Verilen kimliklerin tamami listede varsa taslari dondurur, yoksa null. */
export function taslariBul(taslar: readonly Tas[], idler: readonly TasId[]): readonly Tas[] | null {
  const bulunan: Tas[] = [];
  for (const id of idler) {
    const tas = tasBul(taslar, id);
    if (tas === null) return null;
    bulunan.push(tas);
  }
  return bulunan;
}

export function tasCikar(taslar: readonly Tas[], idler: readonly TasId[]): readonly Tas[] {
  const silinecek = new Set(idler);
  return taslar.filter((tas) => !silinecek.has(tas.id));
}

export function benzersizMi(idler: readonly TasId[]): boolean {
  return new Set(idler).size === idler.length;
}
