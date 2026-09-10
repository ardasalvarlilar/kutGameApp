import { describe, expect, it } from 'vitest';
import { normalTas, type Renk, type Sayi, type Tas, type TasHareketi } from '@kut/engine';
import { atikAltindaki } from './atikBellegi';

// Ustteki tas havadayken ya da parmaktayken obek ALTINDAKI tasi ciziyor.
// Eskiden orada gri bir kapali tas cikiyordu. KURALLAR.md §10.3 geregi
// projeksiyon alttaki tasi vermiyor; sira oyuncunun gordugu hareketlerden
// kuruluyor.

const t = (renk: Renk, sayi: Sayi): Tas => normalTas(renk, sayi, 'a');
const k8 = t('kirmizi', 8);
const m13 = t('mavi', 13);
const s5 = t('sari', 5);

let sira = 0;
const atma = (oyuncu: 0 | 1 | 2 | 3, tas: Tas): TasHareketi => ({
  sira: ++sira,
  oyuncu,
  tip: 'atma',
  tas,
});
const desteden = (oyuncu: 0 | 1 | 2 | 3): TasHareketi => ({
  sira: ++sira,
  oyuncu,
  tip: 'cekim',
  kaynak: 'deste',
  tas: null,
  kimden: null,
});
const yerden = (oyuncu: 0 | 1 | 2 | 3, tas: Tas, kimden: 0 | 1 | 2 | 3): TasHareketi => ({
  sira: ++sira,
  oyuncu,
  tip: 'cekim',
  kaynak: 'atik',
  tas,
  kimden,
});

describe('atikAltindaki', () => {
  // Bildirilen senaryo: k8'i attim; sagimdaki desteden cekip m13 atti; onun
  // sagindaki m13'u aldi ve AYNI SIRADA s5'i atti. s5 havadayken obekte
  // benim k8'im gorunmeli — gri bir yer tutucu degil.
  it('alinan tasin yerine atilan tas havadayken alttaki eski tas gorunur', () => {
    const hareketler = [
      atma(0, k8),
      desteden(3),
      atma(3, m13),
      yerden(2, m13, 3),
      atma(2, s5),
    ];
    expect(atikAltindaki(hareketler, s5, 2)?.id).toBe(k8.id);
  });

  it('art arda atilanlarda bir onceki tas alttadir', () => {
    expect(atikAltindaki([atma(0, k8), desteden(3), atma(3, m13)], m13, 2)?.id).toBe(k8.id);
  });

  it('calinan tas obekten cikar', () => {
    const calma: TasHareketi = {
      sira: ++sira,
      oyuncu: 1,
      tip: 'cekim',
      kaynak: 'calma',
      tas: m13,
      kimden: 3,
    };
    const hareketler = [atma(0, k8), desteden(3), atma(3, m13), desteden(2), calma, atma(2, s5)];
    expect(atikAltindaki(hareketler, s5, 2)?.id).toBe(k8.id);
  });

  it('tek tas varsa alti yoktur', () => {
    expect(atikAltindaki([atma(0, k8)], k8, 1)).toBe(null);
  });

  // Onceki elden kalan hareketler listede dursa bile: masada tek tas varsa
  // altinda bir sey yoktur.
  it('masadaki adet 2den azsa listeye bakilmaz', () => {
    expect(atikAltindaki([atma(0, k8), atma(3, m13)], m13, 1)).toBe(null);
  });

  it('obek bossa alti yoktur', () => {
    expect(atikAltindaki([atma(0, k8), yerden(3, k8, 0)], null, 0)).toBe(null);
  });

  it('alttaki tasin atisi listede yoksa tahmin etmez', () => {
    expect(atikAltindaki([desteden(3), atma(3, m13)], m13, 2)).toBe(null);
  });

  it('listenin ustu motorunkiyle uyusmuyorsa tahmin etmez', () => {
    expect(atikAltindaki([atma(0, k8), atma(3, m13)], s5, 3)).toBe(null);
  });
});
