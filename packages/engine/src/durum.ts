// Oyun durumu ve el kurulumu. KURALLAR.md §1, §4

import { VARSAYILAN_AYARLAR, type KuralAyarlari } from './kurallar';
import type { PerTipi } from './per';
import type { ElSonucu } from './puan';
import { karistir, rngOlustur } from './rng';
import { desteOlustur } from './tas';
import {
  siradaIleri,
  oyuncuKaydiOlustur,
  type OyuncuId,
  type OyuncuKaydi,
  type Tas,
  type TasId,
  type TurNo,
} from './tipler';

/** KURALLAR.md §1 — baslayan disindaki oyunculara dagitilan tas sayisi. */
export const NORMAL_DAGITIM = 14;

/** KURALLAR.md §1 — baslayan oyuncu bir fazla alir ve cekmeden atar. */
export const BASLAYAN_DAGITIM = 15;

/** KURALLAR.md §1 — 106 - 57 = 49. */
export const DAGITIM_SONRASI_DESTE = 49;

/**
 * Sira icindeki asama.
 * - `cekme`: oyuncu ya desteden ceker ya da onundeki atik yiginindan alir
 * - `atma`: oyuncu acabilir/isleyebilir, sonunda bir tas atar
 * - `el-bitti`: el kapandi, `sonuc` doludur
 */
export type Faz = 'cekme' | 'atma' | 'el-bitti';

/** Yere inmis bir per. */
export interface YerPeri {
  readonly id: number;
  /** Peri indiren oyuncu. Isleme herkese aciktir (§6). */
  readonly sahibi: OyuncuId;
  readonly tip: PerTipi;
  readonly taslar: readonly Tas[];
}

/** KURALLAR.md §5 — tas atildiktan sonra acilan talep penceresi. */
export interface TalepPenceresi {
  readonly atan: OyuncuId;
  /** Yigininin en ustundeki tas — yalnizca bu alinabilir. */
  readonly tasId: TasId;
  /** Tasin atildigi an (ms). CLAUDE.md #2: zaman motorun disindan gelir. */
  readonly acilisZamani: number;
  /** Normal calma talepleri. Oncelik koltuk sirasina gore cozulur. */
  readonly talepler: readonly OyuncuId[];
  /** Tur 15'e ozgu "cifti bende" talebi. En fazla bir oyuncu hak sahibi olabilir. */
  readonly ciftTalebi: OyuncuId | null;
}

export interface OyunDurumu {
  readonly ayarlar: KuralAyarlari;
  readonly tur: TurNo;
  /** Bu eli baslatan oyuncu — 15 tasla baslar, cekmeden atar. */
  readonly baslayan: OyuncuId;
  readonly siradaki: OyuncuId;
  readonly faz: Faz;
  /** Cekilmeyi bekleyen taslar. Icerigi hicbir oyuncuya gosterilmez. */
  readonly deste: readonly Tas[];
  readonly istakalar: OyuncuKaydi<readonly Tas[]>;
  /** KURALLAR.md §4 — masada dort ayri atik yigini var; anahtar atan oyuncudur. */
  readonly atikYiginlari: OyuncuKaydi<readonly Tas[]>;
  /**
   * Masada duran atik taslarin ATILMA SIRASI (eskiden yeniye).
   * Dort yigin kimin hangi tasi alabilecegini belirler (§5); bu liste ise
   * yiginlarin birbirine gore sirasini tutar — tek bir obek olarak
   * gosterilebilmesi icin gerekli. Alinan tas listeden de cikar.
   */
  readonly atikSirasi: readonly TasId[];
  readonly yer: readonly YerPeri[];
  readonly sonrakiPerId: number;
  readonly acmisMi: OyuncuKaydi<boolean>;
  /** Oyuncunun actigi andaki hamle sayaci. §6 "bir tur donmus mu" kontrolu icin. */
  readonly acilisHamlesi: OyuncuKaydi<number | null>;
  /** Oyuncunun tamamladigi sira sayisi (her atistan sonra artar). */
  readonly hamleSayisi: OyuncuKaydi<number>;
  /** KURALLAR.md §5 — her calis 5 ceza puani; el sonunda carpansiz eklenir. */
  readonly calinanSayisi: OyuncuKaydi<number>;
  /** KURALLAR.md §8 — yerdeki bir pere isleyen tas atma sayisi. */
  readonly islerTasSayisi: OyuncuKaydi<number>;
  readonly pencere: TalepPenceresi | null;
  readonly sonuc: ElSonucu | null;
}

export interface ElParametreleri {
  readonly tur: TurNo;
  readonly baslayan: OyuncuId;
  /** CLAUDE.md #2: karistirma tohumu daima disaridan gelir. */
  readonly tohum: number;
}

/**
 * KURALLAR.md §1 — dagitim.
 * Her oyuncuya 14, baslayana 15 tas. Geriye 49 tas kalir.
 * Baslayan ilk hamlesinde cekmez, dogrudan atar: faz `atma` ile baslar.
 */
export function elBaslat(
  parametreler: ElParametreleri,
  ayarlar: KuralAyarlari = VARSAYILAN_AYARLAR,
): OyunDurumu {
  const { tur, baslayan, tohum } = parametreler;
  const karisik = karistir(desteOlustur(), rngOlustur(tohum));

  const dagitilan: Tas[][] = [[], [], [], []];
  let sonraki = 0;
  for (let ofset = 0; ofset < 4; ofset++) {
    const oyuncu = siradaIleri(baslayan, ofset);
    const adet = oyuncu === baslayan ? BASLAYAN_DAGITIM : NORMAL_DAGITIM;
    dagitilan[oyuncu] = [...karisik.slice(sonraki, sonraki + adet)];
    sonraki += adet;
  }

  return {
    ayarlar,
    tur,
    baslayan,
    siradaki: baslayan,
    faz: 'atma',
    deste: karisik.slice(sonraki),
    istakalar: oyuncuKaydiOlustur((oyuncu) => dagitilan[oyuncu] as readonly Tas[]),
    atikYiginlari: oyuncuKaydiOlustur<readonly Tas[]>(() => []),
    atikSirasi: [],
    yer: [],
    sonrakiPerId: 1,
    acmisMi: oyuncuKaydiOlustur(() => false),
    acilisHamlesi: oyuncuKaydiOlustur<number | null>(() => null),
    hamleSayisi: oyuncuKaydiOlustur(() => 0),
    calinanSayisi: oyuncuKaydiOlustur(() => 0),
    islerTasSayisi: oyuncuKaydiOlustur(() => 0),
    pencere: null,
    sonuc: null,
  };
}

/** Yeni bir el icin bir sonraki baslayan — KURALLAR.md §1. */
export function sonrakiBaslayan(baslayan: OyuncuId): OyuncuId {
  return siradaIleri(baslayan, 1);
}

export function yerPeriBul(durum: OyunDurumu, perId: number): YerPeri | null {
  return durum.yer.find((per) => per.id === perId) ?? null;
}

/** Bir oyuncunun actiktan sonra en az bir tur donup donmedigi — KURALLAR.md §6. */
export function birTurDonduMu(durum: OyunDurumu, oyuncu: OyuncuId): boolean {
  const acilis = durum.acilisHamlesi[oyuncu];
  if (acilis === null) return false;
  return durum.hamleSayisi[oyuncu] > acilis;
}
