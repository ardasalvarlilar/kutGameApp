// Istakayi otomatik dizme.
//
// Bu bir KURAL DEGIL, kolaylik. Motorun disinda duruyor: hicbir oyun durumu
// degistirmez, yalnizca elindeki taslarin ekranda hangi sirayla ve hangi
// gruplar halinde duracagini soyler. Gecerlilik kararini yine motor veriyor
// (seriMu / kutMu), burada kendi kural yorumumuz yok.

import {
  kutMu,
  okeyMi,
  seriMu,
  type NormalTas,
  type Renk,
  type Sayi,
  type Tas,
} from '@kut/engine';

/** Istakadaki bir bolme — ekranda aralarinda bosluk birakilarak cizilir. */
export type Grup = readonly Tas[];

const RENK_SIRASI: Record<Renk, number> = { kirmizi: 0, siyah: 1, mavi: 2, sari: 3 };

function normalMi(tas: Tas): tas is NormalTas {
  return tas.tip === 'normal';
}

function sayiyaGore(a: NormalTas, b: NormalTas): number {
  return a.sayi - b.sayi;
}

/** Once renk, sonra sayi — seri ararken ayni rengin taslari yan yana gelsin. */
function renkOnce(a: Tas, b: Tas): number {
  if (okeyMi(a)) return okeyMi(b) ? 0 : 1;
  if (okeyMi(b)) return -1;
  const renkFarki = RENK_SIRASI[a.renk] - RENK_SIRASI[b.renk];
  return renkFarki !== 0 ? renkFarki : a.sayi - b.sayi;
}

/** Once sayi, sonra renk — kut ararken ayni sayinin taslari yan yana gelsin. */
function sayiOnce(a: Tas, b: Tas): number {
  if (okeyMi(a)) return okeyMi(b) ? 0 : 1;
  if (okeyMi(b)) return -1;
  const sayiFarki = a.sayi - b.sayi;
  return sayiFarki !== 0 ? sayiFarki : RENK_SIRASI[a.renk] - RENK_SIRASI[b.renk];
}

function son<T>(dizi: readonly T[]): T | undefined {
  return dizi[dizi.length - 1];
}

/**
 * Bolme sirasi: once ACILABILIR perler (uzundan kisaya), sonra tek bir
 * "kalanlar" bolmesi.
 *
 * Ikili adaylar ayri bolme YAPILMAZ: `kirmizi1 + kirmizi2` ardisik olsa da
 * acilamaz, per icin en az 3 tas gerekir (KURALLAR.md §2). Ayri bolme olarak
 * gostermek onu acilabilirmis gibi gosterirdi. Kalanlar yine moda gore
 * siralanir, boylece yakin taslar zaten yan yana durur.
 */
function birlestir(
  perler: readonly Grup[],
  kalanlar: readonly Tas[],
  siralama: (a: Tas, b: Tas) => number,
): readonly Grup[] {
  const perSirali = [...perler].sort((a, b) => b.length - a.length);
  const kalanSirali = [...kalanlar].sort(siralama);
  return kalanSirali.length > 0 ? [...perSirali, kalanSirali] : perSirali;
}

// --- Ortak: okey harcama oncelikleri ---------------------------------------
//
// Okey kit kaynak. Once pere DONUSECEK yerlere harcanir:
//   1. Bosluk koprusu ve ikili adaylar (1 okey → 1 per)
//   2. Tek taslar (2 okey → 1 per)
// Yoksa tek basina duran bir tasa harcanip kut/seri yapacak ikili bos kalir.

function okeyleTamamla(
  adaylar: readonly (readonly Tas[])[],
  okeyHavuzu: Tas[],
  gecerliMi: (taslar: readonly Tas[]) => boolean,
): { readonly perler: Grup[]; readonly kalanAdaylar: (readonly Tas[])[] } {
  const perler: Grup[] = [];
  const tamamlananlar = new Set<readonly Tas[]>();

  // Once 1 okeyle tamamlanan ikililer, sonra 2 okey isteyen tekler.
  // Uzunluk kontrolu iki gecisi zaten ayirir; bir aday iki kez islenmez.
  for (const gereken of [1, 2]) {
    for (const aday of adaylar) {
      if (aday.length + gereken !== 3) continue;
      if (okeyHavuzu.length < gereken) continue;
      const genis = [...aday, ...okeyHavuzu.slice(0, gereken)];
      if (!gecerliMi(genis)) continue;
      okeyHavuzu.splice(0, gereken);
      perler.push(genis);
      tamamlananlar.add(aday);
    }
  }

  return { perler, kalanAdaylar: adaylar.filter((aday) => !tamamlananlar.has(aday)) };
}

// --- Seri dizme --------------------------------------------------------------

/**
 * Ayni rengin ardisik taslarini zincirler. Ayni sayidan iki tas varsa ikincisi
 * yeni bir zincir baslatir — bir seride ayni sayi iki kez bulunamaz.
 */
function zincirle(renkTaslari: readonly NormalTas[]): NormalTas[][] {
  const zincirler: NormalTas[][] = [];
  for (const tas of [...renkTaslari].sort(sayiyaGore)) {
    const hedef = zincirler.find((zincir) => {
      const sonTas = son(zincir);
      return sonTas !== undefined && sonTas.sayi === tas.sayi - 1;
    });
    if (hedef === undefined) zincirler.push([tas]);
    else hedef.push(tas);
  }
  return zincirler;
}

/**
 * Aralarinda tek sayilik bosluk olan iki zinciri okeyle koprular.
 * Kopru daima en az 3 tasli bir seri uretir, yani okey bosa gitmez.
 */
function kopruleAt(zincirler: NormalTas[][], okeyHavuzu: Tas[]): (readonly Tas[])[] {
  const sirali = [...zincirler].sort((a, b) => (a[0]?.sayi ?? 0) - (b[0]?.sayi ?? 0));
  const sonuc: (readonly Tas[])[] = [];

  for (const zincir of sirali) {
    const oncekiIndex = sonuc.length - 1;
    const onceki = sonuc[oncekiIndex];
    const oncekiSon = onceki === undefined ? undefined : son(onceki);
    const ilk = zincir[0];

    if (
      onceki !== undefined &&
      oncekiSon !== undefined &&
      ilk !== undefined &&
      !okeyMi(oncekiSon) &&
      oncekiSon.sayi === ilk.sayi - 2 &&
      okeyHavuzu.length > 0
    ) {
      const okey = okeyHavuzu[0] as Tas;
      const birlesik = [...onceki, okey, ...zincir];
      if (seriMu(birlesik).ok) {
        okeyHavuzu.shift();
        sonuc[oncekiIndex] = birlesik;
        continue;
      }
    }
    sonuc.push(zincir);
  }
  return sonuc;
}

/**
 * Eldeki taslari seri (ayni renk, ardisik) gruplarina dizer.
 * Gecerli seriler basa, ikili adaylar ortaya, kalan taslar sona gelir.
 */
export function seriDiz(taslar: readonly Tas[]): readonly Grup[] {
  const okeyHavuzu: Tas[] = taslar.filter(okeyMi);
  const normaller = taslar.filter(normalMi);

  const renkBazli = new Map<Renk, NormalTas[]>();
  for (const tas of normaller) {
    const mevcut = renkBazli.get(tas.renk);
    if (mevcut === undefined) renkBazli.set(tas.renk, [tas]);
    else mevcut.push(tas);
  }

  const perler: Grup[] = [];
  const adaylar: (readonly Tas[])[] = [];

  const renkler = [...renkBazli.keys()].sort((a, b) => RENK_SIRASI[a] - RENK_SIRASI[b]);
  for (const renk of renkler) {
    for (const zincir of kopruleAt(zincirle(renkBazli.get(renk) ?? []), okeyHavuzu)) {
      if (zincir.length >= 3) perler.push(zincir);
      else adaylar.push(zincir);
    }
  }

  const tamamlama = okeyleTamamla(adaylar, okeyHavuzu, (aday) => seriMu(aday).ok);
  perler.push(...tamamlama.perler);

  const kalanlar: Tas[] = tamamlama.kalanAdaylar.flatMap((aday) => [...aday]);
  kalanlar.push(...okeyHavuzu);
  return birlestir(perler, kalanlar, renkOnce);
}

// --- Kut dizme ---------------------------------------------------------------

/**
 * Eldeki taslari kut (ayni sayi, farkli renkler) gruplarina dizer.
 * Bir kut en fazla 4 tastir; ayni renkten ikinci kopya kalanlara duser.
 */
export function kutDiz(taslar: readonly Tas[]): readonly Grup[] {
  const okeyHavuzu: Tas[] = taslar.filter(okeyMi);
  const normaller = taslar.filter(normalMi);

  const sayiBazli = new Map<Sayi, NormalTas[]>();
  for (const tas of normaller) {
    const mevcut = sayiBazli.get(tas.sayi);
    if (mevcut === undefined) sayiBazli.set(tas.sayi, [tas]);
    else mevcut.push(tas);
  }

  const perler: Grup[] = [];
  const adaylar: (readonly Tas[])[] = [];
  const kalanlar: Tas[] = [];

  const sayilar = [...sayiBazli.keys()].sort((a, b) => a - b);
  for (const sayi of sayilar) {
    const kullanilanRenkler = new Set<Renk>();
    const kut: NormalTas[] = [];

    for (const tas of [...(sayiBazli.get(sayi) ?? [])].sort(sayiOnce)) {
      // KURALLAR.md §2: ayni renkten iki tas bir kutte bulunamaz.
      if (kullanilanRenkler.has(tas.renk)) kalanlar.push(tas);
      else {
        kullanilanRenkler.add(tas.renk);
        kut.push(tas);
      }
    }

    if (kut.length >= 3) perler.push(kut);
    else adaylar.push(kut);
  }

  const tamamlama = okeyleTamamla(adaylar, okeyHavuzu, (aday) => kutMu(aday).ok);
  perler.push(...tamamlama.perler);

  kalanlar.push(...tamamlama.kalanAdaylar.flatMap((aday) => [...aday]));
  kalanlar.push(...okeyHavuzu);
  return birlestir(perler, kalanlar, sayiOnce);
}

// --- Kimlige cevirme ---------------------------------------------------------

/** Dizme sonucunu istaka duzeninin bekledigi kimlik gruplarina cevirir. */
export function gruplariKimlige(gruplar: readonly Grup[]): readonly (readonly string[])[] {
  return gruplar.map((grup) => grup.map((tas) => tas.id));
}
