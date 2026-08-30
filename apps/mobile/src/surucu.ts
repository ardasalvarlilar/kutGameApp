// Masa ekraninin BESLENDIGI arayuz.
//
// `Masa.tsx` bu arayuzden fazlasini bilmiyor: durumu nereden geldigini,
// motorun bu cihazda mi yoksa sunucuda mi kostugunu sormuyor. Iki surucu
// var ve ikisi de bunu dolduruyor:
//
//   src/oyun.ts            — cihazda kosan motor (gelistirme ve test icin)
//   src/ag/cevrimiciOyun.ts — sunucudan gelen gorunumler (asil oyun)
//
// Ayrimin sebebi CLAUDE.md motor kurali #3: ekran zaten tam durumu degil
// yalnizca `viewFor` projeksiyonunu okuyordu. Arayuzu buna daraltinca
// cevrimici surucu hicbir ekran kodunu degistirmeden yerine gecebiliyor.

import type { Aksiyon, OyuncuGorunumu, OyuncuId, OyuncuKaydi } from '@kut/engine';

export interface MasaSurucusu {
  /** Bu oyuncunun gordugu her sey. Gizli bilgi buradan gecmez. */
  readonly gorunum: OyuncuGorunumu;
  /** Son reddedilen hamlenin oyuncuya gosterilecek metni; yoksa null. */
  readonly sonHata: string | null;
  /**
   * Hamleyi yollar. Donen deger "kabul edildi" DEGIL, "gonderildi" demek:
   * cevrimici oyunda karar sunucuda ve yanit sonra geliyor. Ekran bunu
   * yalnizca secimi temizlemek icin kullaniyor.
   */
  readonly gonder: (aksiyon: Aksiyon) => boolean;
  /** Sira suresinin bitecegi an (yerel saate gore, ms). Sirasi degilse null. */
  readonly siraBitisi: number | null;
  /** Bu siranin toplam hakki (ms) — geri sayim cubugunun orani icin. */
  readonly siraSuresi: number;
  /** Mac boyu birikmis puanlar (KURALLAR.md §8). */
  readonly macPuanlari: OyuncuKaydi<number>;
  /** Mac bittiyse en dusuk puanli oyuncular; bitmediyse bos. */
  readonly macKazananlari: readonly OyuncuId[];
  /** El sonu tablosundan sonraki ele gecis (sn). Beklenmiyorsa null. */
  readonly turArasiSn: number | null;
  /**
   * Sonraki eli baslatan islev — YA DA null.
   *
   * null demek "sonraki eli sunucu dagitiyor". Ekran bunu gorunce el sonu
   * tablosunda basilabilir bir dugme degil, isleyen bir geri sayim
   * gosteriyor. Onemli: cevrimici oyunda calismayan bir dugme koymak,
   * oyuncuya "bastim, olmadi" dedirtiyordu.
   */
  readonly sonrakiTur: (() => void) | null;
  /** Koltuk -> ekranda gorunecek ad. */
  readonly adlar: Record<OyuncuId, string>;
  /**
   * Sunucuya bagli miyiz?
   *
   * Masa ekraninda GEREKLI: baglanti koptugunda tahta oldugu gibi donuyor ve
   * hicbir sey olmuyor. Uyari cikmazsa oyuncu "oyun kilitlendi" saniyor ve
   * uygulamayi kapatiyor — oysa sunucu onun yerine oynuyor ve geri gelirse
   * ayni koltuga oturuyor. Cevrimdisi surucude her zaman true.
   */
  readonly bagli: boolean;
  /**
   * Oyun sunucuda mi kosuyor?
   *
   * Ekran bunu iki yerde soruyor: masadan cikinca ne olacagini dogru yazmak
   * icin (cevrimicide koltuk kalir ve sunucu yerine oynar, cevrimdisi masada
   * el gercekten biter) ve bildirme/engelleme listesini gostermek icin.
   * Tahmine dayali bir vekil deger yerine acikca soruluyor.
   */
  readonly cevrimici: boolean;
}
