// Test yardimcilari. Motorun parcasi degildir.

import type { Faz, OyunDurumu, TalepPenceresi, YerPeri } from '../src/durum';
import { VARSAYILAN_AYARLAR, type KuralAyarlari } from '../src/kurallar';
import { desteOlustur, normalTas, okeyTas } from '../src/tas';
import {
  oyuncuKaydiOlustur,
  type Kopya,
  type OyuncuId,
  type Renk,
  type Sayi,
  type Tas,
  type TasId,
  type TurNo,
} from '../src/tipler';

export function t(renk: Renk, sayi: Sayi, kopya: Kopya = 'a'): Tas {
  return normalTas(renk, sayi, kopya);
}

export function ok(kopya: Kopya = 'a'): Tas {
  return okeyTas(kopya);
}

export function idler(taslar: readonly Tas[]): readonly TasId[] {
  return taslar.map((tas) => tas.id);
}

/**
 * Testte anlami olmayan dolgu taslari.
 * `atla` ile farkli oyunculara catismayan taslar verilir — destede her tas
 * yalnizca iki kez bulundugu icin fixture'larin kimlik tekrari icermemesi onemli.
 */
export function dolgu(adet: number, haric: readonly Tas[] = [], atla = 0): readonly Tas[] {
  const kullanilan = new Set(haric.map((tas) => tas.id));
  const uygun: Tas[] = [];
  for (const tas of desteOlustur()) {
    if (kullanilan.has(tas.id)) continue;
    // Dolgu taslarinin okey olmasi puan testlerini bozar; okeyleri disarida birak.
    if (tas.tip === 'okey') continue;
    uygun.push(tas);
  }
  return uygun.slice(atla, atla + adet);
}

export interface KurulumParametreleri {
  readonly tur?: TurNo;
  readonly baslayan?: OyuncuId;
  readonly siradaki?: OyuncuId;
  readonly faz?: Faz;
  readonly deste?: readonly Tas[];
  readonly istakalar?: Partial<Record<OyuncuId, readonly Tas[]>>;
  readonly atikYiginlari?: Partial<Record<OyuncuId, readonly Tas[]>>;
  readonly atikSirasi?: readonly TasId[];
  readonly yer?: readonly YerPeri[];
  readonly sonrakiPerId?: number;
  readonly acmisMi?: Partial<Record<OyuncuId, boolean>>;
  readonly acilisHamlesi?: Partial<Record<OyuncuId, number | null>>;
  readonly hamleSayisi?: Partial<Record<OyuncuId, number>>;
  readonly calinanSayisi?: Partial<Record<OyuncuId, number>>;
  readonly islerTasSayisi?: Partial<Record<OyuncuId, number>>;
  readonly pencere?: TalepPenceresi | null;
  readonly ayarlar?: Partial<KuralAyarlari>;
}

/** Belirli bir senaryoyu dogrudan kurar — elBaslat karistirdigi icin testler bunu kullanir. */
export function durumKur(parametreler: KurulumParametreleri = {}): OyunDurumu {
  const p = parametreler;
  return {
    ayarlar: { ...VARSAYILAN_AYARLAR, ...(p.ayarlar ?? {}) },
    tur: p.tur ?? 1,
    baslayan: p.baslayan ?? 0,
    siradaki: p.siradaki ?? 0,
    faz: p.faz ?? 'atma',
    deste: p.deste ?? [],
    istakalar: oyuncuKaydiOlustur<readonly Tas[]>((o) => p.istakalar?.[o] ?? []),
    atikYiginlari: oyuncuKaydiOlustur<readonly Tas[]>((o) => p.atikYiginlari?.[o] ?? []),
    // Verilmediyse yiginlardan turet: her yigin kendi icinde sirali.
    atikSirasi:
      p.atikSirasi ??
      ([0, 1, 2, 3] as const).flatMap((o) => (p.atikYiginlari?.[o] ?? []).map((tas) => tas.id)),
    yer: p.yer ?? [],
    sonrakiPerId: p.sonrakiPerId ?? 1,
    acmisMi: oyuncuKaydiOlustur((o) => p.acmisMi?.[o] ?? false),
    acilisHamlesi: oyuncuKaydiOlustur<number | null>((o) => p.acilisHamlesi?.[o] ?? null),
    hamleSayisi: oyuncuKaydiOlustur((o) => p.hamleSayisi?.[o] ?? 0),
    calinanSayisi: oyuncuKaydiOlustur((o) => p.calinanSayisi?.[o] ?? 0),
    islerTasSayisi: oyuncuKaydiOlustur((o) => p.islerTasSayisi?.[o] ?? 0),
    pencere: p.pencere ?? null,
    sonuc: null,
  };
}

export function pencereKur(
  atan: OyuncuId,
  tas: Tas,
  ekler: Partial<TalepPenceresi> = {},
): TalepPenceresi {
  return {
    atan,
    tasId: tas.id,
    acilisZamani: 0,
    talepler: [],
    ciftTalebi: null,
    ...ekler,
  };
}

export function yerPeri(
  id: number,
  sahibi: OyuncuId,
  tip: YerPeri['tip'],
  taslar: readonly Tas[],
): YerPeri {
  return { id, sahibi, tip, taslar };
}

/** Hatali sonuclarda `reason` okumak icin dar tip yardimcisi. */
export function reasonAl(sonuc: { ok: boolean } & Record<string, unknown>): string {
  return String(sonuc['reason']);
}

/** Basarili sonuctan durumu alir; basarisizsa testi anlamli bir mesajla dusurur. */
export function durumAl(sonuc: { ok: true; state: OyunDurumu } | { ok: false; reason: string }): OyunDurumu {
  if (!sonuc.ok) throw new Error(`aksiyon reddedildi: ${sonuc.reason}`);
  return sonuc.state;
}
