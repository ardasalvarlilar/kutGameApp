import { describe, expect, it } from 'vitest';
import { viewFor } from '../src/gorunum';
import { islerMi, pereIsle, type Per } from '../src/per';
import { elPuanla } from '../src/puan';
import { reduce } from '../src/reduce';
import { ayarlariBirlestir } from '../src/kurallar';
import { oyuncuKaydiOlustur, type OyuncuId, type Tas } from '../src/tipler';
import { dolgu, durumAl, durumKur, ok, t, yerPeri } from './yardimci';

// KURALLAR.md §8 — isler tas atma cezasi.
// Yerdeki bir pere islenebilecek tasi atan oyuncu 50 puan yazar.

const k7 = t('kirmizi', 7);
const k8 = t('kirmizi', 8);
const k9 = t('kirmizi', 9);
const k10 = t('kirmizi', 10);
const k6 = t('kirmizi', 6);
const m2 = t('mavi', 2);

const seri = yerPeri(1, 1, 'seri', [k7, k8, k9]);
const ucluKut = yerPeri(2, 1, 'kut', [t('kirmizi', 5), t('siyah', 5), t('mavi', 5)]);
const dortluKut = yerPeri(3, 1, 'kut', [
  t('kirmizi', 3), t('siyah', 3), t('mavi', 3), t('sari', 3),
]);

function masaKur(el: readonly Tas[], ekler: Parameters<typeof durumKur>[0] = {}) {
  return durumKur({
    tur: 1,
    siradaki: 0,
    faz: 'atma',
    yer: [seri],
    sonrakiPerId: 4,
    istakalar: { 0: [...el, ...dolgu(4, [...el, k7, k8, k9, k10, k6, m2], 0)] },
    ...ekler,
  });
}

describe('isler tas tespiti', () => {
  it('seriyi uzatan tas islerdir', () => {
    expect(islerMi(k10, [seri])).toBe(true);
    expect(islerMi(k6, [seri])).toBe(true);
  });

  it('islemeyen tas isler degildir', () => {
    expect(islerMi(m2, [seri])).toBe(false);
  });

  it('uclu kute dorduncu renk islerdir', () => {
    expect(islerMi(t('sari', 5), [ucluKut])).toBe(true);
  });

  it('dortlu kut doludur — hicbir tas islemez', () => {
    expect(islerMi(t('kirmizi', 3, 'b'), [dortluKut])).toBe(false);
    expect(islerMi(ok('a'), [dortluKut])).toBe(false);
  });

  it('yer bosken hicbir tas isler degildir', () => {
    expect(islerMi(k10, [])).toBe(false);
  });

  it('okey de isler tas olabilir', () => {
    expect(islerMi(ok('a'), [seri])).toBe(true);
  });
});

describe('isler tas atma — KURALLAR.md §8', () => {
  it('isleyen tasi atan oyuncunun sayaci artar', () => {
    const sonra = durumAl(
      reduce(masaKur([k10]), { tip: 'AT', oyuncu: 0, tasId: k10.id, suAn: 100 }),
    );
    expect(sonra.islerTasSayisi[0]).toBe(1);
  });

  it('islemeyen tasi atmak ceza getirmez', () => {
    const sonra = durumAl(
      reduce(masaKur([m2]), { tip: 'AT', oyuncu: 0, tasId: m2.id, suAn: 100 }),
    );
    expect(sonra.islerTasSayisi[0]).toBe(0);
  });

  it('baskasinin perine isleyen tas da ceza getirir', () => {
    // Yerdeki seri 1 numaraliya ait; ceza yine ATAN oyuncuya yazilir.
    const sonra = durumAl(
      reduce(masaKur([k10]), { tip: 'AT', oyuncu: 0, tasId: k10.id, suAn: 100 }),
    );
    expect(sonra.islerTasSayisi[0]).toBe(1);
    expect(sonra.islerTasSayisi[1]).toBe(0);
  });

  it('acmamis oyuncu da ceza yer', () => {
    const durum = masaKur([k10], { acmisMi: { 0: false } });
    const sonra = durumAl(reduce(durum, { tip: 'AT', oyuncu: 0, tasId: k10.id, suAn: 100 }));
    expect(sonra.islerTasSayisi[0]).toBe(1);
  });

  it('ustuste atarsa sayac birikir', () => {
    let durum = masaKur([k10, k6]);
    durum = durumAl(reduce(durum, { tip: 'AT', oyuncu: 0, tasId: k10.id, suAn: 100 }));
    // Sira donsun: 3 → 2 → 1 → 0
    durum = { ...durum, siradaki: 0, faz: 'atma', pencere: null };
    durum = durumAl(reduce(durum, { tip: 'AT', oyuncu: 0, tasId: k6.id, suAn: 200 }));
    expect(durum.islerTasSayisi[0]).toBe(2);
  });

  it('kural kapatilabilir', () => {
    const durum = masaKur([k10], { ayarlar: { islerTasCezasi: 0 } });
    const sonra = durumAl(reduce(durum, { tip: 'AT', oyuncu: 0, tasId: k10.id, suAn: 100 }));
    expect(sonra.islerTasSayisi[0]).toBe(0);
  });

  it('tur 16da yere per inmedigi icin isler tas olmaz', () => {
    const durum = masaKur([k10], { tur: 16, yer: [] });
    const sonra = durumAl(reduce(durum, { tip: 'AT', oyuncu: 0, tasId: k10.id, suAn: 100 }));
    expect(sonra.islerTasSayisi[0]).toBe(0);
  });
});

describe('isler tas puani — KURALLAR.md §8', () => {
  const yuzYirmi: readonly Tas[] = [
    t('kirmizi', 13, 'a'), t('kirmizi', 13, 'b'), t('siyah', 13, 'a'), t('siyah', 13, 'b'),
    t('kirmizi', 12, 'a'), t('kirmizi', 12, 'b'), t('siyah', 12, 'a'), t('siyah', 12, 'b'),
    t('kirmizi', 11, 'a'), t('kirmizi', 9, 'a'),
  ];

  function girdi(islerSayisi: number, calis = 0) {
    return {
      tur: 1 as const,
      ayarlar: ayarlariBirlestir({}),
      istakalar: oyuncuKaydiOlustur<readonly Tas[]>((o) => (o === 1 ? yuzYirmi : [])),
      acmisMi: oyuncuKaydiOlustur(() => false),
      calinanSayisi: oyuncuKaydiOlustur((o) => (o === 1 ? calis : 0)),
      islerTasSayisi: oyuncuKaydiOlustur((o: OyuncuId) => (o === 1 ? islerSayisi : 0)),
    };
  }

  it('her isler tas 50 puandir', () => {
    const sonuc = elPuanla(girdi(1), 'normal', 0, false);
    expect(sonuc.detaylar[1].islerTasCezasi).toBe(50);
  });

  it('carpana GIRMEZ — en sonda eklenir', () => {
    // 120 × 2 (acamadi) + 50 = 290. Carpana girseydi (120 + 50) × 2 = 340 olurdu.
    const sonuc = elPuanla(girdi(1), 'normal', 0, false);
    expect(sonuc.puanlar[1]).toBe(290);
    expect(sonuc.puanlar[1]).not.toBe(340);
  });

  it('calma cezasiyla birlikte islerse ikisi de sabit kalir', () => {
    // 120 × 2 + (5 × 5) + (2 × 50) = 240 + 25 + 100 = 365
    const sonuc = elPuanla(girdi(2, 5), 'normal', 0, false);
    expect(sonuc.puanlar[1]).toBe(365);
  });

  it('kazanan da isler tas cezasini oder', () => {
    const sonuc = elPuanla(girdi(0), 'normal', 1, false);
    // 1 numarali kazandi ama isler tas atmamis: temiz -100.
    expect(sonuc.puanlar[1]).toBe(-100);
    const cezali = elPuanla(girdi(1), 'normal', 1, false);
    expect(cezali.puanlar[1]).toBe(-50);
  });
});

describe('istemci ipucu — isler taslar isaretlenir', () => {
  it('viewFor kendi istakamdaki isler taslari bildirir', () => {
    const durum = masaKur([k10, m2]);
    const gorunum = viewFor(durum, 0);
    expect(gorunum.islerTaslarim).toContain(k10.id);
    expect(gorunum.islerTaslarim).not.toContain(m2.id);
  });

  it('rakibin isler taslari sizmaz', () => {
    const durum = durumKur({
      yer: [seri],
      istakalar: { 0: [m2], 1: [k10] },
    });
    const gorunum = viewFor(durum, 0);
    expect(gorunum.islerTaslarim).toEqual([]);
    expect(JSON.stringify(gorunum).includes(k10.id)).toBe(false);
  });
});

describe('isleme izni — KURALLAR.md §6', () => {
  it('acmamis oyuncu isleyemez', () => {
    const durum = masaKur([k10], { acmisMi: { 0: false } });
    expect(viewFor(durum, 0).islemeYapabilirim).toBe(false);
  });

  it('actigi hamlede isleyemez', () => {
    const durum = masaKur([k10], {
      acmisMi: { 0: true },
      acilisHamlesi: { 0: 2 },
      hamleSayisi: { 0: 2 },
    });
    expect(viewFor(durum, 0).islemeYapabilirim).toBe(false);
  });

  it('bir tur donunce isleyebilir', () => {
    const durum = masaKur([k10], {
      acmisMi: { 0: true },
      acilisHamlesi: { 0: 2 },
      hamleSayisi: { 0: 3 },
    });
    expect(viewFor(durum, 0).islemeYapabilirim).toBe(true);
  });
});

describe('islerMi — okeyin yerine gecen tas (§9 0.6)', () => {
  // Kullanicinin gozlemi: yerdeki okeyin temsil ettigi tas elde duruyorsa
  // o tas masaya konabilir; atmak dikkatsizliktir, ceza yemeli.
  it('dortlu kutteki okeyin yerine gecen tas isler', () => {
    // Besinci tas eklenemez (kut en fazla dort), ama sari3 okeyi cekebilir.
    const per: Per = {
      tip: 'kut',
      taslar: [t('kirmizi', 3), t('siyah', 3), t('mavi', 3), ok('a')],
    };
    expect(pereIsle(per, [t('sari', 3)]).ok).toBe(false);
    expect(islerMi(t('sari', 3), [per], [t('sari', 3)])).toBe(true);
  });

  it('serideki okeyin yerine gecen tas zaten isliyordu', () => {
    // 11 + okey + 13'e 12 dogrudan eklenebiliyor: okey 10'a kayar.
    const per: Per = { tip: 'seri', taslar: [t('kirmizi', 11), ok('a'), t('kirmizi', 13)] };
    expect(islerMi(t('kirmizi', 12), [per], [t('kirmizi', 12)])).toBe(true);
  });

  it('kutte eksik renklerin hepsi elde degilse isler DEGIL', () => {
    // §6 — dort rengi tamamlayamiyorsan okeyi alamazsin. Ama uclu kute
    // dogrudan islenebildigi icin bu per uclu degil, dortlu secildi.
    const per: Per = {
      tip: 'kut',
      taslar: [t('kirmizi', 5), t('mavi', 5), ok('a'), ok('b')],
    };
    // Iki okeyli kutten okey cekilemez (§10.7) ve besinci tas da eklenemez.
    expect(islerMi(t('siyah', 5), [per], [t('siyah', 5)])).toBe(false);
  });

  it('alakasiz tas isler olmaz', () => {
    const per: Per = {
      tip: 'kut',
      taslar: [t('kirmizi', 3), t('siyah', 3), t('mavi', 3), ok('a')],
    };
    expect(islerMi(t('sari', 9), [per], [t('sari', 9)])).toBe(false);
  });

  it('istaka verilmezse tasin kendisi elde sayilir', () => {
    const per: Per = {
      tip: 'kut',
      taslar: [t('kirmizi', 3), t('siyah', 3), t('mavi', 3), ok('a')],
    };
    expect(islerMi(t('sari', 3), [per])).toBe(true);
  });
});
