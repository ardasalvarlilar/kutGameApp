// "TASLARI ISLE" dugmesinin plani.
//
// Eskiden bu is Masa.tsx'te, her adimda tam oyun durumunu (`suAnkiDurum()`)
// okuyarak yapiliyordu. Cevrimici oyunda o durum ISTEMCIDE YOK — motorun
// tam hali sunucuda duruyor, istemci yalnizca kendi `viewFor` projeksiyonunu
// goruyor (CLAUDE.md motor kurali #3). Bu yuzden plan artik yalnizca
// GORUNUMDEN cikariliyor: yerdeki perler ve kendi istakam zaten gorunumde.
//
// Saf ve testli. Gecerlilik karari yine motorun: burasi `pereIsle` ile
// SORUYOR, kendi kurali yok.

import { pereIsle, type Per, type Tas, type TasId, type YerPeri } from '@kut/engine';

export interface IslemeAdimi {
  readonly perId: number;
  readonly tasIdler: readonly TasId[];
}

/**
 * Hangi tas hangi pere gidecek?
 *
 * Adim adim ilerler cunku bir tasin islenmesi bir sonrakini mumkun kilabilir:
 * `siyah 4-5-6` peri once 7'yi, sonra 8'i kabul eder. Her tur en az bir tas
 * yerlestirilemeyene kadar donulur.
 *
 * Ayni pere giden taslar TEK adimda birlesir: motor `[...per.taslar, a, b]`
 * butununu dogruladigi icin ikisini ayri gondermenin faydasi yok, ag
 * gidis-donusu iki katina cikardi.
 */
export function islemePlani(
  gonderilecek: readonly TasId[],
  istakam: readonly Tas[],
  yer: readonly YerPeri[],
): readonly IslemeAdimi[] {
  const tasla = new Map(istakam.map((tas) => [tas.id, tas]));
  // Perlerin YEREL kopyasi: plan ilerledikce buyuyor, gercek durum degil.
  const perler = yer.map((per) => ({
    id: per.id,
    tip: per.tip,
    taslar: [...per.taslar] as Tas[],
  }));
  const atananlar = new Map<number, TasId[]>();

  let kalanlar = gonderilecek.filter((id) => tasla.has(id));
  let ilerleme = true;

  while (ilerleme && kalanlar.length > 0) {
    ilerleme = false;
    for (const tasId of [...kalanlar]) {
      const tas = tasla.get(tasId);
      if (tas === undefined) continue;

      const hedef = perler.find((per) => pereIsle(per as Per, [tas]).ok);
      if (hedef === undefined) continue;

      hedef.taslar.push(tas);
      const mevcut = atananlar.get(hedef.id);
      if (mevcut === undefined) atananlar.set(hedef.id, [tasId]);
      else mevcut.push(tasId);

      kalanlar = kalanlar.filter((id) => id !== tasId);
      ilerleme = true;
    }
  }

  return [...atananlar.entries()].map(([perId, tasIdler]) => ({ perId, tasIdler }));
}
