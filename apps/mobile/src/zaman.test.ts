import { describe, expect, it } from 'vitest';
import { cevir, type Ceviri } from './dil/cevir';
import { sonGorulmeMetni } from './zaman';

// Modul artik ceviriyi disaridan aliyor; testler Turkce sozlukle kosuyor.
const t: Ceviri = (anahtar, degerler) => cevir('tr', anahtar, degerler);

const AN = Date.parse('2026-09-08T12:00:00.000Z');
const once = (ms: number): string => new Date(AN - ms).toISOString();

describe('sonGorulmeMetni', () => {
  it('bir dakika icinde "az önce"', () => {
    expect(sonGorulmeMetni(once(30_000), AN, t)).toBe('az önce');
  });

  it('dakika esigi asilinca dakika yaziyor', () => {
    expect(sonGorulmeMetni(once(12 * 60_000), AN, t)).toBe('12 dk önce');
  });

  it('bir saatten sonra saat yaziyor', () => {
    expect(sonGorulmeMetni(once(3 * 3_600_000), AN, t)).toBe('3 saat önce');
  });

  it('bir gunden sonra gun yaziyor', () => {
    expect(sonGorulmeMetni(once(2 * 86_400_000), AN, t)).toBe('2 gün önce');
  });

  it('bir aydan eskisi tek cumleye duser', () => {
    expect(sonGorulmeMetni(once(400 * 86_400_000), AN, t)).toBe('uzun süredir yok');
  });

  it('ILERI tarihli damga "az önce" — telefonun saati geride olabilir', () => {
    // Sunucu ile telefon arasindaki fark yuzunden negatif aralik cikabiliyor;
    // "-2 dk önce" yazmak yerine yakin kabul ediliyor.
    expect(sonGorulmeMetni(new Date(AN + 90_000).toISOString(), AN, t)).toBe('az önce');
  });

  it('bozuk damga bos metin — ekran hiclik gostersin, "NaN dk" degil', () => {
    expect(sonGorulmeMetni('bu bir tarih degil', AN, t)).toBe('');
  });

  it('gun sinirinda saat degil gun yaziyor', () => {
    expect(sonGorulmeMetni(once(86_400_000), AN, t)).toBe('1 gün önce');
    expect(sonGorulmeMetni(once(86_400_000 - 1000), AN, t)).toBe('23 saat önce');
  });
});
