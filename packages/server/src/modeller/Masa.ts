// Masa (oda) kaydi.
//
// DIKKAT: oyunun CANLI durumu burada TUTULMAZ. `OyunDurumu` sunucunun
// belleginde durur (src/servisler/oyunServisi.ts); Mongo yalnizca masanin
// kimligini, kimlerin oturdugunu ve ayarlarini biliyor. Sebebi: canli durum
// saniyede birkac kez degisiyor, her degisimde yazmak hem gereksiz hem yavas.
// Kalici olmasi gereken sey el KAYDI (bkz. ElKaydi) — ondan her el yeniden
// kurulabiliyor.

import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

export const MASA_DURUMLARI = ['bekliyor', 'oynaniyor', 'bitti'] as const;
export type MasaDurumu = (typeof MASA_DURUMLARI)[number];

const koltukSemasi = new Schema(
  {
    /** 0..3 — motorun `OyuncuId`si. */
    no: { type: Number, required: true, min: 0, max: 3 },
    oyuncu: { type: Schema.Types.ObjectId, ref: 'Oyuncu', required: true },
    hazir: { type: Boolean, required: true, default: false },
  },
  { _id: false },
);

const masaSemasi = new Schema(
  {
    /** Arkadasa soylenecek kisa kod: "4F7A". Benzersiz. */
    kod: { type: String, required: true, unique: true, uppercase: true, trim: true },
    sahip: { type: Schema.Types.ObjectId, ref: 'Oyuncu', required: true },
    durum: { type: String, enum: MASA_DURUMLARI, required: true, default: 'bekliyor' },
    /** Kodu bilmeyen goremez. MVP'de hepsi ozel. */
    ozel: { type: Boolean, required: true, default: true },

    koltuklar: { type: [koltukSemasi], required: true, default: [] },

    /** Kacinci turdayiz (1..16). Mac bitince `durum` 'bitti' olur. */
    tur: { type: Number, required: true, default: 1, min: 1, max: 16 },
    /** Mac boyu birikmis puanlar; anahtar koltuk numarasi. */
    puanlar: { type: Map, of: Number, required: true, default: {} },

    // --- Jeton ekonomisi (MVP'de 0, bkz. MIMARI.md) --------------------------
    /** Masaya oturmak icin gereken jeton. 0 = bedava masa. */
    giris: { type: Number, required: true, default: 0, min: 0 },

    kapanmaZamani: { type: Date },
  },
  { timestamps: true, collection: 'masalar' },
);

// Bos masalar birikmesin: kapanma zamani gelmis kayitlari Mongo siler.
// Alan yoksa belge hic silinmez — oynanan masa kendiliginden kaybolmaz.
masaSemasi.index({ kapanmaZamani: 1 }, { expireAfterSeconds: 0 });

export type MasaBelgesi = InferSchemaType<typeof masaSemasi>;

export const Masa: Model<MasaBelgesi> = model<MasaBelgesi>('Masa', masaSemasi);
