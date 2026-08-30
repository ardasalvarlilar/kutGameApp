import { describe, expect, it } from 'vitest';
import { VARSAYILAN_AYARLAR, ayarlariBirlestir, type KuralAyarlari } from '../src/kurallar';
import {
  CALMA_CEZASI,
  KAZANAN_PUANI,
  elPuanla,
  macKazanani,
  macToplami,
  type ElSonucu,
  type PuanGirdisi,
} from '../src/puan';
import { oyuncuKaydiOlustur, type OyuncuId, type Tas, type TurNo } from '../src/tipler';
import { ok, t } from './yardimci';

// KURALLAR.md §8 — puanlama.

/** 13+13+13+13+12+12+12+12+11+9 = 120 */
const yuzYirmi: readonly Tas[] = [
  t('kirmizi', 13, 'a'), t('kirmizi', 13, 'b'), t('siyah', 13, 'a'), t('siyah', 13, 'b'),
  t('kirmizi', 12, 'a'), t('kirmizi', 12, 'b'), t('siyah', 12, 'a'), t('siyah', 12, 'b'),
  t('kirmizi', 11, 'a'), t('kirmizi', 9, 'a'),
];

function girdi(
  p: {
    tur?: TurNo;
    istakalar?: Partial<Record<OyuncuId, readonly Tas[]>>;
    acmisMi?: Partial<Record<OyuncuId, boolean>>;
    calinanSayisi?: Partial<Record<OyuncuId, number>>;
    islerTasSayisi?: Partial<Record<OyuncuId, number>>;
    ayarlar?: Partial<KuralAyarlari>;
  } = {},
): PuanGirdisi {
  return {
    tur: p.tur ?? 1,
    ayarlar: ayarlariBirlestir(p.ayarlar ?? {}),
    istakalar: oyuncuKaydiOlustur<readonly Tas[]>((o) => p.istakalar?.[o] ?? []),
    acmisMi: oyuncuKaydiOlustur((o) => p.acmisMi?.[o] ?? false),
    calinanSayisi: oyuncuKaydiOlustur((o) => p.calinanSayisi?.[o] ?? 0),
    islerTasSayisi: oyuncuKaydiOlustur((o) => p.islerTasSayisi?.[o] ?? 0),
  };
}

describe('KURALLAR.md §8 ornegi', () => {
  it('120 puanlik tas, hic acilamadi, 5 kez calindi → 265', () => {
    const sonuc = elPuanla(
      girdi({ istakalar: { 1: yuzYirmi }, calinanSayisi: { 1: 5 } }),
      'normal',
      0,
      false,
    );
    const detay = sonuc.detaylar[1];
    expect(detay.hamCeza).toBe(120);
    expect(detay.carpan).toBe(2);
    expect(detay.calmaCezasi).toBe(25);
    expect(detay.toplam).toBe(265);
  });

  it('ceza tasi puanlari carpana GIRMEZ', () => {
    const sonuc = elPuanla(
      girdi({ istakalar: { 1: yuzYirmi }, calinanSayisi: { 1: 5 } }),
      'normal',
      0,
      false,
    );
    // Carpana girseydi (120 + 25) * 2 = 290 olurdu.
    expect(sonuc.puanlar[1]).toBe(265);
    expect(sonuc.puanlar[1]).not.toBe(290);
  });
});

describe('carpanlar — dogru sirada', () => {
  it('acmis oyuncu ham cezasini yazar', () => {
    const sonuc = elPuanla(girdi({ istakalar: { 1: yuzYirmi }, acmisMi: { 1: true } }), 'normal', 0, false);
    expect(sonuc.puanlar[1]).toBe(120);
  });

  it('hic acamayan iki katini yazar', () => {
    const sonuc = elPuanla(girdi({ istakalar: { 1: yuzYirmi } }), 'normal', 0, false);
    expect(sonuc.puanlar[1]).toBe(240);
  });

  it('kazanan okeyle bittiyse iki kati', () => {
    const sonuc = elPuanla(
      girdi({ istakalar: { 1: yuzYirmi }, acmisMi: { 1: true } }),
      'normal',
      0,
      true,
    );
    expect(sonuc.puanlar[1]).toBe(240);
  });

  it('ikisi birden → ×4', () => {
    const sonuc = elPuanla(girdi({ istakalar: { 1: yuzYirmi } }), 'normal', 0, true);
    expect(sonuc.detaylar[1].carpan).toBe(4);
    expect(sonuc.puanlar[1]).toBe(480);
  });

  it('carpan once, calma cezasi sonra', () => {
    const sonuc = elPuanla(
      girdi({ istakalar: { 1: yuzYirmi }, calinanSayisi: { 1: 3 } }),
      'normal',
      0,
      true,
    );
    expect(sonuc.puanlar[1]).toBe(120 * 4 + 15);
  });

  it('elde kalan okey 25 puandir', () => {
    const sonuc = elPuanla(
      girdi({ istakalar: { 1: [ok('a'), t('mavi', 5)] }, acmisMi: { 1: true } }),
      'normal',
      0,
      false,
    );
    expect(sonuc.puanlar[1]).toBe(30);
  });
});

describe('kazanan — KURALLAR.md §8, §9.5 (karara baglandi)', () => {
  it('eli bitiren -100 alir', () => {
    const sonuc = elPuanla(girdi(), 'normal', 2, false);
    expect(sonuc.puanlar[2]).toBe(KAZANAN_PUANI);
    expect(KAZANAN_PUANI).toBe(-100);
  });

  it('kazanan da caldigi taslarin 5 puanini oder', () => {
    const sonuc = elPuanla(girdi({ calinanSayisi: { 2: 3 } }), 'normal', 2, false);
    expect(sonuc.puanlar[2]).toBe(-100 + 3 * CALMA_CEZASI);
    expect(sonuc.puanlar[2]).toBe(-85);
  });

  it('kural kapatilabilir', () => {
    const sonuc = elPuanla(
      girdi({ calinanSayisi: { 2: 3 }, ayarlar: { kazananCalmaCezasiOder: false } }),
      'normal',
      2,
      false,
    );
    expect(sonuc.puanlar[2]).toBe(-100);
  });

  it('kazananin elinde tas kalmadigi icin carpan islemez', () => {
    const sonuc = elPuanla(girdi(), 'normal', 2, true);
    expect(sonuc.detaylar[2].carpan).toBe(1);
  });
});

describe('tur 16 — KURALLAR.md §9.3 ve §9.7 (karara baglandi)', () => {
  it('kimse acmadigi icin bitiren disinda herkes iki kat yazar', () => {
    const sonuc = elPuanla(
      girdi({ tur: 16, istakalar: { 1: yuzYirmi, 2: [t('mavi', 5)], 3: [t('mavi', 6)] } }),
      'normal',
      0,
      false,
    );
    expect(sonuc.puanlar[0]).toBe(-100);
    expect(sonuc.puanlar[1]).toBe(240);
    expect(sonuc.puanlar[2]).toBe(10);
    expect(sonuc.puanlar[3]).toBe(12);
  });

  it('bitiren okeyi disari attiysa herkes dort kat yazar', () => {
    const sonuc = elPuanla(
      girdi({ tur: 16, istakalar: { 1: yuzYirmi, 2: [t('mavi', 5)] } }),
      'normal',
      0,
      true,
    );
    expect(sonuc.detaylar[1].carpan).toBe(4);
    expect(sonuc.puanlar[1]).toBe(480);
    expect(sonuc.puanlar[2]).toBe(20);
  });

  it('her iki carpan da parametriktir', () => {
    const sonuc = elPuanla(
      girdi({
        tur: 16,
        istakalar: { 1: yuzYirmi },
        ayarlar: { tur16AcamadiCarpani: false, tur16OkeyleBitmeCarpani: false },
      }),
      'normal',
      0,
      true,
    );
    expect(sonuc.detaylar[1].carpan).toBe(1);
    expect(sonuc.puanlar[1]).toBe(120);
  });
});

describe('deste tukenmesi — KURALLAR.md §7 ve §9.4 (karara baglandi)', () => {
  const durum = girdi({
    istakalar: { 0: [t('mavi', 10), t('mavi', 10, 'b')], 1: [t('mavi', 10), t('mavi', 10, 'b')] },
    acmisMi: { 0: true, 1: false },
    calinanSayisi: { 0: 2, 1: 0 },
  });

  it('kimse -100 almaz', () => {
    const sonuc = elPuanla(durum, 'deste-tukendi', null, false);
    expect(sonuc.kazanan).toBe(null);
    for (const puan of Object.values(sonuc.puanlar)) {
      expect(puan).toBeGreaterThanOrEqual(0);
    }
  });

  it('acan ham puanini, acamayan iki katini yazar', () => {
    const sonuc = elPuanla(durum, 'deste-tukendi', null, false);
    expect(sonuc.detaylar[0].hamCeza).toBe(20);
    expect(sonuc.detaylar[0].carpan).toBe(1);
    expect(sonuc.detaylar[1].carpan).toBe(2);
    expect(sonuc.puanlar[1]).toBe(40);
  });

  it('calma cezasi yine eklenir', () => {
    const sonuc = elPuanla(durum, 'deste-tukendi', null, false);
    expect(sonuc.puanlar[0]).toBe(20 + 2 * CALMA_CEZASI);
  });

  it('kazanan bildirilse bile yok sayilir', () => {
    const sonuc = elPuanla(durum, 'deste-tukendi', 0, true);
    expect(sonuc.kazanan).toBe(null);
    expect(sonuc.okeyleBitti).toBe(false);
  });
});

describe('mac toplami — KURALLAR.md §8', () => {
  function sonucKur(puanlar: Record<OyuncuId, number>): ElSonucu {
    return {
      tur: 1,
      bitisTipi: 'normal',
      kazanan: null,
      okeyleBitti: false,
      puanlar,
      detaylar: oyuncuKaydiOlustur((o) => ({
        hamCeza: puanlar[o],
        acamadiCarpani: false,
        okeyleBitmeCarpani: false,
        carpan: 1,
        calmaCezasi: 0,
        islerTasCezasi: 0,
        toplam: puanlar[o],
      })),
    };
  }

  it('16 turun puanlari toplanir', () => {
    // 600 ceza yedin ama 4 el kazandin → 600 - 400 = 200
    const eller: ElSonucu[] = [];
    for (let i = 0; i < 4; i++) eller.push(sonucKur({ 0: -100, 1: 0, 2: 0, 3: 0 }));
    for (let i = 0; i < 12; i++) eller.push(sonucKur({ 0: 50, 1: 10, 2: 0, 3: 0 }));

    const toplam = macToplami(eller);
    expect(toplam[0]).toBe(600 - 400);
    expect(toplam[1]).toBe(120);
  });

  it('en dusuk toplam kazanir', () => {
    expect(macKazanani({ 0: 200, 1: 120, 2: 500, 3: 300 })).toEqual([1]);
  });

  it('beraberlikte hepsi doner', () => {
    expect(macKazanani({ 0: 120, 1: 120, 2: 500, 3: 300 })).toEqual([0, 1]);
  });

  it('bos macin toplami sifirdir', () => {
    expect(macToplami([])).toEqual({ 0: 0, 1: 0, 2: 0, 3: 0 });
  });
});

describe('varsayilan ayarlar §9 kararlarini tasiyor', () => {
  it('yedi madde de kayitli', () => {
    expect(VARSAYILAN_AYARLAR).toEqual({
      talepPenceresiMs: 3000,
      // §9 0.4 — sira suresi kademeleri. Motorda sayac yok, yalnizca deger.
      siraSureleriMs: [30000, 20000, 10000],
      islerTasCezasi: 50,
      talepGorunurlugu: true,
      ciftCalmaHakki: true,
      kazananCalmaCezasiOder: true,
      desteTukendigindeKazananVar: false,
      desteTukendigindeCalmaCezasi: true,
      tur16AcamadiCarpani: true,
      tur16OkeyleBitmeCarpani: true,
    });
  });
});
