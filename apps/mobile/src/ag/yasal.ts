// Yasal sayfalarin adresleri.
//
// Sayfalar SUNUCUDAN geliyor (packages/server/src/rotalar/sayfalar.ts): alan
// adi ve TLS zaten orada. Ikinci bir yerde tutmak "biri guncellenir digeri
// unutulur" demek olurdu.
//
// App Store Connect gizlilik politikasi ve destek URL'i ISTIYOR; ayrica
// gizlilik baglantisinin uygulamanin ICINDEN de gorulebilmesi bekleniyor.
// Giris ekraninda ve hesap ekraninda duruyorlar.

import { SUNUCU_ADRESI } from './sunucu';

export const YASAL = {
  gizlilik: `${SUNUCU_ADRESI}/gizlilik`,
  kosullar: `${SUNUCU_ADRESI}/kosullar`,
  destek: `${SUNUCU_ADRESI}/destek`,
  hesapSilme: `${SUNUCU_ADRESI}/hesap-sil`,
} as const;
