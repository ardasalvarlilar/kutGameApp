// `elKur` — desteyi KARISTIRMADAN dagitir.
//
// Ogretici senaryosu dort elin de tamamini bilmek zorunda; tohum arayarak
// istenen dagitimi bulmak pratik degil. Bu fonksiyon `elBaslat` ile ayni
// dagitim kodunu paylasiyor, tek farki karistirmamasi — dolayisiyla test
// ikisinin ayni iskeleti kurdugunu da kovaliyor.

import { describe, expect, it } from 'vitest';
import { elBaslat, elKur } from '../src/durum';
import { desteOlustur } from '../src/tas';
import { siradaIleri } from '../src/tipler';

const DESTE = desteOlustur();

describe('elKur', () => {
  it('baslayana 15, digerlerine 14 tas dagitiyor (§1)', () => {
    const durum = elKur({ tur: 1, baslayan: 0, deste: DESTE });
    expect(durum.istakalar[0]).toHaveLength(15);
    expect(durum.istakalar[1]).toHaveLength(14);
    expect(durum.istakalar[2]).toHaveLength(14);
    expect(durum.istakalar[3]).toHaveLength(14);
  });

  it('geriye 49 tas kaliyor', () => {
    const durum = elKur({ tur: 1, baslayan: 0, deste: DESTE });
    expect(durum.deste).toHaveLength(49);
    expect(durum.istakalar[0].length + durum.istakalar[1].length).toBe(29);
  });

  it('desteyi KARISTIRMIYOR — ilk 15 tas baslayanin', () => {
    const durum = elKur({ tur: 1, baslayan: 0, deste: DESTE });
    expect(durum.istakalar[0]).toEqual(DESTE.slice(0, 15));
  });

  it('dagitim oyun yonunde ilerliyor (§4)', () => {
    const durum = elKur({ tur: 1, baslayan: 0, deste: DESTE });
    // baslayan 15 aldi; sirasiyla siradaIleri(0,1)=3, sonra 2, sonra 1.
    expect(durum.istakalar[siradaIleri(0, 1)]).toEqual(DESTE.slice(15, 29));
    expect(durum.istakalar[siradaIleri(0, 2)]).toEqual(DESTE.slice(29, 43));
    expect(durum.istakalar[siradaIleri(0, 3)]).toEqual(DESTE.slice(43, 57));
    expect(durum.deste).toEqual(DESTE.slice(57));
  });

  it('baslayan 0 olmak zorunda degil', () => {
    for (const baslayan of [0, 1, 2, 3] as const) {
      const durum = elKur({ tur: 1, baslayan, deste: DESTE });
      expect(durum.istakalar[baslayan]).toHaveLength(15);
      expect(durum.baslayan).toBe(baslayan);
      expect(durum.siradaki).toBe(baslayan);
    }
  });

  it('baslayan cekmeden atar — faz `atma` ile basliyor (§1)', () => {
    const durum = elKur({ tur: 1, baslayan: 2, deste: DESTE });
    expect(durum.faz).toBe('atma');
  });

  it('turu ve bos alanlari elBaslat gibi kuruyor', () => {
    const durum = elKur({ tur: 7, baslayan: 0, deste: DESTE });
    expect(durum.tur).toBe(7);
    expect(durum.yer).toEqual([]);
    expect(durum.atikSirasi).toEqual([]);
    expect(durum.pencere).toBeNull();
    expect(durum.sonuc).toBeNull();
    expect(durum.sonHareketler).toEqual([]);
  });

  it('hicbir tas kaybolmuyor ya da cogalmiyor', () => {
    const durum = elKur({ tur: 1, baslayan: 0, deste: DESTE });
    const hepsi = [
      ...durum.deste,
      ...([0, 1, 2, 3] as const).flatMap((oyuncu) => durum.istakalar[oyuncu]),
    ];
    expect(hepsi).toHaveLength(106);
    expect(new Set(hepsi.map((tas) => tas.id)).size).toBe(106);
  });

  it('ayni deste ayni durumu uretiyor (motor kurali #2)', () => {
    const bir = elKur({ tur: 1, baslayan: 0, deste: DESTE });
    const iki = elKur({ tur: 1, baslayan: 0, deste: DESTE });
    expect(bir).toEqual(iki);
  });

  it('elBaslat ile ayni iskele — tek fark karistirma', () => {
    const kurulu = elKur({ tur: 3, baslayan: 1, deste: DESTE });
    const tohumlu = elBaslat({ tur: 3, baslayan: 1, tohum: 42 });

    expect(kurulu.tur).toBe(tohumlu.tur);
    expect(kurulu.faz).toBe(tohumlu.faz);
    expect(kurulu.siradaki).toBe(tohumlu.siradaki);
    expect(kurulu.deste).toHaveLength(tohumlu.deste.length);
    for (const oyuncu of [0, 1, 2, 3] as const) {
      expect(kurulu.istakalar[oyuncu]).toHaveLength(tohumlu.istakalar[oyuncu].length);
    }
    // Ayni destenin karistirilmis hali farkli bir dagitim veriyor.
    expect(kurulu.istakalar[1]).not.toEqual(tohumlu.istakalar[1]);
  });

  it('istenen eli birebir kuruyor — ogreticinin dayandigi sozlesme', () => {
    const istenen = [...DESTE].reverse();
    const durum = elKur({ tur: 1, baslayan: 0, deste: istenen });
    expect(durum.istakalar[0]).toEqual(istenen.slice(0, 15));
  });
});
