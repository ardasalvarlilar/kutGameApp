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

/**
 * KURALLAR.md §5 — tas atildiktan sonra acilan talep penceresi.
 *
 * Pencerenin SURESI YOKTUR (§9 0.9). Sirasi gelen oyuncu hamlesini yapana
 * kadar acik kalir ve o hamleyle kapanir: yerden alirsa tas onundur, desteden
 * cekerse en oncelikli talep sahibine gider. Kimse talep etmediyse tas yerde
 * kalir.
 *
 * Eskiden 3 saniyelik bir sayac vardi ve sirasi gelen oyuncuyu o kadar
 * bekletiyordu. Iki sorunu birden vardi: hizli oynayan herkesi geciktiriyor,
 * dusunen oyuncuya ise gereginden az sure taniyordu. Yeni kural her ikisini
 * de cozuyor — tepki suresi, sirasi gelenin dusunme suresi kadar.
 */
export interface TalepPenceresi {
  readonly atan: OyuncuId;
  /** Yigininin en ustundeki tas — yalnizca bu alinabilir. */
  readonly tasId: TasId;
  /**
   * Normal calma talepleri. Oncelik koltuk sirasina gore cozulur; kim once
   * bastigi onemli DEGIL (§5).
   *
   * Tur 15'in "cifti bende" hakki bu listede DURMAZ: o talep kuyruga
   * girmiyor, `CIFT_TALEBI` geldigi anda tasi aliyor (§9 0.10).
   */
  readonly talepler: readonly OyuncuId[];
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
  /**
   * Masadaki tasi EN SON kim caldi? Bir sonraki atisa kadar dolu kalir.
   *
   * Kural karari degil, ekran icin: atik obeginden bir tas eksildiginde onu
   * kimin aldigini gostermek gerekiyor. Bu alan olmadan istemci "sirasi gelen
   * aldi" varsayiyor ve calinan tas yanlis oyuncuya ucuyordu.
   */
  readonly sonCalan: OyuncuId | null;
  /**
   * SON tas hareketleri — ekranin animasyonu icin. Kural karari degil.
   *
   * Neden durumda: istemci bunlari tahmin edemiyordu. Eskiden atik/deste
   * sayaclarindaki farktan cikariliyordu ve uc yerde yaniliyordu — yerden
   * alinan tas kapali ucuyordu (oysa herkes gordu), calmanin ceza tasi hic
   * gorunmuyordu, tek bir aksiyonun urettigi UC hareket (ceken + calan +
   * ceza) tek bir ucusa siginmiyordu.
   *
   * **Liste SILINMEZ, uzerine EKLENIR** ve her hareket kendi `sira`sini
   * tasir. Iki sey birden bunu zorunlu kildi:
   *
   *  1. Surucu bir sirayi tek seferde oynuyor (cek → isle → at) ve ekrana
   *     yalnizca SON durum ulasiyor. Her aksiyonda sifirlansaydi cekis
   *     animasyonu ekrana hic varmadan silinirdi — ilk yazimda tam olarak
   *     bu oldu. Ustune yazsaydi da isleme cekisi silerdi.
   *  2. Sira onemli: once cekis, sonra isleme, en son atis. Sira numarasi
   *     olmadan bu ekrandaki effect tanim sirasina kaliyordu ve atis cekisten
   *     once oynuyordu.
   *
   * Istemci `sira`si kendi gordugunden buyuk olanlari oynatiyor; boylece ayni
   * gorunum iki kez gelse de (yeniden baglanmada sunucu mevcut durumu
   * dogrudan gonderiyor) animasyon tekrarlanmiyor.
   */
  readonly sonHareketler: readonly TasHareketi[];
  /** Verilmis en buyuk `sira`. Istemcinin "neyi gordum" esigi. */
  readonly sonHareketNo: number;
  readonly sonuc: ElSonucu | null;
}

/** Bir tasin nereden geldigi. Ekran acik/kapali ucusa buna gore karar veriyor. */
export type CekimKaynagi =
  /** Desteden cekildi — kimse gormedi, kapali ucar. */
  | 'deste'
  /** Sirasi gelen oyuncu atilan tasi bedelsiz aldi (§5). Herkes gordu. */
  | 'atik'
  /** Sirasi gelmeyen oyuncu tasi caldi (§5). Herkes gordu. */
  | 'calma'
  /** Calmanin bedeli: desteden bir tas (§5). Kapali ucar. */
  | 'ceza';

/**
 * Masadaki bir tas hareketi — SIRA NUMARASIZ govdesi.
 *
 * Numarayi `hareketlerle` veriyor; ureten kodun saymasi gerekmiyor.
 * Ayri tip olmasinin sebebi TypeScript: `Omit<TasHareketi, 'sira'>` birlesim
 * uzerinde dagilmiyor, ortak alanlara cokup `kaynak`/`perId`'yi dusuruyor.
 */
export type TasHareketiGovdesi =
  /** Ortadan oyuncuya: deste, yerden alma, calma ya da ceza tasi. */
  | {
      readonly oyuncu: OyuncuId;
      readonly tip: 'cekim';
      readonly kaynak: CekimKaynagi;
      /**
       * Tasin kendisi — YALNIZCA herkesin gordugu taslarda dolu.
       *
       * Desteden gelenlerde null: motor kurali #3, gizli bilgi projeksiyondan
       * gecmez. Burada ayrica filtreye gerek kalmiyor, cunku alan zaten
       * hicbir zaman gizli bir tas tasimiyor.
       */
      readonly tas: Tas | null;
      /** Tas kimin atik yiginindan alindi? Desteden gelende null. */
      readonly kimden: OyuncuId | null;
    }
  /** Oyuncudan ortaya: atilan tas. Atilan tas herkesin gordugu tastir. */
  | { readonly oyuncu: OyuncuId; readonly tip: 'atma'; readonly tas: Tas }
  /** Oyuncudan YERDEKI BIR PERE: isleme (§6). */
  | {
      readonly oyuncu: OyuncuId;
      readonly tip: 'isleme';
      readonly perId: number;
      readonly taslar: readonly Tas[];
    }
  /**
   * Oyuncudan YENI bir pere: acma (§6) ya da fazladan per indirme.
   *
   * `isleme`den ayri tutuluyor cunku hedef per O ANDA yaratiliyor. Ekranda
   * ikisi ayni sekilde ucuyor; ayrim, "bu per zaten duruyor muydu" sorusunun
   * cevabini kaybetmemek icin.
   */
  | {
      readonly oyuncu: OyuncuId;
      readonly tip: 'indirme';
      readonly perId: number;
      readonly taslar: readonly Tas[];
    };

/**
 * Sira numarasi verilmis hareket.
 *
 * Kesisim birlesim uzerinde DAGILIYOR, yani ayrimci alan (`tip`) korunuyor;
 * `Omit`in yapamadigi buydu.
 */
export type TasHareketi = TasHareketiGovdesi & {
  /** Artan sira numarasi. Istemci "bunu gordum mu"yu buna bakarak biliyor. */
  readonly sira: number;
};

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
    sonCalan: null,
    sonHareketler: [],
    sonHareketNo: 0,
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
