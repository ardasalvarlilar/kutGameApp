import { describe, expect, it } from 'vitest';
import { elBaslat } from '../src/durum';
import { kalanPencereSuresi, viewFor } from '../src/gorunum';
import { reduce } from '../src/reduce';
import { OYUNCULAR } from '../src/tipler';
import { dolgu, durumAl, durumKur, pencereKur, t, yerPeri } from './yardimci';

// CLAUDE.md motor kurali #3 — gizli bilgi projeksiyonla cozulur.
// Botlar da bu projeksiyonu kullanir; bot insandan fazlasini gormez.

describe('viewFor sizinti testleri', () => {
  const durum = elBaslat({ tur: 1, baslayan: 0, tohum: 777 });

  it('oyuncu kendi istakasini tam gorur', () => {
    const gorunum = viewFor(durum, 1);
    expect(gorunum.istakam.map((tas) => tas.id)).toEqual(durum.istakalar[1].map((tas) => tas.id));
  });

  it('rakiplerin istakasindan yalnizca tas sayisi gorunur', () => {
    const gorunum = viewFor(durum, 1);
    const metin = JSON.stringify(gorunum);
    for (const oyuncu of OYUNCULAR) {
      if (oyuncu === 1) continue;
      for (const tas of durum.istakalar[oyuncu]) {
        expect(metin.includes(tas.id), `${tas.id} sizdi`).toBe(false);
      }
    }
    expect(gorunum.tasSayilari[0]).toBe(15);
    expect(gorunum.tasSayilari[2]).toBe(14);
  });

  it('destenin icerigi hicbir oyuncuya gorunmez', () => {
    for (const oyuncu of OYUNCULAR) {
      const metin = JSON.stringify(viewFor(durum, oyuncu));
      for (const tas of durum.deste) {
        expect(metin.includes(tas.id), `deste tasi ${tas.id} sizdi`).toBe(false);
      }
    }
  });

  it('desteden yalnizca kalan adet gorunur', () => {
    expect(viewFor(durum, 0).desteSayisi).toBe(49);
  });

  it('yere inmis perler herkese acik', () => {
    const per = yerPeri(1, 2, 'kut', [t('kirmizi', 7), t('siyah', 7), t('mavi', 7)]);
    const yerli = durumKur({ yer: [per], istakalar: { 0: dolgu(3, [], 40) } });
    expect(viewFor(yerli, 0).yer).toHaveLength(1);
    expect(JSON.stringify(viewFor(yerli, 0))).toContain('kirmizi-7-a');
  });
});

describe('atik yigini gorunurlugu — KURALLAR.md §5', () => {
  const ust = t('kirmizi', 9);
  const altta = t('siyah', 2);
  const daha = t('mavi', 4);
  const durum = durumKur({
    atikYiginlari: { 0: [daha, altta, ust] },
    istakalar: { 1: dolgu(3, [ust, altta, daha], 40) },
  });

  it('yalnizca en ustteki tas ve adet gorunur', () => {
    const gorunum = viewFor(durum, 1).atikYiginlari[0];
    expect(gorunum.ustTas?.id).toBe(ust.id);
    expect(gorunum.adet).toBe(3);
  });

  it('yiginin altindaki taslar sizmaz', () => {
    const metin = JSON.stringify(viewFor(durum, 1));
    expect(metin.includes(altta.id)).toBe(false);
    expect(metin.includes(daha.id)).toBe(false);
  });

  it('bos yiginin ust tasi yoktur', () => {
    expect(viewFor(durum, 1).atikYiginlari[3]).toEqual({ ustTas: null, adet: 0 });
  });
});

describe('talep gorunurlugu — KURALLAR.md §5', () => {
  const atilan = t('kirmizi', 9);

  function talepliDurum(ayarlar: Partial<{ talepGorunurlugu: boolean }> = {}) {
    const durum = durumKur({
      siradaki: 1,
      faz: 'cekme',
      istakalar: {
        0: dolgu(13, [atilan], 0),
        1: dolgu(14, [atilan], 13),
        2: dolgu(14, [atilan], 27),
        3: dolgu(14, [atilan], 41),
      },
      atikYiginlari: { 0: [atilan] },
      deste: dolgu(5, [atilan], 55),
      pencere: pencereKur(0, atilan),
      ayarlar,
    });
    return durumAl(reduce(durum, { tip: 'CALMA_TALEBI', oyuncu: 3, suAn: 100 }));
  }

  it('varsayilan acik: sirasi gelen digerlerinin talebini gorur', () => {
    expect(viewFor(talepliDurum(), 1).pencere?.talepler).toEqual([3]);
  });

  it('talep eden kendi talebini gorur', () => {
    expect(viewFor(talepliDurum(), 3).pencere?.talepler).toEqual([3]);
  });

  it('ucuncu bir oyuncu baskasinin talebini gormez', () => {
    expect(viewFor(talepliDurum(), 2).pencere?.talepler).toEqual([]);
  });

  it('oda ayari kapatilirsa sirasi gelen de gormez', () => {
    expect(viewFor(talepliDurum({ talepGorunurlugu: false }), 1).pencere?.talepler).toEqual([]);
  });

  it('pencerenin kapanis zamani istemciye bildirilir', () => {
    const gorunum = viewFor(talepliDurum(), 1);
    expect(gorunum.pencere?.kapanisZamani).toBe(3000);
  });
});

describe('kalan pencere suresi', () => {
  const atilan = t('kirmizi', 9);
  const durum = durumKur({ pencere: pencereKur(0, atilan, { acilisZamani: 1000 }) });

  it('sure geri sayar', () => {
    expect(kalanPencereSuresi(durum, 1000)).toBe(3000);
    expect(kalanPencereSuresi(durum, 2500)).toBe(1500);
  });

  it('kapandiktan sonra sifirdir', () => {
    expect(kalanPencereSuresi(durum, 9999)).toBe(0);
  });

  it('pencere yoksa sifirdir', () => {
    expect(kalanPencereSuresi(durumKur(), 0)).toBe(0);
  });
});

describe('tek atik obegi — en son atilan ustte', () => {
  const a = t('kirmizi', 3);
  const b = t('siyah', 8);
  const c = t('mavi', 11);

  it('atilan tas obegin ustune gelir', () => {
    const durum = durumKur({
      siradaki: 0,
      faz: 'atma',
      istakalar: { 0: [a, ...dolgu(3, [a, b, c], 40)] },
    });
    const sonra = durumAl(reduce(durum, { tip: 'AT', oyuncu: 0, tasId: a.id, suAn: 100 }));
    expect(viewFor(sonra, 0).atikUstu?.id).toBe(a.id);
    expect(viewFor(sonra, 0).atikAdedi).toBe(1);
  });

  it('sirayla atilan taslarda en sonuncusu ustte kalir', () => {
    const durum = durumKur({
      atikYiginlari: { 0: [a], 3: [b], 2: [c] },
      atikSirasi: [a.id, b.id, c.id],
    });
    expect(viewFor(durum, 0).atikUstu?.id).toBe(c.id);
    expect(viewFor(durum, 0).atikAdedi).toBe(3);
  });

  it('yerden alinan tas obekten cikar, alti gorunur olur', () => {
    const durum = durumKur({
      siradaki: 3,
      faz: 'cekme',
      istakalar: { 3: dolgu(14, [a, b, c], 40) },
      atikYiginlari: { 2: [a], 0: [b, c] },
      atikSirasi: [a.id, b.id, c.id],
      pencere: pencereKur(0, c),
    });
    const sonra = durumAl(reduce(durum, { tip: 'CEK_ATIKTAN', oyuncu: 3, suAn: 10 }));
    const gorunum = viewFor(sonra, 3);
    expect(gorunum.atikAdedi).toBe(2);
    expect(gorunum.atikUstu?.id).toBe(b.id);
  });

  it('calinan tas da obekten cikar', () => {
    const cezaTasi = t('sari', 6);
    const durum = durumKur({
      siradaki: 3,
      faz: 'cekme',
      istakalar: {
        1: dolgu(14, [a, b, c, cezaTasi], 0),
        3: dolgu(14, [a, b, c, cezaTasi], 20),
      },
      atikYiginlari: { 0: [b, c] },
      atikSirasi: [b.id, c.id],
      deste: [cezaTasi, ...dolgu(5, [a, b, c, cezaTasi], 40)],
      pencere: pencereKur(0, c, { talepler: [1] }),
    });
    const sonra = durumAl(reduce(durum, { tip: 'CEK_DESTEDEN', oyuncu: 3, suAn: 5000 }));
    const gorunum = viewFor(sonra, 3);
    expect(gorunum.atikAdedi).toBe(1);
    expect(gorunum.atikUstu?.id).toBe(b.id);
    expect(sonra.istakalar[1].map((tas) => tas.id)).toContain(c.id);
  });

  it('masa bosken ust tas yoktur', () => {
    expect(viewFor(durumKur(), 0).atikUstu).toBe(null);
    expect(viewFor(durumKur(), 0).atikAdedi).toBe(0);
  });
});
