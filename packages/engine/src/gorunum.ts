// Gizli bilgi projeksiyonu.
// CLAUDE.md motor kurali #3: istemciye giden her sey buradan gecer ve o
// oyuncunun gormemesi gereken hicbir sey icermez. Botlar da bunu kullanir —
// bot insandan fazlasini gormez.

import { birTurDonduMu, type Faz, type OyunDurumu, type YerPeri } from './durum';
import type { KuralAyarlari } from './kurallar';
import type { ElSonucu } from './puan';
import { islerMi, okeyCekmeAdaylari, perdekiOkeyler } from './per';
import { birebirEsMi } from './tas';
import {
  OYUNCULAR,
  oyuncuKaydiOlustur,
  type OyuncuId,
  type OyuncuKaydi,
  type Tas,
  type TasId,
  type TurNo,
} from './tipler';

/**
 * KURALLAR.md §5 — "Yalnizca yiginin en ustteki tasi alinabilir; altindakiler
 * oludur." Yiginin altindaki taslar gorunmez; yalnizca ust tas ve adet acilir.
 */
export interface AtikGorunumu {
  readonly ustTas: Tas | null;
  readonly adet: number;
}

export interface PencereGorunumu {
  readonly atan: OyuncuId;
  readonly tasId: TasId;
  readonly acilisZamani: number;
  /** Bu andan sonra sirasi gelen oyuncu desteden cekebilir (§5.2). */
  readonly kapanisZamani: number;
  readonly talepler: readonly OyuncuId[];
  readonly ciftTalebi: OyuncuId | null;
  /**
   * Bu oyuncu "cifti bende" diyebilir mi? Tur 15'te ve yalnizca atilan tasin
   * birebir esi gercekten istakasindaysa true. Istemcideki tusu bu belirler;
   * asil kontrol yine sunucuda yapilir.
   */
  readonly ciftHakkim: boolean;
}

/**
 * KURALLAR.md §6 — yerdeki bir perden okey cekme firsati.
 *
 * Gizli bilgi degil: yerdeki perler herkese acik, istaka zaten benim.
 * Kural karari degil, ipucu; motor yine `OKEY_CEK` / `AC` ile karar veriyor.
 */
export interface OkeyFirsati {
  readonly perId: number;
  readonly okeyTasId: TasId;
  /** Okeyin yerine konacak taslarim. Kutte dort rengi tamamlamak gerekebilir. */
  readonly yerineTasIdler: readonly TasId[];
}

export interface OyuncuGorunumu {
  readonly ben: OyuncuId;
  readonly tur: TurNo;
  readonly ayarlar: KuralAyarlari;
  readonly baslayan: OyuncuId;
  readonly siradaki: OyuncuId;
  readonly faz: Faz;
  /** Yalnizca kendi taslarim. */
  readonly istakam: readonly Tas[];
  /** Rakiplerin istakasindan gorunen tek sey: tas sayisi. */
  readonly tasSayilari: OyuncuKaydi<number>;
  /** Destenin icerigi degil, yalnizca kalan adet. */
  readonly desteSayisi: number;
  readonly atikYiginlari: OyuncuKaydi<AtikGorunumu>;
  /**
   * Masadaki butun atiklar tek obek olarak: en son atilan tas ustte.
   * KURALLAR.md §5 geregi yalnizca bu tas alinabilir; altindakiler oludur.
   * Alindiysa null olur — o an masada canli tas yoktur.
   */
  readonly atikUstu: Tas | null;
  /** Masada duran toplam atik tas sayisi. */
  readonly atikAdedi: number;
  readonly yer: readonly YerPeri[];
  readonly acmisMi: OyuncuKaydi<boolean>;
  /** Puani etkiledigi icin herkesin calis sayisi aciktir (§5, §8). */
  readonly calinanSayisi: OyuncuKaydi<number>;
  /** Kac kez isler tas atildigi — bu da puani etkiler, aciktir (§8). */
  readonly islerTasSayisi: OyuncuKaydi<number>;
  /**
   * Kendi istakamdaki hangi taslar yerdeki bir pere isliyor.
   * Atilirsa ceza getirir; istemci bunlari isaretler. Gizli bilgi degil:
   * yerdeki perler herkese acik, istaka zaten benim.
   */
  readonly islerTaslarim: readonly TasId[];
  /**
   * KURALLAR.md §6 — su an yerdeki perlere isleme yapabilir miyim?
   * Acmis olmak yetmez, actiktan sonra bir tur donmus olmasi gerekir.
   */
  readonly islemeYapabilirim: boolean;
  /**
   * KURALLAR.md §6 — elimdeki taslarla yerden cekebilecegim okeyler.
   *
   * Bu taslar `islerTaslarim`a GIRMEZ: §8'in cezasi "yerdeki bir pere
   * ISLENEBILECEK" tasi atmaya yazilir, okey cekmek ayri bir hamledir
   * (§6). Ikisini birlestirmek puanlamayi sessizce degistirirdi.
   */
  readonly okeyFirsatlarim: readonly OkeyFirsati[];
  readonly pencere: PencereGorunumu | null;
  readonly sonuc: ElSonucu | null;
}

/** Atilma sirasindaki son tas — masadaki tek canli atik. */
function sonAtilanTas(durum: OyunDurumu): Tas | null {
  const sonId = durum.atikSirasi[durum.atikSirasi.length - 1];
  if (sonId === undefined) return null;
  for (const oyuncu of OYUNCULAR) {
    const bulunan = durum.atikYiginlari[oyuncu].find((tas) => tas.id === sonId);
    if (bulunan !== undefined) return bulunan;
  }
  return null;
}

function atikGorunumu(yigin: readonly Tas[]): AtikGorunumu {
  const ustTas = yigin[yigin.length - 1];
  return { ustTas: ustTas ?? null, adet: yigin.length };
}

/** Oyuncunun istakasiyla yerdeki perlerden cekebilecegi okeyler (§6). */
function okeyFirsatlari(durum: OyunDurumu, oyuncu: OyuncuId): readonly OkeyFirsati[] {
  const istaka = durum.istakalar[oyuncu];
  const firsatlar: OkeyFirsati[] = [];

  for (const per of durum.yer) {
    for (const okeyTasId of perdekiOkeyler(per)) {
      const adaylar = okeyCekmeAdaylari(per, okeyTasId, istaka);
      if (adaylar === null) continue;
      firsatlar.push({
        perId: per.id,
        okeyTasId,
        yerineTasIdler: adaylar.map((tas) => tas.id),
      });
    }
  }
  return firsatlar;
}

export function viewFor(durum: OyunDurumu, oyuncu: OyuncuId): OyuncuGorunumu {
  const pencere = durum.pencere;
  let pencereGorunumu: PencereGorunumu | null = null;

  if (pencere !== null) {
    // KURALLAR.md §5 "Talep gorunurlugu" — sirasi gelen oyuncu digerlerinin
    // talebini gorur. Oda ayari kapaliysa herkes yalnizca kendi talebini gorur.
    const hepsiniGorur = durum.ayarlar.talepGorunurlugu && oyuncu === durum.siradaki;
    const yigin = durum.atikYiginlari[pencere.atan];
    const ustTas = yigin[yigin.length - 1];

    const ciftHakkim =
      durum.tur === 15 &&
      durum.ayarlar.ciftCalmaHakki &&
      oyuncu !== pencere.atan &&
      oyuncu !== durum.siradaki &&
      ustTas !== undefined &&
      durum.istakalar[oyuncu].some((tas) => birebirEsMi(tas, ustTas));

    pencereGorunumu = {
      atan: pencere.atan,
      tasId: pencere.tasId,
      acilisZamani: pencere.acilisZamani,
      kapanisZamani: pencere.acilisZamani + durum.ayarlar.talepPenceresiMs,
      talepler: hepsiniGorur
        ? pencere.talepler
        : pencere.talepler.filter((talep) => talep === oyuncu),
      ciftTalebi: hepsiniGorur
        ? pencere.ciftTalebi
        : pencere.ciftTalebi === oyuncu
          ? oyuncu
          : null,
      ciftHakkim,
    };
  }

  return {
    ben: oyuncu,
    tur: durum.tur,
    ayarlar: durum.ayarlar,
    baslayan: durum.baslayan,
    siradaki: durum.siradaki,
    faz: durum.faz,
    istakam: durum.istakalar[oyuncu],
    tasSayilari: oyuncuKaydiOlustur((o) => durum.istakalar[o].length),
    desteSayisi: durum.deste.length,
    atikYiginlari: oyuncuKaydiOlustur((o) => atikGorunumu(durum.atikYiginlari[o])),
    atikUstu: sonAtilanTas(durum),
    atikAdedi: durum.atikSirasi.length,
    yer: durum.yer,
    acmisMi: durum.acmisMi,
    calinanSayisi: durum.calinanSayisi,
    islerTasSayisi: durum.islerTasSayisi,
    islerTaslarim: durum.istakalar[oyuncu]
      .filter((tas) => islerMi(tas, durum.yer, durum.istakalar[oyuncu]))
      .map((tas) => tas.id),
    islemeYapabilirim: durum.acmisMi[oyuncu] && birTurDonduMu(durum, oyuncu),
    okeyFirsatlarim: okeyFirsatlari(durum, oyuncu),
    pencere: pencereGorunumu,
    sonuc: durum.sonuc,
  };
}

/** Pencerenin kapanmasina kalan sure (ms). Kapandiysa 0. */
export function kalanPencereSuresi(durum: OyunDurumu, suAn: number): number {
  if (durum.pencere === null) return 0;
  const kapanis = durum.pencere.acilisZamani + durum.ayarlar.talepPenceresiMs;
  return Math.max(0, kapanis - suAn);
}
