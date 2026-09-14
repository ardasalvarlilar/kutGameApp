// Baslangic cipini almis cihazlar.
//
// Baslangic cipi HESAP basina degil CIHAZ basina bir kez veriliyor. Hesap
// basina olsaydi, hesabini silip yeniden acan ya da ayni telefonda ikinci bir
// e-posta hesabi acan her seferinde 15 bin cip alirdi — bu cipler maci
// kaybederek ana hesaba aktarilabiliyor.
//
// Oyuncuya BAGLI DEGIL, yalnizca cihaz kimliginin ozeti duruyor: hesap
// silindiginde kisisel bir kayit geride kalmasin, ama "bu cihaz aldi" bilgisi
// kalsin. Ham kimlik saklanmiyor (Android'de donanima bagli bir deger).

import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

const baslangicHakkiSemasi = new Schema(
  {
    /** sha256(cihaz kimligi). */
    ozet: { type: String, required: true, unique: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'baslangicHaklari' },
);

export type BaslangicHakkiBelgesi = InferSchemaType<typeof baslangicHakkiSemasi>;

export const BaslangicHakki: Model<BaslangicHakkiBelgesi> = model<BaslangicHakkiBelgesi>(
  'BaslangicHakki',
  baslangicHakkiSemasi,
);
