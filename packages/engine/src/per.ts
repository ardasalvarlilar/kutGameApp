// Per dogrulama: kut, seri ve (tur 15'e ozgu) cift. KURALLAR.md §2

import { birebirEsMi, benzersizMi, normalMi, okeyMi } from './tas';
import { RENKLER, SAYILAR, type Sayi, type Tas, type TasId } from './tipler';

export type PerTipi = 'kut' | 'seri' | 'cift';

export interface Per {
  readonly tip: PerTipi;
  readonly taslar: readonly Tas[];
}

export type PerHatasi =
  | 'tekrarli-tas'
  | 'az-tas'
  | 'kut-en-fazla-dort-tas'
  | 'kut-farkli-sayi'
  | 'kut-renk-tekrari'
  | 'kut-belirsiz'
  | 'seri-farkli-renk'
  | 'seri-sayi-tekrari'
  | 'seri-ardisik-degil'
  | 'seri-belirsiz'
  | 'cift-iki-tas-olmali'
  | 'cift-birebir-es-degil'
  | 'per-degil';

export type PerSonucu =
  | { readonly ok: true; readonly per: Per }
  | { readonly ok: false; readonly reason: PerHatasi };

/** KURALLAR.md §2 — her per en az 3 tastir (cift haric; o tur 15'e ozgudur). */
export const MIN_PER = 3;

/** KURALLAR.md §2 — dort renk oldugu icin bir kut en fazla 4 tastir. */
export const MAKS_KUT = 4;

const EN_BUYUK_SAYI: Sayi = 13;

function hata(reason: PerHatasi): PerSonucu {
  return { ok: false, reason };
}

function basarili(tip: PerTipi, taslar: readonly Tas[]): PerSonucu {
  return { ok: true, per: { tip, taslar } };
}

/**
 * KURALLAR.md §2 — Kut: ayni sayinin FARKLI renklerdeki taslari.
 * - Renkler farkli olmak zorunda; ayni renkten iki tas bir kutte bulunamaz
 * - Dort renk oldugu icin bir kut en fazla 4 tastir; okey ekleyerek besli kut yapilamaz
 * - Minimum 3 tas
 * - Okey her tasin yerine gecer, bir perde iki okey birden kullanilabilir
 */
export function kutMu(taslar: readonly Tas[]): PerSonucu {
  if (!benzersizMi(taslar.map((t) => t.id))) return hata('tekrarli-tas');
  if (taslar.length < MIN_PER) return hata('az-tas');
  if (taslar.length > MAKS_KUT) return hata('kut-en-fazla-dort-tas');

  const normaller = taslar.filter(normalMi);
  // Sadece okeylerden olusan bir kutun sayisi belirsizdir. Destede 2 okey
  // oldugu icin gercek oyunda erisilemez; yine de tahmin yurutmuyoruz.
  if (normaller.length === 0) return hata('kut-belirsiz');

  const sayi = normaller[0]!.sayi;
  const renkler = new Set<string>();
  for (const tas of normaller) {
    if (tas.sayi !== sayi) return hata('kut-farkli-sayi');
    if (renkler.has(tas.renk)) return hata('kut-renk-tekrari');
    renkler.add(tas.renk);
  }

  // Okeylerin dolduracagi renk daima bulunur: uzunluk <= 4 = renk sayisi.
  return basarili('kut', taslar);
}

/**
 * KURALLAR.md §2 — Seri: ayni rengin ardisik sayilari.
 * - Tek renk olmak zorunda
 * - 1 seriyi baslatabilir, bitiremez: `1-2-3` gecerli, `12-13-1` GECERSIZ
 * - Seri 13'te durur, basa donmez
 * - Minimum 3 tas, ust sinir yok (1'den 13'e tam seri mumkun)
 *
 * Basa donme yasagi ayri bir kontrolle degil, pencerenin [1, 13] araligina
 * sigmasi zorunlulugu ile saglanir: 12-13-1 ucluyu 13 genisliginde bir
 * araliga yaymak zorunda kalir ve reddedilir.
 */
export function seriMu(taslar: readonly Tas[]): PerSonucu {
  if (!benzersizMi(taslar.map((t) => t.id))) return hata('tekrarli-tas');
  if (taslar.length < MIN_PER) return hata('az-tas');
  if (taslar.length > SAYILAR.length) return hata('seri-ardisik-degil');

  const normaller = taslar.filter(normalMi);
  if (normaller.length === 0) return hata('seri-belirsiz');

  const renk = normaller[0]!.renk;
  const sayilar = new Set<Sayi>();
  for (const tas of normaller) {
    if (tas.renk !== renk) return hata('seri-farkli-renk');
    if (sayilar.has(tas.sayi)) return hata('seri-sayi-tekrari');
    sayilar.add(tas.sayi);
  }

  const uzunluk = taslar.length;
  let enKucuk: number = EN_BUYUK_SAYI;
  let enBuyuk = 1;
  for (const sayi of sayilar) {
    if (sayi < enKucuk) enKucuk = sayi;
    if (sayi > enBuyuk) enBuyuk = sayi;
  }

  // [baslangic, baslangic + uzunluk - 1] penceresi hem [1, 13] icinde kalmali
  // hem de eldeki butun sayilari kapsamali. Bosluklari okeyler doldurur ve
  // sayilari tam olarak bosluk kadardir (uzunluk = normal + okey).
  const altSinir = Math.max(1, enBuyuk - uzunluk + 1);
  const ustSinir = Math.min(enKucuk, EN_BUYUK_SAYI - uzunluk + 1);
  if (altSinir > ustSinir) return hata('seri-ardisik-degil');

  return basarili('seri', taslar);
}

/**
 * KURALLAR.md §9.1 (karara baglandi) — cift, birebir ayni iki tastir:
 * ayni renk + ayni sayi. Yalnizca tur 15'in acilis sartinda kullanilir.
 *
 * Iki durum kabul edilir:
 *  - Birebir es iki tas: `kirmizi7 + kirmizi7`, ya da iki okey tasi
 *  - Bir normal tas + bir okey: okey her tasin yerine gecer (§2)
 * `kirmizi7 + mavi7` cift DEGILDIR.
 */
export function ciftMi(taslar: readonly Tas[]): PerSonucu {
  if (!benzersizMi(taslar.map((t) => t.id))) return hata('tekrarli-tas');
  if (taslar.length !== 2) return hata('cift-iki-tas-olmali');

  const [ilk, ikinci] = taslar as readonly [Tas, Tas];
  if (birebirEsMi(ilk, ikinci)) return basarili('cift', taslar);

  const okeySayisi = (okeyMi(ilk) ? 1 : 0) + (okeyMi(ikinci) ? 1 : 0);
  if (okeySayisi === 1) return basarili('cift', taslar);

  return hata('cift-birebir-es-degil');
}

/** Verilen taslar kut mu seri mi? Cift buraya dahil degildir. */
export function perCozumle(taslar: readonly Tas[]): PerSonucu {
  const kut = kutMu(taslar);
  if (kut.ok) return kut;
  const seri = seriMu(taslar);
  if (seri.ok) return seri;

  // Iki dogrulama da basarisiz. Daha aciklayici olani dondur.
  if (kut.reason === 'tekrarli-tas' || kut.reason === 'az-tas') return kut;

  const normaller = taslar.filter(normalMi);
  const tekSayi = normaller.length > 0 && normaller.every((t) => t.sayi === normaller[0]!.sayi);
  return tekSayi ? kut : seri;
}

/** Belirli bir tipte dogrulama — isleme sirasinda perin tipi degismemeli. */
export function perDogrula(tip: PerTipi, taslar: readonly Tas[]): PerSonucu {
  switch (tip) {
    case 'kut':
      return kutMu(taslar);
    case 'seri':
      return seriMu(taslar);
    case 'cift':
      return ciftMi(taslar);
  }
}

/**
 * KURALLAR.md §8 — bu tas yerdeki perlerden birine isliyor mu?
 * Isleyen bir tasi atmak ceza puani getirir.
 *
 * Iki yol sayilir (§9 0.6 ile karara baglandi):
 *  1. Tas pere DOGRUDAN eklenebiliyor (`pereIsle`).
 *  2. Tas, perdeki bir okeyin YERINE gecip okeyi cekebiliyor (§6).
 *
 * Ikincisi cogu durumda zaten birincisinin icinde: yerdeki `11 + okey + 13`
 * serisine `12` dogrudan eklenebiliyor (okey 10'a kayar, 10-11-12-13 olur).
 * Fark eden tek durum DORTLU KUT: `k3 + s3 + m3 + okey`e besinci tas
 * eklenemez, ama `sari3` okeyin yerine gecip okeyi cekebilir. O tas da
 * masaya konabilecek bir tastir; atmak §8'in tarif ettigi dikkatsizliktir.
 *
 * Kutte okeyi cekmek birden fazla tas gerektirebildigi icin (§6 — dort renk
 * tamamlanmali) `istaka` gerekiyor: tas, gereken adaylardan biri olmali.
 * Verilmezse yalnizca tasin kendisi elde sayilir.
 */
export function islerMi(
  tas: Tas,
  perler: readonly Per[],
  istaka: readonly Tas[] = [tas],
): boolean {
  if (perler.some((per) => pereIsle(per, [tas]).ok)) return true;

  return perler.some((per) =>
    perdekiOkeyler(per).some((okeyTasId) => {
      const adaylar = okeyCekmeAdaylari(per, okeyTasId, istaka);
      return adaylar !== null && adaylar.some((aday) => aday.id === tas.id);
    }),
  );
}

/**
 * KURALLAR.md §6 — yerdeki perden okey alma.
 *
 * Seri: okeyin temsil ettigi tas tek adayla belirlenir; onu koyup okeyi alirsin.
 * (`mavi4 + mavi5 + okey` icin mavi6 koymak yeter.)
 *
 * Kut: okeyin hangi renk oldugu belirsiz olabilir — `kirmizi5 + mavi5 + okey`
 * icinde okey hem siyah5 hem sari5 olabilir. Bu yuzden kutteki okeyi almak
 * icin kut DORT RENGE tamamlanmali, eksik renklerin hepsi konmali. Elinde o
 * taslar yoksa yalnizca isleme yapabilirsin, okeyi alamazsin.
 */
export function okeyCekilebilirMi(
  per: Per,
  okeyTasId: TasId,
  adaylar: readonly Tas[],
): boolean {
  if (adaylar.length === 0) return false;
  if (adaylar.some(okeyMi)) return false;
  if (!benzersizMi(adaylar.map((tas) => tas.id))) return false;

  const hedef = per.taslar.find((tas) => tas.id === okeyTasId);
  if (hedef === undefined || !okeyMi(hedef)) return false;
  if (adaylar.some((aday) => per.taslar.some((tas) => tas.id === aday.id))) return false;

  const yeni = [...per.taslar.filter((tas) => tas.id !== okeyTasId), ...adaylar];

  if (per.tip === 'seri') {
    return adaylar.length === 1 && seriMu(yeni).ok;
  }

  if (per.tip === 'kut') {
    // Okey cikinca geriye belirsizlik kalmamali: dort renk de dolmali.
    if (yeni.some(okeyMi)) return false;
    if (!kutMu(yeni).ok) return false;
    const renkler = new Set(yeni.filter(normalMi).map((tas) => tas.renk));
    return renkler.size === RENKLER.length;
  }

  return false;
}

/**
 * KURALLAR.md §6 — bu okeyi cekmek icin elden hangi taslar gerekir?
 *
 * `okeyCekilebilirMi` "bu taslar yeter mi?" sorusuna cevap veriyor; bu ise
 * "hangi taslar gerekiyor?" sorusuna. Istemcinin oyuncuya "elindeki sari3
 * su okeyi alabilir" diyebilmesi icin lazim.
 *
 * Seride okeyin temsil ettigi tas bellidir, tek tas yeter. Kutte okeyin
 * rengi belirsiz olabildigi icin eksik RENKLERIN HEPSI gerekir — kut dort
 * renge tamamlanmali. Gerekenler elde yoksa null.
 *
 * Karar yine `okeyCekilebilirMi`'nin: burada bulunan aday kumesi donmeden
 * once ona dogrulatiliyor, kural tek yerde kaliyor.
 */
export function okeyCekmeAdaylari(
  per: Per,
  okeyTasId: TasId,
  istaka: readonly Tas[],
): readonly Tas[] | null {
  const hedef = per.taslar.find((tas) => tas.id === okeyTasId);
  if (hedef === undefined || !okeyMi(hedef)) return null;

  const elde = istaka.filter((tas) => !okeyMi(tas));
  const dogrula = (adaylar: readonly Tas[]): readonly Tas[] | null =>
    okeyCekilebilirMi(per, okeyTasId, adaylar) ? adaylar : null;

  if (per.tip === 'seri') {
    for (const tas of elde) {
      const sonuc = dogrula([tas]);
      if (sonuc !== null) return sonuc;
    }
    return null;
  }

  if (per.tip === 'kut') {
    const kalan = per.taslar.filter((tas) => tas.id !== okeyTasId);
    // §10.7 — icinde iki okey olan kutten tek okey cekilemez; sart saglanamaz.
    if (kalan.some(okeyMi)) return null;

    const sayi = kalan.find(normalMi)?.sayi;
    if (sayi === undefined) return null;
    const dolu = new Set(kalan.filter(normalMi).map((tas) => tas.renk));

    const secilen: Tas[] = [];
    for (const renk of RENKLER) {
      if (dolu.has(renk)) continue;
      const bulunan = elde.find((tas) => normalMi(tas) && tas.renk === renk && tas.sayi === sayi);
      if (bulunan === undefined) return null;
      secilen.push(bulunan);
    }
    return dogrula(secilen);
  }

  // Cift (tur 15) icin §6 bir sey soylemiyor; okey cekilemiyor.
  return null;
}

/**
 * KURALLAR.md §6 — okey cekme.
 * Yerdeki perde duran okeyin yerine `aday` tasi konabilir mi?
 * Belirsiz durumlarda tahmin yurutmuyoruz: okeyi adayla degistirip peri
 * yeniden dogruluyoruz. `kirmizi7 + siyah7 + okey` icin hem mavi7 hem sari7
 * kabul edilir — ikisi de peri gecerli birakir.
 */
export function okeyYerineGecebilirMi(per: Per, okeyTasId: TasId, aday: Tas): boolean {
  if (okeyMi(aday)) return false;
  const hedef = per.taslar.find((t) => t.id === okeyTasId);
  if (hedef === undefined || !okeyMi(hedef)) return false;
  if (per.taslar.some((t) => t.id === aday.id)) return false;

  const yeni = per.taslar.map((t) => (t.id === okeyTasId ? aday : t));
  return perDogrula(per.tip, yeni).ok;
}

/** KURALLAR.md §6 — isleme: yerdeki bir pere tas eklemek. Perin tipi korunur. */
export function pereIsle(per: Per, ekTaslar: readonly Tas[]): PerSonucu {
  return perDogrula(per.tip, [...per.taslar, ...ekTaslar]);
}

/** Bir perdeki okey taslarinin kimlikleri. */
export function perdekiOkeyler(per: Per): readonly TasId[] {
  return per.taslar.filter(okeyMi).map((t) => t.id);
}

/**
 * KURALLAR.md §2 — perdeki taslari GORUNTULEME sirasina dizer.
 * Kural karari degil, istemci ipucu (`kutteBosRenkler` gibi).
 *
 * Neden gerekli: ham dizi sirasi yaniltiyordu. `kirmizi12 + kirmizi13 + okey`
 * gecerli bir seridir — ama okey 11'in yerine gecer, cunku seri 13'te durur
 * ve basa donmez (§2). Ekran taslari geldigi sirayla dizince "12 13 ★"
 * cikiyor, okey 13'un SAGINDA duruyor gibi gorunuyor ve "12-13-1 yapmis"
 * izlenimi veriyordu. Motor boyle bir seriyi hicbir zaman kabul etmedi;
 * yanlis olan gosterimdi.
 *
 * Okeyin hangi sayinin yerine gectigi belirsizse (`11 + 12 + okey` hem
 * 10-11-12 hem 11-12-13 olabilir) en yuksek gecerli baslangic secilir:
 * okey mumkun oldugunca saga, oyuncunun beklediği yere duser.
 *
 * Kut ve ciftte sira bir sey ifade etmedigi icin dizi oldugu gibi doner.
 */
export function perGoruntuSirasi(per: Per): readonly Tas[] {
  if (per.tip !== 'seri') return per.taslar;
  if (!seriMu(per.taslar).ok) return per.taslar;

  const normaller = per.taslar.filter(normalMi);
  const okeyler = per.taslar.filter(okeyMi);
  if (normaller.length === 0) return per.taslar;

  const uzunluk = per.taslar.length;
  const sayilar = normaller.map((tas) => tas.sayi);
  const enKucuk = Math.min(...sayilar);
  const enBuyuk = Math.max(...sayilar);

  // seriMu ile ayni pencere hesabi; gecerlilik orada dogrulandi.
  const altSinir = Math.max(1, enBuyuk - uzunluk + 1);
  const ustSinir = Math.min(enKucuk, SAYILAR.length - uzunluk + 1);
  if (altSinir > ustSinir) return per.taslar;

  const baslangic = ustSinir;
  const sayiyaGore = new Map(normaller.map((tas) => [tas.sayi as number, tas]));
  const sirali: Tas[] = [];
  let sonrakiOkey = 0;
  for (let sayi = baslangic; sayi < baslangic + uzunluk; sayi++) {
    const normal = sayiyaGore.get(sayi);
    if (normal !== undefined) {
      sirali.push(normal);
      continue;
    }
    const okey = okeyler[sonrakiOkey++];
    if (okey === undefined) return per.taslar;
    sirali.push(okey);
  }
  return sirali;
}

/** Kutte kullanilmamis renkler — istemci ipucu icin; kural karari degildir. */
export function kutteBosRenkler(per: Per): readonly string[] {
  if (per.tip !== 'kut') return [];
  const kullanilan = new Set(per.taslar.filter(normalMi).map((t) => t.renk));
  return RENKLER.filter((renk) => !kullanilan.has(renk));
}
