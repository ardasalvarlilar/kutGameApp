// Push bildirimi uclari.
//
// Yalnizca CIHAZ KAYDI burada: uygulama izni alip Expo'dan aldigi jetonu
// yolluyor, sunucu onu oyuncunun belgesine yaziyor. Bildirimin ne zaman
// gonderilecegi bu dosyanin isi degil (bkz. servisler/bildirimServisi.ts).

import type { Request, Response } from 'express';
import { z } from 'zod';
import { BILDIRIM_PLATFORMLARI } from '../modeller/Oyuncu.js';
import { BildirimHatasi, jetonKaydet, jetonSil } from '../servisler/bildirimServisi.js';

const jetonGirdisi = z.object({
  jeton: z.string().min(1).max(255),
  platform: z.enum(BILDIRIM_PLATFORMLARI),
});

const silmeGirdisi = z.object({ jeton: z.string().min(1).max(255) });

export async function bildirimJetonuKaydet(istek: Request, yanit: Response): Promise<void> {
  const cozum = jetonGirdisi.safeParse(istek.body);
  if (!cozum.success) {
    yanit.status(400).json({ ok: false, hata: 'Geçersiz bildirim jetonu' });
    return;
  }
  try {
    await jetonKaydet(istek.oyuncuId as string, cozum.data.jeton, cozum.data.platform);
    yanit.json({ ok: true, veri: { kaydedildi: true } });
  } catch (hata) {
    if (hata instanceof BildirimHatasi) {
      yanit.status(400).json({ ok: false, hata: hata.message });
      return;
    }
    throw hata;
  }
}

export async function bildirimJetonuSil(istek: Request, yanit: Response): Promise<void> {
  const cozum = silmeGirdisi.safeParse(istek.body);
  if (!cozum.success) {
    yanit.status(400).json({ ok: false, hata: 'Geçersiz bildirim jetonu' });
    return;
  }
  await jetonSil(cozum.data.jeton);
  yanit.json({ ok: true, veri: { silindi: true } });
}
