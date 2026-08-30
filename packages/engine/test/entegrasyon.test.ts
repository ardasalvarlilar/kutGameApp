import { describe, expect, it } from 'vitest';
import type { Aksiyon } from '../src/aksiyonlar';
import { elBaslat, type OyunDurumu } from '../src/durum';
import { reduce } from '../src/reduce';
import { OYUNCULAR } from '../src/tipler';

// Fixture'larin gizleyebilecegi hatalari yakalamak icin gercek bir el oynatilir.

function tumTaslar(durum: OyunDurumu): readonly string[] {
  return [
    ...durum.deste,
    ...OYUNCULAR.flatMap((o) => [...durum.istakalar[o]]),
    ...OYUNCULAR.flatMap((o) => [...durum.atikYiginlari[o]]),
    ...durum.yer.flatMap((per) => [...per.taslar]),
  ].map((tas) => tas.id);
}

/** Herkes desteden ceker ve ilk tasini atar; el deste tukenene kadar surer. */
function eliOyna(tohum: number): { durum: OyunDurumu; aksiyonlar: Aksiyon[]; hamle: number } {
  let durum = elBaslat({ tur: 1, baslayan: 0, tohum });
  const aksiyonlar: Aksiyon[] = [];
  let suAn = 0;
  let hamle = 0;

  while (durum.faz !== 'el-bitti' && hamle < 500) {
    const oyuncu = durum.siradaki;
    suAn += 5000;

    const aksiyon: Aksiyon =
      durum.faz === 'cekme'
        ? { tip: 'CEK_DESTEDEN', oyuncu, suAn }
        : { tip: 'AT', oyuncu, tasId: durum.istakalar[oyuncu][0]!.id, suAn };

    const sonuc = reduce(durum, aksiyon);
    if (!sonuc.ok) throw new Error(`hamle ${hamle}: ${sonuc.reason}`);
    aksiyonlar.push(aksiyon);
    durum = sonuc.state;
    hamle += 1;
  }

  return { durum, aksiyonlar, hamle };
}

describe('tam el — gercek dagitimdan el sonuna', () => {
  it('el deste tukenerek kapanir', () => {
    const { durum, hamle } = eliOyna(31337);
    expect(durum.faz).toBe('el-bitti');
    expect(durum.sonuc?.bitisTipi).toBe('deste-tukendi');
    expect(durum.sonuc?.kazanan).toBe(null);
    expect(hamle).toBeLessThan(500);
  });

  it('el boyunca hicbir tas kaybolmaz ya da cogalmaz', () => {
    let durum = elBaslat({ tur: 1, baslayan: 0, tohum: 555 });
    let suAn = 0;

    while (durum.faz !== 'el-bitti') {
      const oyuncu = durum.siradaki;
      suAn += 5000;
      const aksiyon: Aksiyon =
        durum.faz === 'cekme'
          ? { tip: 'CEK_DESTEDEN', oyuncu, suAn }
          : { tip: 'AT', oyuncu, tasId: durum.istakalar[oyuncu][0]!.id, suAn };
      const sonuc = reduce(durum, aksiyon);
      if (!sonuc.ok) throw new Error(sonuc.reason);
      durum = sonuc.state;

      const idler = tumTaslar(durum);
      expect(idler).toHaveLength(106);
      expect(new Set(idler).size).toBe(106);
    }
  });

  it('ayni tohum + ayni aksiyon listesi ayni oyunu uretir', () => {
    const bir = eliOyna(2024);
    const iki = eliOyna(2024);
    expect(JSON.stringify(bir.durum)).toBe(JSON.stringify(iki.durum));

    // Aksiyon listesini bastan uygulamak da ayni sonucu vermeli.
    let tekrar = elBaslat({ tur: 1, baslayan: 0, tohum: 2024 });
    for (const aksiyon of bir.aksiyonlar) {
      const sonuc = reduce(tekrar, aksiyon);
      if (!sonuc.ok) throw new Error(sonuc.reason);
      tekrar = sonuc.state;
    }
    expect(JSON.stringify(tekrar)).toBe(JSON.stringify(bir.durum));
  });

  it('farkli tohum farkli oyun uretir', () => {
    expect(JSON.stringify(eliOyna(1).durum)).not.toBe(JSON.stringify(eliOyna(2).durum));
  });

  it('indirgeyici girdi durumunu degistirmez', () => {
    const durum = elBaslat({ tur: 1, baslayan: 0, tohum: 99 });
    const once = JSON.stringify(durum);
    reduce(durum, { tip: 'AT', oyuncu: 0, tasId: durum.istakalar[0][0]!.id, suAn: 0 });
    expect(JSON.stringify(durum)).toBe(once);
  });

  it('el sonunda dort oyuncunun da puani hesaplanir', () => {
    const { durum } = eliOyna(4711);
    for (const oyuncu of OYUNCULAR) {
      expect(typeof durum.sonuc?.puanlar[oyuncu]).toBe('number');
      expect(durum.sonuc?.detaylar[oyuncu].carpan).toBe(2);
    }
  });
});
