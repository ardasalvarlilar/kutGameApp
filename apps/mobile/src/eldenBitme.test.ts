import { describe, expect, it } from 'vitest';
import { normalTas, okeyTas, reduce, type Renk, type Sayi, type Tas } from '@kut/engine';
import { bitirenTaslar, eldenBitmeCozumu, perlereBol } from './eldenBitme';

const t = (renk: Renk, sayi: Sayi, kopya: 'a' | 'b' = 'a'): Tas => normalTas(renk, sayi, kopya);
const ok = (kopya: 'a' | 'b' = 'a'): Tas => okeyTas(kopya);

// KURALLAR.md §3, tur 16 — yere hic per inmez. Butun el gecerli perlere
// bolunur, geriye tek tas kalir, o atilarak bitilir.

describe('perlereBol', () => {
  it('bos girdi bos bolme', () => {
    expect(perlereBol([])).toEqual([]);
  });

  it('ucten az tas bolunemez', () => {
    expect(perlereBol([t('kirmizi', 5), t('kirmizi', 6)])).toBeNull();
  });

  it('tek seri', () => {
    const bolme = perlereBol([t('kirmizi', 5), t('kirmizi', 6), t('kirmizi', 7)]);
    expect(bolme).toHaveLength(1);
  });

  it('tek kut', () => {
    const bolme = perlereBol([t('kirmizi', 3), t('siyah', 3), t('mavi', 3)]);
    expect(bolme).toHaveLength(1);
  });

  it('4+4+3+3 — kullanicinin tarif ettigi dagilim', () => {
    const el = [
      t('kirmizi', 5), t('kirmizi', 6), t('kirmizi', 7), t('kirmizi', 8),
      t('mavi', 9), t('mavi', 10), t('mavi', 11), t('mavi', 12),
      t('sari', 3), t('siyah', 3), t('mavi', 3),
      t('kirmizi', 1), t('siyah', 1), t('mavi', 1),
    ];
    const bolme = perlereBol(el);
    expect(bolme).not.toBeNull();
    expect(bolme!.flat()).toHaveLength(14);
    expect(bolme!.every((per) => per.length >= 3)).toBe(true);
  });

  it('3+3+3+3+2 bolunemez — artan iki tas per degil', () => {
    const el = [
      t('kirmizi', 5), t('kirmizi', 6), t('kirmizi', 7),
      t('mavi', 9), t('mavi', 10), t('mavi', 11),
      t('sari', 3), t('siyah', 3), t('mavi', 3),
      t('kirmizi', 1), t('siyah', 1), t('mavi', 1),
      t('sari', 8), t('sari', 9),
    ];
    expect(perlereBol(el)).toBeNull();
  });

  it('okey bolmede kullanilabilir', () => {
    const el = [t('kirmizi', 5), t('kirmizi', 6), ok('a')];
    expect(perlereBol(el)).not.toBeNull();
  });

  it('bolme taslari ne kaybediyor ne cogaltiyor', () => {
    const el = [
      t('kirmizi', 5), t('kirmizi', 6), t('kirmizi', 7),
      t('sari', 3), t('siyah', 3), t('mavi', 3),
    ];
    const bolme = perlereBol(el)!;
    const kimlikler = bolme.flat().map((tas) => tas.id).sort();
    expect(kimlikler).toEqual(el.map((tas) => tas.id).sort());
  });
});

describe('eldenBitmeCozumu', () => {
  // 15 tas: 14'u perlere giriyor, sari13 atilacak.
  const el = [
    t('kirmizi', 5), t('kirmizi', 6), t('kirmizi', 7), t('kirmizi', 8),
    t('mavi', 9), t('mavi', 10), t('mavi', 11), t('mavi', 12),
    t('sari', 3), t('siyah', 3), t('mavi', 3),
    t('kirmizi', 1), t('siyah', 1), t('mavi', 1),
    t('sari', 13),
  ];

  it('dogru tas atilinca cozum buluyor', () => {
    const cozum = eldenBitmeCozumu(el, t('sari', 13).id);
    expect(cozum).not.toBeNull();
    expect(cozum!.atilanTasId).toBe(t('sari', 13).id);
    expect(cozum!.perler.flat()).toHaveLength(14);
  });

  it('perin icinden tas atilirsa cozum yok', () => {
    expect(eldenBitmeCozumu(el, t('kirmizi', 5).id)).toBeNull();
  });

  it('elde olmayan tas icin null', () => {
    expect(eldenBitmeCozumu(el, 'hayalet-tas')).toBeNull();
  });

  it('bulunan perlerin hepsi en az uc tas ve tekrar yok', () => {
    const cozum = eldenBitmeCozumu(el, t('sari', 13).id)!;
    expect(cozum.perler.every((per) => per.length >= 3)).toBe(true);
    expect(new Set(cozum.perler.flat()).size).toBe(14);
  });
});

describe('bitirenTaslar', () => {
  it('yalnizca dogru tasi isaretliyor', () => {
    const el = [
      t('kirmizi', 5), t('kirmizi', 6), t('kirmizi', 7),
      t('sari', 3), t('siyah', 3), t('mavi', 3),
      t('sari', 13),
    ];
    expect(bitirenTaslar(el)).toEqual([t('sari', 13).id]);
  });

  it('el bitmiyorsa bos liste', () => {
    const el = [
      t('kirmizi', 5), t('kirmizi', 6), t('kirmizi', 7),
      t('sari', 8), t('sari', 9),
    ];
    expect(bitirenTaslar(el)).toEqual([]);
  });

  it('birden cok tas bitirebiliyorsa hepsi', () => {
    // Dortlu kutten biri cikarsa da uclu kut kalir: dordu de bitirir.
    const el = [
      t('kirmizi', 5), t('kirmizi', 6), t('kirmizi', 7),
      t('sari', 3), t('siyah', 3), t('mavi', 3), t('kirmizi', 3),
    ];
    expect(bitirenTaslar(el).length).toBeGreaterThan(1);
  });
});

describe('motor cozumu kabul ediyor', () => {
  it('BITIR_ELDEN gecerli sayiliyor ve el bitiyor', () => {
    const el = [
      t('kirmizi', 5), t('kirmizi', 6), t('kirmizi', 7), t('kirmizi', 8),
      t('mavi', 9), t('mavi', 10), t('mavi', 11), t('mavi', 12),
      t('sari', 3), t('siyah', 3), t('mavi', 3),
      t('kirmizi', 1), t('siyah', 1), t('mavi', 1),
      t('sari', 13),
    ];
    const cozum = eldenBitmeCozumu(el, t('sari', 13).id)!;

    const bosKayit = { 0: [] as readonly Tas[], 1: [], 2: [], 3: [] };
    const durum = {
      ayarlar: { talepPenceresiMs: 3000, siraSureleriMs: [30000], islerTasCezasi: 50,
        talepGorunurlugu: true, ciftCalmaHakki: true, kazananCalmaCezasiOder: true,
        desteTukendigindeKazananVar: false, desteTukendigindeCalmaCezasi: true,
        tur16AcamadiCarpani: true, tur16OkeyleBitmeCarpani: true },
      tur: 16 as const, baslayan: 0 as const, siradaki: 0 as const, faz: 'atma' as const,
      deste: [], istakalar: { ...bosKayit, 0: el },
      atikYiginlari: bosKayit, atikSirasi: [], yer: [], sonrakiPerId: 1,
      acmisMi: { 0: false, 1: false, 2: false, 3: false },
      acilisHamlesi: { 0: null, 1: null, 2: null, 3: null },
      hamleSayisi: { 0: 0, 1: 0, 2: 0, 3: 0 },
      calinanSayisi: { 0: 0, 1: 0, 2: 0, 3: 0 },
      islerTasSayisi: { 0: 0, 1: 0, 2: 0, 3: 0 },
      pencere: null, sonuc: null,
    };

    const sonuc = reduce(durum as never, {
      tip: 'BITIR_ELDEN', oyuncu: 0, perler: cozum.perler,
      atilanTasId: cozum.atilanTasId, suAn: 0,
    });
    expect(sonuc.ok).toBe(true);
    if (!sonuc.ok) return;
    expect(sonuc.state.faz).toBe('el-bitti');
    expect(sonuc.state.sonuc?.kazanan).toBe(0);
    expect(sonuc.state.sonuc?.puanlar[0]).toBe(-100);
  });
});
