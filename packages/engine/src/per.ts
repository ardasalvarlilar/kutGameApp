// Per dogrulama: kut, seri ve (tur 15'e ozgu) cift. KURALLAR.md §2

import { birebirEsMi, benzersizMi, normalMi, okeyMi } from './tas';
import { RENKLER, SAYILAR, type Renk, type Sayi, type Tas, type TasId } from './tipler';

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
  | 'yerdeki-okey-kimildatilamaz'
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
 * KURALLAR.md §2 — seride her tasin ISGAL ETTIGI sayi.
 *
 * Seri taslarini [baslangic, baslangic + uzunluk) penceresine dizer: normal
 * taslar kendi sayilarina oturur, okeyler geriye kalan bosluklari soldan saga
 * doldurur. Belirsizlik varsa (`11 + 12 + okey` hem 10-11-12 hem 11-12-13
 * olabilir) EN YUKSEK gecerli baslangic secilir — okey mumkun oldugunca saga
 * duser, oyuncunun bekledigi yere.
 *
 * Yerlesim iki isi birden goruyor: perin GOSTERIMI (`perGoruntuSirasi`) ve
 * okeyin neyi TEMSIL ETTIGI (§6). Ikisi ayni hesaptan ciktigi icin ekranda
 * gorunen ile motorun okudugu hicbir zaman ayrisamaz.
 *
 * Gecerli bir seri degilse null.
 */
export function seriYerlesimi(taslar: readonly Tas[]): ReadonlyMap<TasId, number> | null {
  if (!seriMu(taslar).ok) return null;

  const normaller = taslar.filter(normalMi);
  if (normaller.length === 0) return null;

  const uzunluk = taslar.length;
  const sayilar = normaller.map((tas) => tas.sayi);
  const enKucuk = Math.min(...sayilar);
  const enBuyuk = Math.max(...sayilar);

  // seriMu ile ayni pencere hesabi; gecerlilik orada dogrulandi.
  const altSinir = Math.max(1, enBuyuk - uzunluk + 1);
  const ustSinir = Math.min(enKucuk, SAYILAR.length - uzunluk + 1);
  if (altSinir > ustSinir) return null;

  const baslangic = ustSinir;
  const sayiyaGore = new Map(normaller.map((tas) => [tas.sayi as number, tas]));
  const okeyler = taslar.filter(okeyMi);

  const yerlesim = new Map<TasId, number>();
  let sonrakiOkey = 0;
  for (let sayi = baslangic; sayi < baslangic + uzunluk; sayi++) {
    const normal = sayiyaGore.get(sayi);
    if (normal !== undefined) {
      yerlesim.set(normal.id, sayi);
      continue;
    }
    const okey = okeyler[sonrakiOkey++];
    if (okey === undefined) return null;
    yerlesim.set(okey.id, sayi);
  }
  return yerlesim;
}

/**
 * KURALLAR.md §6 — seride okeyin TEMSIL ETTIGI tas.
 *
 * "Seride okeyin temsil ettigi tas bellidir; onu koyup okeyi alirsin" (§6):
 * serinin rengi ile okeyin yerlesimdeki sayisi. Kutte okeyin rengi belirsiz
 * olabildigi icin (§6 — dort rengi tamamlama sarti) yalnizca seri icin var.
 */
export function okeyinTemsili(
  per: Per,
  okeyTasId: TasId,
): { readonly renk: Renk; readonly sayi: Sayi } | null {
  if (per.tip !== 'seri') return null;

  const hedef = per.taslar.find((tas) => tas.id === okeyTasId);
  if (hedef === undefined || !okeyMi(hedef)) return null;

  const yerlesim = seriYerlesimi(per.taslar);
  const sayi = yerlesim?.get(okeyTasId);
  if (sayi === undefined) return null;

  const renk = per.taslar.find(normalMi)?.renk;
  if (renk === undefined) return null;

  return { renk, sayi: sayi as Sayi };
}

/**
 * KURALLAR.md §9 0.8 — yere inmis taslarin yeri degismez.
 *
 * Seriye tas eklendiginde perdeki OKEYIN temsil ettigi sayi degisemez. Normal
 * taslar zaten kendi sayilarini tasidigi icin kayabilecek tek sey okeydir.
 *
 * Ornek: yerdeki `siyah4 + siyah5 + siyah6 + okey` serisinde okey siyah7'nin
 * yerinde durur. `siyah2` eklemek okeyi 3'e kaydirir ve seriyi 2-3-4-5-6
 * yapardi — bu, yerdeki peri yeniden dizmektir. `siyah3` ile `siyah8`
 * serbesttir; ikisi de okeye dokunmaz.
 */
function okeylerYerindeKaliyorMu(eski: readonly Tas[], yeni: readonly Tas[]): boolean {
  const eskiOkeyler = eski.filter(okeyMi);
  if (eskiOkeyler.length === 0) return true;

  const eskiYerlesim = seriYerlesimi(eski);
  const yeniYerlesim = seriYerlesimi(yeni);
  if (eskiYerlesim === null || yeniYerlesim === null) return false;

  return eskiOkeyler.every((okey) => eskiYerlesim.get(okey.id) === yeniYerlesim.get(okey.id));
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
    // §6 — "Seride okeyin temsil ettigi tas bellidir; onu koyup okeyi alirsin."
    // Baska bir tas okeyin yerine konamaz: `siyah4+5+6+okey(7)` serisinden
    // okeyi yalnizca siyah7 ceker. siyah3 de gecerli bir seri birakirdi
    // (3-4-5-6) ama bu, perin yerini kaydirmak olurdu (§9 0.8).
    if (adaylar.length !== 1) return false;
    const aday = adaylar[0];
    if (aday === undefined || !normalMi(aday)) return false;
    const temsil = okeyinTemsili(per, okeyTasId);
    if (temsil === null) return false;
    if (aday.renk !== temsil.renk || aday.sayi !== temsil.sayi) return false;
    return seriMu(yeni).ok;
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
 *
 * Kutte belirsiz durumlarda tahmin yurutmuyoruz: okeyi adayla degistirip peri
 * yeniden dogruluyoruz. `kirmizi7 + siyah7 + okey` icin hem mavi7 hem sari7
 * kabul edilir — ikisi de peri gecerli birakir.
 *
 * Seride ise okeyin yeri bellidir (§6) ve kimildamaz (§9 0.8): oraya yalnizca
 * temsil ettigi tas konabilir.
 */
export function okeyYerineGecebilirMi(per: Per, okeyTasId: TasId, aday: Tas): boolean {
  if (okeyMi(aday)) return false;
  const hedef = per.taslar.find((t) => t.id === okeyTasId);
  if (hedef === undefined || !okeyMi(hedef)) return false;
  if (per.taslar.some((t) => t.id === aday.id)) return false;

  if (per.tip === 'seri') {
    const temsil = okeyinTemsili(per, okeyTasId);
    if (temsil === null) return false;
    if (aday.renk !== temsil.renk || aday.sayi !== temsil.sayi) return false;
  }

  const yeni = per.taslar.map((t) => (t.id === okeyTasId ? aday : t));
  return perDogrula(per.tip, yeni).ok;
}

/**
 * KURALLAR.md §6 — isleme: yerdeki bir pere tas eklemek. Perin tipi korunur.
 *
 * §9 0.8 — yerdeki taslarin yeri de korunur: seriye eklenen tas, perde duran
 * okeyi baska bir sayiya kaydiramaz. Kayan bir okey, yere inmis peri yeniden
 * dizmek demektir; oradaki taslar artik oyuncunun degil masanindir.
 */
export function pereIsle(per: Per, ekTaslar: readonly Tas[]): PerSonucu {
  const sonuc = perDogrula(per.tip, [...per.taslar, ...ekTaslar]);
  if (!sonuc.ok) return sonuc;

  if (per.tip === 'seri' && !okeylerYerindeKaliyorMu(per.taslar, sonuc.per.taslar)) {
    return hata('yerdeki-okey-kimildatilamaz');
  }
  return sonuc;
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
 * Hesap `seriYerlesimi`nin: okeyin ekranda gorundugu yer, motorun §6/§9 0.8
 * icin okudugu yerin ta kendisi. Ayri hesaplansaydi ikisi ayrisabilirdi.
 *
 * Kut ve ciftte sira bir sey ifade etmedigi icin dizi oldugu gibi doner.
 */
export function perGoruntuSirasi(per: Per): readonly Tas[] {
  if (per.tip !== 'seri') return per.taslar;

  const yerlesim = seriYerlesimi(per.taslar);
  if (yerlesim === null) return per.taslar;

  return [...per.taslar].sort(
    (a, b) => (yerlesim.get(a.id) ?? 0) - (yerlesim.get(b.id) ?? 0),
  );
}

/** Kutte kullanilmamis renkler — istemci ipucu icin; kural karari degildir. */
export function kutteBosRenkler(per: Per): readonly string[] {
  if (per.tip !== 'kut') return [];
  const kullanilan = new Set(per.taslar.filter(normalMi).map((t) => t.renk));
  return RENKLER.filter((renk) => !kullanilan.has(renk));
}
