// Kalici kucuk veri: oturum jetonu ve cihaz kimligi.
//
// Native'de `expo-secure-store` (iOS Keychain / Android Keystore), web
// onizlemesinde `localStorage`. Ikisi ayni arayuzun arkasinda: cagiran
// hangisi oldugunu bilmiyor.
//
// Neden guvenli depo: jeton 30 gun gecerli ve tek basina hesabin ta kendisi.
// Duz dosyada tutmak, cihazi eline geciren birine hesabi vermek demek.

import * as GuvenliDepo from 'expo-secure-store';
import { Platform } from 'react-native';

const JETON_ANAHTARI = 'kut.jeton';
const CIHAZ_ANAHTARI = 'kut.cihaz';
const DIL_ANAHTARI = 'kut.dil';
const OGRETICI_ANAHTARI = 'kut.ogreticiSoruldu';

const webMi = Platform.OS === 'web';

async function oku(anahtar: string): Promise<string | null> {
  try {
    if (webMi) return globalThis.localStorage?.getItem(anahtar) ?? null;
    return await GuvenliDepo.getItemAsync(anahtar);
  } catch {
    // Depo okunamiyorsa (izin yok, tarayici gizli mod) oturum yok sayilir;
    // oyuncu yeniden giris yapar. Cokmesindense boyle.
    return null;
  }
}

async function yaz(anahtar: string, deger: string): Promise<void> {
  try {
    if (webMi) globalThis.localStorage?.setItem(anahtar, deger);
    else await GuvenliDepo.setItemAsync(anahtar, deger);
  } catch {
    // Yazilamadiysa oturum bu acilisla sinirli kalir; oyun yine calisir.
  }
}

async function sil(anahtar: string): Promise<void> {
  try {
    if (webMi) globalThis.localStorage?.removeItem(anahtar);
    else await GuvenliDepo.deleteItemAsync(anahtar);
  } catch {
    // Yoksa zaten silinmis sayilir.
  }
}

export const jetonuOku = (): Promise<string | null> => oku(JETON_ANAHTARI);
export const jetonuYaz = (jeton: string): Promise<void> => yaz(JETON_ANAHTARI, jeton);
export const jetonuSil = (): Promise<void> => sil(JETON_ANAHTARI);

/**
 * Dil tercihi — CIHAZDA duruyor, hesapta degil.
 *
 * Dil, hesabin degil o telefonun ozelligi: ayni hesaba baska bir cihazdan
 * girildiginde oranin dilini degistirmek istemiyoruz. Sunucuya da tasimak
 * gerekmiyor; hata kodlarini istemci ceviriyor (`hataMetinleri.ts`).
 */
export const diliOku = (): Promise<string | null> => oku(DIL_ANAHTARI);
export const diliYaz = (dil: string): Promise<void> => yaz(DIL_ANAHTARI, dil);

/**
 * Ogretici DAHA ONCE SORULDU MU — cihazda, hesapta degil.
 *
 * Saklanan sey "ogreticiyi izledi mi" degil "soruldu mu": hayir diyen
 * oyuncuya her alistirmada tekrar sormak sinir bozucu olurdu. Fikri
 * degisenin yolu Ayarlar'daki "Ogreticiyi oynat".
 */
export const ogreticiSorulduMu = async (): Promise<boolean> =>
  (await oku(OGRETICI_ANAHTARI)) !== null;
export const ogreticiSorulduYaz = (): Promise<void> => yaz(OGRETICI_ANAHTARI, 'evet');

/**
 * Cihaz kimligi — misafir hesabinin tek baglantisi.
 *
 * Uygulama silinip yeniden kurulursa bu kimlik de gider ve misafir oyuncu
 * ilerlemesini kaybeder. Kaybetmemenin yolu hesap acmak; uygulama bunu
 * lobide soyluyor.
 */
export async function cihazKimligi(): Promise<string> {
  const mevcut = await oku(CIHAZ_ANAHTARI);
  if (mevcut !== null && mevcut.length >= 8) return mevcut;

  // Sunucu bunu yalnizca ARAMA ANAHTARI olarak kullaniyor, sir olarak degil;
  // `Math.random` yeterli. (Motorda rastgelelik yasak — burasi motor degil.)
  const yeni = `cihaz-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  await yaz(CIHAZ_ANAHTARI, yeni);
  return yeni;
}
