// Oynanmis bir elin kaydi.
//
// Bu koleksiyon motorun 2 numarali tasarim kuralinin (CLAUDE.md) karsiligi:
// motorda rastgelelik yok, tohum disaridan geliyor. Dolayisiyla
// `tohum + aksiyonlar` bir eli BIREBIR yeniden kurar.
//
// Ne ise yarar:
//  - hata ayiklama: "su elde ne oldu?" sorusu tek kayittan cevaplanir
//  - itiraz cozumu: "hile yapti" tartismasi kayittan bakilir
//  - tekrar izleme: el yeniden oynatilabilir
//
// Aksiyonlar ham JSON olarak duruyor; motorun `Aksiyon` tipini Mongo semasina
// cevirmek, tip her degistiginde iki yeri birden guncellemek demek olurdu.

import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

const elKaydiSemasi = new Schema(
  {
    masa: { type: Schema.Types.ObjectId, ref: 'Masa', required: true, index: true },
    tur: { type: Number, required: true, min: 1, max: 16 },

    /** Karistirma tohumu — elin yeniden kurulmasi icin sart. */
    tohum: { type: Number, required: true },
    /** Eli baslatan koltuk. */
    baslayan: { type: Number, required: true, min: 0, max: 3 },
    /** Koltuk sirasina gore oyuncular; kayit sonradan okunacaksa gerekli. */
    oturanlar: { type: [Schema.Types.ObjectId], ref: 'Oyuncu', required: true },

    /** Motora gonderilen aksiyonlar, sirasiyla. */
    aksiyonlar: { type: [Schema.Types.Mixed], required: true, default: [] },
    /** `ElSonucu` — puanlar, kazanan, carpanlar. */
    sonuc: { type: Schema.Types.Mixed },
  },
  { timestamps: true, collection: 'elKayitlari' },
);

export type ElKaydiBelgesi = InferSchemaType<typeof elKaydiSemasi>;

export const ElKaydi: Model<ElKaydiBelgesi> = model<ElKaydiBelgesi>('ElKaydi', elKaydiSemasi);
