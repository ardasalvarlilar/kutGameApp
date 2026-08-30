// Oyuncunun su an yapabildikleri — ekranin dugmeleri buradan besleniyor.
//
// Ayri dosya cunku hem cevrimici hem cevrimdisi surucu bunu kullaniyor ve
// bagimliligi yalnizca `OyuncuGorunumu`. `src/oyun.ts`te dursaydi, ekran
// onu kullanabilmek icin cevrimdisi surucunun tamamini (ve `bot.ts`i)
// pakete sokmak zorunda kalirdi.
//
// Saf: kural karari yok, motora sormanin kestirmesi. Asil kontrol daima
// motorda — burasi yalnizca dugmenin aktif gorunup gorunmeyecegini soyluyor.

import type { OyuncuGorunumu } from '@kut/engine';


export interface Yetkiler {
  readonly cekebilir: boolean;
  readonly yerdenAlabilir: boolean;
  readonly atabilir: boolean;
  readonly talepEdebilir: boolean;
  readonly ciftTalepEdebilir: boolean;
}

export function yetkiler(gorunum: OyuncuGorunumu, suAn: number): Yetkiler {
  // Koltuk numarasi 0 OLMAK ZORUNDA DEGIL: cevrimici masada 2 numaraya da
  // oturabilirim. "Ben kimim" sorusunun cevabi gorunumun kendisinde.
  const ben = gorunum.ben;
  const benim = gorunum.siradaki === ben;
  const pencere = gorunum.pencere;
  const pencereAcik = pencere !== null;
  const pencereKapandi = pencere === null || suAn >= pencere.kapanisZamani;

  // Tur 15'te cift hakki sirasi gelenin bedelsiz hakkini da gectigi icin
  // yerden alma pencere kapanana kadar bekler (KURALLAR.md §5).
  const tur15Kisiti = gorunum.tur === 15 && gorunum.ayarlar.ciftCalmaHakki;

  return {
    cekebilir: benim && gorunum.faz === 'cekme' && pencereKapandi,
    yerdenAlabilir:
      benim &&
      gorunum.faz === 'cekme' &&
      pencereAcik &&
      (!tur15Kisiti || (pencereKapandi && pencere.ciftTalebi === null)),
    atabilir: benim && gorunum.faz === 'atma',
    talepEdebilir:
      !benim &&
      pencereAcik &&
      pencere.atan !== ben &&
      !pencere.talepler.includes(ben),
    ciftTalepEdebilir: !benim && pencereAcik && pencere.ciftHakkim && pencere.ciftTalebi === null,
  };
}

