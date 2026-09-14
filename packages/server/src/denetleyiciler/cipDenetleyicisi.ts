// Cip uclari: hediye durumu, hediye toplama, reklam geri cagrisi.
//
// Masa girisi ve odulu SOKETTE (soket/index.ts) — masaya oturmakla ayni
// islem. Burasi masadan bagimsiz, tek seferlik isler.

import type { Request, Response } from 'express';
import { CuzdanHatasi, hediyeDurumu, hediyeTopla } from '../servisler/cuzdanServisi.js';
import { admobGeriCagrisi } from '../servisler/reklamServisi.js';

async function calistir<T>(yanit: Response, is: () => Promise<T>): Promise<void> {
  try {
    yanit.json({ ok: true, veri: await is() });
  } catch (hata) {
    if (hata instanceof CuzdanHatasi) {
      yanit.status(400).json({ ok: false, hata: hata.message });
      return;
    }
    throw hata;
  }
}

export async function hediye(istek: Request, yanit: Response): Promise<void> {
  await calistir(yanit, () => hediyeDurumu(istek.oyuncuId as string));
}

export async function hediyeAl(istek: Request, yanit: Response): Promise<void> {
  await calistir(yanit, () => hediyeTopla(istek.oyuncuId as string));
}

/**
 * AdMob SSV. Kimlik DOGRULAMASI YOK — kimligi Google'in imzasi kanitliyor.
 *
 * Imza ham sorgu metni uzerinden dogrulandigi icin Express'in cozdugu
 * `istek.query` kullanilamaz (sira ve kodlama degisebilir); `originalUrl`
 * aynen okunuyor. Tekrarlanan geri cagriya da 200 donuyor: Google 200 gorene
 * kadar yeniden deniyor.
 */
export async function admob(istek: Request, yanit: Response): Promise<void> {
  const sorgu = istek.originalUrl.split('?')[1] ?? '';
  const sonuc = await admobGeriCagrisi(sorgu);
  yanit.status(sonuc === 'gecersiz' ? 403 : 200).json({ ok: sonuc !== 'gecersiz', sonuc });
}
