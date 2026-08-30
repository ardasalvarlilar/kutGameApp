import { describe, expect, it } from 'vitest';
import { adSorunu } from '../src/servisler/adFiltresi.js';

describe('ad filtresi', () => {
  it('sıradan adları geçiriyor', () => {
    for (const ad of ['Arda', 'Ayşe', 'Mehmet 42', 'okey_ustasi', 'Zeynep Ç.']) {
      expect(adSorunu(ad)).toBeNull();
    }
  });

  it('kufru yakaliyor', () => {
    expect(adSorunu('siktir')).toBe('uygunsuz');
    expect(adSorunu('fuck you')).toBe('uygunsuz');
  });

  it('rakamla gizlenen kufru de yakaliyor', () => {
    // "s1k71r" gibi yazimlar filtreyi atlatmanin en yaygin yolu.
    expect(adSorunu('s1k71r')).toBe('uygunsuz');
    expect(adSorunu('4mk')).toBe('uygunsuz');
  });

  it('gorevli taklidini engelliyor', () => {
    expect(adSorunu('Admin')).toBe('sahiplenme');
    expect(adSorunu('kut destek')).toBe('sahiplenme');
  });

  it('bos ve isaretten ibaret adlari reddediyor', () => {
    expect(adSorunu(' a ')).toBe('bos');
    expect(adSorunu('!!!!')).toBe('sadece-isaret');
  });

  it('Turkce buyuk I tuzagina dusmuyor', () => {
    // 'İ'.toLowerCase() Ingilizce'de birlesik noktali bir harf uretiyor;
    // locale vermeden karsilastirma sessizce kayiyor.
    expect(adSorunu('SİKTİR')).toBe('uygunsuz');
  });
});
