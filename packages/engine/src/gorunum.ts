// Gizli bilgi projeksiyonu.
// CLAUDE.md motor kurali #3: istemciye giden her sey buradan gecer ve o
// oyuncunun gormemesi gereken hicbir sey icermez. Botlar da bunu kullanir —
// bot insandan fazlasini gormez.

import {
  birTurDonduMu,
  type TasHareketi,
  type Faz,
  type OyunDurumu,
  type YerPeri,
} from './durum';
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

/**
 * Acik talep penceresi (§5). SAYAC YOKTUR (§9 0.9): pencere, sirasi gelen
 * oyuncu hamlesini yapana kadar acik kalir. Ekranda bu yuzden geri sayim
 * degil, kimin talep ettigi gosterilir.
 */
export interface PencereGorunumu {
  readonly atan: OyuncuId;
  readonly tasId: TasId;
  readonly talepler: readonly OyuncuId[];
  /**
   * Bu oyuncu "cifti bende" diyebilir mi?
   *
   * Uc sart birden (§5, §9 0.10): tur 15 olacak, atilan tasin BIREBIR ESI
   * gercekten istakasinda olacak ve oyuncu HENUZ ACMAMIS olacak.
   *
   * Es sarti bir kullanici kolayligi degil, kuralin kendisi: elinde olmayan
   * bir tasi "cifti bende" diye almak, isine yarayan her tasi bedavaya
   * toplamak olurdu. Asil kontrol yine motorda (`cift-elinde-yok`).
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
  /**
   * Masadaki tasi en son kim caldi? Kural karari degil, ekran icin: atik
   * obeginden eksilen tasin kime gittigini gostermeye yariyor.
   */
  readonly sonCalan: OyuncuId | null;
  /**
   * Son tas hareketleri — ekran animasyonu icin.
   *
   * PROJEKSIYON GEREKTIRMIYOR: hareketlerdeki taslar yalnizca herkesin
   * gordugu taslar; desteden cekilen `tas: null` geliyor. Yani burada
   * ayiklanacak gizli bilgi yok, alan oldugu gibi geciyor (motor kurali #3
   * kaynaginda saglaniyor).
   */
  readonly sonHareketler: readonly TasHareketi[];
  /** Verilmis en buyuk sira numarasi; istemci tekrari boyle eliyor. */
  readonly sonHareketNo: number;
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
      // §9 0.10 — dort cifti indirdikten sonra ciftle isin bitiyor.
      !durum.acmisMi[oyuncu] &&
      // Ceza tasi odenmeden calinamaz (§5).
      durum.deste.length > 0 &&
      ustTas !== undefined &&
      durum.istakalar[oyuncu].some((tas) => birebirEsMi(tas, ustTas));

    pencereGorunumu = {
      atan: pencere.atan,
      tasId: pencere.tasId,
      talepler: hepsiniGorur
        ? pencere.talepler
        : pencere.talepler.filter((talep) => talep === oyuncu),
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
    sonCalan: durum.sonCalan,
    sonHareketler: durum.sonHareketler,
    sonHareketNo: durum.sonHareketNo,
    sonuc: durum.sonuc,
  };
}
