// Oyuncunun su an yapabildikleri — ekranin dugmeleri buradan besleniyor.
//
// Ayri dosya cunku hem cevrimici hem cevrimdisi surucu bunu kullaniyor ve
// bagimliligi yalnizca `OyuncuGorunumu`. `src/oyun.ts`te dursaydi, ekran
// onu kullanabilmek icin cevrimdisi surucunun tamamini (ve `bot.ts`i)
// pakete sokmak zorunda kalirdi.
//
// Saf: kural karari yok, motora sormanin kestirmesi. Asil kontrol daima
// motorda — burasi yalnizca dugmenin aktif gorunup gorunmeyecegini soyluyor.
//
// ZAMAN ALMIYOR (§9 0.9). Talep penceresinin suresi kalktigi icin hicbir
// yetki "saat kac" sorusuna bagli degil. Bunun ekranda somut bir karsiligi
// var: `Masa.tsx` her 200 ms'de bir tiklayan sayaci yetkileri yeniden
// hesaplamak icin kullanmak zorunda degil.

import type { OyuncuGorunumu } from '@kut/engine';


export interface Yetkiler {
  readonly cekebilir: boolean;
  readonly yerdenAlabilir: boolean;
  readonly atabilir: boolean;
  readonly talepEdebilir: boolean;
  readonly ciftTalepEdebilir: boolean;
}

export function yetkiler(gorunum: OyuncuGorunumu): Yetkiler {
  // Koltuk numarasi 0 OLMAK ZORUNDA DEGIL: cevrimici masada 2 numaraya da
  // oturabilirim. "Ben kimim" sorusunun cevabi gorunumun kendisinde.
  const ben = gorunum.ben;
  const benim = gorunum.siradaki === ben;
  const pencere = gorunum.pencere;
  const pencereAcik = pencere !== null;

  return {
    cekebilir: benim && gorunum.faz === 'cekme',
    // Tur 15'in cift hakki icin BURADA bir kisit yok: cift talebi kuyruga
    // girmiyor, geldigi anda tasi aliyor (§9 0.10). Cifti tutan once
    // davrandiysa pencere zaten kapanmis olur.
    yerdenAlabilir: benim && gorunum.faz === 'cekme' && pencereAcik,
    atabilir: benim && gorunum.faz === 'atma',
    talepEdebilir:
      !benim &&
      pencereAcik &&
      pencere.atan !== ben &&
      !pencere.talepler.includes(ben),
    // `ciftHakkim` uc sarti birden tasiyor: tur 15, es gercekten elde ve
    // oyuncu henuz acmamis (KURALLAR.md §5, §9 0.10). Asil kontrol motorda.
    ciftTalepEdebilir: !benim && pencereAcik && pencere.ciftHakkim,
  };
}
