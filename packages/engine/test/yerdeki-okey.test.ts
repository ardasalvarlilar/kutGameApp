import { describe, expect, it } from 'vitest';
import {
  islerMi,
  okeyCekilebilirMi,
  okeyCekmeAdaylari,
  okeyYerineGecebilirMi,
  okeyinTemsili,
  perGoruntuSirasi,
  pereIsle,
  seriYerlesimi,
  type Per,
} from '../src/per';
import { ok, t, yerPeri } from './yardimci';

// KURALLAR.md §9 0.8 — yere inmis taslarin yeri degismez.
//
// Oyuncunun bildirdigi hata: yerde `siyah4 + siyah5 + siyah6 + okey` varken
// (okey = siyah7) elindeki `siyah2` ISLER gorunuyor ve TASLARI ISLE dedigin
// anda motor okeyi 7'den alip 3'e kaydirip seriyi `2-3-4-5-6` yapiyordu.
// Yerdeki bir peri yeniden dizmek oyunun kabul ettigi bir hamle degil.

const seri = (taslar: readonly ReturnType<typeof t>[]): Per => ({ tip: 'seri', taslar });
const kut = (taslar: readonly ReturnType<typeof t>[]): Per => ({ tip: 'kut', taslar });

/** Bildirilen hatanin birebir kurulusu: okey siyah7'nin yerinde. */
const dortluSeri = seri([t('siyah', 4), t('siyah', 5), t('siyah', 6), ok('a')]);

function reason(sonuc: ReturnType<typeof pereIsle>): string {
  return sonuc.ok ? 'ok' : sonuc.reason;
}

describe('seriYerlesimi — okeyin isgal ettigi sayi', () => {
  it('okey serinin sonundaki bosluga oturur', () => {
    const yerlesim = seriYerlesimi(dortluSeri.taslar);
    expect(yerlesim?.get(ok('a').id)).toBe(7);
  });

  it('belirsizlikte okey mumkun oldugunca saga duser', () => {
    // §9 0.8 — `11 + 12 + okey` hem 10-11-12 hem 11-12-13 olabilir; 13 secilir.
    const yerlesim = seriYerlesimi([t('mavi', 11), t('mavi', 12), ok('a')]);
    expect(yerlesim?.get(ok('a').id)).toBe(13);
  });

  it('13te duran seride okey sola dusmek zorunda', () => {
    // Seri 13'te durur (§2); okeyin gidebilecegi tek yer 11.
    const yerlesim = seriYerlesimi([t('mavi', 12), t('mavi', 13), ok('a')]);
    expect(yerlesim?.get(ok('a').id)).toBe(11);
  });

  it('gosterim ile yerlesim ayni hesaptan cikar', () => {
    const sirali = perGoruntuSirasi(dortluSeri);
    expect(sirali.map((tas) => tas.id)).toEqual([
      t('siyah', 4).id,
      t('siyah', 5).id,
      t('siyah', 6).id,
      ok('a').id,
    ]);
  });
});

describe('isleme — yerdeki okey kimildatilamaz (§9 0.8)', () => {
  it('okeyi kaydiracak tas islenemez', () => {
    // Bildirilen hata: siyah2, okeyi 7'den 3'e kaydirirdi.
    expect(reason(pereIsle(dortluSeri, [t('siyah', 2)]))).toBe('yerdeki-okey-kimildatilamaz');
  });

  it('serinin iki ucu da acik kalir', () => {
    // siyah3 sola, siyah8 saga eklenir; ikisi de okeye dokunmaz.
    expect(pereIsle(dortluSeri, [t('siyah', 3)]).ok).toBe(true);
    expect(pereIsle(dortluSeri, [t('siyah', 8)]).ok).toBe(true);
  });

  it('okeyin temsil ettigi tas islenemez — o tas okeyi ceker', () => {
    // siyah7'yi eklemek okeyi 8'e iterdi. Dogru yol §6: okeyi cekmek.
    expect(reason(pereIsle(dortluSeri, [t('siyah', 7)]))).toBe('yerdeki-okey-kimildatilamaz');
    expect(okeyCekilebilirMi(dortluSeri, ok('a').id, [t('siyah', 7)])).toBe(true);
  });

  it('okeysiz seri eskisi gibi iki ucundan uzar', () => {
    const okeysiz = seri([t('mavi', 4), t('mavi', 5), t('mavi', 6)]);
    expect(pereIsle(okeysiz, [t('mavi', 3)]).ok).toBe(true);
    expect(pereIsle(okeysiz, [t('mavi', 7)]).ok).toBe(true);
  });

  it('kutteki okey sabitlenmez — orada bir "yer" yok', () => {
    // §6 — kutteki okeyin rengi belirsiz olabilir; kural degismedi.
    const per = kut([t('kirmizi', 5), t('mavi', 5), ok('a')]);
    expect(pereIsle(per, [t('siyah', 5)]).ok).toBe(true);
  });
});

describe('okey cekme — yalnizca temsil edilen tas (§6)', () => {
  it('okeyin temsil ettigi tas cozulur', () => {
    expect(okeyinTemsili(dortluSeri, ok('a').id)).toEqual({ renk: 'siyah', sayi: 7 });
  });

  it('baska bir tas okeyin yerine konamaz', () => {
    // siyah3 de gecerli bir seri birakirdi (3-4-5-6) ama peri kaydirirdi.
    expect(okeyCekilebilirMi(dortluSeri, ok('a').id, [t('siyah', 3)])).toBe(false);
    expect(okeyYerineGecebilirMi(dortluSeri, ok('a').id, t('siyah', 3))).toBe(false);
  });

  it('adaylar yalnizca temsil edilen tasi bulur', () => {
    const el = [t('siyah', 3), t('siyah', 7), t('siyah', 8)];
    const adaylar = okeyCekmeAdaylari(dortluSeri, ok('a').id, el);
    expect(adaylar?.map((tas) => tas.id)).toEqual([t('siyah', 7).id]);
  });

  it('yanlis renk okeyi cekemez', () => {
    expect(okeyCekilebilirMi(dortluSeri, ok('a').id, [t('mavi', 7)])).toBe(false);
  });
});

describe('isler tas — kayan okey artik islemiyor (§8, §9 0.6)', () => {
  const yer = [yerPeri(1, 1, 'seri', dortluSeri.taslar)];

  it('okeyi kaydiran tas ISLER SAYILMAZ', () => {
    // Ekranda turuncu isaret cikmasinin ve TASLARI ISLE'nin bu tasi
    // yollamasinin sebebi buydu.
    expect(islerMi(t('siyah', 2), yer, [t('siyah', 2)])).toBe(false);
  });

  it('serinin uclari isler sayilir', () => {
    expect(islerMi(t('siyah', 3), yer, [t('siyah', 3)])).toBe(true);
    expect(islerMi(t('siyah', 8), yer, [t('siyah', 8)])).toBe(true);
  });

  it('okeyin temsil ettigi tas isler sayilir — okey cekme yoluyla', () => {
    // §9 0.6 karari duruyor, degisen yalnizca hangi yoldan sayildigi.
    expect(islerMi(t('siyah', 7), yer, [t('siyah', 7)])).toBe(true);
  });

  it('0.6nin ornegi: yerdeki 11 + okey + 13 serisine 12', () => {
    // Karar metnindeki ornek. Okey 12'nin yerinde duruyor; 12 yine isler
    // tastir ama artik okeyi cekerek, okeyi 10'a kaydirarak degil.
    const per = seri([t('mavi', 11), ok('a'), t('mavi', 13)]);
    expect(okeyinTemsili(per, ok('a').id)).toEqual({ renk: 'mavi', sayi: 12 });
    expect(reason(pereIsle(per, [t('mavi', 12)]))).toBe('yerdeki-okey-kimildatilamaz');
    expect(islerMi(t('mavi', 12), [yerPeri(1, 1, 'seri', per.taslar)], [t('mavi', 12)])).toBe(true);
  });
});
