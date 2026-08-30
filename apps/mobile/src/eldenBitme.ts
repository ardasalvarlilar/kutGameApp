// Tur 16 — elden bitme (KURALLAR.md §3).
//
// Diger turlardan farki: yere hic per inmez. Oyuncu butun elini gecerli
// perlere boler, geriye tek tas kalir, onu ortaya atarak biter.
//
// Bu bir KURAL DEGIL, kolaylik: hangi tasin hangi pere gittigini oyuncunun
// tek tek isaretlemesine gerek kalmasin diye bolunmeyi burada ariyoruz.
// Gecerlilik karari yine motorun — bulunan bolme `BITIR_ELDEN` ile gonderilir
// ve motor kabul edip etmemeye kendisi karar verir.
//
// Saf tutuldu ki test edilebilsin (React Native import etmiyor).

import { kutMu, seriMu, type Tas, type TasId } from '@kut/engine';

/** Bir per en az uc tastir (KURALLAR.md §2). */
const EN_AZ_PER = 3;
/** Kut en fazla dort tas; seri daha uzun olabilir ama pratikte sinir bu. */
const EN_COK_PER = 13;

function gecerliPerMi(taslar: readonly Tas[]): boolean {
  return kutMu(taslar).ok || seriMu(taslar).ok;
}

/** `dizi`den `k` elemanli alt kumeler — ilk eleman HER ZAMAN icinde. */
function ilkiIcerenKumeler(dizi: readonly Tas[], k: number): Tas[][] {
  const ilk = dizi[0];
  if (ilk === undefined || k < 1 || k > dizi.length) return [];
  if (k === 1) return [[ilk]];

  const sonuc: Tas[][] = [];
  const geri = dizi.slice(1);
  const gez = (bas: number, secilen: Tas[]): void => {
    if (secilen.length === k - 1) {
      sonuc.push([ilk, ...secilen]);
      return;
    }
    for (let i = bas; i < geri.length; i++) {
      secilen.push(geri[i] as Tas);
      gez(i + 1, secilen);
      secilen.pop();
    }
  };
  gez(0, []);
  return sonuc;
}

/**
 * Taslarin tamamini gecerli perlere boler; bolunmuyorsa null.
 *
 * Her adimda KALAN ILK TASI ele aliyoruz: o tas bir yere girmek zorunda,
 * dolayisiyla yalnizca onu iceren perleri denemek yeterli. Bu, arama agacini
 * ciddi bicimde budayan standart yaklasim — 14 tas icin aninda sonuclaniyor.
 */
export function perlereBol(taslar: readonly Tas[]): readonly (readonly Tas[])[] | null {
  if (taslar.length === 0) return [];
  if (taslar.length < EN_AZ_PER) return null;

  const enCok = Math.min(EN_COK_PER, taslar.length);
  for (let boy = EN_AZ_PER; boy <= enCok; boy++) {
    for (const aday of ilkiIcerenKumeler(taslar, boy)) {
      if (!gecerliPerMi(aday)) continue;

      const secilen = new Set(aday.map((tas) => tas.id));
      const kalan = taslar.filter((tas) => !secilen.has(tas.id));
      const geri = perlereBol(kalan);
      if (geri !== null) return [aday, ...geri];
    }
  }
  return null;
}

export interface EldenBitmeCozumu {
  /** Motora gonderilecek per gruplari (tas kimlikleri). */
  readonly perler: readonly (readonly TasId[])[];
  /** Ortaya atilacak tas. */
  readonly atilanTasId: TasId;
}

/**
 * `atilanTasId` atildiginda elin geri kalani perlere bolunuyor mu?
 *
 * Bolunuyorsa `BITIR_ELDEN` icin hazir cozum, bolunmuyorsa null (o zaman
 * normal atis yapilir ve oyun devam eder).
 */
export function eldenBitmeCozumu(
  istaka: readonly Tas[],
  atilanTasId: TasId,
): EldenBitmeCozumu | null {
  const atilan = istaka.find((tas) => tas.id === atilanTasId);
  if (atilan === undefined) return null;

  const kalan = istaka.filter((tas) => tas.id !== atilanTasId);
  // §7 — bitis son tasi ortaya atarak olur; geriye per kalmalı.
  if (kalan.length < EN_AZ_PER) return null;

  const bolme = perlereBol(kalan);
  if (bolme === null) return null;

  return {
    perler: bolme.map((per) => per.map((tas) => tas.id)),
    atilanTasId,
  };
}

/**
 * Elden bitmek icin ATILABILECEK taslar.
 *
 * Ekran bunu ipucu olarak kullaniyor: oyuncu hangi tasi atarsa biteceğini
 * gormeden once denemek zorunda kalmasin.
 */
export function bitirenTaslar(istaka: readonly Tas[]): readonly TasId[] {
  const sonuc: TasId[] = [];
  for (const tas of istaka) {
    if (eldenBitmeCozumu(istaka, tas.id) !== null) sonuc.push(tas.id);
  }
  return sonuc;
}
