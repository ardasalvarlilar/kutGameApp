// Sunucunun istemciye gonderdigi HATA KODLARI.
//
// Eskiden hazir Turkce cumle gonderiliyordu ve Ingilizce oynayan oyuncu
// masada Turkce hata goruyordu. Artik kod gidiyor, ceviri istemcide
// (`apps/mobile/src/hataMetinleri.ts`). Motorun kendi hata kodlari (§4)
// zaten oyle calisiyordu; bu liste onun sunucu tarafindaki karsiligi.
//
// Kod EKLERKEN istemcideki `SUNUCU_ANAHTARLARI` haritasina ve iki sozluge de
// eklemek gerekiyor. Tanimadigi kodu istemci oldugu gibi gosteriyor: eski bir
// uygulama surumu yeni bir kodla karsilasirsa bos ekran degil, ham kod gorur.

export const SUNUCU_HATA_KODLARI = [
  'arkadas-kodu-gecersiz',
  'arkadas-kodu-uretilemedi',
  'arkadas-listen-dolu',
  'baskasinin-adina',
  'beklenmeyen-hata',
  'bekleyen-istek-yok',
  'bos-koltuk-yok',
  'bot-koltugu-talep-gerekmez',
  'bu-masada-degilsin',
  'cihaz-kimligi-gecersiz',
  'cok-bekleyen-istek',
  'cok-yanlis-deneme',
  'engel-listen-dolu',
  'eposta-ayarli-degil',
  'eposta-parola-hatali',
  'eposta-zaten-kayitli',
  'gecersiz-aksiyon',
  'gecersiz-bildirim-jetonu',
  'gecersiz-istek',
  'gecersiz-koltuk',
  'gecersiz-oyuncu',
  'hamle-reddedildi',
  'hesabin-epostasi-var',
  'hesabin-parolasi-yok',
  'hesap-askida',
  'istek-gonderilemedi',
  'istek-gonderilemez',
  'isteyen-masadan-cikmis',
  'jeton-gecersiz',
  'jeton-gerekli',
  'karsi-arkadas-listesi-dolu',
  'kendine-istek',
  'kendini-bildirme',
  'kendini-engelleme',
  'kod-gecersiz',
  'kod-gonderilemedi',
  'koltugun-yok',
  'koltuk-bos-dogrudan-gec',
  'koltuk-dolu-iste',
  'koltuk-kapildi',
  'koltukta-bot-yok',
  'masa-basladi',
  'masa-bulunamadi',
  'masa-doldu-tekrar',
  'masa-dolu',
  'masa-kapandi',
  'masa-kodu-gecersiz',
  'masa-kodu-uretilemedi',
  'masa-sahibi-degilsin',
  'masa-yogun',
  'masada-degilsin',
  'masada-engelli-oyuncu',
  'masada-oyun-yok',
  'mevcut-parola-hatali',
  'oyun-basladi',
  'oyuncu-bulunamadi',
  'parola-ayni',
  'sifirlama-kullanilamiyor',
  'sunucu-hatasi',
  'talep-gecersiz',
  'talep-yok',
  'uc-bulunamadi',
  'zaten-masadasin',
  'zaten-o-koltukta',
]  as const;

export type SunucuHataKodu = (typeof SUNUCU_HATA_KODLARI)[number];
