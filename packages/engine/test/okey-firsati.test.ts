import { describe, expect, it } from 'vitest';
import { viewFor } from '../src/gorunum';
import { okeyCekilebilirMi, okeyCekmeAdaylari, type Per } from '../src/per';
import { reduce } from '../src/reduce';
import { durumAl, durumKur, idler, ok, t, yerPeri } from './yardimci';

// KURALLAR.md §6 "Okey cekme" — motorda kural zaten vardi (`okeyCekilebilirMi`,
// `OKEY_CEK`, `AC` icindeki `okeyAlimi`). Eksik olan, oyuncunun bu firsati
// GOREBILMESIYDI: elindeki sari3 su okeyi alabiliyor mu?
// `okeyCekmeAdaylari` bu soruya cevap veriyor, projeksiyon da tasiyor.

const kut = (taslar: readonly ReturnType<typeof t>[]): Per => ({ tip: 'kut', taslar });
const seri = (taslar: readonly ReturnType<typeof t>[]): Per => ({ tip: 'seri', taslar });

describe('okeyCekmeAdaylari — kut', () => {
  it('uc renk + okey: eksik tek renk yeter', () => {
    // Kullanicinin anlattigi senaryo: yerde kirmizi3 + siyah3 + mavi3 + okey,
    // elimde sari3. Okey kesin sari3'tur, tek tas yeter (§6).
    const per = kut([t('kirmizi', 3), t('siyah', 3), t('mavi', 3), ok('a')]);
    const adaylar = okeyCekmeAdaylari(per, ok('a').id, [t('sari', 3), t('mavi', 9)]);
    expect(adaylar).not.toBeNull();
    expect(idler(adaylar ?? [])).toEqual([t('sari', 3).id]);
  });

  it('iki renk + okey: eksik RENKLERIN HEPSI gerekir', () => {
    // §6 — kirmizi5 + mavi5 + okey icinde okey hem siyah5 hem sari5 olabilir.
    const per = kut([t('kirmizi', 5), t('mavi', 5), ok('a')]);
    const el = [t('siyah', 5), t('sari', 5)];
    const adaylar = okeyCekmeAdaylari(per, ok('a').id, el);
    expect(adaylar).not.toBeNull();
    expect(new Set(idler(adaylar ?? []))).toEqual(new Set(idler(el)));
  });

  it('eksik renklerden biri elde yoksa okey alinamaz', () => {
    // §6 — "Eksik taslarin hepsi elinde yoksa o okeyi alamazsin."
    const per = kut([t('kirmizi', 5), t('mavi', 5), ok('a')]);
    expect(okeyCekmeAdaylari(per, ok('a').id, [t('siyah', 5)])).toBeNull();
  });

  it('yanlis sayidaki tas ise yaramaz', () => {
    const per = kut([t('kirmizi', 3), t('siyah', 3), t('mavi', 3), ok('a')]);
    expect(okeyCekmeAdaylari(per, ok('a').id, [t('sari', 4)])).toBeNull();
  });

  it('iki okeyli kutten okey cekilemez — §10.7', () => {
    const per = kut([t('kirmizi', 5), t('mavi', 5), ok('a'), ok('b')]);
    expect(okeyCekmeAdaylari(per, ok('a').id, [t('siyah', 5), t('sari', 5)])).toBeNull();
  });

  it('elimdeki okey, okeyin yerine konamaz', () => {
    const per = kut([t('kirmizi', 3), t('siyah', 3), t('mavi', 3), ok('a')]);
    expect(okeyCekmeAdaylari(per, ok('a').id, [ok('b')])).toBeNull();
  });
});

describe('okeyCekmeAdaylari — seri', () => {
  it('okeyin temsil ettigi tas bellidir, tek tas yeter', () => {
    // §6 — mavi4 + mavi5 + okey icin mavi6 koymak yeter.
    const per = seri([t('mavi', 4), t('mavi', 5), ok('a')]);
    const adaylar = okeyCekmeAdaylari(per, ok('a').id, [t('mavi', 6), t('sari', 9)]);
    expect(idler(adaylar ?? [])).toEqual([t('mavi', 6).id]);
  });

  it('seriyi bozan tas kabul edilmez', () => {
    const per = seri([t('mavi', 4), t('mavi', 5), ok('a')]);
    expect(okeyCekmeAdaylari(per, ok('a').id, [t('kirmizi', 6), t('mavi', 9)])).toBeNull();
  });

  it('ortadaki okey de cekilebilir', () => {
    const per = seri([t('mavi', 4), ok('a'), t('mavi', 6)]);
    expect(idler(okeyCekmeAdaylari(per, ok('a').id, [t('mavi', 5)]) ?? [])).toEqual([
      t('mavi', 5).id,
    ]);
  });
});

describe('okeyCekmeAdaylari — sinirlar', () => {
  it('perde okey yoksa null', () => {
    const per = kut([t('kirmizi', 3), t('siyah', 3), t('mavi', 3)]);
    expect(okeyCekmeAdaylari(per, ok('a').id, [t('sari', 3)])).toBeNull();
  });

  it('bos elde null', () => {
    const per = kut([t('kirmizi', 3), t('siyah', 3), t('mavi', 3), ok('a')]);
    expect(okeyCekmeAdaylari(per, ok('a').id, [])).toBeNull();
  });

  it('ciftten okey cekilemez — §6 yalnizca seri ve kutten soz ediyor', () => {
    const per: Per = { tip: 'cift', taslar: [t('kirmizi', 7), ok('a')] };
    expect(okeyCekmeAdaylari(per, ok('a').id, [t('kirmizi', 7, 'b')])).toBeNull();
  });

  it('bulunan adaylari daima okeyCekilebilirMi onaylar — kural tek yerde', () => {
    const perler: Per[] = [
      kut([t('kirmizi', 3), t('siyah', 3), t('mavi', 3), ok('a')]),
      kut([t('kirmizi', 5), t('mavi', 5), ok('a')]),
      seri([t('mavi', 4), t('mavi', 5), ok('a')]),
      seri([t('sari', 10), ok('a'), t('sari', 12)]),
    ];
    const el = [
      t('sari', 3), t('siyah', 5), t('sari', 5), t('mavi', 6), t('sari', 11), t('kirmizi', 13),
    ];
    for (const per of perler) {
      const adaylar = okeyCekmeAdaylari(per, ok('a').id, el);
      if (adaylar === null) continue;
      expect(okeyCekilebilirMi(per, ok('a').id, adaylar)).toBe(true);
    }
  });
});

describe('viewFor.okeyFirsatlarim', () => {
  const okeyliKut = yerPeri(1, 2, 'kut', [
    t('kirmizi', 3), t('siyah', 3), t('mavi', 3), ok('a'),
  ]);

  it('elimdeki tas bir okeyi cekiyorsa firsat gorunur', () => {
    const durum = durumKur({
      istakalar: { 0: [t('sari', 3), t('mavi', 9)] },
      yer: [okeyliKut],
    });
    const gorunum = viewFor(durum, 0);
    expect(gorunum.okeyFirsatlarim).toEqual([
      { perId: 1, okeyTasId: ok('a').id, yerineTasIdler: [t('sari', 3).id] },
    ]);
  });

  it('gerekli tas bende yoksa firsat yok', () => {
    const durum = durumKur({
      istakalar: { 0: [t('sari', 9)] },
      yer: [okeyliKut],
    });
    expect(viewFor(durum, 0).okeyFirsatlarim).toEqual([]);
  });

  it('firsat kisiye ozel — baskasinin elinden hesaplanmaz', () => {
    const durum = durumKur({
      istakalar: { 0: [t('sari', 3)], 1: [t('mavi', 9)] },
      yer: [okeyliKut],
    });
    expect(viewFor(durum, 0).okeyFirsatlarim).toHaveLength(1);
    expect(viewFor(durum, 1).okeyFirsatlarim).toHaveLength(0);
  });

  it('acmamis oyuncu da firsati gorur — §6 istisnasi onun icin', () => {
    const durum = durumKur({
      istakalar: { 0: [t('sari', 3)] },
      yer: [okeyliKut],
      acmisMi: { 0: false },
    });
    const gorunum = viewFor(durum, 0);
    expect(gorunum.acmisMi[0]).toBe(false);
    expect(gorunum.okeyFirsatlarim).toHaveLength(1);
  });

  it('okey firsati veren tas ISLER sayilir — §9 0.6', () => {
    // Dortlu kute besinci tas islenemez (pereIsle reddeder), ama sari3
    // okeyin yerine gecip okeyi cekebiliyor. O tas masaya konabilecek bir
    // tastir; atmak §8'in tarif ettigi dikkatsizliktir.
    const durum = durumKur({
      istakalar: { 0: [t('sari', 3)] },
      yer: [okeyliKut],
    });
    const gorunum = viewFor(durum, 0);
    expect(gorunum.okeyFirsatlarim).toHaveLength(1);
    expect(gorunum.islerTaslarim).toEqual([t('sari', 3).id]);
  });

  it('firsat vermeyen tas isler olmaz — kural genelleşmedi', () => {
    const durum = durumKur({
      istakalar: { 0: [t('sari', 9)] },
      yer: [okeyliKut],
    });
    expect(viewFor(durum, 0).islerTaslarim).toEqual([]);
  });

  it('firsat sizinti yapmiyor — rakip istakasi gorunmuyor', () => {
    const durum = durumKur({
      istakalar: { 0: [t('sari', 3)], 1: [t('kirmizi', 12), t('siyah', 8)] },
      yer: [okeyliKut],
    });
    const metin = JSON.stringify(viewFor(durum, 0));
    expect(metin.includes(t('kirmizi', 12).id)).toBe(false);
    expect(metin.includes(t('siyah', 8).id)).toBe(false);
  });

  it('firsat gercekten uygulanabilir — OKEY_CEK kabul ediliyor', () => {
    const durum = durumKur({
      istakalar: { 0: [t('sari', 3), t('mavi', 9), t('mavi', 10)] },
      yer: [okeyliKut],
      acmisMi: { 0: true },
      acilisHamlesi: { 0: 0 },
      hamleSayisi: { 0: 1 },
    });
    const firsat = viewFor(durum, 0).okeyFirsatlarim[0];
    expect(firsat).toBeDefined();

    const sonraki = durumAl(
      reduce(durum, { tip: 'OKEY_CEK', oyuncu: 0, ...(firsat as NonNullable<typeof firsat>), suAn: 0 }),
    );
    // Okey bana geldi, sari3 yere gitti.
    expect(idler(sonraki.istakalar[0])).toContain(ok('a').id);
    expect(idler(sonraki.istakalar[0])).not.toContain(t('sari', 3).id);
    expect(idler(sonraki.yer[0]?.taslar ?? [])).toContain(t('sari', 3).id);
    // Firsat tuketildi.
    expect(viewFor(sonraki, 0).okeyFirsatlarim).toEqual([]);
  });
});
