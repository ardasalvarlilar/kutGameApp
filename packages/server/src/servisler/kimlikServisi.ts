// Kimlik: jeton uretme/dogrulama, misafir hesabi ve e-posta hesabi.
//
// Uc yol var, ucu de AYNI `Oyuncu` belgesine cikar:
//
//   misafirGirisi   — cihaz kimligiyle, kayit ekrani yok
//   kayitOl         — e-posta + parola ile yeni hesap
//   girisYap        — e-posta + parola ile mevcut hesap
//   misafirYukselt  — misafir oynayan oyuncu hesabini ACAR; ilerlemesi kalir
//
// Sonuncusu onemli: oyuncu once oynayip sonra hesap acabilsin diye
// (MIMARI.md §4). Misafir belgesi silinmiyor, uzerine e-posta biniyor.
//
// Parola HICBIR YERDE ham durmaz: bcrypt ozeti saklanir, alan `select: false`
// oldugu icin siradan sorgular onu getirmez bile.

import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.js';
import { Oyuncu, type OyuncuBelgesi } from '../modeller/Oyuncu.js';
import { AD_SORUN_METINLERI, adSorunu } from './adFiltresi.js';
import { hesapSilindiBildir, parolaKoduGonder } from './postaServisi.js';

/** bcrypt tur sayisi. 10 mobil girislerde ~60ms; daha yuksegi girisi yavaslatir. */
const BCRYPT_TURU = 10;

export interface JetonIcerigi {
  readonly oyuncuId: string;
}

/** Beklenen hatalar. Mesaji istemciye AYNEN gider; ic bilgi sizdirmaz. */
export class KimlikHatasi extends Error {}

// --- Girdi semalari ----------------------------------------------------------

export const misafirGirisiSemasi = z.object({
  /** Cihazin urettigi kalici kimlik. Uygulama bunu guvenli depoda saklar. */
  cihazKimligi: z.string().min(8).max(128),
  ad: z.string().trim().min(2).max(24).optional(),
});

const epostaSemasi = z
  .string()
  .trim()
  .toLowerCase()
  .email('Geçerli bir e-posta yaz')
  .max(120);

// 8 karakter alt sinir: kisa parola bcrypt'i de kurtarmaz. Ust sinir bcrypt'in
// 72 baytlik kesme davranisi yuzunden — sessizce kirpilmasindansa reddedilsin.
const parolaSemasi = z
  .string()
  .min(8, 'Parola en az 8 karakter olmalı')
  .max(72, 'Parola en fazla 72 karakter olabilir');

/**
 * Gorunen ad. Uzunluk kontrolu ZOD'da, icerik kontrolu `adFiltresi`de:
 * ikisi ayri sorular ve ayrilari ayri yerlerde durmali.
 */
const adSemasi = z
  .string()
  .trim()
  .min(2, 'Ad en az 2 harf')
  .max(24, 'Ad en fazla 24 harf')
  .superRefine((ad, ekle) => {
    const sorun = adSorunu(ad);
    if (sorun !== null) ekle.addIssue({ code: 'custom', message: AD_SORUN_METINLERI[sorun] });
  });

export { adSemasi };

export const kayitSemasi = z.object({
  eposta: epostaSemasi,
  parola: parolaSemasi,
  ad: adSemasi,
  /** Misafirken hesap aciyorsa cihaz kimligi gelir; ilerleme korunur. */
  cihazKimligi: z.string().min(8).max(128).optional(),
});

export const girisSemasi = z.object({
  eposta: epostaSemasi,
  parola: z.string().min(1).max(72),
});

export type MisafirGirisi = z.infer<typeof misafirGirisiSemasi>;
export type Kayit = z.infer<typeof kayitSemasi>;
export type Giris = z.infer<typeof girisSemasi>;

// --- Jeton -------------------------------------------------------------------

function jetonUret(oyuncuId: string): string {
  const icerik: JetonIcerigi = { oyuncuId };
  // `expiresIn` kutuphanede dar bir birlesim tipi ("30d" gibi sabitler).
  // Deger .env'de dogrulandigi icin burada daraltiyoruz.
  const omur = config.jwtOmru as NonNullable<jwt.SignOptions['expiresIn']>;
  return jwt.sign(icerik, config.jwtGizli, { expiresIn: omur });
}

/** Jetonu dogrular; gecersizse null (istisna firlatmaz). */
export function jetonuCoz(jeton: string): JetonIcerigi | null {
  try {
    const icerik = jwt.verify(jeton, config.jwtGizli);
    if (typeof icerik === 'string') return null;
    const oyuncuId = icerik['oyuncuId'];
    return typeof oyuncuId === 'string' ? { oyuncuId } : null;
  } catch {
    return null;
  }
}

// --- Ortak -------------------------------------------------------------------

/** Varsayilan ad: "Oyuncu 4F7A" gibi, cihaz kimliginden turetilir. */
function varsayilanAd(cihazKimligi: string): string {
  const kuyruk = cihazKimligi.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
  return `Oyuncu ${kuyruk || '0000'}`;
}

export interface GirisSonucu {
  readonly jeton: string;
  readonly oyuncu: OyuncuBelgesi & { readonly _id: unknown };
}

/** Istemciye giden oyuncu ozeti. Parola ozeti ve saglayicilar DISARI CIKMAZ. */
export function oyuncuOzeti(oyuncu: OyuncuBelgesi & { _id: unknown }) {
  return {
    id: String(oyuncu._id),
    ad: oyuncu.ad,
    eposta: oyuncu.eposta ?? null,
    misafirMi: oyuncu.misafirMi,
    seviye: oyuncu.ilerleme.seviye,
    jeton: oyuncu.cuzdan.jeton,
    oynananEl: oyuncu.ilerleme.oynananEl,
    kazanilanEl: oyuncu.ilerleme.kazanilanEl,
    oynananMac: oyuncu.ilerleme.oynananMac,
    kazanilanMac: oyuncu.ilerleme.kazanilanMac,
  };
}

async function misafirBul(cihazKimligi: string) {
  return Oyuncu.findOne({
    'saglayicilar.tip': 'misafir',
    'saglayicilar.disKimlik': cihazKimligi,
  });
}

// --- Misafir -----------------------------------------------------------------

/**
 * Misafir girisi. Ayni cihaz kimligi daha once geldiyse AYNI hesap doner —
 * uygulamayi her acista yeni oyuncu yaratmiyoruz.
 */
export async function misafirGirisi(girdi: MisafirGirisi): Promise<GirisSonucu> {
  const mevcut = await misafirBul(girdi.cihazKimligi);

  if (mevcut !== null) {
    mevcut.sonGorulme = new Date();
    // Ad yalnizca HALA misafirse cihazdan guncellenir: hesap acmis oyuncunun
    // sectigi adi, eski cihaz kaydi ezmemeli.
    if (girdi.ad !== undefined && mevcut.misafirMi) mevcut.ad = girdi.ad;
    await mevcut.save();
    return { jeton: jetonUret(String(mevcut._id)), oyuncu: mevcut };
  }

  const yeni = await Oyuncu.create({
    ad: girdi.ad ?? varsayilanAd(girdi.cihazKimligi),
    misafirMi: true,
    saglayicilar: [{ tip: 'misafir', disKimlik: girdi.cihazKimligi }],
  });
  return { jeton: jetonUret(String(yeni._id)), oyuncu: yeni };
}

// --- E-posta + parola --------------------------------------------------------

/**
 * Hesap acar.
 *
 * Cihaz kimligi geldiyse ve o cihazin misafir kaydi varsa YENI BELGE ACILMAZ:
 * misafirin uzerine e-posta binilir. Oyuncu oynadigi elleri kaybetmesin.
 */
export async function kayitOl(girdi: Kayit): Promise<GirisSonucu> {
  const varOlan = await Oyuncu.findOne({ eposta: girdi.eposta }).lean();
  if (varOlan !== null) throw new KimlikHatasi('Bu e-posta zaten kayıtlı');

  const ozet = await bcrypt.hash(girdi.parola, BCRYPT_TURU);

  const misafir =
    girdi.cihazKimligi === undefined ? null : await misafirBul(girdi.cihazKimligi);

  // Yukseltme: yalnizca HALA misafir olan bir belge devralinabilir. Hesap
  // acilmis bir belgeye ikinci e-posta baglamak, cihazi elinde tutan
  // birinin hesabi ele gecirmesi demek olurdu.
  if (misafir !== null && misafir.misafirMi) {
    misafir.ad = girdi.ad;
    misafir.eposta = girdi.eposta;
    misafir.parolaOzeti = ozet;
    misafir.misafirMi = false;
    misafir.saglayicilar.push({ tip: 'parola', disKimlik: girdi.eposta, eposta: girdi.eposta });
    misafir.sonGorulme = new Date();
    await misafir.save();
    return { jeton: jetonUret(String(misafir._id)), oyuncu: misafir };
  }

  const yeni = await Oyuncu.create({
    ad: girdi.ad,
    eposta: girdi.eposta,
    parolaOzeti: ozet,
    misafirMi: false,
    saglayicilar: [{ tip: 'parola', disKimlik: girdi.eposta, eposta: girdi.eposta }],
  });
  return { jeton: jetonUret(String(yeni._id)), oyuncu: yeni };
}

/**
 * Giris. Hata mesaji e-posta ile parolayi AYIRMAZ: "böyle bir e-posta yok"
 * demek, hangi adreslerin kayitli oldugunu sizdirir.
 */
export async function girisYap(girdi: Giris): Promise<GirisSonucu> {
  const oyuncu = await Oyuncu.findOne({ eposta: girdi.eposta }).select('+parolaOzeti');
  if (oyuncu === null || typeof oyuncu.parolaOzeti !== 'string') {
    // Kayitli olmayan adreste de bcrypt calistir: yanit suresinden hesabin
    // var olup olmadigi anlasilmasin.
    await bcrypt.compare(girdi.parola, '$2a$10$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    throw new KimlikHatasi('E-posta ya da parola hatalı');
  }

  const uyuyor = await bcrypt.compare(girdi.parola, oyuncu.parolaOzeti);
  if (!uyuyor) throw new KimlikHatasi('E-posta ya da parola hatalı');
  if (oyuncu.engelli) throw new KimlikHatasi('Hesabın askıya alınmış');

  oyuncu.sonGorulme = new Date();
  await oyuncu.save();
  return { jeton: jetonUret(String(oyuncu._id)), oyuncu };
}

/** Oturumu acik misafirin hesap acmasi — jetonu degismez, belgesi ayni kalir. */
export async function misafirYukselt(
  oyuncuId: string,
  girdi: Omit<Kayit, 'cihazKimligi'>,
): Promise<GirisSonucu> {
  const oyuncu = await Oyuncu.findById(oyuncuId);
  if (oyuncu === null) throw new KimlikHatasi('Oyuncu bulunamadı');
  if (!oyuncu.misafirMi) throw new KimlikHatasi('Bu hesabın zaten e-postası var');

  const varOlan = await Oyuncu.findOne({ eposta: girdi.eposta }).lean();
  if (varOlan !== null) throw new KimlikHatasi('Bu e-posta zaten kayıtlı');

  oyuncu.ad = girdi.ad;
  oyuncu.eposta = girdi.eposta;
  oyuncu.parolaOzeti = await bcrypt.hash(girdi.parola, BCRYPT_TURU);
  oyuncu.misafirMi = false;
  oyuncu.saglayicilar.push({ tip: 'parola', disKimlik: girdi.eposta, eposta: girdi.eposta });
  await oyuncu.save();
  return { jeton: jetonUret(String(oyuncu._id)), oyuncu };
}

/** Oyuncunun gorunen adini degistirir. */
export async function adiDegistir(oyuncuId: string, ad: string): Promise<GirisSonucu> {
  const oyuncu = await Oyuncu.findById(oyuncuId);
  if (oyuncu === null) throw new KimlikHatasi('Oyuncu bulunamadı');
  oyuncu.ad = ad;
  await oyuncu.save();
  return { jeton: jetonUret(String(oyuncu._id)), oyuncu };
}

// --- Parola sifirlama --------------------------------------------------------
//
// Alti haneli kod, 15 dakika, en fazla 5 deneme.
//
// Neden baglanti degil KOD: telefonda e-postadan uygulamaya donmek derin
// baglanti (universal link) kurmayi gerektiriyor ve o, App Store icin ayri bir
// yapilandirma demek. Kod her istemcide ayni sekilde calisiyor.
//
// Kodun kendisi degil OZETI saklaniyor (bcrypt): veritabani sizarsa kod tek
// basina hesabin anahtari olurdu.

export const parolaUnuttumSemasi = z.object({ eposta: epostaSemasi });

export const parolaSifirlaSemasi = z.object({
  eposta: epostaSemasi,
  kod: z.string().trim().regex(/^\d{4,8}$/, 'Kod yalnızca rakamlardan oluşur'),
  yeniParola: parolaSemasi,
});

export type ParolaUnuttum = z.infer<typeof parolaUnuttumSemasi>;
export type ParolaSifirla = z.infer<typeof parolaSifirlaSemasi>;

/** Kriptografik rastgele kod. `Math.random` burada YETMEZ — tahmin edilebilir. */
function kodUret(): string {
  const hane = config.parolaSifirlama.haneSayisi;
  const ustSinir = 10 ** hane;
  return String(randomInt(0, ustSinir)).padStart(hane, '0');
}

/**
 * Sifirlama kodu ister.
 *
 * Adres kayitli DEGILSE de sessizce basarili doner: "böyle bir e-posta yok"
 * demek, hangi adreslerin kayitli oldugunu sizdirir. Oyuncuya her durumda
 * "kutunu kontrol et" deniyor.
 *
 * `postaGitti` yalnizca CAGIRANIN gunluge yazmasi icin; istemciye gitmez.
 */
export async function parolaKoduIste(girdi: ParolaUnuttum): Promise<{ postaGitti: boolean }> {
  if (!config.posta.acikMi) {
    throw new KimlikHatasi('Parola sıfırlama şu an kullanılamıyor, destekle iletişime geç');
  }

  const oyuncu = await Oyuncu.findOne({ eposta: girdi.eposta });
  if (oyuncu === null) return { postaGitti: false };

  const kod = kodUret();
  oyuncu.set('parolaSifirlama', {
    ozet: await bcrypt.hash(kod, BCRYPT_TURU),
    sonKullanma: new Date(Date.now() + config.parolaSifirlama.omruMs),
    deneme: 0,
  });
  await oyuncu.save();

  await parolaKoduGonder(girdi.eposta, kod, oyuncu.ad);
  return { postaGitti: true };
}

/** Kodu dogrular ve parolayi degistirir. Basarili olursa oturum da acilir. */
export async function parolayiSifirla(girdi: ParolaSifirla): Promise<GirisSonucu> {
  const oyuncu = await Oyuncu.findOne({ eposta: girdi.eposta }).select('+parolaSifirlama');
  const istek = oyuncu?.parolaSifirlama;

  // Tek ve ayni mesaj: hangi adimda takildigini soylemek, kayitli adresleri
  // ve gecerli kodlari deneme yanilmayla bulmayi kolaylastirirdi.
  const gecersiz = new KimlikHatasi('Kod geçersiz ya da süresi dolmuş');

  if (oyuncu === null || istek === undefined || istek === null) throw gecersiz;
  if (istek.sonKullanma.getTime() < Date.now()) {
    oyuncu.set('parolaSifirlama', undefined);
    await oyuncu.save();
    throw gecersiz;
  }
  if (istek.deneme >= config.parolaSifirlama.enFazlaDeneme) {
    oyuncu.set('parolaSifirlama', undefined);
    await oyuncu.save();
    throw new KimlikHatasi('Çok fazla yanlış deneme — yeni bir kod iste');
  }

  const uyuyor = await bcrypt.compare(girdi.kod, istek.ozet);
  if (!uyuyor) {
    istek.deneme += 1;
    await oyuncu.save();
    throw gecersiz;
  }

  oyuncu.parolaOzeti = await bcrypt.hash(girdi.yeniParola, BCRYPT_TURU);
  oyuncu.set('parolaSifirlama', undefined);
  oyuncu.sonGorulme = new Date();
  await oyuncu.save();
  return { jeton: jetonUret(String(oyuncu._id)), oyuncu };
}

// --- Hesap silme -------------------------------------------------------------

/**
 * Hesabi ve kisisel verileri SILER.
 *
 * App Store Review Guideline 5.1.1(v): hesap acilmasina izin veren her
 * uygulama, hesabin uygulama ICINDEN silinmesine de izin vermek zorunda.
 * "Bize e-posta at" yetmiyor, denetimde ret sebebi.
 *
 * El kayitlari (modeller/ElKaydi.ts) SILINMIYOR: icinde kisisel veri yok,
 * yalnizca oynanmis tas dizisi ve artik hicbir belgeye cozulmeyen bir kimlik.
 * Silinmeleri, o eldeki diger uc oyuncunun mac gecmisini de yok ederdi.
 */
export async function hesabiSil(oyuncuId: string): Promise<void> {
  const oyuncu = await Oyuncu.findById(oyuncuId);
  if (oyuncu === null) throw new KimlikHatasi('Oyuncu bulunamadı');

  const eposta = oyuncu.eposta ?? null;
  const ad = oyuncu.ad;

  await Oyuncu.deleteOne({ _id: oyuncu._id });
  // Baskalarinin engelli listesinde asili kalmasin.
  await Oyuncu.updateMany({ engellenenler: oyuncu._id }, { $pull: { engellenenler: oyuncu._id } });

  if (eposta !== null) await hesapSilindiBildir(eposta, ad);
}
