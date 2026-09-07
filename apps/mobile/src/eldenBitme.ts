// Tur 16 — elden bitme (KURALLAR.md §3).
//
// Diger turlardan farki: yere hic per inmez. Oyuncu butun elini gecerli
// perlere boler, geriye tek tas kalir, onu ortaya atarak biter.
//
// Bu bir KURAL DEGIL, kolaylik: hangi tasin hangi pere gittigini oyuncunun
// tek tek isaretlemesine gerek kalmasin diye bolunmeyi burada ariyoruz.
// Gecerlilik karari yine motorun — bulunan bolme `BITIR_ELDEN` ile gonderilir
// ve motor kabul edip etmemeye kendisi karar verir.
//
// Saf tutuldu ki test edilebilsin (React Native import etmiyor).
//
// --- Neden bu kadar dikkatli yazildi ---------------------------------------
//
// Ilk surumu her adimda kalan taslarin BUTUN alt kumelerini uretiyordu.
// 14 taslik bir el icin tepe seviyede ~8000 dizi, altinda binlercesi daha.
// Bolunen eller hemen sonuclandigi icin uzun sure fark edilmedi; sorun
// BOLUNMEYEN elde cikti — agacin tamami geziliyordu. Ustune `bitirenTaslar`
// bunu her tas icin bir kez yapiyor ve ekran her sunucu paketinde yeniden
// cagiriyordu.
//
// Olculdu (Node, Apple Silicon): 15 tas 68 ms, calma yuzunden buyumus
// 20 taslik bir el 3.6 SANIYE. Telefonda (Hermes) bunun katlari — tur 16'da
// her cekiste/atista yasanan donmanin kaynagi buydu.
//
// Iki degisiklik: (1) aday perler artik kalan taslarin tamamindan degil iki
// dar HAVUZDAN kuruluyor, (2) alt problemler BELLEKLENIYOR. Ikisi de sonucu
// degistirmiyor, yalnizca ayni sonuca cok daha hizli variyor.

import {
  MAKS_KUT,
  MIN_PER,
  kutMu,
  normalMi,
  okeyMi,
  seriMu,
  type NormalTas,
  type Tas,
  type TasId,
} from '@kut/engine';

/** Seri en fazla 13 tastir (1'den 13'e) — KURALLAR.md §2. */
const EN_COK_SERI = 13;

function gecerliPerMi(taslar: readonly Tas[]): boolean {
  return kutMu(taslar).ok || seriMu(taslar).ok;
}

/**
 * Okeyleri sona alir.
 *
 * Arama her adimda KALAN ILK TASI ele aliyor; bu siralama sayesinde o tas
 * normal bir tas olmayi garanti ediyor (geriye yalnizca okey kaldiysa zaten
 * per kurulamaz, §2 "sadece okeylerden olusan perin sayisi belirsizdir").
 * Ilkin normal olmasi, asagidaki havuz elemesinin dayanagi.
 */
function okeylerSona(taslar: readonly Tas[]): readonly Tas[] {
  const normaller = taslar.filter(normalMi);
  if (normaller.length === taslar.length) return taslar;
  return [...normaller, ...taslar.filter(okeyMi)];
}

/**
 * `ilk` tasini iceren GECERLI perler.
 *
 * Puf noktasi KURALLAR.md §2'nin iki cumlesi:
 *
 *   - kutteki normal taslarin hepsi AYNI SAYIDA olur
 *   - serideki normal taslarin hepsi AYNI RENKTE olur
 *
 * Dolayisiyla `ilk`i iceren bir per, kalan taslarin tamamindan degil yalnizca
 * su iki havuzdan kurulabilir: {ayni sayi} ∪ {okey} ve {ayni renk} ∪ {okey}.
 * 13 taslik bir kalanda havuzlar tipik olarak 2–6 tas; taranan aday sayisi
 * binlerden onlara iniyor. Eleme SAF: gecerli hicbir per disarida kalmiyor,
 * yalnizca hicbir zaman gecerli olamayacaklar denenmiyor.
 */
function ilkiIcerenPerler(ilk: NormalTas, kalan: readonly Tas[]): readonly (readonly Tas[])[] {
  const bulunan: Tas[][] = [];
  const gorulen = new Set<string>();

  const tara = (havuz: readonly Tas[], enCok: number): void => {
    const secilen: Tas[] = [];
    const gez = (bas: number): void => {
      if (secilen.length + 1 >= MIN_PER) {
        const aday = [ilk, ...secilen];
        // Iki havuz yalnizca okeylerde ortusuyor (`ilk + okey + okey` her
        // ikisinden de cikabiliyor); ayni aday iki kez denenmesin.
        const anahtar = aday.map((tas) => tas.id).join('|');
        if (!gorulen.has(anahtar) && gecerliPerMi(aday)) {
          gorulen.add(anahtar);
          bulunan.push(aday);
        }
      }
      if (secilen.length + 1 >= enCok) return;
      for (let i = bas; i < havuz.length; i++) {
        secilen.push(havuz[i] as Tas);
        gez(i + 1);
        secilen.pop();
      }
    };
    gez(0);
  };

  // Kut havuzu: ayni sayidaki taslar + okeyler. Kut en fazla dort tas (§2).
  tara(
    kalan.filter((tas) => okeyMi(tas) || tas.sayi === ilk.sayi),
    MAKS_KUT,
  );
  // Seri havuzu: ayni renkteki taslar + okeyler.
  tara(
    kalan.filter((tas) => okeyMi(tas) || tas.renk === ilk.renk),
    EN_COK_SERI,
  );

  return bulunan;
}

type Bolme = readonly (readonly Tas[])[] | null;

/**
 * Bolme arayan asil dongu. `taslar` OKEYLER SONA sirasinda olmali.
 *
 * `bellek` alt problemleri tutuyor ve asil kazanc orada: `bitirenTaslar`
 * ayni elden tek tas cikararak 15 ayri arama yapiyor, bu aramalarin alt
 * problemleri buyuk olcude ORTAK. Basarisizliklar da bellege giriyor —
 * zaman zaten orada harcaniyordu.
 *
 * Anahtar tas kimliklerinin sirali birlesimi; siralama tepede bir kez
 * kuruluyor ve `filter` onu bozmadigi icin ayni kume daima ayni anahtari
 * veriyor.
 */
function bolmeAra(taslar: readonly Tas[], bellek: Map<string, Bolme>): Bolme {
  if (taslar.length === 0) return [];
  if (taslar.length < MIN_PER) return null;

  const anahtar = taslar.map((tas) => tas.id).join('|');
  const bilinen = bellek.get(anahtar);
  if (bilinen !== undefined) return bilinen;

  const ilk = taslar[0] as Tas;
  let sonuc: Bolme = null;

  // Okeyler sonda oldugu icin ilk tas okeyse geriye yalnizca okey kalmistir;
  // okeylerden per kurulamaz (§2).
  if (normalMi(ilk)) {
    for (const aday of ilkiIcerenPerler(ilk, taslar.slice(1))) {
      const secilenler = new Set(aday.map((tas) => tas.id));
      const geri = bolmeAra(
        taslar.filter((tas) => !secilenler.has(tas.id)),
        bellek,
      );
      if (geri !== null) {
        sonuc = [aday, ...geri];
        break;
      }
    }
  }

  bellek.set(anahtar, sonuc);
  return sonuc;
}

/**
 * Taslarin tamamini gecerli perlere boler; bolunmuyorsa null.
 *
 * Her adimda KALAN ILK TASI ele aliyoruz: o tas bir yere girmek zorunda,
 * dolayisiyla yalnizca onu iceren perleri denemek yeterli.
 */
export function perlereBol(taslar: readonly Tas[]): readonly (readonly Tas[])[] | null {
  return bolmeAra(okeylerSona(taslar), new Map());
}

export interface EldenBitmeCozumu {
  /** Motora gonderilecek per gruplari (tas kimlikleri). */
  readonly perler: readonly (readonly TasId[])[];
  /** Ortaya atilacak tas. */
  readonly atilanTasId: TasId;
}

function cozumeCevir(bolme: readonly (readonly Tas[])[], atilanTasId: TasId): EldenBitmeCozumu {
  return { perler: bolme.map((per) => per.map((tas) => tas.id)), atilanTasId };
}

/**
 * `atilanTasId` atildiginda elin geri kalani perlere bolunuyor mu?
 *
 * Bolunuyorsa `BITIR_ELDEN` icin hazir cozum, bolunmuyorsa null (o zaman
 * normal atis yapilir ve oyun devam eder).
 */
export function eldenBitmeCozumu(
  istaka: readonly Tas[],
  atilanTasId: TasId,
): EldenBitmeCozumu | null {
  if (!istaka.some((tas) => tas.id === atilanTasId)) return null;

  const kalan = okeylerSona(istaka).filter((tas) => tas.id !== atilanTasId);
  // §7 — bitis son tasi ortaya atarak olur; geriye per kalmali.
  if (kalan.length < MIN_PER) return null;

  const bolme = bolmeAra(kalan, new Map());
  return bolme === null ? null : cozumeCevir(bolme, atilanTasId);
}

/**
 * Elden bitmek icin ATILABILECEK taslar.
 *
 * Ekran bunu ipucu olarak kullaniyor: oyuncu hangi tasi atarsa bitecegini
 * gormeden once denemek zorunda kalmasin.
 *
 * Tek bir `bellek` ile: 15 aramanin girdisi ayni elden birer tas eksiktir,
 * yani alt problemlerinin cogu ortak. Ayri ayri arasaydik ayni bosluklari
 * onbes kez tararduk.
 */
export function bitirenTaslar(istaka: readonly Tas[]): readonly TasId[] {
  const sirali = okeylerSona(istaka);
  const bellek = new Map<string, Bolme>();
  const sonuc: TasId[] = [];

  for (const tas of istaka) {
    const kalan = sirali.filter((diger) => diger.id !== tas.id);
    if (kalan.length < MIN_PER) continue;
    if (bolmeAra(kalan, bellek) !== null) sonuc.push(tas.id);
  }
  return sonuc;
}
