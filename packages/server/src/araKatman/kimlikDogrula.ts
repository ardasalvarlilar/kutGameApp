// HTTP isteklerinde jeton dogrulama.
//
// Soket tarafinin kendi dogrulamasi var (soket/index.ts `io.use`); burasi
// yalnizca REST ucu icin. Ikisi de ayni `jetonuCoz`u kullanir.

import type { NextFunction, Request, Response } from 'express';
import { jetonuCoz } from '../servisler/kimlikServisi.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      oyuncuId?: string;
    }
  }
}

export function kimlikDogrula(istek: Request, yanit: Response, sonraki: NextFunction): void {
  const baslik = istek.headers.authorization;
  const jeton = baslik?.startsWith('Bearer ') === true ? baslik.slice(7) : null;

  if (jeton === null) {
    yanit.status(401).json({ ok: false, hata: 'Jeton gerekli' });
    return;
  }
  const icerik = jetonuCoz(jeton);
  if (icerik === null) {
    yanit.status(401).json({ ok: false, hata: 'Jeton geçersiz' });
    return;
  }
  istek.oyuncuId = icerik.oyuncuId;
  sonraki();
}
