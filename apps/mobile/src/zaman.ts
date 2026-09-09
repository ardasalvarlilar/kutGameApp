// "Son görülme" metni.
//
// Saf ve testli, cunku ekranin icinde yazilmis bir tarih bicimlendirmesi
// gozden kaciyor: "0 dakika önce", "-1 saat önce" ve "1 gün önce" yerine
// "24 saat önce" gibi durumlar ancak elle denendiginde goruluyor.
//
// `suAn` disaridan geliyor (CLAUDE.md #2 ile ayni gerekce): boylece test
// gercek saate bagli kalmiyor. Ceviri de disaridan (`t`): modul saf kaliyor
// ve testler dile bagli olmuyor.

import type { Ceviri } from './dil/cevir';

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
export function sonGorulmeMetni(iso: string, suAn: number, t: Ceviri): string {
  const an = Date.parse(iso);
  if (Number.isNaN(an)) return '';

  const fark = suAn - an;
  if (fark < YAKIN_ESIGI) return t('zaman.azOnce');
  if (fark < SAAT) return t('zaman.dakika', { sayi: Math.floor(fark / DAKIKA) });
  if (fark < GUN) return t('zaman.saat', { sayi: Math.floor(fark / SAAT) });

  const gun = Math.floor(fark / GUN);
  if (gun < 30) return t('zaman.gun', { sayi: gun });
  return t('zaman.uzunSure');
}
