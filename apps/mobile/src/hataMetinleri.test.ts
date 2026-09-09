// `hataMetni` — hata KODUNU oyuncunun okuyacagi cumleye cevirir.
//
// Testin asil kovaladigi kural: TANIMADIGI kod oldugu gibi gosterilmeli.
// Eski bir uygulama surumu yeni bir sunucu koduyla karsilastiginda oyuncu
// bos ekran degil, ham kod gormeli — aksi halde hata sessizce yutulur.

import { describe, expect, it } from 'vitest';
import type { Ceviri, MetinAnahtari } from './dil/cevir';
import { hataMetni } from './hataMetinleri';

/** Anahtari oldugu gibi donduren sahte sozluk: esleme gorunur olsun diye. */
const t: Ceviri = (anahtar: MetinAnahtari) => anahtar;

describe('hataMetni', () => {
  it('kod yoksa metin de yok', () => {
    expect(hataMetni(null, t)).toBeNull();
  });

  it('motorun hata kodunu sozluk anahtarina ceviriyor', () => {
    expect(hataMetni('sira-sende-degil', t)).toBe('hata.sira-sende-degil');
    expect(hataMetni('once-cekmelisin', t)).toBe('hata.once-cekmelisin');
    expect(hataMetni('el-bitti', t)).toBe('hata.el-bitti');
  });

  it('sunucunun hata kodunu sozluk anahtarina ceviriyor', () => {
    expect(hataMetni('masa-dolu', t)).toBe('sunucu.masa-dolu');
    expect(hataMetni('zaten-masadasin', t)).toBe('sunucu.zaten-masadasin');
    expect(hataMetni('koltuk-kapildi', t)).toBe('sunucu.koltuk-kapildi');
  });

  it('TANIMADIGI kodu oldugu gibi gosteriyor', () => {
    expect(hataMetni('daha-once-gorulmemis-kod', t)).toBe('daha-once-gorulmemis-kod');
  });

  it('bos kod bile yutulmuyor', () => {
    expect(hataMetni('', t)).toBe('');
  });

  it('motor ve sunucu kodlari ayni fonksiyondan geciyor', () => {
    // Ikisi ayri sozlukte ama cagiran ayrimi bilmek zorunda degil: surucu
    // hangi tarafin kodunu tasidigina bakmadan bunu cagiriyor.
    expect(hataMetni('az-tas', t)).toBe('hata.az-tas');
    expect(hataMetni('masada-degilsin', t)).toBe('sunucu.masada-degilsin');
  });

  it('ceviri fonksiyonuna anahtar disinda bir sey gecmiyor', () => {
    const cagrilar: MetinAnahtari[] = [];
    const kayitli: Ceviri = (anahtar) => {
      cagrilar.push(anahtar);
      return 'metin';
    };
    hataMetni('sira-sende-degil', kayitli);
    expect(cagrilar).toEqual(['hata.sira-sende-degil']);
  });
});
