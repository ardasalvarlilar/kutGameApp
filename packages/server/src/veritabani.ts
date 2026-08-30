// MongoDB baglantisi. Tek yerden acilir, tek yerden kapanir.
//
// Development ve production AYNI Atlas cluster'ini paylasiyor — ayri bir
// cluster acmaya gerek yok, cunku hangi veritabanina baglanilacagini `dbName`
// secenegi belirliyor ve bu secenek URI'nin icindeki yol parcasini (varsa)
// EZER. Yani `.env`'deki `MONGO_URI`nin sonunda db adi olsun ya da olmasin,
// gercekte kullanilan veritabani her zaman `NODE_ENV`den gelir:
//
//   development → veritabani "development"
//   production  → veritabani "production"
//
// Boylece production'a atilmadan once development'ta test edilen bir kayit
// yanlislikla gercek oyuncularin durdugu veritabanina karismaz — ikisi ayni
// sunucuda, ayni kullanicida ama TAMAMEN AYRI koleksiyon kumeleri.

import mongoose from 'mongoose';
import { config } from './config.js';
import { kayit } from './kayit.js';

export async function veritabaniniAc(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri, {
    dbName: config.ortam,
    // Uzun sessizlikte olu baglantiyla kalmayalim.
    serverSelectionTimeoutMS: 10_000,
  });
  kayit.bilgi(`MongoDB baglandi (veritabani: ${config.ortam})`);
}

export async function veritabaniniKapat(): Promise<void> {
  await mongoose.connection.close();
  kayit.bilgi('MongoDB kapandi');
}
