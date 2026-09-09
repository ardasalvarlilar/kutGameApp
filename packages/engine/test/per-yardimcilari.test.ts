// Per yardimcilari: `perDogrula`, `perdekiOkeyler`, `kutteBosRenkler`.
//
// `perDogrula` bir KURAL tasiyor (KURALLAR.md §6): isleme sirasinda perin tipi
// degismemeli. Digerleri istemci ipucu — kural karari degil, ama ekranin
// okudugu sey oldugu icin yine de sozlesmeleri sabit kalmali.

import { describe, expect, it } from 'vitest';
import { kutteBosRenkler, perDogrula, perdekiOkeyler, type Per } from '../src/per';
import { ok, t } from './yardimci';

const per = (tip: Per['tip'], taslar: Per['taslar']): Per => ({ tip, taslar });

describe('perDogrula', () => {
  it('kut olarak dogrulanan kut gecerli', () => {
    const taslar = [t('kirmizi', 7), t('mavi', 7), t('siyah', 7)];
    expect(perDogrula('kut', taslar).ok).toBe(true);
  });

  it('seri olarak dogrulanan seri gecerli', () => {
    const taslar = [t('kirmizi', 4), t('kirmizi', 5), t('kirmizi', 6)];
    expect(perDogrula('seri', taslar).ok).toBe(true);
  });

  // Asil is bu: gecerli bir kut, SERI olarak dogrulanirsa reddedilmeli.
  // Yoksa yerdeki bir kute isleme yaparken per sessizce seriye donebilirdi.
  it('kut taslarini seri diye dogrulamiyor', () => {
    const taslar = [t('kirmizi', 7), t('mavi', 7), t('siyah', 7)];
    expect(perDogrula('seri', taslar).ok).toBe(false);
  });

  it('seri taslarini kut diye dogrulamiyor', () => {
    const taslar = [t('kirmizi', 4), t('kirmizi', 5), t('kirmizi', 6)];
    expect(perDogrula('kut', taslar).ok).toBe(false);
  });

  it('cift yalnizca birebir es iki tas (§9 0.1)', () => {
    expect(perDogrula('cift', [t('kirmizi', 7, 'a'), t('kirmizi', 7, 'b')]).ok).toBe(true);
    expect(perDogrula('cift', [t('kirmizi', 7), t('mavi', 7)]).ok).toBe(false);
  });

  it('uc tastan az olan kut/seri reddediliyor (§2)', () => {
    expect(perDogrula('kut', [t('kirmizi', 7), t('mavi', 7)]).ok).toBe(false);
    expect(perDogrula('seri', [t('kirmizi', 4), t('kirmizi', 5)]).ok).toBe(false);
  });
});

describe('perdekiOkeyler', () => {
  it('perdeki okeylerin kimliklerini donduruyor', () => {
    const p = per('seri', [t('kirmizi', 4), ok(), t('kirmizi', 6)]);
    expect(perdekiOkeyler(p)).toEqual([ok().id]);
  });

  it('iki okey de sayiliyor', () => {
    const p = per('kut', [t('kirmizi', 7), ok('a'), ok('b')]);
    expect(perdekiOkeyler(p)).toEqual([ok('a').id, ok('b').id]);
  });

  it('okey yoksa bos', () => {
    const p = per('kut', [t('kirmizi', 7), t('mavi', 7), t('siyah', 7)]);
    expect(perdekiOkeyler(p)).toEqual([]);
  });
});

describe('kutteBosRenkler', () => {
  it('kutte kullanilmamis renkleri sayiyor', () => {
    const p = per('kut', [t('kirmizi', 7), t('mavi', 7), t('siyah', 7)]);
    expect(kutteBosRenkler(p)).toEqual(['sari']);
  });

  it('dort renk dolduysa bos', () => {
    const p = per('kut', [t('kirmizi', 7), t('mavi', 7), t('siyah', 7), t('sari', 7)]);
    expect(kutteBosRenkler(p)).toEqual([]);
  });

  // Okey bir rengi TEMSIL ediyor olabilir ama hangisini temsil ettigi bu
  // fonksiyonun isi degil: okey normal tas sayilmadigi icin rengi bos kalir.
  it('okey bir rengi doldurmus saymiyor', () => {
    const p = per('kut', [t('kirmizi', 7), t('mavi', 7), ok()]);
    expect(kutteBosRenkler(p)).toEqual(['siyah', 'sari']);
  });

  it('seri ve ciftte anlamsiz — bos donuyor', () => {
    expect(kutteBosRenkler(per('seri', [t('kirmizi', 4), t('kirmizi', 5), t('kirmizi', 6)]))).toEqual([]);
    expect(kutteBosRenkler(per('cift', [t('kirmizi', 7, 'a'), t('kirmizi', 7, 'b')]))).toEqual([]);
  });
});
