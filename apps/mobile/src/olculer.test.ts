import { describe, expect, it } from 'vitest';
import {
  EN_AZ_TAS_EN,
  EN_COK_YAN_TAS_EN,
  EN_COK_YATAY_TAS_EN,
  EN_UZUN_PER,
  MASA_DOLGU,
  MERKEZ_EN_AZ,
  OLCULER,
  ORTA_BOSLUK,
  PER_ARASI,
  perGenisligi,
  tasOlcusu,
  yanPerAlaniEni,
  yanSutunEni,
  yanTasEni,
  yatayTasEni,
} from './olculer';

/**
 * App.tsx'in masa disinda kalan sabit kismi. Masanin eni bunlardan sonra
 * geriye kalan yerdir; testler gercek cihaz enlerini buradan cikariyor.
 */
const YAN_PANEL = 168;
const GOVDE_DOLGU = 6;
const UST_ALAN_BOSLUK = 6;

function masaEni(ekranEni: number, guvenliAlan: number): number {
  return ekranEni - guvenliAlan - 2 * GOVDE_DOLGU - UST_ALAN_BOSLUK - YAN_PANEL;
}

/** Yatay moddaki gercek cihazlar; guvenli alan iki yanin toplami. */
const CIHAZLAR = [
  { ad: 'iPhone SE / 8 (667)', ekran: 667, guvenli: 0 },
  { ad: 'iPhone 13 mini (812)', ekran: 812, guvenli: 94 },
  { ad: 'iPhone 14 (844)', ekran: 844, guvenli: 94 },
  { ad: 'iPhone 15 Pro Max (932)', ekran: 932, guvenli: 118 },
  { ad: 'Android orta segment (800)', ekran: 800, guvenli: 0 },
  { ad: 'iPad mini (1133)', ekran: 1133, guvenli: 0 },
] as const;

describe('tasOlcusu — oranlar', () => {
  it('kademeler eskisiyle birebir ayni kaliyor', () => {
    // Bu uc olcu elle yazilmisti; formule cevrildi, degerler degismemeli.
    expect(OLCULER.buyuk).toEqual({ en: 25, boy: 35, yuvarlak: 4, yazi: 15, nokta: 4 });
    expect(OLCULER.orta).toEqual({ en: 20, boy: 28, yuvarlak: 3, yazi: 12, nokta: 3 });
    expect(OLCULER.kucuk).toEqual({ en: 17, boy: 24, yuvarlak: 3, yazi: 10, nokta: 3 });
  });

  it('tas her boyda dikey duruyor — boy hep enden buyuk', () => {
    for (let en = EN_AZ_TAS_EN; en <= 30; en++) {
      const olcu = tasOlcusu(en);
      expect(olcu.boy).toBeGreaterThan(olcu.en);
      expect(olcu.yazi).toBeGreaterThan(0);
      expect(olcu.yazi).toBeLessThan(olcu.boy);
    }
  });
});

describe('perGenisligi', () => {
  it('bos per yer kaplamaz', () => {
    expect(perGenisligi(17, 0)).toBe(0);
  });

  it('tas basina en + bosluk, ustune cerceve', () => {
    // 3 tas: 3×17 + 2×1 bosluk + 6 cerceve
    expect(perGenisligi(17, 3)).toBe(51 + 2 + 6);
  });
});

describe('yanTasEni — 13 tas soldaki istakadan ortadaki yigina kadar sigmali', () => {
  // KURALLAR.md §2: seri 1'de baslar 13'te durur, yani bir perde en fazla
  // 13 tas yan yana gelir. Sikayetin cikis noktasi buydu: uzun bir seride
  // yalnizca dort bes tas gorunuyordu.
  it.each(CIHAZLAR)('$ad', ({ ekran, guvenli }) => {
    const masa = masaEni(ekran, guvenli);
    const tas = yanTasEni(masa);
    expect(perGenisligi(tas, EN_UZUN_PER)).toBeLessThanOrEqual(yanPerAlaniEni(masa));
  });

  it('desteklenen butun masa enlerinde 13 tas sigiyor', () => {
    // 474 = formulun EN_AZ_TAS_EN ile 13 tasi sigdirabildigi en dar masa.
    // Yatay modda en dar desteklenen cihaz (iPhone SE, 667) 481 birakiyor.
    for (let masa = 474; masa <= 1200; masa++) {
      expect(perGenisligi(yanTasEni(masa), EN_UZUN_PER)).toBeLessThanOrEqual(
        yanPerAlaniEni(masa),
      );
    }
  });

  it('en dar desteklenen cihaz olan iPhone SE de sigdiriyor', () => {
    expect(masaEni(667, 0)).toBeGreaterThanOrEqual(474);
  });

  it('olcu sinirlarin disina cikmiyor', () => {
    for (let masa = 0; masa <= 1400; masa += 7) {
      const tas = yanTasEni(masa);
      expect(tas).toBeGreaterThanOrEqual(EN_AZ_TAS_EN);
      expect(tas).toBeLessThanOrEqual(EN_COK_YAN_TAS_EN);
    }
  });

  it('genis masada tavana oturuyor, dar masada kuculuyor', () => {
    expect(yanTasEni(masaEni(1133, 0))).toBe(EN_COK_YAN_TAS_EN);
    expect(yanTasEni(masaEni(667, 0))).toBeLessThan(EN_COK_YAN_TAS_EN);
  });

  it('masa henuz olculmemisken makul bir varsayilan veriyor', () => {
    // Ilk karede onLayout gelmemis olur; 0 ile cirkin bir siçrama olmasin.
    expect(yanTasEni(0)).toBe(EN_COK_YAN_TAS_EN);
  });
});

describe('merkez — deste ve atik obegi ezilmiyor', () => {
  it('iki yan sutundan sonra ortaya en az MERKEZ_EN_AZ kaliyor', () => {
    for (const { ekran, guvenli } of CIHAZLAR) {
      const masa = masaEni(ekran, guvenli);
      const ic = masa - 2 * MASA_DOLGU - 2 * ORTA_BOSLUK;
      expect(ic - 2 * yanSutunEni(masa)).toBeGreaterThanOrEqual(MERKEZ_EN_AZ);
    }
  });

  it('yan sutun serit + bosluk + per alani kadar', () => {
    const masa = masaEni(844, 94);
    expect(yanSutunEni(masa)).toBe(22 + 3 + yanPerAlaniEni(masa));
  });
});

describe('yatayTasEni — ust ve alt sirada iki uzun per yan yana', () => {
  it.each(CIHAZLAR)('$ad', ({ ekran, guvenli }) => {
    const masa = masaEni(ekran, guvenli);
    const tas = yatayTasEni(masa);
    const ikiPer = 2 * perGenisligi(tas, EN_UZUN_PER) + PER_ARASI;
    expect(ikiPer).toBeLessThanOrEqual(masa - 2 * MASA_DOLGU);
  });

  it('yan sutunlardan dar olmuyor — orada yer daha bol', () => {
    for (const { ekran, guvenli } of CIHAZLAR) {
      const masa = masaEni(ekran, guvenli);
      expect(yatayTasEni(masa)).toBeGreaterThanOrEqual(yanTasEni(masa));
    }
  });

  it('kendi perlerim eskisinden (20) kucuk', () => {
    // Sikayet: acilan perler cok yer kapliyor. Alt sira 'orta' (20) idi.
    expect(yatayTasEni(masaEni(844, 94))).toBeLessThan(OLCULER.orta.en);
    expect(yatayTasEni(masaEni(844, 94))).toBeLessThanOrEqual(EN_COK_YATAY_TAS_EN);
  });
});
