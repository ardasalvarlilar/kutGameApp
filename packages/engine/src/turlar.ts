// 16 turun acilis sartlari ve sart dogrulayicisi. KURALLAR.md §3, §6

import type { Per, PerTipi } from './per';
import type { TurNo } from './tipler';

export type SartParcasi =
  | { readonly tip: 'kut'; readonly uzunluk: number }
  | { readonly tip: 'seri'; readonly uzunluk: number }
  | { readonly tip: 'cift'; readonly uzunluk: 2 }
  | { readonly tip: 'elden-bitme' };

export interface TurSarti {
  readonly tur: TurNo;
  readonly parcalar: readonly SartParcasi[];
  /** Sarti karsilamak icin yere inecek tas sayisi. Tur 16'da 0 — yere per inmez. */
  readonly tasSayisi: number;
  /** Ekranda gosterilen sart metni — kullaniciya gorundugu icin duzgun Turkce. */
  readonly aciklama: string;
}

const kut = (uzunluk: number): SartParcasi => ({ tip: 'kut', uzunluk });
const seri = (uzunluk: number): SartParcasi => ({ tip: 'seri', uzunluk });
const cift = (): SartParcasi => ({ tip: 'cift', uzunluk: 2 });

function sart(tur: TurNo, parcalar: readonly SartParcasi[], aciklama: string): TurSarti {
  let tasSayisi = 0;
  for (const parca of parcalar) {
    if (parca.tip !== 'elden-bitme') tasSayisi += parca.uzunluk;
  }
  return { tur, parcalar, tasSayisi, aciklama };
}

/**
 * KURALLAR.md §3 tablosu, oldugu gibi.
 * §9.2 (karara baglandi): tur 4, 5 ve 9 gercekten tek perdir; tablo degismez.
 */
export const TUR_SARTLARI: readonly TurSarti[] = [
  sart(1, [kut(3), kut(3)], '2 × üçlü küt'),
  sart(2, [seri(3), seri(3)], '2 × üçlü seri'),
  sart(3, [kut(3), seri(3)], '1 üçlü küt + 1 üçlü seri'),
  sart(4, [kut(4)], '1 × dörtlü küt'),
  sart(5, [seri(4)], '1 × dörtlü seri'),
  sart(6, [kut(4), kut(4)], '2 × dörtlü küt'),
  sart(7, [seri(4), seri(4)], '2 × dörtlü seri'),
  sart(8, [kut(4), seri(4)], '1 dörtlü küt + 1 dörtlü seri'),
  sart(9, [seri(5)], '1 × beşli seri'),
  sart(10, [seri(5), kut(3)], '1 beşli seri + 1 üçlü küt'),
  sart(11, [seri(5), seri(3)], '1 beşli seri + 1 üçlü seri'),
  sart(12, [seri(5), kut(4)], '1 beşli seri + 1 dörtlü küt'),
  sart(13, [seri(5), seri(4)], '1 beşli seri + 1 dörtlü seri'),
  sart(14, [seri(5), seri(5)], '2 × beşli seri'),
  // §9.1 (karara baglandi): cift = birebir ayni tas (kirmizi7 + kirmizi7).
  sart(15, [cift(), cift(), cift(), cift()], '4 çift'),
  sart(16, [{ tip: 'elden-bitme' }], 'Elden bitme'),
];

export function turSarti(tur: TurNo): TurSarti {
  const bulunan = TUR_SARTLARI.find((s) => s.tur === tur);
  // TUR_SARTLARI 1..16 turlarinin tamamini icerir; bu dal erisilemez.
  if (bulunan === undefined) throw new RangeError(`bilinmeyen tur: ${tur}`);
  return bulunan;
}

/** KURALLAR.md §3 — tur 16'da yere hic per inmez, kimse acmaz. */
export function eldenBitmeTuruMu(tur: TurNo): boolean {
  return turSarti(tur).parcalar.some((p) => p.tip === 'elden-bitme');
}

export type SartHatasi = 'sart-eksik' | 'sart-fazla' | 'sart-uyusmuyor' | 'tur-16-acma-yok';

export type SartSonucu = { readonly ok: true } | { readonly ok: false; readonly reason: SartHatasi };

function anahtar(tip: PerTipi, uzunluk: number): string {
  return `${tip}:${uzunluk}`;
}

/**
 * KURALLAR.md §6 — "Ne eksik, ne fazla."
 * Sart uclu kutse dortlu kut acilamaz; sart 1 kut + 1 seriyse iki kut indirilemez.
 * Bu yuzden esleme hem tipe hem tam uzunluga bakar ve birebirdir.
 */
export function sartKarsilaniyorMu(perler: readonly Per[], tur: TurNo): SartSonucu {
  const { parcalar } = turSarti(tur);
  if (eldenBitmeTuruMu(tur)) return { ok: false, reason: 'tur-16-acma-yok' };

  if (perler.length < parcalar.length) return { ok: false, reason: 'sart-eksik' };
  if (perler.length > parcalar.length) return { ok: false, reason: 'sart-fazla' };

  const gereken = new Map<string, number>();
  for (const parca of parcalar) {
    if (parca.tip === 'elden-bitme') continue;
    const k = anahtar(parca.tip, parca.uzunluk);
    gereken.set(k, (gereken.get(k) ?? 0) + 1);
  }

  for (const per of perler) {
    const k = anahtar(per.tip, per.taslar.length);
    const kalan = gereken.get(k);
    if (kalan === undefined || kalan === 0) return { ok: false, reason: 'sart-uyusmuyor' };
    gereken.set(k, kalan - 1);
  }

  for (const kalan of gereken.values()) {
    if (kalan !== 0) return { ok: false, reason: 'sart-uyusmuyor' };
  }

  return { ok: true };
}
