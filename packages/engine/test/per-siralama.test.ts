import { describe, expect, it } from 'vitest';
import { perGoruntuSirasi, seriMu, type Per } from '../src/per';
import { ok, t } from './yardimci';

// KURALLAR.md §2 — seri 1'de baslar, 13'te durur, basa donmez.
//
// Motor bunu hep dogru uyguladi: `12 + 13 + 1` reddedilir, `12 + 13 + okey`
// ise KABUL edilir cunku tek gecerli okuma 11-12-13'tur (okey = 11).
// Yanlis olan gosterimdi: ekran taslari geldigi dizi sirasiyla dizince
// "12 13 ★" cikiyor, okey 13'un SAGINDA duruyor gibi gorunuyor ve
// "12-13-1 acmis" izlenimi veriyordu.

const seri = (taslar: readonly ReturnType<typeof t>[]): Per => ({ tip: 'seri', taslar });
const sayilar = (taslar: readonly ReturnType<typeof t>[]): string[] =>
  taslar.map((tas) => (tas.tip === 'okey' ? '*' : String(tas.sayi)));

describe('perGoruntuSirasi — seri', () => {
  it('12 + 13 + okey: okey 11 yerine gecer, EN BASA gelir', () => {
    const per = seri([t('kirmizi', 12), t('kirmizi', 13), ok('a')]);
    expect(sayilar(perGoruntuSirasi(per))).toEqual(['*', '12', '13']);
  });

  it('13 + iki okey: ikisi de 13un soluna gelir (11-12-13)', () => {
    const per = seri([t('kirmizi', 13), ok('a'), ok('b')]);
    expect(sayilar(perGoruntuSirasi(per))).toEqual(['*', '*', '13']);
  });

  it('bosluktaki okey ortada durur', () => {
    const per = seri([t('mavi', 4), t('mavi', 6), ok('a')]);
    expect(sayilar(perGoruntuSirasi(per))).toEqual(['4', '*', '6']);
  });

  it('belirsizse okey saga duser — oyuncunun bekledigi yer', () => {
    // 11 + 12 + okey hem 10-11-12 hem 11-12-13 olabilir; 13 secilir.
    const per = seri([t('mavi', 11), t('mavi', 12), ok('a')]);
    expect(sayilar(perGoruntuSirasi(per))).toEqual(['11', '12', '*']);
  });

  it('okeysiz seri sayiya gore siralanir', () => {
    const per = seri([t('sari', 7), t('sari', 5), t('sari', 6)]);
    expect(sayilar(perGoruntuSirasi(per))).toEqual(['5', '6', '7']);
  });

  it('sonradan islenen tas da dogru yere oturur', () => {
    // pereIsle taslari dizinin SONUNA ekliyor; gosterim yine sirali olmali.
    const per = seri([t('mavi', 5), t('mavi', 6), t('mavi', 7), t('mavi', 4)]);
    expect(sayilar(perGoruntuSirasi(per))).toEqual(['4', '5', '6', '7']);
  });

  it('1e dayanan seride okey saga gider', () => {
    const per = seri([t('siyah', 1), t('siyah', 2), ok('a')]);
    expect(sayilar(perGoruntuSirasi(per))).toEqual(['1', '2', '*']);
  });

  it('siralama tas kumesini degistirmez — yalnizca sirayi', () => {
    const per = seri([t('kirmizi', 12), t('kirmizi', 13), ok('a')]);
    const sirali = perGoruntuSirasi(per);
    expect(new Set(sirali.map((tas) => tas.id))).toEqual(
      new Set(per.taslar.map((tas) => tas.id)),
    );
    expect(sirali).toHaveLength(per.taslar.length);
  });

  it('sirali dizi hala gecerli bir seri', () => {
    for (const per of [
      seri([t('kirmizi', 12), t('kirmizi', 13), ok('a')]),
      seri([t('kirmizi', 13), ok('a'), ok('b')]),
      seri([t('mavi', 4), t('mavi', 6), ok('a')]),
      seri([t('mavi', 5), t('mavi', 6), t('mavi', 7), t('mavi', 4)]),
    ]) {
      expect(seriMu(perGoruntuSirasi(per)).ok).toBe(true);
    }
  });
});

describe('perGoruntuSirasi — sirasi anlamsiz olan perler', () => {
  it('kut oldugu gibi doner', () => {
    const per: Per = {
      tip: 'kut',
      taslar: [t('kirmizi', 3), t('siyah', 3), t('mavi', 3), ok('a')],
    };
    expect(perGoruntuSirasi(per)).toBe(per.taslar);
  });

  it('cift oldugu gibi doner', () => {
    const per: Per = { tip: 'cift', taslar: [t('kirmizi', 7), ok('a')] };
    expect(perGoruntuSirasi(per)).toBe(per.taslar);
  });
});

describe('motor sarmal seriye zaten izin vermiyordu', () => {
  it('12-13-1 gecersiz', () => {
    expect(seriMu([t('kirmizi', 12), t('kirmizi', 13), t('kirmizi', 1)]).ok).toBe(false);
  });

  it('13-1-2 gecersiz', () => {
    expect(seriMu([t('kirmizi', 13), t('kirmizi', 1), t('kirmizi', 2)]).ok).toBe(false);
  });

  it('12-13-okey gecerli — okey 11, 14 degil', () => {
    expect(seriMu([t('kirmizi', 12), t('kirmizi', 13), ok('a')]).ok).toBe(true);
  });
});
