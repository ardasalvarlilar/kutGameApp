// Aksiyonlar ve hata kodlari.
// CLAUDE.md motor kurali #4: gecersiz hamle istisna degil, sonuctur.
// Sunucu `reason` degerini dogrudan istemciye iletebilir.

import type { OyunDurumu } from './durum';
import type { PerHatasi } from './per';
import type { SartHatasi } from './turlar';
import type { OyuncuId, TasId } from './tipler';

interface AksiyonTabani {
  readonly oyuncu: OyuncuId;
  /** CLAUDE.md #2: motor saat okumaz, an disaridan gelir (ms). */
  readonly suAn: number;
}

/** KURALLAR.md §6 — yerdeki perden okey alma. */
export interface OkeyAlimi {
  readonly perId: number;
  readonly okeyTasId: TasId;
  /**
   * Okeyin yerine konacak gercek tas(lar). Seride tek tas yeter; kutte
   * okeyin rengi belirsiz olabildigi icin eksik renklerin hepsi gerekir (§6).
   */
  readonly yerineTasIdler: readonly TasId[];
}

/**
 * Gecerli aksiyon tipleri — CALISMA ZAMANINDA da okunabilsin diye dizi.
 *
 * Tip birlesimi tek basina yetmiyor: sunucuya ag uzerinden gelen bir paketin
 * `tip` alani TypeScript'in gormedigi herhangi bir metin olabilir. Sunucu
 * bunu `reduce`a vermeden once bu listeye bakarak eliyor
 * (packages/server/src/soket/index.ts).
 *
 * Asagidaki `AksiyonTipi` esitligi listeyi birlesimle KILITLIYOR: birine yeni
 * bir tip eklenip digeri unutulursa derleme kirilir.
 */
export const AKSIYON_TIPLERI = [
  'CEK_DESTEDEN',
  'CEK_ATIKTAN',
  'CALMA_TALEBI',
  'CIFT_TALEBI',
  'AT',
  'AC',
  'ISLE',
  'PER_INDIR',
  'OKEY_CEK',
  'BITIR_ELDEN',
] as const;

export type Aksiyon =
  | (AksiyonTabani & { readonly tip: 'CEK_DESTEDEN' })
  | (AksiyonTabani & { readonly tip: 'CEK_ATIKTAN' })
  | (AksiyonTabani & { readonly tip: 'CALMA_TALEBI' })
  | (AksiyonTabani & { readonly tip: 'CIFT_TALEBI' })
  | (AksiyonTabani & { readonly tip: 'AT'; readonly tasId: TasId })
  | (AksiyonTabani & {
      readonly tip: 'AC';
      readonly perler: readonly (readonly TasId[])[];
      /** §6 istisnasi: acmamis oyuncu yerden okey alip ayni hamlede acabilir. */
      readonly okeyAlimi: OkeyAlimi | null;
    })
  | (AksiyonTabani & {
      readonly tip: 'ISLE';
      readonly perId: number;
      readonly tasIdler: readonly TasId[];
    })
  | (AksiyonTabani & {
      readonly tip: 'PER_INDIR';
      readonly perler: readonly (readonly TasId[])[];
    })
  | (AksiyonTabani & { readonly tip: 'OKEY_CEK' } & OkeyAlimi)
  | (AksiyonTabani & {
      readonly tip: 'BITIR_ELDEN';
      readonly perler: readonly (readonly TasId[])[];
      readonly atilanTasId: TasId;
    });

export type AksiyonTipi = Aksiyon['tip'];

export type HataKodu =
  | PerHatasi
  | SartHatasi
  // Sira ve faz
  | 'el-bitti'
  | 'sira-sende-degil'
  | 'once-cekmelisin'
  | 'zaten-cektin'
  // Tas sahipligi
  | 'tas-elinde-yok'
  | 'atik-yigini-bos'
  | 'son-tas-atilmali'
  // Talep penceresi ve calma
  | 'talep-penceresi-kapali'
  | 'pencere-suresi-dolmadi'
  | 'zaten-talep-ettin'
  | 'atan-talep-edemez'
  | 'sirasi-olan-talep-edemez'
  | 'cift-talebi-sadece-tur-15'
  | 'cift-calma-hakki-kapali'
  | 'cift-elinde-yok'
  | 'cift-talebi-oncelikli'
  | 'zaten-cift-talebi-var'
  // Acma ve isleme
  | 'zaten-actin'
  | 'acmadin'
  | 'acilis-hamlesinde-isleme-yok'
  | 'tur-16-isleme-yok'
  | 'sadece-tur-16'
  | 'per-bulunamadi'
  | 'okey-degil'
  | 'okey-yerine-gecemez'
  | 'alinan-okey-kullanilmadi'
  | 'artan-tas-bir-olmali';

/** CLAUDE.md motor kurali #4. */
export type AksiyonSonucu =
  | { readonly ok: true; readonly state: OyunDurumu }
  | { readonly ok: false; readonly reason: HataKodu };


/**
 * Liste ile birlesim ayni mi? Ikisi ayrisirsa BU SATIR derlenmez.
 * Sunucunun elemesi eksik kalirsa bilinmeyen bir `tip` motora ulasir ve
 * `reduce` hicbir dalla eslesmeden `undefined` doner — sureci dusuren tam
 * olarak buydu.
 */
type ListeTamMi = AksiyonTipi extends (typeof AKSIYON_TIPLERI)[number]
  ? (typeof AKSIYON_TIPLERI)[number] extends AksiyonTipi
    ? true
    : never
  : never;
const _listeTamMi: ListeTamMi = true;
void _listeTamMi;
