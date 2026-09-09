import { describe, expect, it } from 'vitest';
import {
  VARSAYILAN_AYARLAR,
  viewFor,
  normalTas,
  okeyTas,
  oyuncuKaydiOlustur,
  sartKarsilaniyorMu,
  kutMu,
  seriMu,
  type OyuncuGorunumu,
  type OyuncuId,
  type Per,
  type Renk,
  type Sayi,
  type Tas,
  type TurNo,
  type YerPeri,
} from '@kut/engine';
import { reduce } from '@kut/engine';
import {
  acilisBul,
  atilacakTas,
  botAksiyonu,
  botTalebi,
  indirilecekPerler,
  islenebilir,
} from '../src/bot';
import { sureDolduAksiyonu } from '../src/sure';

const t = (renk: Renk, sayi: Sayi, kopya: 'a' | 'b' = 'a'): Tas => normalTas(renk, sayi, kopya);
const ok = (kopya: 'a' | 'b' = 'a'): Tas => okeyTas(kopya);

/** Aday listesini motorun per tipine cevirir — sart dogrulamasi icin. */
function perleştir(adaylar: readonly (readonly Tas[])[]): Per[] {
  return adaylar.map((aday) => {
    const kut = kutMu(aday);
    if (kut.ok) return kut.per;
    const seri = seriMu(aday);
    if (seri.ok) return seri.per;
    return { tip: 'cift', taslar: aday };
  });
}

function gorunumKur(p: {
  readonly istakam: readonly Tas[];
  readonly tur?: TurNo;
  readonly faz?: OyuncuGorunumu['faz'];
  readonly yer?: readonly YerPeri[];
  readonly acmisMi?: boolean;
  readonly islemeYapabilirim?: boolean;
  readonly islerTaslarim?: readonly string[];
  readonly siradaki?: OyuncuId;
  readonly pencere?: OyuncuGorunumu['pencere'];
  readonly atikYiginlari?: OyuncuGorunumu['atikYiginlari'];
  readonly desteSayisi?: number;
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
    desteSayisi: p.desteSayisi ?? 40,
    atikYiginlari:
      p.atikYiginlari ?? oyuncuKaydiOlustur(() => ({ ustTas: null, adet: 0 })),
    atikUstu: null,
    atikAdedi: 0,
    yer: p.yer ?? [],
    acmisMi: oyuncuKaydiOlustur((o: OyuncuId) => (o === 0 ? (p.acmisMi ?? false) : false)),
    calinanSayisi: oyuncuKaydiOlustur(() => 0),
    islerTasSayisi: oyuncuKaydiOlustur(() => 0),
    islerTaslarim: p.islerTaslarim ?? [],
    islemeYapabilirim: p.islemeYapabilirim ?? (p.acmisMi ?? false),
    okeyFirsatlarim: [],
    pencere: p.pencere ?? null,
    sonCalan: null,
    sonHareketler: [],
    sonHareketNo: 0,
    sonuc: null,
  };
}

describe('acilisBul — turun sartini arar', () => {
  it('tur 1 icin iki uclu kut bulur', () => {
    const el = [
      t('kirmizi', 7), t('siyah', 7), t('mavi', 7),
      t('kirmizi', 9), t('siyah', 9), t('mavi', 9),
      t('sari', 2), t('sari', 5),
    ];
    const cozum = acilisBul(el, 1);
    expect(cozum).not.toBeNull();
    expect(sartKarsilaniyorMu(perleştir(cozum ?? []), 1).ok).toBe(true);
  });

  it('per yoksa null doner', () => {
    const el = [
      t('kirmizi', 1), t('siyah', 4), t('mavi', 7), t('sari', 10),
      t('kirmizi', 13), t('siyah', 2), t('mavi', 5), t('sari', 8),
    ];
    expect(acilisBul(el, 1)).toBeNull();
  });

  it('ne eksik ne fazla — tur 4 uclu kutle acilmaz', () => {
    const uclu = [t('kirmizi', 7), t('siyah', 7), t('mavi', 7)];
    expect(acilisBul([...uclu, t('sari', 2), t('sari', 5)], 4)).toBeNull();

    const dortlu = [...uclu, t('sari', 7)];
    const cozum = acilisBul([...dortlu, t('mavi', 2), t('mavi', 5)], 4);
    expect(cozum).not.toBeNull();
    expect(cozum?.[0]).toHaveLength(4);
  });

  it('tur 2 icin iki uclu seri bulur', () => {
    const el = [
      t('mavi', 4), t('mavi', 5), t('mavi', 6),
      t('kirmizi', 9), t('kirmizi', 10), t('kirmizi', 11),
      t('sari', 2), t('sari', 13),
    ];
    const cozum = acilisBul(el, 2);
    expect(cozum).not.toBeNull();
    expect(sartKarsilaniyorMu(perleştir(cozum ?? []), 2).ok).toBe(true);
  });

  it('tur 9 icin besli seri bulur, okeyle bosluk kapatir', () => {
    const el = [
      t('mavi', 4), t('mavi', 5), ok('a'), t('mavi', 7), t('mavi', 8),
      t('sari', 2), t('sari', 13),
    ];
    const cozum = acilisBul(el, 9);
    expect(cozum).not.toBeNull();
    expect(cozum?.[0]).toHaveLength(5);
  });

  it('tur 15 icin dort cift bulur', () => {
    const el = [
      t('kirmizi', 7, 'a'), t('kirmizi', 7, 'b'),
      t('siyah', 3, 'a'), t('siyah', 3, 'b'),
      t('mavi', 9, 'a'), t('mavi', 9, 'b'),
      t('sari', 5, 'a'), t('sari', 5, 'b'),
      t('mavi', 1), t('mavi', 13),
    ];
    const cozum = acilisBul(el, 15);
    expect(cozum).not.toBeNull();
    expect(cozum).toHaveLength(4);
    expect(sartKarsilaniyorMu(perleştir(cozum ?? []), 15).ok).toBe(true);
  });

  it('eli tamamen bosaltan acilisi reddeder — son tas atilmali', () => {
    // Tam 6 tas: iki uclu kut. Acilirsa atacak tas kalmaz.
    const el = [
      t('kirmizi', 7), t('siyah', 7), t('mavi', 7),
      t('kirmizi', 9), t('siyah', 9), t('mavi', 9),
    ];
    expect(acilisBul(el, 1)).toBeNull();
  });

  it('okeysiz cozumu tercih eder', () => {
    const el = [
      t('kirmizi', 7), t('siyah', 7), t('mavi', 7), t('sari', 7),
      t('kirmizi', 9), t('siyah', 9), t('mavi', 9),
      ok('a'), t('sari', 2),
    ];
    const cozum = acilisBul(el, 1);
    expect(cozum).not.toBeNull();
    const okeyKullanildi = (cozum ?? []).flat().some((tas) => tas.tip === 'okey');
    expect(okeyKullanildi).toBe(false);
  });

  it('tur 16da acilis yoktur', () => {
    const el = [t('kirmizi', 7), t('siyah', 7), t('mavi', 7), t('sari', 2)];
    expect(acilisBul(el, 16)).toBeNull();
  });
});

describe('acilisBul — zorunlu tas (KURALLAR.md §6 okey alip acma)', () => {
  // Yerden alinan okey O ACILISTA kullanilmak zorunda; istakaya saklanamaz.
  // Ekran, okeyi eline ekleyip acilisi bu kisitla ariyor.
  it('zorunlu tasi kullanan bir cozum bulur', () => {
    const el = [
      t('kirmizi', 7), t('siyah', 7), ok('a'),
      t('kirmizi', 9), t('siyah', 9), t('mavi', 9),
      t('sari', 2), t('sari', 5),
    ];
    const cozum = acilisBul(el, 1, ok('a').id);
    expect(cozum).not.toBeNull();
    expect(cozum?.flat().map((tas) => tas.id)).toContain(ok('a').id);
    expect(sartKarsilaniyorMu(perleştir(cozum ?? []), 1).ok).toBe(true);
  });

  it('okeysiz cozum varsa bile zorunlu tas kullanilir', () => {
    // Bu el okey olmadan da acilabilir; kisit yine de okeyi kullandirmali.
    const el = [
      t('kirmizi', 7), t('siyah', 7), t('mavi', 7),
      t('kirmizi', 9), t('siyah', 9), t('mavi', 9),
      ok('a'), t('sari', 2), t('sari', 5),
    ];
    const cozum = acilisBul(el, 1, ok('a').id);
    expect(cozum).not.toBeNull();
    expect(cozum?.flat().map((tas) => tas.id)).toContain(ok('a').id);
  });

  it('zorunlu tas kullanilamiyorsa null doner', () => {
    // sari2 hicbir pere girmiyor; onu zorunlu kilan cozum yok.
    const el = [
      t('kirmizi', 7), t('siyah', 7), t('mavi', 7),
      t('kirmizi', 9), t('siyah', 9), t('mavi', 9),
      t('sari', 2), t('sari', 5),
    ];
    expect(acilisBul(el, 1, t('sari', 2).id)).toBeNull();
  });

  it('zorunlu tas elde yoksa null doner', () => {
    const el = [t('kirmizi', 7), t('siyah', 7), t('mavi', 7), t('sari', 2)];
    expect(acilisBul(el, 1, ok('b').id)).toBeNull();
  });

  it('kisitsiz cagri eskisi gibi calisir', () => {
    const el = [
      t('kirmizi', 7), t('siyah', 7), t('mavi', 7),
      t('kirmizi', 9), t('siyah', 9), t('mavi', 9),
      t('sari', 2), t('sari', 5),
    ];
    expect(acilisBul(el, 1)).not.toBeNull();
  });
});

describe('atilacakTas — en az ise yarayani secer', () => {
  it('pere girmeyen en yuksek puanli tasi atar', () => {
    const el = [
      t('kirmizi', 7), t('siyah', 7), t('mavi', 7),
      t('sari', 2), t('sari', 11),
    ];
    expect(atilacakTas(gorunumKur({ istakam: el }))?.id).toBe(t('sari', 11).id);
  });

  it('okeyi elde tutar', () => {
    const el = [ok('a'), t('sari', 2)];
    expect(atilacakTas(gorunumKur({ istakam: el }))?.id).toBe(t('sari', 2).id);
  });

  it('isler tasi atmaktan kacinir — 50 puan ceza', () => {
    const isler = t('sari', 13);
    const el = [isler, t('sari', 2)];
    const secilen = atilacakTas(
      gorunumKur({ istakam: el, islerTaslarim: [isler.id] }),
    );
    // 13 daha yuksek puanli ama isler oldugu icin 2 atilir.
    expect(secilen?.id).toBe(t('sari', 2).id);
  });

  it('bos elde null doner', () => {
    expect(atilacakTas(gorunumKur({ istakam: [] }))).toBeNull();
  });
});

describe('islenebilir', () => {
  const per: YerPeri = {
    id: 1,
    sahibi: 1,
    tip: 'seri',
    taslar: [t('kirmizi', 7), t('kirmizi', 8), t('kirmizi', 9)],
  };

  it('seriyi uzatan tasi ve hedef peri bulur', () => {
    const el = [t('sari', 2), t('kirmizi', 10)];
    expect(islenebilir(gorunumKur({ istakam: el, yer: [per] }))).toEqual({
      tasId: t('kirmizi', 10).id,
      perId: 1,
    });
  });

  it('isleyen tas yoksa null', () => {
    expect(islenebilir(gorunumKur({ istakam: [t('sari', 2)], yer: [per] }))).toBeNull();
  });
});

describe('botAksiyonu', () => {
  it('cekme fazinda desteden ceker', () => {
    const aksiyon = botAksiyonu(
      gorunumKur({ istakam: [t('sari', 2)], faz: 'cekme' }),
      0,
      100,
    );
    expect(aksiyon?.tip).toBe('CEK_DESTEDEN');
  });

  it('acabiliyorsa acar', () => {
    const el = [
      t('kirmizi', 7), t('siyah', 7), t('mavi', 7),
      t('kirmizi', 9), t('siyah', 9), t('mavi', 9),
      t('sari', 2), t('sari', 5),
    ];
    const aksiyon = botAksiyonu(gorunumKur({ istakam: el }), 0, 100);
    expect(aksiyon?.tip).toBe('AC');
  });

  it('acamiyorsa tas atar', () => {
    const el = [t('kirmizi', 1), t('siyah', 4), t('mavi', 7), t('sari', 10)];
    const aksiyon = botAksiyonu(gorunumKur({ istakam: el }), 0, 100);
    expect(aksiyon?.tip).toBe('AT');
  });

  it('acmissa once isler tasi isler', () => {
    const per: YerPeri = {
      id: 1,
      sahibi: 0,
      tip: 'seri',
      taslar: [t('kirmizi', 7), t('kirmizi', 8), t('kirmizi', 9)],
    };
    const el = [t('kirmizi', 10), t('sari', 2)];
    const aksiyon = botAksiyonu(
      gorunumKur({ istakam: el, yer: [per], acmisMi: true }),
      0,
      100,
    );
    expect(aksiyon?.tip).toBe('ISLE');
  });

  it('el bittiyse hamle yok', () => {
    expect(botAksiyonu(gorunumKur({ istakam: [], faz: 'el-bitti' }), 0, 100)).toBeNull();
  });
});

describe('tur 15 — cift calmasi botu kilitlemiyor', () => {
  // Gercek oyunda cikti: karsidaki atti, sira botta, insan "CIFTIM VAR" dedi.
  // Eski kuralda cift talebi KUYRUGA giriyordu; bot yine de yerden almak
  // isteyince motor reddediyor, reddedilen aksiyon durumu degistirmedigi icin
  // sira kilitleniyordu.
  //
  // §9 0.10 ile talep kuyruga girmiyor: geldigi anda tasi aliyor ve pencereyi
  // kapatiyor. Yani bot ya acik bir pencere goruyor (alabilir) ya da kapali
  // (desteden ceker). Arada kalinan hal kalmadi.
  const atilan = t('kirmizi', 7);

  const kur = (pencereVar: boolean): OyuncuGorunumu =>
    gorunumKur({
      // Atilan tas bota bir per kazandiriyor: alabiliyorsa alir.
      istakam: [t('kirmizi', 5), t('kirmizi', 6), t('sari', 2), t('mavi', 9)],
      tur: 15,
      faz: 'cekme',
      siradaki: 0,
      atikYiginlari: oyuncuKaydiOlustur((o: OyuncuId) =>
        o === 2 && pencereVar ? { ustTas: atilan, adet: 1 } : { ustTas: null, adet: 0 },
      ),
      ...(pencereVar
        ? { pencere: { atan: 2 as OyuncuId, tasId: atilan.id, talepler: [], ciftHakkim: false } }
        : {}),
    });

  it('pencere acikken yerden alir', () => {
    expect(botAksiyonu(kur(true), 0, 9000)).toEqual({
      tip: 'CEK_ATIKTAN',
      oyuncu: 0,
      suAn: 9000,
    });
  });

  it('tas calindiysa (pencere kapali) desteden ceker', () => {
    expect(botAksiyonu(kur(false), 0, 9000)).toEqual({
      tip: 'CEK_DESTEDEN',
      oyuncu: 0,
      suAn: 9000,
    });
  });
});

describe('tur 15 kilitlenmesi — uctan uca', () => {
  // Kullanicinin karsilastigi el: 2 numarali atti, sira 1'de, 0 numaralinin
  // elinde atilan tasin birebir esi var. Iki sey birden dogrulanmali:
  // cift talebi tasi GERCEKTEN aliyor, ve ondan sonra botun sectigi hamle
  // MOTOR TARAFINDAN KABUL EDILIYOR (aksi halde sira ilerlemiyor).
  const atilan = normalTas('kirmizi', 7, 'a');
  const esi = normalTas('kirmizi', 7, 'b');
  const ceza = normalTas('sari', 3, 'a');

  const durum = {
    ayarlar: VARSAYILAN_AYARLAR,
    tur: 15 as TurNo,
    baslayan: 0 as OyuncuId,
    siradaki: 1 as OyuncuId,
    faz: 'cekme' as const,
    deste: [ceza, normalTas('sari', 4, 'a')],
    istakalar: oyuncuKaydiOlustur<readonly Tas[]>((o) =>
      o === 0
        ? [esi]
        : o === 1
          ? [normalTas('kirmizi', 5, 'a'), normalTas('kirmizi', 6, 'a')]
          : [],
    ),
    atikYiginlari: oyuncuKaydiOlustur<readonly Tas[]>((o) => (o === 2 ? [atilan] : [])),
    atikSirasi: [atilan.id],
    yer: [],
    sonrakiPerId: 1,
    acmisMi: oyuncuKaydiOlustur(() => false),
    acilisHamlesi: oyuncuKaydiOlustur<number | null>(() => null),
    hamleSayisi: oyuncuKaydiOlustur(() => 0),
    calinanSayisi: oyuncuKaydiOlustur(() => 0),
    islerTasSayisi: oyuncuKaydiOlustur(() => 0),
    pencere: {
      atan: 2 as OyuncuId,
      tasId: atilan.id,
      talepler: [] as readonly OyuncuId[],
    },
    sonCalan: null,
    sonHareketler: [],
    sonHareketNo: 0,
    sonuc: null,
  };

  it('cift talep eden oyuncu tasi ANINDA aliyor (§5, §9 0.10)', () => {
    const sonuc = reduce(durum, { tip: 'CIFT_TALEBI', oyuncu: 0, suAn: 9000 });
    expect(sonuc.ok).toBe(true);
    if (!sonuc.ok) return;
    expect(sonuc.state.istakalar[0].map((tas) => tas.id)).toContain(atilan.id);
    expect(sonuc.state.calinanSayisi[0]).toBe(1);
    expect(sonuc.state.pencere).toBe(null);
  });

  it('caldiktan sonra botun hamlesi KABUL ediliyor — sira ilerliyor', () => {
    const calindi = reduce(durum, { tip: 'CIFT_TALEBI', oyuncu: 0, suAn: 9000 });
    expect(calindi.ok).toBe(true);
    if (!calindi.ok) return;

    const aksiyon = botAksiyonu(viewFor(calindi.state, 1), 1, 9100);
    expect(aksiyon).not.toBeNull();
    const sonuc = reduce(calindi.state, aksiyon as NonNullable<typeof aksiyon>);
    expect(sonuc.ok).toBe(true);
    if (sonuc.ok) expect(sonuc.state.faz).toBe('atma');
  });

  it('kurtarma yolu cekme fazinda AT demez — eski hata buydu', () => {
    const kurtarma = sureDolduAksiyonu(viewFor(durum, 1), 1, 9000);
    expect(kurtarma).toMatchObject({ tip: 'CEK_DESTEDEN' });
    const sonuc = reduce(durum, kurtarma as NonNullable<typeof kurtarma>);
    expect(sonuc.ok).toBe(true);
  });
});

// --- Fazladan per indirme (KURALLAR.md §6) -----------------------------------

describe('indirilecekPerler — "fazladan kut ve seri indirebilirsin"', () => {
  it('cakismayan perleri secer', () => {
    const el = [
      t('kirmizi', 4), t('kirmizi', 5), t('kirmizi', 6),
      t('mavi', 9), t('siyah', 9), t('sari', 9),
      t('sari', 2),
    ];
    const perler = indirilecekPerler(el);
    expect(perler).toHaveLength(2);

    const inen = perler.flat();
    expect(inen).toHaveLength(6);
    // Ayni tas iki perde birden olamaz.
    expect(new Set(inen.map((tas) => tas.id)).size).toBe(6);
  });

  it('eli BOSALTMAZ — bitis son tasi atarak olur (§7)', () => {
    const el = [
      t('kirmizi', 4), t('kirmizi', 5), t('kirmizi', 6),
      t('mavi', 9), t('siyah', 9), t('sari', 9),
    ];
    // Iki per de inseydi el bosalirdi; motor `son-tas-atilmali` derdi.
    expect(indirilecekPerler(el).flat().length).toBeLessThan(el.length);
  });

  it('per yoksa bos doner', () => {
    const el = [t('kirmizi', 1), t('siyah', 4), t('mavi', 7), t('sari', 10)];
    expect(indirilecekPerler(el)).toHaveLength(0);
  });
});

describe('botAksiyonu — actiktan sonra oynamaya devam eder', () => {
  it('elde tam per varsa PER_INDIR gonderir (eskiden yalnizca atardi)', () => {
    const gorunum = gorunumKur({
      istakam: [
        t('kirmizi', 4), t('kirmizi', 5), t('kirmizi', 6),
        t('sari', 2), t('sari', 11),
      ],
      acmisMi: true,
      islemeYapabilirim: true,
    });
    expect(botAksiyonu(gorunum, 0, 0)?.tip).toBe('PER_INDIR');
  });

  it('indirilecek per yoksa yine atar', () => {
    const gorunum = gorunumKur({
      istakam: [t('sari', 2), t('sari', 11), t('mavi', 4)],
      acmisMi: true,
      islemeYapabilirim: true,
    });
    expect(botAksiyonu(gorunum, 0, 0)?.tip).toBe('AT');
  });

  it('acmamis oyuncu once acilisi arar; PER_INDIR gondermez', () => {
    const gorunum = gorunumKur({
      istakam: [
        t('kirmizi', 7), t('siyah', 7), t('mavi', 7),
        t('kirmizi', 9), t('siyah', 9), t('mavi', 9),
        t('sari', 2), t('sari', 5),
      ],
      acmisMi: false,
    });
    expect(botAksiyonu(gorunum, 0, 0)?.tip).toBe('AC');
  });
});

// --- Talep penceresi: calma ve "cifti bende" (KURALLAR.md §5) ----------------

/** Bir talep penceresi ve ona ait atik yigini. */
function pencereKur(p: {
  readonly atan: OyuncuId;
  readonly tas: Tas;
  readonly talepler?: readonly OyuncuId[];
  readonly ciftHakkim?: boolean;
}): Pick<OyuncuGorunumu, 'pencere' | 'atikYiginlari'> {
  return {
    pencere: {
      atan: p.atan,
      tasId: p.tas.id,
      talepler: p.talepler ?? [],
      ciftHakkim: p.ciftHakkim ?? false,
    },
    atikYiginlari: oyuncuKaydiOlustur((o: OyuncuId) =>
      o === p.atan ? { ustTas: p.tas, adet: 1 } : { ustTas: null, adet: 0 },
    ),
  };
}

describe('botTalebi — botlar da calar', () => {
  it('tas YENI BIR PER kuruyorsa calar', () => {
    const gorunum = gorunumKur({
      istakam: [t('kirmizi', 4), t('kirmizi', 5), t('sari', 2), t('mavi', 11)],
      siradaki: 2,
      ...pencereKur({ atan: 1, tas: t('kirmizi', 6) }),
    });
    expect(botTalebi(gorunum, 0, 0)?.tip).toBe('CALMA_TALEBI');
  });

  it('yalnizca mevcut peri uzatiyorsa calmaz — 5 puana degmez', () => {
    const gorunum = gorunumKur({
      istakam: [t('kirmizi', 4), t('kirmizi', 5), t('kirmizi', 6), t('sari', 2)],
      siradaki: 2,
      ...pencereKur({ atan: 1, tas: t('kirmizi', 7) }),
    });
    expect(botTalebi(gorunum, 0, 0)).toBeNull();
  });

  it('turun acilisini actiriyorsa calar', () => {
    // Tur 1: iki uclu kut. `mavi 9` gelmeden sart karsilanmiyor.
    const gorunum = gorunumKur({
      istakam: [
        t('kirmizi', 7), t('siyah', 7), t('mavi', 7),
        t('kirmizi', 9), t('siyah', 9),
        t('sari', 2), t('sari', 5),
      ],
      tur: 1,
      siradaki: 2,
      ...pencereKur({ atan: 1, tas: t('mavi', 9) }),
    });
    expect(botTalebi(gorunum, 0, 0)?.tip).toBe('CALMA_TALEBI');
  });

  it('tur 15te cift hakki varsa CIFT_TALEBI gonderir', () => {
    const gorunum = gorunumKur({
      istakam: [t('kirmizi', 7, 'b'), t('sari', 2)],
      tur: 15,
      siradaki: 2,
      ...pencereKur({ atan: 1, tas: t('kirmizi', 7), ciftHakkim: true }),
    });
    expect(botTalebi(gorunum, 0, 0)?.tip).toBe('CIFT_TALEBI');
  });

  it('deste bossa calamaz — ceza tasi cekilemez (§5)', () => {
    const gorunum = gorunumKur({
      istakam: [t('kirmizi', 4), t('kirmizi', 5), t('sari', 2)],
      siradaki: 2,
      desteSayisi: 0,
      ...pencereKur({ atan: 1, tas: t('kirmizi', 6) }),
    });
    expect(botTalebi(gorunum, 0, 0)).toBeNull();
  });

  it('motorun reddedecegi talepleri hic gondermez', () => {
    const el = [t('kirmizi', 4), t('kirmizi', 5), t('sari', 2)];
    const tas = t('kirmizi', 6);

    // Atan kendisi.
    expect(
      botTalebi(gorunumKur({ istakam: el, siradaki: 2, ...pencereKur({ atan: 0, tas }) }), 0, 0),
    ).toBeNull();

    // Sirasi gelen zaten bedelsiz alabilir.
    expect(
      botTalebi(gorunumKur({ istakam: el, siradaki: 0, ...pencereKur({ atan: 1, tas }) }), 0, 0),
    ).toBeNull();

    // Zaten talep etmis.
    expect(
      botTalebi(
        gorunumKur({
          istakam: el,
          siradaki: 2,
          ...pencereKur({ atan: 1, tas, talepler: [0] }),
        }),
        0,
        0,
      ),
    ).toBeNull();

    // Pencere yok.
    expect(botTalebi(gorunumKur({ istakam: el, siradaki: 2 }), 0, 0)).toBeNull();
  });
});

describe('yerden alma esigi — actiktan sonra da alir', () => {
  it('tas mevcut peri uzatiyorsa bile yerden alir (bedelsiz)', () => {
    const gorunum = gorunumKur({
      istakam: [t('kirmizi', 4), t('kirmizi', 5), t('kirmizi', 6), t('sari', 2)],
      faz: 'cekme',
      acmisMi: true,
      ...pencereKur({ atan: 3, tas: t('kirmizi', 7) }),
    });
    // Eski esik "yeni per kurmali" idi; bot bu tasi birakip desteden cekiyordu.
    expect(botAksiyonu(gorunum, 0, 0)?.tip).toBe('CEK_ATIKTAN');
  });

  it('tas hicbir ise yaramiyorsa desteden ceker', () => {
    const gorunum = gorunumKur({
      istakam: [t('kirmizi', 4), t('kirmizi', 5), t('kirmizi', 6), t('sari', 2)],
      faz: 'cekme',
      acmisMi: true,
      ...pencereKur({ atan: 3, tas: t('mavi', 12) }),
    });
    expect(botAksiyonu(gorunum, 0, 0)?.tip).toBe('CEK_DESTEDEN');
  });
});
