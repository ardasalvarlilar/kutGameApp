import { describe, expect, it } from 'vitest';
import { pencereKazanani, reduce } from '../src/reduce';
import { viewFor } from '../src/gorunum';
import { dolgu, durumAl, durumKur, ok, pencereKur, t } from './yardimci';

// Tur 15'e ozgu "cifti bende" hakki — KURALLAR.md §5.
// Oyun saat yonunde doner (§4): 0 numarali tas attiginda normal oncelik
// 3 (bedelsiz) → 2 → 1'dir. Ancak atilan tasin birebir esini elinde tutan
// oyuncu, 3 numaralinin bedelsiz hakki dahil butun oncelikleri gecer.
// Elde es yoksa her sey normal oncelige doner.

const atilan = t('kirmizi', 7, 'a');
const esi = t('kirmizi', 7, 'b');
const cezaTasi = t('sari', 3);
const haric = [atilan, esi, cezaTasi];

function masaKur(ekler: Parameters<typeof durumKur>[0] = {}) {
  return durumKur({
    tur: 15,
    siradaki: 3,
    faz: 'cekme',
    istakalar: {
      0: dolgu(13, haric, 0),
      // 1 numaralinin elinde atilan tasin birebir esi var.
      1: [esi, ...dolgu(13, haric, 13)],
      2: dolgu(14, haric, 27),
      3: dolgu(14, haric, 41),
    },
    atikYiginlari: { 0: [atilan] },
    deste: [cezaTasi, ...dolgu(10, haric, 55)],
    pencere: pencereKur(0, atilan),
    ...ekler,
  });
}

describe('cift talebi — blof engeli', () => {
  it('atilan tasin birebir esi elindeyse talep gecerlidir', () => {
    const sonuc = reduce(masaKur(), { tip: 'CIFT_TALEBI', oyuncu: 1, suAn: 100 });
    expect(sonuc.ok).toBe(true);
    expect(sonuc.ok && sonuc.state.pencere?.ciftTalebi).toBe(1);
  });

  it('es elinde degilse talep reddedilir', () => {
    const sonuc = reduce(masaKur(), { tip: 'CIFT_TALEBI', oyuncu: 2, suAn: 100 });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('cift-elinde-yok');
  });

  it('ayni sayinin farkli rengi es sayilmaz', () => {
    const durum = masaKur({
      istakalar: {
        0: dolgu(13, haric, 0),
        1: dolgu(14, haric, 13),
        2: [t('mavi', 7), ...dolgu(13, [...haric, t('mavi', 7)], 27)],
        3: dolgu(14, haric, 41),
      },
    });
    const sonuc = reduce(durum, { tip: 'CIFT_TALEBI', oyuncu: 2, suAn: 100 });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('cift-elinde-yok');
  });

  it('okey atildiysa diger okeyi tutan oyuncu talep edebilir', () => {
    const okeyAtildi = ok('a');
    const haricOkey = [okeyAtildi, ok('b')];
    const durum = masaKur({
      istakalar: {
        0: dolgu(13, haricOkey, 0),
        1: [ok('b'), ...dolgu(13, haricOkey, 13)],
        2: dolgu(14, haricOkey, 27),
        3: dolgu(14, haricOkey, 41),
      },
      atikYiginlari: { 0: [okeyAtildi] },
      pencere: pencereKur(0, okeyAtildi),
    });
    expect(reduce(durum, { tip: 'CIFT_TALEBI', oyuncu: 1, suAn: 100 }).ok).toBe(true);
  });

  it('istemci ipucu de ayni kontrolden geciyor', () => {
    const durum = masaKur();
    expect(viewFor(durum, 1).pencere?.ciftHakkim).toBe(true);
    expect(viewFor(durum, 2).pencere?.ciftHakkim).toBe(false);
  });

  it('yalnizca tur 15te gecerlidir', () => {
    const sonuc = reduce(masaKur({ tur: 1 }), { tip: 'CIFT_TALEBI', oyuncu: 1, suAn: 100 });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('cift-talebi-sadece-tur-15');
  });

  it('tasi atan ve sirasi gelen cift talep etmez', () => {
    const atanSonuc = reduce(masaKur(), { tip: 'CIFT_TALEBI', oyuncu: 0, suAn: 100 });
    expect(atanSonuc.ok ? 'ok' : atanSonuc.reason).toBe('atan-talep-edemez');
    const siraSonuc = reduce(masaKur(), { tip: 'CIFT_TALEBI', oyuncu: 3, suAn: 100 });
    expect(siraSonuc.ok ? 'ok' : siraSonuc.reason).toBe('sirasi-olan-talep-edemez');
  });
});

describe('cift onceligi — her seyi gecer', () => {
  it('cift talebi normal calma talebini gecer', () => {
    let durum = masaKur();
    durum = durumAl(reduce(durum, { tip: 'CALMA_TALEBI', oyuncu: 2, suAn: 100 }));
    durum = durumAl(reduce(durum, { tip: 'CIFT_TALEBI', oyuncu: 1, suAn: 200 }));

    // Normal oncelikte tas 2 numaralinin olurdu.
    expect(pencereKazanani(durum)).toBe(1);
  });

  it('cift talebi varken sirasi gelen yerden tas ALAMAZ', () => {
    let durum = masaKur();
    durum = durumAl(reduce(durum, { tip: 'CIFT_TALEBI', oyuncu: 1, suAn: 100 }));
    const sonuc = reduce(durum, { tip: 'CEK_ATIKTAN', oyuncu: 3, suAn: 5000 });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('cift-talebi-oncelikli');
  });

  it('sirasi gelen desteden ceker, tas cift sahibine gider', () => {
    let durum = masaKur();
    durum = durumAl(reduce(durum, { tip: 'CIFT_TALEBI', oyuncu: 1, suAn: 100 }));
    const sonra = durumAl(reduce(durum, { tip: 'CEK_DESTEDEN', oyuncu: 3, suAn: 5000 }));

    const idler = sonra.istakalar[1].map((tas) => tas.id);
    expect(idler).toContain(atilan.id);
    expect(idler).toContain(cezaTasi.id);
    // Normal calma gibi: eli 2 tas buyur, 5 puan ceza yazar.
    expect(sonra.istakalar[1]).toHaveLength(16);
    expect(sonra.calinanSayisi[1]).toBe(1);
    // Sira harcanmaz.
    expect(sonra.siradaki).toBe(3);
    expect(sonra.faz).toBe('atma');
  });

  it('tur 15te pencere kapanmadan yerden tas alinamaz — cift hakki dogmali', () => {
    const durum = masaKur({ pencere: pencereKur(0, atilan, { acilisZamani: 1000 }) });
    const erken = reduce(durum, { tip: 'CEK_ATIKTAN', oyuncu: 3, suAn: 1500 });
    expect(erken.ok ? 'ok' : erken.reason).toBe('pencere-suresi-dolmadi');
    // Pencere kapaninca ve cift talebi yoksa bedelsiz hakki isler.
    expect(reduce(durum, { tip: 'CEK_ATIKTAN', oyuncu: 3, suAn: 4000 }).ok).toBe(true);
  });

  it('diger turlarda bedelsiz hak aninda kullanilabilir', () => {
    const durum = masaKur({ tur: 1, pencere: pencereKur(0, atilan, { acilisZamani: 1000 }) });
    expect(reduce(durum, { tip: 'CEK_ATIKTAN', oyuncu: 3, suAn: 1001 }).ok).toBe(true);
  });

  it('cift talebi yoksa oncelik normal siraya doner', () => {
    let durum = masaKur();
    durum = durumAl(reduce(durum, { tip: 'CALMA_TALEBI', oyuncu: 2, suAn: 100 }));
    durum = durumAl(reduce(durum, { tip: 'CALMA_TALEBI', oyuncu: 1, suAn: 150 }));
    expect(pencereKazanani(durum)).toBe(2);
  });

  it('ayni tastan destede iki kopya var — en fazla bir oyuncu cift sahibi olabilir', () => {
    let durum = masaKur();
    durum = durumAl(reduce(durum, { tip: 'CIFT_TALEBI', oyuncu: 1, suAn: 100 }));
    const ikinci = reduce(durum, { tip: 'CIFT_TALEBI', oyuncu: 2, suAn: 150 });
    expect(ikinci.ok ? 'ok' : ikinci.reason).toBe('zaten-cift-talebi-var');
  });

  it('cift calma hakki kapatilabilir', () => {
    const durum = masaKur({ ayarlar: { ciftCalmaHakki: false } });
    const sonuc = reduce(durum, { tip: 'CIFT_TALEBI', oyuncu: 1, suAn: 100 });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('cift-calma-hakki-kapali');
    // Hak kapaliysa tur 15 de digerleri gibi davranir.
    expect(reduce(durum, { tip: 'CEK_ATIKTAN', oyuncu: 3, suAn: 100 }).ok).toBe(true);
  });
});
