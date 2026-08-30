// Sunucunun REST uclari.
//
// Oyunun kendisi soketten akiyor; burasi yalnizca giris ve profil gibi tek
// seferlik isler icin (bkz. packages/server/src/rotalar/index.ts).
//
// Hicbir fonksiyon istisna FIRLATMAZ: hepsi `{ ok, veri } | { ok, hata }`
// doner. Sebebi motorun 4 numarali kurali (CLAUDE.md) — gecersizlik bir
// sonuctur, kaza degil. Ekran da onu oyle gosteriyor.

import { API_KOKU } from './sunucu';
import type { GirisVerisi, OyuncuOzeti, Yanit } from './protokol';

/** Ag beklemesi. Uzun tutmanin anlami yok: oyuncu ekranda bekliyor. */
const ZAMAN_ASIMI_MS = 12_000;

interface Istek {
  readonly yol: string;
  readonly govde?: unknown;
  readonly jeton?: string | undefined;
  readonly yontem?: 'GET' | 'POST' | 'DELETE';
}

async function cagir<T>({ yol, govde, jeton, yontem }: Istek): Promise<Yanit<T>> {
  const iptal = new AbortController();
  const sayac = setTimeout(() => iptal.abort(), ZAMAN_ASIMI_MS);

  try {
    const yanit = await fetch(`${API_KOKU}${yol}`, {
      method: yontem ?? (govde === undefined ? 'GET' : 'POST'),
      headers: {
        ...(govde === undefined ? {} : { 'content-type': 'application/json' }),
        ...(jeton === undefined ? {} : { authorization: `Bearer ${jeton}` }),
      },
      ...(govde === undefined ? {} : { body: JSON.stringify(govde) }),
      signal: iptal.signal,
    });

    const cevap = (await yanit.json()) as { ok?: boolean; veri?: T; hata?: string };
    if (yanit.ok && cevap.ok === true && cevap.veri !== undefined) {
      return { ok: true, veri: cevap.veri };
    }
    return { ok: false, hata: cevap.hata ?? `Sunucu ${yanit.status} döndü` };
  } catch (hata) {
    // Ag hatasi ile sunucu hatasini ayirmak onemli: ilkinde "baglanti yok"
    // demek, ikincisinde sunucunun cumlesini gostermek dogru.
    const iptalMi = hata instanceof Error && hata.name === 'AbortError';
    return {
      ok: false,
      hata: iptalMi ? 'Sunucu yanıt vermedi' : 'Sunucuya bağlanılamadı — bağlantını kontrol et',
    };
  } finally {
    clearTimeout(sayac);
  }
}

export const saglik = (): Promise<Yanit<{ ayakta: boolean }>> => cagir({ yol: '/saglik' });

export const misafirGir = (cihazKimligi: string): Promise<Yanit<GirisVerisi>> =>
  cagir({ yol: '/kimlik/misafir', govde: { cihazKimligi } });

export interface KayitGirdisi {
  readonly eposta: string;
  readonly parola: string;
  readonly ad: string;
  /** Misafirken hesap aciliyorsa: ilerleme AYNI belgede kalsin diye. */
  readonly cihazKimligi?: string;
}

export const kayitOl = (girdi: KayitGirdisi): Promise<Yanit<GirisVerisi>> =>
  cagir({ yol: '/kimlik/kayit', govde: girdi });

export const girisYap = (eposta: string, parola: string): Promise<Yanit<GirisVerisi>> =>
  cagir({ yol: '/kimlik/giris', govde: { eposta, parola } });

export const beniGetir = (jeton: string): Promise<Yanit<{ oyuncu: OyuncuOzeti }>> =>
  cagir({ yol: '/kimlik/ben', jeton });

export const adiDegistir = (jeton: string, ad: string): Promise<Yanit<GirisVerisi>> =>
  cagir({ yol: '/kimlik/ad', govde: { ad }, jeton });

// --- Parola sifirlama --------------------------------------------------------
//
// Baglanti degil KOD kullaniliyor: e-postadaki baglantidan uygulamaya donmek
// derin baglanti (universal link) kurmayi gerektiriyor ve o, App Store icin
// ayri bir yapilandirma. Alti haneli kod her cihazda ayni sekilde calisiyor.

export const parolaKoduIste = (eposta: string): Promise<Yanit<{ mesaj: string }>> =>
  cagir({ yol: '/kimlik/parola-unuttum', govde: { eposta } });

export const parolayiSifirla = (
  eposta: string,
  kod: string,
  yeniParola: string,
): Promise<Yanit<GirisVerisi>> =>
  cagir({ yol: '/kimlik/parola-sifirla', govde: { eposta, kod, yeniParola } });

// --- Hesap silme (App Store 5.1.1(v)) ---------------------------------------

export const hesabiSil = (jeton: string): Promise<Yanit<{ silindi: boolean }>> =>
  cagir({ yol: '/kimlik/hesap', yontem: 'DELETE', jeton });

// --- Sikayet ve engelleme (App Store 1.2) -----------------------------------

export const SIKAYET_SEBEPLERI = [
  'uygunsuz-ad',
  'taciz',
  'hile',
  'oyunu-bozma',
  'diger',
] as const;
export type SikayetSebebi = (typeof SIKAYET_SEBEPLERI)[number];

/** Sebeplerin ekranda gorunen hali. */
export const SIKAYET_METINLERI: Record<SikayetSebebi, string> = {
  'uygunsuz-ad': 'Uygunsuz ad',
  taciz: 'Taciz / hakaret',
  hile: 'Hile',
  'oyunu-bozma': 'Oyunu kasten bozuyor',
  diger: 'Diğer',
};

export interface EngelliOzeti {
  readonly id: string;
  readonly ad: string;
}

export const sikayetEt = (
  jeton: string,
  girdi: {
    readonly oyuncuId: string;
    readonly sebep: SikayetSebebi;
    readonly aciklama?: string;
    readonly masaId?: string;
  },
): Promise<Yanit<{ bildirildi: boolean }>> =>
  cagir({ yol: '/moderasyon/sikayet', govde: girdi, jeton });

export const engelle = (
  jeton: string,
  oyuncuId: string,
): Promise<Yanit<{ engellenenler: readonly EngelliOzeti[] }>> =>
  cagir({ yol: '/moderasyon/engelle', govde: { oyuncuId }, jeton });

export const engelKaldir = (
  jeton: string,
  oyuncuId: string,
): Promise<Yanit<{ engellenenler: readonly EngelliOzeti[] }>> =>
  cagir({ yol: '/moderasyon/engel-kaldir', govde: { oyuncuId }, jeton });

export const engellenenleriGetir = (
  jeton: string,
): Promise<Yanit<{ engellenenler: readonly EngelliOzeti[] }>> =>
  cagir({ yol: '/moderasyon/engellenenler', jeton });
