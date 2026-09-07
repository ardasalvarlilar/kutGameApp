// Sira suresi — oyuncu oynamazsa ne olur.
//
// KURALLAR.md'de sure siniri 0.3'e kadar yoktu; 0.4'te oda ayari olarak
// eklendi (§9, `ayarlar.siraSureleriMs`). Bu dosya bir KURAL DEGIL, politika:
// hangi tasin atilacagina ve surenin ne kadar kalacagina karar verir;
// gecerliligi yine motor soyler.
//
// Isbolumu, motorun tasarim kurallarina uysun diye uce bolundu:
//   - SAYAC  surucude (src/oyun.ts) — `Date.now` motorun disinda (CLAUDE.md #2)
//   - KARAR  burada  — saf, test edilebilir, yan etkisiz
//   - UYGULA motorda — normal bir aksiyon olarak, `suAn` disaridan
//
// Boylece motorda zamanlayici olmuyor (CLAUDE.md #1) ve sunucu geldiginde
// sayac oldugu gibi sunucuya tasinabiliyor.

import {
  oyuncuKaydiOlustur,
  type Aksiyon,
  type OyuncuGorunumu,
  type OyuncuId,
  type OyuncuKaydi,
} from '@kut/engine';
import { atilacakTas } from './bot';

/** Kalan sure bunun altina duserse geri sayim acil (kirmizi) gosterilir. */
export const ACIL_ESIGI_MS = 5000;

// --- Kademeler ---------------------------------------------------------------
// Oyuncu suresini doldurdukca bir alt kademeye duser: 30 sn → 20 sn → 10 sn.
// Son kademede kalir, daha asagi inmez. Kademe oyuncuya ozeldir; hizli
// oynayan hep ilk kademede kalir.

/** Kademenin suresi (ms). Sinirlarin disina tasarsa en yakin kademeye oturur. */
export function kademeSuresi(kademe: number, sureler: readonly number[]): number {
  if (sureler.length === 0) return 0;
  const guvenli = Math.min(Math.max(kademe, 0), sureler.length - 1);
  return sureler[guvenli] as number;
}

/** Sure dolunca inilecek kademe. Son kademedeyse yerinde kalir. */
export function sonrakiKademe(kademe: number, sureler: readonly number[]): number {
  if (sureler.length === 0) return 0;
  return Math.min(kademe + 1, sureler.length - 1);
}

/**
 * Yeni el basladiginda kademeler basa doner (§9 0.7).
 *
 * Ceza yalnizca o eli kapsar: gecen elde oyalanan oyuncu, yeni ele herkes
 * gibi tam sureyle baslar. Kalici olsaydi bir kez gecikmek butun maci
 * 10 saniyeye mahkum ederdi.
 */
export function kademeleriSifirla(): OyuncuKaydi<number> {
  return oyuncuKaydiOlustur(() => 0);
}

/** Suresini dolduran oyuncuyu bir alt kademeye indirir; digerleri degismez. */
export function kademeDusur(
  kademeler: OyuncuKaydi<number>,
  oyuncu: OyuncuId,
  sureler: readonly number[],
): OyuncuKaydi<number> {
  return oyuncuKaydiOlustur((o) =>
    o === oyuncu ? sonrakiKademe(kademeler[o], sureler) : kademeler[o],
  );
}

/** Sirasi gelen oyuncunun sure sonu ani. */
export function siraBitisAni(baslangic: number, sure: number): number {
  return baslangic + sure;
}

/** Sure sonuna kalan (ms). Bitis yoksa ya da gectiyse 0. */
export function kalanSiraSuresi(bitis: number | null, suAn: number): number {
  if (bitis === null) return 0;
  return Math.max(0, bitis - suAn);
}

// --- Sure dolunca ------------------------------------------------------------

/**
 * Sirasi gelen oyuncunun yerine oynanacak BIR SONRAKI aksiyon; yoksa null.
 *
 * Iki yerde kullaniliyor:
 *  - sure dolunca (asil amaci)
 *  - bot bir hamlede tikanirsa kurtarma olarak (src/oyun.ts). Kurtarmanin
 *    FAZA UYGUN olmasi sart: cekme fazinda "at" demek yine reddedilir ve
 *    sira kilitlenir.
 *
 * Tek adim doner, cunku ikinci adim birincinin sonucuna bagli: cekilen tas
 * ele girdikten sonra atilacak tas degisir. Surucu bunu `botAksiyonu` gibi
 * dongude cagirir.
 *
 * Atilacak tasi `atilacakTas` seciyor: okeyi, yerdeki bir pere isleyen tasi
 * (KURALLAR.md §8 — 50 puan ceza) ve elde bir pere giren tasi sirayla
 * eliyor; geriye kalanlardan en yuksek puanlisini atiyor. Yani "rastgele"
 * degil, ise yaramayan. Bilerek deterministik: ayni gorunum her zaman ayni
 * tasi verir (CLAUDE.md motor kurali #2 ile ayni gerekce).
 */
export function sureDolduAksiyonu(
  gorunum: OyuncuGorunumu,
  oyuncu: OyuncuId,
  suAn: number,
): Aksiyon | null {
  if (gorunum.faz === 'el-bitti') return null;
  if (gorunum.siradaki !== oyuncu) return null;

  // Cekmeden atilamaz (§4). Yerden almak bir tercihtir, sure dolunca en
  // tarafsiz hamle desteden cekmektir.
  if (gorunum.faz === 'cekme') {
    return { tip: 'CEK_DESTEDEN', oyuncu, suAn };
  }

  const tas = atilacakTas(gorunum);
  return tas === null ? null : { tip: 'AT', oyuncu, tasId: tas.id, suAn };
}
