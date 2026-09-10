import { describe, expect, it } from 'vitest';
import { balonYerlesimi, karartmaParcalari, type Dikdortgen, type Olcu } from './yerlesim';

const EKRAN: Olcu = { en: 812, boy: 375 };
const BALON: Olcu = { en: 260, boy: 110 };

describe('karartmaParcalari', () => {
  const hedef: Dikdortgen = { x: 300, y: 150, en: 100, boy: 40 };
  const parcalar = karartmaParcalari(hedef, EKRAN);

  it('dort parca uretiyor', () => {
    expect(parcalar).toHaveLength(4);
  });

  it('hicbir parca hedefin uzerine binmiyor — delik acik kaliyor', () => {
    for (const parca of parcalar) {
      const yatayAyrik = parca.x + parca.en <= hedef.x || parca.x >= hedef.x + hedef.en;
      const dikeyAyrik = parca.y + parca.boy <= hedef.y || parca.y >= hedef.y + hedef.boy;
      expect(yatayAyrik || dikeyAyrik).toBe(true);
    }
  });

  it('ekranin tamamini kapatiyor — delik disinda bosluk yok', () => {
    const alan = parcalar.reduce((toplam, parca) => toplam + parca.en * parca.boy, 0);
    expect(alan).toBe(EKRAN.en * EKRAN.boy - hedef.en * hedef.boy);
  });

  it('kenardaki hedefte negatif olcu uretmiyor', () => {
    const kenar: Dikdortgen = { x: 0, y: 0, en: 120, boy: 30 };
    for (const parca of karartmaParcalari(kenar, EKRAN)) {
      expect(parca.en).toBeGreaterThanOrEqual(0);
      expect(parca.boy).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('balonYerlesimi', () => {
  it('yer varsa hedefin ALTINA koyuyor', () => {
    const hedef: Dikdortgen = { x: 300, y: 40, en: 100, boy: 30 };
    expect(balonYerlesimi(hedef, BALON, EKRAN).yon).toBe('alt');
  });

  it('alta sigmiyorsa USTE geciyor', () => {
    const hedef: Dikdortgen = { x: 300, y: 300, en: 100, boy: 40 };
    expect(balonYerlesimi(hedef, BALON, EKRAN).yon).toBe('ust');
  });

  // Yan paneldeki dugmeler ekranin sag kenarinda ve masa yatay: dikey yer
  // dar, balon sola gecmek zorunda.
  it('dikey yer yoksa SOLA geciyor', () => {
    const dar: Olcu = { en: 812, boy: 200 };
    const hedef: Dikdortgen = { x: 700, y: 70, en: 100, boy: 40 };
    expect(balonYerlesimi(hedef, BALON, dar).yon).toBe('sol');
  });

  it('balon ekran disina tasmiyor', () => {
    const kenarlar: readonly Dikdortgen[] = [
      { x: 0, y: 0, en: 60, boy: 20 },
      { x: 752, y: 0, en: 60, boy: 20 },
      { x: 0, y: 355, en: 60, boy: 20 },
      { x: 752, y: 355, en: 60, boy: 20 },
      { x: 380, y: 180, en: 40, boy: 20 },
    ];
    for (const hedef of kenarlar) {
      const yerlesim = balonYerlesimi(hedef, BALON, EKRAN);
      expect(yerlesim.x).toBeGreaterThanOrEqual(0);
      expect(yerlesim.y).toBeGreaterThanOrEqual(0);
      expect(yerlesim.x + BALON.en).toBeLessThanOrEqual(EKRAN.en);
      expect(yerlesim.y + BALON.boy).toBeLessThanOrEqual(EKRAN.boy);
    }
  });

  it('altta yer varken balon hedefin altinda kaliyor — ustunu ortmuyor', () => {
    const hedef: Dikdortgen = { x: 300, y: 40, en: 100, boy: 30 };
    const yerlesim = balonYerlesimi(hedef, BALON, EKRAN);
    expect(yerlesim.y).toBeGreaterThanOrEqual(hedef.y + hedef.boy);
  });

  it('hicbir yere sigmasa bile bir yerlesim donuyor', () => {
    const minik: Olcu = { en: 200, boy: 120 };
    const hedef: Dikdortgen = { x: 20, y: 20, en: 160, boy: 80 };
    const yerlesim = balonYerlesimi(hedef, BALON, minik);
    expect(['alt', 'ust', 'sol', 'sag']).toContain(yerlesim.yon);
    expect(Number.isFinite(yerlesim.x)).toBe(true);
    expect(Number.isFinite(yerlesim.y)).toBe(true);
  });
});
