// Dil desteğinin SAF çekirdeği — JSX yok, React yok.
//
// Ayrı dosya olmasının sebebi somut: `zaman.ts` ve `hataMetinleri.ts` gibi saf
// modüller de çeviri kullanıyor ve testleri React'siz koşuyor. Sağlayıcı
// (`index.tsx`) JSX içerdiği için o dosyayı import etmek, saf testleri
// React Native'e bağımlı hale getiriyordu — vitest de zaten çözemedi.
//
// Metinlerin tamamı `tr.json` ve `en.json`da; kodda hiçbir yerde gömülü
// cümle kalmıyor. Yeni bir dil eklemek üçüncü bir JSON dosyası ve buradaki
// iki satır demek.
//
// ANAHTARLAR TİPLİ. `t('lobi.hizliOyna')` derlenir, `t('lobi.hizliOyan')`
// derlenmez. 250'den fazla metinle bu bir konfor değil zorunluluk: yazım
// hatası sessizce ekranda ham anahtar gösterirdi. Aynı şekilde `en.json`
// bir anahtarı kaçırırsa aşağıdaki `EN_TAM` satırı derlemeyi kırar —
// çeviri eksiği derleme zamanında yakalanıyor.
//
// Kütüphane kullanmadık: i18next'in getirdiği çoğul/bağlam makinesine
// ihtiyaç duyan tek bir metin yok, buna karşılık tipli anahtarları
// kaybederdik.

import en from './en.json';
import tr from './tr.json';

export const DILLER = ['tr', 'en'] as const;
export type Dil = (typeof DILLER)[number];

/** Dillerin oyuncuya gösterilen adları — her zaman KENDİ dilinde. */
export const DIL_ADLARI: Record<Dil, string> = { tr: 'Türkçe', en: 'English' };

/**
 * Varsayılan Türkçe.
 *
 * Cihazın diline BAKMIYORUZ: oyun Türkçe bir oyun, oyuncuların çoğu Türkçe
 * oynuyor ve cihaz dili İngilizce olan bir Türk oyuncuyu İngilizceye
 * düşürmek kötü bir varsayım olurdu. İsteyen ayarlardan değiştiriyor.
 */
export const VARSAYILAN_DIL: Dil = 'tr';

/** Türkçe sözlük anahtarların KAYNAĞI; diğer diller ona uymak zorunda. */
export type MetinAnahtari = keyof typeof tr;

/** `en.json`da eksik anahtar varsa BU SATIR derlenmez. */
const EN_TAM: Record<MetinAnahtari, string> = en;

const SOZLUKLER: Record<Dil, Record<MetinAnahtari, string>> = { tr, en: EN_TAM };

/** `{ad}` gibi yer tutucuların yerine konacak değerler. */
export type Degerler = Readonly<Record<string, string | number>>;

export type Ceviri = (anahtar: MetinAnahtari, degerler?: Degerler) => string;

export function dilGecerliMi(deger: string | null): deger is Dil {
  return deger !== null && (DILLER as readonly string[]).includes(deger);
}

/**
 * Saf çeviri — bileşen dışında da kullanılabilsin diye ayrı.
 *
 * Sözlükte bulunmayan bir anahtar (yalnızca çalışma zamanında bozuk bir
 * JSON'la mümkün) Türkçesine düşer: boş ekran göstermekten iyi.
 */
export function cevir(dil: Dil, anahtar: MetinAnahtari, degerler?: Degerler): string {
  const kalip = SOZLUKLER[dil][anahtar] ?? tr[anahtar];
  if (degerler === undefined) return kalip;
  return kalip.replace(/\{(\w+)\}/g, (tam, ad: string) => {
    const deger = degerler[ad];
    return deger === undefined ? tam : String(deger);
  });
}
