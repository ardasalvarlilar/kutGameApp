// Son durak hata yakalayici.
//
// Ic hata mesajlari ISTEMCIYE SIZMAZ: yigin izi ya da veritabani hatasi
// saldirgana bilgi verir. Gunluge tam hali, istemciye genel mesaj gider.

import type { NextFunction, Request, Response } from 'express';
import { kayit } from '../kayit.js';

export function bulunamadi(_istek: Request, yanit: Response): void {
  yanit.status(404).json({ ok: false, hata: 'Böyle bir uç yok' });
}

export function hataYakala(
  hata: unknown,
  _istek: Request,
  yanit: Response,
  _sonraki: NextFunction,
): void {
  kayit.hata('İstek hatası', hata);
  yanit.status(500).json({ ok: false, hata: 'Sunucuda bir hata oldu' });
}
