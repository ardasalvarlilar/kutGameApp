// Express uygulamasi. HTTP sunucusu ve soket `index.ts`te kuruluyor.

import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { bulunamadi, hataYakala } from './araKatman/hataYakala.js';
import { rotalariKur } from './rotalar/index.js';
import { sayfalariKur } from './rotalar/sayfalar.js';

export function uygulamayiKur(): Express {
  const app = express();

  app.disable('x-powered-by');
  // Traefik'in arkasindayiz: gercek istemci IP'si `x-forwarded-for`da.
  // Bu satir olmadan `req.ip` her istekte vekilin IP'sini verir ve oran
  // sinirlayici butun oyuncularu TEK kova sayardi (araKatman/oranSiniri.ts).
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      // Liste bossa herkese acik: mobil uygulamada tarayici kaynagi yok.
      origin: config.corsKaynaklari.length > 0 ? config.corsKaynaklari : true,
      credentials: true,
    }),
  );
  // Oyun paketleri kucuk; buyuk govde kabul etmeye gerek yok.
  app.use(express.json({ limit: '64kb' }));

  app.use('/api', rotalariKur());
  // Gizlilik / kosullar / destek — App Store Connect bu URL'leri istiyor ve
  // ucunun de gercekten acilmasi gerekiyor (rotalar/sayfalar.ts).
  app.use('/', sayfalariKur());

  app.use(bulunamadi);
  app.use(hataYakala);
  return app;
}
