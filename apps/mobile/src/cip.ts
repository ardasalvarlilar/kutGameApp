// Cip miktarlarinin ekrandaki hali.
//
// Iki bicim var cunku iki ayri yer var: bakiye ve tablo tam sayi ister
// ("1.500.000"), dar kartlar kisa bicim ("1,5M"). Intl'e yaslanmiyoruz:
// Hermes'in Intl destegi surume gore degisiyor ve bu iki kural elle yazilacak
// kadar basit.

/** Binlik ayiracli tam sayi: 1500000 → "1.500.000". */
export function cipYaz(miktar: number): string {
  const isaret = miktar < 0 ? '-' : '';
  const rakamlar = String(Math.abs(Math.trunc(miktar)));
  return isaret + rakamlar.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

const BIRIMLER: readonly (readonly [number, string])[] = [
  [1_000_000_000, 'B'],
  [1_000_000, 'M'],
  [1_000, 'K'],
];

/** Kisa bicim: 5000 → "5K", 1500000 → "1,5M". Ondalik tek hane, ",0" yazilmaz. */
export function cipKisa(miktar: number): string {
  const mutlak = Math.abs(miktar);
  for (const [bolen, harf] of BIRIMLER) {
    if (mutlak < bolen) continue;
    const deger = Math.floor((mutlak / bolen) * 10) / 10;
    const metin = Number.isInteger(deger) ? String(deger) : deger.toFixed(1).replace('.', ',');
    return (miktar < 0 ? '-' : '') + metin + harf;
  }
  return String(Math.trunc(miktar));
}
