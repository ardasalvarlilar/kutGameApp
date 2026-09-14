import { describe, expect, it } from 'vitest';
import { normalTas, okeyTas, type TasHareketi } from '@kut/engine';
import { GORME_PAYI_MS, UCUS_SURESI_MS, gosterimSuresi, yeniHareketler } from '../src/tempo';

const k5 = normalTas('kirmizi', 5, 'a');
const m5 = normalTas('mavi', 5, 'a');
const s9 = normalTas('siyah', 9, 'a');

const cekim: TasHareketi = { sira: 1, oyuncu: 3, tip: 'cekim', kaynak: 'deste', tas: null, kimden: null };
const indirme: TasHareketi = { sira: 2, oyuncu: 3, tip: 'indirme', perId: 1, taslar: [k5, m5, okeyTas('a')] };
const atma: TasHareketi = { sira: 3, oyuncu: 3, tip: 'atma', tas: s9 };

describe('gosterim suresi (§9 0.13)', () => {
  it('hareket yoksa beklenecek bir sey yok', () => {
    expect(gosterimSuresi([])).toBe(0);
  });

  it('her tas bir ucus; indirme tas sayisi kadar', () => {
    expect(gosterimSuresi([cekim, indirme])).toBe(4 * UCUS_SURESI_MS);
  });

  it('atis varsa atilan tasi gormek icin pay ekleniyor', () => {
    expect(gosterimSuresi([cekim, indirme, atma])).toBe(5 * UCUS_SURESI_MS + GORME_PAYI_MS);
  });

  it('yalnizca gorulenden sonraki hareketler sayiliyor', () => {
    expect(yeniHareketler([cekim, indirme, atma], 1).map((h) => h.sira)).toEqual([2, 3]);
    expect(yeniHareketler([cekim, indirme, atma], 3)).toEqual([]);
  });
});
