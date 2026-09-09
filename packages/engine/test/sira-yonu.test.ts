// KURALLAR.md §4 — sira yonu.
//
// "Attigin tasi SAGINDAKI oyuncu alir; sira da ona gecer." Motor bunu koltuk
// numarasini AZALTARAK yapiyor (`SIRA_YONU = -1`). Yon tek yerde tanimli ve
// dagitim, calma onceligi (§5) ile ekran yerlesimi hep buradan turuyor —
// dolayisiyla yonu degistiren bir duzenleme bu dosyayi kirmali.

import { describe, expect, it } from 'vitest';
import { SIRA_YONU, koltukOfseti, siradaIleri, sonrakiOyuncu } from '../src/tipler';
import type { OyuncuId } from '../src/tipler';

const KOLTUKLAR: readonly OyuncuId[] = [0, 1, 2, 3];

describe('koltukOfseti', () => {
  it('koltuk numarasi yonunde ilerler', () => {
    expect(koltukOfseti(0, 1)).toBe(1);
    expect(koltukOfseti(2, 1)).toBe(3);
  });

  it('dordu asinca basa doner', () => {
    expect(koltukOfseti(3, 1)).toBe(0);
    expect(koltukOfseti(2, 3)).toBe(1);
  });

  it('negatif ofsette de dolaniyor', () => {
    expect(koltukOfseti(0, -1)).toBe(3);
    expect(koltukOfseti(1, -5)).toBe(0);
  });

  it('sifir ofset ayni koltuk', () => {
    for (const koltuk of KOLTUKLAR) expect(koltukOfseti(koltuk, 0)).toBe(koltuk);
  });
});

describe('siradaIleri', () => {
  it('bir adim ileri koltuk numarasini AZALTIR (§4)', () => {
    expect(siradaIleri(0, 1)).toBe(3);
    expect(siradaIleri(3, 1)).toBe(2);
    expect(siradaIleri(2, 1)).toBe(1);
    expect(siradaIleri(1, 1)).toBe(0);
  });

  it('iki adim ileri karsidaki oyuncu', () => {
    expect(siradaIleri(0, 2)).toBe(2);
    expect(siradaIleri(1, 2)).toBe(3);
    expect(siradaIleri(2, 2)).toBe(0);
    expect(siradaIleri(3, 2)).toBe(1);
  });

  it('dort adim sonra basa doner', () => {
    for (const koltuk of KOLTUKLAR) expect(siradaIleri(koltuk, 4)).toBe(koltuk);
  });

  it('yon tek sabitten okunuyor', () => {
    expect(SIRA_YONU).toBe(-1);
    for (const koltuk of KOLTUKLAR) {
      expect(siradaIleri(koltuk, 1)).toBe(koltukOfseti(koltuk, SIRA_YONU));
    }
  });
});

describe('sonrakiOyuncu', () => {
  it('atilan tasi bedelsiz alacak olan, atanin sagindakidir', () => {
    for (const koltuk of KOLTUKLAR) expect(sonrakiOyuncu(koltuk)).toBe(siradaIleri(koltuk, 1));
  });

  it('dort oyuncu tek cevrimde donuyor, kimse atlanmiyor', () => {
    const gorulen = new Set<OyuncuId>();
    let mevcut: OyuncuId = 0;
    for (let adim = 0; adim < 4; adim += 1) {
      gorulen.add(mevcut);
      mevcut = sonrakiOyuncu(mevcut);
    }
    expect(gorulen.size).toBe(4);
    expect(mevcut).toBe(0);
  });

  it('sag komsuluk simetrik degil — kimse kendi sagindaki degil', () => {
    for (const koltuk of KOLTUKLAR) expect(sonrakiOyuncu(koltuk)).not.toBe(koltuk);
  });
});
