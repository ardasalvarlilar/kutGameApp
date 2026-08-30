import { describe, expect, it } from 'vitest';
import {
  VARSAYILAN_AYARLAR,
  normalTas,
  okeyTas,
  oyuncuKaydiOlustur,
  type OyuncuGorunumu,
  type OyuncuId,
  type Renk,
  type Sayi,
  type Tas,
  type TurNo,
  type YerPeri,
} from '@kut/engine';
import {
  ACIL_ESIGI_MS,
  kademeDusur,
  kademeSuresi,
  kademeleriSifirla,
  kalanSiraSuresi,
  siraBitisAni,
  sonrakiKademe,
  sureDolduAksiyonu,
} from './sure';

const t = (renk: Renk, sayi: Sayi, kopya: 'a' | 'b' = 'a'): Tas => normalTas(renk, sayi, kopya);
const ok = (kopya: 'a' | 'b' = 'a'): Tas => okeyTas(kopya);

function gorunumKur(p: {
  readonly istakam: readonly Tas[];
  readonly faz?: OyuncuGorunumu['faz'];
  readonly siradaki?: OyuncuId;
  readonly tur?: TurNo;
  readonly yer?: readonly YerPeri[];
  readonly islerTaslarim?: readonly string[];
}): OyuncuGorunumu {
  return {
    ben: 0,
    tur: p.tur ?? 1,
    ayarlar: VARSAYILAN_AYARLAR,
    baslayan: 0,
    siradaki: p.siradaki ?? 0,
    faz: p.faz ?? 'atma',
    istakam: p.istakam,
    tasSayilari: oyuncuKaydiOlustur(() => 14),
    desteSayisi: 40,
    atikYiginlari: oyuncuKaydiOlustur(() => ({ ustTas: null, adet: 0 })),
    atikUstu: null,
    atikAdedi: 0,
    yer: p.yer ?? [],
    acmisMi: oyuncuKaydiOlustur(() => false),
    calinanSayisi: oyuncuKaydiOlustur(() => 0),
    islerTasSayisi: oyuncuKaydiOlustur(() => 0),
    islerTaslarim: p.islerTaslarim ?? [],
    islemeYapabilirim: false,
    okeyFirsatlarim: [],
    pencere: null,
    sonuc: null,
  };
}

const SURELER = VARSAYILAN_AYARLAR.siraSureleriMs;

describe('sira suresi — sayac', () => {
  it('kademeler 30 → 20 → 10 saniye', () => {
    expect(SURELER).toEqual([30000, 20000, 10000]);
  });

  it('bitis ani baslangica sureyi ekler', () => {
    expect(siraBitisAni(1_000, 30_000)).toBe(31_000);
  });

  it('kalan sure gectiyse sifir, bitis yoksa sifir', () => {
    expect(kalanSiraSuresi(16_000, 10_000)).toBe(6_000);
    expect(kalanSiraSuresi(16_000, 99_000)).toBe(0);
    expect(kalanSiraSuresi(null, 10_000)).toBe(0);
  });

  it('acil esigi en kisa kademenin bile icinde', () => {
    expect(ACIL_ESIGI_MS).toBeLessThan(Math.min(...SURELER));
  });
});

describe('sure kademeleri — KURALLAR.md §9 0.4', () => {
  it('ilk kademe tam sure', () => {
    expect(kademeSuresi(0, SURELER)).toBe(30_000);
  });

  it('sure dolduran bir alt kademeye duser', () => {
    const birinci = sonrakiKademe(0, SURELER);
    expect(kademeSuresi(birinci, SURELER)).toBe(20_000);
    const ikinci = sonrakiKademe(birinci, SURELER);
    expect(kademeSuresi(ikinci, SURELER)).toBe(10_000);
  });

  it('son kademede kalir — bir daha dusmez', () => {
    let kademe = 0;
    for (let i = 0; i < 10; i++) kademe = sonrakiKademe(kademe, SURELER);
    expect(kademe).toBe(SURELER.length - 1);
    expect(kademeSuresi(kademe, SURELER)).toBe(10_000);
  });

  it('kademeler hep kisalir, uzamaz', () => {
    for (let i = 1; i < SURELER.length; i++) {
      expect(kademeSuresi(i, SURELER)).toBeLessThan(kademeSuresi(i - 1, SURELER));
    }
  });

  it('kacinci hatada hangi sure — kullanicinin sordugu', () => {
    // Hic dolmadi → 30, birinci doluş → 20, IKINCI doluş → 10.
    let kademe = 0;
    expect(kademeSuresi(kademe, SURELER)).toBe(30_000);
    kademe = sonrakiKademe(kademe, SURELER);
    expect(kademeSuresi(kademe, SURELER)).toBe(20_000);
    kademe = sonrakiKademe(kademe, SURELER);
    expect(kademeSuresi(kademe, SURELER)).toBe(10_000);
  });

  it('sinir disi kademe en yakin kademeye oturur', () => {
    expect(kademeSuresi(-3, SURELER)).toBe(30_000);
    expect(kademeSuresi(99, SURELER)).toBe(10_000);
  });

  it('bos kademe listesi cokmez', () => {
    expect(kademeSuresi(0, [])).toBe(0);
    expect(sonrakiKademe(0, [])).toBe(0);
  });
});

describe('sureDolduAksiyonu — sure dolunca oyuncunun yerine oynar', () => {
  it('cekmediyse once desteden ceker (§4)', () => {
    const gorunum = gorunumKur({ istakam: [t('sari', 2)], faz: 'cekme' });
    expect(sureDolduAksiyonu(gorunum, 0, 500)).toEqual({
      tip: 'CEK_DESTEDEN',
      oyuncu: 0,
      suAn: 500,
    });
  });

  it('cektiyse ise yaramayan bir tas atar', () => {
    // kirmizi 5-6-7 bir seri; disarida kalan tek tas sari 2.
    const el = [t('kirmizi', 5), t('kirmizi', 6), t('kirmizi', 7), t('sari', 2)];
    const aksiyon = sureDolduAksiyonu(gorunumKur({ istakam: el }), 0, 900);
    expect(aksiyon).toEqual({ tip: 'AT', oyuncu: 0, tasId: t('sari', 2).id, suAn: 900 });
  });

  it('perdeki tasa dokunmaz — puani daha yuksek olsa bile', () => {
    // kirmizi 11-12-13 seri (39 puan). Disarida sari 2 var, o gider.
    const el = [t('kirmizi', 11), t('kirmizi', 12), t('kirmizi', 13), t('sari', 2)];
    const aksiyon = sureDolduAksiyonu(gorunumKur({ istakam: el }), 0, 0);
    expect(aksiyon).toMatchObject({ tip: 'AT', tasId: t('sari', 2).id });
  });

  it('okeyi atmaz', () => {
    const aksiyon = sureDolduAksiyonu(
      gorunumKur({ istakam: [ok('a'), t('sari', 2)] }),
      0,
      0,
    );
    expect(aksiyon).toMatchObject({ tip: 'AT', tasId: t('sari', 2).id });
  });

  it('isler tasi atmaz — KURALLAR.md §8, 50 puan ceza', () => {
    const isler = t('sari', 13);
    const aksiyon = sureDolduAksiyonu(
      gorunumKur({ istakam: [isler, t('sari', 2)], islerTaslarim: [isler.id] }),
      0,
      0,
    );
    // 13 daha yuksek puanli ama isler; ceza yememek icin 2 atilir.
    expect(aksiyon).toMatchObject({ tip: 'AT', tasId: t('sari', 2).id });
  });

  it('secim deterministik — ayni gorunum ayni tasi verir', () => {
    // CLAUDE.md motor kurali #2 ile ayni gerekce: rastgelelik oyunu
    // tekrar edilemez yapardi.
    const el = [t('mavi', 3), t('siyah', 9), t('sari', 12), ok('b')];
    const kur = () => sureDolduAksiyonu(gorunumKur({ istakam: el }), 0, 0);
    expect(kur()).toEqual(kur());
  });

  it('el bittiyse hicbir sey yapmaz', () => {
    const gorunum = gorunumKur({ istakam: [t('sari', 2)], faz: 'el-bitti' });
    expect(sureDolduAksiyonu(gorunum, 0, 0)).toBeNull();
  });

  it('sira baskasindaysa hicbir sey yapmaz', () => {
    const gorunum = gorunumKur({ istakam: [t('sari', 2)], siradaki: 2 });
    expect(sureDolduAksiyonu(gorunum, 0, 0)).toBeNull();
  });

  it('atacak tas yoksa null doner', () => {
    expect(sureDolduAksiyonu(gorunumKur({ istakam: [] }), 0, 0)).toBeNull();
  });

  it('elin tamami perse yine de bir tas atar — sira kilitlenmesin', () => {
    // Butun taslar bir pere giriyor; katmanlar sonunda "her tas" katmanina
    // dusup bir sey atmali, yoksa oyuncu sirasinda takilir kalir.
    const el = [t('kirmizi', 5), t('kirmizi', 6), t('kirmizi', 7)];
    expect(sureDolduAksiyonu(gorunumKur({ istakam: el }), 0, 0)).toMatchObject({ tip: 'AT' });
  });
});

describe('kademe kayitlari — el basinda sifirlanir (§9 0.7)', () => {
  it('yeni el: herkes tam sureye doner', () => {
    const sifir = kademeleriSifirla();
    expect(sifir).toEqual({ 0: 0, 1: 0, 2: 0, 3: 0 });
    expect(kademeSuresi(sifir[0], SURELER)).toBe(30_000);
  });

  it('sure dolduran oyuncu iner, digerleri degismez', () => {
    const sonra = kademeDusur(kademeleriSifirla(), 2, SURELER);
    expect(sonra[2]).toBe(1);
    expect(sonra[0]).toBe(0);
    expect(sonra[1]).toBe(0);
    expect(sonra[3]).toBe(0);
  });

  it('el icinde birikir, el bitince silinir', () => {
    // Iki kez sure dolduran oyuncu 10 saniyeye iner...
    let kademeler = kademeleriSifirla();
    kademeler = kademeDusur(kademeler, 0, SURELER);
    kademeler = kademeDusur(kademeler, 0, SURELER);
    expect(kademeSuresi(kademeler[0], SURELER)).toBe(10_000);

    // ...ama yeni el basladiginda yine 30 saniyeyle basliyor.
    const yeniEl = kademeleriSifirla();
    expect(kademeSuresi(yeniEl[0], SURELER)).toBe(30_000);
  });

  it('son kademede kalan oyuncu da yeni elde sifirlanir', () => {
    let kademeler = kademeleriSifirla();
    for (let i = 0; i < 6; i++) kademeler = kademeDusur(kademeler, 1, SURELER);
    expect(kademeler[1]).toBe(SURELER.length - 1);
    expect(kademeleriSifirla()[1]).toBe(0);
  });
});
