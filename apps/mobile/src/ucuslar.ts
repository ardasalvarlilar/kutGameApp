// Motorun tas hareketlerini masadaki ucuslara cevirir. Saf ve testli.
//
// Ekran eskiden bunu SAYAC FARKINDAN cikariyordu: atik yigini buyuduyse
// biri atmis, kucukduyse biri almis, deste azaldiysa biri cekmis. Dort yerde
// birden yaniliyordu:
//
//  1. Yerden alinan tas kapali ucuyordu — oysa masada acik duruyordu ve
//     herkes gormustu.
//  2. Calmanin CEZA TASI hic gorunmuyordu; istaka sessizce iki tas buyuyordu.
//  3. Tek bir `CEK_DESTEDEN` uc hareket uretebiliyor (ceken + calan + ceza)
//     ama sayac farkindan yalnizca biri cikarilabiliyordu.
//  4. SIRA yanlisti: atis ayri bir effect'te cikariliyordu ve iki effect'in
//     TANIM SIRASI kuyruga girisi belirledigi icin atis, cekisten once
//     oynuyordu.
//
// Artik motor "ne oldu"yu sirasiyla soyluyor (`OyunDurumu.sonHareketler`);
// burasi yalnizca noktalari kuruyor. Tasin ACIK mi KAPALI mi ucacagi da
// burada kararlastirilmiyor: hareketin tasi doluysa acik, null ise kapali.
// Motor kurali #3 geregi desteden gelen tas zaten null geliyor.

import type { OyuncuId, TasHareketi, TasId } from '@kut/engine';
import type { Nokta, Ucus } from './bilesenler/UcanTas';

/**
 * Su an HAVADA olan taslarin kimlikleri (oynayan + kuyrukta bekleyen).
 *
 * Ekran son durumu hemen ciziyor, ucuslar ise kuyrukta sirayla oynuyor. Bir
 * sirada birden fazla hamle varsa (ac + at) atilan tas, kendi ucusu daha
 * baslamadan yiginin ustunde beliriyordu: once tas orada bitiyor, sonra acma
 * animasyonu oynuyor, en sonda tas bir kez daha ucup zaten durdugu yere
 * konuyordu. Havadaki tasi VARIS YERINDE gizlemek bunu duzeltiyor.
 *
 * Kapali ucan taslar (`tas: null`) burada yok: kimlikleri zaten gorunmuyor.
 */
export function ucanTasIdleri(ucuslar: readonly Ucus[]): ReadonlySet<TasId> {
  const idler = new Set<TasId>();
  for (const ucus of ucuslar) {
    if (ucus.tas !== null) idler.add(ucus.tas.id);
  }
  return idler;
}

/** Ucusun uclarini veren noktalar — masaya gore, ekrana gore degil. */
export interface UcusOrtami {
  /** Deste ve atik obeginin durdugu yer. */
  readonly merkez: Nokta;
  /** Oyuncunun istakasinin/seridinin durdugu yer. */
  readonly koltuk: (oyuncu: OyuncuId) => Nokta;
  /**
   * Yerdeki perin durdugu yer.
   *
   * Olculemedigi durumda cagiran makul bir yedek verir (perin SAHIBININ
   * yonu); burasi null kabul etmiyor cunku animasyonu sessizce dusurmek,
   * "tas nereye gitti" sorusunu yine cevapsiz birakirdi.
   */
  readonly per: (perId: number) => Nokta;
}

/**
 * Hareketleri sirayla ucusa cevirir.
 *
 * Anahtar `sira`dan uretiliyor: benzersiz oldugu icin ayni tas iki kez
 * uctugunda animasyon bastan basliyor (`UcanTas` anahtari izliyor).
 */
export function hareketUcuslari(
  hareketler: readonly TasHareketi[],
  ortam: UcusOrtami,
): readonly Ucus[] {
  const ucuslar: Ucus[] = [];

  for (const hareket of hareketler) {
    if (hareket.tip === 'cekim') {
      // Ortadan oyuncuya. Calinan tas SIRASI GELENE degil CALANA gider (§5).
      ucuslar.push({
        anahtar: `h${hareket.sira}`,
        tas: hareket.tas,
        baslangic: ortam.merkez,
        bitis: ortam.koltuk(hareket.oyuncu),
      });
      continue;
    }

    if (hareket.tip === 'atma') {
      ucuslar.push({
        anahtar: `h${hareket.sira}`,
        tas: hareket.tas,
        baslangic: ortam.koltuk(hareket.oyuncu),
        bitis: ortam.merkez,
      });
      continue;
    }

    // Isleme ve indirme: tas oyuncunun istakasindan cikip HEDEF PERE gidiyor.
    // Hedef, peri indirenin koltugu degil PERIN KENDISI — baskasinin perine
    // de islenebiliyor (§6). Ikisi ayni sekilde uctugu icin tek dal:
    // `indirme`de per o anda yaratiliyor ama ekrana ulastiginda cizilmis
    // oluyor, dolayisiyla konumu yine olculebiliyor.
    const hedef = ortam.per(hareket.perId);
    hareket.taslar.forEach((tas, sira) => {
      ucuslar.push({
        anahtar: `h${hareket.sira}-${sira}`,
        tas,
        baslangic: ortam.koltuk(hareket.oyuncu),
        bitis: hedef,
      });
    });
  }

  return ucuslar;
}
