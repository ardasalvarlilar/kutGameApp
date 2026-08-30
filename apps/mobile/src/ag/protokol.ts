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

export type { Aksiyon, OyuncuGorunumu, OyuncuId };

export interface KoltukGorunumu {
  readonly no: OyuncuId;
  readonly oyuncuId: string;
  readonly ad: string;
  readonly hazir: boolean;
  readonly bagli: boolean;
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
  readonly puanlar: Readonly<Record<number, number>>;
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
  readonly seviye: number;
  readonly jeton: number;
  readonly oynananEl: number;
  readonly kazanilanEl: number;
  readonly oynananMac: number;
  readonly kazanilanMac: number;
}

export interface GirisVerisi {
  readonly jeton: string;
  readonly oyuncu: OyuncuOzeti;
}
