// Istakama SONRADAN gelen taslari isaretlemek icin: cektigim, caldigim ve
// ceza olarak aldigim taslarin hepsi ayni yoldan geliyor (ortadan istakama),
// motor kurali #3 yuzunden desteden/cezadan gelenin KIMLIGI hareket
// gunlugunde bile yok (yalnizca ben, kendi istakamdan, bunu goruyorum).
//
// Bu yuzden hareket ayristirmak yerine daha basit bir yol izleniyor: elin
// BASINDA dagitilan taslar hic isaretlenmiyor, istakada BELIREN her yeni tas
// kimligi isaretleniyor.
//
// Isaret BIRIKMIYOR — yalnizca EN SON gelen(ler) isaretli. Bir sonraki
// cekiste (ya da calma+ceza ikilisinde) eski isaret dusup yenisi konuyor;
// "sonradan geldi" sorusu her zaman "EN SON hamlede mi geldi" demek, "bu elde
// hic mi cekilmedi" degil. Tas elden cikinca (atilinca, islenince) isaret de
// gider — kalan tek isaretli tasi bile kaybetmeden.
//
// "Elin basi" `sonHareketNo`nun KUCULMESINDEN anlasiliyor — Masa.tsx'teki
// `hareketArsivi` ile ayni yontem: motor her yeni elde bu sayaci sifirliyor
// (packages/engine/src/durum.ts `dagit()`), ayni tur yeniden dagitilsa bile.

import type { Tas, TasId } from '@kut/engine';

export interface SonradanGelenlerDurumu {
  /** Son goruldugunde istakada olan tum kimlikler — yeni tas bunlarla kiyaslanir. */
  readonly bilinenler: ReadonlySet<TasId>;
  /** Isaretlenecek kimlikler: yalnizca EN SON hamlede gelenler. */
  readonly gelenler: ReadonlySet<TasId>;
}

export const BOS_SONRADAN_GELENLER: SonradanGelenlerDurumu = {
  bilinenler: new Set(),
  gelenler: new Set(),
};

/**
 * `yeniElMi` true ise butun istaka YENI BASLANGIC sayilir (hicbir tas
 * isaretlenmez).
 *
 * Degilse: `onceki.bilinenler`de olmayan taslar bulunur.
 *   - Yeni tas VARSA, isaretliler bunlarla DEGISTIRILIR (eskisi silinir) —
 *     calma+ceza ayni anda gelirse ikisi birden yeni isaret olur.
 *   - Yeni tas YOKSA (baska bir oyuncunun hamlesiyle gelen bir gorunum),
 *     onceki isaretler AYNEN KALIR; yalnizca artik elde olmayanlar dusurulur.
 *
 * DEGISIKLIK YOKSA `onceki`yi dondurur — cevrimici oyunda her `oyun:gorunum`
 * paketi yeni bir `istaka` dizisi getiriyor (bkz. duzenTazele), referans
 * korunmazsa bagimli her yer gereksiz yere yeniden hesaplanir/cizilirdi.
 */
export function sonradanGelenlerGuncelle(
  onceki: SonradanGelenlerDurumu,
  istaka: readonly Tas[],
  yeniElMi: boolean,
): SonradanGelenlerDurumu {
  const mevcut = new Set(istaka.map((tas) => tas.id));

  if (yeniElMi) {
    if (onceki.gelenler.size === 0 && ayniKumeMi(onceki.bilinenler, mevcut)) return onceki;
    return { bilinenler: mevcut, gelenler: new Set() };
  }

  const yeniler = new Set<TasId>();
  for (const id of mevcut) {
    if (!onceki.bilinenler.has(id)) yeniler.add(id);
  }

  if (yeniler.size > 0) {
    return { bilinenler: mevcut, gelenler: yeniler };
  }

  let degisti = false;
  const gelenler = new Set(onceki.gelenler);
  for (const id of gelenler) {
    if (!mevcut.has(id)) {
      gelenler.delete(id);
      degisti = true;
    }
  }

  if (!degisti && ayniKumeMi(onceki.bilinenler, mevcut)) return onceki;
  return { bilinenler: mevcut, gelenler };
}

function ayniKumeMi(a: ReadonlySet<TasId>, b: ReadonlySet<TasId>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}
