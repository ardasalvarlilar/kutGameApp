import { describe, expect, it } from 'vitest';
import { karistir, rngOlustur, tohumla } from '../src/rng';
import { desteOlustur } from '../src/tas';

describe('tohumlu rastgelelik — CLAUDE.md motor kurali #2', () => {
  const deste = desteOlustur();

  it('ayni tohum ayni siralamayi uretir', () => {
    const bir = karistir(deste, rngOlustur(12345));
    const iki = karistir(deste, rngOlustur(12345));
    expect(bir.map((tas) => tas.id)).toEqual(iki.map((tas) => tas.id));
  });

  it('farkli tohum farkli siralama uretir', () => {
    const bir = karistir(deste, rngOlustur(1));
    const iki = karistir(deste, rngOlustur(2));
    expect(bir.map((tas) => tas.id)).not.toEqual(iki.map((tas) => tas.id));
  });

  it('karistirma bir permutasyondur — tas ne kaybolur ne cogalir', () => {
    const karisik = karistir(deste, rngOlustur(999));
    expect(karisik).toHaveLength(deste.length);
    expect(new Set(karisik.map((tas) => tas.id))).toEqual(new Set(deste.map((tas) => tas.id)));
  });

  it('girdi dizisini degistirmez', () => {
    const once = deste.map((tas) => tas.id);
    karistir(deste, rngOlustur(7));
    expect(deste.map((tas) => tas.id)).toEqual(once);
  });

  it('metinden uretilen tohum deterministiktir', () => {
    expect(tohumla('oda-42')).toBe(tohumla('oda-42'));
    expect(tohumla('oda-42')).not.toBe(tohumla('oda-43'));
  });

  it('uretilen degerler [0, 1) araligindadir', () => {
    const rng = rngOlustur(4242);
    for (let i = 0; i < 1000; i++) {
      const deger = rng.next();
      expect(deger).toBeGreaterThanOrEqual(0);
      expect(deger).toBeLessThan(1);
    }
  });
});
