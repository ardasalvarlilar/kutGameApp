import { describe, expect, it } from 'vitest';
import {
  VARSAYILAN_AYARLAR,
  normalTas,
  okeyTas,
  oyuncuKaydiOlustur,
  reduce,
  sartKarsilaniyorMu,
  kutMu,
  seriMu,
  type OkeyFirsati,
  type OyuncuGorunumu,
  type OyuncuId,
  type Per,
  type Renk,
  type Sayi,
  type Tas,
  type TurNo,
  type YerPeri,
} from '@kut/engine';
import { okeyAlinabilirMi, okeyFirsatiSec, okeyleAcilisBul } from './okey';

const t = (renk: Renk, sayi: Sayi, kopya: 'a' | 'b' = 'a'): Tas => normalTas(renk, sayi, kopya);
const ok = (kopya: 'a' | 'b' = 'a'): Tas => okeyTas(kopya);

function perlestir(gruplar: readonly (readonly Tas[])[]): Per[] {
  return gruplar.map((grup) => {
    const kut = kutMu(grup);
    if (kut.ok) return kut.per;
    const seri = seriMu(grup);
    if (seri.ok) return seri.per;
    return { tip: 'cift', taslar: grup };
  });
}

function gorunumKur(p: {
  readonly istakam: readonly Tas[];
  readonly yer?: readonly YerPeri[];
  readonly tur?: TurNo;
  readonly faz?: OyuncuGorunumu['faz'];
  readonly siradaki?: OyuncuId;
  readonly acmisMi?: boolean;
  readonly islemeYapabilirim?: boolean;
  readonly okeyFirsatlarim?: readonly OkeyFirsati[];
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
    acmisMi: oyuncuKaydiOlustur((o) => (o === 0 ? (p.acmisMi ?? false) : false)),
    calinanSayisi: oyuncuKaydiOlustur(() => 0),
    islerTasSayisi: oyuncuKaydiOlustur(() => 0),
    islerTaslarim: [],
    islemeYapabilirim: p.islemeYapabilirim ?? (p.acmisMi ?? false),
    okeyFirsatlarim: p.okeyFirsatlarim ?? [],
    pencere: null,
    sonuc: null,
  };
}

// Kullanicinin anlattigi senaryo: yerde kirmizi3 + siyah3 + mavi3 + okey,
// eksik renk sari. Elimde sari3 var.
const OKEYLI_KUT: YerPeri = {
  id: 1,
  sahibi: 2,
  tip: 'kut',
  taslar: [t('kirmizi', 3), t('siyah', 3), t('mavi', 3), ok('a')],
};
const FIRSAT: OkeyFirsati = {
  perId: 1,
  okeyTasId: ok('a').id,
  yerineTasIdler: [t('sari', 3).id],
};

describe('okeyFirsatiSec', () => {
  const ikinci: OkeyFirsati = { perId: 2, okeyTasId: ok('b').id, yerineTasIdler: [t('mavi', 6).id] };

  it('firsat yoksa null', () => {
    expect(okeyFirsatiSec([], [])).toBeNull();
  });

  it('secim yoksa ilk firsati verir', () => {
    expect(okeyFirsatiSec([FIRSAT, ikinci], [])).toBe(FIRSAT);
  });

  it('secili tasla ortusen firsati one alir', () => {
    expect(okeyFirsatiSec([FIRSAT, ikinci], [t('mavi', 6).id])).toBe(ikinci);
  });

  it('secim hicbirine uymuyorsa yine ilkini verir', () => {
    expect(okeyFirsatiSec([FIRSAT, ikinci], [t('sari', 9).id])).toBe(FIRSAT);
  });
});

describe('okeyleAcilisBul — KURALLAR.md §6 istisnasi', () => {
  // Tur 1'in sarti: 2 × uclu kut. Okey alinmadan el acilmiyor, okeyle aciliyor.
  const acilmayanEl = [
    t('sari', 3),                                        // okeyi cekecek tas
    t('kirmizi', 9), t('siyah', 9), t('mavi', 9),        // hazir kut
    t('kirmizi', 12), t('siyah', 12),                    // okeyle tamamlanacak kut
    t('sari', 5), t('mavi', 7),                          // artan
  ];

  it('okeyi alip acabiliyorsa acilisi kurar', () => {
    const gorunum = gorunumKur({ istakam: acilmayanEl, yer: [OKEYLI_KUT] });
    const acilis = okeyleAcilisBul(gorunum, FIRSAT);
    expect(acilis).not.toBeNull();
  });

  it('kurulan acilis ALINAN OKEYI kullanir — §6 zorunlu', () => {
    const gorunum = gorunumKur({ istakam: acilmayanEl, yer: [OKEYLI_KUT] });
    const acilis = okeyleAcilisBul(gorunum, FIRSAT) ?? [];
    expect(acilis.flat()).toContain(ok('a').id);
  });

  it('kurulan acilis okeye verilen tasi KULLANMAZ — o tas yere gitti', () => {
    const gorunum = gorunumKur({ istakam: acilmayanEl, yer: [OKEYLI_KUT] });
    const acilis = okeyleAcilisBul(gorunum, FIRSAT) ?? [];
    expect(acilis.flat()).not.toContain(t('sari', 3).id);
  });

  it('kurulan acilis turun sartini karsilar', () => {
    const gorunum = gorunumKur({ istakam: acilmayanEl, yer: [OKEYLI_KUT] });
    const acilis = okeyleAcilisBul(gorunum, FIRSAT) ?? [];
    const okey = OKEYLI_KUT.taslar.find((tas) => tas.id === ok('a').id) as Tas;
    const havuz = [...acilmayanEl, okey];
    const gruplar = acilis.map((grup) =>
      grup.map((id) => havuz.find((tas) => tas.id === id) as Tas),
    );
    expect(sartKarsilaniyorMu(perlestir(gruplar), 1).ok).toBe(true);
  });

  it('okey alinsa bile el acilmiyorsa null', () => {
    const zayifEl = [t('sari', 3), t('mavi', 7), t('sari', 5), t('kirmizi', 11)];
    const gorunum = gorunumKur({ istakam: zayifEl, yer: [OKEYLI_KUT] });
    expect(okeyleAcilisBul(gorunum, FIRSAT)).toBeNull();
  });

  it('zaten acmis oyuncu icin null — o normal yolu kullanir', () => {
    const gorunum = gorunumKur({ istakam: acilmayanEl, yer: [OKEYLI_KUT], acmisMi: true });
    expect(okeyleAcilisBul(gorunum, FIRSAT)).toBeNull();
  });

  it('per ortada yoksa null', () => {
    const gorunum = gorunumKur({ istakam: acilmayanEl, yer: [] });
    expect(okeyleAcilisBul(gorunum, FIRSAT)).toBeNull();
  });

  it('motor kurulan acilisi kabul ediyor — uctan uca', () => {
    // Ekranin urettigi hamle gercekten gecerli mi? Karari motor veriyor.
    const durum = {
      ayarlar: VARSAYILAN_AYARLAR,
      tur: 1 as TurNo,
      baslayan: 0 as OyuncuId,
      siradaki: 0 as OyuncuId,
      faz: 'atma' as const,
      deste: [],
      istakalar: oyuncuKaydiOlustur<readonly Tas[]>((o) => (o === 0 ? acilmayanEl : [])),
      atikYiginlari: oyuncuKaydiOlustur<readonly Tas[]>(() => []),
      atikSirasi: [],
      yer: [OKEYLI_KUT],
      sonrakiPerId: 2,
      acmisMi: oyuncuKaydiOlustur(() => false),
      acilisHamlesi: oyuncuKaydiOlustur<number | null>(() => null),
      hamleSayisi: oyuncuKaydiOlustur(() => 0),
      calinanSayisi: oyuncuKaydiOlustur(() => 0),
      islerTasSayisi: oyuncuKaydiOlustur(() => 0),
      pencere: null,
      sonuc: null,
    };
    const gorunum = gorunumKur({ istakam: acilmayanEl, yer: [OKEYLI_KUT] });
    const acilis = okeyleAcilisBul(gorunum, FIRSAT);
    expect(acilis).not.toBeNull();

    const sonuc = reduce(durum, {
      tip: 'AC',
      oyuncu: 0,
      perler: acilis ?? [],
      okeyAlimi: FIRSAT,
      suAn: 0,
    });
    expect(sonuc.ok).toBe(true);
    if (!sonuc.ok) return;

    // Okey bende degil, yere indi; sari3 rakibin kutune gitti.
    expect(sonuc.state.acmisMi[0]).toBe(true);
    expect(sonuc.state.istakalar[0].map((tas) => tas.id)).not.toContain(ok('a').id);
    const kut = sonuc.state.yer.find((per) => per.id === 1);
    expect(kut?.taslar.map((tas) => tas.id)).toContain(t('sari', 3).id);
    expect(kut?.taslar.map((tas) => tas.id)).not.toContain(ok('a').id);
  });
});

describe('okeyAlinabilirMi', () => {
  const el = [
    t('sari', 3),
    t('kirmizi', 9), t('siyah', 9), t('mavi', 9),
    t('kirmizi', 12), t('siyah', 12),
    t('sari', 5), t('mavi', 7),
  ];

  it('firsat yoksa alinamaz', () => {
    expect(okeyAlinabilirMi(gorunumKur({ istakam: el, yer: [OKEYLI_KUT] }), null)).toBe(false);
  });

  it('acmis ve bir tur donmusse alinabilir — normal yol', () => {
    const gorunum = gorunumKur({
      istakam: el, yer: [OKEYLI_KUT], acmisMi: true, islemeYapabilirim: true,
    });
    expect(okeyAlinabilirMi(gorunum, FIRSAT)).toBe(true);
  });

  it('acmis ama daha bir tur donmemisse alinamaz — §6', () => {
    const gorunum = gorunumKur({
      istakam: el, yer: [OKEYLI_KUT], acmisMi: true, islemeYapabilirim: false,
    });
    expect(okeyAlinabilirMi(gorunum, FIRSAT)).toBe(false);
  });

  it('acmamis ama okeyle eli aciliyorsa alinabilir — istisna', () => {
    const gorunum = gorunumKur({ istakam: el, yer: [OKEYLI_KUT], acmisMi: false });
    expect(okeyAlinabilirMi(gorunum, FIRSAT)).toBe(true);
  });

  it('acmamis ve eli acilmiyorsa alinamaz', () => {
    const zayif = [t('sari', 3), t('mavi', 7), t('sari', 5)];
    const gorunum = gorunumKur({ istakam: zayif, yer: [OKEYLI_KUT], acmisMi: false });
    expect(okeyAlinabilirMi(gorunum, FIRSAT)).toBe(false);
  });

  it('cekme fazinda alinamaz — once tas cekilir (§4)', () => {
    const gorunum = gorunumKur({
      istakam: el, yer: [OKEYLI_KUT], acmisMi: true, islemeYapabilirim: true, faz: 'cekme',
    });
    expect(okeyAlinabilirMi(gorunum, FIRSAT)).toBe(false);
  });

  it('sira bende degilse alinamaz', () => {
    const gorunum = gorunumKur({
      istakam: el, yer: [OKEYLI_KUT], acmisMi: true, islemeYapabilirim: true, siradaki: 2,
    });
    expect(okeyAlinabilirMi(gorunum, FIRSAT)).toBe(false);
  });

  it('el bittiyse alinamaz', () => {
    const gorunum = gorunumKur({
      istakam: el, yer: [OKEYLI_KUT], acmisMi: true, islemeYapabilirim: true, faz: 'el-bitti',
    });
    expect(okeyAlinabilirMi(gorunum, FIRSAT)).toBe(false);
  });
});
