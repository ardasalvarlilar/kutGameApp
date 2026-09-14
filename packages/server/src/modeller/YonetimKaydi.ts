// Yonetim islem kaydi — hangi admin, kime, ne yapti.
//
// Cip eklemek, hesap silmek, rol vermek geri donusu zor ya da para degerinde
// islemler. "Bu oyuncuya 5 milyon cipi kim verdi?" sorusunun cevabi olmali;
// birden fazla admin oldugunda ozellikle.
//
// Hedefin ADI bilerek saklanmiyor, yalnizca kimligi: silinen oyuncunun adi
// burada kalirsa hesap silmenin "kisisel bilgilerin silinir" sozu bozulurdu.
// Ad okunurken cozuluyor; silinmis hesap "silinmis oyuncu" gorunuyor.

import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

export const YONETIM_ISLEMLERI = [
  'cip',
  'duzenle',
  'askiya-al',
  'askidan-cikar',
  'sil',
  'sikayet',
] as const;
export type YonetimIslemi = (typeof YONETIM_ISLEMLERI)[number];

const yonetimKaydiSemasi = new Schema(
  {
    yonetici: { type: Schema.Types.ObjectId, ref: 'Oyuncu', required: true },
    islem: { type: String, enum: YONETIM_ISLEMLERI, required: true },
    /** Islemin yapildigi oyuncu (sikayet isleminde sikayet edilen). */
    hedef: { type: Schema.Types.ObjectId, ref: 'Oyuncu' },
    ayrinti: { type: String, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'yonetimKayitlari' },
);

yonetimKaydiSemasi.index({ createdAt: -1 });
yonetimKaydiSemasi.index({ hedef: 1, createdAt: -1 });

export type YonetimKaydiBelgesi = InferSchemaType<typeof yonetimKaydiSemasi>;

export const YonetimKaydi: Model<YonetimKaydiBelgesi> = model<YonetimKaydiBelgesi>(
  'YonetimKaydi',
  yonetimKaydiSemasi,
);
