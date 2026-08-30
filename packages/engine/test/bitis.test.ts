import { describe, expect, it } from 'vitest';
import { reduce } from '../src/reduce';
import { dolgu, durumAl, durumKur, idler, ok, t, yerPeri } from './yardimci';

// KURALLAR.md §7 — el bitisi.

describe('normal bitis — son tasi ortaya atmak', () => {
  const sonTas = t('kirmizi', 5);

  it('elindeki son tasi atan oyuncu eli bitirir', () => {
    const durum = durumKur({
      tur: 1,
      siradaki: 0,
      faz: 'atma',
      istakalar: { 0: [sonTas], 1: [t('mavi', 3)], 2: [t('mavi', 4)], 3: [t('mavi', 6)] },
      acmisMi: { 0: true },
    });
    const sonra = durumAl(reduce(durum, { tip: 'AT', oyuncu: 0, tasId: sonTas.id, suAn: 100 }));

    expect(sonra.faz).toBe('el-bitti');
    expect(sonra.sonuc?.kazanan).toBe(0);
    expect(sonra.sonuc?.bitisTipi).toBe('normal');
    expect(sonra.sonuc?.puanlar[0]).toBe(-100);
  });

  it('okeyle bitti = ortaya atilan son tasin okey olmasi', () => {
    const durum = durumKur({
      tur: 1,
      siradaki: 0,
      faz: 'atma',
      istakalar: { 0: [ok('a')], 1: [t('mavi', 3)] },
      acmisMi: { 0: true, 1: true },
    });
    const sonra = durumAl(reduce(durum, { tip: 'AT', oyuncu: 0, tasId: ok('a').id, suAn: 100 }));

    expect(sonra.sonuc?.okeyleBitti).toBe(true);
    // 1 numarali acmisti: yalnizca okey carpani isler.
    expect(sonra.sonuc?.puanlar[1]).toBe(6);
  });

  it('perde okey kullanmis olmak "okeyle bitti" saymaz', () => {
    const durum = durumKur({
      tur: 1,
      siradaki: 0,
      faz: 'atma',
      yer: [yerPeri(1, 0, 'kut', [t('kirmizi', 7), t('siyah', 7), ok('a')])],
      istakalar: { 0: [t('kirmizi', 5)], 1: [t('mavi', 3)] },
      acmisMi: { 0: true, 1: true },
    });
    const sonra = durumAl(
      reduce(durum, { tip: 'AT', oyuncu: 0, tasId: t('kirmizi', 5).id, suAn: 100 }),
    );
    expect(sonra.sonuc?.okeyleBitti).toBe(false);
    expect(sonra.sonuc?.puanlar[1]).toBe(3);
  });

  it('el bittikten sonra hicbir aksiyon kabul edilmez', () => {
    const durum = durumKur({
      tur: 1, siradaki: 0, faz: 'atma', istakalar: { 0: [t('kirmizi', 5)] }, acmisMi: { 0: true },
    });
    const bitti = durumAl(reduce(durum, { tip: 'AT', oyuncu: 0, tasId: t('kirmizi', 5).id, suAn: 100 }));
    const sonuc = reduce(bitti, { tip: 'CEK_DESTEDEN', oyuncu: 1, suAn: 9999 });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('el-bitti');
  });
});

describe('tur 16 — elden bitme, KURALLAR.md §3', () => {
  const k7 = t('kirmizi', 7);
  const s7 = t('siyah', 7);
  const m7 = t('mavi', 7);
  const k9 = t('kirmizi', 9);
  const s9 = t('siyah', 9);
  const m9 = t('mavi', 9);
  const k11 = t('kirmizi', 11);
  const s11 = t('siyah', 11);
  const m11 = t('mavi', 11);
  const seri = [1, 2, 3, 4, 5].map((sayi) => t('sari', sayi as 1));
  const atilan = t('mavi', 13);
  const el = [k7, s7, m7, k9, s9, m9, k11, s11, m11, ...seri, atilan];

  const perler = [idler([k7, s7, m7]), idler([k9, s9, m9]), idler([k11, s11, m11]), idler(seri)];

  function tur16Durumu(ekler: Parameters<typeof durumKur>[0] = {}) {
    return durumKur({
      tur: 16,
      siradaki: 0,
      faz: 'atma',
      istakalar: { 0: el, 1: [t('mavi', 4)], 2: [t('mavi', 6)], 3: [t('mavi', 8)] },
      ...ekler,
    });
  }

  it('tum el gecerli perlere bolunur, artan tek tas atilir', () => {
    const sonra = durumAl(
      reduce(tur16Durumu(), { tip: 'BITIR_ELDEN', oyuncu: 0, perler, atilanTasId: atilan.id, suAn: 0 }),
    );
    expect(sonra.faz).toBe('el-bitti');
    expect(sonra.sonuc?.kazanan).toBe(0);
    expect(sonra.istakalar[0]).toHaveLength(0);
    expect(sonra.atikYiginlari[0].map((tas) => tas.id)).toEqual([atilan.id]);
  });

  it('per kompozisyonu serbesttir — dort uclu seri + bir dortlu kut da olur', () => {
    const seriler = [
      [t('kirmizi', 1), t('kirmizi', 2), t('kirmizi', 3)],
      [t('siyah', 1), t('siyah', 2), t('siyah', 3)],
      [t('mavi', 1), t('mavi', 2), t('mavi', 3)],
      [t('sari', 1), t('sari', 2), t('sari', 3)],
    ];
    const kut = [t('kirmizi', 8), t('siyah', 8), t('mavi', 8), t('sari', 8)];
    const son = t('mavi', 12);
    const durum = tur16Durumu({ istakalar: { 0: [...seriler.flat(), ...kut, son] } });

    const sonra = durumAl(
      reduce(durum, {
        tip: 'BITIR_ELDEN',
        oyuncu: 0,
        perler: [...seriler.map(idler), idler(kut)],
        atilanTasId: son.id,
        suAn: 0,
      }),
    );
    expect(sonra.sonuc?.kazanan).toBe(0);
  });

  it('geriye tam olarak 1 tas kalmali', () => {
    const eksik = [idler([k7, s7, m7]), idler([k9, s9, m9]), idler([k11, s11, m11])];
    const sonuc = reduce(tur16Durumu(), {
      tip: 'BITIR_ELDEN', oyuncu: 0, perler: eksik, atilanTasId: atilan.id, suAn: 0,
    });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('artan-tas-bir-olmali');
  });

  it('gecersiz per ile bitirilemez', () => {
    const bozuk = [idler([k7, s7, k9]), idler([m7, s9, m9]), idler([k11, s11, m11]), idler(seri)];
    const sonuc = reduce(tur16Durumu(), {
      tip: 'BITIR_ELDEN', oyuncu: 0, perler: bozuk, atilanTasId: atilan.id, suAn: 0,
    });
    expect(sonuc.ok).toBe(false);
  });

  it('ayni tas iki perde kullanilamaz', () => {
    const tekrarli = [idler([k7, s7, m7]), idler([k7, s9, m9]), idler([k11, s11, m11]), idler(seri)];
    const sonuc = reduce(tur16Durumu(), {
      tip: 'BITIR_ELDEN', oyuncu: 0, perler: tekrarli, atilanTasId: atilan.id, suAn: 0,
    });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('tekrarli-tas');
  });

  it('tur 16da yere hic per inmez', () => {
    const sonra = durumAl(
      reduce(tur16Durumu(), { tip: 'BITIR_ELDEN', oyuncu: 0, perler, atilanTasId: atilan.id, suAn: 0 }),
    );
    expect(sonra.yer).toHaveLength(0);
    expect(sonra.acmisMi[0]).toBe(false);
  });

  it('elden bitme yalnizca tur 16da gecerlidir', () => {
    const sonuc = reduce(tur16Durumu({ tur: 1 }), {
      tip: 'BITIR_ELDEN', oyuncu: 0, perler, atilanTasId: atilan.id, suAn: 0,
    });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('sadece-tur-16');
  });

  it('tur 16da tas calma aynen gecerlidir', () => {
    const calinacak = t('kirmizi', 3);
    const durum = durumKur({
      tur: 16,
      siradaki: 3,
      faz: 'cekme',
      istakalar: {
        0: dolgu(13, [calinacak], 0),
        1: dolgu(14, [calinacak], 13),
        2: dolgu(14, [calinacak], 27),
        3: dolgu(14, [calinacak], 41),
      },
      atikYiginlari: { 0: [calinacak] },
      deste: dolgu(6, [calinacak], 55),
      pencere: { atan: 0, tasId: calinacak.id, acilisZamani: 0, talepler: [], ciftTalebi: null },
    });
    const talep = durumAl(reduce(durum, { tip: 'CALMA_TALEBI', oyuncu: 2, suAn: 100 }));
    const sonra = durumAl(reduce(talep, { tip: 'CEK_DESTEDEN', oyuncu: 3, suAn: 5000 }));

    expect(sonra.istakalar[2]).toHaveLength(16);
    expect(sonra.calinanSayisi[2]).toBe(1);
  });
});
