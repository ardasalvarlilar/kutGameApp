import { describe, expect, it } from 'vitest';
import { cipKisa, cipYaz } from './cip';

describe('cipYaz', () => {
  it('binlik ayirac nokta', () => {
    expect(cipYaz(0)).toBe('0');
    expect(cipYaz(999)).toBe('999');
    expect(cipYaz(5_000)).toBe('5.000');
    expect(cipYaz(1_500_000)).toBe('1.500.000');
    expect(cipYaz(-15_000)).toBe('-15.000');
  });
});

describe('cipKisa', () => {
  it('tam katlarda ondalik yok', () => {
    expect(cipKisa(5_000)).toBe('5K');
    expect(cipKisa(150_000)).toBe('150K');
    expect(cipKisa(5_000_000)).toBe('5M');
  });

  it('tek ondalik, virgulle', () => {
    expect(cipKisa(1_500_000)).toBe('1,5M');
    expect(cipKisa(7_500_000)).toBe('7,5M');
  });

  it('asagi yuvarlar — bakiyeyi oldugundan fazla gostermez', () => {
    expect(cipKisa(14_999)).toBe('14,9K');
  });

  it('binin altinda oldugu gibi', () => {
    expect(cipKisa(950)).toBe('950');
  });
});
