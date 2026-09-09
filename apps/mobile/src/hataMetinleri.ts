// Hata KODLARINI oyuncunun okuyacagi cumleye cevirir.
//
// Ayri dosya cunku iki surucu de bunu kullaniyor (bkz. src/yetkiler.ts'teki
// ayni gerekce). Metinler KURALLAR.md'nin diliyle yazildi: oyuncu ekranda
// gordugu cumleyi kural metninde de bulabilsin.
//
// Ceviri BURADA yapilmiyor, sozlukten geliyor (src/dil). Suruculer kodu
// oldugu gibi tasiyor ve cumleye ekran cevriliyor — dil degistiginde
// ekrandaki hata da degissin diye. Ceviri surucude yapilsaydi metin, dil
// degistigi anda eski dilde donmus kalirdi.

import type { HataKodu } from '@kut/engine';
import type { Ceviri, MetinAnahtari } from './dil/cevir';

/** Motorun hata kodu -> sozluk anahtari. */
const MOTOR_ANAHTARLARI: Partial<Record<HataKodu, MetinAnahtari>> = {
  'sira-sende-degil': 'hata.sira-sende-degil',
  'once-cekmelisin': 'hata.once-cekmelisin',
  'zaten-cektin': 'hata.zaten-cektin',
  'ceza-tasi-kalmadi': 'hata.ceza-tasi-kalmadi',
  'cift-elinde-yok': 'hata.cift-elinde-yok',
  'talep-penceresi-kapali': 'hata.talep-penceresi-kapali',
  'tas-elinde-yok': 'hata.tas-elinde-yok',
  'sart-eksik': 'hata.sart-eksik',
  'sart-fazla': 'hata.sart-fazla',
  'sart-uyusmuyor': 'hata.sart-uyusmuyor',
  'zaten-actin': 'hata.zaten-actin',
  acmadin: 'hata.acmadin',
  'acilis-hamlesinde-isleme-yok': 'hata.acilis-hamlesinde-isleme-yok',
  'son-tas-atilmali': 'hata.son-tas-atilmali',
  'az-tas': 'hata.az-tas',
  'kut-en-fazla-dort-tas': 'hata.kut-en-fazla-dort-tas',
  'kut-renk-tekrari': 'hata.kut-renk-tekrari',
  'kut-farkli-sayi': 'hata.kut-farkli-sayi',
  'seri-ardisik-degil': 'hata.seri-ardisik-degil',
  'seri-farkli-renk': 'hata.seri-farkli-renk',
  'seri-sayi-tekrari': 'hata.seri-sayi-tekrari',
  'cift-birebir-es-degil': 'hata.cift-birebir-es-degil',
  'yerdeki-okey-kimildatilamaz': 'hata.yerdeki-okey-kimildatilamaz',
  'cift-iki-tas-olmali': 'hata.cift-iki-tas-olmali',
  'per-degil': 'hata.per-degil',
  'tur-16-acma-yok': 'hata.tur-16-acma-yok',
  'artan-tas-bir-olmali': 'hata.artan-tas-bir-olmali',
  'el-bitti': 'hata.el-bitti',
};

/**
 * SUNUCUNUN gonderdigi kodlar.
 *
 * Sunucu eskiden hazir Turkce cumle gonderiyordu; Ingilizce oynayan oyuncu
 * masada Turkce hata goruyordu. Artik kod gonderiyor ve ceviri burada.
 * Kodlar `packages/server/src/tipler/hatalar.ts`te tanimli — iki taraf da
 * ayni listeye bakiyor.
 */
const SUNUCU_ANAHTARLARI: Record<string, MetinAnahtari> = {
  'arkadas-kodu-gecersiz': 'sunucu.arkadas-kodu-gecersiz',
  'arkadas-kodu-uretilemedi': 'sunucu.arkadas-kodu-uretilemedi',
  'arkadas-listen-dolu': 'sunucu.arkadas-listen-dolu',
  'baskasinin-adina': 'sunucu.baskasinin-adina',
  'beklenmeyen-hata': 'sunucu.beklenmeyen-hata',
  'bekleyen-istek-yok': 'sunucu.bekleyen-istek-yok',
  'bos-koltuk-yok': 'sunucu.bos-koltuk-yok',
  'bot-koltugu-talep-gerekmez': 'sunucu.bot-koltugu-talep-gerekmez',
  'bu-masada-degilsin': 'sunucu.bu-masada-degilsin',
  'cihaz-kimligi-gecersiz': 'sunucu.cihaz-kimligi-gecersiz',
  'cok-bekleyen-istek': 'sunucu.cok-bekleyen-istek',
  'cok-yanlis-deneme': 'sunucu.cok-yanlis-deneme',
  'engel-listen-dolu': 'sunucu.engel-listen-dolu',
  'eposta-ayarli-degil': 'sunucu.eposta-ayarli-degil',
  'eposta-parola-hatali': 'sunucu.eposta-parola-hatali',
  'eposta-zaten-kayitli': 'sunucu.eposta-zaten-kayitli',
  'gecersiz-aksiyon': 'sunucu.gecersiz-aksiyon',
  'gecersiz-bildirim-jetonu': 'sunucu.gecersiz-bildirim-jetonu',
  'gecersiz-istek': 'sunucu.gecersiz-istek',
  'gecersiz-koltuk': 'sunucu.gecersiz-koltuk',
  'gecersiz-oyuncu': 'sunucu.gecersiz-oyuncu',
  'hamle-reddedildi': 'sunucu.hamle-reddedildi',
  'hesabin-epostasi-var': 'sunucu.hesabin-epostasi-var',
  'hesabin-parolasi-yok': 'sunucu.hesabin-parolasi-yok',
  'hesap-askida': 'sunucu.hesap-askida',
  'istek-gonderilemedi': 'sunucu.istek-gonderilemedi',
  'istek-gonderilemez': 'sunucu.istek-gonderilemez',
  'isteyen-masadan-cikmis': 'sunucu.isteyen-masadan-cikmis',
  'jeton-gecersiz': 'sunucu.jeton-gecersiz',
  'jeton-gerekli': 'sunucu.jeton-gerekli',
  'karsi-arkadas-listesi-dolu': 'sunucu.karsi-arkadas-listesi-dolu',
  'kendine-istek': 'sunucu.kendine-istek',
  'kendini-bildirme': 'sunucu.kendini-bildirme',
  'kendini-engelleme': 'sunucu.kendini-engelleme',
  'kod-gecersiz': 'sunucu.kod-gecersiz',
  'kod-gonderilemedi': 'sunucu.kod-gonderilemedi',
  'koltugun-yok': 'sunucu.koltugun-yok',
  'koltuk-bos-dogrudan-gec': 'sunucu.koltuk-bos-dogrudan-gec',
  'koltuk-dolu-iste': 'sunucu.koltuk-dolu-iste',
  'koltuk-kapildi': 'sunucu.koltuk-kapildi',
  'koltukta-bot-yok': 'sunucu.koltukta-bot-yok',
  'masa-basladi': 'sunucu.masa-basladi',
  'masa-bulunamadi': 'sunucu.masa-bulunamadi',
  'masa-doldu-tekrar': 'sunucu.masa-doldu-tekrar',
  'masa-dolu': 'sunucu.masa-dolu',
  'masa-kapandi': 'sunucu.masa-kapandi',
  'masa-kodu-gecersiz': 'sunucu.masa-kodu-gecersiz',
  'masa-kodu-uretilemedi': 'sunucu.masa-kodu-uretilemedi',
  'masa-sahibi-degilsin': 'sunucu.masa-sahibi-degilsin',
  'masa-yogun': 'sunucu.masa-yogun',
  'masada-degilsin': 'sunucu.masada-degilsin',
  'masada-engelli-oyuncu': 'sunucu.masada-engelli-oyuncu',
  'masada-oyun-yok': 'sunucu.masada-oyun-yok',
  'mevcut-parola-hatali': 'sunucu.mevcut-parola-hatali',
  'oyun-basladi': 'sunucu.oyun-basladi',
  'oyuncu-bulunamadi': 'sunucu.oyuncu-bulunamadi',
  'parola-ayni': 'sunucu.parola-ayni',
  'sifirlama-kullanilamiyor': 'sunucu.sifirlama-kullanilamiyor',
  'sunucu-hatasi': 'sunucu.sunucu-hatasi',
  'talep-gecersiz': 'sunucu.talep-gecersiz',
  'talep-yok': 'sunucu.talep-yok',
  'uc-bulunamadi': 'sunucu.uc-bulunamadi',
  'zaten-masadasin': 'sunucu.zaten-masadasin',
  'zaten-o-koltukta': 'sunucu.zaten-o-koltukta',
};

/**
 * Hata kodunu ekrandaki cumleye cevirir.
 *
 * `string` de kabul ediyor cunku cevrimici oyunda kod SUNUCUDAN geliyor.
 * Tanimadigi kodu OLDUGU GIBI gosteriyor — bos ekrandan iyidir ve yeni bir
 * sunucu kodu eklendiginde uygulama guncellenmeden de bir sey gorunur.
 */
export function hataMetni(kod: HataKodu | string | null, t: Ceviri): string | null {
  if (kod === null) return null;
  const anahtar = MOTOR_ANAHTARLARI[kod as HataKodu] ?? SUNUCU_ANAHTARLARI[kod];
  return anahtar === undefined ? kod : t(anahtar);
}
