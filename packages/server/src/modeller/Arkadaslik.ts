// Arkadaslik.
//
// --- Neden AYRI bir koleksiyon -----------------------------------------------
//
// Engel listesi `Oyuncu.engellenenler` icinde bir dizi olarak duruyor ve
// orada dogru duruyor: engelleme TEK TARAFLI bir karar, karsi tarafin
// onayina ihtiyaci yok. Arkadaslik ise IKI TARAFLI — bir istek var, bir de
// cevap. Bunu iki belgeye dagitmak ("A'nin giden listesi" + "B'nin gelen
// listesi") ayni gercegi iki yerde tutmak demek; biri yazilip digeri
// yazilamadiginda istek tek tarafta asili kaliyor.
//
// --- Neden CIFT basina TEK belge --------------------------------------------
//
// Istek basina belge (A→B ayri, B→A ayri) klasik bir yaris kapisi aciyor:
// iki kisi ayni anda birbirine istek atarsa iki ayri "bekliyor" belgesi
// olusuyor ve ikisi de karsi tarafi kabul etmeyi bekliyor.
//
// Bunun yerine cift, kimliklerin metin siralamasiyla NORMALLESTIRILIYOR
// (`kucuk` daima buyugunden once) ve uzerinde BENZERSIZ indeks var. Yon
// bilgisi `isteyen` alaninda duruyor. Boylece iki yonlu istek ayni belgeye
// yaziliyor ve ikinci istek "zaten var" ile karsilasiyor — ki bu durumda
// dogru davranis zaten kabul etmektir (bkz. arkadasServisi.istekGonder).

import { Schema, model, type InferSchemaType, type Model, type Types } from 'mongoose';

export const ARKADASLIK_DURUMLARI = ['bekliyor', 'arkadas'] as const;
export type ArkadaslikDurumu = (typeof ARKADASLIK_DURUMLARI)[number];

const arkadaslikSemasi = new Schema(
  {
    /** Ciftin metin siralamasinda KUCUK olan kimligi. */
    kucuk: { type: Schema.Types.ObjectId, ref: 'Oyuncu', required: true },
    /** Ciftin metin siralamasinda BUYUK olan kimligi. */
    buyuk: { type: Schema.Types.ObjectId, ref: 'Oyuncu', required: true },
    /** Istegi kim atti — `kucuk` ya da `buyuk`tan biri. Cevap veren digeri. */
    isteyen: { type: Schema.Types.ObjectId, ref: 'Oyuncu', required: true },
    durum: { type: String, enum: ARKADASLIK_DURUMLARI, required: true, default: 'bekliyor' },
    /** Kabul ani; `durum: 'arkadas'` olunca dolar. */
    kabulZamani: { type: Date },
  },
  { timestamps: true, collection: 'arkadasliklar' },
);

// Bir cift bir kez bulunabilir. Yarisi burasi cozuyor: iki taraf ayni anda
// istek atarsa ikincisi E11000 alir ve servis onu "karsi taraf zaten
// istemis" diye okuyup arkadasliga cevirir.
arkadaslikSemasi.index({ kucuk: 1, buyuk: 1 }, { unique: true });

// "Bana gelen istekler" ve "arkadaslarim" sorgularinin ikisi de bu iki
// alandan biri uzerinden geliyor.
arkadaslikSemasi.index({ kucuk: 1, durum: 1 });
arkadaslikSemasi.index({ buyuk: 1, durum: 1 });

export type ArkadaslikBelgesi = InferSchemaType<typeof arkadaslikSemasi>;

export const Arkadaslik: Model<ArkadaslikBelgesi> = model<ArkadaslikBelgesi>(
  'Arkadaslik',
  arkadaslikSemasi,
);

/**
 * Ciftin normal hali: iki kimligi metin sirasina koyar.
 *
 * Siralama olcutu ONEMSIZ, TUTARLI olmasi onemli: hangi tarafin once
 * yazildigi degismedigi surece benzersiz indeks isini goruyor.
 */
export function ciftiNormalle(
  bir: Types.ObjectId,
  iki: Types.ObjectId,
): { readonly kucuk: Types.ObjectId; readonly buyuk: Types.ObjectId } {
  return String(bir) < String(iki) ? { kucuk: bir, buyuk: iki } : { kucuk: iki, buyuk: bir };
}
