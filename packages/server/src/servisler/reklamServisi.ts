// Odullu reklam — sunucu tarafi dogrulama (AdMob SSV).
//
// Akis:
//   1. Oyuncu hediyeyi toplar; sunucu bir REKLAM FISI keser (cuzdanServisi).
//   2. Istemci reklami gosterirken fis kimligini `custom_data`, oyuncu
//      kimligini `user_id` olarak reklam SDK'sina verir.
//   3. Reklam izlenince Google, sunucunun `/api/reklam/admob` ucunu IMZALI
//      bir GET ile cagirir. Imza dogrulanir, fis tek seferlik bozdurulur.
//
// Neden istemciye guvenmiyoruz: "reklami izledim" diyen bir istek sahte
// gonderilebilir. Imzayi yalnizca Google atabilir; fis ise tek kullanimlik ve
// suresi var. Ayni geri cagri iki kez gelirse (`transaction_id`) ikincisi
// cip vermez.
//
// Imza bicimi (Google'in belgesi): sorgu metninin `&signature=` oncesindeki
// kismi, ECDSA-SHA256 ile imzalanir; imza base64url, `key_id` Google'in
// yayinladigi acik anahtarlardan birini gosterir.

import { createPublicKey, verify } from 'node:crypto';
import { Types } from 'mongoose';
import { ReklamFisi } from '../modeller/ReklamFisi.js';
import { cipEkle } from './cuzdanServisi.js';
import { kayit } from '../kayit.js';

const ANAHTAR_ADRESI = 'https://www.gstatic.com/admob/reward/verifier-keys.json';
const ANAHTAR_OMRU_MS = 24 * 3600 * 1000;

/** key_id -> PEM acik anahtar. */
export type AnahtarSeti = ReadonlyMap<string, string>;

/** Imza gecerli mi? Saf: anahtarlar disaridan veriliyor (testte uretilen). */
export function imzaDogruMu(sorgu: string, anahtarlar: AnahtarSeti): boolean {
  const ayrac = sorgu.indexOf('&signature=');
  if (ayrac < 0) return false;
  const parametreler = new URLSearchParams(sorgu);
  const imza = parametreler.get('signature');
  const anahtarKimligi = parametreler.get('key_id');
  if (imza === null || anahtarKimligi === null) return false;
  const pem = anahtarlar.get(anahtarKimligi);
  if (pem === undefined) return false;
  try {
    return verify(
      'sha256',
      Buffer.from(sorgu.slice(0, ayrac), 'utf8'),
      createPublicKey(pem),
      Buffer.from(imza, 'base64url'),
    );
  } catch {
    return false;
  }
}

let onbellek: { readonly anahtarlar: AnahtarSeti; readonly zaman: number } | null = null;

/** Google'in acik anahtarlari; gunde bir tazelenir, bilinmeyen key_id'de hemen. */
async function admobAnahtarlari(zorla: boolean): Promise<AnahtarSeti> {
  if (!zorla && onbellek !== null && Date.now() - onbellek.zaman < ANAHTAR_OMRU_MS) {
    return onbellek.anahtarlar;
  }
  const yanit = await fetch(ANAHTAR_ADRESI);
  const govde = (await yanit.json()) as { keys?: { keyId: number | string; pem: string }[] };
  const anahtarlar = new Map((govde.keys ?? []).map((a) => [String(a.keyId), a.pem]));
  onbellek = { anahtarlar, zaman: Date.now() };
  return anahtarlar;
}

export type OdulSonucu = 'verildi' | 'zaten-verildi' | 'gecersiz';

/**
 * Fisi bozdurur: ek cipi verir. Imza DOGRULANDIKTAN sonra cagrilir.
 *
 * Atomik: filtre "fis hala bekliyor ve suresi dolmamis". Ayni islem kimligi
 * ikinci kez gelirse benzersiz indeks yakalar.
 */
export async function fisiBozdur(
  fisKimligi: string,
  oyuncuId: string,
  islemKimligi: string,
  suAn = Date.now(),
): Promise<OdulSonucu> {
  if (!Types.ObjectId.isValid(fisKimligi) || !Types.ObjectId.isValid(oyuncuId)) return 'gecersiz';
  if (islemKimligi.length === 0) return 'gecersiz';

  let fis;
  try {
    fis = await ReklamFisi.findOneAndUpdate(
      {
        _id: fisKimligi,
        oyuncu: oyuncuId,
        durum: 'bekliyor',
        sonKullanma: { $gt: new Date(suAn) },
      },
      { $set: { durum: 'bozduruldu', islemKimligi } },
      { new: true },
    );
  } catch (hata) {
    if ((hata as { code?: unknown }).code === 11000) return 'zaten-verildi';
    throw hata;
  }
  if (fis === null) {
    return (await ReklamFisi.exists({ islemKimligi })) !== null ? 'zaten-verildi' : 'gecersiz';
  }

  await cipEkle(oyuncuId, fis.ekMiktar, 'reklam-odulu');
  return 'verildi';
}

/** AdMob'un geri cagrisini isler. `sorgu`: URL'nin `?` sonrasi, ham hali. */
export async function admobGeriCagrisi(sorgu: string): Promise<OdulSonucu> {
  let gecerli = imzaDogruMu(sorgu, await admobAnahtarlari(false));
  // Google anahtarlarini donduruyor; tanimadigimiz key_id'de bir kez tazele.
  if (!gecerli) gecerli = imzaDogruMu(sorgu, await admobAnahtarlari(true));
  if (!gecerli) {
    kayit.uyari('AdMob geri cagrisinin imzasi gecersiz');
    return 'gecersiz';
  }

  const parametreler = new URLSearchParams(sorgu);
  return fisiBozdur(
    parametreler.get('custom_data') ?? '',
    parametreler.get('user_id') ?? '',
    parametreler.get('transaction_id') ?? '',
  );
}
