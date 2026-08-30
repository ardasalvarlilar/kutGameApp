import { describe, expect, it } from 'vitest';
import { normalTas, okeyTas, type Renk, type Sayi, type Tas } from '@kut/engine';
import { islenecekTaslar, kurulanPerTaslari } from './isleme';

const t = (renk: Renk, sayi: Sayi, kopya: 'a' | 'b' = 'a'): Tas => normalTas(renk, sayi, kopya);
const ok = (kopya: 'a' | 'b' = 'a'): Tas => okeyTas(kopya);
const id = (tas: Tas) => tas.id;

// `TAŞLARI İŞLE` bir kolaylik. Oyuncunun kurdugu seyi dagitmamali:
// okey yerdeki neredeyse her pere isledigi icin, kendi perindeki okeyi de
// yere gonderiyordu.

describe('kurulanPerTaslari', () => {
  const el = [t('kirmizi', 5), t('kirmizi', 6), t('kirmizi', 7), t('sari', 2), ok('a')];

  it('gecerli bir seri olusturan grup korunur', () => {
    const korunan = kurulanPerTaslari([[t('kirmizi', 5).id, t('kirmizi', 6).id, t('kirmizi', 7).id]], el);
    expect([...korunan].sort()).toEqual(
      [t('kirmizi', 5), t('kirmizi', 6), t('kirmizi', 7)].map(id).sort(),
    );
  });

  it('okeyli grup da per sayilir', () => {
    const korunan = kurulanPerTaslari([[t('kirmizi', 5).id, t('kirmizi', 6).id, ok('a').id]], el);
    expect(korunan.has(ok('a').id)).toBe(true);
  });

  it('uc tastan az grup korunmaz — per degil', () => {
    const korunan = kurulanPerTaslari([[t('kirmizi', 5).id, t('kirmizi', 6).id]], el);
    expect(korunan.size).toBe(0);
  });

  it('bitisik ama gecersiz grup korunmaz', () => {
    const korunan = kurulanPerTaslari([[t('kirmizi', 5).id, t('sari', 2).id, ok('a').id]], el);
    expect(korunan.size).toBe(0);
  });

  it('elde olmayan tas iceren grup atlanir', () => {
    const korunan = kurulanPerTaslari([[t('kirmizi', 5).id, t('kirmizi', 6).id, 'yok-boyle-tas']], el);
    expect(korunan.size).toBe(0);
  });
});

describe('islenecekTaslar', () => {
  // Elde: kurulmus bir seri (5-6-7), bir okey, ve bosta duran iki isler tas.
  const istakam = [
    t('kirmizi', 5), t('kirmizi', 6), t('kirmizi', 7),
    ok('a'),
    t('sari', 9), t('mavi', 4),
  ];
  const gruplar = [[t('kirmizi', 5).id, t('kirmizi', 6).id, t('kirmizi', 7).id]];
  // Motor hepsini isler sayiyor (okey her pere isler).
  const islerTaslarim = istakam.map(id);

  it('secim yoksa okey korunur — 25 puan, bilerek istenmeli', () => {
    const sonuc = islenecekTaslar({ secili: [], islerTaslarim, istakam, gruplar });
    expect(sonuc.gonderilecek).not.toContain(ok('a').id);
    expect(sonuc.korunan).toContain(ok('a').id);
  });

  it('secim yoksa kurulan perin taslari korunur', () => {
    const sonuc = islenecekTaslar({ secili: [], islerTaslarim, istakam, gruplar });
    for (const tas of [t('kirmizi', 5), t('kirmizi', 6), t('kirmizi', 7)]) {
      expect(sonuc.gonderilecek).not.toContain(id(tas));
      expect(sonuc.korunan).toContain(id(tas));
    }
  });

  it('bosta duran isler taslar gonderilir', () => {
    const sonuc = islenecekTaslar({ secili: [], islerTaslarim, istakam, gruplar });
    expect([...sonuc.gonderilecek].sort()).toEqual([t('sari', 9), t('mavi', 4)].map(id).sort());
  });

  it('secim VARSA oyuncunun niyeti aciktir — okey bile gider', () => {
    const sonuc = islenecekTaslar({
      secili: [ok('a').id, t('kirmizi', 5).id],
      islerTaslarim,
      istakam,
      gruplar,
    });
    expect(sonuc.gonderilecek).toEqual([ok('a').id, t('kirmizi', 5).id]);
    expect(sonuc.korunan).toEqual([]);
  });

  it('grup yoksa yalnizca okey korunur', () => {
    const sonuc = islenecekTaslar({ secili: [], islerTaslarim, istakam, gruplar: [] });
    expect(sonuc.korunan).toEqual([ok('a').id]);
    expect(sonuc.gonderilecek).toHaveLength(istakam.length - 1);
  });

  it('isler tas yoksa gonderilecek de yok', () => {
    const sonuc = islenecekTaslar({ secili: [], islerTaslarim: [], istakam, gruplar });
    expect(sonuc.gonderilecek).toEqual([]);
  });

  it('yalnizca okey islerse dugme bos calismaz', () => {
    // Bu durumda `gonderilecek` bos — ekran dugmeyi pasif tutuyor.
    const sonuc = islenecekTaslar({
      secili: [],
      islerTaslarim: [ok('a').id],
      istakam,
      gruplar,
    });
    expect(sonuc.gonderilecek).toEqual([]);
    expect(sonuc.korunan).toEqual([ok('a').id]);
  });

  it('elde olmayan isler kimlik sessizce atlanir', () => {
    const sonuc = islenecekTaslar({
      secili: [],
      islerTaslarim: ['hayalet', t('sari', 9).id],
      istakam,
      gruplar,
    });
    expect(sonuc.gonderilecek).toEqual([t('sari', 9).id]);
  });
});
