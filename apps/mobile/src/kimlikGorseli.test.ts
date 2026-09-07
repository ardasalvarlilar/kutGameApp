import { describe, expect, it } from 'vitest';
import { avatarRengi, basHarfler } from './kimlikGorseli';

// Avatarin tek "karar"i bu; gerisi stil. Varsayilan misafir adi
// ("Oyuncu 0908") yuzunden ayri bir kural var: rakamla baslayan kelime
// bas harf sayilmiyor.

describe('basHarfler', () => {
  it('iki kelimeli adda iki harf', () => {
    expect(basHarfler('Arda Şalvarlılar')).toBe('AŞ');
  });

  it('tek kelimede tek harf', () => {
    expect(basHarfler('Arda')).toBe('A');
  });

  it('rakamla baslayan kelime sayilmaz — "Oyuncu 0908" → "O"', () => {
    expect(basHarfler('Oyuncu 0908')).toBe('O');
  });

  it('uc kelimede ilk ve SON kelimenin harfi', () => {
    expect(basHarfler('Ali Veli Deli')).toBe('AD');
  });

  it('Turkce buyuk harf kurali: "i" → "İ"', () => {
    expect(basHarfler('ismail')).toBe('İ');
  });

  it('harf yoksa soru isareti', () => {
    expect(basHarfler('1234')).toBe('?');
    expect(basHarfler('   ')).toBe('?');
  });
});

describe('avatarRengi', () => {
  it('ayni ad ayni rengi verir', () => {
    expect(avatarRengi('Arda')).toBe(avatarRengi('Arda'));
  });

  it('farkli adlar genelde farkli renk alir', () => {
    const renkler = new Set(
      ['Arda', 'Mehmet', 'Zeynep', 'Kerem', 'Selin', 'Deniz'].map(avatarRengi),
    );
    expect(renkler.size).toBeGreaterThan(1);
  });
});
