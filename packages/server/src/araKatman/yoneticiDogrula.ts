// Yonetim uclarinin kapisi. `kimlikDogrula`dan SONRA kosar.
//
// Rol her istekte VERITABANINDAN okunuyor, jetondan degil: jeton 30 gun
// gecerli ve rolu icine yazsaydik, yetkisi alinan admin jetonu bitene kadar
// panelde kalirdi. Askiya alinmis hesap da admin olsa giremez.
//
// Kurucu (`KURUCU_EPOSTA`) rolden bagimsiz her zaman admin: panelden kimse
// onu — ve kendini — disarida birakamasin.

import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { Oyuncu } from '../modeller/Oyuncu.js';

export function kurucuMu(eposta: string | null | undefined): boolean {
  return config.kurucuEposta !== '' && eposta === config.kurucuEposta;
}

export function yoneticiDogrula(istek: Request, yanit: Response, sonraki: NextFunction): void {
  Oyuncu.findById(istek.oyuncuId)
    .select('rol engelli eposta')
    .lean()
    .then((oyuncu) => {
      const yetkili =
        oyuncu !== null && !oyuncu.engelli && (oyuncu.rol === 'admin' || kurucuMu(oyuncu.eposta));
      if (!yetkili) {
        yanit.status(403).json({ ok: false, hata: 'yetki-yok' });
        return;
      }
      sonraki();
    })
    .catch(sonraki);
}
