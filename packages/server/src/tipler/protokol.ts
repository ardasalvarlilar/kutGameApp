// Istemci ile sunucu arasindaki sozlesme.
//
// Tek kaynak burasi: mobil taraf da bu dosyanin bir kopyasini okuyor
// (apps/mobile/src/ag/protokol.ts). Motorun `Aksiyon` ve `OyuncuGorunumu`
// tipleri oldugu gibi kullaniliyor — protokol onlarin uzerine yalnizca ince
// bir zarf ekliyor.

import type { Aksiyon, ElSonucu, HataKodu, OyuncuGorunumu, OyuncuId } from '@kut/engine';

/** Masadaki bir koltuk — herkese acik bilgi. */
export interface KoltukGorunumu {
  readonly no: OyuncuId;
  readonly oyuncuId: string;
  readonly ad: string;
  readonly hazir: boolean;
  /** Soketi acik mi? Kopan oyuncunun koltugu bosalmaz (bkz. MIMARI.md §3). */
  readonly bagli: boolean;
}

export interface MasaGorunumu {
  readonly masaId: string;
  readonly kod: string;
  readonly durum: 'bekliyor' | 'oynaniyor' | 'bitti';
  readonly sahipId: string;
  readonly tur: number;
  /** Kod bilmeden katilinabilir mi? Hizli eslesmede acilan masalar acik. */
  readonly ozel: boolean;
  readonly koltuklar: readonly KoltukGorunumu[];
  /** Mac boyu birikmis puanlar; anahtar koltuk numarasi. */
  readonly puanlar: Readonly<Record<number, number>>;
}

/** Sunucunun sira sayacini istemciye bildirmesi. */
export interface SureGorunumu {
  readonly siradaki: OyuncuId;
  /** Sunucu saatine gore bitis ani (ms). Istemci ofsetini kendi duzeltir. */
  readonly bitisZamani: number;
  /** O oyuncunun su anki hakki (ms) — cubugun orani icin. */
  readonly sure: number;
  /**
   * Sunucunun bu paketi gonderdigi an. Istemci kendi saatiyle farkini alip
   * ofsetini duzeltiyor — telefonun saati yanlissa geri sayim bozulmasin.
   */
  readonly sunucuZamani: number;
}

// --- Istemci → sunucu --------------------------------------------------------

export interface IstemciOlaylari {
  /** Acilista ya da yeniden baglanmada: "hangi masadayim?" Yoksa null. */
  'masa:benim': (
    girdi: Record<string, never>,
    yanit: (sonuc: Yanit<{ masa: MasaGorunumu | null }>) => void,
  ) => void;
  'masa:kur': (
    girdi: { readonly ozel?: boolean },
    yanit: (sonuc: Yanit<{ masa: MasaGorunumu }>) => void,
  ) => void;
  'masa:katil': (
    girdi: { readonly kod: string },
    yanit: (sonuc: Yanit<{ masa: MasaGorunumu }>) => void,
  ) => void;
  /** Hizli eslesme: acik bir masaya oturt, yoksa yeni acik masa ac. */
  'masa:hizli': (
    girdi: Record<string, never>,
    yanit: (sonuc: Yanit<{ masa: MasaGorunumu }>) => void,
  ) => void;
  'masa:cik': (girdi: Record<string, never>, yanit: (sonuc: Yanit<null>) => void) => void;
  'masa:hazir': (
    girdi: { readonly hazir: boolean },
    yanit: (sonuc: Yanit<{ masa: MasaGorunumu }>) => void,
  ) => void;
  /**
   * Bir oyun hamlesi. `hamleNo` istemcinin sayaci: ayni aksiyonun iki kez
   * islenmesini engeller (yeniden baglanmada tekrar gonderim olur) ve gelen
   * gorunumun hangi hamleye ait oldugunu belli eder.
   */
  'oyun:aksiyon': (
    girdi: { readonly aksiyon: Aksiyon; readonly hamleNo: number },
    yanit: (sonuc: Yanit<null>) => void,
  ) => void;
}

// --- Sunucu → istemci --------------------------------------------------------

export interface SunucuOlaylari {
  'masa:durum': (masa: MasaGorunumu) => void;
  /** Sunucu oyuncuyu masadan cikardi (masa kapandi, atildi vb.). */
  'masa:ayrildi': (veri: { readonly sebep: string }) => void;
  'oyun:gorunum': (veri: { readonly gorunum: OyuncuGorunumu; readonly hamleNo: number }) => void;
  'oyun:sure': (veri: SureGorunumu) => void;
  'oyun:elSonu': (veri: {
    readonly sonuc: ElSonucu;
    readonly masa: MasaGorunumu;
    /** Mac bittiyse en dusuk puanli koltuklar; bitmediyse bos. */
    readonly macKazananlari: readonly OyuncuId[];
    /** Sonraki el kac saniye sonra dagitilacak? Mac bittiyse null. */
    readonly sonrakiElSn: number | null;
  }) => void;
  'oyun:hata': (veri: { readonly reason: HataKodu | string; readonly hamleNo: number }) => void;
}

/** Sokete baglanan her istemcinin dogrulanmis kimligi. */
export interface SoketVerisi {
  oyuncuId: string;
  ad: string;
  /** Su an oturdugu masa; yoksa null. */
  masaId: string | null;
}

// --- Ortak yanit zarfi -------------------------------------------------------
//
// Motorun 4 numarali kurali ("gecersiz hamle istisna degil, sonuctur") aynen
// ag katmanina tasindi: hicbir hata firlatmayla gitmiyor, hepsi veri.

export type Yanit<T> = { readonly ok: true; readonly veri: T } | { readonly ok: false; readonly hata: string };

export const basarili = <T>(veri: T): Yanit<T> => ({ ok: true, veri });
export const basarisiz = (hata: string): Yanit<never> => ({ ok: false, hata });
