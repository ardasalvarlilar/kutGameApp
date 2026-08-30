// Butun ortam degiskenleri BURADAN gecer.
//
// Kural: hicbir dosya `process.env`e dogrudan bakmaz. Yeni bir degisken
// eklerken tek yapilacak sey buraya bir satir eklemek; kullanan dosyalar
// `import { config } from './config'` der ve tipli deger alir.
//
// Degiskenler acilista BIR KEZ dogrulanir. Eksik ya da bozuk bir deger varsa
// sunucu ayaga kalkmadan, ne yapilmasi gerektigini soyleyerek durur — yarim
// yapilandirmayla calisip saatler sonra tuhaf bir hata vermesindense.

import { config as ortamiYukle } from 'dotenv';
import { z } from 'zod';

ortamiYukle();

/** Virgulle ayrilmis listeyi diziye cevirir; bos girdide bos dizi. */
const listeye = (ham: string | undefined): string[] =>
  (ham ?? '')
    .split(',')
    .map((parca) => parca.trim())
    .filter((parca) => parca.length > 0);

const sema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_KAYNAKLARI: z.string().optional(),

  MONGO_URI: z.string().min(1, 'MONGO_URI gerekli — .env dosyasina ekle'),

  JWT_GIZLI: z
    .string()
    .min(32, 'JWT_GIZLI en az 32 karakter olmali; kisa anahtar kirilabilir'),
  JWT_OMRU: z.string().default('30d'),

  // --- Uygulama kimligi ------------------------------------------------------
  // Gizlilik/kosullar sayfalari ve e-postalar bu degerleri kullaniyor.
  // App Store, gizlilik politikasi ve destek adresi ISTIYOR; ikisi de burada
  // uretilen sayfalardan geliyor (rotalar/sayfalar.ts).
  UYGULAMA_ADI: z.string().default('Küt'),
  ALAN_ADI: z.string().default('localhost:4000'),
  DESTEK_EPOSTA: z.string().default(''),

  // --- E-posta (parola sifirlama) -------------------------------------------
  // Hepsi ISTEGE BAGLI: bos birakilirsa sunucu yine acilir, yalnizca parola
  // sifirlama calismaz ve oyuncuya bunu soyleyen bir hata doner. Sebep:
  // e-posta ayari eksik diye butun oyunun ayaga kalkmamasi sacma olurdu.
  SMTP_SUNUCU: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_GUVENLI: z
    .enum(['true', 'false'])
    .default('true')
    .transform((deger) => deger === 'true'),
  SMTP_KULLANICI: z.string().optional(),
  SMTP_SIFRE: z.string().optional(),
  /** Gonderen adresi; bos ise SMTP_KULLANICI kullanilir. */
  SMTP_GONDEREN: z.string().optional(),
});

const sonuc = sema.safeParse(process.env);

if (!sonuc.success) {
  const satirlar = sonuc.error.issues.map((sorun) => `  - ${sorun.path.join('.')}: ${sorun.message}`);
  throw new Error(
    ['Ortam degiskenleri eksik ya da hatali:', ...satirlar, '', 'Ornek icin .env.example dosyasina bak.'].join(
      '\n',
    ),
  );
}

const ham = sonuc.data;

export const config = {
  port: ham.PORT,
  ortam: ham.NODE_ENV,
  uretimMi: ham.NODE_ENV === 'production',

  corsKaynaklari: listeye(ham.CORS_KAYNAKLARI),

  mongoUri: ham.MONGO_URI,

  jwtGizli: ham.JWT_GIZLI,
  jwtOmru: ham.JWT_OMRU,

  uygulamaAdi: ham.UYGULAMA_ADI,
  alanAdi: ham.ALAN_ADI,
  destekEposta: ham.DESTEK_EPOSTA,

  posta: {
    /** Ayarli mi? Degilse parola sifirlama kapali kalir. */
    acikMi: (ham.SMTP_SUNUCU ?? '') !== '' && (ham.SMTP_KULLANICI ?? '') !== '',
    sunucu: ham.SMTP_SUNUCU ?? '',
    port: ham.SMTP_PORT,
    guvenli: ham.SMTP_GUVENLI,
    kullanici: ham.SMTP_KULLANICI ?? '',
    sifre: ham.SMTP_SIFRE ?? '',
    gonderen: ham.SMTP_GONDEREN ?? ham.SMTP_KULLANICI ?? '',
  },

  // --- Oyun ayarlari ---------------------------------------------------------
  // Motorun `KuralAyarlari`ndan AYRI: bunlar odanin isleyisiyle ilgili,
  // kuralla degil. Kural ayarlari KURALLAR.md'den gelir ve motordadir.
  oda: {
    /** Masa kodunun uzunlugu. Kisa olsun ki sesli soylenebilsin. */
    kodUzunlugu: 4,
    /** Bos masa bu kadar sure sonra silinir (ms). */
    bosMasaOmruMs: 10 * 60 * 1000,
    /** Kopan oyuncu bu kadar sure koltugunu korur (ms). */
    yenidenBaglanmaSuresiMs: 2 * 60 * 1000,
  },

  // --- Parola sifirlama ------------------------------------------------------
  parolaSifirlama: {
    /** Kodun gecerlilik suresi. Kisa: kod e-postada duruyor. */
    omruMs: 15 * 60 * 1000,
    /** Kac yanlis denemeden sonra kod yanar. Kaba kuvvete karsi. */
    enFazlaDeneme: 5,
    /** Kac hane? Alti hane telefonda yazilabilir, 10^6 deneme sinirla yeterli. */
    haneSayisi: 6,
  },
} as const;

export type Config = typeof config;
