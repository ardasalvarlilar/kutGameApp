// Ekran animasyonu icin uretilen tas hareketleri (`sonHareketler`).
//
// Bunlar KURAL DEGIL; motorun ekrana "az once ne oldu" demesinin yolu.
// Ihtiyac dort ayri hatadan dogdu ve dordu de burada siniyor:
//
//  1. Yerden alinan tas herkesin gordugu bir tastir; kapali ucurmak
//     "nereye gitti"yi gizliyordu.
//  2. Calmanin CEZA TASI hic gorunmuyordu — istaka sessizce iki tas buyuyordu.
//  3. Tek bir `CEK_DESTEDEN` UC hareket uretebiliyor (ceken + calan + ceza);
//     sayac farkindan bunlari cikarmak mumkun degildi.
//  4. SIRA yanlisti: ekran atisi ayri bir effect'te sayac farkindan
//     cikardigi icin atis, cekisten ONCE oynuyordu. Artik ikisi ayni
//     listede ve sirayi motor veriyor.

import { describe, expect, it } from 'vitest';
import { reduce } from '../src/reduce';
import { durumAl, durumKur, pencereKur, t, yerPeri } from './yardimci';

const mavi8 = t('mavi', 8);
const dolgu = [t('sari', 2), t('sari', 3), t('sari', 4), t('sari', 5)];

/** Dort oyuncuya cakismayan ikiser tas — kisa turlar oynatmak icin. */
const dagitim = {
  0: [t('kirmizi', 1), t('kirmizi', 2), t('kirmizi', 3)],
  1: [t('siyah', 1), t('siyah', 2), t('siyah', 3)],
  2: [t('mavi', 1), t('mavi', 2), t('mavi', 3)],
  3: [t('sari', 9), t('sari', 10), t('sari', 11)],
} as const;

/** Yalnizca `sira`dan arindirilmis hareketler — karsilastirmayi okunur tutuyor. */
function sirasiz(durum: ReturnType<typeof durumKur>, sonN: number) {
  return durum.sonHareketler.slice(-sonN).map(({ sira: _sira, ...geri }) => geri);
}

describe('yerden alma — KURALLAR.md §5 bedelsiz hak', () => {
  it('alinan tas ACIK: herkes masada gormustu', () => {
    const durum = durumKur({
      siradaki: 2,
      faz: 'cekme',
      istakalar: { 2: [t('kirmizi', 5)] },
      atikYiginlari: { 1: [mavi8] },
      pencere: pencereKur(1, mavi8),
      deste: dolgu,
    });

    const sonraki = durumAl(reduce(durum, { tip: 'CEK_ATIKTAN', oyuncu: 2, suAn: 0 }));

    expect(sirasiz(sonraki, 1)).toEqual([
      { tip: 'cekim', oyuncu: 2, kaynak: 'atik', tas: mavi8, kimden: 1 },
    ]);
    expect(sonraki.sonHareketNo).toBe(durum.sonHareketNo + 1);
  });
});

describe('desteden cekme', () => {
  it('cekilen tas GIZLI kalir: kapali ucar (motor kurali #3)', () => {
    const durum = durumKur({
      siradaki: 2,
      faz: 'cekme',
      istakalar: { 2: [t('kirmizi', 5)] },
      deste: dolgu,
    });

    const sonraki = durumAl(reduce(durum, { tip: 'CEK_DESTEDEN', oyuncu: 2, suAn: 0 }));

    expect(sirasiz(sonraki, 1)).toEqual([
      { tip: 'cekim', oyuncu: 2, kaynak: 'deste', tas: null, kimden: null },
    ]);
  });

  it('bekleyen talep varsa UC hareket, DOGRU SIRAYLA', () => {
    // 1 numarali mavi8 atti, 3 numarali istedi, sirasi gelen 2 numarali
    // tasi almayip desteden cekiyor → tas 3 numaraliya gider (§5.4).
    const durum = durumKur({
      siradaki: 2,
      faz: 'cekme',
      istakalar: { 2: [t('kirmizi', 5)], 3: [t('kirmizi', 6)] },
      atikYiginlari: { 1: [mavi8] },
      pencere: pencereKur(1, mavi8, { talepler: [3] }),
      deste: dolgu,
    });

    const sonraki = durumAl(reduce(durum, { tip: 'CEK_DESTEDEN', oyuncu: 2, suAn: 0 }));

    expect(sirasiz(sonraki, 3)).toEqual([
      // Once pencereyi kapatan cekis.
      { tip: 'cekim', oyuncu: 2, kaynak: 'deste', tas: null, kimden: null },
      // Sonra calanin ACIK tasi.
      { tip: 'cekim', oyuncu: 3, kaynak: 'calma', tas: mavi8, kimden: 1 },
      // En son bedeli: desteden kapali ceza tasi.
      { tip: 'cekim', oyuncu: 3, kaynak: 'ceza', tas: null, kimden: null },
    ]);
  });
});

describe('tur 15 "cifti bende" (§9 0.10)', () => {
  it('tas ve ceza tasi, ikisi de calan oyuncuya', () => {
    const esi = t('mavi', 8, 'b');
    const durum = durumKur({
      tur: 15,
      siradaki: 2,
      faz: 'cekme',
      istakalar: { 3: [esi, t('kirmizi', 6)] },
      atikYiginlari: { 1: [mavi8] },
      pencere: pencereKur(1, mavi8),
      deste: dolgu,
    });

    const sonraki = durumAl(reduce(durum, { tip: 'CIFT_TALEBI', oyuncu: 3, suAn: 0 }));

    expect(sirasiz(sonraki, 2)).toEqual([
      { tip: 'cekim', oyuncu: 3, kaynak: 'calma', tas: mavi8, kimden: 1 },
      { tip: 'cekim', oyuncu: 3, kaynak: 'ceza', tas: null, kimden: null },
    ]);
  });
});

describe('isleme — KURALLAR.md §6', () => {
  it('islenen tas oyuncudan HEDEF PERE gider', () => {
    const yerdeki = yerPeri(7, 3, 'seri', [
      t('kirmizi', 5),
      t('kirmizi', 6),
      t('kirmizi', 7),
    ]);
    const islenen = t('kirmizi', 8);
    const durum = durumKur({
      siradaki: 2,
      faz: 'atma',
      istakalar: { 2: [islenen, t('sari', 11)] },
      yer: [yerdeki],
      acmisMi: { 2: true },
      acilisHamlesi: { 2: 0 },
      hamleSayisi: { 2: 1 },
    });

    const sonraki = durumAl(
      reduce(durum, { tip: 'ISLE', oyuncu: 2, perId: 7, tasIdler: [islenen.id], suAn: 0 }),
    );

    // Hedef per kimlikli: ekran tasi TAM O PERE ucuruyor, sahibinin
    // koltuguna degil — per baskasinin da olabilir (§6).
    expect(sirasiz(sonraki, 1)).toEqual([
      { tip: 'isleme', oyuncu: 2, perId: 7, taslar: [islenen] },
    ]);
  });
});

describe('sira — cekis once, atis sonra', () => {
  it('bir sirada olan hareketler DOGRU SIRAYLA birikiyor', () => {
    // Kullanicinin bildirdigi hata: atis animasyonu cekisten once oynuyordu.
    // Sebep, atisin ayri bir effect'te sayac farkindan cikarilmasiydi; iki
    // effect'in tanim sirasi kuyruga girisi belirliyordu. Artik ikisi de
    // motorun listesinde ve sira numarasi kesin.
    const durum = durumKur({
      siradaki: 2,
      faz: 'cekme',
      istakalar: { 2: [t('kirmizi', 5), t('kirmizi', 6)] },
      deste: dolgu,
    });

    const cekti = durumAl(reduce(durum, { tip: 'CEK_DESTEDEN', oyuncu: 2, suAn: 0 }));
    const atti = durumAl(
      reduce(cekti, { tip: 'AT', oyuncu: 2, tasId: t('kirmizi', 5).id, suAn: 0 }),
    );

    const tipler = atti.sonHareketler.map((hareket) => hareket.tip);
    expect(tipler).toEqual(['cekim', 'atma']);

    const siralar = atti.sonHareketler.map((hareket) => hareket.sira);
    expect(siralar).toEqual([...siralar].sort((a, b) => a - b));
  });

  it('liste SILINMEZ — surucu bir sirayi tek seferde oynuyor', () => {
    // Cekis + atis ayni tick icinde oluyor ve ekrana yalnizca SON durum
    // ulasiyor. Ustune yazsaydi ya da sifirlasaydi cekis animasyonu ekrana
    // hic varamazdi; ilk yazimda tam olarak bu oldu.
    const durum = durumKur({
      siradaki: 2,
      faz: 'cekme',
      istakalar: { 2: [t('kirmizi', 5), t('kirmizi', 6)] },
      deste: dolgu,
    });

    const cekti = durumAl(reduce(durum, { tip: 'CEK_DESTEDEN', oyuncu: 2, suAn: 0 }));
    const atti = durumAl(
      reduce(cekti, { tip: 'AT', oyuncu: 2, tasId: t('kirmizi', 5).id, suAn: 0 }),
    );

    expect(atti.sonHareketler).toHaveLength(2);
    expect(atti.sonHareketNo).toBeGreaterThan(cekti.sonHareketNo);
  });

  it('liste sinirsiz buyumuyor — silinmedigi icin bir sinir sart', () => {
    // Durumun kendi `siradaki`/`faz` alanlarini izliyoruz; koltuk sirasini
    // testte yeniden hesaplamak hataya acik.
    let durum = durumKur({
      siradaki: 0,
      faz: 'atma',
      istakalar: dagitim,
      deste: dolgu,
    });

    for (let adim = 0; adim < 12 && durum.faz !== 'el-bitti'; adim++) {
      const oyuncu = durum.siradaki;
      if (durum.faz === 'cekme') {
        durum = durumAl(reduce(durum, { tip: 'CEK_DESTEDEN', oyuncu, suAn: 0 }));
        continue;
      }
      const atilacak = durum.istakalar[oyuncu][0];
      if (atilacak === undefined) break;
      durum = durumAl(reduce(durum, { tip: 'AT', oyuncu, tasId: atilacak.id, suAn: 0 }));
    }

    expect(durum.sonHareketNo).toBeGreaterThan(8);
    expect(durum.sonHareketler.length).toBeLessThanOrEqual(8);
  });
});

describe('indirme — acma ve fazladan per (KURALLAR.md §6)', () => {
  // Tur 1'in sarti: 2 × uclu kut.
  const acilisEli = [
    t('kirmizi', 7), t('siyah', 7), t('mavi', 7),
    t('kirmizi', 9), t('siyah', 9), t('mavi', 9),
    t('sari', 2),
  ];

  it('acilista her YENI per icin ayri hareket', () => {
    const durum = durumKur({
      tur: 1,
      siradaki: 0,
      faz: 'atma',
      istakalar: { 0: acilisEli },
    });

    const sonraki = durumAl(
      reduce(durum, {
        tip: 'AC',
        oyuncu: 0,
        perler: [
          [t('kirmizi', 7).id, t('siyah', 7).id, t('mavi', 7).id],
          [t('kirmizi', 9).id, t('siyah', 9).id, t('mavi', 9).id],
        ],
        okeyAlimi: null,
        suAn: 0,
      }),
    );

    const hareketler = sirasiz(sonraki, 2);
    expect(hareketler.every((h) => h.tip === 'indirme')).toBe(true);
    // Hedef, YERE INEN perlerin kimlikleri — ekran tasi tam oraya ucuruyor.
    expect(hareketler.map((h) => (h as { perId: number }).perId)).toEqual(
      sonraki.yer.map((per) => per.id),
    );
    // Perin butun taslari ucuyor; her biri ayri ucus oluyor (ucuslar.ts).
    expect(hareketler.every((h) => (h as { taslar: readonly unknown[] }).taslar.length === 3))
      .toBe(true);
  });

  it('fazladan per indirmek de hareket uretiyor', () => {
    const yerdeki = yerPeri(1, 0, 'seri', [t('mavi', 4), t('mavi', 5), t('mavi', 6)]);
    const durum = durumKur({
      siradaki: 0,
      faz: 'atma',
      istakalar: {
        0: [t('kirmizi', 7), t('siyah', 7), t('mavi', 7), t('sari', 2)],
      },
      yer: [yerdeki],
      sonrakiPerId: 2,
      acmisMi: { 0: true },
      acilisHamlesi: { 0: 0 },
      hamleSayisi: { 0: 1 },
    });

    const sonraki = durumAl(
      reduce(durum, {
        tip: 'PER_INDIR',
        oyuncu: 0,
        perler: [[t('kirmizi', 7).id, t('siyah', 7).id, t('mavi', 7).id]],
        suAn: 0,
      }),
    );

    expect(sirasiz(sonraki, 1)).toEqual([
      {
        tip: 'indirme',
        oyuncu: 0,
        perId: 2,
        taslar: [t('kirmizi', 7), t('siyah', 7), t('mavi', 7)],
      },
    ]);
  });

  it('tur 16da yere per inmiyor, indirme hareketi de yok', () => {
    // §3 — tur 16'da perler yalnizca dogrulama icin; yere hicbir sey inmez.
    const durum = durumKur({
      tur: 16,
      siradaki: 0,
      faz: 'atma',
      istakalar: {
        0: [
          t('kirmizi', 7), t('siyah', 7), t('mavi', 7),
          t('kirmizi', 9), t('siyah', 9), t('mavi', 9),
          t('sari', 2),
        ],
      },
    });

    const sonraki = durumAl(
      reduce(durum, {
        tip: 'BITIR_ELDEN',
        oyuncu: 0,
        perler: [
          [t('kirmizi', 7).id, t('siyah', 7).id, t('mavi', 7).id],
          [t('kirmizi', 9).id, t('siyah', 9).id, t('mavi', 9).id],
        ],
        atilanTasId: t('sari', 2).id,
        suAn: 0,
      }),
    );

    expect(sonraki.yer).toHaveLength(0);
    expect(sonraki.sonHareketler.filter((h) => h.tip === 'indirme')).toHaveLength(0);
    // Atis yine de ucuyor.
    expect(sonraki.sonHareketler.at(-1)?.tip).toBe('atma');
  });
});
