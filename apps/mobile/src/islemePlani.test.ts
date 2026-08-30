import { describe, expect, it } from 'vitest';
import type { NormalTas, Tas, YerPeri } from '@kut/engine';
import { islemePlani } from './islemePlani';

const tas = (id: string, renk: NormalTas['renk'], sayi: number): Tas => ({
  id,
  tip: 'normal',
  renk,
  // `Sayi` 1..13'lu dar bir birlesim; testte sayilari elle yaziyoruz.
  sayi: sayi as NormalTas['sayi'],
});

const per = (id: number, tip: YerPeri['tip'], taslar: readonly Tas[]): YerPeri => ({
  id,
  sahibi: 0,
  tip,
  taslar,
});

describe('islemePlani', () => {
  it('uyan tasi dogru pere yolluyor', () => {
    const yedi = tas('s7', 'siyah', 7);
    const plan = islemePlani(
      ['s7'],
      [yedi],
      [per(1, 'seri', [tas('s4', 'siyah', 4), tas('s5', 'siyah', 5), tas('s6', 'siyah', 6)])],
    );
    expect(plan).toEqual([{ perId: 1, tasIdler: ['s7'] }]);
  });

  it('ayni pere giden taslari TEK adimda birlestiriyor', () => {
    const plan = islemePlani(
      ['s7', 's8'],
      [tas('s7', 'siyah', 7), tas('s8', 'siyah', 8)],
      [per(1, 'seri', [tas('s4', 'siyah', 4), tas('s5', 'siyah', 5), tas('s6', 'siyah', 6)])],
    );
    expect(plan).toHaveLength(1);
    expect(plan[0]?.perId).toBe(1);
    expect([...(plan[0]?.tasIdler ?? [])].sort()).toEqual(['s7', 's8']);
  });

  it('zincirleme isliyor — 8 ancak 7 girdikten sonra uyuyor', () => {
    // Sirasi bilerek ters veriliyor: ilk turda 8 uymaz, 7 girince uyar.
    const plan = islemePlani(
      ['s8', 's7'],
      [tas('s8', 'siyah', 8), tas('s7', 'siyah', 7)],
      [per(1, 'seri', [tas('s4', 'siyah', 4), tas('s5', 'siyah', 5), tas('s6', 'siyah', 6)])],
    );
    expect(plan).toHaveLength(1);
    expect([...(plan[0]?.tasIdler ?? [])].sort()).toEqual(['s7', 's8']);
  });

  it('uymayan tasi plana koymuyor', () => {
    const plan = islemePlani(
      ['m1'],
      [tas('m1', 'mavi', 1)],
      [per(1, 'seri', [tas('s4', 'siyah', 4), tas('s5', 'siyah', 5), tas('s6', 'siyah', 6)])],
    );
    expect(plan).toEqual([]);
  });

  it('istakada olmayan tas kimligini yok sayiyor', () => {
    const plan = islemePlani(['hayalet'], [], [per(1, 'kut', [])]);
    expect(plan).toEqual([]);
  });

  it('birden cok pere dagitiyor', () => {
    const plan = islemePlani(
      ['s7', 'k9'],
      [tas('s7', 'siyah', 7), tas('k9', 'kirmizi', 9)],
      [
        per(1, 'seri', [tas('s4', 'siyah', 4), tas('s5', 'siyah', 5), tas('s6', 'siyah', 6)]),
        per(2, 'kut', [tas('m9', 'mavi', 9), tas('sa9', 'sari', 9), tas('si9', 'siyah', 9)]),
      ],
    );
    expect(plan.map((a) => a.perId).sort()).toEqual([1, 2]);
  });
});
