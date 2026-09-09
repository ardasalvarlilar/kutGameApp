// Tas kimligi ve koleksiyon yardimcilari.
//
// Motor kurali #6: taslar KIMLIKLIDIR. Destede her tastan iki kopya var ve
// `renk + sayi` bir tasi tanimlamaya yetmez — bu dosya o kurali koruyor.
// Yardimcilarin tamami saf; hicbiri oyun durumu okumuyor.

import { describe, expect, it } from 'vitest';
import {
  benzersizMi,
  normalMi,
  normalTas,
  okeyId,
  okeyMi,
  okeyTas,
  tasBul,
  tasCikar,
  tasId,
  taslariBul,
} from '../src/tas';
import { idler, ok, t } from './yardimci';

describe('kimlik uretimi', () => {
  it('ayni renk ve sayinin iki kopyasi FARKLI kimlik tasir (motor kurali #6)', () => {
    expect(tasId('kirmizi', 7, 'a')).not.toBe(tasId('kirmizi', 7, 'b'));
  });

  it('ayni parametreler ayni kimligi uretir', () => {
    expect(tasId('mavi', 3, 'a')).toBe(tasId('mavi', 3, 'a'));
  });

  it('renk ve sayi kimlige giriyor', () => {
    expect(tasId('mavi', 3, 'a')).not.toBe(tasId('sari', 3, 'a'));
    expect(tasId('mavi', 3, 'a')).not.toBe(tasId('mavi', 4, 'a'));
  });

  it('iki okey de ayri kimlik tasir', () => {
    expect(okeyId('a')).not.toBe(okeyId('b'));
  });

  it('okey kimligi normal tas kimligiyle cakismaz', () => {
    expect(okeyId('a')).not.toBe(tasId('kirmizi', 1, 'a'));
  });
});

describe('tas uretimi', () => {
  it('normalTas alanlarini dolduruyor', () => {
    const tas = normalTas('siyah', 11, 'b');
    expect(tas).toEqual({ id: tasId('siyah', 11, 'b'), tip: 'normal', renk: 'siyah', sayi: 11 });
  });

  it('okeyTas alanlarini dolduruyor', () => {
    expect(okeyTas('a')).toEqual({ id: okeyId('a'), tip: 'okey' });
  });
});

describe('okeyMi / normalMi', () => {
  it('okeyi taniyor', () => {
    expect(okeyMi(ok())).toBe(true);
    expect(okeyMi(t('kirmizi', 5))).toBe(false);
  });

  it('normal tasi taniyor', () => {
    expect(normalMi(t('kirmizi', 5))).toBe(true);
    expect(normalMi(ok())).toBe(false);
  });

  it('ikisi birbirini disliyor', () => {
    for (const tas of [ok(), ok('b'), t('mavi', 1), t('sari', 13, 'b')]) {
      expect(okeyMi(tas)).toBe(!normalMi(tas));
    }
  });
});

describe('tasBul', () => {
  const eldekiler = [t('kirmizi', 5), t('mavi', 9), ok()];

  it('kimlige gore buluyor', () => {
    expect(tasBul(eldekiler, t('mavi', 9).id)).toEqual(t('mavi', 9));
  });

  it('ayni renk-sayinin DIGER kopyasini bulmuyor', () => {
    expect(tasBul(eldekiler, t('kirmizi', 5, 'b').id)).toBeNull();
  });

  it('yoksa null', () => {
    expect(tasBul(eldekiler, t('siyah', 2).id)).toBeNull();
    expect(tasBul([], t('siyah', 2).id)).toBeNull();
  });
});

describe('taslariBul', () => {
  const eldekiler = [t('kirmizi', 5), t('mavi', 9), ok()];

  it('hepsi varsa istenen SIRAYLA donuyor', () => {
    const bulunan = taslariBul(eldekiler, idler([ok(), t('kirmizi', 5)]));
    expect(bulunan).toEqual([ok(), t('kirmizi', 5)]);
  });

  it('biri bile eksikse null — kismi sonuc yok', () => {
    expect(taslariBul(eldekiler, idler([t('kirmizi', 5), t('siyah', 2)]))).toBeNull();
  });

  it('bos istek bos dizi', () => {
    expect(taslariBul(eldekiler, [])).toEqual([]);
  });
});

describe('tasCikar', () => {
  const eldekiler = [t('kirmizi', 5), t('mavi', 9), ok(), t('sari', 1)];

  it('verilen kimlikleri siliyor, kalanlarin sirasi korunuyor', () => {
    const kalan = tasCikar(eldekiler, idler([t('mavi', 9), t('sari', 1)]));
    expect(kalan).toEqual([t('kirmizi', 5), ok()]);
  });

  it('yalnizca o KOPYAYI siliyor', () => {
    const iki = [t('kirmizi', 5, 'a'), t('kirmizi', 5, 'b')];
    expect(tasCikar(iki, [t('kirmizi', 5, 'a').id])).toEqual([t('kirmizi', 5, 'b')]);
  });

  it('listede olmayan kimlik sorun degil', () => {
    expect(tasCikar(eldekiler, [t('siyah', 13).id])).toEqual(eldekiler);
  });

  it('girdiyi degistirmiyor', () => {
    const kopya = [...eldekiler];
    tasCikar(eldekiler, idler([ok()]));
    expect(eldekiler).toEqual(kopya);
  });
});

describe('benzersizMi', () => {
  it('tekrar yoksa true', () => {
    expect(benzersizMi(idler([t('kirmizi', 5), t('mavi', 9), ok()]))).toBe(true);
  });

  it('ayni kimlik iki kez gecerse false', () => {
    expect(benzersizMi(idler([t('kirmizi', 5), t('kirmizi', 5)]))).toBe(false);
  });

  it('ayni renk-sayinin iki KOPYASI tekrar sayilmaz', () => {
    expect(benzersizMi(idler([t('kirmizi', 5, 'a'), t('kirmizi', 5, 'b')]))).toBe(true);
  });

  it('bos liste benzersiz', () => {
    expect(benzersizMi([])).toBe(true);
  });
});
