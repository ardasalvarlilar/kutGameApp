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
import { acilisBul, atilacakTas, botAksiyonu, islenebilir } from './bot';
import { sureDolduAksiyonu } from './sure';

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

describe('tur 15 — bot alamayacagi tasi istemez (kilitlenme hatasi)', () => {
  // Gercek oyunda cikti: karsidaki atti, sira botta, insan "CIFTIM VAR"
  // dedi. Bot yine de yerden almak isteyince motor `cift-talebi-oncelikli`
  // ile reddetti; reddedilen aksiyon durumu degistirmedigi icin sira
  // kilitlendi. KURALLAR.md §5 — cift hakki bedelsiz hakki da geçer.
  const atilan = t('kirmizi', 7);

  const kur = (ciftTalebi: OyuncuId | null): OyuncuGorunumu =>
    gorunumKur({
      // Atilan tas bota bir per kazandiriyor: kisit olmasa yerden alirdi.
      istakam: [t('kirmizi', 5), t('kirmizi', 6), t('sari', 2), t('mavi', 9)],
      tur: 15,
      faz: 'cekme',
      siradaki: 0,
      atikYiginlari: oyuncuKaydiOlustur((o: OyuncuId) =>
        o === 2 ? { ustTas: atilan, adet: 1 } : { ustTas: null, adet: 0 },
      ),
      pencere: {
        atan: 2,
        tasId: atilan.id,
        acilisZamani: 0,
        kapanisZamani: 3000,
        talepler: [],
        ciftTalebi,
        ciftHakkim: false,
      },
    });

  it('cift talebi varken desteden ceker, yerden ALMAZ', () => {
    expect(botAksiyonu(kur(1), 0, 9000)).toEqual({
      tip: 'CEK_DESTEDEN',
      oyuncu: 0,
      suAn: 9000,
    });
  });

  it('cift talebi yokken yerden almaya devam eder — kural daralmadi', () => {
    expect(botAksiyonu(kur(null), 0, 9000)).toEqual({
      tip: 'CEK_ATIKTAN',
      oyuncu: 0,
      suAn: 9000,
    });
  });

  it('cift hakki kapaliysa talep varsa bile yerden alir', () => {
    const gorunum = { ...kur(1), ayarlar: { ...VARSAYILAN_AYARLAR, ciftCalmaHakki: false } };
    expect(botAksiyonu(gorunum, 0, 9000)).toMatchObject({ tip: 'CEK_ATIKTAN' });
  });
});

describe('tur 15 kilitlenmesi — uctan uca', () => {
  // Kullanicinin karsilastigi el: 2 numarali atti, sira 1'de, 0 "cifti bende"
  // dedi. Botun sectigi hamle MOTOR TARAFINDAN KABUL EDILMELI; aksi halde
  // reddedilen aksiyon durumu degistirmedigi icin sira ilerlemiyor.
  const atilan = normalTas('kirmizi', 7, 'a');

  const durum = {
    ayarlar: VARSAYILAN_AYARLAR,
    tur: 15 as TurNo,
    baslayan: 0 as OyuncuId,
    siradaki: 1 as OyuncuId,
    faz: 'cekme' as const,
    deste: [normalTas('sari', 3, 'a'), normalTas('sari', 4, 'a')],
    istakalar: oyuncuKaydiOlustur<readonly Tas[]>((o) =>
      o === 0
        ? [normalTas('kirmizi', 7, 'b')]
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
      acilisZamani: 0,
      talepler: [] as readonly OyuncuId[],
      ciftTalebi: 0 as OyuncuId | null,
    },
    sonuc: null,
  };

  it('botun hamlesi motor tarafindan KABUL ediliyor — sira ilerliyor', () => {
    const aksiyon = botAksiyonu(viewFor(durum, 1), 1, 9000);
    expect(aksiyon).not.toBeNull();
    const sonuc = reduce(durum, aksiyon as NonNullable<typeof aksiyon>);
    expect(sonuc.ok).toBe(true);
    if (sonuc.ok) expect(sonuc.state.faz).toBe('atma');
  });

  it('cift talep eden oyuncu tasi gercekten aliyor (§5)', () => {
    const aksiyon = botAksiyonu(viewFor(durum, 1), 1, 9000);
    const sonuc = reduce(durum, aksiyon as NonNullable<typeof aksiyon>);
    expect(sonuc.ok).toBe(true);
    if (!sonuc.ok) return;
    expect(sonuc.state.istakalar[0].map((tas) => tas.id)).toContain(atilan.id);
    expect(sonuc.state.calinanSayisi[0]).toBe(1);
  });

  it('kurtarma yolu cekme fazinda AT demez — eski hata buydu', () => {
    const kurtarma = sureDolduAksiyonu(viewFor(durum, 1), 1, 9000);
    expect(kurtarma).toMatchObject({ tip: 'CEK_DESTEDEN' });
    const sonuc = reduce(durum, kurtarma as NonNullable<typeof kurtarma>);
    expect(sonuc.ok).toBe(true);
  });
});
