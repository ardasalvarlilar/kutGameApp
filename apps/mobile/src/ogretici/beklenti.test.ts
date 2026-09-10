import { describe, expect, it } from 'vitest';
import {
  beklentiKarsilandi,
  yerTutucularOynasin,
  type Beklenti,
  type OyunOzeti,
} from './beklenti';

const BOS: OyunOzeti = {
  actim: false,
  siraBende: false,
  atmaFazinda: false,
  yerdekiTasSayisi: 0,
  istakamdakiOkeySayisi: 0,
  talepEdebilirim: false,
  talepEttim: false,
};

const ozet = (ekler: Partial<OyunOzeti>): OyunOzeti => ({ ...BOS, ...ekler });

describe('beklentiKarsilandi', () => {
  it('anlatan adim kendiliginden gecilmiyor — ILERI gerekiyor', () => {
    expect(beklentiKarsilandi('ileri', BOS, BOS)).toBe(false);
  });

  describe('actim', () => {
    it('bu adimda acildiysa gecer', () => {
      expect(beklentiKarsilandi('actim', ozet({ actim: false }), ozet({ actim: true }))).toBe(true);
    });

    // Olcut "acmis olmak" degil "BU ADIMDA acmis olmak": onceki adimda
    // acilmissa adim aninda atlanirdi.
    it('adim baslarken zaten acilmissa gecmez', () => {
      expect(beklentiKarsilandi('actim', ozet({ actim: true }), ozet({ actim: true }))).toBe(false);
    });
  });

  describe('attim', () => {
    it('sira bendeyken baskasina gecmisse gecer', () => {
      expect(
        beklentiKarsilandi('attim', ozet({ siraBende: true }), ozet({ siraBende: false })),
      ).toBe(true);
    });

    it('sira hala bendeyse gecmez', () => {
      expect(
        beklentiKarsilandi('attim', ozet({ siraBende: true }), ozet({ siraBende: true })),
      ).toBe(false);
    });

    // TOLERANS: kullanici anlatilan adimin ustune tasi ERKEN atabiliyor
    // (indirdikten sonra sirayi bitirmek dogal refleks). Olcut "bu adimda
    // atti" olsaydi beklenti bir daha hic karsilanmaz, ogretici masayi donuk
    // tutarak kilitlenirdi — gercekten yasandi.
    it('adim baslamadan once atmis olsa bile gecer', () => {
      expect(
        beklentiKarsilandi('attim', ozet({ siraBende: false }), ozet({ siraBende: false })),
      ).toBe(true);
    });
  });

  describe('cektim', () => {
    it('cekme fazindan atma fazina gecince gecer', () => {
      expect(
        beklentiKarsilandi(
          'cektim',
          ozet({ siraBende: true, atmaFazinda: false }),
          ozet({ siraBende: true, atmaFazinda: true }),
        ),
      ).toBe(true);
    });

    it('hala cekme fazindaysa bekler', () => {
      expect(
        beklentiKarsilandi(
          'cektim',
          ozet({ siraBende: true, atmaFazinda: false }),
          ozet({ siraBende: true, atmaFazinda: false }),
        ),
      ).toBe(false);
    });

    // Baslayan zaten `atma` fazinda basliyor (§1); o an bu beklenti
    // kendiliginden karsilanmis sayilmamali.
    it('adim baslarken zaten atma fazindaysa gecmez', () => {
      expect(
        beklentiKarsilandi(
          'cektim',
          ozet({ siraBende: true, atmaFazinda: true }),
          ozet({ siraBende: true, atmaFazinda: true }),
        ),
      ).toBe(false);
    });
  });

  describe('isledim', () => {
    it('yerdeki tas sayisi arttiysa gecer', () => {
      expect(
        beklentiKarsilandi('isledim', ozet({ yerdekiTasSayisi: 6 }), ozet({ yerdekiTasSayisi: 7 })),
      ).toBe(true);
    });

    it('degismediyse gecmez', () => {
      expect(
        beklentiKarsilandi('isledim', ozet({ yerdekiTasSayisi: 6 }), ozet({ yerdekiTasSayisi: 6 })),
      ).toBe(false);
    });
  });

  describe('okeyAldim', () => {
    it('istakaya okey geldiyse gecer', () => {
      expect(
        beklentiKarsilandi(
          'okeyAldim',
          ozet({ istakamdakiOkeySayisi: 0 }),
          ozet({ istakamdakiOkeySayisi: 1 }),
        ),
      ).toBe(true);
    });

    it('elde zaten okey varsa ve artmadiysa gecmez', () => {
      expect(
        beklentiKarsilandi(
          'okeyAldim',
          ozet({ istakamdakiOkeySayisi: 1 }),
          ozet({ istakamdakiOkeySayisi: 1 }),
        ),
      ).toBe(false);
    });
  });

  describe('siramGeldi', () => {
    it('sira bana donunce gecer', () => {
      expect(
        beklentiKarsilandi('siramGeldi', ozet({ siraBende: false }), ozet({ siraBende: true })),
      ).toBe(true);
    });

    it('hala baskasindaysa bekler', () => {
      expect(
        beklentiKarsilandi('siramGeldi', ozet({ siraBende: false }), ozet({ siraBende: false })),
      ).toBe(false);
    });
  });

  describe('calabilirim / talepEttim', () => {
    it('talep edilebilir hale gelince gecer', () => {
      expect(beklentiKarsilandi('calabilirim', BOS, ozet({ talepEdebilirim: true }))).toBe(true);
    });

    // Olcut "tasi aldim" DEGIL: tas oncelik sirasina gore geliyor (§5) ve
    // daha oncelikli bir yer tutucu onu gecebilir. Ogretici kullanicinin
    // elinde olmayan bir sonucu beklememeli.
    it('talep dugmesine basinca gecer — tasin gelmesini beklemiyor', () => {
      expect(beklentiKarsilandi('talepEttim', BOS, ozet({ talepEttim: true }))).toBe(true);
    });

    it('basilmadiysa bekler', () => {
      expect(beklentiKarsilandi('talepEttim', BOS, ozet({ talepEdebilirim: true }))).toBe(false);
    });
  });

  describe('talebimSonuclandi', () => {
    it('bekleyen talep kalkinca gecer', () => {
      expect(
        beklentiKarsilandi('talebimSonuclandi', ozet({ talepEttim: true }), ozet({ talepEttim: false })),
      ).toBe(true);
    });

    it('talep hala bekliyorsa gecmez', () => {
      expect(
        beklentiKarsilandi('talebimSonuclandi', ozet({ talepEttim: true }), ozet({ talepEttim: true })),
      ).toBe(false);
    });

    it('hic talep yoksa kendiliginden gecmiyor', () => {
      expect(beklentiKarsilandi('talebimSonuclandi', BOS, BOS)).toBe(false);
    });
  });
});

describe('yerTutucularOynasin', () => {
  it('yalnizca masanin ilerlemesini bekleyen adimlarda masa isliyor', () => {
    expect(yerTutucularOynasin('siramGeldi')).toBe(true);
    expect(yerTutucularOynasin('calabilirim')).toBe(true);
  });

  // Kullanicidan hamle bekleyen adimda masa DURMALI: balonu okurken rakip
  // hamlesi ekrani degistirirse adimin anlattigi durum dagiliyor.
  it('kullanicidan hamle bekleyen adimlarda masa duruyor', () => {
    const duranlar: readonly Beklenti[] = [
      'ileri',
      'actim',
      'attim',
      'cektim',
      'isledim',
      'okeyAldim',
      'talepEttim',
    ];
    for (const beklenti of duranlar) {
      expect(yerTutucularOynasin(beklenti), beklenti).toBe(false);
    }
  });
});
