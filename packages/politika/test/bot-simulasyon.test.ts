import { describe, expect, it } from 'vitest';
import {
  OYUNCULAR,
  elBaslat,
  reduce,
  viewFor,
  type OyunDurumu,
  type OyuncuId,
  type TurNo,
} from '@kut/engine';
import { atilacakTas, botAksiyonu, botTalebi } from '../src/bot';

// Dort yer tutucu oyuncuyla bastan sona el oynatir.
// Amaci iki sey: botun gecerli hamle uretmesi ve gercekten acabilmesi.

interface ElSonucu {
  readonly durum: OyunDurumu;
  readonly hamle: number;
  readonly acanlar: readonly OyuncuId[];
  readonly reddedilen: number;
}

function eliOyna(tur: TurNo, tohum: number, hamleSiniri = 600): ElSonucu {
  let durum = elBaslat({ tur, baslayan: 0, tohum });
  let hamle = 0;
  let reddedilen = 0;
  let suAn = 0;

  while (durum.faz !== 'el-bitti' && hamle < hamleSiniri) {
    const siradaki = durum.siradaki;
    suAn += 5000;

    const aksiyon = botAksiyonu(viewFor(durum, siradaki), siradaki, suAn);
    if (aksiyon === null) break;

    const sonuc = reduce(durum, aksiyon);
    if (!sonuc.ok) {
      reddedilen += 1;
      // Surucudeki davranisin aynisi: reddedilen hamleyi atla, tas at.
      const tas = atilacakTas(viewFor(durum, siradaki));
      if (tas === null) break;
      const atis = reduce(durum, { tip: 'AT', oyuncu: siradaki, tasId: tas.id, suAn });
      if (!atis.ok) break;
      durum = atis.state;
    } else {
      durum = sonuc.state;
    }
    hamle += 1;
  }

  return {
    durum,
    hamle,
    acanlar: OYUNCULAR.filter((oyuncu) => durum.acmisMi[oyuncu]),
    reddedilen,
  };
}

function tumTaslar(durum: OyunDurumu): readonly string[] {
  return [
    ...durum.deste,
    ...OYUNCULAR.flatMap((o) => [...durum.istakalar[o]]),
    ...OYUNCULAR.flatMap((o) => [...durum.atikYiginlari[o]]),
    ...durum.yer.flatMap((per) => [...per.taslar]),
  ].map((tas) => tas.id);
}

describe('bot simulasyonu — tur 1', () => {
  const eller = Array.from({ length: 30 }, (_deger, i) => eliOyna(1, 1000 + i * 7919));

  it('her el bir sonuca baglanir, sonsuz donguye girmez', () => {
    for (const el of eller) {
      expect(el.durum.faz).toBe('el-bitti');
      expect(el.hamle).toBeLessThan(600);
    }
  });

  it('hicbir elde tas kaybolmaz ya da cogalmaz', () => {
    for (const el of eller) {
      const idler = tumTaslar(el.durum);
      expect(idler).toHaveLength(106);
      expect(new Set(idler).size).toBe(106);
    }
  });

  it('botlar aciyor — sadece cekip atmiyorlar', () => {
    const acilanEl = eller.filter((el) => el.acanlar.length > 0);
    expect(acilanEl.length).toBeGreaterThan(0);
  });

  it('acan oyuncunun yerde peri var ve sart tam karsilanmis', () => {
    for (const el of eller) {
      for (const oyuncu of el.acanlar) {
        const perler = el.durum.yer.filter((per) => per.sahibi === oyuncu);
        // Tur 1'in sarti: 2 × uclu kut.
        expect(perler.length).toBeGreaterThanOrEqual(2);
        for (const per of perler.slice(0, 2)) {
          expect(per.tip).toBe('kut');
        }
      }
    }
  });

  it('ayni tohum ayni eli uretir — bot da belirlenimli', () => {
    const bir = eliOyna(1, 424242);
    const iki = eliOyna(1, 424242);
    expect(JSON.stringify(bir.durum)).toBe(JSON.stringify(iki.durum));
  });
});

describe('bot simulasyonu — butun turlar', () => {
  const turlar: readonly TurNo[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

  it('her turda el sorunsuz kapanir', () => {
    for (const tur of turlar) {
      const el = eliOyna(tur, 555 + tur * 104729);
      expect(el.durum.faz, `tur ${tur}`).toBe('el-bitti');
      expect(el.durum.sonuc, `tur ${tur}`).not.toBeNull();
      const idler = tumTaslar(el.durum);
      expect(new Set(idler).size, `tur ${tur}`).toBe(106);
    }
  });

  it('el sonunda dort oyuncunun da puani hesaplanir', () => {
    for (const tur of turlar) {
      const el = eliOyna(tur, 777 + tur * 7919);
      for (const oyuncu of OYUNCULAR) {
        expect(typeof el.durum.sonuc?.puanlar[oyuncu], `tur ${tur}`).toBe('number');
      }
    }
  });
});

// --- Calmali simulasyon ------------------------------------------------------
//
// Yukaridaki dongude yalnizca SIRASI GELEN oynuyor. Calma ise sira
// baskasindayken yapilan bir hamle (KURALLAR.md §5) ve eli kalici olarak
// buyutuyor: her calis +2 tas (calinan + ceza tasi). Ayri bir simulasyon
// gerekiyordu, cunku asil risk tam da burada: botun urettigi bir talep motorca
// reddedilirse durum degismiyor ve sira KILITLENIYOR.

interface CalmaliSonuc extends ElSonucu {
  readonly talep: number;
  readonly reddedilenTalep: number;
}

function eliCalarakOyna(tur: TurNo, tohum: number, hamleSiniri = 800): CalmaliSonuc {
  let durum = elBaslat({ tur, baslayan: 0, tohum });
  let hamle = 0;
  let reddedilen = 0;
  let talep = 0;
  let reddedilenTalep = 0;
  let suAn = 0;

  /**
   * Pencere acikken sirasi gelmeyen botlarin talebi.
   *
   * Durumu parametre alip geri donduruyor, disaridaki `durum`u kapatip
   * degistirmiyor: oyle yapinca TypeScript while kosulundan gelen daralmayi
   * koruyor ve dongudeki `faz === 'el-bitti'` kontrolu "imkansiz" sayiliyor.
   */
  const talepleriTopla = (baslangic: OyunDurumu): OyunDurumu => {
    let anlik = baslangic;
    for (const koltuk of OYUNCULAR) {
      if (anlik.pencere === null) return anlik;
      const aksiyon = botTalebi(viewFor(anlik, koltuk), koltuk, suAn);
      if (aksiyon === null) continue;

      talep += 1;
      const sonuc = reduce(anlik, aksiyon);
      if (sonuc.ok) anlik = sonuc.state;
      else reddedilenTalep += 1;
    }
    return anlik;
  };

  while (durum.faz !== 'el-bitti' && hamle < hamleSiniri) {
    durum = talepleriTopla(durum);
    if (durum.faz === 'el-bitti') break;

    const siradaki = durum.siradaki;
    suAn += 5000;

    const aksiyon = botAksiyonu(viewFor(durum, siradaki), siradaki, suAn);
    if (aksiyon === null) break;

    const sonuc = reduce(durum, aksiyon);
    if (!sonuc.ok) {
      reddedilen += 1;
      const tas = atilacakTas(viewFor(durum, siradaki));
      if (tas === null) break;
      const atis = reduce(durum, { tip: 'AT', oyuncu: siradaki, tasId: tas.id, suAn });
      if (!atis.ok) break;
      durum = atis.state;
    } else {
      durum = sonuc.state;
    }
    hamle += 1;
  }

  return {
    durum,
    hamle,
    acanlar: OYUNCULAR.filter((oyuncu) => durum.acmisMi[oyuncu]),
    reddedilen,
    talep,
    reddedilenTalep,
  };
}

describe('bot simulasyonu — calma acikken', () => {
  const turlar: readonly TurNo[] = [1, 2, 9, 15];
  const eller = turlar.flatMap((tur) =>
    Array.from({ length: 8 }, (_deger, i) => ({ tur, sonuc: eliCalarakOyna(tur, 4000 + i * 6151) })),
  );

  it('el kilitlenmeden bitiyor', () => {
    for (const { tur, sonuc } of eller) {
      expect(sonuc.durum.faz, `tur ${tur}`).toBe('el-bitti');
    }
  });

  it('botun urettigi hicbir talep motorca reddedilmiyor', () => {
    // Reddedilen bir talep durumu degistirmez ve surucuyu bosuna dondururdu;
    // `botTalebi` motorun butun on kosullarini kendisi eliyor.
    for (const { tur, sonuc } of eller) {
      expect(sonuc.reddedilenTalep, `tur ${tur}`).toBe(0);
    }
  });

  it('botlar gercekten caliyor', () => {
    const toplamTalep = eller.reduce((toplam, { sonuc }) => toplam + sonuc.talep, 0);
    expect(toplamTalep).toBeGreaterThan(0);
  });

  it('tas sayisi korunuyor — calma tas uretmez, yalnizca yer degistirir', () => {
    for (const { tur, sonuc } of eller) {
      const idler = tumTaslar(sonuc.durum);
      expect(idler.length, `tur ${tur}`).toBe(106);
      expect(new Set(idler).size, `tur ${tur}`).toBe(106);
    }
  });

  it('calan oyuncunun calis sayaci artiyor (§8 — 5 puan)', () => {
    const calisOlanEl = eller.find(({ sonuc }) =>
      OYUNCULAR.some((o) => sonuc.durum.calinanSayisi[o] > 0),
    );
    expect(calisOlanEl).toBeDefined();
  });
});
