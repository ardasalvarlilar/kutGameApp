import { describe, expect, it } from 'vitest';
import { pencereKazanani, reduce } from '../src/reduce';
import { viewFor } from '../src/gorunum';
import { dolgu, durumAl, durumKur, ok, pencereKur, t } from './yardimci';

// Tur 15'e ozgu "cifti bende" hakki — KURALLAR.md §5, §9 0.10.
//
// Oyun saat yonunde doner (§4): 0 numarali tas attiginda normal oncelik
// 3 (bedelsiz) → 2 → 1'dir. Ancak atilan tasin birebir esini elinde tutan
// oyuncu, 3 numaralinin bedelsiz hakki dahil butun oncelikleri gecer.
//
// Bu hak KUYRUGA GIRMEZ: `CIFT_TALEBI` geldigi anda tasi alir (§9 0.10).
// Kuyruga girseydi sirasi gelen oyuncu ondan once davranip tasi alabilir,
// "her seyi gecer" sozu yalnizca yavas oynayana karsi gecerli olurdu.
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
  it('atilan tasin birebir esi elindeyse tas ANINDA gelir', () => {
    const sonra = durumAl(reduce(masaKur(), { tip: 'CIFT_TALEBI', oyuncu: 1, suAn: 100 }));

    const idler = sonra.istakalar[1].map((tas) => tas.id);
    expect(idler).toContain(atilan.id);
    expect(idler).toContain(cezaTasi.id);
    // Tas masadan kalkti; bekleyen bir talep penceresi kalmadi.
    expect(sonra.atikYiginlari[0]).toHaveLength(0);
    expect(sonra.pencere).toBe(null);
    expect(sonra.sonCalan).toBe(1);
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

describe('cift onceligi — her seyi gecer, SIRA ONEMLI DEGIL', () => {
  it('once normal talep gelse de tas cift sahibine gider', () => {
    // 2 numarali "istiyorum" dedi; normal oncelikte tas onun olurdu.
    let durum = durumAl(reduce(masaKur(), { tip: 'CALMA_TALEBI', oyuncu: 2, suAn: 100 }));
    durum = durumAl(reduce(durum, { tip: 'CIFT_TALEBI', oyuncu: 1, suAn: 200 }));

    expect(durum.istakalar[1].map((tas) => tas.id)).toContain(atilan.id);
    expect(durum.istakalar[2].map((tas) => tas.id)).not.toContain(atilan.id);
    // Bekleyen normal talep dustu: masada alinacak tas kalmadi.
    expect(durum.pencere).toBe(null);
    expect(pencereKazanani(durum)).toBe(null);
  });

  it('cift talebi normal calmanin bedelini oder ve SIRAYI HARCAMAZ', () => {
    const oncekiBoyut = masaKur().istakalar[1].length;
    const durum = durumAl(reduce(masaKur(), { tip: 'CIFT_TALEBI', oyuncu: 1, suAn: 100 }));

    // Tas + ceza tasi: el tam 2 tas buyur, 5 puan ceza yazilir (§5).
    expect(durum.istakalar[1]).toHaveLength(oncekiBoyut + 2);
    expect(durum.calinanSayisi[1]).toBe(1);
    // Sira hala 3 numaralida ve hala cekmesi gerekiyor.
    expect(durum.siradaki).toBe(3);
    expect(durum.faz).toBe('cekme');
  });

  it('cift alindiktan sonra sirasi gelen yalnizca desteden cekebilir', () => {
    const durum = durumAl(reduce(masaKur(), { tip: 'CIFT_TALEBI', oyuncu: 1, suAn: 100 }));

    const yerden = reduce(durum, { tip: 'CEK_ATIKTAN', oyuncu: 3, suAn: 150 });
    expect(yerden.ok ? 'ok' : yerden.reason).toBe('talep-penceresi-kapali');

    const sonra = durumAl(reduce(durum, { tip: 'CEK_DESTEDEN', oyuncu: 3, suAn: 200 }));
    expect(sonra.istakalar[3]).toHaveLength(15);
    expect(sonra.faz).toBe('atma');
    // Desteden cekmek calma degil; gosterim isareti temizlenir.
    expect(sonra.sonCalan).toBe(null);
  });

  it('sirasi gelen once davrandiysa tas onundur — cift talebi gec kalir', () => {
    // Sayac olmadigi icin bu yaris kacinilmaz ve KURALIN KENDISI: pencere,
    // sirasi gelen oyuncunun hamlesiyle kapaniyor (§9 0.9).
    const durum = durumAl(reduce(masaKur(), { tip: 'CEK_ATIKTAN', oyuncu: 3, suAn: 0 }));
    const gec = reduce(durum, { tip: 'CIFT_TALEBI', oyuncu: 1, suAn: 10 });
    expect(gec.ok ? 'ok' : gec.reason).toBe('talep-penceresi-kapali');
  });

  it('cift talebi gelmediyse sirasi gelen beklemeden alir', () => {
    expect(reduce(masaKur(), { tip: 'CEK_ATIKTAN', oyuncu: 3, suAn: 0 }).ok).toBe(true);
  });

  it('diger turlarda bedelsiz hak aninda kullanilabilir', () => {
    const durum = masaKur({ tur: 1 });
    expect(reduce(durum, { tip: 'CEK_ATIKTAN', oyuncu: 3, suAn: 0 }).ok).toBe(true);
  });

  it('cift talebi yoksa oncelik normal siraya doner', () => {
    let durum = masaKur();
    durum = durumAl(reduce(durum, { tip: 'CALMA_TALEBI', oyuncu: 2, suAn: 100 }));
    durum = durumAl(reduce(durum, { tip: 'CALMA_TALEBI', oyuncu: 1, suAn: 150 }));
    expect(pencereKazanani(durum)).toBe(2);
  });

  it('ayni tas iki kez calinamaz — ikincisi pencereyi kapali bulur', () => {
    const durum = durumAl(reduce(masaKur(), { tip: 'CIFT_TALEBI', oyuncu: 1, suAn: 100 }));
    const ikinci = reduce(durum, { tip: 'CIFT_TALEBI', oyuncu: 2, suAn: 150 });
    expect(ikinci.ok ? 'ok' : ikinci.reason).toBe('talep-penceresi-kapali');
  });

  it('deste bossa ceza tasi odenemez, talep reddedilir', () => {
    const durum = masaKur({ deste: [] });
    const sonuc = reduce(durum, { tip: 'CIFT_TALEBI', oyuncu: 1, suAn: 100 });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('ceza-tasi-kalmadi');
  });

  it('cift calma hakki kapatilabilir', () => {
    const durum = masaKur({ ayarlar: { ciftCalmaHakki: false } });
    const sonuc = reduce(durum, { tip: 'CIFT_TALEBI', oyuncu: 1, suAn: 100 });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('cift-calma-hakki-kapali');
    // Hak kapaliysa tur 15 de digerleri gibi davranir.
    expect(reduce(durum, { tip: 'CEK_ATIKTAN', oyuncu: 3, suAn: 100 }).ok).toBe(true);
  });
});

// §9 0.10 — dort cifti indiren oyuncunun ciftle isi biter.
describe('acmis oyuncunun cift hakki kapanir', () => {
  it('acmis oyuncu cift talep edemez', () => {
    const durum = masaKur({ acmisMi: { 1: true } });
    const sonuc = reduce(durum, { tip: 'CIFT_TALEBI', oyuncu: 1, suAn: 100 });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('zaten-actin');
  });

  it('istemci ipucu de kapanir — CIFTIM VAR tusu sonmeli', () => {
    expect(viewFor(masaKur({ acmisMi: { 1: true } }), 1).pencere?.ciftHakkim).toBe(false);
  });

  it('acmis oyuncu NORMAL talep edebilir — yalnizca cift hakki kapandi', () => {
    const durum = masaKur({ acmisMi: { 1: true } });
    expect(reduce(durum, { tip: 'CALMA_TALEBI', oyuncu: 1, suAn: 100 }).ok).toBe(true);
  });

  it('deste bossa ipucu da kapanir', () => {
    expect(viewFor(masaKur({ deste: [] }), 1).pencere?.ciftHakkim).toBe(false);
  });
});

// §9 0.10 — "dort cifti actiktan sonra ciftle isim bitiyor".
//
// Uc ayri kapi ve ucu de kapali olmali; biri acik kalirsa oyuncu turun
// sartini ikinci kez indirebilir ya da bitmeyen bir cift toplama dongusune
// girebilir.
describe('dort cift indirildikten sonra cift yok', () => {
  const c1 = [t('kirmizi', 2, 'a'), t('kirmizi', 2, 'b')];
  const c2 = [t('siyah', 5, 'a'), t('siyah', 5, 'b')];
  const c3 = [t('mavi', 9, 'a'), t('mavi', 9, 'b')];
  const c4 = [t('sari', 11, 'a'), t('sari', 11, 'b')];
  const c5 = [t('mavi', 3, 'a'), t('mavi', 3, 'b')];
  const ciftler = [...c1, ...c2, ...c3, ...c4, ...c5];

  /** Tur 15, sirasi gelen oyuncu 0, elinde bes cift + dolgu. */
  function ciftMasasi(ekler: Parameters<typeof durumKur>[0] = {}) {
    return durumKur({
      tur: 15,
      siradaki: 0,
      faz: 'atma',
      istakalar: { 0: [...ciftler, ...dolgu(5, ciftler, 0)] },
      ...ekler,
    });
  }

  const acilis = [c1, c2, c3, c4].map((cift) => cift.map((tas) => tas.id));

  it('dort cift acilis sartini karsiliyor', () => {
    const sonra = durumAl(
      reduce(ciftMasasi(), { tip: 'AC', oyuncu: 0, perler: acilis, okeyAlimi: null, suAn: 0 }),
    );
    expect(sonra.acmisMi[0]).toBe(true);
    expect(sonra.yer).toHaveLength(4);
    expect(sonra.yer.every((per) => per.tip === 'cift')).toBe(true);
  });

  it('bir daha cift ACILAMAZ', () => {
    const durum = durumAl(
      reduce(ciftMasasi(), { tip: 'AC', oyuncu: 0, perler: acilis, okeyAlimi: null, suAn: 0 }),
    );
    const ikinci = reduce(durum, {
      tip: 'AC',
      oyuncu: 0,
      perler: [c5.map((tas) => tas.id)],
      okeyAlimi: null,
      suAn: 10,
    });
    expect(ikinci.ok ? 'ok' : ikinci.reason).toBe('zaten-actin');
  });

  it('fazladan CIFT INDIRILEMEZ — yalnizca kut ve seri (§10.2)', () => {
    const durum = durumAl(
      reduce(ciftMasasi(), { tip: 'AC', oyuncu: 0, perler: acilis, okeyAlimi: null, suAn: 0 }),
    );
    const indir = reduce(durum, {
      tip: 'PER_INDIR',
      oyuncu: 0,
      perler: [c5.map((tas) => tas.id)],
      suAn: 10,
    });
    // Cift bir per DEGIL: iki tas kut da seri de olamiyor.
    expect(indir.ok).toBe(false);
  });
});
