import { describe, expect, it } from 'vitest';
import { ciftMi, kutMu, okeyYerineGecebilirMi, perCozumle, pereIsle, seriMu } from '../src/per';
import { ok, t } from './yardimci';

function reason(sonuc: ReturnType<typeof kutMu>): string {
  return sonuc.ok ? 'ok' : sonuc.reason;
}

describe('kut — KURALLAR.md §2', () => {
  it('ayni sayinin uc farkli rengi kuttur', () => {
    expect(kutMu([t('kirmizi', 7), t('siyah', 7), t('mavi', 7)]).ok).toBe(true);
  });

  it('dort renkli kut gecerlidir', () => {
    expect(
      kutMu([t('kirmizi', 7), t('siyah', 7), t('mavi', 7), t('sari', 7)]).ok,
    ).toBe(true);
  });

  it('bir kut en fazla 4 tastir — okey ekleyerek besli kut yapilamaz', () => {
    const besli = kutMu([
      t('kirmizi', 7),
      t('siyah', 7),
      t('mavi', 7),
      t('sari', 7),
      ok(),
    ]);
    expect(reason(besli)).toBe('kut-en-fazla-dort-tas');
  });

  it('ayni renkten iki tas bir kutte bulunamaz', () => {
    const sonuc = kutMu([t('kirmizi', 7, 'a'), t('kirmizi', 7, 'b'), t('mavi', 7)]);
    expect(reason(sonuc)).toBe('kut-renk-tekrari');
  });

  it('farkli sayilar kut olmaz', () => {
    expect(reason(kutMu([t('kirmizi', 7), t('siyah', 8), t('mavi', 7)]))).toBe('kut-farkli-sayi');
  });

  it('minimum 3 tas', () => {
    expect(reason(kutMu([t('kirmizi', 7), t('siyah', 7)]))).toBe('az-tas');
  });

  it('okey her tasin yerine gecer', () => {
    expect(kutMu([t('kirmizi', 7), t('siyah', 7), ok()]).ok).toBe(true);
  });

  it('bir perde iki okey birden kullanilabilir', () => {
    expect(kutMu([t('kirmizi', 7), ok('a'), ok('b')]).ok).toBe(true);
  });

  it('ayni tas iki kez sayilamaz', () => {
    const tas = t('kirmizi', 7);
    expect(reason(kutMu([tas, tas, t('mavi', 7)]))).toBe('tekrarli-tas');
  });
});

describe('seri — KURALLAR.md §2', () => {
  it('ayni rengin ardisik sayilari seridir', () => {
    expect(seriMu([t('mavi', 4), t('mavi', 5), t('mavi', 6)]).ok).toBe(true);
  });

  it('1 seriyi baslatabilir: 1-2-3 gecerli', () => {
    expect(seriMu([t('mavi', 1), t('mavi', 2), t('mavi', 3)]).ok).toBe(true);
  });

  it('1 seriyi BITIREMEZ: 12-13-1 gecersiz', () => {
    const sonuc = seriMu([t('mavi', 12), t('mavi', 13), t('mavi', 1)]);
    expect(reason(sonuc)).toBe('seri-ardisik-degil');
  });

  it('seri 13te durur: 11-12-13 gecerli', () => {
    expect(seriMu([t('mavi', 11), t('mavi', 12), t('mavi', 13)]).ok).toBe(true);
  });

  it('13 + iki okey basa donemez, 11-12-13 olarak okunur', () => {
    expect(seriMu([t('mavi', 13), ok('a'), ok('b')]).ok).toBe(true);
  });

  it('13 + okey + okey + okey olamaz (destede iki okey var, yine de kimlik tekrari yok)', () => {
    // Dort tasli pencere 10-11-12-13'e oturur; kural acisindan sorun yok.
    expect(seriMu([t('mavi', 11), t('mavi', 13), ok('a'), ok('b')]).ok).toBe(true);
  });

  it('tek renk olmak zorunda', () => {
    const sonuc = seriMu([t('mavi', 4), t('kirmizi', 5), t('mavi', 6)]);
    expect(reason(sonuc)).toBe('seri-farkli-renk');
  });

  it('ayni sayi seride iki kez gecemez', () => {
    const sonuc = seriMu([t('mavi', 5, 'a'), t('mavi', 5, 'b'), t('mavi', 6)]);
    expect(reason(sonuc)).toBe('seri-sayi-tekrari');
  });

  it('bosluklu sayilar seri olmaz', () => {
    const sonuc = seriMu([t('mavi', 4), t('mavi', 6), t('mavi', 8)]);
    expect(reason(sonuc)).toBe('seri-ardisik-degil');
  });

  it('okey bosluga kopru olur', () => {
    expect(seriMu([t('mavi', 4), ok(), t('mavi', 6)]).ok).toBe(true);
  });

  it('okey ucta kullanilabilir', () => {
    expect(seriMu([t('mavi', 12), t('mavi', 13), ok()]).ok).toBe(true);
  });

  it('1den 13e tam seri mumkundur — ust sinir yok', () => {
    const tam = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((sayi) =>
      t('sari', sayi as 1),
    );
    expect(seriMu(tam).ok).toBe(true);
  });

  it('13ten uzun seri olamaz', () => {
    const tam = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((sayi) =>
      t('sari', sayi as 1),
    );
    expect(reason(seriMu([...tam, ok()]))).toBe('seri-ardisik-degil');
  });

  it('minimum 3 tas', () => {
    expect(reason(seriMu([t('mavi', 4), t('mavi', 5)]))).toBe('az-tas');
  });
});

describe('cift — KURALLAR.md §9.1 (karara baglandi), tur 15', () => {
  it('birebir ayni iki tas cifttir', () => {
    expect(ciftMi([t('kirmizi', 7, 'a'), t('kirmizi', 7, 'b')]).ok).toBe(true);
  });

  it('ayni sayinin iki farkli rengi cift DEGILDIR', () => {
    const sonuc = ciftMi([t('kirmizi', 7), t('mavi', 7)]);
    expect(reason(sonuc)).toBe('cift-birebir-es-degil');
  });

  it('okey esin yerine gecebilir', () => {
    expect(ciftMi([t('kirmizi', 7), ok()]).ok).toBe(true);
  });

  it('iki okey de cifttir — fiziksel olarak birebir ayni taslar', () => {
    expect(ciftMi([ok('a'), ok('b')]).ok).toBe(true);
  });

  it('cift tam olarak iki tastir', () => {
    expect(reason(ciftMi([t('kirmizi', 7)]))).toBe('cift-iki-tas-olmali');
    expect(
      reason(ciftMi([t('kirmizi', 7, 'a'), t('kirmizi', 7, 'b'), ok()])),
    ).toBe('cift-iki-tas-olmali');
  });
});

describe('perCozumle', () => {
  it('kut ve seriyi ayirt eder', () => {
    const kut = perCozumle([t('kirmizi', 7), t('siyah', 7), t('mavi', 7)]);
    expect(kut.ok && kut.per.tip).toBe('kut');
    const seri = perCozumle([t('mavi', 4), t('mavi', 5), t('mavi', 6)]);
    expect(seri.ok && seri.per.tip).toBe('seri');
  });

  it('cift bir per degildir — yalnizca tur 15in acilis sartidir', () => {
    expect(perCozumle([t('kirmizi', 7, 'a'), t('kirmizi', 7, 'b')]).ok).toBe(false);
  });
});

describe('okey ikamesi — KURALLAR.md §6', () => {
  const per = { tip: 'kut' as const, taslar: [t('kirmizi', 7), t('siyah', 7), ok()] };

  it('perde belirsizlik varsa her uygun aday kabul edilir', () => {
    expect(okeyYerineGecebilirMi(per, ok().id, t('mavi', 7))).toBe(true);
    expect(okeyYerineGecebilirMi(per, ok().id, t('sari', 7))).toBe(true);
  });

  it('peri bozacak aday reddedilir', () => {
    expect(okeyYerineGecebilirMi(per, ok().id, t('mavi', 8))).toBe(false);
    expect(okeyYerineGecebilirMi(per, ok().id, t('kirmizi', 7, 'b'))).toBe(false);
  });

  it('okey okeyin yerine konamaz', () => {
    expect(okeyYerineGecebilirMi(per, ok('a').id, ok('b'))).toBe(false);
  });

  it('seride okeyin temsil ettigi tas cozulur', () => {
    const seri = { tip: 'seri' as const, taslar: [t('mavi', 4), ok(), t('mavi', 6)] };
    expect(okeyYerineGecebilirMi(seri, ok().id, t('mavi', 5))).toBe(true);
    expect(okeyYerineGecebilirMi(seri, ok().id, t('mavi', 7))).toBe(false);
  });
});

describe('isleme — KURALLAR.md §6', () => {
  it('uclu kute dorduncu renk eklenebilir', () => {
    const per = { tip: 'kut' as const, taslar: [t('kirmizi', 7), t('siyah', 7), t('mavi', 7)] };
    expect(pereIsle(per, [t('sari', 7)]).ok).toBe(true);
  });

  it('dortlu kute besinci tas eklenemez', () => {
    const per = {
      tip: 'kut' as const,
      taslar: [t('kirmizi', 7), t('siyah', 7), t('mavi', 7), t('sari', 7)],
    };
    expect(reason(pereIsle(per, [ok()]))).toBe('kut-en-fazla-dort-tas');
  });

  it('seri iki ucundan da uzatilabilir', () => {
    const per = { tip: 'seri' as const, taslar: [t('mavi', 4), t('mavi', 5), t('mavi', 6)] };
    expect(pereIsle(per, [t('mavi', 7)]).ok).toBe(true);
    expect(pereIsle(per, [t('mavi', 3)]).ok).toBe(true);
    expect(pereIsle(per, [t('mavi', 3), t('mavi', 7)]).ok).toBe(true);
  });

  it('seri 13ten sonra basa donemez', () => {
    const per = { tip: 'seri' as const, taslar: [t('mavi', 11), t('mavi', 12), t('mavi', 13)] };
    expect(pereIsle(per, [t('mavi', 1)]).ok).toBe(false);
  });
});
