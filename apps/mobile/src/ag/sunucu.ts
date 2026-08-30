// Sunucunun adresi.
//
// Tek yerden okunuyor ki dagitimda tek satir degissin. Sira:
//   1. EXPO_PUBLIC_SUNUCU_URL   — derleme aninda gomulur (eas.json / .env)
//   2. VARSAYILAN               — asagida
//
// EXPO_PUBLIC_ oneki sart: Expo yalnizca bu onekli degiskenleri istemci
// paketine gomer. Onsuz yazilan bir degisken telefonda `undefined` gelir ve
// uygulama "sunucuya baglanilamadi" der — sebebi de gorunmez.
//
// DIKKAT: buraya yazilan her sey uygulamanin icinde ACIK METIN olarak gider.
// Gizli anahtar KOYMA; burada yalnizca adres var.

// "xn--kt-xka.com" = "küt.com"un punycode (ASCII) hali. Alan adi Unicode
// (ü) icerdigi icin bilerek boyle yazildi: HTTP Host basligi ve TLS SNI
// UYGULAMADA HER ZAMAN ASCII/punycode formunda gider, tarayici/istemci
// "küt.com" yazsa bile ag uzerinde bunu gonderir. Sunucu tarafinda Traefik'in
// Host() kurali da ayni punycode ile eslesiyor (docker-compose.yml, ALAN_ADI).
const VARSAYILAN = 'https://xn--kt-xka.com';

function temizle(adres: string): string {
  return adres.trim().replace(/\/+$/, '');
}

export const SUNUCU_ADRESI = temizle(process.env['EXPO_PUBLIC_SUNUCU_URL'] ?? VARSAYILAN);

/** REST uclarinin koku. Soket ise dogrudan `SUNUCU_ADRESI`ne baglanir. */
export const API_KOKU = `${SUNUCU_ADRESI}/api`;

/** Adres hala sablon degerdeyse gelistirici uyarilsin. */
export const ADRES_AYARLANDI = SUNUCU_ADRESI !== VARSAYILAN;
