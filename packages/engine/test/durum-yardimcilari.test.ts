// Durum yardimcilari: `yerPeriBul`, `birTurDonduMu`, `reduceHepsi`.
//
// `birTurDonduMu` bir KURAL tasiyor (KURALLAR.md §6): actiktan sonra ayni
// hamlede isleme yapilamaz, en az bir tur donmesi gerekir.
//
// `reduceHepsi` motor kurali #2'nin belkemigi: tohum + aksiyon listesi bir eli
// birebir geri kurabilmeli. Kopan baglantida oyunu geri kurmak da, hata
// ayiklamak da buna dayaniyor.

import { describe, expect, it } from 'vitest';
import { birTurDonduMu, yerPeriBul } from '../src/durum';
import { reduceHepsi } from '../src/reduce';
import type { Aksiyon } from '../src/aksiyonlar';
import { durumKur, dolgu, reasonAl, t, yerPeri } from './yardimci';

describe('yerPeriBul', () => {
  const yer = [
    yerPeri(1, 0, 'kut', [t('kirmizi', 7), t('mavi', 7), t('siyah', 7)]),
    yerPeri(2, 2, 'seri', [t('sari', 4), t('sari', 5), t('sari', 6)]),
  ];
  const durum = durumKur({ yer, sonrakiPerId: 3 });

  it('kimlige gore peri buluyor', () => {
    expect(yerPeriBul(durum, 2)?.sahibi).toBe(2);
    expect(yerPeriBul(durum, 1)?.tip).toBe('kut');
  });

  it('olmayan kimlik icin null', () => {
    expect(yerPeriBul(durum, 99)).toBeNull();
  });

  it('yer bossa null', () => {
    expect(yerPeriBul(durumKur(), 1)).toBeNull();
  });
});

describe('birTurDonduMu', () => {
  it('acmamis oyuncu icin false', () => {
    const durum = durumKur({ acilisHamlesi: { 0: null }, hamleSayisi: { 0: 5 } });
    expect(birTurDonduMu(durum, 0)).toBe(false);
  });

  // Actigi hamlenin kendisi "tur dondu" sayilmaz — §6'nin butun mesele
  // ettigi durum bu: acar acmaz isleme yapilamiyor.
  it('actigi hamlede henuz donmemis', () => {
    const durum = durumKur({ acilisHamlesi: { 0: 3 }, hamleSayisi: { 0: 3 } });
    expect(birTurDonduMu(durum, 0)).toBe(false);
  });

  it('acilistan sonraki ilk hamlede donmus sayiliyor', () => {
    const durum = durumKur({ acilisHamlesi: { 0: 3 }, hamleSayisi: { 0: 4 } });
    expect(birTurDonduMu(durum, 0)).toBe(true);
  });

  it('oyuncular birbirinden bagimsiz', () => {
    const durum = durumKur({
      acilisHamlesi: { 0: 3, 1: 2 },
      hamleSayisi: { 0: 3, 1: 9 },
    });
    expect(birTurDonduMu(durum, 0)).toBe(false);
    expect(birTurDonduMu(durum, 1)).toBe(true);
  });
});

describe('reduceHepsi', () => {
  const cekilecek = t('sari', 13, 'b');

  function cekmeDurumu() {
    const istaka = dolgu(14, [cekilecek]);
    return durumKur({
      siradaki: 0,
      faz: 'cekme',
      deste: [cekilecek, ...dolgu(6, [cekilecek, ...istaka], 20)],
      istakalar: { 0: istaka },
    });
  }

  const cek: Aksiyon = { tip: 'CEK_DESTEDEN', oyuncu: 0, suAn: 0 };

  it('bos aksiyon listesi durumu degistirmiyor', () => {
    const durum = cekmeDurumu();
    const sonuc = reduceHepsi(durum, []);
    expect(sonuc.ok).toBe(true);
    if (sonuc.ok) expect(sonuc.state).toBe(durum);
  });

  it('tek aksiyonu uyguluyor', () => {
    const durum = cekmeDurumu();
    const sonuc = reduceHepsi(durum, [cek]);
    expect(sonuc.ok).toBe(true);
    if (sonuc.ok) {
      expect(sonuc.state.faz).toBe('atma');
      expect(sonuc.state.istakalar[0]).toHaveLength(15);
    }
  });

  it('ilk gecersiz aksiyonda DURUYOR ve hatayi donduruyor', () => {
    const durum = cekmeDurumu();
    // Ikinci cekis reddedilmeli: zaten cekildi.
    const sonuc = reduceHepsi(durum, [cek, cek]);
    expect(sonuc.ok).toBe(false);
    if (!sonuc.ok) expect(reasonAl(sonuc)).toBe('zaten-cektin');
  });

  it('gecersiz aksiyonda KISMI durum sizmiyor — girdi durumu bozulmuyor', () => {
    const durum = cekmeDurumu();
    const oncekiIstaka = durum.istakalar[0];
    reduceHepsi(durum, [cek, cek]);
    expect(durum.faz).toBe('cekme');
    expect(durum.istakalar[0]).toBe(oncekiIstaka);
  });

  it('ayni liste ayni durumdan hep ayni sonucu uretiyor (motor kurali #2)', () => {
    const bir = reduceHepsi(cekmeDurumu(), [cek]);
    const iki = reduceHepsi(cekmeDurumu(), [cek]);
    expect(bir.ok && iki.ok).toBe(true);
    if (bir.ok && iki.ok) expect(bir.state).toEqual(iki.state);
  });
});
