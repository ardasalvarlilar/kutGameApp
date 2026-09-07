// Oyuncu hesabi.
//
// Iki giris yolu var ve ikisi de AYNI belgeye yaziyor:
//
//   misafir  — cihaz kendine bir kimlik uretir, kayit ekrani yok
//   parola   — e-posta + parola; oyuncu hesabini baska cihazda da acabilir
//
// `saglayicilar` bir DIZI oldugu icin misafir hesabi silinmeden uzerine
// e-posta binebilir (`misafirYukselt`): oyuncu ilerlemesini kaybetmez.
// Google/Apple sonradan ayni sekilde eklenecek.
//
// MIMARI.md §4 e-posta+parolayi "sonraya" birakmisti; karar degisti, cunku
// arkadaslar iki cihazda ayni hesapla girmek istiyor. Not orada guncellendi.
//
// `cuzdan` ve `ilerleme` MVP'de OKUNMUYOR ama simdiden duruyorlar: sonradan
// alan eklemek, uzerinde veri olan bir koleksiyonda gocmen isi cikarir.

import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

export const SAGLAYICILAR = ['misafir', 'parola', 'google', 'apple'] as const;
export type Saglayici = (typeof SAGLAYICILAR)[number];

const saglayiciSemasi = new Schema(
  {
    tip: { type: String, enum: SAGLAYICILAR, required: true },
    /** Saglayicinin verdigi benzersiz kimlik (misafirde cihaz, parolada e-posta). */
    disKimlik: { type: String, required: true },
    /** Dogrulanmis e-posta; misafirde yok. */
    eposta: { type: String },
  },
  { _id: false },
);

const cuzdanSemasi = new Schema(
  {
    /** Oyun ici jeton. Gercek paraya CEVRILEMEZ — bu ayrim hukuki. */
    jeton: { type: Number, required: true, default: 0, min: 0 },
    /** Satin alinan toplam jeton; istatistik ve destek icin. */
    toplamAlinan: { type: Number, required: true, default: 0, min: 0 },
  },
  { _id: false },
);

const ilerlemeSemasi = new Schema(
  {
    seviye: { type: Number, required: true, default: 1, min: 1 },
    deneyim: { type: Number, required: true, default: 0, min: 0 },
    oynananEl: { type: Number, required: true, default: 0, min: 0 },
    kazanilanEl: { type: Number, required: true, default: 0, min: 0 },
    oynananMac: { type: Number, required: true, default: 0, min: 0 },
    kazanilanMac: { type: Number, required: true, default: 0, min: 0 },
  },
  { _id: false },
);

// Parola sifirlama kodu.
//
// Kodun KENDISI degil OZETI saklaniyor: veritabani bir sekilde okunursa
// (yedek dosyasi, sizinti) kod tek basina hesabin anahtari olurdu.
// `deneme` sayaci kaba kuvvete karsi — alti haneli kod, sinirsiz denemeyle
// bir dakikada kirilir.
const parolaSifirlamaSemasi = new Schema(
  {
    ozet: { type: String, required: true },
    sonKullanma: { type: Date, required: true },
    deneme: { type: Number, required: true, default: 0, min: 0 },
  },
  { _id: false },
);

// Push bildirimi jetonu.
//
// Jeton CIHAZI temsil eder, hesabi degil: ayni telefondan baska bir hesaba
// girilirse jeton o hesaba TASINMALI, kopyalanmamali. Kopyalansaydi bildirim
// eski sahibinin adina o telefona dusmeye devam ederdi — baskasinin oyun
// bilgisi yabancinin kilit ekraninda gorunurdu. Tasimayi `jetonKaydet`
// yapiyor (bkz. servisler/bildirimServisi.ts).
export const BILDIRIM_PLATFORMLARI = ['ios', 'android', 'web'] as const;
export type BildirimPlatformu = (typeof BILDIRIM_PLATFORMLARI)[number];

const bildirimJetonuSemasi = new Schema(
  {
    /** Expo'nun verdigi jeton: "ExponentPushToken[...]". */
    jeton: { type: String, required: true },
    platform: { type: String, enum: BILDIRIM_PLATFORMLARI, required: true },
    /** Son kayit/tazeleme ani; en eskiler sinir asilinca atilir. */
    sonKullanim: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const oyuncuSemasi = new Schema(
  {
    ad: { type: String, required: true, trim: true, minlength: 2, maxlength: 24 },
    avatar: { type: String },

    /**
     * Kucuk harfe indirgenmis e-posta. Yalnizca parola hesaplarinda dolu.
     * Ayri alan olarak duruyor cunku BENZERSIZ indeks gerekiyor; dizinin
     * icindeki alana tekil indeks koymak kismi indekse zorluyor.
     */
    eposta: { type: String, lowercase: true, trim: true },
    /** bcrypt ozeti. Ham parola HICBIR YERDE saklanmaz, gunluge de yazilmaz. */
    parolaOzeti: { type: String, select: false },
    /** Misafirken hesap acilirsa false'a doner; istemci "hesabin var" der. */
    misafirMi: { type: Boolean, required: true, default: true },

    /**
     * ARKADAS KODU — "KUT-7F3A9" gibi. Baskasinin seni bulmasinin yolu bu.
     *
     * Neden ad ya da e-posta ile aranmiyor:
     *  - Gorunen ad benzersiz DEGIL; "Ahmet" yazan on kisi cikiyor ve
     *    hangisinin arkadasin oldugunu ayirt etmenin yolu yok.
     *  - E-posta ile aramak, girilen adresin kayitli olup olmadigini
     *    sizdirir; adres toplamanin en kolay yolu olurdu.
     *
     * Kod paylasmak iradi bir hareket: kodu veren zaten bulunmak istiyor.
     * Alan `sparse` cunku eski belgelerde yok; ilk istendiginde uretiliyor
     * (servisler/arkadasServisi.ts).
     */
    arkadasKodu: { type: String },

    saglayicilar: { type: [saglayiciSemasi], required: true, default: [] },

    // --- Jeton ekonomisi (MVP'de kullanilmiyor, bkz. MIMARI.md) --------------
    cuzdan: { type: cuzdanSemasi, required: true, default: () => ({}) },
    ilerleme: { type: ilerlemeSemasi, required: true, default: () => ({}) },

    /** Sifreyi unutana gonderilen kodun ozeti; `select: false`. */
    parolaSifirlama: { type: parolaSifirlamaSemasi, select: false },

    /**
     * Bu oyuncunun ENGELLEDIGI oyuncular (App Store 1.2).
     *
     * Etkisi: hizli eslesmede ayni masaya dusmezler ve engellenen, engelleyenin
     * masasina kodla da katilamaz. Oyunda sohbet yok; taciz kanali gorunen ad
     * oldugu icin engelleme "bir daha karsima cikmasin" demek.
     */
    engellenenler: { type: [Schema.Types.ObjectId], ref: 'Oyuncu', required: true, default: [] },

    /**
     * Push bildirimi gonderilecek cihazlar. Bir oyuncunun birden cok cihazi
     * olabilir (telefon + tablet), bu yuzden dizi.
     */
    bildirimJetonlari: { type: [bildirimJetonuSemasi], required: true, default: [] },

    /** Kotu davranis icin; true ise masaya oturamaz. */
    engelli: { type: Boolean, required: true, default: false },
    sonGorulme: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true, collection: 'oyuncular' },
);

// Ayni saglayici + dis kimlik ikilisi bir kez bulunabilir.
oyuncuSemasi.index(
  { 'saglayicilar.tip': 1, 'saglayicilar.disKimlik': 1 },
  { unique: true, sparse: true },
);

// Arkadas kodu benzersiz. `sparse`: kodu henuz uretilmemis belgeler var ve
// null'lar birbiriyle carpismamali.
oyuncuSemasi.index({ arkadasKodu: 1 }, { unique: true, sparse: true });

// E-posta bir kez kayit olabilir. `partialFilterExpression` sart: misafir
// hesaplarinda alan YOK, `sparse` cok belgede null'a izin verse de kismi
// filtre niyeti acikca yaziyor.
oyuncuSemasi.index(
  { eposta: 1 },
  { unique: true, partialFilterExpression: { eposta: { $type: 'string' } } },
);

export type OyuncuBelgesi = InferSchemaType<typeof oyuncuSemasi>;

export const Oyuncu: Model<OyuncuBelgesi> = model<OyuncuBelgesi>('Oyuncu', oyuncuSemasi);
