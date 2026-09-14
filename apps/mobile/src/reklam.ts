// Odullu reklam — takilacak nokta.
//
// Reklam SDK'si (ornegin react-native-google-mobile-ads) HENUZ YOK: yerel bir
// modul, dev build ve AdMob hesabi istiyor. Geldiginde yalnizca bu dosya
// degisiyor; ekran (bilesenler/Hediye.tsx) bu arayuzden fazlasini bilmiyor.
//
// Uygularken iki sart:
//  - Reklam `serverSideVerificationOptions` ile gosterilmeli:
//    `{ userId: oyuncuId, customData: fisKimligi }`. Ek cipi SUNUCU veriyor,
//    Google'in imzali geri cagrisini dogrulayinca (server reklamServisi.ts).
//    Istemcinin "izledim" demesi hicbir sey kazandirmiyor — kazandirmamali.
//  - AdMob konsolunda SSV adresi: https://<alan-adi>/api/reklam/admob
//
// Reklam hazir degilken `hazirMi` false donuyor ve ekran "2 KAT" dugmesini
// HIC gostermiyor: calismayan bir dugme "bastim, olmadi" dedirtirdi.

export type ReklamSonucu = 'izlendi' | 'yarida' | 'yok';

export interface OdulluReklam {
  readonly hazirMi: () => boolean;
  readonly goster: (girdi: {
    readonly fisKimligi: string;
    readonly oyuncuId: string;
  }) => Promise<ReklamSonucu>;
}

export const odulluReklam: OdulluReklam = {
  hazirMi: () => false,
  goster: async () => 'yok',
};
