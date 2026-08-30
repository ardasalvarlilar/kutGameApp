import { describe, expect, it } from 'vitest';
import { reduce } from '../src/reduce';
import { dolgu, durumAl, durumKur, idler, ok, t, yerPeri } from './yardimci';

// KURALLAR.md §6 — acma ve isleme.

const k7 = t('kirmizi', 7);
const s7 = t('siyah', 7);
const m7 = t('mavi', 7);
const sa7 = t('sari', 7);
const k9 = t('kirmizi', 9);
const s9 = t('siyah', 9);
const m9 = t('mavi', 9);
const sa9 = t('sari', 9);

const kutlar = [k7, s7, m7, sa7, k9, s9, m9, sa9];

function acmaDurumu(ekler: Parameters<typeof durumKur>[0] = {}) {
  return durumKur({
    tur: 1,
    siradaki: 0,
    faz: 'atma',
    istakalar: { 0: [...kutlar, ...dolgu(7, kutlar, 0)] },
    ...ekler,
  });
}

describe('acma — KURALLAR.md §6 "ne eksik, ne fazla"', () => {
  it('turun sartinin tamami tek hamlede iner', () => {
    const sonra = durumAl(
      reduce(acmaDurumu(), {
        tip: 'AC',
        oyuncu: 0,
        perler: [idler([k7, s7, m7]), idler([k9, s9, m9])],
        okeyAlimi: null,
        suAn: 0,
      }),
    );
    expect(sonra.yer).toHaveLength(2);
    expect(sonra.acmisMi[0]).toBe(true);
    expect(sonra.istakalar[0]).toHaveLength(9);
    expect(sonra.yer.every((per) => per.sahibi === 0)).toBe(true);
  });

  it('sartin bir kismi indirilemez', () => {
    const sonuc = reduce(acmaDurumu(), {
      tip: 'AC',
      oyuncu: 0,
      perler: [idler([k7, s7, m7])],
      okeyAlimi: null,
      suAn: 0,
    });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('sart-eksik');
  });

  it('sart uclu kutse dortlu kut acilamaz', () => {
    const sonuc = reduce(acmaDurumu(), {
      tip: 'AC',
      oyuncu: 0,
      perler: [idler([k7, s7, m7, sa7]), idler([k9, s9, m9])],
      okeyAlimi: null,
      suAn: 0,
    });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('sart-uyusmuyor');
  });

  it('tur 4te uclu kutle acilamaz, dortlu gerekir', () => {
    const durum = acmaDurumu({ tur: 4 });
    const uclu = reduce(durum, {
      tip: 'AC', oyuncu: 0, perler: [idler([k7, s7, m7])], okeyAlimi: null, suAn: 0,
    });
    expect(uclu.ok ? 'ok' : uclu.reason).toBe('sart-uyusmuyor');
    const dortlu = reduce(durum, {
      tip: 'AC', oyuncu: 0, perler: [idler([k7, s7, m7, sa7])], okeyAlimi: null, suAn: 0,
    });
    expect(dortlu.ok).toBe(true);
  });

  it('gecersiz per ile acilamaz', () => {
    const sonuc = reduce(acmaDurumu(), {
      tip: 'AC',
      oyuncu: 0,
      perler: [idler([k7, s7, k9]), idler([k9, s9, m9])],
      okeyAlimi: null,
      suAn: 0,
    });
    expect(sonuc.ok).toBe(false);
  });

  it('elde olmayan tasla acilamaz', () => {
    const sonuc = reduce(acmaDurumu(), {
      tip: 'AC',
      oyuncu: 0,
      perler: [idler([k7, s7, t('sari', 13, 'b')]), idler([k9, s9, m9])],
      okeyAlimi: null,
      suAn: 0,
    });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('tas-elinde-yok');
  });

  it('iki kez acilamaz', () => {
    const durum = acmaDurumu({ acmisMi: { 0: true }, acilisHamlesi: { 0: 0 } });
    const sonuc = reduce(durum, {
      tip: 'AC', oyuncu: 0, perler: [idler([k7, s7, m7]), idler([k9, s9, m9])], okeyAlimi: null, suAn: 0,
    });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('zaten-actin');
  });

  it('cekmeden acilamaz', () => {
    const sonuc = reduce(acmaDurumu({ faz: 'cekme' }), {
      tip: 'AC', oyuncu: 0, perler: [idler([k7, s7, m7]), idler([k9, s9, m9])], okeyAlimi: null, suAn: 0,
    });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('once-cekmelisin');
  });

  it('acilis eli tamamen bosaltamaz — bitis son tasi atarak olur (§7)', () => {
    const durum = acmaDurumu({ istakalar: { 0: kutlar.filter((tas) => tas !== sa7 && tas !== sa9) } });
    const sonuc = reduce(durum, {
      tip: 'AC', oyuncu: 0, perler: [idler([k7, s7, m7]), idler([k9, s9, m9])], okeyAlimi: null, suAn: 0,
    });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('son-tas-atilmali');
  });

  it('tur 16da acma yoktur', () => {
    const sonuc = reduce(acmaDurumu({ tur: 16 }), {
      tip: 'AC', oyuncu: 0, perler: [idler([k7, s7, m7]), idler([k9, s9, m9])], okeyAlimi: null, suAn: 0,
    });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('tur-16-acma-yok');
  });
});

describe('isleme — KURALLAR.md §6', () => {
  const yerdeki = yerPeri(1, 0, 'kut', [k7, s7, m7]);

  function islemeDurumu(ekler: Parameters<typeof durumKur>[0] = {}) {
    return durumKur({
      tur: 1,
      siradaki: 0,
      faz: 'atma',
      yer: [yerdeki],
      sonrakiPerId: 2,
      istakalar: { 0: [sa7, ...dolgu(6, [...kutlar], 0)] },
      acmisMi: { 0: true },
      acilisHamlesi: { 0: 0 },
      hamleSayisi: { 0: 1 },
      ...ekler,
    });
  }

  it('bir tur dondukten sonra kendi perine islenebilir', () => {
    const sonra = durumAl(
      reduce(islemeDurumu(), { tip: 'ISLE', oyuncu: 0, perId: 1, tasIdler: [sa7.id], suAn: 0 }),
    );
    expect(sonra.yer[0]!.taslar).toHaveLength(4);
    expect(sonra.istakalar[0].map((tas) => tas.id)).not.toContain(sa7.id);
  });

  it('actigin hamlede isleme yapamazsin', () => {
    const durum = islemeDurumu({ acilisHamlesi: { 0: 1 }, hamleSayisi: { 0: 1 } });
    const sonuc = reduce(durum, { tip: 'ISLE', oyuncu: 0, perId: 1, tasIdler: [sa7.id], suAn: 0 });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('acilis-hamlesinde-isleme-yok');
  });

  it('acmadan isleme yapilamaz', () => {
    const durum = islemeDurumu({ acmisMi: { 0: false }, acilisHamlesi: { 0: null } });
    const sonuc = reduce(durum, { tip: 'ISLE', oyuncu: 0, perId: 1, tasIdler: [sa7.id], suAn: 0 });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('acmadin');
  });

  it('baskalarinin perine de islenebilir', () => {
    const durum = islemeDurumu({ yer: [yerPeri(1, 2, 'kut', [k7, s7, m7])] });
    expect(
      reduce(durum, { tip: 'ISLE', oyuncu: 0, perId: 1, tasIdler: [sa7.id], suAn: 0 }).ok,
    ).toBe(true);
  });

  it('peri bozacak tas islenemez', () => {
    const durum = islemeDurumu({ istakalar: { 0: [k9, ...dolgu(6, kutlar, 0)] } });
    const sonuc = reduce(durum, { tip: 'ISLE', oyuncu: 0, perId: 1, tasIdler: [k9.id], suAn: 0 });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('kut-farkli-sayi');
  });

  it('dortlu kute besinci tas islenemez', () => {
    const durum = islemeDurumu({
      yer: [yerPeri(1, 0, 'kut', [k7, s7, m7, sa7])],
      istakalar: { 0: [ok(), ...dolgu(6, kutlar, 0)] },
    });
    const sonuc = reduce(durum, { tip: 'ISLE', oyuncu: 0, perId: 1, tasIdler: [ok().id], suAn: 0 });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('kut-en-fazla-dort-tas');
  });

  it('olmayan pere islenemez', () => {
    const sonuc = reduce(islemeDurumu(), { tip: 'ISLE', oyuncu: 0, perId: 99, tasIdler: [sa7.id], suAn: 0 });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('per-bulunamadi');
  });

  it('tur 16da isleme yoktur', () => {
    const sonuc = reduce(islemeDurumu({ tur: 16 }), {
      tip: 'ISLE', oyuncu: 0, perId: 1, tasIdler: [sa7.id], suAn: 0,
    });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('tur-16-isleme-yok');
  });

  it('isleme eli tamamen bosaltamaz', () => {
    const durum = islemeDurumu({ istakalar: { 0: [sa7] } });
    const sonuc = reduce(durum, { tip: 'ISLE', oyuncu: 0, perId: 1, tasIdler: [sa7.id], suAn: 0 });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('son-tas-atilmali');
  });

  it('fazladan kut ve seri indirilebilir', () => {
    const durum = islemeDurumu({ istakalar: { 0: [k9, s9, m9, ...dolgu(4, kutlar, 0)] } });
    const sonra = durumAl(
      reduce(durum, { tip: 'PER_INDIR', oyuncu: 0, perler: [idler([k9, s9, m9])], suAn: 0 }),
    );
    expect(sonra.yer).toHaveLength(2);
  });

  it('acmadan fazladan per indirilemez', () => {
    const durum = islemeDurumu({
      acmisMi: { 0: false },
      acilisHamlesi: { 0: null },
      istakalar: { 0: [k9, s9, m9, ...dolgu(4, kutlar, 0)] },
    });
    const sonuc = reduce(durum, { tip: 'PER_INDIR', oyuncu: 0, perler: [idler([k9, s9, m9])], suAn: 0 });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('acmadin');
  });
});

describe('okey cekme — KURALLAR.md §6', () => {
  const okeyliKut = yerPeri(1, 0, 'kut', [k7, s7, ok('a')]);
  const m4 = t('mavi', 4);
  const m5 = t('mavi', 5);
  const m6 = t('mavi', 6);
  const okeyliSeri = yerPeri(1, 0, 'seri', [m4, m5, ok('a')]);

  function okeyDurumu(ekler: Parameters<typeof durumKur>[0] = {}) {
    return durumKur({
      tur: 1,
      siradaki: 0,
      faz: 'atma',
      yer: [okeyliKut],
      sonrakiPerId: 2,
      istakalar: { 0: [m7, sa7, ...dolgu(5, kutlar, 0)] },
      acmisMi: { 0: true },
      acilisHamlesi: { 0: 0 },
      hamleSayisi: { 0: 1 },
      ...ekler,
    });
  }

  it('kutte okey almak icin dort renk tamamlanir', () => {
    const sonra = durumAl(
      reduce(okeyDurumu(), {
        tip: 'OKEY_CEK',
        oyuncu: 0,
        perId: 1,
        okeyTasId: ok('a').id,
        yerineTasIdler: [m7.id, sa7.id],
        suAn: 0,
      }),
    );
    expect(sonra.istakalar[0].map((tas) => tas.id)).toContain(ok('a').id);
    expect(sonra.istakalar[0].map((tas) => tas.id)).not.toContain(m7.id);
    const per = sonra.yer[0]!;
    expect(per.taslar).toHaveLength(4);
    expect(per.taslar.map((tas) => tas.id)).not.toContain(ok('a').id);
  });

  it('kutte tek tas yetmez — okeyin rengi belirsiz kalir', () => {
    const sonuc = reduce(okeyDurumu(), {
      tip: 'OKEY_CEK',
      oyuncu: 0,
      perId: 1,
      okeyTasId: ok('a').id,
      yerineTasIdler: [m7.id],
      suAn: 0,
    });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('okey-yerine-gecemez');
  });

  it('eksik tas yoksa yalnizca isleme yapilir, okey alinamaz', () => {
    const durum = okeyDurumu({ istakalar: { 0: [m7, ...dolgu(5, kutlar, 0)] } });
    const cekme = reduce(durum, {
      tip: 'OKEY_CEK', oyuncu: 0, perId: 1, okeyTasId: ok('a').id, yerineTasIdler: [m7.id], suAn: 0,
    });
    expect(cekme.ok).toBe(false);
    // Ayni tasi islemek serbest.
    const isleme = reduce(durum, { tip: 'ISLE', oyuncu: 0, perId: 1, tasIdler: [m7.id], suAn: 0 });
    expect(isleme.ok).toBe(true);
  });

  it('seride tek tas yeter — okeyin temsil ettigi tas belirli', () => {
    const durum = okeyDurumu({
      yer: [okeyliSeri],
      istakalar: { 0: [m6, ...dolgu(5, [m4, m5, m6], 0)] },
    });
    const sonra = durumAl(
      reduce(durum, {
        tip: 'OKEY_CEK', oyuncu: 0, perId: 1, okeyTasId: ok('a').id, yerineTasIdler: [m6.id], suAn: 0,
      }),
    );
    expect(sonra.istakalar[0].map((tas) => tas.id)).toContain(ok('a').id);
    expect(sonra.yer[0]!.taslar).toHaveLength(3);
  });

  it('okeyin temsil etmedigi tas verilemez', () => {
    const durum = okeyDurumu({ istakalar: { 0: [k9, s9, ...dolgu(5, kutlar, 0)] } });
    const sonuc = reduce(durum, {
      tip: 'OKEY_CEK', oyuncu: 0, perId: 1, okeyTasId: ok('a').id, yerineTasIdler: [k9.id], suAn: 0,
    });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('okey-yerine-gecemez');
  });

  it('perde okey yoksa cekilemez', () => {
    const durum = okeyDurumu({ yer: [yerPeri(1, 0, 'kut', [k7, s7, m7])] });
    const sonuc = reduce(durum, {
      tip: 'OKEY_CEK', oyuncu: 0, perId: 1, okeyTasId: ok('a').id, yerineTasIdler: [sa7.id], suAn: 0,
    });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('okey-degil');
  });

  it('acmamis oyuncu normal yoldan okey cekemez', () => {
    const durum = okeyDurumu({ acmisMi: { 0: false }, acilisHamlesi: { 0: null } });
    const sonuc = reduce(durum, {
      tip: 'OKEY_CEK', oyuncu: 0, perId: 1, okeyTasId: ok('a').id, yerineTasIdler: [m7.id, sa7.id], suAn: 0,
    });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('acmadin');
  });

  it('istisna: acmamis oyuncu okeyi alip ayni hamlede acabilir', () => {
    const k3 = t('kirmizi', 3);
    const s3 = t('siyah', 3);
    const m3 = t('mavi', 3);
    const el = [m7, sa7, k3, s3, m3, k9, s9, m9];
    const durum = durumKur({
      tur: 1,
      siradaki: 2,
      faz: 'atma',
      yer: [okeyliKut],
      sonrakiPerId: 2,
      istakalar: { 2: [...el, ...dolgu(4, [...el, ...kutlar, ok('a')], 0)] },
    });

    const sonra = durumAl(
      reduce(durum, {
        tip: 'AC',
        oyuncu: 2,
        perler: [idler([k3, s3, ok('a')]), idler([k9, s9, m9])],
        okeyAlimi: { perId: 1, okeyTasId: ok('a').id, yerineTasIdler: [m7.id, sa7.id] },
        suAn: 0,
      }),
    );

    expect(sonra.acmisMi[2]).toBe(true);
    // Verdigi gercek taslar eski perde, alinan okey yeni perde.
    expect(sonra.yer[0]!.taslar).toHaveLength(4);
    expect(sonra.yer.slice(1).flatMap((per) => per.taslar.map((tas) => tas.id))).toContain(ok('a').id);
    // Okey istakaya saklanmadi.
    expect(sonra.istakalar[2].map((tas) => tas.id)).not.toContain(ok('a').id);
  });

  it('alinan okey o acilista kullanilmak ZORUNDA', () => {
    const k3 = t('kirmizi', 3);
    const s3 = t('siyah', 3);
    const m3 = t('mavi', 3);
    const el = [m7, sa7, k3, s3, m3, k9, s9, m9];
    const durum = durumKur({
      tur: 1,
      siradaki: 2,
      faz: 'atma',
      yer: [okeyliKut],
      sonrakiPerId: 2,
      istakalar: { 2: [...el, ...dolgu(4, [...el, ...kutlar, ok('a')], 0)] },
    });

    const sonuc = reduce(durum, {
      tip: 'AC',
      oyuncu: 2,
      perler: [idler([k3, s3, m3]), idler([k9, s9, m9])],
      okeyAlimi: { perId: 1, okeyTasId: ok('a').id, yerineTasIdler: [m7.id, sa7.id] },
      suAn: 0,
    });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('alinan-okey-kullanilmadi');
  });
});
