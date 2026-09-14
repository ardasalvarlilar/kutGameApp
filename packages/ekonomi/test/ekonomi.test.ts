import { describe, expect, it } from 'vitest';
import {
  BASLANGIC_CIPI,
  CIP_PAKETLERI,
  KADEMELER,
  MAKS_SEVIYE,
  kademeBul,
  kademeGecerliMi,
  kazananPayi,
  macDeneyimi,
  macSiralari,
  odulHavuzu,
  oturmaEngeli,
  paketAvantaji,
  potHesapla,
  seviyeAtlamaBedeli,
  seviyeEsigi,
  seviyeHesapla,
  seviyeIlerlemesi,
} from '../src';

describe('kademeler', () => {
  it('giris ve kilit seviyesi kademe kademe artiyor', () => {
    for (let i = 1; i < KADEMELER.length; i++) {
      const onceki = KADEMELER[i - 1]!;
      const simdiki = KADEMELER[i]!;
      expect(simdiki.giris).toBeGreaterThan(onceki.giris);
      expect(simdiki.minSeviye).toBeGreaterThan(onceki.minSeviye);
    }
  });

  it('ilk kademe seviye 1de acik — yeni oyuncu oturabilmeli', () => {
    expect(KADEMELER[0]!.minSeviye).toBe(1);
  });

  it('baslangic cipi Caylak masasinda tam uc mac', () => {
    expect(BASLANGIC_CIPI / kademeBul('caylak').giris).toBe(3);
  });

  it('oturma engeli: once seviye, sonra cip', () => {
    const usta = kademeBul('usta');
    expect(oturmaEngeli({ seviye: 1, cip: 0 }, usta)).toBe('seviye-yetersiz');
    expect(oturmaEngeli({ seviye: 10, cip: usta.giris - 1 }, usta)).toBe('cip-yetersiz');
    expect(oturmaEngeli({ seviye: 10, cip: usta.giris }, usta)).toBeNull();
    // Kilit yalnizca alttan: ust seviye alt kademeye oturabilir.
    expect(oturmaEngeli({ seviye: 50, cip: 5_000 }, kademeBul('caylak'))).toBeNull();
  });

  it('bilinmeyen kademe gecersiz', () => {
    expect(kademeGecerliMi('efsane')).toBe(true);
    expect(kademeGecerliMi('tanri')).toBe(false);
    expect(kademeGecerliMi(3)).toBe(false);
  });
});

describe('pot ve odul', () => {
  it('dort insan: kazanan girisin 3.2 katini alir, %20 masaya', () => {
    const pot = potHesapla(4, 100_000);
    expect(pot).toBe(400_000);
    expect(odulHavuzu(pot)).toBe(320_000);
    expect(kazananPayi(pot, 1)).toBe(320_000);
  });

  it('beraberlikte havuz bolunur; bot kazanan da pay sayilir', () => {
    const pot = potHesapla(4, 5_000);
    expect(kazananPayi(pot, 2)).toBe(8_000);
  });

  it('botlar pota girmez: iki insanli masada havuz iki giristen', () => {
    expect(kazananPayi(potHesapla(2, 5_000), 1)).toBe(8_000);
  });

  it('kazanan yoksa pay yok', () => {
    expect(kazananPayi(20_000, 0)).toBe(0);
  });

  it('pay tam sayi — cip bolunmez', () => {
    expect(Number.isInteger(kazananPayi(potHesapla(3, 15_000), 2))).toBe(true);
  });
});

describe('seviye', () => {
  it('1→2 100 XP, her atlama 50 XP daha pahali', () => {
    expect(seviyeAtlamaBedeli(1)).toBe(100);
    expect(seviyeAtlamaBedeli(2)).toBe(150);
    expect(seviyeAtlamaBedeli(3)).toBe(200);
  });

  it('esikler atlama bedellerinin toplami', () => {
    expect(seviyeEsigi(1)).toBe(0);
    expect(seviyeEsigi(2)).toBe(100);
    expect(seviyeEsigi(3)).toBe(250);
    for (let s = 1; s < 40; s++) {
      expect(seviyeEsigi(s + 1) - seviyeEsigi(s)).toBe(seviyeAtlamaBedeli(s));
    }
  });

  it('deneyimden seviye — esikte bir ust seviye', () => {
    expect(seviyeHesapla(0)).toBe(1);
    expect(seviyeHesapla(99)).toBe(1);
    expect(seviyeHesapla(100)).toBe(2);
    expect(seviyeHesapla(249)).toBe(2);
    expect(seviyeHesapla(250)).toBe(3);
  });

  it('son seviyede durur', () => {
    expect(seviyeHesapla(Number.MAX_SAFE_INTEGER)).toBe(MAKS_SEVIYE);
    expect(seviyeIlerlemesi(seviyeEsigi(MAKS_SEVIYE)).gereken).toBeNull();
  });

  it('ilerleme: bu seviyede biriken ve gereken', () => {
    expect(seviyeIlerlemesi(180)).toEqual({ seviye: 2, buSeviyede: 80, gereken: 150 });
  });

  it('her kademenin kilidi erisilebilir bir seviyede', () => {
    for (const kademe of KADEMELER) expect(kademe.minSeviye).toBeLessThanOrEqual(MAKS_SEVIYE);
  });
});

describe('mac sirasi ve deneyim', () => {
  it('en dusuk toplam birinci (KURALLAR.md §8)', () => {
    expect(macSiralari([120, -40, 300, 55])).toEqual([2, 0, 3, 1]);
  });

  it('beraberlikte ikisi de ustteki sirayi alir', () => {
    expect(macSiralari([10, 10, 50, 80])).toEqual([0, 0, 2, 3]);
  });

  it('siraya gore 100/75/50/25 XP', () => {
    expect([0, 1, 2, 3].map(macDeneyimi)).toEqual([100, 75, 50, 25]);
  });
});

describe('paketler', () => {
  it('buyuk paket birim basina daha ucuz', () => {
    for (let i = 1; i < CIP_PAKETLERI.length; i++) {
      const onceki = CIP_PAKETLERI[i - 1]!;
      const simdiki = CIP_PAKETLERI[i]!;
      expect(simdiki.cip / simdiki.fiyatTl).toBeGreaterThan(onceki.cip / onceki.fiyatTl);
    }
  });

  it('en kucuk paketin avantaji sifir', () => {
    expect(paketAvantaji(CIP_PAKETLERI[0]!)).toBe(0);
  });

  it('urun kimlikleri benzersiz', () => {
    const kimlikler = new Set(CIP_PAKETLERI.map((p) => p.urunKimligi));
    expect(kimlikler.size).toBe(CIP_PAKETLERI.length);
  });
});
