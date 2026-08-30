// Oyuncu sikayeti.
//
// App Store Review Guideline 1.2 (kullanici uretimi icerik) sikayet YOLU
// istiyor. Bu oyunda sohbet yok; kullanicidan gelen tek serbest metin
// GORUNEN AD. Yine de taciz kanali odur ve bir de oyun ici davranis var
// (kasten yavas oynamak, masayi kilitlemek).
//
// Kayit tutuluyor cunku "sikayet dugmesi var ama hicbir yere gitmiyor"
// denetimde kabul edilmiyor: sikayetin bir yere DUSMESI ve bakilabilmesi
// gerekiyor. Bakma isi bugun elle: `db.sikayetler.find({ durum: 'yeni' })`.

import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

export const SIKAYET_SEBEPLERI = [
  'uygunsuz-ad',
  'taciz',
  'hile',
  'oyunu-bozma',
  'diger',
] as const;
export type SikayetSebebi = (typeof SIKAYET_SEBEPLERI)[number];

export const SIKAYET_DURUMLARI = ['yeni', 'incelendi', 'islem-yapildi'] as const;

const sikayetSemasi = new Schema(
  {
    sikayetEden: { type: Schema.Types.ObjectId, ref: 'Oyuncu', required: true, index: true },
    sikayetEdilen: { type: Schema.Types.ObjectId, ref: 'Oyuncu', required: true, index: true },
    sebep: { type: String, enum: SIKAYET_SEBEPLERI, required: true },
    /** Oyuncunun yazdigi aciklama; istege bagli. */
    aciklama: { type: String, maxlength: 500 },
    /** Sikayet aninda sikayet edilenin adi — sonradan degistirse de kalsin. */
    oAndakiAd: { type: String, required: true },
    masa: { type: Schema.Types.ObjectId, ref: 'Masa' },
    durum: { type: String, enum: SIKAYET_DURUMLARI, required: true, default: 'yeni' },
  },
  { timestamps: true, collection: 'sikayetler' },
);

// Ayni kisiyi arka arkaya bildirip kayit sismesin: gunde bir kez yeter.
// Kismi indeks degil, uygulama katmani kontrol ediyor (moderasyonServisi).
sikayetSemasi.index({ sikayetEden: 1, sikayetEdilen: 1, createdAt: -1 });

export type SikayetBelgesi = InferSchemaType<typeof sikayetSemasi>;

export const Sikayet: Model<SikayetBelgesi> = model<SikayetBelgesi>('Sikayet', sikayetSemasi);
