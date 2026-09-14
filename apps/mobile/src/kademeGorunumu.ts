// Kademelerin ekrandaki hali: ad anahtari ve rengi.
//
// Saf (JSX yok) ve ayri dosya: kademe secimi, masa bul, bekleme odasi ve
// profil ayni tabloyu okuyor. Kurallarin kendisi (giris, kilit) @kut/ekonomi'de.

import type { KademeKimligi } from '@kut/ekonomi';
import type { MetinAnahtari } from './dil/cevir';

export const KADEME_ADLARI: Record<KademeKimligi, MetinAnahtari> = {
  caylak: 'kademe.caylak',
  amator: 'kademe.amator',
  tecrubeli: 'kademe.tecrubeli',
  usta: 'kademe.usta',
  profesyonel: 'kademe.profesyonel',
  sampiyon: 'kademe.sampiyon',
  efsane: 'kademe.efsane',
};

/** Kademe yukseldikce isinan renk: soluk maviden altina, oradan kirmizi ve mora. */
export const KADEME_RENKLERI: Record<KademeKimligi, string> = {
  caylak: '#7fa8bd',
  amator: '#4fbf87',
  tecrubeli: '#3d8fe0',
  usta: '#f2c14e',
  profesyonel: '#e5734b',
  sampiyon: '#e0474c',
  efsane: '#b07cff',
};
