// Senaryo eli, ogreticinin uzerine kuruldugu zemin.
//
// Buradaki iddialarin hicbiri "benim hesabima gore dogru" degil: acilisin
// gecerliligini, kutlerin gecerliligini ve dagitimi MOTORA dogrulatiyoruz.
// Senaryo bozulursa (bir tas degisir, bir dolgu carpisir) ogretici sessizce
// yanlis calismak yerine burada patliyor.

import { describe, expect, it } from 'vitest';
import {
  desteOlustur,
  elKur,
  kutMu,
  okeyCekmeAdaylari,
  reduce,
  sartKarsilaniyorMu,
  siradaIleri,
  viewFor,
  type Tas,
} from '@kut/engine';
import { botAksiyonu } from '@kut/politika';
import {
  ACILIS_KUTLERI,
  CALINACAK_TAS,
  ISLENECEK_TAS,
  OGRENCI,
  OKEY_TAMAMLAYICILARI,
  YER_TUTUCU_ACILISI,
  ogreticiDestesi,
} from './senaryo';

const DESTE = ogreticiDestesi();
const idler = (taslar: readonly Tas[]): readonly string[] => taslar.map((tas) => tas.id);

function elleriKur() {
  const durum = elKur({ tur: 1, baslayan: OGRENCI, deste: DESTE });
  return durum;
}

describe('deste butunlugu', () => {
  it('tam bir deste — 106 tas', () => {
    expect(DESTE).toHaveLength(106);
  });

  it('hicbir tas tekrarlanmiyor', () => {
    expect(new Set(idler(DESTE)).size).toBe(106);
  });

  it('gercek destenin bir permutasyonu — uydurma tas yok', () => {
    expect(idler(DESTE).slice().sort()).toEqual(idler(desteOlustur()).slice().sort());
  });

  it('her cagrida ayni desteyi uretiyor (motor kurali #2)', () => {
    expect(idler(ogreticiDestesi())).toEqual(idler(DESTE));
  });
});

describe('dagitim', () => {
  it('kullanici baslayan ve 15 tas aliyor (§1)', () => {
    const durum = elleriKur();
    expect(durum.baslayan).toBe(OGRENCI);
    expect(durum.istakalar[OGRENCI]).toHaveLength(15);
    expect(durum.faz).toBe('atma');
  });

  it('yer tutuculara 14 tas gidiyor', () => {
    const durum = elleriKur();
    for (const koltuk of [1, 2, 3] as const) {
      expect(durum.istakalar[koltuk]).toHaveLength(14);
    }
  });

  it('destede 49 tas kaliyor', () => {
    expect(elleriKur().deste).toHaveLength(49);
  });
});

describe('kullanicinin eli', () => {
  it('tur 1 sartini KARSILIYOR — 2 x uclu kut', () => {
    const perler = [
      { tip: 'kut' as const, taslar: ACILIS_KUTLERI.yediler },
      { tip: 'kut' as const, taslar: ACILIS_KUTLERI.dortler },
    ];
    expect(kutMu(ACILIS_KUTLERI.yediler).ok).toBe(true);
    expect(kutMu(ACILIS_KUTLERI.dortler).ok).toBe(true);
    expect(sartKarsilaniyorMu(perler, 1).ok).toBe(true);
  });

  it('acilis taslarinin tamami kullanicinin elinde', () => {
    const elim = idler(elleriKur().istakalar[OGRENCI]);
    for (const tas of [...ACILIS_KUTLERI.yediler, ...ACILIS_KUTLERI.dortler]) {
      expect(elim).toContain(tas.id);
    }
  });

  it('islenecek tas elde ve 3 numaralinin kutunu DORDE tamamliyor (§6)', () => {
    expect(idler(elleriKur().istakalar[OGRENCI])).toContain(ISLENECEK_TAS.id);
    expect(kutMu([...YER_TUTUCU_ACILISI.onbirler, ISLENECEK_TAS]).ok).toBe(true);
  });

  // Canli oynanista cikan tuzak: islenecek tas acilis kutunun 4. rengi
  // olursa KÜT DİZ dordunu tek grup yapiyor, kullanici dordunu birden
  // seciyor ve tur 1'in UCLU kut sartina takiliyor.
  it('islenecek tas acilis kutlerinden HICBIRINE karismiyor', () => {
    for (const kut of [ACILIS_KUTLERI.yediler, ACILIS_KUTLERI.dortler]) {
      expect(kutMu([...kut, ISLENECEK_TAS]).ok).toBe(false);
    }
  });

  it('okeyi tamamlayacak iki tas elde (§6 — kutu dort renge tamamlama)', () => {
    const elim = idler(elleriKur().istakalar[OGRENCI]);
    for (const tas of OKEY_TAMAMLAYICILARI) expect(elim).toContain(tas.id);
  });

  it('calinacak tas kullanicinin ELINDE DEGIL — yoksa calmaya gerek kalmaz', () => {
    expect(idler(elleriKur().istakalar[OGRENCI])).not.toContain(CALINACAK_TAS.id);
  });
});

describe('yer tutucularin elleri', () => {
  it('3 numarali tur 1 sartini karsilayabiliyor, biri okeyli', () => {
    const perler = [
      { tip: 'kut' as const, taslar: YER_TUTUCU_ACILISI.besler },
      { tip: 'kut' as const, taslar: YER_TUTUCU_ACILISI.onbirler },
    ];
    expect(kutMu(YER_TUTUCU_ACILISI.besler).ok).toBe(true);
    expect(sartKarsilaniyorMu(perler, 1).ok).toBe(true);
    expect(YER_TUTUCU_ACILISI.besler.some((tas) => tas.tip === 'okey')).toBe(true);
  });

  it('acilis taslari 3 numaralinin elinde', () => {
    const eli = idler(elleriKur().istakalar[siradaIleri(OGRENCI, 1)]);
    for (const tas of [...YER_TUTUCU_ACILISI.besler, ...YER_TUTUCU_ACILISI.onbirler]) {
      expect(eli).toContain(tas.id);
    }
  });

  it('calinacak tas 2 numaralinin elinde', () => {
    const eli = idler(elleriKur().istakalar[siradaIleri(OGRENCI, 2)]);
    expect(eli).toContain(CALINACAK_TAS.id);
  });
});

// Ogreticinin en az bir kez sonuna kadar gidebilmesi gerekiyor. Bu testin
// varlik sebebi gercek bir hata: dolgu taslari desteden PESI SIRA aliniyordu
// ve `desteOlustur` renk renk urettigi icin her yer tutucuya bir renk BLOGU
// gidiyordu (3 numarali `K1 K1 K2 K2 K3 K3 K4 K5`, 2 numarali `K6..K13`).
// Uc yer tutucu da devasa serilerle oturuyor, el 16 hamlede bitiyordu —
// oyuncu daha 12. adimdayken masayi biri goturuyordu.
describe('el ogretici bitmeden kapanmiyor', () => {
  /** Ogreticinin tamamlanmasi icin gereken hamleden bolca fazlasi. */
  const YETERLI_HAMLE = 60;

  it('dort koltuk da bot oynasa bile el erken bitmiyor', () => {
    let durum = elleriKur();
    let hamle = 0;

    while (durum.faz !== 'el-bitti' && hamle < YETERLI_HAMLE) {
      const aksiyon = botAksiyonu(viewFor(durum, durum.siradaki), durum.siradaki, 0);
      if (aksiyon === null) break;
      const sonuc = reduce(durum, aksiyon);
      if (!sonuc.ok) break;
      durum = sonuc.state;
      hamle += 1;
    }

    expect(durum.faz, `el ${hamle} hamlede kapandi`).not.toBe('el-bitti');
  });

  it('hicbir yer tutucunun elinde hazir uzun seri yok', () => {
    const durum = elleriKur();
    for (const koltuk of [1, 2, 3] as const) {
      // Ayni renkten dortten fazla tas = seri riski. Acilis kutleri
      // (3 numaralinin K5/M5/K11/M11) bu esigin altinda kaliyor.
      const renkSayilari = new Map<string, number>();
      for (const tas of durum.istakalar[koltuk]) {
        if (tas.tip !== 'normal') continue;
        renkSayilari.set(tas.renk, (renkSayilari.get(tas.renk) ?? 0) + 1);
      }
      for (const [renk, sayi] of renkSayilari) {
        expect(sayi, `koltuk ${koltuk} elinde ${sayi} adet ${renk}`).toBeLessThanOrEqual(6);
      }
    }
  });
});

describe('okey cekme senaryosu', () => {
  // Asil dogrulama: kullanicinin iki tasi, 3 numaralinin kutundeki okeyi
  // GERCEKTEN alabiliyor mu? Karari motor veriyor.
  const okeyliPer = { tip: 'kut' as const, taslar: YER_TUTUCU_ACILISI.besler };
  const okeyinId = YER_TUTUCU_ACILISI.besler.find((tas) => tas.tip === 'okey')?.id ?? '';

  it('kullanicinin iki tasi kutteki okeyi almaya yetiyor (§6)', () => {
    const adaylar = okeyCekmeAdaylari(okeyliPer, okeyinId, [...OKEY_TAMAMLAYICILARI]);
    expect(adaylar).not.toBeNull();
    expect(idler(adaylar ?? [])).toEqual(idler(OKEY_TAMAMLAYICILARI));
  });

  it('tek tas YETMIYOR — kutteki okey icin dort renk sarti', () => {
    expect(okeyCekmeAdaylari(okeyliPer, okeyinId, [OKEY_TAMAMLAYICILARI[0]])).toBeNull();
  });
});
