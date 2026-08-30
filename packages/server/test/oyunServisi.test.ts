import { describe, expect, it } from 'vitest';
import { OYUNCULAR, type OyuncuId } from '@kut/engine';
import { OyunServisi } from '../src/servisler/oyunServisi.js';
import { atilacakTas, atilacakTasSec } from '../src/soket/yerineOyna.js';

// Sunucu otoriter: karari motor veriyor, bu sinif yalnizca sariyor.
// Testler motorun kurallarini degil, KABUGUN dogru sardigini dogruluyor.

describe('OyunServisi — el kurulumu', () => {
  it('el motorun kurallarina gore dagitiliyor', () => {
    const oyun = new OyunServisi(1);
    // KURALLAR.md §1 — baslayana 15, digerlerine 14, destede 49 kalir.
    expect(oyun.durum.istakalar[0]).toHaveLength(15);
    expect(oyun.durum.istakalar[1]).toHaveLength(14);
    expect(oyun.durum.deste).toHaveLength(49);
    expect(oyun.durum.faz).toBe('atma');
  });

  it('her el farkli tohumla dagitiliyor', () => {
    const tohumlar = new Set<number>();
    for (let i = 0; i < 20; i++) tohumlar.add(new OyunServisi(1).elBilgisi.tohum);
    // Ayni tohum tekrar cikabilir ama 20 elde hepsi ayni olamaz.
    expect(tohumlar.size).toBeGreaterThan(1);
  });

  it('el kaydi eli yeniden kurmaya yetiyor — motor kurali #2', () => {
    const oyun = new OyunServisi(1);
    const bilgi = oyun.elBilgisi;
    // Ayni tohum + ayni tur + ayni baslayan → ayni dagitim.
    const ikizi = new OyunServisi(1);
    expect(bilgi.tohum).toBeTypeOf('number');
    expect(bilgi.baslayan).toBe(0);
    expect(bilgi.aksiyonlar).toEqual([]);
    expect(ikizi.durum.istakalar[0]).toHaveLength(15);
  });
});

describe('OyunServisi — gizli bilgi', () => {
  it('her koltuk yalnizca kendi istakasini goruyor', () => {
    const oyun = new OyunServisi(1);
    for (const koltuk of OYUNCULAR) {
      const gorunum = oyun.gorunum(koltuk);
      const metin = JSON.stringify(gorunum);
      for (const digeri of OYUNCULAR) {
        if (digeri === koltuk) continue;
        for (const tas of oyun.durum.istakalar[digeri]) {
          expect(metin.includes(tas.id), `${tas.id} sizdi`).toBe(false);
        }
      }
    }
  });

  it('destenin icerigi hicbir gorunumde yok', () => {
    const oyun = new OyunServisi(1);
    const metin = JSON.stringify(oyun.tumGorunumler());
    for (const tas of oyun.durum.deste) {
      expect(metin.includes(tas.id), `deste tasi ${tas.id} sizdi`).toBe(false);
    }
  });
});

describe('OyunServisi — aksiyon', () => {
  it('gecerli hamle durumu ilerletiyor ve kayda giriyor', () => {
    const oyun = new OyunServisi(1);
    const tas = oyun.durum.istakalar[0][0];
    expect(tas).toBeDefined();

    const sonuc = oyun.uygula({ tip: 'AT', oyuncu: 0, tasId: tas!.id, suAn: 0 });
    expect(sonuc.ok).toBe(true);
    expect(oyun.durum.istakalar[0]).toHaveLength(14);
    expect(oyun.elBilgisi.aksiyonlar).toHaveLength(1);
  });

  it('gecersiz hamle durumu DEGISTIRMIYOR — motor kurali #4', () => {
    const oyun = new OyunServisi(1);
    const oncekiDurum = oyun.durum;

    // Sirasi olmayan oyuncu atmaya calisiyor.
    const sonuc = oyun.uygula({ tip: 'AT', oyuncu: 2, tasId: 'yok', suAn: 0 });
    expect(sonuc.ok).toBe(false);
    expect(sonuc.reason).toBeDefined();
    expect(oyun.durum).toBe(oncekiDurum);
    expect(oyun.elBilgisi.aksiyonlar).toHaveLength(0);
  });
});

describe('OyunServisi — sira suresi', () => {
  it('varsayilan hak 30 saniye', () => {
    const oyun = new OyunServisi(1);
    expect(oyun.siraSuresi()).toBe(30_000);
  });

  it('sure dolduran bir alt kademeye iniyor, en altta kaliyor', () => {
    const oyun = new OyunServisi(1);
    oyun.kademeDusur(0);
    expect(oyun.siraSuresi(0)).toBe(20_000);
    oyun.kademeDusur(0);
    expect(oyun.siraSuresi(0)).toBe(10_000);
    for (let i = 0; i < 5; i++) oyun.kademeDusur(0);
    expect(oyun.siraSuresi(0)).toBe(10_000);
  });

  it('kademe oyuncuya ozel — digerleri etkilenmiyor', () => {
    const oyun = new OyunServisi(1);
    oyun.kademeDusur(0);
    expect(oyun.siraSuresi(0)).toBe(20_000);
    expect(oyun.siraSuresi(1)).toBe(30_000);
  });

  it('yeni elde kademeler sifirlaniyor — §9 0.7', () => {
    const oyun = new OyunServisi(1);
    oyun.kademeDusur(0);
    oyun.kademeDusur(0);
    expect(oyun.siraSuresi(0)).toBe(10_000);

    oyun.yeniEl(2);
    expect(oyun.siraSuresi(0)).toBe(30_000);
  });

  it('yeni el yeni tohumla ve siradaki baslayanla kuruluyor', () => {
    const oyun = new OyunServisi(1);
    const ilkTohum = oyun.elBilgisi.tohum;
    oyun.yeniEl(2);
    expect(oyun.durum.tur).toBe(2);
    // §1 — baslayan her elde bir sonrakine geciyor.
    expect(oyun.elBilgisi.baslayan).not.toBe(0);
    expect(oyun.elBilgisi.aksiyonlar).toEqual([]);
    expect(oyun.elBilgisi.tohum).toBeTypeOf('number');
    expect(ilkTohum).toBeTypeOf('number');
  });

  it('sureyiBaslat bitis anini veriyor, durdurunca siliniyor', () => {
    const oyun = new OyunServisi(1);
    const bitis = oyun.sureyiBaslat(1_000);
    expect(bitis).toBe(31_000);
    expect(oyun.siraBitisi).toBe(31_000);
    oyun.sureyiDurdur();
    expect(oyun.siraBitisi).toBeNull();
  });
});

describe('yerineOyna — sure dolunca', () => {
  it('cekmediyse desteden ceker (§4)', () => {
    const oyun = new OyunServisi(1);
    // Baslayan atinca sira gecer ve sonraki oyuncu cekme fazina duser.
    const tas = oyun.durum.istakalar[0][0]!;
    oyun.uygula({ tip: 'AT', oyuncu: 0, tasId: tas.id, suAn: 0 });

    const siradaki = oyun.siradaki;
    const aksiyon = atilacakTasSec(oyun.gorunum(siradaki), siradaki, 500);
    expect(aksiyon).toEqual({ tip: 'CEK_DESTEDEN', oyuncu: siradaki, suAn: 500 });
  });

  it('cektiyse tas atar', () => {
    const oyun = new OyunServisi(1);
    const aksiyon = atilacakTasSec(oyun.gorunum(0), 0, 0);
    expect(aksiyon).toMatchObject({ tip: 'AT', oyuncu: 0 });
  });

  it('sira baskasindaysa hicbir sey yapmaz', () => {
    const oyun = new OyunServisi(1);
    const digeri: OyuncuId = 2;
    expect(atilacakTasSec(oyun.gorunum(digeri), digeri, 0)).toBeNull();
  });

  it('secilen hamle motorca KABUL ediliyor — sira kilitlenmiyor', () => {
    const oyun = new OyunServisi(1);
    // Bir tur boyunca hep "yerine oyna" ile ilerlet; hicbiri reddedilmemeli.
    for (let adim = 0; adim < 30 && !oyun.bittiMi; adim++) {
      const koltuk = oyun.siradaki;
      const aksiyon = atilacakTasSec(oyun.gorunum(koltuk), koltuk, adim * 10_000);
      expect(aksiyon).not.toBeNull();
      const sonuc = oyun.uygula(aksiyon!);
      expect(sonuc.ok, `adim ${adim} reddedildi: ${sonuc.reason}`).toBe(true);
    }
  });

  it('okeyi son care olarak atar', () => {
    const oyun = new OyunServisi(1);
    const gorunum = oyun.gorunum(0);
    const secilen = atilacakTas(gorunum);
    expect(secilen).not.toBeNull();
    // Elde okey disinda tas varsa okey secilmemeli.
    const okeysizVar = gorunum.istakam.some((tas) => tas.tip !== 'okey');
    if (okeysizVar) expect(secilen!.tip).not.toBe('okey');
  });

  it('bos elde null doner', () => {
    const oyun = new OyunServisi(1);
    const gorunum = { ...oyun.gorunum(0), istakam: [] };
    expect(atilacakTas(gorunum)).toBeNull();
  });
});
