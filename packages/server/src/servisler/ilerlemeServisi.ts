// Oyuncu istatistigi — el ve mac sayaclari.
//
// Ayri dosya cunku bu, oyunun akisina AIT DEGIL: sayac yazilamasa da el
// normal biter. Soket katmani bunu bekletmeden cagirir (`void`), hatasini
// yutar; oyunu bir Mongo yazmasi durdurmamali.
//
// Not: `cuzdan` MVP'de yazilmiyor (MIMARI.md §5.5) — jeton kararinin
// gerekcesi orada.

import { Oyuncu } from '../modeller/Oyuncu.js';
import { kayit } from '../kayit.js';

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
