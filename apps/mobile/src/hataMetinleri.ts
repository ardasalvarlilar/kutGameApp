// Motorun hata kodlarini oyuncunun okuyacagi cumleye cevirir.
//
// Ayri dosya cunku iki surucu de bunu kullaniyor (bkz. src/yetkiler.ts'teki
// ayni gerekce). Metinler KURALLAR.md'nin diliyle yazildi: oyuncu ekranda
// gordugu cumleyi kural metninde de bulabilsin.

import type { HataKodu } from '@kut/engine';

/** Ekranda gosterilecek hata metinleri. */
export const HATA_METINLERI: Partial<Record<HataKodu, string>> = {
  'sira-sende-degil': 'Sıra sende değil',
  'once-cekmelisin': 'Önce taş çekmelisin',
  'zaten-cektin': 'Bu tur zaten çektin',
  'pencere-suresi-dolmadi': 'Talep penceresi henüz kapanmadı',
  'cift-talebi-oncelikli': 'Çifti olan oyuncu bu taşı alacak',
  'cift-elinde-yok': 'O taşın eşi elinde yok',
  'tas-elinde-yok': 'O taş elinde yok',
  'sart-eksik': 'Turun şartı eksik',
  'sart-fazla': 'Turun şartından fazlasını indiremezsin',
  'sart-uyusmuyor': 'Bu perler turun şartını karşılamıyor',
  'zaten-actin': 'Zaten açtın',
  'acmadin': 'Önce açmalısın',
  'acilis-hamlesinde-isleme-yok': 'Açtığın hamlede işleme yapamazsın',
  'son-tas-atilmali': 'Elinde atacak en az bir taş kalmalı',
  'az-tas': 'Bir per en az 3 taştır',
  'kut-en-fazla-dort-tas': 'Bir küt en fazla 4 taştır',
  'kut-renk-tekrari': 'Kütte aynı renk iki kez olamaz',
  'kut-farkli-sayi': 'Küt tek bir sayıdan oluşur',
  'seri-ardisik-degil': 'Seri ardışık olmalı (1 seriyi bitiremez)',
  'seri-farkli-renk': 'Seri tek renk olmalı',
  'seri-sayi-tekrari': 'Seride aynı sayı iki kez olamaz',
  'cift-birebir-es-degil': 'Çift birebir aynı taştan olur',
  'cift-iki-tas-olmali': 'Çift tam olarak iki taştır',
  'per-degil': 'Bu taşlar geçerli bir per değil',
  'tur-16-acma-yok': 'Tur 16’da yere per inmez',
  'artan-tas-bir-olmali': 'Geriye tam olarak 1 taş kalmalı',
  'el-bitti': 'El bitti',
};

/**
 * Hata kodunu ekrandaki cumleye cevirir.
 *
 * `string` de kabul ediyor cunku cevrimici oyunda kod SUNUCUDAN geliyor ve
 * orada motorun `HataKodu`su olmayan mesajlar da var ("Bu masada degilsin").
 * Tanimadigi kodu oldugu gibi gosteriyor — bos ekrandan iyidir.
 */
export function hataMetni(kod: HataKodu | string | null): string | null {
  if (kod === null) return null;
  return HATA_METINLERI[kod as HataKodu] ?? kod;
}

