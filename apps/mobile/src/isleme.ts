// `TAŞLARI İŞLE` hangi taslari gonderir?
//
// Kural degil, kolaylik — `dizme.ts` gibi. Hicbir oyun durumu degistirmez,
// gecerlilik karari yine motorun. Saf tutuldu ki test edilebilsin.
//
// Cozdugu problem: dugme "istakadaki butun isler taslari" gonderiyordu ve
// okey yerdeki neredeyse her pere isledigi icin OYUNCUNUN KENDI PERINDEKI
// okeyi de yere gonderiyordu. Oyuncu bunu istemiyor: okey elde 25 puan ve
// kurdugu peri bozmak istemez. Toplu isleme bir kolayliktir; oyuncunun
// kurdugu seyi dagitmamali.

import { kutMu, okeyMi, seriMu, type Tas, type TasId } from '@kut/engine';

/** Izgarada bitisik duran taslar bir grup sayilir (src/duzen.ts). */
export type Grup = readonly TasId[];

export interface IslemeSecimi {
  /** Isleme gonderilecek taslar. */
  readonly gonderilecek: readonly TasId[];
  /** Elde tutulan isler taslar — neden tutulduklariyla degil, sadece kimlik. */
  readonly korunan: readonly TasId[];
}

/**
 * Oyuncunun ELIYLE kurdugu, gecerli bir per olusturan gruplarin taslari.
 *
 * `dizme.ts`in otomatik dizmesinden farkli: burada oyuncunun izgarada
 * bitisik biraktigi taslara bakiliyor. Uc taslik gecerli bir per kurmussa
 * onu bozmuyoruz.
 */
export function kurulanPerTaslari(
  gruplar: readonly Grup[],
  istaka: readonly Tas[],
): ReadonlySet<TasId> {
  const kimlige = new Map(istaka.map((tas) => [tas.id, tas]));
  const korunan = new Set<TasId>();

  for (const grup of gruplar) {
    if (grup.length < 3) continue;
    const taslar = grup.map((id) => kimlige.get(id)).filter((tas): tas is Tas => tas !== undefined);
    if (taslar.length !== grup.length) continue;
    if (!kutMu(taslar).ok && !seriMu(taslar).ok) continue;
    for (const tas of taslar) korunan.add(tas.id);
  }
  return korunan;
}

/**
 * Toplu islemede gonderilecek taslari secer.
 *
 * Oyuncu taş SECTIYSE niyeti aciktir: ne sectiyse o gider, okey de dahil.
 * Secim yoksa iki sey korunur:
 *   - okey (25 puan; bilerek istenmeli)
 *   - oyuncunun izgarada kurdugu gecerli perlerin taslari
 */
export function islenecekTaslar(p: {
  readonly secili: readonly TasId[];
  readonly islerTaslarim: readonly TasId[];
  readonly istakam: readonly Tas[];
  readonly gruplar: readonly Grup[];
}): IslemeSecimi {
  if (p.secili.length > 0) {
    return { gonderilecek: [...p.secili], korunan: [] };
  }

  const kimlige = new Map(p.istakam.map((tas) => [tas.id, tas]));
  const perde = kurulanPerTaslari(p.gruplar, p.istakam);

  const gonderilecek: TasId[] = [];
  const korunan: TasId[] = [];
  for (const tasId of p.islerTaslarim) {
    const tas = kimlige.get(tasId);
    if (tas === undefined) continue;
    if (okeyMi(tas) || perde.has(tasId)) korunan.push(tasId);
    else gonderilecek.push(tasId);
  }
  return { gonderilecek, korunan };
}
