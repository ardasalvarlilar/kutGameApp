// Gorunen ad denetimi.
//
// Oyunda sohbet YOK; oyuncudan gelen tek serbest metin gorunen ad. App Store
// 1.2 kullanici uretimi icerik icin "uygunsuz icerigi suzme" istiyor ve
// pratikte denetlenen sey bu alan.
//
// Filtre bilerek KUCUK ve saf: hicbir listeye "her sey yakalanir" gozuyle
// bakilamaz. Isin asil yuku sikayet + engelleme tarafinda (modeller/Sikayet.ts);
// burasi yalnizca en kaba olani kapida ceviriyor.
//
// Turkce'ye ozgu iki tuzak var ve ikisi de burada:
//   - 'İ'.toLowerCase() Turkce'de 'i', Ingilizce'de 'i̇' (birlesik nokta) —
//     locale vermezsek karsilastirma sessizce kayiyor
//   - harf yerine rakam/isaret koyma ("s1kt1r"), bu yuzden once normalize

const YASAKLI_PARCALAR = [
  'amk', 'aq', 'oc', 'orospu', 'sikeyim', 'sikim', 'sikerim', 'siktir', 'yarrak',
  'yarak', 'gotveren', 'ibne', 'pezevenk', 'piç', 'pic', 'amina', 'aminakoyim',
  'kahpe', 'godumu', 'gotunu', 'sirtlan',
  'fuck', 'shit', 'bitch', 'cunt', 'nigger', 'rape', 'nazi', 'hitler',
] as const;

/** Kendini sunucu/yonetici gibi gostermeye calisan adlar. */
const SAHIPLENME = ['admin', 'yonetici', 'moderator', 'kut resmi', 'destek', 'support'] as const;

/** Rakam-harf oyunlarini ve aksani duzler; karsilastirma bunun uzerinde. */
function normalize(ad: string): string {
  return ad
    .toLocaleLowerCase('tr-TR')
    .replace(/[ıîi̇]/g, 'i')
    .replace(/[şs]/g, 's')
    .replace(/[ğg]/g, 'g')
    .replace(/[üu]/g, 'u')
    .replace(/[öo]/g, 'o')
    .replace(/[çc]/g, 'c')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/[^a-z ]/g, '');
}

export type AdSorunu = 'uygunsuz' | 'sahiplenme' | 'bos' | 'sadece-isaret';

/** Ad kabul edilebilir mi? Sorun yoksa null. */
export function adSorunu(ad: string): AdSorunu | null {
  const kirpik = ad.trim();
  if (kirpik.length < 2) return 'bos';

  // En az bir harf ya da rakam olsun: "!!!!" ya da "___" ad degil.
  if (!/[\p{L}\p{N}]/u.test(kirpik)) return 'sadece-isaret';

  const duz = normalize(kirpik);
  const boslukzuz = duz.replace(/ /g, '');

  for (const parca of YASAKLI_PARCALAR) {
    if (boslukzuz.includes(normalize(parca).replace(/ /g, ''))) return 'uygunsuz';
  }
  for (const parca of SAHIPLENME) {
    if (duz.includes(normalize(parca))) return 'sahiplenme';
  }
  return null;
}

export const AD_SORUN_METINLERI: Record<AdSorunu, string> = {
  uygunsuz: 'Bu ad uygun değil, başka bir ad seç',
  sahiplenme: 'Bu ad oyunun görevlisiymişsin izlenimi veriyor, başka bir ad seç',
  bos: 'Ad en az 2 harf olmalı',
  'sadece-isaret': 'Adda en az bir harf ya da rakam olmalı',
};
