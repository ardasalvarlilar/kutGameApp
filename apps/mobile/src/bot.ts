// Yer tutucu oyuncularin karar mantigi.
//
// Bu bir KURAL DEGIL, oyuncu politikasi. Motorun disinda duruyor ve yalnizca
// `viewFor` projeksiyonunu okuyor — CLAUDE.md motor kurali #3 geregi bot
// insandan fazlasini gormuyor. Gecerlilik karari daima motorun.
//
// Bilerek kodla yazildi, LLM ile degil: motor kurali #2 ayni tohum + ayni
// aksiyon listesinin hep ayni oyunu uretmesini istiyor.

import {
  RENKLER,
  kutMu,
  okeyMi,
  pereIsle,
  sartKarsilaniyorMu,
  seriMu,
  ciftMi,
  tasPuani,
  turSarti,
  type Aksiyon,
  type NormalTas,
  type OyuncuGorunumu,
  type OyuncuId,
  type Per,
  type Renk,
  type Sayi,
  type Tas,
} from '@kut/engine';
import { kutDiz, seriDiz } from './dizme';

const EN_BUYUK_SAYI = 13;

type Aday = readonly Tas[];

function normalMi(tas: Tas): tas is NormalTas {
  return tas.tip === 'normal';
}

function okeySayisi(aday: Aday): number {
  return aday.filter(okeyMi).length;
}

/** `dizi`den `k` elemanli butun alt kumeler. Girdiler kucuk (en fazla 4-5). */
function kombinasyonlar<T>(dizi: readonly T[], k: number): T[][] {
  if (k <= 0) return [[]];
  if (k > dizi.length) return [];
  const sonuc: T[][] = [];
  const gez = (bas: number, secilen: T[]): void => {
    if (secilen.length === k) {
      sonuc.push([...secilen]);
      return;
    }
    for (let i = bas; i < dizi.length; i++) {
      secilen.push(dizi[i] as T);
      gez(i + 1, secilen);
      secilen.pop();
    }
  };
  gez(0, []);
  return sonuc;
}

// --- Aday per uretimi --------------------------------------------------------

function kutAdaylari(el: readonly Tas[], uzunluk: number): Aday[] {
  const okeyHavuzu = el.filter(okeyMi);
  const sayiBazli = new Map<Sayi, NormalTas[]>();
  for (const tas of el.filter(normalMi)) {
    const mevcut = sayiBazli.get(tas.sayi);
    if (mevcut === undefined) sayiBazli.set(tas.sayi, [tas]);
    else mevcut.push(tas);
  }

  const sonuc: Aday[] = [];
  for (const taslar of sayiBazli.values()) {
    // KURALLAR.md §2: bir kutte ayni renkten iki tas olamaz.
    const gorulenRenkler = new Set<Renk>();
    const renkBazli: NormalTas[] = [];
    for (const tas of taslar) {
      if (gorulenRenkler.has(tas.renk)) continue;
      gorulenRenkler.add(tas.renk);
      renkBazli.push(tas);
    }

    for (let okeyli = 0; okeyli <= Math.min(2, okeyHavuzu.length); okeyli++) {
      const gerekenNormal = uzunluk - okeyli;
      if (gerekenNormal < 1) continue;
      for (const normalSeti of kombinasyonlar(renkBazli, gerekenNormal)) {
        for (const okeySeti of kombinasyonlar(okeyHavuzu, okeyli)) {
          sonuc.push([...normalSeti, ...okeySeti]);
        }
      }
    }
  }
  return sonuc.filter((aday) => kutMu(aday).ok);
}

function seriAdaylari(el: readonly Tas[], uzunluk: number): Aday[] {
  const okeyHavuzu = el.filter(okeyMi);
  const sonuc: Aday[] = [];

  for (const renk of RENKLER) {
    const sayiBazli = new Map<number, NormalTas>();
    for (const tas of el.filter(normalMi)) {
      if (tas.renk === renk && !sayiBazli.has(tas.sayi)) sayiBazli.set(tas.sayi, tas);
    }

    // KURALLAR.md §2: seri 1'de baslar, 13'te durur, basa donmez.
    for (let bas = 1; bas + uzunluk - 1 <= EN_BUYUK_SAYI; bas++) {
      const eldekiler: Tas[] = [];
      let eksik = 0;
      for (let sayi = bas; sayi < bas + uzunluk; sayi++) {
        const tas = sayiBazli.get(sayi);
        if (tas === undefined) eksik += 1;
        else eldekiler.push(tas);
      }
      if (eksik > okeyHavuzu.length) continue;
      if (eksik === 0) {
        sonuc.push(eldekiler);
        continue;
      }
      for (const okeySeti of kombinasyonlar(okeyHavuzu, eksik)) {
        sonuc.push([...eldekiler, ...okeySeti]);
      }
    }
  }
  return sonuc.filter((aday) => seriMu(aday).ok);
}

/** KURALLAR.md §9.1 — cift birebir ayni tastir; okey de yerine gecebilir. */
function ciftAdaylari(el: readonly Tas[]): Aday[] {
  const sonuc: Aday[] = [];
  for (let i = 0; i < el.length; i++) {
    for (let j = i + 1; j < el.length; j++) {
      const aday = [el[i] as Tas, el[j] as Tas];
      if (ciftMi(aday).ok) sonuc.push(aday);
    }
  }
  return sonuc;
}

function parcaAdaylari(el: readonly Tas[], parca: ReturnType<typeof turSarti>['parcalar'][number]): Aday[] {
  const adaylar =
    parca.tip === 'kut'
      ? kutAdaylari(el, parca.uzunluk)
      : parca.tip === 'seri'
        ? seriAdaylari(el, parca.uzunluk)
        : parca.tip === 'cift'
          ? ciftAdaylari(el)
          : [];
  // Okey kit kaynak: once okeysiz cozumler denenir.
  return [...adaylar].sort((a, b) => okeySayisi(a) - okeySayisi(b));
}

/**
 * Turun acilis sartini karsilayan, taslari cakismayan bir per kumesi arar.
 * Bulamazsa null. KURALLAR.md §6: "ne eksik, ne fazla".
 *
 * `zorunluTasId` verilirse cozum O TASI KULLANMAK ZORUNDA. Yerden okey alip
 * ayni hamlede acan oyuncu icin gerekli: §6 "aldigin okeyi o acilista
 * kullanmak zorundasin" diyor, istakaya saklanamiyor. Kisit geri izlemenin
 * icinde: tasi kullanmayan bir cozum bulunursa arama devam ediyor.
 */
export function acilisBul(
  el: readonly Tas[],
  tur: OyuncuGorunumu['tur'],
  zorunluTasId?: string,
): Aday[] | null {
  const parcalar = turSarti(tur).parcalar;
  if (parcalar.some((parca) => parca.tip === 'elden-bitme')) return null;
  if (zorunluTasId !== undefined && !el.some((tas) => tas.id === zorunluTasId)) return null;

  const kullanilan = new Set<string>();

  const ata = (indeks: number): Aday[] | null => {
    const parca = parcalar[indeks];
    if (parca === undefined) {
      return zorunluTasId !== undefined && !kullanilan.has(zorunluTasId) ? null : [];
    }
    for (const aday of parcaAdaylari(el, parca)) {
      if (aday.some((tas) => kullanilan.has(tas.id))) continue;
      for (const tas of aday) kullanilan.add(tas.id);
      const kalan = ata(indeks + 1);
      if (kalan !== null) return [aday, ...kalan];
      for (const tas of aday) kullanilan.delete(tas.id);
    }
    return null;
  };

  const cozum = ata(0);
  if (cozum === null) return null;

  // KURALLAR.md §7: bitis son tasi atarak olur; acilis eli bosaltamaz.
  const kullanilanSayisi = cozum.reduce((toplam, aday) => toplam + aday.length, 0);
  if (kullanilanSayisi >= el.length) return null;

  const perler: Per[] = cozum.map((aday) => {
    const kut = kutMu(aday);
    if (kut.ok) return kut.per;
    const seri = seriMu(aday);
    if (seri.ok) return seri.per;
    return { tip: 'cift', taslar: aday };
  });
  return sartKarsilaniyorMu(perler, tur).ok ? cozum : null;
}

// --- Atilacak tas ------------------------------------------------------------

/** Dizme sonucunda gecerli bir pere giren taslarin kimlikleri. */
function perdekiTaslar(el: readonly Tas[]): Set<string> {
  const icinde = new Set<string>();
  for (const gruplar of [seriDiz(el), kutDiz(el)]) {
    for (const grup of gruplar) {
      if (grup.length < 3) continue;
      if (!kutMu(grup).ok && !seriMu(grup).ok) continue;
      for (const tas of grup) icinde.add(tas.id);
    }
  }
  return icinde;
}

/**
 * En az ise yarayan tasi secer. Sirasiyla kacinir:
 * okey (25 puan), isler tas (§8, 50 puan ceza), bir pere giren tas.
 */
export function atilacakTas(gorunum: OyuncuGorunumu): Tas | null {
  const el = gorunum.istakam;
  if (el.length === 0) return null;

  const perde = perdekiTaslar(el);
  const isler = new Set(gorunum.islerTaslarim);

  const katmanlar: readonly ((tas: Tas) => boolean)[] = [
    (tas) => !okeyMi(tas) && !isler.has(tas.id) && !perde.has(tas.id),
    (tas) => !okeyMi(tas) && !isler.has(tas.id),
    (tas) => !okeyMi(tas) && !perde.has(tas.id),
    (tas) => !okeyMi(tas),
    () => true,
  ];

  for (const katman of katmanlar) {
    const adaylar = el.filter(katman);
    if (adaylar.length === 0) continue;
    return [...adaylar].sort((a, b) => tasPuani(b) - tasPuani(a))[0] ?? null;
  }
  return null;
}

// --- Hamle secimi ------------------------------------------------------------

/** Yerdeki bir pere islenebilecek ilk tas ve hedef per. */
export function islenebilir(
  gorunum: OyuncuGorunumu,
): { readonly tasId: string; readonly perId: number } | null {
  for (const tas of gorunum.istakam) {
    for (const per of gorunum.yer) {
      if (pereIsle(per, [tas]).ok) return { tasId: tas.id, perId: per.id };
    }
  }
  return null;
}

/**
 * Yerden alinan tas ele yarar mi? Perdeki tas sayisini artiriyorsa evet.
 *
 * Once ALINABILIR mi ona bakiliyor: KURALLAR.md §5'e gore tur 15'te "cifti
 * bende" hakki sirasi gelenin bedelsiz hakkini da geciyor. Bu kontrol
 * olmadan bot alamayacagi tasi istiyor, motor hakli olarak reddediyor ve
 * sira ilerlemiyordu.
 */
function yerdenAlmaliMi(gorunum: OyuncuGorunumu): boolean {
  const pencere = gorunum.pencere;
  if (pencere === null) return false;
  if (gorunum.tur === 15 && gorunum.ayarlar.ciftCalmaHakki && pencere.ciftTalebi !== null) {
    return false;
  }

  const ustTas = gorunum.atikYiginlari[pencere.atan].ustTas;
  if (ustTas === null) return false;
  const oncesi = perdekiTaslar(gorunum.istakam).size;
  const sonrasi = perdekiTaslar([...gorunum.istakam, ustTas]).size;
  return sonrasi > oncesi + 1;
}

/**
 * Sirasi gelen yer tutucu oyuncunun bir sonraki hamlesi.
 * Surucu bunu tekrar tekrar cagirir: acilis → isleme → atis.
 */
export function botAksiyonu(
  gorunum: OyuncuGorunumu,
  oyuncu: OyuncuId,
  suAn: number,
): Aksiyon | null {
  if (gorunum.faz === 'el-bitti') return null;

  if (gorunum.faz === 'cekme') {
    return yerdenAlmaliMi(gorunum)
      ? { tip: 'CEK_ATIKTAN', oyuncu, suAn }
      : { tip: 'CEK_DESTEDEN', oyuncu, suAn };
  }

  // Acmamissa turun sartini aramayi dener.
  if (!gorunum.acmisMi[oyuncu]) {
    const acilis = acilisBul(gorunum.istakam, gorunum.tur);
    if (acilis !== null) {
      return {
        tip: 'AC',
        oyuncu,
        perler: acilis.map((aday) => aday.map((tas) => tas.id)),
        okeyAlimi: null,
        suAn,
      };
    }
  } else if (gorunum.islemeYapabilirim) {
    // §6: acilis hamlesinde isleme yok, bir tur donmesi gerekiyor.
    // Elde tas kalmasi sarti (§7) motorda kontrol ediliyor.
    if (gorunum.istakam.length > 1) {
      const hedef = islenebilir(gorunum);
      if (hedef !== null) {
        return { tip: 'ISLE', oyuncu, perId: hedef.perId, tasIdler: [hedef.tasId], suAn };
      }
    }
  }

  const tas = atilacakTas(gorunum);
  return tas === null ? null : { tip: 'AT', oyuncu, tasId: tas.id, suAn };
}
