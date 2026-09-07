import { describe, expect, it } from 'vitest';
import type { Aksiyon } from '../src/aksiyonlar';
import {
  BASLAYAN_DAGITIM,
  DAGITIM_SONRASI_DESTE,
  NORMAL_DAGITIM,
  elBaslat,
  sonrakiBaslayan,
} from '../src/durum';
import { reduce } from '../src/reduce';
import { OYUNCULAR } from '../src/tipler';
import { dolgu, durumAl, durumKur, pencereKur, t } from './yardimci';

describe('dagitim — KURALLAR.md §1', () => {
  const durum = elBaslat({ tur: 1, baslayan: 2, tohum: 4242 });

  it('baslayana 15, digerlerine 14 tas', () => {
    expect(durum.istakalar[2]).toHaveLength(BASLAYAN_DAGITIM);
    for (const oyuncu of OYUNCULAR) {
      if (oyuncu === 2) continue;
      expect(durum.istakalar[oyuncu]).toHaveLength(NORMAL_DAGITIM);
    }
  });

  it('dagitimdan sonra destede 49 tas kalir', () => {
    expect(durum.deste).toHaveLength(DAGITIM_SONRASI_DESTE);
    expect(106 - 57).toBe(DAGITIM_SONRASI_DESTE);
  });

  it('hicbir tas kaybolmaz ya da cogalmaz', () => {
    const tumIdler = [
      ...durum.deste,
      ...OYUNCULAR.flatMap((oyuncu) => [...durum.istakalar[oyuncu]]),
    ].map((tas) => tas.id);
    expect(tumIdler).toHaveLength(106);
    expect(new Set(tumIdler).size).toBe(106);
  });

  it('baslayan cekmeden atar: faz `atma` ile baslar', () => {
    expect(durum.siradaki).toBe(2);
    expect(durum.faz).toBe('atma');
  });

  it('ayni tohum ayni dagitimi verir', () => {
    const iki = elBaslat({ tur: 1, baslayan: 2, tohum: 4242 });
    expect(iki.istakalar[0].map((tas) => tas.id)).toEqual(
      durum.istakalar[0].map((tas) => tas.id),
    );
  });

  it('her el baslayan bir sonrakine gecer — oyun yonunde', () => {
    expect(sonrakiBaslayan(0)).toBe(3);
    expect(sonrakiBaslayan(3)).toBe(2);
  });

  it('gosterge yoktur: hicbir tas acik durmaz', () => {
    for (const oyuncu of OYUNCULAR) {
      expect(durum.atikYiginlari[oyuncu]).toHaveLength(0);
    }
    expect(durum.yer).toHaveLength(0);
  });
});

describe('sira akisi — KURALLAR.md §4', () => {
  const atilan = t('kirmizi', 9);
  const elde = [atilan, ...dolgu(4, [atilan])];

  function tekOyunculuDurum() {
    return durumKur({ siradaki: 0, faz: 'atma', istakalar: { 0: elde }, deste: dolgu(5, elde) });
  }

  it('sirasi olmayan oyuncu hamle yapamaz', () => {
    const sonuc = reduce(tekOyunculuDurum(), { tip: 'AT', oyuncu: 1, tasId: atilan.id, suAn: 0 });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('sira-sende-degil');
  });

  it('cekmeden atilamaz', () => {
    const durum = durumKur({ siradaki: 1, faz: 'cekme', istakalar: { 1: elde } });
    const sonuc = reduce(durum, { tip: 'AT', oyuncu: 1, tasId: atilan.id, suAn: 0 });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('once-cekmelisin');
  });

  it('iki kez cekilemez', () => {
    const durum = tekOyunculuDurum();
    const sonuc = reduce(durum, { tip: 'CEK_DESTEDEN', oyuncu: 0, suAn: 9999 });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('zaten-cektin');
  });

  it('elde olmayan tas atilamaz', () => {
    const sonuc = reduce(tekOyunculuDurum(), {
      tip: 'AT',
      oyuncu: 0,
      tasId: t('sari', 2).id,
      suAn: 0,
    });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('tas-elinde-yok');
  });

  it('atilan tas atanin yiginina gider, sira sonrakine gecer', () => {
    const durum = durumAl(
      reduce(tekOyunculuDurum(), { tip: 'AT', oyuncu: 0, tasId: atilan.id, suAn: 1000 }),
    );
    expect(durum.atikYiginlari[0].map((tas) => tas.id)).toEqual([atilan.id]);
    expect(durum.istakalar[0]).toHaveLength(4);
    // KURALLAR.md §4: oyun saat yonunde doner, tasi atanin SAGINDAKI alir.
    expect(durum.siradaki).toBe(3);
    expect(durum.faz).toBe('cekme');
    expect(durum.pencere?.tasId).toBe(atilan.id);
  });

  it('atanin sagindaki oyuncu o yigindan bedelsiz alir', () => {
    const durum = durumKur({
      siradaki: 3,
      faz: 'cekme',
      istakalar: { 3: dolgu(14) },
      atikYiginlari: { 0: [atilan] },
      pencere: pencereKur(0, atilan),
    });
    const sonra = durumAl(reduce(durum, { tip: 'CEK_ATIKTAN', oyuncu: 3, suAn: 10 }));
    expect(sonra.istakalar[3]).toHaveLength(15);
    expect(sonra.atikYiginlari[0]).toHaveLength(0);
    expect(sonra.faz).toBe('atma');
  });

  it('101deki "aldiysan acmak zorundasin" sarti yok — alan oyuncu normal devam eder', () => {
    const durum = durumKur({
      siradaki: 3,
      faz: 'cekme',
      istakalar: { 3: [...dolgu(14, [atilan])] },
      atikYiginlari: { 0: [atilan] },
      pencere: pencereKur(0, atilan),
    });
    const alindi = durumAl(reduce(durum, { tip: 'CEK_ATIKTAN', oyuncu: 3, suAn: 10 }));
    const attiktan = reduce(alindi, {
      tip: 'AT',
      oyuncu: 3,
      tasId: alindi.istakalar[3][0]!.id,
      suAn: 20,
    });
    expect(attiktan.ok).toBe(true);
  });
});

describe('talep penceresi — KURALLAR.md §5, §9 0.9 (suresiz)', () => {
  const atilan = t('kirmizi', 9);
  const durum = durumKur({
    siradaki: 3,
    faz: 'cekme',
    istakalar: {
      1: dolgu(14, [atilan], 20),
      2: dolgu(14, [atilan], 40),
      3: dolgu(14, [atilan], 60),
    },
    atikYiginlari: { 0: [atilan] },
    deste: dolgu(5, [atilan]),
    pencere: pencereKur(0, atilan),
  });

  const cek = (suAn: number): Aksiyon => ({ tip: 'CEK_DESTEDEN', oyuncu: 3, suAn });

  it('sirasi gelen oyuncu BEKLEMEZ: tas atilir atilmaz desteden cekebilir', () => {
    // §9 0.9 oncesinde burada 3000 ms'lik bir sayac vardi ve bu cagri
    // `pencere-suresi-dolmadi` ile reddediliyordu.
    expect(reduce(durum, cek(0)).ok).toBe(true);
  });

  it('yerden alma da beklemez', () => {
    expect(reduce(durum, { tip: 'CEK_ATIKTAN', oyuncu: 3, suAn: 0 }).ok).toBe(true);
  });

  it('pencere, sirasi gelen oyuncu OYNAYANA KADAR aciktir', () => {
    // Sirasi gelen dusunurken talep gelebilir; sure siniri yok.
    const talepli = durumAl(reduce(durum, { tip: 'CALMA_TALEBI', oyuncu: 2, suAn: 90_000 }));
    expect(talepli.pencere?.talepler).toEqual([2]);

    const sonra = durumAl(reduce(talepli, cek(90_100)));
    expect(sonra.istakalar[2].map((tas) => tas.id)).toContain(atilan.id);
    expect(sonra.pencere).toBe(null);
  });

  it('sirasi gelen oynadiktan sonra talep edilemez — pencere kapandi', () => {
    const sonra = durumAl(reduce(durum, cek(0)));
    const gec = reduce(sonra, { tip: 'CALMA_TALEBI', oyuncu: 2, suAn: 10 });
    expect(gec.ok ? 'ok' : gec.reason).toBe('talep-penceresi-kapali');
  });

  it('talep edilmemis tas yerde kalir', () => {
    const sonra = durumAl(reduce(durum, cek(0)));
    expect(sonra.atikYiginlari[0].map((tas) => tas.id)).toEqual([atilan.id]);
  });
});

describe('deste tukenmesi — KURALLAR.md §7', () => {
  it('cekilecek tas kalmayinca el kimse bitirmeden kapanir', () => {
    const durum = durumKur({
      siradaki: 3,
      faz: 'cekme',
      istakalar: { 0: [t('mavi', 5)], 1: [t('mavi', 6)], 2: [t('mavi', 7)], 3: [t('mavi', 8)] },
      deste: [],
      atikYiginlari: { 0: [t('kirmizi', 9)] },
      pencere: pencereKur(0, t('kirmizi', 9)),
    });
    const sonra = durumAl(reduce(durum, { tip: 'CEK_DESTEDEN', oyuncu: 3, suAn: 5000 }));
    expect(sonra.faz).toBe('el-bitti');
    expect(sonra.sonuc?.bitisTipi).toBe('deste-tukendi');
    expect(sonra.sonuc?.kazanan).toBe(null);
  });

  it('atik yiginlari karilip desteye geri KONMAZ', () => {
    const durum = durumKur({
      siradaki: 3,
      faz: 'cekme',
      deste: [],
      istakalar: { 3: [t('mavi', 6)] },
      atikYiginlari: { 0: dolgu(20) },
      pencere: pencereKur(0, dolgu(20)[19]!),
    });
    const sonra = durumAl(reduce(durum, { tip: 'CEK_DESTEDEN', oyuncu: 3, suAn: 5000 }));
    expect(sonra.deste).toHaveLength(0);
    expect(sonra.faz).toBe('el-bitti');
  });
});
