import { describe, expect, it } from 'vitest';
import { normalTas, type OyuncuId, type TasHareketi } from '@kut/engine';
import { hareketUcuslari, type UcusOrtami } from './ucuslar';

const mavi8 = normalTas('mavi', 8, 'a');
const kirmizi9 = normalTas('kirmizi', 9, 'a');

const MERKEZ = { x: 100, y: 50 };
const PER = { x: 60, y: 20 };
/** Koltuk basina ayirt edilebilir bir nokta. */
const koltuk = (oyuncu: OyuncuId) => ({ x: oyuncu * 10, y: oyuncu * 10 });

const ORTAM: UcusOrtami = { merkez: MERKEZ, koltuk, per: () => PER };

describe('hareketUcuslari — cekim', () => {
  it('tas ALANIN koltuguna ucar — sirasi gelene degil', () => {
    // KURALLAR.md §5: calinan tasi sirasi gelen oyuncu almiyor. Eskiden
    // ucus hep sirasi gelene gidiyordu ve calinan tas yanlis kisiye ucuyordu.
    const hareketler: readonly TasHareketi[] = [
      { sira: 7, tip: 'cekim', oyuncu: 3, kaynak: 'calma', tas: mavi8, kimden: 1 },
    ];
    const [ucus] = hareketUcuslari(hareketler, ORTAM);
    expect(ucus?.baslangic).toEqual(MERKEZ);
    expect(ucus?.bitis).toEqual(koltuk(3));
  });

  it('yerden alinan ve calinan tas ACIK ucar', () => {
    const hareketler: readonly TasHareketi[] = [
      { sira: 1, tip: 'cekim', oyuncu: 2, kaynak: 'atik', tas: mavi8, kimden: 1 },
      { sira: 2, tip: 'cekim', oyuncu: 3, kaynak: 'calma', tas: mavi8, kimden: 1 },
    ];
    expect(hareketUcuslari(hareketler, ORTAM).every((ucus) => ucus.tas !== null)).toBe(true);
  });

  it('desteden gelen ve ceza tasi KAPALI ucar', () => {
    const hareketler: readonly TasHareketi[] = [
      { sira: 1, tip: 'cekim', oyuncu: 2, kaynak: 'deste', tas: null, kimden: null },
      { sira: 2, tip: 'cekim', oyuncu: 3, kaynak: 'ceza', tas: null, kimden: null },
    ];
    expect(hareketUcuslari(hareketler, ORTAM).every((ucus) => ucus.tas === null)).toBe(true);
  });
});

describe('hareketUcuslari — atma', () => {
  it('atilan tas oyuncudan ORTAYA ucar ve aciktir', () => {
    const hareketler: readonly TasHareketi[] = [
      { sira: 4, tip: 'atma', oyuncu: 1, tas: mavi8 },
    ];
    const [ucus] = hareketUcuslari(hareketler, ORTAM);
    expect(ucus?.baslangic).toEqual(koltuk(1));
    expect(ucus?.bitis).toEqual(MERKEZ);
    expect(ucus?.tas).toEqual(mavi8);
  });
});

describe('hareketUcuslari — isleme (KURALLAR.md §6)', () => {
  it('tas isleyenin koltugundan HEDEF PERE gider', () => {
    const hareketler: readonly TasHareketi[] = [
      { sira: 5, tip: 'isleme', oyuncu: 1, perId: 7, taslar: [mavi8] },
    ];
    const [ucus] = hareketUcuslari(hareketler, ORTAM);
    expect(ucus?.baslangic).toEqual(koltuk(1));
    expect(ucus?.bitis).toEqual(PER);
    expect(ucus?.tas).toEqual(mavi8);
  });

  it('birden cok tas islenirse her biri ayri ucar', () => {
    const hareketler: readonly TasHareketi[] = [
      { sira: 5, tip: 'isleme', oyuncu: 1, perId: 7, taslar: [mavi8, kirmizi9] },
    ];
    const ucuslar = hareketUcuslari(hareketler, ORTAM);
    expect(ucuslar).toHaveLength(2);
    expect(new Set(ucuslar.map((ucus) => ucus.anahtar)).size).toBe(2);
  });

  it('hedef peri ortam belirler — sahibinin koltugu degil', () => {
    // §6: baskasinin perine de islenebilir. Tas peri INDIRENE degil PERE gider.
    const perNoktasi = { x: 999, y: 111 };
    const hareketler: readonly TasHareketi[] = [
      { sira: 5, tip: 'isleme', oyuncu: 1, perId: 42, taslar: [mavi8] },
    ];
    const [ucus] = hareketUcuslari(hareketler, { ...ORTAM, per: () => perNoktasi });
    expect(ucus?.bitis).toEqual(perNoktasi);
  });
});

describe('hareketUcuslari — sira', () => {
  it('cekis atistan ONCE oynar', () => {
    // Kullanicinin bildirdigi hata buydu: atis animasyonu once oynuyordu.
    const hareketler: readonly TasHareketi[] = [
      { sira: 1, tip: 'cekim', oyuncu: 2, kaynak: 'deste', tas: null, kimden: null },
      { sira: 2, tip: 'isleme', oyuncu: 2, perId: 7, taslar: [kirmizi9] },
      { sira: 3, tip: 'atma', oyuncu: 2, tas: mavi8 },
    ];
    const ucuslar = hareketUcuslari(hareketler, ORTAM);
    // Cekis ortadan gelir, atis ortaya gider: uclara bakinca sira okunuyor.
    expect(ucuslar[0]?.baslangic).toEqual(MERKEZ);
    expect(ucuslar[1]?.bitis).toEqual(PER);
    expect(ucuslar[2]?.bitis).toEqual(MERKEZ);
  });

  it('anahtarlar benzersiz — ayni tas iki kez ucarsa animasyon bastan baslar', () => {
    const uret = (sira: number): readonly TasHareketi[] => [
      { sira, tip: 'cekim', oyuncu: 3, kaynak: 'calma', tas: mavi8, kimden: 1 },
    ];
    const anahtarlar = [...hareketUcuslari(uret(1), ORTAM), ...hareketUcuslari(uret(2), ORTAM)].map(
      (ucus) => ucus.anahtar,
    );
    expect(new Set(anahtarlar).size).toBe(2);
  });

  it('hareket yoksa ucus da yok', () => {
    expect(hareketUcuslari([], ORTAM)).toHaveLength(0);
  });
});
