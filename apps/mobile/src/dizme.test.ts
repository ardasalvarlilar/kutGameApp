import { describe, expect, it } from 'vitest';
import { normalTas, okeyTas, seriMu, type Renk, type Sayi, type Tas } from '@kut/engine';
import { kutDiz, seriDiz, type Grup } from './dizme';

const t = (renk: Renk, sayi: Sayi, kopya: 'a' | 'b' = 'a'): Tas => normalTas(renk, sayi, kopya);
const ok = (kopya: 'a' | 'b' = 'a'): Tas => okeyTas(kopya);

const KISALTMA: Record<Renk, string> = { kirmizi: 'K', siyah: 'S', mavi: 'M', sari: 'Y' };

function ozet(gruplar: readonly Grup[]): string[] {
  return gruplar.map((grup) =>
    grup.map((tas) => (tas.tip === 'okey' ? 'OKEY' : `${KISALTMA[tas.renk]}${tas.sayi}`)).join('-'),
  );
}

/** Dizme hicbir tasi kaybetmemeli ya da cogaltmamali. */
function tasKorunuyorMu(girdi: readonly Tas[], gruplar: readonly Grup[]): boolean {
  const cikan = gruplar.flat().map((tas) => tas.id);
  return cikan.length === girdi.length && new Set(cikan).size === girdi.length;
}

describe('seriDiz', () => {
  it('ardisik ayni renk taslari bir bolmede toplar', () => {
    const el = [t('mavi', 5), t('kirmizi', 9), t('mavi', 4), t('mavi', 6)];
    const gruplar = seriDiz(el);
    expect(ozet(gruplar)).toEqual(['M4-M5-M6', 'K9']);
    expect(tasKorunuyorMu(el, gruplar)).toBe(true);
  });

  it('kalan taslari tek bolmede sona koyar', () => {
    const el = [t('mavi', 4), t('mavi', 5), t('mavi', 6), t('kirmizi', 9), t('sari', 2)];
    expect(ozet(seriDiz(el))).toEqual(['M4-M5-M6', 'K9-Y2']);
  });

  it('acilamayan ikiliyi ayri bolme YAPMAZ — per icin en az 3 tas gerekir', () => {
    // Kirmizi 1-2 ardisik ama acilamaz; kirmizi 3 olmadan seri degil.
    const el = [t('kirmizi', 1), t('kirmizi', 2), t('siyah', 5), t('mavi', 9)];
    const gruplar = seriDiz(el);
    expect(gruplar).toHaveLength(1);
    expect(ozet(gruplar)).toEqual(['K1-K2-S5-M9']);
  });

  it('ucuncu tas gelince gruplar', () => {
    const el = [t('kirmizi', 1), t('kirmizi', 2), t('kirmizi', 3), t('mavi', 9)];
    expect(ozet(seriDiz(el))).toEqual(['K1-K2-K3', 'M9']);
  });

  it('ayni sayidan iki tas ayni seride durmaz', () => {
    const el = [t('mavi', 4), t('mavi', 5, 'a'), t('mavi', 5, 'b'), t('mavi', 6)];
    const gruplar = seriDiz(el);
    expect(ozet(gruplar)).toEqual(['M4-M5-M6', 'M5']);
    expect(tasKorunuyorMu(el, gruplar)).toBe(true);
  });

  it('okey bosluga kopru olur', () => {
    expect(ozet(seriDiz([t('mavi', 4), t('mavi', 6), ok('a')]))).toEqual(['M4-OKEY-M6']);
  });

  it('okey ikili zinciri uce tamamlar', () => {
    expect(ozet(seriDiz([t('sari', 11), t('sari', 12), ok('a')]))).toEqual(['Y11-Y12-OKEY']);
  });

  it('okeyi once seriye donusecek zincire harcar', () => {
    // Sari 1 tek basina, mavi 11-12 ikili. Okey mavi zincire gitmeli.
    const el = [t('sari', 1), t('mavi', 11), t('mavi', 12), ok('a')];
    expect(ozet(seriDiz(el))).toEqual(['M11-M12-OKEY', 'Y1']);
  });

  it('13ten sonra basa donmez — 12-13-1 per olarak dizilmez', () => {
    const el = [t('mavi', 12), t('mavi', 13), t('mavi', 1)];
    const gruplar = seriDiz(el);
    // KURALLAR.md §2: 1 seriyi baslatabilir, bitiremez.
    expect(ozet(gruplar)).toEqual(['M1-M12-M13']);
    expect(gruplar.every((grup) => !seriMu(grup).ok)).toBe(true);
  });

  it('farkli renkler ayri bolmelere duser', () => {
    const el = [
      t('mavi', 4), t('mavi', 5), t('mavi', 6),
      t('kirmizi', 7), t('kirmizi', 8), t('kirmizi', 9),
    ];
    expect(ozet(seriDiz(el)).sort()).toEqual(['K7-K8-K9', 'M4-M5-M6']);
  });

  it('kalanlari renk-sayi sirasiyla dizer', () => {
    const el = [t('sari', 3), t('kirmizi', 8), t('mavi', 1), t('kirmizi', 2)];
    expect(ozet(seriDiz(el))).toEqual(['K2-K8-M1-Y3']);
  });

  it('bos el bos dizilim verir', () => {
    expect(seriDiz([])).toEqual([]);
  });
});

describe('kutDiz', () => {
  it('ayni sayinin farkli renklerini toplar', () => {
    const el = [t('kirmizi', 7), t('mavi', 3), t('siyah', 7), t('mavi', 7)];
    const gruplar = kutDiz(el);
    expect(ozet(gruplar)).toEqual(['K7-S7-M7', 'M3']);
    expect(tasKorunuyorMu(el, gruplar)).toBe(true);
  });

  it('ayni renkten ikinci kopya kuta girmez', () => {
    const el = [t('kirmizi', 7, 'a'), t('kirmizi', 7, 'b'), t('siyah', 7), t('mavi', 7)];
    expect(ozet(kutDiz(el))).toEqual(['K7-S7-M7', 'K7']);
  });

  it('bir kut en fazla 4 tastir', () => {
    const el = [t('kirmizi', 7), t('siyah', 7), t('mavi', 7), t('sari', 7), ok('a')];
    const gruplar = kutDiz(el);
    expect(gruplar[0]).toHaveLength(4);
    expect(tasKorunuyorMu(el, gruplar)).toBe(true);
  });

  it('acilamayan ikiliyi ayri bolme YAPMAZ', () => {
    // Iki tane 9 acilmaz; ucuncu renk gerekir.
    const el = [t('kirmizi', 9), t('mavi', 9), t('sari', 2)];
    const gruplar = kutDiz(el);
    expect(gruplar).toHaveLength(1);
    expect(ozet(gruplar)).toEqual(['Y2-K9-M9']);
  });

  it('okeyi pere donusecek ikiliye harcar, tek tasa degil', () => {
    const el = [t('mavi', 1), t('kirmizi', 7), t('siyah', 7), ok('a')];
    expect(ozet(kutDiz(el))).toEqual(['K7-S7-OKEY', 'M1']);
  });

  it('iki okey tek tasi kuta tamamlar', () => {
    expect(ozet(kutDiz([t('kirmizi', 7), ok('a'), ok('b')]))).toEqual(['K7-OKEY-OKEY']);
  });

  it('kut olmayan taslar sona duser', () => {
    const el = [t('kirmizi', 7), t('siyah', 7), t('mavi', 7), t('sari', 2)];
    expect(ozet(kutDiz(el))).toEqual(['K7-S7-M7', 'Y2']);
  });

  it('kalanlari sayi-renk sirasiyla dizer — yakin taslar yan yana gelsin', () => {
    const el = [t('sari', 9), t('kirmizi', 2), t('mavi', 9), t('mavi', 2)];
    expect(ozet(kutDiz(el))).toEqual(['K2-M2-M9-Y9']);
  });
});
