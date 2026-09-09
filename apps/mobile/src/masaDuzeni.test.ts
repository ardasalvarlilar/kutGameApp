import { describe, expect, it } from 'vitest';
import { siradaIleri, type OyuncuId } from '@kut/engine';
import { SABIT_REFERANS, masaKonumlari, type Konum } from './masaDuzeni';

const KOLTUKLAR: readonly OyuncuId[] = [0, 1, 2, 3];
const KONUMLAR: readonly Konum[] = ['guney', 'dogu', 'kuzey', 'bati'];

describe('masaKonumlari', () => {
  it('referans koltuk guneyde (altta) oturuyor', () => {
    for (const koltuk of KOLTUKLAR) {
      expect(masaKonumlari(koltuk).guney).toBe(koltuk);
    }
  });

  // Ekranin sagindaki, oyuncunun SAGINDAKI olmali: attigi tasi bedelsiz alan
  // (KURALLAR.md §4). Bu esitlik bozulursa oyuncu koltuk secerken yanlis
  // komsuya bakiyor demektir.
  it('dogudaki, referansin sagindaki oyuncu (§4)', () => {
    for (const koltuk of KOLTUKLAR) {
      expect(masaKonumlari(koltuk).dogu).toBe(siradaIleri(koltuk, 1));
    }
  });

  it('kuzeydeki karsidaki, batidaki solundaki', () => {
    for (const koltuk of KOLTUKLAR) {
      const konumlar = masaKonumlari(koltuk);
      expect(konumlar.kuzey).toBe(siradaIleri(koltuk, 2));
      expect(konumlar.bati).toBe(siradaIleri(koltuk, 3));
    }
  });

  it('dort koltugun tamami bir kez yerlesiyor', () => {
    for (const koltuk of KOLTUKLAR) {
      const yerlesenler = KONUMLAR.map((konum) => masaKonumlari(koltuk)[konum]);
      expect(new Set(yerlesenler).size).toBe(4);
      expect([...yerlesenler].sort()).toEqual([0, 1, 2, 3]);
    }
  });

  it('sabit plan: koltuk 0 guneyde, sagindaki koltuk 3', () => {
    const konumlar = masaKonumlari(SABIT_REFERANS);
    expect(konumlar).toEqual({ guney: 0, dogu: 3, kuzey: 2, bati: 1 });
  });

  // Bekleme odasindaki hatanin testi: plan referansla birlikte DONERSE
  // oyuncu koltuk degistirdiginde kendini hep ayni yerde gorur. Sabit
  // referansta ise kart gercekten tasinir.
  it('sabit referansla plan degismiyor — oyuncu koltuk degistirince kart tasiniyor', () => {
    const plan = masaKonumlari(SABIT_REFERANS);

    const konumumu = (koltuk: OyuncuId): Konum =>
      KONUMLAR.find((konum) => plan[konum] === koltuk) as Konum;

    expect(konumumu(0)).toBe('guney');
    expect(konumumu(2)).toBe('kuzey');
    expect(konumumu(0)).not.toBe(konumumu(2));
  });

  it('referans donunce plan da donuyor — oyun ekraninin bekledigi davranis', () => {
    expect(masaKonumlari(2).guney).toBe(2);
    expect(masaKonumlari(2)).not.toEqual(masaKonumlari(0));
  });
});
