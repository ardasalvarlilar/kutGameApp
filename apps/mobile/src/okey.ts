// Yerden okey cekme — ekranin ihtiyac duydugu karar.
//
// Kural KURALLAR.md §6'da, uygulamasi motorda (`okeyCekilebilirMi`,
// `OKEY_CEK`, `AC` icindeki `okeyAlimi`). Burasi ikisinin arasindaki bosluk:
// hangi firsat secilir, acmamis oyuncu icin hangi acilis kurulur.
//
// Saf tutuldu — durum degistirmiyor, gecerlilik karari yine motorun.

import type { OkeyFirsati, OyuncuGorunumu, TasId } from '@kut/engine';
import { acilisBul } from './bot';
import { gruplariKimlige } from './dizme';

/**
 * Kullanilacak firsati secer: secili taslarla ortusen varsa o, yoksa ilki.
 * Oyuncu bir tasi isaretleyerek hangi okeyi istedigini soyleyebiliyor.
 */
export function okeyFirsatiSec(
  firsatlar: readonly OkeyFirsati[],
  secili: readonly TasId[],
): OkeyFirsati | null {
  const uyan = firsatlar.find((firsat) =>
    firsat.yerineTasIdler.every((id) => secili.includes(id)),
  );
  return uyan ?? firsatlar[0] ?? null;
}

/**
 * KURALLAR.md §6 istisnasi — hic acmamis oyuncu okeyi alip AYNI hamlede
 * acabilir. Aldigi okeyi o acilista kullanmak ZORUNDADIR; istakaya alip
 * saklayamaz.
 *
 * Acilisi burada ariyoruz cunku okey henuz oyuncunun elinde degil: onu
 * istaka izgarasina suruklemesi mumkun degil. Once okeyin ele geldigi hali
 * kuruyoruz, sonra `acilisBul`a okeyi ZORUNLU tas olarak veriyoruz — okeyi
 * kullanmayan bir cozum kabul edilmiyor.
 *
 * Acilis kurulamiyorsa null; o zaman oyuncu bu okeyi alamaz.
 */
export function okeyleAcilisBul(
  gorunum: OyuncuGorunumu,
  firsat: OkeyFirsati,
): readonly (readonly TasId[])[] | null {
  if (gorunum.acmisMi[gorunum.ben]) return null;

  const okeyTas = gorunum.yer
    .find((per) => per.id === firsat.perId)
    ?.taslar.find((tas) => tas.id === firsat.okeyTasId);
  if (okeyTas === undefined) return null;

  const sonrakiEl = [
    ...gorunum.istakam.filter((tas) => !firsat.yerineTasIdler.includes(tas.id)),
    okeyTas,
  ];

  const cozum = acilisBul(sonrakiEl, gorunum.tur, firsat.okeyTasId);
  return cozum === null ? null : gruplariKimlige(cozum);
}

/**
 * Bu firsat su an kullanilabilir mi?
 *
 * Iki yol var (§6):
 *  - Normal: acmis ve uzerinden bir tur donmusse okey dogrudan istakaya gelir.
 *  - Istisna: hic acmamissa, ancak okeyle eli aciliyorsa alabilir.
 */
export function okeyAlinabilirMi(
  gorunum: OyuncuGorunumu,
  firsat: OkeyFirsati | null,
): boolean {
  if (firsat === null) return false;
  if (gorunum.faz !== 'atma' || gorunum.siradaki !== gorunum.ben) return false;
  if (gorunum.islemeYapabilirim) return true;
  return okeyleAcilisBul(gorunum, firsat) !== null;
}
