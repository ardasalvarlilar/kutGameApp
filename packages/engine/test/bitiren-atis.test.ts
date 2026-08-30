import { describe, expect, it } from 'vitest';
import { reduce } from '../src/reduce';
import { viewFor } from '../src/gorunum';
import { durumAl, durumKur, ok, t, yerPeri } from './yardimci';

// KURALLAR.md §8 — isler tas atma cezasi "masaya dikkat etmemenin bedeli".
// Eli BITIREN atis bunun disinda: son tasi ortaya atmak (§7) kazanan
// hamledir, dikkatsizlik degil. Ozellikle okeyle bitmek §8'de ×2 carpanla
// ODULLENDIRILIYOR; ayni hamleye 50 puan yazmak kuralla celisir.
//
// Okey yerdeki neredeyse her pere isledigi icin, bu ayrim olmadan okeyle
// bitmek fiilen HER ZAMAN 50 puan ceza yiyordu.

// Yerde duran, uzatilabilir bir seri — her isler tas kontrolunun hedefi.
const yerdekiSeri = yerPeri(1, 2, 'seri', [t('mavi', 5), t('mavi', 6), t('mavi', 7)]);

describe('eli bitiren atis §8 cezasi yemez', () => {
  it('son tas okeyse: carpan digerlerine isler, kazanana 50 ceza YOK', () => {
    const durum = durumKur({
      istakalar: {
        0: [ok('a')],
        1: [t('sari', 10)], // acmis: 10 × 2 (okeyle bitme)
        2: [t('sari', 11)], // acamamis: 11 × 2 × 2
      },
      yer: [yerdekiSeri],
      acmisMi: { 0: true, 1: true, 2: false, 3: true },
      acilisHamlesi: { 0: 0 },
      hamleSayisi: { 0: 1 },
    });
    // Okey yerdeki seriye isliyor — eskiden bu, cezayi tetikliyordu.
    expect(viewFor(durum, 0).islerTaslarim).toEqual([ok('a').id]);

    const sonraki = durumAl(reduce(durum, { tip: 'AT', oyuncu: 0, tasId: ok('a').id, suAn: 0 }));
    expect(sonraki.islerTasSayisi[0]).toBe(0);

    const sonuc = sonraki.sonuc;
    expect(sonuc?.kazanan).toBe(0);
    expect(sonuc?.okeyleBitti).toBe(true);

    // Asil mesele: kazananin puani -100, ustune 50 EKLENMIYOR.
    // (Duzeltmeden once -100 + 50 = -50 yaziyordu.)
    expect(sonuc?.detaylar[0].islerTasCezasi).toBe(0);
    expect(sonuc?.puanlar[0]).toBe(-100);

    // Okeyle bitme carpani digerlerinde: acan ×2, acamayan ×4 (§8).
    expect(sonuc?.detaylar[1].carpan).toBe(2);
    expect(sonuc?.puanlar[1]).toBe(20);
    expect(sonuc?.detaylar[2].carpan).toBe(4);
    expect(sonuc?.puanlar[2]).toBe(44);
  });

  it('son tas normal ama isler olsa da ceza yok', () => {
    const durum = durumKur({
      istakalar: { 0: [t('mavi', 8)] },
      yer: [yerdekiSeri],
      acmisMi: { 0: true },
      acilisHamlesi: { 0: 0 },
      hamleSayisi: { 0: 1 },
    });
    expect(viewFor(durum, 0).islerTaslarim).toEqual([t('mavi', 8).id]);

    const sonraki = durumAl(reduce(durum, { tip: 'AT', oyuncu: 0, tasId: t('mavi', 8).id, suAn: 0 }));
    expect(sonraki.islerTasSayisi[0]).toBe(0);
    expect(sonraki.sonuc?.detaylar[0].islerTasCezasi).toBe(0);
    expect(sonraki.sonuc?.puanlar[0]).toBe(-100);
  });

  it('bitirmeyen isler atis hala ceza yazar — kural kalkmiyor', () => {
    const durum = durumKur({
      istakalar: { 0: [t('mavi', 8), t('sari', 2)] },
      yer: [yerdekiSeri],
      acmisMi: { 0: true },
    });
    const sonraki = durumAl(reduce(durum, { tip: 'AT', oyuncu: 0, tasId: t('mavi', 8).id, suAn: 0 }));
    expect(sonraki.islerTasSayisi[0]).toBe(1);
    // El bitmedi; sira dondu.
    expect(sonraki.sonuc).toBeNull();
    expect(sonraki.siradaki).not.toBe(0);
  });

  it('elin onceki isler atislari kazananda da duruyor — §10.6 bozulmadi', () => {
    // Once isler bir tas atiliyor (ceza yazilir), sonra sira donup el
    // bitiriliyor. Bitiren atis muaf; onceki ceza duruyor.
    let d = durumKur({
      istakalar: {
        0: [t('mavi', 8), t('sari', 2)],
        1: [t('kirmizi', 4)],
        2: [t('kirmizi', 5)],
        3: [t('kirmizi', 6)],
      },
      deste: [t('sari', 9), t('sari', 10), t('sari', 11), t('sari', 12)],
      yer: [yerdekiSeri],
      acmisMi: { 0: true },
    });

    // 0 isler tasi atiyor → 1 ceza, el bitmiyor (elinde sari2 kaldi).
    d = durumAl(reduce(d, { tip: 'AT', oyuncu: 0, tasId: t('mavi', 8).id, suAn: 0 }));
    expect(d.islerTasSayisi[0]).toBe(1);
    expect(d.sonuc).toBeNull();

    // Sira oyun yonunde dolasip 0'a donsun (§4: 0 → 3 → 2 → 1 → 0).
    let saat = 10_000;
    while (d.siradaki !== 0 && d.faz !== 'el-bitti') {
      const oyuncu = d.siradaki;
      d = durumAl(reduce(d, { tip: 'CEK_DESTEDEN', oyuncu, suAn: saat }));
      const atilacak = d.istakalar[oyuncu][0];
      d = durumAl(reduce(d, { tip: 'AT', oyuncu, tasId: atilacak!.id, suAn: saat }));
      saat += 10_000;
    }

    // 0 cekiyor, sonra iki tasini atarak bitiriyor.
    d = durumAl(reduce(d, { tip: 'CEK_DESTEDEN', oyuncu: 0, suAn: saat }));
    expect(d.istakalar[0]).toHaveLength(2);
    d = durumAl(reduce(d, { tip: 'AT', oyuncu: 0, tasId: d.istakalar[0][0]!.id, suAn: saat }));

    // Bitiren atisin kendisi ceza yazmadi; onceki atisin cezasi duruyor.
    expect(d.islerTasSayisi[0]).toBe(1);
  });

  it('ayar 0 iken zaten ceza yok', () => {
    const durum = durumKur({
      istakalar: { 0: [t('mavi', 8), t('sari', 2)] },
      yer: [yerdekiSeri],
      acmisMi: { 0: true },
      ayarlar: { islerTasCezasi: 0 },
    });
    const sonraki = durumAl(reduce(durum, { tip: 'AT', oyuncu: 0, tasId: t('mavi', 8).id, suAn: 0 }));
    expect(sonraki.islerTasSayisi[0]).toBe(0);
  });
});
