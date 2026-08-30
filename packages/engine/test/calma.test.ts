import { describe, expect, it } from 'vitest';
import { reduce, pencereKazanani } from '../src/reduce';
import { CALMA_CEZASI } from '../src/puan';
import { dolgu, durumAl, durumKur, pencereKur, t } from './yardimci';

// KURALLAR.md §5 — oyunun imza mekanigi.
// Oyun saat yonunde doner (§4): 0 numarali tas attiginda sira 3'e gecer.
// Oncelik: 3 bedelsiz alir, sonra 2, sonra 1 ceza odeyerek calabilir.

const atilan = t('kirmizi', 9);
const cezaTasi = t('sari', 3);

function masaKur(ekler: Parameters<typeof durumKur>[0] = {}) {
  return durumKur({
    siradaki: 3,
    faz: 'cekme',
    istakalar: {
      0: dolgu(13, [atilan, cezaTasi], 0),
      1: dolgu(14, [atilan, cezaTasi], 13),
      2: dolgu(14, [atilan, cezaTasi], 27),
      3: dolgu(14, [atilan, cezaTasi], 41),
    },
    atikYiginlari: { 0: [atilan] },
    deste: [cezaTasi, ...dolgu(10, [atilan, cezaTasi], 55)],
    pencere: pencereKur(0, atilan),
    ...ekler,
  });
}

describe('calma onceligi — KURALLAR.md §5', () => {
  it('iki oyuncu da talep ederse oncelikli olan alir (kim once bastiysa degil)', () => {
    let durum = masaKur();
    // 1 numarali once basiyor, 2 numarali sonra. Oncelik yine 2'nin —
    // oyun yonunde atandan sonraki ikinci oyuncu o.
    durum = durumAl(reduce(durum, { tip: 'CALMA_TALEBI', oyuncu: 1, suAn: 100 }));
    durum = durumAl(reduce(durum, { tip: 'CALMA_TALEBI', oyuncu: 2, suAn: 200 }));
    expect(pencereKazanani(durum)).toBe(2);

    const sonra = durumAl(reduce(durum, { tip: 'CEK_DESTEDEN', oyuncu: 3, suAn: 5000 }));
    expect(sonra.istakalar[2].map((tas) => tas.id)).toContain(atilan.id);
    expect(sonra.istakalar[1].map((tas) => tas.id)).not.toContain(atilan.id);
  });

  it('yalnizca son sirdaki talep ederse tas ona gider', () => {
    let durum = masaKur();
    durum = durumAl(reduce(durum, { tip: 'CALMA_TALEBI', oyuncu: 1, suAn: 100 }));
    expect(pencereKazanani(durum)).toBe(1);

    const sonra = durumAl(reduce(durum, { tip: 'CEK_DESTEDEN', oyuncu: 3, suAn: 5000 }));
    expect(sonra.istakalar[1].map((tas) => tas.id)).toContain(atilan.id);
  });

  it('kimse talep etmezse tas yiginda kalir', () => {
    const durum = masaKur();
    expect(pencereKazanani(durum)).toBe(null);
    const sonra = durumAl(reduce(durum, { tip: 'CEK_DESTEDEN', oyuncu: 3, suAn: 5000 }));
    expect(sonra.atikYiginlari[0].map((tas) => tas.id)).toEqual([atilan.id]);
  });
});

describe('calmanin bedeli — KURALLAR.md §5', () => {
  it('calan oyuncunun eli tam 2 tas buyur: calinan tas + ceza tasi', () => {
    let durum = masaKur();
    const oncekiBoyut = durum.istakalar[2].length;
    durum = durumAl(reduce(durum, { tip: 'CALMA_TALEBI', oyuncu: 2, suAn: 100 }));
    const sonra = durumAl(reduce(durum, { tip: 'CEK_DESTEDEN', oyuncu: 3, suAn: 5000 }));

    expect(sonra.istakalar[2]).toHaveLength(oncekiBoyut + 2);
    const idler = sonra.istakalar[2].map((tas) => tas.id);
    expect(idler).toContain(atilan.id);
    expect(idler).toContain(cezaTasi.id);
  });

  it('calis sayisi artar — puanda 5 ceza olarak isler', () => {
    let durum = masaKur();
    durum = durumAl(reduce(durum, { tip: 'CALMA_TALEBI', oyuncu: 2, suAn: 100 }));
    const sonra = durumAl(reduce(durum, { tip: 'CEK_DESTEDEN', oyuncu: 3, suAn: 5000 }));
    expect(sonra.calinanSayisi[2]).toBe(1);
    expect(CALMA_CEZASI).toBe(5);
  });

  it('calmak sirayi HARCAMAZ — sira yine sirasi gelen oyuncuda', () => {
    let durum = masaKur();
    durum = durumAl(reduce(durum, { tip: 'CALMA_TALEBI', oyuncu: 2, suAn: 100 }));
    const sonra = durumAl(reduce(durum, { tip: 'CEK_DESTEDEN', oyuncu: 3, suAn: 5000 }));

    expect(sonra.siradaki).toBe(3);
    expect(sonra.faz).toBe('atma');
    // 3 numarali normal cekisini de yapmis olmali.
    expect(sonra.istakalar[3]).toHaveLength(15);
  });

  it('calan oyuncu kendi sirasi gelince yine normal ceker ve atar', () => {
    let durum = masaKur();
    durum = durumAl(reduce(durum, { tip: 'CALMA_TALEBI', oyuncu: 2, suAn: 100 }));
    durum = durumAl(reduce(durum, { tip: 'CEK_DESTEDEN', oyuncu: 3, suAn: 5000 }));
    durum = durumAl(reduce(durum, { tip: 'AT', oyuncu: 3, tasId: durum.istakalar[3][0]!.id, suAn: 6000 }));

    expect(durum.siradaki).toBe(2);
    expect(durum.faz).toBe('cekme');
    const oncesi = durum.istakalar[2].length;
    durum = durumAl(reduce(durum, { tip: 'CEK_DESTEDEN', oyuncu: 2, suAn: 12000 }));
    expect(durum.istakalar[2]).toHaveLength(oncesi + 1);
  });

  it('calmanin siniri yoktur — ustuste calan elini surekli buyutur', () => {
    let durum = masaKur();
    durum = durumAl(reduce(durum, { tip: 'CALMA_TALEBI', oyuncu: 1, suAn: 100 }));
    durum = durumAl(reduce(durum, { tip: 'CEK_DESTEDEN', oyuncu: 3, suAn: 5000 }));
    expect(durum.istakalar[1]).toHaveLength(16);

    // 3 numarali atiyor, sira 2'ye geciyor; 1 numarali yine caliyor.
    durum = durumAl(reduce(durum, { tip: 'AT', oyuncu: 3, tasId: durum.istakalar[3][0]!.id, suAn: 6000 }));
    durum = durumAl(reduce(durum, { tip: 'CALMA_TALEBI', oyuncu: 1, suAn: 6100 }));
    durum = durumAl(reduce(durum, { tip: 'CEK_DESTEDEN', oyuncu: 2, suAn: 12000 }));

    expect(durum.istakalar[1]).toHaveLength(18);
    expect(durum.calinanSayisi[1]).toBe(2);
  });
});

describe('talep penceresi kurallari — KURALLAR.md §5', () => {
  it('sirasi gelen tasi alirsa talepler duser', () => {
    let durum = masaKur();
    durum = durumAl(reduce(durum, { tip: 'CALMA_TALEBI', oyuncu: 2, suAn: 100 }));
    const sonra = durumAl(reduce(durum, { tip: 'CEK_ATIKTAN', oyuncu: 3, suAn: 200 }));

    expect(sonra.istakalar[3].map((tas) => tas.id)).toContain(atilan.id);
    expect(sonra.istakalar[2]).toHaveLength(14);
    expect(sonra.calinanSayisi[2]).toBe(0);
    expect(sonra.pencere).toBe(null);
  });

  it('tasi atan kendi tasini talep edemez', () => {
    const sonuc = reduce(masaKur(), { tip: 'CALMA_TALEBI', oyuncu: 0, suAn: 100 });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('atan-talep-edemez');
  });

  it('sirasi gelen talep etmez — bedelsiz hakki var', () => {
    const sonuc = reduce(masaKur(), { tip: 'CALMA_TALEBI', oyuncu: 3, suAn: 100 });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('sirasi-olan-talep-edemez');
  });

  it('ayni oyuncu iki kez talep edemez', () => {
    const durum = durumAl(reduce(masaKur(), { tip: 'CALMA_TALEBI', oyuncu: 2, suAn: 100 }));
    const sonuc = reduce(durum, { tip: 'CALMA_TALEBI', oyuncu: 2, suAn: 150 });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('zaten-talep-ettin');
  });

  it('pencere kapaliyken talep edilemez', () => {
    const durum = durumKur({ siradaki: 0, faz: 'atma', pencere: null });
    const sonuc = reduce(durum, { tip: 'CALMA_TALEBI', oyuncu: 2, suAn: 100 });
    expect(sonuc.ok ? 'ok' : sonuc.reason).toBe('talep-penceresi-kapali');
  });

  it('talep baglayicidir: geri alma aksiyonu yoktur', () => {
    // Motorda CALMA_TALEBINI_GERI_AL diye bir aksiyon tipi bulunmuyor (§5.5).
    const durum = durumAl(reduce(masaKur(), { tip: 'CALMA_TALEBI', oyuncu: 2, suAn: 100 }));
    const sonra = durumAl(reduce(durum, { tip: 'CEK_DESTEDEN', oyuncu: 3, suAn: 5000 }));
    expect(sonra.calinanSayisi[2]).toBe(1);
  });

  it('yalnizca yiginin en ustteki tasi alinir; altindakiler oludur', () => {
    const altta = t('sari', 13, 'b');
    let durum = masaKur({ atikYiginlari: { 0: [altta, atilan] } });
    durum = durumAl(reduce(durum, { tip: 'CALMA_TALEBI', oyuncu: 2, suAn: 100 }));
    const sonra = durumAl(reduce(durum, { tip: 'CEK_DESTEDEN', oyuncu: 3, suAn: 5000 }));

    expect(sonra.istakalar[2].map((tas) => tas.id)).toContain(atilan.id);
    expect(sonra.istakalar[2].map((tas) => tas.id)).not.toContain(altta.id);
    expect(sonra.atikYiginlari[0].map((tas) => tas.id)).toEqual([altta.id]);
  });
});
