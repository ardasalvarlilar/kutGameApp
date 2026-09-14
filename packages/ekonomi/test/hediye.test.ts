import { describe, expect, it } from 'vitest';
import {
  HEDIYE_TAVANI_SAAT,
  SAATLIK_HEDIYE,
  SAAT_MS,
  birikim,
  reklamEki,
  toplamaSonrasi,
} from '../src';

const T0 = 1_700_000_000_000;
const DAKIKA = 60_000;

describe('hediye birikimi', () => {
  it('saatte 100 cip, yalnizca tam saatler', () => {
    expect(birikim(T0, T0 + 59 * DAKIKA).miktar).toBe(0);
    expect(birikim(T0, T0 + SAAT_MS).miktar).toBe(SAATLIK_HEDIYE);
    expect(birikim(T0, T0 + 24 * SAAT_MS).miktar).toBe(2_400);
  });

  it('48 saatte durur: yedi gun gelmeyen 16.800 degil 4.800 alir', () => {
    const hafta = birikim(T0, T0 + 7 * 24 * SAAT_MS);
    expect(hafta.saat).toBe(HEDIYE_TAVANI_SAAT);
    expect(hafta.miktar).toBe(4_800);
    expect(hafta.tavanda).toBe(true);
    expect(hafta.sonrakiSaatMs).toBeNull();
  });

  it('sonraki saate kalan sure', () => {
    expect(birikim(T0, T0 + 2 * SAAT_MS + 40 * DAKIKA).sonrakiSaatMs).toBe(20 * DAKIKA);
  });

  it('saat geri gitse (telefon saati) eksi birikim olmaz', () => {
    expect(birikim(T0, T0 - SAAT_MS).miktar).toBe(0);
  });

  it('toplayinca artan dakikalar kaybolmaz', () => {
    const suAn = T0 + 2 * SAAT_MS + 40 * DAKIKA;
    const yeni = toplamaSonrasi(T0, suAn);
    expect(yeni).toBe(T0 + 2 * SAAT_MS);
    expect(birikim(yeni, suAn + 20 * DAKIKA).miktar).toBe(SAATLIK_HEDIYE);
  });

  it('tavanda toplayinca saat simdiden baslar — fazlasi yanar', () => {
    const suAn = T0 + 100 * SAAT_MS;
    expect(toplamaSonrasi(T0, suAn)).toBe(suAn);
  });

  it('reklam iki katina cikarir: eklenen kadar bir daha', () => {
    expect(reklamEki(4_800)).toBe(4_800);
  });
});
