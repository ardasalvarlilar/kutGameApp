// El sonu hesabi ve mac toplami. KURALLAR.md §8

import type { KuralAyarlari } from './kurallar';
import { tasToplami } from './tas';
import {
  OYUNCULAR,
  oyuncuKaydiOlustur,
  type OyuncuId,
  type OyuncuKaydi,
  type Tas,
  type TurNo,
} from './tipler';

/** KURALLAR.md §8 — eli bitiren oyuncunun puani. */
export const KAZANAN_PUANI = -100;

/** KURALLAR.md §5 — her calis 5 ceza puani. */
export const CALMA_CEZASI = 5;

export type BitisTipi = 'normal' | 'deste-tukendi';

export interface PuanDetayi {
  /** Elde kalan taslarin ham toplami; okey 25 sayilir. */
  readonly hamCeza: number;
  readonly acamadiCarpani: boolean;
  readonly okeyleBitmeCarpani: boolean;
  readonly carpan: number;
  /** 5 × calinan tas sayisi. Carpana GIRMEZ, en sonda eklenir. */
  readonly calmaCezasi: number;
  /** 50 × isler tas atma sayisi. Bu da carpana GIRMEZ. */
  readonly islerTasCezasi: number;
  readonly toplam: number;
}

export interface ElSonucu {
  readonly tur: TurNo;
  readonly bitisTipi: BitisTipi;
  readonly kazanan: OyuncuId | null;
  /** KURALLAR.md §8 — bitiren oyuncunun ortaya attigi son tasin okey olmasi. */
  readonly okeyleBitti: boolean;
  readonly puanlar: OyuncuKaydi<number>;
  readonly detaylar: OyuncuKaydi<PuanDetayi>;
}

/** elPuanla'nin ihtiyac duydugu durum parcasi. OyunDurumu bunu karsilar. */
export interface PuanGirdisi {
  readonly tur: TurNo;
  readonly ayarlar: KuralAyarlari;
  readonly istakalar: OyuncuKaydi<readonly Tas[]>;
  readonly acmisMi: OyuncuKaydi<boolean>;
  readonly calinanSayisi: OyuncuKaydi<number>;
  readonly islerTasSayisi: OyuncuKaydi<number>;
}

function bosDetay(toplam: number, calmaCezasi: number, islerTasCezasi: number): PuanDetayi {
  return {
    hamCeza: 0,
    acamadiCarpani: false,
    okeyleBitmeCarpani: false,
    carpan: 1,
    calmaCezasi,
    islerTasCezasi,
    toplam,
  };
}

/**
 * KURALLAR.md §8 — sira onemlidir:
 *   ceza = Σ(eldeki taslarin sayilari)        // okey = 25
 *   if (hic acmadiysa)           ceza *= 2
 *   if (kazanan okeyle bittiyse) ceza *= 2    // ikisi birden → *4
 *   ceza += 5 * (calinan tas sayisi)          // carpana GIRMEZ, en sonda
 */
export function elPuanla(
  girdi: PuanGirdisi,
  bitisTipi: BitisTipi,
  kazanan: OyuncuId | null,
  okeyleBitti: boolean,
): ElSonucu {
  const { tur, ayarlar } = girdi;

  // §9.4 (karara baglandi): deste tukenirse kimse -100 almaz.
  const gecerliKazanan =
    bitisTipi === 'deste-tukendi' && !ayarlar.desteTukendigindeKazananVar ? null : kazanan;
  const gecerliOkeyleBitti = gecerliKazanan === null ? false : okeyleBitti;

  const detaylar = oyuncuKaydiOlustur<PuanDetayi>((oyuncu) => {
    const calinan = girdi.calinanSayisi[oyuncu];

    const islerCezasi = ayarlar.islerTasCezasi * girdi.islerTasSayisi[oyuncu];

    if (oyuncu === gecerliKazanan) {
      // §9.5 (karara baglandi): kazanan da caldigi taslarin bedelini oder.
      // Isler tas cezasi de ayni mantikla kazanan icin de gecerli.
      const calmaCezasi = ayarlar.kazananCalmaCezasiOder ? CALMA_CEZASI * calinan : 0;
      return bosDetay(KAZANAN_PUANI + calmaCezasi + islerCezasi, calmaCezasi, islerCezasi);
    }

    const hamCeza = tasToplami(girdi.istakalar[oyuncu]);
    const acamadi = !girdi.acmisMi[oyuncu];

    // §7: deste tukenirse "acamayanlar iki katini yazar" — acmis olan ham puanini yazar.
    // §9.3 (karara baglandi): tur 16'da kimse acmadigi icin bitiren disinda herkes ×2 yer.
    const acamadiCarpani =
      acamadi && (tur !== 16 || bitisTipi === 'deste-tukendi' || ayarlar.tur16AcamadiCarpani);

    // §9.7 (karara baglandi): tur 16'da okeyle bitme carpani da gecerli.
    const okeyleBitmeCarpani =
      gecerliOkeyleBitti && (tur !== 16 || ayarlar.tur16OkeyleBitmeCarpani);

    const carpan = (acamadiCarpani ? 2 : 1) * (okeyleBitmeCarpani ? 2 : 1);

    const calmaCezasiUygulanir =
      bitisTipi === 'normal' || ayarlar.desteTukendigindeCalmaCezasi;
    const calmaCezasi = calmaCezasiUygulanir ? CALMA_CEZASI * calinan : 0;

    return {
      hamCeza,
      acamadiCarpani,
      okeyleBitmeCarpani,
      carpan,
      calmaCezasi,
      islerTasCezasi: islerCezasi,
      // §8 — carpanlar once, sabit cezalar en sonda.
      toplam: hamCeza * carpan + calmaCezasi + islerCezasi,
    };
  });

  return {
    tur,
    bitisTipi,
    kazanan: gecerliKazanan,
    okeyleBitti: gecerliOkeyleBitti,
    puanlar: oyuncuKaydiOlustur((oyuncu) => detaylar[oyuncu].toplam),
    detaylar,
  };
}

/**
 * KURALLAR.md §8 — 16 turun puanlari toplanir, en dusuk toplam kazanir.
 * Kazanilan ellerin -100'leri de bu toplamin icindedir.
 */
export function macToplami(elSonuclari: readonly ElSonucu[]): OyuncuKaydi<number> {
  return oyuncuKaydiOlustur((oyuncu) => {
    let toplam = 0;
    for (const sonuc of elSonuclari) toplam += sonuc.puanlar[oyuncu];
    return toplam;
  });
}

/** En dusuk toplama sahip oyuncu(lar). Beraberlik halinde hepsi doner. */
export function macKazanani(toplamlar: OyuncuKaydi<number>): readonly OyuncuId[] {
  let enDusuk = Number.POSITIVE_INFINITY;
  for (const oyuncu of OYUNCULAR) {
    if (toplamlar[oyuncu] < enDusuk) enDusuk = toplamlar[oyuncu];
  }
  return OYUNCULAR.filter((oyuncu) => toplamlar[oyuncu] === enDusuk);
}
