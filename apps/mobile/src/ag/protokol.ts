// Sunucuyla konusulan dilin ISTEMCI kopyasi.
//
// Ikizi `packages/server/src/tipler/protokol.ts`te. Ikisi ayri duruyor cunku
// sunucu paketi mobil uygulamaya bagimlilik olarak GIREMEZ: express, mongoose
// ve socket.io'yu Metro'ya sokmak demek olurdu. Motorun tipleri (`Aksiyon`,
// `OyuncuGorunumu`) zaten paylasilan pakette; burada yalnizca ince zarf var.
//
// Bir alan degistiginde IKISI birden degismeli. Degismezse tip hatasi
// vermezler ama uygulama sessizce yanlis calisir — bu yuzden not burada.

import type { Aksiyon, ElSonucu, OyuncuGorunumu, OyuncuId } from '@kut/engine';
import type { KademeKimligi } from '@kut/ekonomi';

export type { Aksiyon, KademeKimligi, OyuncuGorunumu, OyuncuId };

export interface KoltukGorunumu {
  readonly no: OyuncuId;
  /** Bot koltugunda gercek bir oyuncu kimligi degil, `bot:<koltuk>` gelir. */
  readonly oyuncuId: string;
  readonly ad: string;
  /** Bu koltugu sunucunun botu mu oynuyor? */
  readonly bot: boolean;
  readonly hazir: boolean;
  readonly bagli: boolean;
}

/**
 * Bekleyen koltuk degistirme talebi.
 *
 * Bos koltuga gecmek talep gerektirmiyor; DOLU koltuk oturanin onayindan
 * geciyor. Kimin nerede oturdugu oyunun kendisini degistiriyor: attigin tasi
 * saginda oturan alir (KURALLAR.md §4/§5).
 */
export interface KoltukTalebiGorunumu {
  readonly isteyenId: string;
  readonly hedefKoltuk: OyuncuId;
}

export type MasaDurumu = 'bekliyor' | 'oynaniyor' | 'bitti';

export interface MasaGorunumu {
  readonly masaId: string;
  readonly kod: string;
  readonly durum: MasaDurumu;
  readonly sahipId: string;
  readonly tur: number;
  readonly ozel: boolean;
  readonly koltuklar: readonly KoltukGorunumu[];
  readonly koltukTalepleri: readonly KoltukTalebiGorunumu[];
  readonly puanlar: Readonly<Record<number, number>>;
  readonly kademe: KademeKimligi;
  /** Oyuncu basina giris (cip). */
  readonly giris: number;
  /** El basladiysa tahsil edilen toplam; baslamadiysa 0. */
  readonly pot: number;
}

/** MASA BUL listesindeki bir satir. Ozel masalar bu listeye girmez. */
export interface AcikMasaOzeti {
  readonly kod: string;
  readonly oyuncuSayisi: number;
  readonly kapasite: number;
  readonly oyuncular: readonly string[];
  readonly benimMi: boolean;
  readonly kademe: KademeKimligi;
  readonly giris: number;
}

/** Mac sonunda koltuk basina kazanilan cip ve deneyim; kazanmayan 0. */
export interface MacSonu {
  readonly cip: Readonly<Record<number, number>>;
  readonly deneyim: Readonly<Record<number, number>>;
}

/** `GET /cip/hediye` — biriken hediye cip (@kut/ekonomi hediye.ts). */
export interface HediyeDurumu {
  readonly miktar: number;
  readonly saat: number;
  readonly tavanda: boolean;
  /** Sonraki saatin dolmasina kalan ms; tavandaysa null. */
  readonly sonrakiSaatMs: number | null;
  readonly saatlik: number;
  readonly tavanSaat: number;
  readonly reklamCarpani: number;
}

/** `POST /cip/hediye` — toplanan miktar ve reklamla bozdurulabilecek fis. */
export interface HediyeSonucu {
  readonly kazanilan: number;
  readonly cip: number;
  readonly fis: { readonly kimlik: string; readonly ekMiktar: number; readonly sonKullanma: string };
}

/** Bakiye ya da seviye degisince sunucunun yolladigi ozet (`oyuncu:cuzdan`). */
export interface CuzdanGorunumu {
  readonly cip: number;
  readonly seviye: number;
  readonly deneyim: number;
}

export interface SureGorunumu {
  readonly siradaki: OyuncuId;
  readonly bitisZamani: number;
  readonly sure: number;
  readonly sunucuZamani: number;
}

export interface ElSonuVerisi {
  readonly sonuc: ElSonucu;
  readonly masa: MasaGorunumu;
  readonly macKazananlari: readonly OyuncuId[];
  readonly sonrakiElSn: number | null;
  /** Mac bittiyse dagitilan cip ve deneyim; bitmediyse null. */
  readonly macSonu: MacSonu | null;
}

export interface GorunumVerisi {
  readonly gorunum: OyuncuGorunumu;
  readonly hamleNo: number;
}

export interface HataVerisi {
  readonly reason: string;
  readonly hamleNo: number;
}

export type Yanit<T> =
  | { readonly ok: true; readonly veri: T }
  | { readonly ok: false; readonly hata: string };

/** Sunucunun istemciye anlattigi oyuncu. */
export interface OyuncuOzeti {
  readonly id: string;
  readonly ad: string;
  readonly eposta: string | null;
  readonly misafirMi: boolean;
  /**
   * Baskasinin seni bulmasinin yolu — "KUT-7F3A9".
   *
   * Sunucuda TEMBEL uretiliyor (ilk arkadas ekraninda), bu yuzden yeni bir
   * hesapta bir sure null kalabilir. Ekran o durumda kodu `/arkadas`tan
   * geliyor kabul ediyor.
   */
  readonly arkadasKodu: string | null;
  readonly seviye: number;
  /** Toplam deneyim; seviye bundan turuyor (@kut/ekonomi seviye.ts). */
  readonly deneyim: number;
  /** Oyun ici cip. Gercek paraya cevrilemez. */
  readonly cip: number;
  readonly oynananEl: number;
  readonly kazanilanEl: number;
  readonly oynananMac: number;
  readonly kazanilanMac: number;
}

export interface GirisVerisi {
  readonly jeton: string;
  readonly oyuncu: OyuncuOzeti;
}
