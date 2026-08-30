import { describe, expect, it } from 'vitest';
import {
  birebirEsMi,
  desteOlustur,
  OKEY_PUANI,
  tasPuani,
  tasToplami,
} from '../src/tas';
import { RENKLER, SAYILAR } from '../src/tipler';
import { ok, t } from './yardimci';

describe('deste — KURALLAR.md §1', () => {
  const deste = desteOlustur();

  it('106 tastan olusur', () => {
    expect(deste).toHaveLength(106);
  });

  it('104 normal + 2 okey', () => {
    expect(deste.filter((tas) => tas.tip === 'normal')).toHaveLength(104);
    expect(deste.filter((tas) => tas.tip === 'okey')).toHaveLength(2);
  });

  it('her renk-sayi kombinasyonundan tam iki kopya var', () => {
    for (const renk of RENKLER) {
      for (const sayi of SAYILAR) {
        const kopyalar = deste.filter(
          (tas) => tas.tip === 'normal' && tas.renk === renk && tas.sayi === sayi,
        );
        expect(kopyalar, `${renk} ${sayi}`).toHaveLength(2);
      }
    }
  });

  it('her tasin kimligi benzersizdir — CLAUDE.md motor kurali #6', () => {
    const kimlikler = new Set(deste.map((tas) => tas.id));
    expect(kimlikler.size).toBe(106);
  });

  it('gosterge yoktur: uretim her cagrida ayni', () => {
    expect(desteOlustur().map((tas) => tas.id)).toEqual(deste.map((tas) => tas.id));
  });
});

describe('tas puani — KURALLAR.md §8', () => {
  it('tasin puani sayisidir', () => {
    expect(tasPuani(t('kirmizi', 1))).toBe(1);
    expect(tasPuani(t('mavi', 13))).toBe(13);
  });

  it('okey 25 puandir', () => {
    expect(tasPuani(ok())).toBe(OKEY_PUANI);
    expect(OKEY_PUANI).toBe(25);
  });

  it('toplam dogru hesaplanir', () => {
    expect(tasToplami([t('kirmizi', 5), t('mavi', 10), ok()])).toBe(40);
  });
});

describe('birebir es — KURALLAR.md §9.1 (karara baglandi)', () => {
  it('ayni renk + ayni sayi estir', () => {
    expect(birebirEsMi(t('kirmizi', 7, 'a'), t('kirmizi', 7, 'b'))).toBe(true);
  });

  it('ayni sayi farkli renk es DEGILDIR', () => {
    expect(birebirEsMi(t('kirmizi', 7), t('mavi', 7))).toBe(false);
  });

  it('ayni renk farkli sayi es degildir', () => {
    expect(birebirEsMi(t('kirmizi', 7), t('kirmizi', 8))).toBe(false);
  });

  it('iki okey tasi fiziksel olarak birebir aynidir', () => {
    expect(birebirEsMi(ok('a'), ok('b'))).toBe(true);
  });

  it('okey ile normal tas es degildir', () => {
    expect(birebirEsMi(ok('a'), t('kirmizi', 7))).toBe(false);
  });
});
