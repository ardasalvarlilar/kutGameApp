// `yetkiler` — ekranin dugmeleri buradan besleniyor.
//
// Kural karari VERMIYOR (asil kontrol motorda), ama yanlis cevap verirse
// oyuncu yapabildigi bir hamleyi yapamiyor ya da yapamayacagi bir hamleyi
// deniyor. Iki surucu de (cevrimici/cevrimdisi) ayni fonksiyonu okuyor.
//
// Testin ozellikle kovaladigi iki sey:
//   - koltuk numarasi 0 OLMAK ZORUNDA DEGIL (cevrimici masada 2'ye de otururum)
//   - hicbir yetki saate bagli degil (§9 0.9 — talep penceresinin suresi yok)

import { describe, expect, it } from 'vitest';
import {
  VARSAYILAN_AYARLAR,
  oyuncuKaydiOlustur,
  type Faz,
  type OyuncuGorunumu,
  type OyuncuId,
  type PencereGorunumu,
} from '@kut/engine';
import { yetkiler } from './yetkiler';

interface Kurulum {
  readonly ben?: OyuncuId;
  readonly siradaki?: OyuncuId;
  readonly faz?: Faz;
  readonly pencere?: PencereGorunumu | null;
}

function gorunumKur(kurulum: Kurulum = {}): OyuncuGorunumu {
  return {
    ben: kurulum.ben ?? 0,
    tur: 1,
    ayarlar: VARSAYILAN_AYARLAR,
    baslayan: 0,
    siradaki: kurulum.siradaki ?? 0,
    faz: kurulum.faz ?? 'cekme',
    istakam: [],
    tasSayilari: oyuncuKaydiOlustur(() => 14),
    desteSayisi: 40,
    atikYiginlari: oyuncuKaydiOlustur(() => ({ ustTas: null, adet: 0 })),
    atikUstu: null,
    atikAdedi: 0,
    yer: [],
    acmisMi: oyuncuKaydiOlustur(() => false),
    calinanSayisi: oyuncuKaydiOlustur(() => 0),
    islerTasSayisi: oyuncuKaydiOlustur(() => 0),
    islerTaslarim: [],
    islemeYapabilirim: false,
    okeyFirsatlarim: [],
    pencere: kurulum.pencere ?? null,
    sonCalan: null,
    sonHareketler: [],
    sonHareketNo: 0,
    sonuc: null,
  };
}

function pencereKur(atan: OyuncuId, ekler: Partial<PencereGorunumu> = {}): PencereGorunumu {
  return { atan, tasId: 'kirmizi-7-a', talepler: [], ciftHakkim: false, ...ekler };
}

describe('cekebilir', () => {
  it('sira bendeyken ve cekme fazinda acik', () => {
    expect(yetkiler(gorunumKur({ ben: 0, siradaki: 0, faz: 'cekme' })).cekebilir).toBe(true);
  });

  it('sira baskasindayken kapali', () => {
    expect(yetkiler(gorunumKur({ ben: 0, siradaki: 1, faz: 'cekme' })).cekebilir).toBe(false);
  });

  it('atma fazinda kapali', () => {
    expect(yetkiler(gorunumKur({ ben: 0, siradaki: 0, faz: 'atma' })).cekebilir).toBe(false);
  });
});

describe('yerdenAlabilir', () => {
  it('sira bende, cekme fazinda ve pencere acikken acik', () => {
    const gorunum = gorunumKur({ ben: 0, siradaki: 0, faz: 'cekme', pencere: pencereKur(1) });
    expect(yetkiler(gorunum).yerdenAlabilir).toBe(true);
  });

  it('pencere kapaliyken kapali — alinacak canli tas yok', () => {
    const gorunum = gorunumKur({ ben: 0, siradaki: 0, faz: 'cekme', pencere: null });
    expect(yetkiler(gorunum).yerdenAlabilir).toBe(false);
  });

  it('sira baskasindayken kapali', () => {
    const gorunum = gorunumKur({ ben: 0, siradaki: 2, faz: 'cekme', pencere: pencereKur(1) });
    expect(yetkiler(gorunum).yerdenAlabilir).toBe(false);
  });
});

describe('atabilir', () => {
  it('yalnizca sira bende ve atma fazindayken', () => {
    expect(yetkiler(gorunumKur({ ben: 0, siradaki: 0, faz: 'atma' })).atabilir).toBe(true);
    expect(yetkiler(gorunumKur({ ben: 0, siradaki: 0, faz: 'cekme' })).atabilir).toBe(false);
    expect(yetkiler(gorunumKur({ ben: 0, siradaki: 1, faz: 'atma' })).atabilir).toBe(false);
  });
});

describe('talepEdebilir (§5)', () => {
  it('sira baskasindayken ve pencere acikken acik', () => {
    const gorunum = gorunumKur({ ben: 2, siradaki: 0, faz: 'cekme', pencere: pencereKur(1) });
    expect(yetkiler(gorunum).talepEdebilir).toBe(true);
  });

  it('sira BENDEYKEN kapali — sirasi gelen talep etmez, alir', () => {
    const gorunum = gorunumKur({ ben: 0, siradaki: 0, faz: 'cekme', pencere: pencereKur(1) });
    expect(yetkiler(gorunum).talepEdebilir).toBe(false);
  });

  it('tasi ATAN kendi tasini talep edemez', () => {
    const gorunum = gorunumKur({ ben: 1, siradaki: 0, faz: 'cekme', pencere: pencereKur(1) });
    expect(yetkiler(gorunum).talepEdebilir).toBe(false);
  });

  it('zaten talep etmisse tekrar edemez', () => {
    const gorunum = gorunumKur({
      ben: 2,
      siradaki: 0,
      faz: 'cekme',
      pencere: pencereKur(1, { talepler: [2] }),
    });
    expect(yetkiler(gorunum).talepEdebilir).toBe(false);
  });

  it('baskasi talep etmis olmasi beni engellemiyor', () => {
    const gorunum = gorunumKur({
      ben: 2,
      siradaki: 0,
      faz: 'cekme',
      pencere: pencereKur(1, { talepler: [3] }),
    });
    expect(yetkiler(gorunum).talepEdebilir).toBe(true);
  });

  it('pencere kapaliyken kapali', () => {
    const gorunum = gorunumKur({ ben: 2, siradaki: 0, pencere: null });
    expect(yetkiler(gorunum).talepEdebilir).toBe(false);
  });
});

describe('ciftTalepEdebilir (§9 0.10)', () => {
  it('cift hakki varsa ve sira bende degilse acik', () => {
    const gorunum = gorunumKur({
      ben: 2,
      siradaki: 0,
      pencere: pencereKur(1, { ciftHakkim: true }),
    });
    expect(yetkiler(gorunum).ciftTalepEdebilir).toBe(true);
  });

  it('cift hakki yoksa kapali', () => {
    const gorunum = gorunumKur({ ben: 2, siradaki: 0, pencere: pencereKur(1) });
    expect(yetkiler(gorunum).ciftTalepEdebilir).toBe(false);
  });

  it('sira bendeyken kapali', () => {
    const gorunum = gorunumKur({
      ben: 0,
      siradaki: 0,
      pencere: pencereKur(1, { ciftHakkim: true }),
    });
    expect(yetkiler(gorunum).ciftTalepEdebilir).toBe(false);
  });

  // Normal talep "zaten talep ettim" diye kapanir, cift talebi kapanmaz:
  // cift bir talep degil, hamlenin kendisi.
  it('normal talebini kullanmis olmak cift hakkini kapatmiyor', () => {
    const gorunum = gorunumKur({
      ben: 2,
      siradaki: 0,
      pencere: pencereKur(1, { talepler: [2], ciftHakkim: true }),
    });
    expect(yetkiler(gorunum).talepEdebilir).toBe(false);
    expect(yetkiler(gorunum).ciftTalepEdebilir).toBe(true);
  });
});

describe('koltuk numarasi 0 olmak zorunda degil', () => {
  it('2 numarali koltukta oturan da kendi sirasini goruyor', () => {
    const gorunum = gorunumKur({ ben: 2, siradaki: 2, faz: 'atma' });
    expect(yetkiler(gorunum).atabilir).toBe(true);
  });

  it('yetkiler `ben` alanindan turuyor, sabit koltuktan degil', () => {
    for (const koltuk of [0, 1, 2, 3] as const) {
      const gorunum = gorunumKur({ ben: koltuk, siradaki: koltuk, faz: 'cekme' });
      expect(yetkiler(gorunum).cekebilir).toBe(true);
    }
  });
});
