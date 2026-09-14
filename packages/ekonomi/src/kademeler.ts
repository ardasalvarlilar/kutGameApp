// Masa kademeleri — hangi masaya kim, kac cipe oturur.
//
// Mac uzunlugu SABIT (16 tur); kademeyi ayiran tek sey giris ucreti ve
// kilidi acan seviye. QT Okey'deki gibi "1/3/7 tur" modlari yok: motor
// maci tur numarasiyla bitiriyor (`tur >= 16`) ve oyunun kendisi bu.
//
// Olcek bilerek BUYUK (Okey 101 Plus gibi): "Efsane masasina oturmak icin
// 5 milyon cip" demek, "1000 cip" demekten daha cok sey anlatiyor. Gercek
// paradaki karsiligi paketlerde (paketler.ts) ayarlaniyor, burada degil.
//
// Kilit YALNIZCA ALTTAN: seviyen yettigi her kademeye oturabilirsin, dusuk
// kademeler kapanmiyor. Ustten kilit (101'deki gibi) arkadaslari farkli
// seviyedeyken ayni masaya oturtmaz ve az oyunculu bir uygulamada hizli
// eslesme kuyrugunu boler.

export const KADEME_KIMLIKLERI = [
  'caylak',
  'amator',
  'tecrubeli',
  'usta',
  'profesyonel',
  'sampiyon',
  'efsane',
] as const;

export type KademeKimligi = (typeof KADEME_KIMLIKLERI)[number];

export interface Kademe {
  readonly kimlik: KademeKimligi;
  /** Masaya oturmak icin odenen cip (oyuncu basina). */
  readonly giris: number;
  /** Bu kademenin acildigi seviye. */
  readonly minSeviye: number;
}

export const KADEMELER: readonly Kademe[] = [
  { kimlik: 'caylak', giris: 5_000, minSeviye: 1 },
  { kimlik: 'amator', giris: 15_000, minSeviye: 3 },
  { kimlik: 'tecrubeli', giris: 50_000, minSeviye: 6 },
  { kimlik: 'usta', giris: 150_000, minSeviye: 10 },
  { kimlik: 'profesyonel', giris: 500_000, minSeviye: 15 },
  { kimlik: 'sampiyon', giris: 1_500_000, minSeviye: 22 },
  { kimlik: 'efsane', giris: 5_000_000, minSeviye: 30 },
];

/** Eski istemci kademe gondermezse. */
export const VARSAYILAN_KADEME: KademeKimligi = 'caylak';

/**
 * Yeni hesaba verilen cip: Caylak masasinda UC mac.
 *
 * Bilerek az. Uc macta bir kez bile kazanan oyuncu devam edebiliyor;
 * kazanamayan satin almak zorunda.
 */
export const BASLANGIC_CIPI = 15_000;

export function kademeGecerliMi(deger: unknown): deger is KademeKimligi {
  return typeof deger === 'string' && (KADEME_KIMLIKLERI as readonly string[]).includes(deger);
}

export function kademeBul(kimlik: KademeKimligi): Kademe {
  return KADEMELER.find((kademe) => kademe.kimlik === kimlik) as Kademe;
}

export type OturmaEngeli = 'seviye-yetersiz' | 'cip-yetersiz';

/**
 * Oyuncu bu kademeye oturabilir mi? Oturabiliyorsa null.
 *
 * Seviye once soruluyor: seviyesi yetmeyen oyuncuya "cipin yetmiyor" demek,
 * cip alsa oturabilecegini sandirirdi.
 */
export function oturmaEngeli(
  oyuncu: { readonly seviye: number; readonly cip: number },
  kademe: Kademe,
): OturmaEngeli | null {
  if (oyuncu.seviye < kademe.minSeviye) return 'seviye-yetersiz';
  if (oyuncu.cip < kademe.giris) return 'cip-yetersiz';
  return null;
}
