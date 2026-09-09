// Ceviri cekirdegi.
//
// Bu dosya SAF olmak zorunda (JSX yok, React yok): `zaman.ts` ve
// `hataMetinleri.ts` gibi saf moduller onu kullaniyor ve testleri React'siz
// kosuyor. Sozluklerin butunlugunu zaten derleme zamani kontrol ediyor
// (`EN_TAM`); burada calisma zamani davranisi test ediliyor.

import { describe, expect, it } from 'vitest';
import { DILLER, DIL_ADLARI, cevir, dilGecerliMi } from './cevir';
import tr from './tr.json';
import en from './en.json';

describe('dilGecerliMi', () => {
  it('destekledigimiz dilleri kabul ediyor', () => {
    expect(dilGecerliMi('tr')).toBe(true);
    expect(dilGecerliMi('en')).toBe(true);
  });

  it('tanimadigi degeri reddediyor', () => {
    expect(dilGecerliMi('de')).toBe(false);
    expect(dilGecerliMi('')).toBe(false);
    expect(dilGecerliMi('TR')).toBe(false);
  });

  // Cihazda saklanan tercih okunurken null gelebiliyor (ilk acilis).
  it('null reddediliyor', () => {
    expect(dilGecerliMi(null)).toBe(false);
  });
});

describe('cevir', () => {
  it('anahtari secili dilin metnine ceviriyor', () => {
    expect(cevir('tr', 'lobi.hizliOyna')).toBe(tr['lobi.hizliOyna']);
    expect(cevir('en', 'lobi.hizliOyna')).toBe(en['lobi.hizliOyna']);
  });

  it('iki dil ayni anahtarda farkli metin veriyor', () => {
    expect(cevir('tr', 'bekleme.masadanCik')).not.toBe(cevir('en', 'bekleme.masadanCik'));
  });

  it('yer tutucuyu dolduruyor', () => {
    const metin = cevir('tr', 'bekleme.bosKoltukSayisi', { sayi: 3 });
    expect(metin).toContain('3');
    expect(metin).not.toContain('{sayi}');
  });

  it('deger verilmezse kalip oldugu gibi kaliyor', () => {
    expect(cevir('tr', 'bekleme.bosKoltukSayisi')).toContain('{sayi}');
  });

  it('ayni yer tutucu birden fazla gecerse hepsi doluyor', () => {
    // Kalibin kendisi degisebilir; onemli olan hicbir {ad} artigi kalmamasi.
    const metin = cevir('tr', 'lobi.istatistik', { el: 12, galibiyet: 4 });
    expect(metin).toContain('12');
    expect(metin).toContain('4');
    expect(metin).not.toMatch(/\{\w+\}/);
  });
});

describe('sozlukler', () => {
  it('iki dil de ayni anahtar kumesini tasiyor', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(tr).sort());
  });

  it('hicbir metin bos degil', () => {
    for (const dil of DILLER) {
      const sozluk = dil === 'tr' ? tr : en;
      for (const [anahtar, metin] of Object.entries(sozluk)) {
        expect(metin, `${dil}/${anahtar} bos`).not.toBe('');
      }
    }
  });

  it('dil adlari kendi dillerinde', () => {
    expect(DIL_ADLARI.tr).toBe('Türkçe');
    expect(DIL_ADLARI.en).toBe('English');
  });
});
