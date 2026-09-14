// Reklam fisi — "reklam izlersen su kadar ek cip" sozunun kaydi.
//
// Hediye toplaninca sunucu bir fis kesiyor. Istemci reklami gosterirken fisin
// kimligini reklam agina `custom_data` olarak veriyor; reklam izlenince AG
// (istemci degil) sunucuya imzali bir geri cagri yapiyor, sunucu imzayi
// dogrulayip fisi bozduruyor (servisler/reklamServisi.ts).
//
// Istemciye neden guvenmiyoruz: "reklami izledim" diyen bir istek herkes
// tarafindan sonsuz kez gonderilebilirdi. Fis tek kullanimlik ve suresi var.

import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

export const FIS_DURUMLARI = ['bekliyor', 'bozduruldu'] as const;

const reklamFisiSemasi = new Schema(
  {
    oyuncu: { type: Schema.Types.ObjectId, ref: 'Oyuncu', required: true },
    /** Reklam izlenince eklenecek cip. */
    ekMiktar: { type: Number, required: true, min: 0 },
    durum: { type: String, enum: FIS_DURUMLARI, required: true, default: 'bekliyor' },
    sonKullanma: { type: Date, required: true },
    /** Reklam aginin islem kimligi; ayni geri cagri iki kez gelirse diye. */
    islemKimligi: { type: String },
  },
  { timestamps: true, collection: 'reklamFisleri' },
);

reklamFisiSemasi.index({ islemKimligi: 1 }, { unique: true, sparse: true });
// Kullanilmayan fisler birikmesin: suresi gecenleri bir gun sonra Mongo siler.
reklamFisiSemasi.index({ sonKullanma: 1 }, { expireAfterSeconds: 24 * 3600 });

export type ReklamFisiBelgesi = InferSchemaType<typeof reklamFisiSemasi>;

export const ReklamFisi: Model<ReklamFisiBelgesi> = model<ReklamFisiBelgesi>(
  'ReklamFisi',
  reklamFisiSemasi,
);
