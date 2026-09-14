// Oyuncu istatistigi — el ve mac sayaclari.
//
// Ayri dosya cunku bu, oyunun akisina AIT DEGIL: sayac yazilamasa da el
// normal biter. Soket katmani bunu bekletmeden cagirir (`void`), hatasini
// yutar; oyunu bir Mongo yazmasi durdurmamali.
//
// Cip bakiyesi burada DEGIL (servisler/cuzdanServisi.ts): bakiye yazmasi
// yutulamaz, sayac yazmasi yutulabilir.

import { seviyeHesapla } from '@kut/ekonomi';
import { Oyuncu } from '../modeller/Oyuncu.js';
import { kayit } from '../kayit.js';

/**
 * Mac deneyimini ekler ve seviyeyi deneyimden yeniden hesaplar.
 *
 * Seviye `$max` ile yaziliyor: iki yazma yarissa bile geri dusmez. Ayri
 * alan olarak saklaniyor cunku masaya oturma kontrolu onu okuyor.
 */
export async function deneyimEkle(oyuncuId: string, miktar: number): Promise<void> {
  try {
    const guncel = await Oyuncu.findOneAndUpdate(
      { _id: oyuncuId },
      { $inc: { 'ilerleme.deneyim': miktar } },
      { new: true, projection: { ilerleme: 1 } },
    );
    if (guncel === null) return;
    await Oyuncu.updateOne(
      { _id: oyuncuId },
      { $max: { 'ilerleme.seviye': seviyeHesapla(guncel.ilerleme.deneyim) } },
    );
  } catch (hata) {
    kayit.uyari('Deneyim yazilamadi', hata);
  }
}

export interface ElSayaci {
  readonly oyuncuIdler: readonly string[];
  /** Eli bitiren oyuncunun kimligi; deste tukendiyse null. */
  readonly kazananId: string | null;
}

export async function elIsle({ oyuncuIdler, kazananId }: ElSayaci): Promise<void> {
  try {
    await Oyuncu.updateMany({ _id: { $in: oyuncuIdler } }, { $inc: { 'ilerleme.oynananEl': 1 } });
    if (kazananId !== null) {
      await Oyuncu.updateOne({ _id: kazananId }, { $inc: { 'ilerleme.kazanilanEl': 1 } });
    }
  } catch (hata) {
    kayit.uyari('El istatistigi yazilamadi', hata);
  }
}

export async function macIsle(
  oyuncuIdler: readonly string[],
  kazananIdler: readonly string[],
): Promise<void> {
  try {
    await Oyuncu.updateMany({ _id: { $in: oyuncuIdler } }, { $inc: { 'ilerleme.oynananMac': 1 } });
    if (kazananIdler.length > 0) {
      await Oyuncu.updateMany(
        { _id: { $in: kazananIdler } },
        { $inc: { 'ilerleme.kazanilanMac': 1 } },
      );
    }
  } catch (hata) {
    kayit.uyari('Mac istatistigi yazilamadi', hata);
  }
}
