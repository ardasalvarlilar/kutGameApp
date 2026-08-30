import { describe, expect, it } from 'vitest';
import {
  YAKALAMA_PAYI,
  anahtardanHedef,
  hedefAnahtari,
  hedefBul,
  merkez,
  type HedefKaydi,
} from './hedefler';

// Masaya tas indikce yan sutunlar genisliyor, ortadaki atik obegi kayiyor.
// Sabit bir "yukari surukle = at" esigi bu yuzden yetmiyordu; hedeflerin
// gercek dikdortgeni olculup birakilan nokta bunlara karsi sinaniyor.

const atik: HedefKaydi = { hedef: { tip: 'atik' }, alan: { x: 300, y: 140, en: 40, boy: 44 } };
const solPer: HedefKaydi = { hedef: { tip: 'per', perId: 7 }, alan: { x: 40, y: 120, en: 160, boy: 30 } };
const sagPer: HedefKaydi = { hedef: { tip: 'per', perId: 9 }, alan: { x: 460, y: 120, en: 160, boy: 30 } };
const hepsi = [atik, solPer, sagPer];

describe('merkez', () => {
  it('dikdortgenin ortasini verir', () => {
    expect(merkez(atik.alan)).toEqual({ x: 320, y: 162 });
  });
});

describe('hedefBul', () => {
  it('obegin tam ustune birakilirsa atik', () => {
    expect(hedefBul({ x: 320, y: 162 }, hepsi)).toEqual({ tip: 'atik' });
  });

  it('perin tam ustune birakilirsa o per', () => {
    expect(hedefBul({ x: 120, y: 135 }, hepsi)).toEqual({ tip: 'per', perId: 7 });
    expect(hedefBul({ x: 540, y: 135 }, hepsi)).toEqual({ tip: 'per', perId: 9 });
  });

  it('hicbirine yakin degilse null — tas istakaya doner', () => {
    expect(hedefBul({ x: 320, y: 600 }, hepsi)).toBeNull();
  });

  it('pay kadar yakinsa yakalanir — obek kucuk hedef, nisan almak gerekmesin', () => {
    const hemenUstu = { x: 320, y: 140 - YAKALAMA_PAYI + 2 };
    expect(hedefBul(hemenUstu, hepsi)).toEqual({ tip: 'atik' });
  });

  it('payin disinda kalirsa yakalanmaz', () => {
    const uzak = { x: 320, y: 140 - YAKALAMA_PAYI - 5 };
    expect(hedefBul(uzak, hepsi)).toBeNull();
  });

  it('tam icine dusulen hedef, paya giren komsuya tercih edilir', () => {
    // Perin sag kenarina yakin bir nokta; obek de pay icinde olabilir ama
    // parmak gercekten perin ustunde.
    const perinIcinde = { x: 195, y: 135 };
    expect(hedefBul(perinIcinde, [solPer, { ...atik, alan: { x: 200, y: 120, en: 40, boy: 40 } }])).toEqual(
      { tip: 'per', perId: 7 },
    );
  });

  it('iki hedef de yalnizca payda ise merkezi yakin olan secilir', () => {
    const iki: HedefKaydi[] = [
      { hedef: { tip: 'per', perId: 1 }, alan: { x: 0, y: 0, en: 20, boy: 20 } },
      { hedef: { tip: 'per', perId: 2 }, alan: { x: 100, y: 0, en: 20, boy: 20 } },
    ];
    expect(hedefBul({ x: 40, y: 10 }, iki, 40)).toEqual({ tip: 'per', perId: 1 });
    expect(hedefBul({ x: 80, y: 10 }, iki, 40)).toEqual({ tip: 'per', perId: 2 });
  });

  it('hedef listesi bossa null', () => {
    expect(hedefBul({ x: 10, y: 10 }, [])).toBeNull();
  });

  it('pay 0 verilirse yalnizca tam ustu sayilir', () => {
    expect(hedefBul({ x: 320, y: 130 }, hepsi, 0)).toBeNull();
    expect(hedefBul({ x: 320, y: 150 }, hepsi, 0)).toEqual({ tip: 'atik' });
  });
});

describe('hedef anahtarlari', () => {
  it('gidis donus ayni hedefi verir', () => {
    for (const hedef of [
      { tip: 'atik' } as const,
      { tip: 'per', perId: 0 } as const,
      { tip: 'per', perId: 42 } as const,
    ]) {
      expect(anahtardanHedef(hedefAnahtari(hedef))).toEqual(hedef);
    }
  });

  it('bozuk anahtar null doner — olcum sozlugu kirletilmesin', () => {
    expect(anahtardanHedef('sacma')).toBeNull();
    expect(anahtardanHedef('per:abc')).toBeNull();
    expect(anahtardanHedef('per:')).toBeNull();
  });
});
