import { describe, expect, it } from 'vitest';
import { normalTas, type Renk, type Sayi, type Tas } from '@kut/engine';
import {
  SATIR_SAYISI,
  ayir,
  duzenGruplari,
  duzenOlustur,
  duzenTazele,
  duzendekiTaslar,
  kapasite,
  tasiTasi,
  topla,
  type Duzen,
} from './duzen';

const t = (renk: Renk, sayi: Sayi, kopya: 'a' | 'b' = 'a'): Tas => normalTas(renk, sayi, kopya);

const SUTUN = 6;
const a = t('kirmizi', 1);
const b = t('kirmizi', 2);
const c = t('kirmizi', 3);
const d = t('mavi', 7);
const e = t('mavi', 8);
const f = t('mavi', 9);
const el = [a, b, c, d, e, f];
const id = (tas: Tas) => tas.id;

/** Okunabilir ozet: bos slot '.', dolu slot tasin kisa adi. */
function ozet(duzen: Duzen): string[] {
  const satirlar: string[] = [];
  for (let satir = 0; satir < SATIR_SAYISI; satir++) {
    const hucreler: string[] = [];
    for (let sutun = 0; sutun < SUTUN; sutun++) {
      const slot = duzen[satir * SUTUN + sutun] ?? null;
      hucreler.push(slot === null ? '.' : (el.find((tas) => tas.id === slot)?.id.slice(0, 3) ?? '?'));
    }
    satirlar.push(hucreler.join(' '));
  }
  return satirlar;
}

describe('duzenOlustur', () => {
  it('gruplari aralarinda bir bosluk birakarak yerlestirir', () => {
    const duzen = duzenOlustur([[id(a), id(b), id(c)], [id(d), id(e)]], SUTUN);
    expect(ozet(duzen)).toEqual(['kir kir kir . mav mav', '. . . . . .']);
  });

  it('satira sigmayan grubu alt satira alir', () => {
    const duzen = duzenOlustur([[id(a), id(b), id(c)], [id(d), id(e), id(f)]], SUTUN);
    expect(ozet(duzen)).toEqual(['kir kir kir . . .', 'mav mav mav . . .']);
  });

  it('izgara kapasitesi iki sira x sutun', () => {
    expect(duzenOlustur([], SUTUN)).toHaveLength(kapasite(SUTUN));
    expect(kapasite(SUTUN)).toBe(12);
  });
});

describe('duzenGruplari', () => {
  it('bitisik taslari grup, bosluklari sinir sayar', () => {
    const duzen = duzenOlustur([[id(a), id(b), id(c)], [id(d), id(e)]], SUTUN);
    expect(duzenGruplari(duzen, SUTUN)).toEqual([
      [id(a), id(b), id(c)],
      [id(d), id(e)],
    ]);
  });

  it('iki siradaki gruplari da bulur', () => {
    const duzen = duzenOlustur([[id(a), id(b), id(c)], [id(d), id(e), id(f)]], SUTUN);
    expect(duzenGruplari(duzen, SUTUN)).toHaveLength(2);
  });

  it('yerlestirme ve okuma birbirinin tersi', () => {
    const gruplar = [[id(a), id(b)], [id(c)], [id(d), id(e), id(f)]];
    expect(duzenGruplari(duzenOlustur(gruplar, SUTUN), SUTUN)).toEqual(gruplar);
  });
});

describe('tasiTasi — surukleme', () => {
  const duzen = duzenOlustur([[id(a), id(b), id(c)]], SUTUN);

  it('bos slota tasir', () => {
    const sonuc = tasiTasi(duzen, 0, 5);
    expect(ozet(sonuc)).toEqual(['. kir kir . . kir', '. . . . . .']);
  });

  it('dolu slotta yer degistirir', () => {
    const sonuc = tasiTasi(duzen, 0, 2);
    expect(duzendekiTaslar(sonuc)).toEqual([id(c), id(b), id(a)]);
  });

  it('alt siraya tasinabilir', () => {
    const sonuc = tasiTasi(duzen, 0, SUTUN);
    expect(duzenGruplari(sonuc, SUTUN)).toEqual([[id(b), id(c)], [id(a)]]);
  });

  it('bos slottan tasima yok sayilir', () => {
    expect(tasiTasi(duzen, 4, 5)).toBe(duzen);
  });

  it('izgara disina tasima yok sayilir', () => {
    expect(tasiTasi(duzen, 0, 99)).toBe(duzen);
    expect(tasiTasi(duzen, 0, -1)).toBe(duzen);
  });
});

describe('duzenTazele', () => {
  it('yere inen ya da atilan tas duzenden duser', () => {
    const duzen = duzenOlustur([[id(a), id(b), id(c)]], SUTUN);
    const sonuc = duzenTazele(duzen, [b, c], SUTUN);
    expect(duzendekiTaslar(sonuc)).toEqual([id(b), id(c)]);
  });

  it('cekilen tas sona, kendi basina gelir — bosluklar bozulmaz', () => {
    const duzen = duzenOlustur([[id(a), id(b)], [id(c)]], SUTUN);
    const sonuc = duzenTazele(duzen, [a, b, c, d], SUTUN);
    expect(duzenGruplari(sonuc, SUTUN)).toEqual([[id(a), id(b)], [id(c)], [id(d)]]);
  });

  it('sutun sayisi degisince izgarayi yeniden kurar, taslari korur', () => {
    const dar = duzenOlustur([[id(a), id(b), id(c)]], 4);
    const genis = duzenTazele(dar, [a, b, c], 10);
    expect(genis).toHaveLength(kapasite(10));
    expect(duzendekiTaslar(genis)).toEqual([id(a), id(b), id(c)]);
  });

  it('yer kalmayinca bosluklari kapatip sigdirir', () => {
    const dolu = duzenOlustur(el.map((tas) => [id(tas)]), 3);
    const sonuc = duzenTazele(dolu, el, 3);
    expect(duzendekiTaslar(sonuc).length).toBe(el.length);
  });

  it('bos duzene dagitim yapilir', () => {
    expect(duzendekiTaslar(duzenTazele([], el, SUTUN))).toEqual(el.map(id));
  });
});

describe('ayir ve topla', () => {
  it('ayir secilenleri kendi grubuna alir', () => {
    const duzen = duzenOlustur([[id(a), id(b), id(c), id(d)]], SUTUN);
    const sonuc = ayir(duzen, [id(a), id(c)], SUTUN);
    expect(duzenGruplari(sonuc, SUTUN)).toEqual([
      [id(b), id(d)],
      [id(a), id(c)],
    ]);
  });

  it('topla butun bosluklari kapatir', () => {
    const duzen = duzenOlustur([[id(a)], [id(b)], [id(c)]], SUTUN);
    expect(duzenGruplari(topla(duzen, SUTUN), SUTUN)).toEqual([[id(a), id(b), id(c)]]);
  });
});
