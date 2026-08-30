// Istaka duzeni: iki sirali slot izgarasi.
//
// Istaka sabit bir bolme listesi degil, bos yerleri de olan bir izgara.
// Boyle olmasinin iki sebebi var:
//   1. Oyuncu tasi istedigi slota surukleyebiliyor (kendi serisini kurmak icin)
//   2. Per adaylari BOSLUKLA belli oluyor — bitisik taslar bir grup sayiliyor
//
// Ust ve alt olmak uzere iki sira var: bu oyunda calma yuzunden istakada
// 24+ tas olabiliyor (KURALLAR.md §5), tek sira yetmiyor.

import type { Tas, TasId } from '@kut/engine';

export const SATIR_SAYISI = 2;

/** Her slot ya bir tas kimligi tutar ya da bostur. */
export type Duzen = readonly (TasId | null)[];

export type Grup = readonly TasId[];

function bosDuzen(sutunSayisi: number): (TasId | null)[] {
  return new Array<TasId | null>(SATIR_SAYISI * sutunSayisi).fill(null);
}

/** Izgaranin tas kapasitesi. */
export function kapasite(sutunSayisi: number): number {
  return SATIR_SAYISI * sutunSayisi;
}

/**
 * Gruplari izgaraya yerlestirir: gruplar arasinda bir bos slot birakilir,
 * satira sigmayan grup bir alt satirdan baslar.
 */
export function duzenOlustur(gruplar: readonly Grup[], sutunSayisi: number): Duzen {
  const duzen = bosDuzen(sutunSayisi);
  let satir = 0;
  let sutun = 0;

  for (const grup of gruplar) {
    if (grup.length === 0) continue;

    // Grup bu satirin kalanina sigmiyorsa alt satira gec.
    if (sutun > 0 && sutun + grup.length > sutunSayisi && satir + 1 < SATIR_SAYISI) {
      satir += 1;
      sutun = 0;
    }

    for (const tasId of grup) {
      if (sutun >= sutunSayisi) {
        satir += 1;
        sutun = 0;
      }
      if (satir >= SATIR_SAYISI) return duzen;
      duzen[satir * sutunSayisi + sutun] = tasId;
      sutun += 1;
    }

    // Gruplar arasinda bir bosluk birak.
    sutun += 1;
  }

  return duzen;
}

/**
 * Izgaradan gruplari cikarir: ayni satirda bitisik duran taslar bir gruptur,
 * araya giren bos slot gruplari ayirir.
 */
export function duzenGruplari(duzen: Duzen, sutunSayisi: number): readonly Grup[] {
  const gruplar: TasId[][] = [];

  for (let satir = 0; satir < SATIR_SAYISI; satir++) {
    let mevcut: TasId[] = [];
    for (let sutun = 0; sutun < sutunSayisi; sutun++) {
      const tasId = duzen[satir * sutunSayisi + sutun] ?? null;
      if (tasId === null) {
        if (mevcut.length > 0) gruplar.push(mevcut);
        mevcut = [];
      } else {
        mevcut.push(tasId);
      }
    }
    if (mevcut.length > 0) gruplar.push(mevcut);
  }

  return gruplar;
}

/** Izgaradaki taslari soldan saga, ustten alta sirayla verir. */
export function duzendekiTaslar(duzen: Duzen): readonly TasId[] {
  return duzen.filter((tasId): tasId is TasId => tasId !== null);
}

/**
 * Duzeni guncel istakayla eslestirir: yere inen ya da atilan taslari duser,
 * yeni cekilen taslari ilk bos slota koyar. Oyuncunun kurdugu bosluklar korunur.
 * Sutun sayisi degistiyse (ekran olculdugunde) izgara yeniden kurulur.
 */
export function duzenTazele(duzen: Duzen, istaka: readonly Tas[], sutunSayisi: number): Duzen {
  const eldekiler = new Set(istaka.map((tas) => tas.id));

  if (duzen.length !== kapasite(sutunSayisi)) {
    const korunan = duzenGruplari(duzen, Math.max(1, duzen.length / SATIR_SAYISI))
      .map((grup) => grup.filter((id) => eldekiler.has(id)))
      .filter((grup) => grup.length > 0);
    const yerlesmis = new Set(korunan.flat());
    const yeniler = istaka.filter((tas) => !yerlesmis.has(tas.id)).map((tas) => tas.id);
    return duzenOlustur(yeniler.length > 0 ? [...korunan, yeniler] : korunan, sutunSayisi);
  }

  const gorulenler = new Set<TasId>();
  const sonuc: (TasId | null)[] = duzen.map((tasId) => {
    if (tasId === null || !eldekiler.has(tasId) || gorulenler.has(tasId)) return null;
    gorulenler.add(tasId);
    return tasId;
  });

  const yeniler = istaka.filter((tas) => !gorulenler.has(tas.id)).map((tas) => tas.id);
  if (yeniler.length === 0) return sonuc;

  // Yeni taslara yer yoksa once bosluklari kapat.
  const bosSayisi = sonuc.filter((slot) => slot === null).length;
  if (bosSayisi < yeniler.length) {
    const hepsi = [...duzendekiTaslar(sonuc), ...yeniler];
    return duzenOlustur([hepsi], sutunSayisi);
  }

  // Yeni tas SONA gider, araya bir bosluk birakarak. Ilk bos slota koymak
  // oyuncunun bilerek biraktigi boslugu doldurur ve iki grubu birlestirirdi.
  let sonDolu = -1;
  for (let i = 0; i < sonuc.length; i++) {
    if (sonuc[i] !== null) sonDolu = i;
  }
  let hedef = sonDolu + 2;

  for (const tasId of yeniler) {
    while (hedef < sonuc.length && sonuc[hedef] !== null) hedef += 1;
    if (hedef >= sonuc.length) {
      const bosIndeks = sonuc.indexOf(null);
      if (bosIndeks === -1) break;
      sonuc[bosIndeks] = tasId;
      continue;
    }
    sonuc[hedef] = tasId;
    hedef += 1;
  }
  return sonuc;
}

/**
 * Tasi baska bir slota tasir. Hedef bossa tas oraya gider, doluysa iki tas
 * yer degistirir — surukleme boylece daima ongorulebilir sonuc verir.
 */
export function tasiTasi(duzen: Duzen, kaynak: number, hedef: number): Duzen {
  if (kaynak === hedef) return duzen;
  if (kaynak < 0 || hedef < 0 || kaynak >= duzen.length || hedef >= duzen.length) return duzen;

  const sonuc = [...duzen];
  const kaynakTas = sonuc[kaynak] ?? null;
  if (kaynakTas === null) return duzen;

  sonuc[kaynak] = sonuc[hedef] ?? null;
  sonuc[hedef] = kaynakTas;
  return sonuc;
}

/** Secili taslari kendi grubuna ayirir; diger gruplarin duzeni korunur. */
export function ayir(duzen: Duzen, secili: readonly TasId[], sutunSayisi: number): Duzen {
  if (secili.length === 0) return duzen;
  const secilenler = new Set(secili);
  const kalanlar = duzenGruplari(duzen, sutunSayisi)
    .map((grup) => grup.filter((id) => !secilenler.has(id)))
    .filter((grup) => grup.length > 0);
  return duzenOlustur([...kalanlar, [...secili]], sutunSayisi);
}

/** Butun taslari bosluksuz tek grupta toplar. */
export function topla(duzen: Duzen, sutunSayisi: number): Duzen {
  const hepsi = duzendekiTaslar(duzen);
  return duzenOlustur(hepsi.length > 0 ? [hepsi] : [], sutunSayisi);
}
