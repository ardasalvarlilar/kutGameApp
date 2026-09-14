// Cip hareketi — bakiyedeki her artis ve azalis.
//
// MIMARI.md §5.5: "her artis ve azalis kayitli olmali — destek ve itiraz
// icin." "Cipim nereye gitti?" sorusunun tek cevabi bu koleksiyon. Bakiye
// `Oyuncu.cuzdan.cip`te duruyor; burasi onun defteri.
//
// `bakiye` hareketten SONRAKI bakiye: defteri bastan toplamadan bir anin
// resmini verebilsin diye.

import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

export const CIP_SEBEPLERI = [
  'baslangic',
  'masa-giris',
  'masa-odulu',
  'masa-iadesi',
  'satin-alma',
  'hediye',
  'reklam-odulu',
  'yonetici',
] as const;
export type CipSebebi = (typeof CIP_SEBEPLERI)[number];

const cipHareketiSemasi = new Schema(
  {
    oyuncu: { type: Schema.Types.ObjectId, ref: 'Oyuncu', required: true },
    /** Isaretli: giris eksi, odul arti. */
    miktar: { type: Number, required: true },
    sebep: { type: String, enum: CIP_SEBEPLERI, required: true },
    masa: { type: Schema.Types.ObjectId, ref: 'Masa' },
    bakiye: { type: Number, required: true },
    /** Yonetici elle ekleyip cikardiysa gerekcesi; "bu cip nereden geldi" sorusu icin. */
    aciklama: { type: String, maxlength: 200 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'cipHareketleri' },
);

cipHareketiSemasi.index({ oyuncu: 1, createdAt: -1 });

export type CipHareketiBelgesi = InferSchemaType<typeof cipHareketiSemasi>;

export const CipHareketi: Model<CipHareketiBelgesi> = model<CipHareketiBelgesi>(
  'CipHareketi',
  cipHareketiSemasi,
);
