// Yonetim panelinin sayfasi — `/yonetim`.
//
// Yasal sayfalar gibi SUNUCUDAN veriliyor, ayri bir site degil: alan adi ve
// TLS zaten burada, uygulamaya da hicbir sey eklenmiyor. Panel duz HTML + JS;
// derleme adimi yok. Veriyi `/api/yonetim/*` uclarindan aliyor ve oradaki
// kapi (admin rolu) asil korumadir — bu sayfanin kendisi herkese acik, icinde
// giris formundan baska bir sey yok.
//
// Klasor CALISMA KLASORUNE gore: gelistirmede `packages/server/yonetim`,
// imajda `/uygulama/yonetim` (Dockerfile ikisini de ayni yere koyuyor).
// Bundle'in icine gomulmedi cunku panel JS'ini sablon metni olarak tutmak
// bakimi zorlastirirdi.

import path from 'node:path';
import express, { Router } from 'express';

const KLASOR = path.resolve('yonetim');

export function yonetimPaneliniKur(): Router {
  const rota = Router();
  rota.use(
    '/yonetim',
    (_istek, yanit, sonraki) => {
      // Arama motoru panelin varligini listelemesin; tarayici da onbelleğe
      // almasin (cikis yapan adminin sayfasi geri tusuyla acilmasin).
      yanit.setHeader('X-Robots-Tag', 'noindex, nofollow');
      yanit.setHeader('Cache-Control', 'no-store');
      sonraki();
    },
    express.static(KLASOR, { index: 'index.html' }),
  );
  return rota;
}
