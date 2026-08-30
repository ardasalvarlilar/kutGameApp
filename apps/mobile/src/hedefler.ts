// Surukleme birakma hedefleri — masadaki atik obegi ve yerdeki perler.
//
// Kural degil, yerlesim matematigi; `olculer.ts` gibi saf tutuldu ki test
// edilebilsin (React Native import etmiyor).
//
// Neden gerekli: taslar masaya indikce yan sutunlar genisliyor, ortadaki
// obek kayiyor. Sabit bir "yukari surukle = at" esigi hem yanlis yere
// atmaya hem de bir pere isleyememeye sebep oluyordu. Artik her hedefin
// ekrandaki dikdortgeni olculup durumda tutuluyor; birakilan noktanin
// hangi hedefe dustugu buradan cikiyor.

export interface Nokta {
  readonly x: number;
  readonly y: number;
}

export interface Dikdortgen {
  readonly x: number;
  readonly y: number;
  readonly en: number;
  readonly boy: number;
}

/** Tasin birakilabilecegi yer. */
export type Hedef =
  | { readonly tip: 'atik' }
  | { readonly tip: 'per'; readonly perId: number };

export interface HedefKaydi {
  readonly hedef: Hedef;
  readonly alan: Dikdortgen;
}

/**
 * Dikdortgenin disina tasan yakalama payi (px).
 *
 * Atik obegi kucuk bir hedef; parmak tam ustune gelmeden de birakabilmeli.
 * Pay olmasaydi oyuncu tasi atmak icin nisan almak zorunda kalirdi.
 */
export const YAKALAMA_PAYI = 34;

export function merkez(alan: Dikdortgen): Nokta {
  return { x: alan.x + alan.en / 2, y: alan.y + alan.boy / 2 };
}

function icindeMi(nokta: Nokta, alan: Dikdortgen, pay: number): boolean {
  return (
    nokta.x >= alan.x - pay &&
    nokta.x <= alan.x + alan.en + pay &&
    nokta.y >= alan.y - pay &&
    nokta.y <= alan.y + alan.boy + pay
  );
}

function uzaklikKaresi(a: Nokta, b: Nokta): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * Birakilan noktanin dustugu hedef; hicbirine denk gelmiyorsa null
 * (tas istakasina geri doner).
 *
 * Once PAYSIZ olarak icine dusulen hedefler aranir — parmak gercekten bir
 * perin ustundeyse komsu obek onu calmasin. Hicbirinin tam icinde degilse
 * pay kadar genisletilip en yakin merkez secilir.
 */
export function hedefBul(
  nokta: Nokta,
  kayitlar: readonly HedefKaydi[],
  pay: number = YAKALAMA_PAYI,
): Hedef | null {
  const enYakini = (adaylar: readonly HedefKaydi[]): Hedef | null => {
    let secilen: HedefKaydi | null = null;
    let enIyi = Number.POSITIVE_INFINITY;
    for (const kayit of adaylar) {
      const uzaklik = uzaklikKaresi(nokta, merkez(kayit.alan));
      if (uzaklik < enIyi) {
        enIyi = uzaklik;
        secilen = kayit;
      }
    }
    return secilen === null ? null : secilen.hedef;
  };

  const tamIcinde = kayitlar.filter((kayit) => icindeMi(nokta, kayit.alan, 0));
  if (tamIcinde.length > 0) return enYakini(tamIcinde);

  const payIcinde = kayitlar.filter((kayit) => icindeMi(nokta, kayit.alan, pay));
  return enYakini(payIcinde);
}

/** Hedefi kararli bir anahtara cevirir — olcum sozlugunun anahtari. */
export function hedefAnahtari(hedef: Hedef): string {
  return hedef.tip === 'atik' ? 'atik' : `per:${hedef.perId}`;
}

/** `hedefAnahtari`nin tersi; bozuk anahtarda null. */
export function anahtardanHedef(anahtar: string): Hedef | null {
  if (anahtar === 'atik') return { tip: 'atik' };
  if (!anahtar.startsWith('per:')) return null;
  const ham = anahtar.slice(4);
  // Number('') === 0; bos anahtarin 0 numarali pere donusmesini engelle.
  if (!/^\d+$/.test(ham)) return null;
  return { tip: 'per', perId: Number(ham) };
}
