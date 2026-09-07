import { describe, expect, it } from 'vitest';
import {
  desteOlustur,
  karistir,
  kutMu,
  normalTas,
  okeyTas,
  reduce,
  rngOlustur,
  seriMu,
  type Renk,
  type Sayi,
  type Tas,
} from '@kut/engine';
import { bitirenTaslar, eldenBitmeCozumu, perlereBol } from './eldenBitme';

const t = (renk: Renk, sayi: Sayi, kopya: 'a' | 'b' = 'a'): Tas => normalTas(renk, sayi, kopya);
const ok = (kopya: 'a' | 'b' = 'a'): Tas => okeyTas(kopya);

// KURALLAR.md §3, tur 16 — yere hic per inmez. Butun el gecerli perlere
// bolunur, geriye tek tas kalir, o atilarak bitilir.

describe('perlereBol', () => {
  it('bos girdi bos bolme', () => {
    expect(perlereBol([])).toEqual([]);
  });

  it('ucten az tas bolunemez', () => {
    expect(perlereBol([t('kirmizi', 5), t('kirmizi', 6)])).toBeNull();
  });

  it('tek seri', () => {
    const bolme = perlereBol([t('kirmizi', 5), t('kirmizi', 6), t('kirmizi', 7)]);
    expect(bolme).toHaveLength(1);
  });

  it('tek kut', () => {
    const bolme = perlereBol([t('kirmizi', 3), t('siyah', 3), t('mavi', 3)]);
    expect(bolme).toHaveLength(1);
  });

  it('4+4+3+3 — kullanicinin tarif ettigi dagilim', () => {
    const el = [
      t('kirmizi', 5), t('kirmizi', 6), t('kirmizi', 7), t('kirmizi', 8),
      t('mavi', 9), t('mavi', 10), t('mavi', 11), t('mavi', 12),
      t('sari', 3), t('siyah', 3), t('mavi', 3),
      t('kirmizi', 1), t('siyah', 1), t('mavi', 1),
    ];
    const bolme = perlereBol(el);
    expect(bolme).not.toBeNull();
    expect(bolme!.flat()).toHaveLength(14);
    expect(bolme!.every((per) => per.length >= 3)).toBe(true);
  });

  it('3+3+3+3+2 bolunemez — artan iki tas per degil', () => {
    const el = [
      t('kirmizi', 5), t('kirmizi', 6), t('kirmizi', 7),
      t('mavi', 9), t('mavi', 10), t('mavi', 11),
      t('sari', 3), t('siyah', 3), t('mavi', 3),
      t('kirmizi', 1), t('siyah', 1), t('mavi', 1),
      t('sari', 8), t('sari', 9),
    ];
    expect(perlereBol(el)).toBeNull();
  });

  it('okey bolmede kullanilabilir', () => {
    const el = [t('kirmizi', 5), t('kirmizi', 6), ok('a')];
    expect(perlereBol(el)).not.toBeNull();
  });

  it('bolme taslari ne kaybediyor ne cogaltiyor', () => {
    const el = [
      t('kirmizi', 5), t('kirmizi', 6), t('kirmizi', 7),
      t('sari', 3), t('siyah', 3), t('mavi', 3),
    ];
    const bolme = perlereBol(el)!;
    const kimlikler = bolme.flat().map((tas) => tas.id).sort();
    expect(kimlikler).toEqual(el.map((tas) => tas.id).sort());
  });
});

describe('eldenBitmeCozumu', () => {
  // 15 tas: 14'u perlere giriyor, sari13 atilacak.
  const el = [
    t('kirmizi', 5), t('kirmizi', 6), t('kirmizi', 7), t('kirmizi', 8),
    t('mavi', 9), t('mavi', 10), t('mavi', 11), t('mavi', 12),
    t('sari', 3), t('siyah', 3), t('mavi', 3),
    t('kirmizi', 1), t('siyah', 1), t('mavi', 1),
    t('sari', 13),
  ];

  it('dogru tas atilinca cozum buluyor', () => {
    const cozum = eldenBitmeCozumu(el, t('sari', 13).id);
    expect(cozum).not.toBeNull();
    expect(cozum!.atilanTasId).toBe(t('sari', 13).id);
    expect(cozum!.perler.flat()).toHaveLength(14);
  });

  it('perin icinden tas atilirsa cozum yok', () => {
    expect(eldenBitmeCozumu(el, t('kirmizi', 5).id)).toBeNull();
  });

  it('elde olmayan tas icin null', () => {
    expect(eldenBitmeCozumu(el, 'hayalet-tas')).toBeNull();
  });

  it('bulunan perlerin hepsi en az uc tas ve tekrar yok', () => {
    const cozum = eldenBitmeCozumu(el, t('sari', 13).id)!;
    expect(cozum.perler.every((per) => per.length >= 3)).toBe(true);
    expect(new Set(cozum.perler.flat()).size).toBe(14);
  });
});

describe('bitirenTaslar', () => {
  it('yalnizca dogru tasi isaretliyor', () => {
    const el = [
      t('kirmizi', 5), t('kirmizi', 6), t('kirmizi', 7),
      t('sari', 3), t('siyah', 3), t('mavi', 3),
      t('sari', 13),
    ];
    expect(bitirenTaslar(el)).toEqual([t('sari', 13).id]);
  });

  it('el bitmiyorsa bos liste', () => {
    const el = [
      t('kirmizi', 5), t('kirmizi', 6), t('kirmizi', 7),
      t('sari', 8), t('sari', 9),
    ];
    expect(bitirenTaslar(el)).toEqual([]);
  });

  it('birden cok tas bitirebiliyorsa hepsi', () => {
    // Dortlu kutten biri cikarsa da uclu kut kalir: dordu de bitirir.
    const el = [
      t('kirmizi', 5), t('kirmizi', 6), t('kirmizi', 7),
      t('sari', 3), t('siyah', 3), t('mavi', 3), t('kirmizi', 3),
    ];
    expect(bitirenTaslar(el).length).toBeGreaterThan(1);
  });
});

describe('motor cozumu kabul ediyor', () => {
  it('BITIR_ELDEN gecerli sayiliyor ve el bitiyor', () => {
    const el = [
      t('kirmizi', 5), t('kirmizi', 6), t('kirmizi', 7), t('kirmizi', 8),
      t('mavi', 9), t('mavi', 10), t('mavi', 11), t('mavi', 12),
      t('sari', 3), t('siyah', 3), t('mavi', 3),
      t('kirmizi', 1), t('siyah', 1), t('mavi', 1),
      t('sari', 13),
    ];
    const cozum = eldenBitmeCozumu(el, t('sari', 13).id)!;

    const bosKayit = { 0: [] as readonly Tas[], 1: [], 2: [], 3: [] };
    const durum = {
      ayarlar: { siraSureleriMs: [30000], islerTasCezasi: 50,
        talepGorunurlugu: true, ciftCalmaHakki: true, kazananCalmaCezasiOder: true,
        desteTukendigindeKazananVar: false, desteTukendigindeCalmaCezasi: true,
        tur16AcamadiCarpani: true, tur16OkeyleBitmeCarpani: true },
      tur: 16 as const, baslayan: 0 as const, siradaki: 0 as const, faz: 'atma' as const,
      deste: [], istakalar: { ...bosKayit, 0: el },
      atikYiginlari: bosKayit, atikSirasi: [], yer: [], sonrakiPerId: 1,
      acmisMi: { 0: false, 1: false, 2: false, 3: false },
      acilisHamlesi: { 0: null, 1: null, 2: null, 3: null },
      hamleSayisi: { 0: 0, 1: 0, 2: 0, 3: 0 },
      calinanSayisi: { 0: 0, 1: 0, 2: 0, 3: 0 },
      islerTasSayisi: { 0: 0, 1: 0, 2: 0, 3: 0 },
      pencere: null,
    sonCalan: null, sonuc: null,
    };

    const sonuc = reduce(durum as never, {
      tip: 'BITIR_ELDEN', oyuncu: 0, perler: cozum.perler,
      atilanTasId: cozum.atilanTasId, suAn: 0,
    });
    expect(sonuc.ok).toBe(true);
    if (!sonuc.ok) return;
    expect(sonuc.state.faz).toBe('el-bitti');
    expect(sonuc.state.sonuc?.kazanan).toBe(0);
    expect(sonuc.state.sonuc?.puanlar[0]).toBe(-100);
  });
});

// --- Budamanin dogrulugu ve hizi ---------------------------------------------
//
// `perlereBol` aday perleri iki dar havuzdan kuruyor (ayni sayi / ayni renk).
// Bu bir HIZLANDIRMA; sonucu degistirmemeli. Asagidaki test onu KANITLIYOR:
// eski, hicbir sey budamayan surumle rastgele ellerde karsilastiriyor.

/** Referans surum: her adimda kalan taslarin BUTUN alt kumelerini dener. */
function kabaKuvvetBolunurMu(taslar: readonly Tas[]): boolean {
  if (taslar.length === 0) return true;
  if (taslar.length < 3) return false;

  const ilk = taslar[0]!;
  const geri = taslar.slice(1);

  for (let boy = 3; boy <= Math.min(13, taslar.length); boy++) {
    const secilen: Tas[] = [];
    const gez = (bas: number): boolean => {
      if (secilen.length === boy - 1) {
        const aday = [ilk, ...secilen];
        if (!(kutMu(aday).ok || seriMu(aday).ok)) return false;
        const idler = new Set(aday.map((tas) => tas.id));
        return kabaKuvvetBolunurMu(taslar.filter((tas) => !idler.has(tas.id)));
      }
      for (let i = bas; i < geri.length; i++) {
        secilen.push(geri[i]!);
        const bulundu = gez(i + 1);
        secilen.pop();
        if (bulundu) return true;
      }
      return false;
    };
    if (gez(0)) return true;
  }
  return false;
}

describe('budama sonucu degistirmiyor', () => {
  /**
   * Dar bir desteden el dagitir: iki renk, 1–6 arasi sayilar.
   * Tam desteden cekilen rastgele 6–9 tas neredeyse hicbir zaman perlere
   * bolunmuyor; dar deste iki cevabi da bol bol uretiyor, yani test
   * gercekten karsilastirma yapiyor.
   */
  function darEl(tohum: number, boy: number): readonly Tas[] {
    const havuz: Tas[] = [];
    for (const renk of ['kirmizi', 'mavi'] as const) {
      for (const sayi of [1, 2, 3, 4, 5, 6] as const) {
        havuz.push(t(renk, sayi, 'a'), t(renk, sayi, 'b'));
      }
    }
    havuz.push(ok('a'), ok('b'));
    return karistir(havuz, rngOlustur(tohum)).slice(0, boy);
  }

  it('rastgele ellerde kaba kuvvetle ayni cevabi veriyor', () => {
    let farkli = 0;
    let bolunen = 0;

    for (let deneme = 0; deneme < 300; deneme++) {
      // Kucuk eller: kaba kuvvet surumu 10 tastan sonra dakikalar suruyor.
      const boy = 3 + (deneme % 7);
      const el = darEl(deneme * 7919 + 13, boy);

      const hizli = perlereBol(el) !== null;
      const kaba = kabaKuvvetBolunurMu(el);
      if (hizli !== kaba) farkli++;
      if (kaba) bolunen++;
    }

    expect(farkli).toBe(0);
    // Testin bir sey olctugunun kaniti: "hepsi null" diyen bozuk bir surum
    // de farkli === 0 verirdi. 300 elin ~16'si bolunuyor; asil deger
    // bolunmeyenlerde, cunku budamanin gecerli bir peri elemesi orada
    // gorunurdu.
    expect(bolunen).toBeGreaterThan(10);
  });

  it('bulunan bolme gercekten gecerli ve butun taslari kapsiyor', () => {
    const deste = [...desteOlustur()];
    let bulunan = 0;

    for (let deneme = 0; deneme < 300; deneme++) {
      const el = [
        ...karistir(deste, rngOlustur(deneme * 104729 + 7)).slice(0, 14),
      ];
      const bolme = perlereBol(el) ?? perlereBol(darEl(deneme * 31 + 5, 9));
      if (bolme === null) continue;
      bulunan++;

      expect(new Set(bolme.flat().map((tas) => tas.id)).size).toBe(bolme.flat().length);
      for (const per of bolme) expect(kutMu(per).ok || seriMu(per).ok).toBe(true);
    }
    expect(bulunan).toBeGreaterThan(0);
  });
});

describe('tur 16 arama suresi — donmanin kaynagiydi', () => {
  // Bolunmeyen el en pahali durum: arama agacinin tamami geziliyor. Calma
  // (KURALLAR.md §5) eli 20+ tasa cikarabildigi icin sinir orada.
  const bolunmeyen20: readonly Tas[] = [
    t('kirmizi', 1), t('kirmizi', 3), t('kirmizi', 5), t('kirmizi', 7),
    t('siyah', 2), t('siyah', 4), t('siyah', 6), t('siyah', 9),
    t('mavi', 1), t('mavi', 4), t('mavi', 8), t('mavi', 11),
    t('sari', 2), t('sari', 5), t('sari', 13),
    t('kirmizi', 10), t('siyah', 12), t('mavi', 6), t('sari', 9), ok(),
  ];

  it('20 taslik bolunmeyen el 250 ms altinda taraniyor', () => {
    expect(perlereBol(bolunmeyen20)).toBeNull();

    const bas = performance.now();
    bitirenTaslar(bolunmeyen20);
    const gecen = performance.now() - bas;

    // Budamadan onceki olcum ayni makinede 3679 ms idi. Esik telefonu da
    // kapsayacak kadar genis; amac sinirin yeniden asilmasini yakalamak.
    expect(gecen).toBeLessThan(250);
  });
});
