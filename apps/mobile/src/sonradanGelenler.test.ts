import { describe, expect, it } from 'vitest';
import { normalTas, type Renk, type Sayi, type Tas } from '@kut/engine';
import { BOS_SONRADAN_GELENLER, sonradanGelenlerGuncelle } from './sonradanGelenler';

const t = (renk: Renk, sayi: Sayi, kopya: 'a' | 'b' = 'a'): Tas => normalTas(renk, sayi, kopya);
const id = (tas: Tas) => tas.id;

const a = t('kirmizi', 1);
const b = t('kirmizi', 2);
const c = t('kirmizi', 3);
const cekilen = t('mavi', 7);
const ceza = t('mavi', 8);

describe('sonradanGelenlerGuncelle', () => {
  it('elin basinda dagitilan taslar hic isaretlenmez', () => {
    const sonuc = sonradanGelenlerGuncelle(BOS_SONRADAN_GELENLER, [a, b, c], true);
    expect(sonuc.gelenler.size).toBe(0);
    expect(sonuc.bilinenler).toEqual(new Set([id(a), id(b), id(c)]));
  });

  it('elin basindan sonra gelen tas isaretlenir', () => {
    const bas = sonradanGelenlerGuncelle(BOS_SONRADAN_GELENLER, [a, b, c], true);
    const sonra = sonradanGelenlerGuncelle(bas, [a, b, c, cekilen], false);
    expect(sonra.gelenler).toEqual(new Set([id(cekilen)]));
  });

  it('calma + ceza ayni anda gelirse ikisi de isaretlenir', () => {
    const bas = sonradanGelenlerGuncelle(BOS_SONRADAN_GELENLER, [a, b, c], true);
    const sonra = sonradanGelenlerGuncelle(bas, [a, b, c, cekilen, ceza], false);
    expect(sonra.gelenler).toEqual(new Set([id(cekilen), id(ceza)]));
  });

  it('isaretli tas elden cikinca isaret de kalkar', () => {
    const bas = sonradanGelenlerGuncelle(BOS_SONRADAN_GELENLER, [a, b, c], true);
    const geldi = sonradanGelenlerGuncelle(bas, [a, b, c, cekilen], false);
    const atildi = sonradanGelenlerGuncelle(geldi, [a, b, c], false);
    expect(atildi.gelenler.size).toBe(0);
  });

  it('isaret BIRIKMEZ — yeni tas gelince eskisinin isareti duser', () => {
    // Sikayet ozetle buydu: siyah11'i cektim, sonra baska bir tas daha
    // cektim; ikisi de isaretli kaliyordu. Isaretli olmasi gereken yalnizca
    // EN SON gelen.
    const bas = sonradanGelenlerGuncelle(BOS_SONRADAN_GELENLER, [a], true);
    const bir = sonradanGelenlerGuncelle(bas, [a, b], false);
    const iki = sonradanGelenlerGuncelle(bir, [a, b, c], false);
    expect(iki.gelenler).toEqual(new Set([id(c)]));
  });

  it('bildirilen senaryo: cek, at, tur don, tekrar cek — yalnizca son cekilen isaretli', () => {
    const bas = sonradanGelenlerGuncelle(BOS_SONRADAN_GELENLER, [a, b, c], true);
    const cekildi = sonradanGelenlerGuncelle(bas, [a, b, c, cekilen], false); // "siyah11" cektim
    const atildi = sonradanGelenlerGuncelle(cekildi, [a, c, cekilen], false); // b'yi attim
    expect(atildi.gelenler).toEqual(new Set([id(cekilen)])); // hala isaretli, dogru
    const tekrarCekildi = sonradanGelenlerGuncelle(atildi, [a, c, cekilen, ceza], false);
    expect(tekrarCekildi.gelenler).toEqual(new Set([id(ceza)])); // artik SADECE yeni tas
  });

  it('ara turlarda (baska oyuncu oynarken) isaret degismeden kalir', () => {
    const bas = sonradanGelenlerGuncelle(BOS_SONRADAN_GELENLER, [a, b], true);
    const geldi = sonradanGelenlerGuncelle(bas, [a, b, c], false);
    // Istakam degismedi ama baska bir oyuncunun hamlesiyle yeni bir
    // gorunum paketi geldi — c hala isaretli kalmali.
    const sonra = sonradanGelenlerGuncelle(geldi, [a, b, c], false);
    expect(sonra.gelenler).toEqual(new Set([id(c)]));
  });

  it('yeni el hepsini sifirlar — ayni tur yeniden dagitilsa bile', () => {
    const bas = sonradanGelenlerGuncelle(BOS_SONRADAN_GELENLER, [a, b, c], true);
    const geldi = sonradanGelenlerGuncelle(bas, [a, b, c, cekilen], false);
    const yeniEl = sonradanGelenlerGuncelle(geldi, [a, b, cekilen], true);
    expect(yeniEl.gelenler.size).toBe(0);
    expect(yeniEl.bilinenler).toEqual(new Set([id(a), id(b), id(cekilen)]));
  });

  it('degisiklik yoksa AYNI referansi dondurur', () => {
    const bas = sonradanGelenlerGuncelle(BOS_SONRADAN_GELENLER, [a, b, c], true);
    const tekrar = sonradanGelenlerGuncelle(bas, [a, b, c], false);
    expect(tekrar).toBe(bas);
  });

  it('bos elde yeni el basi degisiklik uretmez', () => {
    const sonuc = sonradanGelenlerGuncelle(BOS_SONRADAN_GELENLER, [], true);
    expect(sonuc).toBe(BOS_SONRADAN_GELENLER);
  });
});
