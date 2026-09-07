// "Son görülme" metni.
//
// Saf ve testli, cunku ekranin icinde yazilmis bir tarih bicimlendirmesi
// gozden kaciyor: "0 dakika önce", "-1 saat önce" ve "1 gün önce" yerine
// "24 saat önce" gibi durumlar ancak elle denendiginde goruluyor.
//
// `suAn` disaridan geliyor (CLAUDE.md #2 ile ayni gerekce): boylece test
// gercek saate bagli kalmiyor.

const DAKIKA = 60_000;
const SAAT = 60 * DAKIKA;
const GUN = 24 * SAAT;

/** Bu esigin altindaki fark "az önce" sayilir. */
const YAKIN_ESIGI = 3 * DAKIKA;

/**
 * ISO zaman damgasindan okunabilir bir aralik uretir.
 *
 * Ileri tarihli damga (sunucu ile telefon saati arasindaki fark) "az önce"
 * sayiliyor: "-2 dakika önce" yazmaktansa.
 */
export function sonGorulmeMetni(iso: string, suAn: number): string {
  const an = Date.parse(iso);
  if (Number.isNaN(an)) return '';

  const fark = suAn - an;
  if (fark < YAKIN_ESIGI) return 'az önce';
  if (fark < SAAT) return `${Math.floor(fark / DAKIKA)} dk önce`;
  if (fark < GUN) return `${Math.floor(fark / SAAT)} saat önce`;

  const gun = Math.floor(fark / GUN);
  if (gun < 30) return `${gun} gün önce`;
  return 'uzun süredir yok';
}
