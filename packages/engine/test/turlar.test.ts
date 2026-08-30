import { describe, expect, it } from 'vitest';
import type { Per } from '../src/per';
import { TUR_SARTLARI, eldenBitmeTuruMu, sartKarsilaniyorMu, turSarti } from '../src/turlar';
import { TURLAR, type TurNo } from '../src/tipler';
import { ok, t } from './yardimci';

const kut3: Per = { tip: 'kut', taslar: [t('kirmizi', 7), t('siyah', 7), t('mavi', 7)] };
const kut4: Per = {
  tip: 'kut',
  taslar: [t('kirmizi', 7), t('siyah', 7), t('mavi', 7), t('sari', 7)],
};
const seri3: Per = { tip: 'seri', taslar: [t('mavi', 4), t('mavi', 5), t('mavi', 6)] };
const seri4: Per = {
  tip: 'seri',
  taslar: [t('mavi', 4), t('mavi', 5), t('mavi', 6), t('mavi', 7)],
};
const seri5: Per = {
  tip: 'seri',
  taslar: [t('mavi', 4), t('mavi', 5), t('mavi', 6), t('mavi', 7), t('mavi', 8)],
};
const cift: Per = { tip: 'cift', taslar: [t('kirmizi', 7, 'a'), t('kirmizi', 7, 'b')] };

function reason(perler: readonly Per[], tur: TurNo): string {
  const sonuc = sartKarsilaniyorMu(perler, tur);
  return sonuc.ok ? 'ok' : sonuc.reason;
}

describe('tur tablosu — KURALLAR.md §3', () => {
  it('16 tur tanimli', () => {
    expect(TUR_SARTLARI).toHaveLength(16);
    expect(TUR_SARTLARI.map((s) => s.tur)).toEqual([...TURLAR]);
  });

  it('tablodaki tas sayilari tutuyor', () => {
    const beklenen: Record<number, number> = {
      1: 6, 2: 6, 3: 6, 4: 4, 5: 4, 6: 8, 7: 8, 8: 8,
      9: 5, 10: 8, 11: 8, 12: 9, 13: 9, 14: 10, 15: 8, 16: 0,
    };
    for (const sart of TUR_SARTLARI) {
      expect(sart.tasSayisi, `tur ${sart.tur}`).toBe(beklenen[sart.tur]);
    }
  });

  it('§9.2 (karara baglandi): tur 4, 5 ve 9 tek perdir', () => {
    expect(turSarti(4).parcalar).toEqual([{ tip: 'kut', uzunluk: 4 }]);
    expect(turSarti(5).parcalar).toEqual([{ tip: 'seri', uzunluk: 4 }]);
    expect(turSarti(9).parcalar).toEqual([{ tip: 'seri', uzunluk: 5 }]);
  });

  it('yalnizca tur 16 elden bitmedir', () => {
    for (const tur of TURLAR) {
      expect(eldenBitmeTuruMu(tur), `tur ${tur}`).toBe(tur === 16);
    }
  });
});

describe('sart dogrulama — KURALLAR.md §6 "ne eksik, ne fazla"', () => {
  it('tur 1: iki uclu kut', () => {
    expect(reason([kut3, kut3], 1)).toBe('ok');
  });

  it('tur 1: tek kut eksiktir', () => {
    expect(reason([kut3], 1)).toBe('sart-eksik');
  });

  it('tur 1: uc kut fazladir', () => {
    expect(reason([kut3, kut3, kut3], 1)).toBe('sart-fazla');
  });

  it('tur 1: iki seri sarti karsilamaz', () => {
    expect(reason([seri3, seri3], 1)).toBe('sart-uyusmuyor');
  });

  it('tur 2: iki uclu seri', () => {
    expect(reason([seri3, seri3], 2)).toBe('ok');
  });

  it('tur 3: bir kut + bir seri; iki kut kabul edilmez', () => {
    expect(reason([kut3, seri3], 3)).toBe('ok');
    expect(reason([seri3, kut3], 3)).toBe('ok');
    expect(reason([kut3, kut3], 3)).toBe('sart-uyusmuyor');
  });

  it('tur 4: sart dortlu kutse uclu kut ile acilamaz', () => {
    expect(reason([kut4], 4)).toBe('ok');
    expect(reason([kut3], 4)).toBe('sart-uyusmuyor');
  });

  it('tur 5: dortlu seri; uclu ya da besli olmaz', () => {
    expect(reason([seri4], 5)).toBe('ok');
    expect(reason([seri3], 5)).toBe('sart-uyusmuyor');
    expect(reason([seri5], 5)).toBe('sart-uyusmuyor');
  });

  it('tur 9: tek besli seri', () => {
    expect(reason([seri5], 9)).toBe('ok');
    expect(reason([seri4], 9)).toBe('sart-uyusmuyor');
  });

  it('tur 10: besli seri + uclu kut', () => {
    expect(reason([seri5, kut3], 10)).toBe('ok');
    expect(reason([seri5, seri3], 10)).toBe('sart-uyusmuyor');
  });

  it('tur 11: besli seri + uclu seri', () => {
    expect(reason([seri5, seri3], 11)).toBe('ok');
    expect(reason([seri3, seri3], 11)).toBe('sart-uyusmuyor');
  });

  it('tur 12: besli seri + dortlu kut', () => {
    expect(reason([seri5, kut4], 12)).toBe('ok');
  });

  it('tur 13: besli seri + dortlu seri', () => {
    expect(reason([seri5, seri4], 13)).toBe('ok');
    expect(reason([seri5, seri5], 13)).toBe('sart-uyusmuyor');
  });

  it('tur 14: iki besli seri', () => {
    expect(reason([seri5, seri5], 14)).toBe('ok');
  });

  it('tur 15: dort cift', () => {
    expect(reason([cift, cift, cift, cift], 15)).toBe('ok');
    expect(reason([cift, cift, cift], 15)).toBe('sart-eksik');
    expect(reason([cift, cift, cift, cift, cift], 15)).toBe('sart-fazla');
    expect(reason([cift, cift, cift, kut3], 15)).toBe('sart-uyusmuyor');
  });

  it('tur 16: yere per inmez, sart dogrulanmaz', () => {
    expect(reason([kut3, seri3], 16)).toBe('tur-16-acma-yok');
  });

  it('okeyli perler de sarta sayilir', () => {
    const okeyliKut: Per = { tip: 'kut', taslar: [t('kirmizi', 7), t('siyah', 7), ok()] };
    expect(reason([okeyliKut, kut3], 1)).toBe('ok');
  });
});
