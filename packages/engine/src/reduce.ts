// Saf indirgeyici. CLAUDE.md motor kurali #1: yan etki yok — ag, disk,
// zamanlayici, konsol yok. Ayni girdi her zaman ayni cikti.

import type { Aksiyon, AksiyonSonucu, HataKodu } from './aksiyonlar';
import {
  birTurDonduMu,
  yerPeriBul,
  type TasHareketiGovdesi,
  type Faz,
  type OyunDurumu,
  type YerPeri,
} from './durum';
import { ciftMi, islerMi, okeyCekilebilirMi, pereIsle, perCozumle, type Per } from './per';
import { elPuanla, type BitisTipi } from './puan';
import { benzersizMi, birebirEsMi, okeyMi, tasBul, tasCikar, taslariBul } from './tas';
import { eldenBitmeTuruMu, sartKarsilaniyorMu } from './turlar';
import {
  siradaIleri,
  sonrakiOyuncu,
  type OyuncuId,
  type OyuncuKaydi,
  type Tas,
  type TasId,
} from './tipler';

function hata(reason: HataKodu): AksiyonSonucu {
  return { ok: false, reason };
}

function tamam(state: OyunDurumu): AksiyonSonucu {
  return { ok: true, state };
}

function kayitGuncelle<T>(kayit: OyuncuKaydi<T>, oyuncu: OyuncuId, deger: T): OyuncuKaydi<T> {
  return {
    0: oyuncu === 0 ? deger : kayit[0],
    1: oyuncu === 1 ? deger : kayit[1],
    2: oyuncu === 2 ? deger : kayit[2],
    3: oyuncu === 3 ? deger : kayit[3],
  };
}

function siraKontrol(durum: OyunDurumu, oyuncu: OyuncuId, beklenen: Faz): HataKodu | null {
  if (durum.faz === 'el-bitti') return 'el-bitti';
  if (durum.siradaki !== oyuncu) return 'sira-sende-degil';
  if (durum.faz !== beklenen) return beklenen === 'cekme' ? 'zaten-cektin' : 'once-cekmelisin';
  return null;
}

/**
 * Kac hareket saklaniyor.
 *
 * Liste silinmedigi icin bir sinir gerekiyor. Bir sirada en fazla dort hareket
 * oluyor (cekis + calanin tasi + ceza + atis), araya isleme de girse sekiz
 * fazlasiyla yetiyor; istemci arada bir paket kacirsa bile animasyonu
 * yakalayabilsin diye biraz genis tutuldu.
 */
const HAREKET_HAFIZASI = 8;

/**
 * Hareketleri sira numarasi vererek listeye EKLER.
 *
 * Ustune yazmiyor: surucu bir sirayi tek seferde oynuyor (cek → isle → at) ve
 * ekrana yalnizca son durum ulasiyor. Ustune yazsaydi isleme cekisi, atis da
 * islemeyi silerdi; sifirlasaydi hicbiri ekrana varamazdi (ilk yazimda oldu).
 */
function hareketlerle(
  durum: OyunDurumu,
  yeniler: readonly TasHareketiGovdesi[],
): AksiyonSonucu {
  if (yeniler.length === 0) return tamam(durum);

  let sira = durum.sonHareketNo;
  const damgali = yeniler.map((hareket) => ({ ...hareket, sira: ++sira }));

  return tamam({
    ...durum,
    sonHareketler: [...durum.sonHareketler, ...damgali].slice(-HAREKET_HAFIZASI),
    sonHareketNo: sira,
  });
}

function elBitir(
  durum: OyunDurumu,
  bitisTipi: BitisTipi,
  kazanan: OyuncuId | null,
  okeyleBitti: boolean,
): OyunDurumu {
  return {
    ...durum,
    faz: 'el-bitti',
    pencere: null,
    sonuc: elPuanla(durum, bitisTipi, kazanan, okeyleBitti),
  };
}

/**
 * KURALLAR.md §5 — talep penceresi kapandiginda tasi kim alir?
 * "Kim once bastiysa degil, kim onceliliyse alir."
 *
 * Oncelik oyun yonunde ilerler: atan+1 zaten sirasi gelen oyuncudur ve bu
 * noktaya gelindiyse bedelsiz hakkini kullanmamis demektir; ondan sonraki
 * iki oyuncu sirayla hak sahibi olur.
 *
 * Tur 15'in "cifti bende" hakki BURADA DEGIL: o talep kuyruga girmiyor,
 * `CIFT_TALEBI` geldigi anda tasi aliyor (§9 0.10). Buraya geldiysek
 * masadaki tas hala duruyor demektir.
 */
export function pencereKazanani(durum: OyunDurumu): OyuncuId | null {
  const pencere = durum.pencere;
  if (pencere === null) return null;

  for (const adim of [2, 3]) {
    const aday = siradaIleri(pencere.atan, adim);
    if (pencere.talepler.includes(aday)) return aday;
  }
  return null;
}

type GrupSonucu =
  | { readonly ok: true; readonly perler: readonly Per[] }
  | { readonly ok: false; readonly reason: HataKodu };

function gruplariCozumle(
  kaynak: readonly Tas[],
  gruplar: readonly (readonly TasId[])[],
  ciftTuru: boolean,
): GrupSonucu {
  if (gruplar.length === 0) return { ok: false, reason: 'sart-eksik' };
  if (!benzersizMi(gruplar.flat())) return { ok: false, reason: 'tekrarli-tas' };

  const perler: Per[] = [];
  for (const grup of gruplar) {
    const taslar = taslariBul(kaynak, grup);
    if (taslar === null) return { ok: false, reason: 'tas-elinde-yok' };
    const sonuc = ciftTuru ? ciftMi(taslar) : perCozumle(taslar);
    if (!sonuc.ok) return { ok: false, reason: sonuc.reason };
    perler.push(sonuc.per);
  }
  return { ok: true, perler };
}

/**
 * Yeni inen perlerden ekran hareketi uretir.
 *
 * `yerePerEkle` kimlikleri `durum.sonrakiPerId`den itibaren veriyor; yeni
 * olanlar bu esigin ustundekiler. Ekran tasi oyuncunun koltugundan PERIN
 * KENDISINE ucuruyor — per o render'da zaten cizilmis oluyor, dolayisiyla
 * konumu olculebiliyor.
 */
function indirmeHareketleri(
  oyuncu: OyuncuId,
  yeniYer: readonly YerPeri[],
  ilkYeniPerId: number,
): TasHareketiGovdesi[] {
  return yeniYer
    .filter((per) => per.id >= ilkYeniPerId)
    .map((per) => ({ tip: 'indirme', oyuncu, perId: per.id, taslar: per.taslar }));
}

function yerePerEkle(
  durum: OyunDurumu,
  sahibi: OyuncuId,
  perler: readonly Per[],
  mevcutYer: readonly YerPeri[],
): { readonly yer: readonly YerPeri[]; readonly sonrakiPerId: number } {
  let sonrakiPerId = durum.sonrakiPerId;
  const yeniler: YerPeri[] = [];
  for (const per of perler) {
    yeniler.push({ id: sonrakiPerId, sahibi, tip: per.tip, taslar: per.taslar });
    sonrakiPerId += 1;
  }
  return { yer: [...mevcutYer, ...yeniler], sonrakiPerId };
}

// --- Cekme -----------------------------------------------------------------

function cekDesteden(durum: OyunDurumu, oyuncu: OyuncuId): AksiyonSonucu {
  const engel = siraKontrol(durum, oyuncu, 'cekme');
  if (engel !== null) return hata(engel);

  // KURALLAR.md §5 (§9 0.9) — pencereyi KAPATAN hamle bu. Sirasi gelen oyuncu
  // atilan tasi almayip desteden cektigi anda, o ana kadar birikmis
  // taleplerin en oncelikli olani tasi alir. Bekleme suresi yok: talep
  // etmeyenin hakki da yok.
  const pencere = durum.pencere;
  const calan = pencereKazanani(durum);
  // Calan hem atilan tasi hem desteden bir ceza tasi alir (§5); sirasi gelen
  // oyuncu da bir tas ceker. Ikisine birden yetecek tas yoksa deste tukenmistir.
  const gerekenTas = calan !== null ? 2 : 1;
  if (durum.deste.length < gerekenTas) {
    // KURALLAR.md §7 — deste tukendi, el kimse bitirmeden kapanir.
    return tamam(elBitir(durum, 'deste-tukendi', null, false));
  }

  let deste = durum.deste;
  let istakalar = durum.istakalar;
  let atikYiginlari = durum.atikYiginlari;
  let atikSirasi = durum.atikSirasi;
  let calinanSayisi = durum.calinanSayisi;
  /** Calana giden tas — animasyon olayinda ACIK gosteriliyor, herkes gordu. */
  let calinanTas: Tas | null = null;

  if (calan !== null && pencere !== null) {
    const yigin = atikYiginlari[pencere.atan];
    const ustTas = yigin[yigin.length - 1];
    if (ustTas === undefined || ustTas.id !== pencere.tasId) return hata('atik-yigini-bos');
    calinanTas = ustTas;

    const cezaTasi = deste[0] as Tas;
    deste = deste.slice(1);
    istakalar = kayitGuncelle(istakalar, calan, [...istakalar[calan], ustTas, cezaTasi]);
    atikYiginlari = kayitGuncelle(atikYiginlari, pencere.atan, yigin.slice(0, -1));
    atikSirasi = atikSirasi.filter((id) => id !== ustTas.id);
    // §5 — calmak sirayi harcamaz; eli kalici olarak 2 tas buyutur.
    calinanSayisi = kayitGuncelle(calinanSayisi, calan, calinanSayisi[calan] + 1);
  }

  const cekilen = deste[0] as Tas;
  deste = deste.slice(1);
  istakalar = kayitGuncelle(istakalar, oyuncu, [...istakalar[oyuncu], cekilen]);

  // Ekran icin: bu TEK aksiyon uc ayri tas hareketi uretebiliyor. Sirasi
  // onemli — once pencereyi kapatan cekis, sonra calanin aldigi tas, en son
  // onun ceza tasi. Istemci kuyrugu bu sirayla oynatiyor.
  const olaylar: TasHareketiGovdesi[] = [
    { tip: 'cekim', oyuncu, kaynak: 'deste', tas: null, kimden: null },
  ];
  if (calan !== null && pencere !== null && calinanTas !== null) {
    olaylar.push({
      tip: 'cekim',
      oyuncu: calan,
      kaynak: 'calma',
      tas: calinanTas,
      kimden: pencere.atan,
    });
    olaylar.push({ tip: 'cekim', oyuncu: calan, kaynak: 'ceza', tas: null, kimden: null });
  }

  return hareketlerle(
    {
      ...durum,
      deste,
      istakalar,
      atikYiginlari,
      atikSirasi,
      calinanSayisi,
      faz: 'atma',
      pencere: null,
      sonCalan: calan,
    },
    olaylar,
  );
}

function cekAtiktan(durum: OyunDurumu, oyuncu: OyuncuId): AksiyonSonucu {
  const engel = siraKontrol(durum, oyuncu, 'cekme');
  if (engel !== null) return hata(engel);

  const pencere = durum.pencere;
  if (pencere === null) return hata('talep-penceresi-kapali');

  // Tur 15'in "cifti bende" hakki icin burada bir kontrol YOK ve olamaz:
  // cift talebi kuyruga girmiyor, geldigi anda tasi aliyor (§9 0.10).
  // Cifti tutan oyuncu once davrandiysa `pencere` coktan null olur ve bu
  // fonksiyon yukarida `talep-penceresi-kapali` ile doner.
  const yigin = durum.atikYiginlari[pencere.atan];
  const ustTas = yigin[yigin.length - 1];
  if (ustTas === undefined) return hata('atik-yigini-bos');

  // §5.3 — sirasi gelen tasi alirsa is biter, talepler duser.
  return hareketlerle(
    {
      ...durum,
      istakalar: kayitGuncelle(durum.istakalar, oyuncu, [...durum.istakalar[oyuncu], ustTas]),
      atikYiginlari: kayitGuncelle(durum.atikYiginlari, pencere.atan, yigin.slice(0, -1)),
      atikSirasi: durum.atikSirasi.filter((id) => id !== ustTas.id),
      faz: 'atma',
      pencere: null,
      // Bedelsiz hak calma degil: eksilen tasin sahibi sirasi gelen oyuncu.
      sonCalan: null,
    },
    // Tas masada ACIK duruyordu; kapali ucurmak "nereye gitti"yi gizlerdi.
    [{ tip: 'cekim', oyuncu, kaynak: 'atik', tas: ustTas, kimden: pencere.atan }],
  );
}

// --- Talepler --------------------------------------------------------------

function calmaTalebi(durum: OyunDurumu, oyuncu: OyuncuId): AksiyonSonucu {
  if (durum.faz === 'el-bitti') return hata('el-bitti');
  const pencere = durum.pencere;
  if (pencere === null) return hata('talep-penceresi-kapali');
  if (oyuncu === pencere.atan) return hata('atan-talep-edemez');
  if (oyuncu === durum.siradaki) return hata('sirasi-olan-talep-edemez');
  if (pencere.talepler.includes(oyuncu)) return hata('zaten-talep-ettin');

  // §5.5 — talep baglayicidir; geri alma aksiyonu yoktur.
  return tamam({
    ...durum,
    pencere: { ...pencere, talepler: [...pencere.talepler, oyuncu] },
  });
}

/**
 * KURALLAR.md §5 tur 15 — "cifti bende".
 *
 * NORMAL TALEPTEN FARKI: bu bir talep degil, HAMLENIN KENDISI. Kuyruga
 * girmiyor, geldigi anda tasi aliyor (§9 0.10).
 *
 * Neden boyle: hak, sirasi gelen oyuncunun bedelsiz hakki dahil butun
 * oncelikleri geciyor (§5). Talep kuyruga girseydi, sirasi gelen oyuncu
 * onlardan once davranip tasi alabilirdi ve "her seyi gecer" sozu yalnizca
 * yavas oynayana karsi gecerli olurdu. Sayac koyup herkesi bekletmek de
 * §9 0.9 ile birlikte kalkti. Geriye tek tutarli okuma kaliyor: cift talebi
 * ANINDA sonuclanir.
 *
 * Bedeli normal calmanin aynisi (§5): tas + desteden 1 ceza tasi + 5 puan,
 * ve SIRAYI HARCAMAZ. Sirasi gelen oyuncu tasi kaptirmis olur; desteden
 * ceker ve sirasina devam eder.
 */
function ciftTalebi(durum: OyunDurumu, oyuncu: OyuncuId): AksiyonSonucu {
  if (durum.faz === 'el-bitti') return hata('el-bitti');
  if (durum.tur !== 15) return hata('cift-talebi-sadece-tur-15');
  if (!durum.ayarlar.ciftCalmaHakki) return hata('cift-calma-hakki-kapali');

  const pencere = durum.pencere;
  if (pencere === null) return hata('talep-penceresi-kapali');
  if (oyuncu === pencere.atan) return hata('atan-talep-edemez');
  if (oyuncu === durum.siradaki) return hata('sirasi-olan-talep-edemez');

  // §9 0.10 — dort cifti indirdikten sonra ciftle isin bitiyor. Acmis oyuncu
  // artik seri/kut indirir (§10.2); ciftini tamamlamak icin tas calmasinin
  // bir karsiligi kalmiyor.
  if (durum.acmisMi[oyuncu]) return hata('zaten-actin');

  const yigin = durum.atikYiginlari[pencere.atan];
  const ustTas = yigin[yigin.length - 1];
  if (ustTas === undefined || ustTas.id !== pencere.tasId) return hata('atik-yigini-bos');

  // Blof engeli: talep ancak tasin birebir esi gercekten istakadaysa gecerli.
  // Istemcideki tusun kapali olmasi kullanici kolayligi; asil kontrol burada.
  const esiVar = durum.istakalar[oyuncu].some((tas) => birebirEsMi(tas, ustTas));
  if (!esiVar) return hata('cift-elinde-yok');

  // Calmanin bedeli desteden bir tas (§5). Deste bossa odenemez.
  const cezaTasi = durum.deste[0];
  if (cezaTasi === undefined) return hata('ceza-tasi-kalmadi');

  return hareketlerle(
    {
      ...durum,
      deste: durum.deste.slice(1),
      istakalar: kayitGuncelle(durum.istakalar, oyuncu, [
        ...durum.istakalar[oyuncu],
        ustTas,
        cezaTasi,
      ]),
      atikYiginlari: kayitGuncelle(durum.atikYiginlari, pencere.atan, yigin.slice(0, -1)),
      atikSirasi: durum.atikSirasi.filter((id) => id !== ustTas.id),
      calinanSayisi: kayitGuncelle(durum.calinanSayisi, oyuncu, durum.calinanSayisi[oyuncu] + 1),
      // Tas gitti: bekleyen normal talepler de duser. Pencere kapandigi icin
      // sirasi gelen oyuncuya desteden cekmekten baska yol kalmiyor.
      pencere: null,
      sonCalan: oyuncu,
    },
    [
      { tip: 'cekim', oyuncu, kaynak: 'calma', tas: ustTas, kimden: pencere.atan },
      { tip: 'cekim', oyuncu, kaynak: 'ceza', tas: null, kimden: null },
    ],
  );
}

// --- Atma ------------------------------------------------------------------

function at(durum: OyunDurumu, oyuncu: OyuncuId, tasId: TasId): AksiyonSonucu {
  const engel = siraKontrol(durum, oyuncu, 'atma');
  if (engel !== null) return hata(engel);

  const istaka = durum.istakalar[oyuncu];
  const tas = tasBul(istaka, tasId);
  if (tas === null) return hata('tas-elinde-yok');

  const kalan = tasCikar(istaka, [tasId]);
  // §7 — son tasini ortaya atan eli bitirir.
  const bitiriyor = kalan.length === 0;

  // KURALLAR.md §8 — yerdeki bir pere isleyen tasi atmak ceza puani getirir.
  //
  // Eli BITIREN atis bunun disinda: §8 cezasi "masaya dikkat etmemenin
  // bedeli", oysa son tasi atmak kazanan hamlenin ta kendisi. Ustelik §8
  // okeyle bitmeyi ODULLENDIRIYOR (×2 carpan); ayni hamleye 50 puan yazmak
  // kuralin kendisiyle celisirdi — okey yerdeki neredeyse her pere isledigi
  // icin okeyle bitmek her zaman ceza yerdi. (§10.6 kazananin isler tas
  // cezasini odedigini soyluyor; o, elin ONCEKI atislari icin gecerli.)
  const islerAtti =
    !bitiriyor && durum.ayarlar.islerTasCezasi > 0 && islerMi(tas, durum.yer, istaka);
  const araDurum: OyunDurumu = {
    ...durum,
    islerTasSayisi: islerAtti
      ? kayitGuncelle(durum.islerTasSayisi, oyuncu, durum.islerTasSayisi[oyuncu] + 1)
      : durum.islerTasSayisi,
    istakalar: kayitGuncelle(durum.istakalar, oyuncu, kalan),
    // §4 — atilan tas, atan ile bir sonraki oyuncu arasindaki yiginin ustune gelir.
    atikYiginlari: kayitGuncelle(durum.atikYiginlari, oyuncu, [
      ...durum.atikYiginlari[oyuncu],
      tas,
    ]),
    atikSirasi: [...durum.atikSirasi, tas.id],
  };

  // Atis da bir hareket: ayni listede oldugu icin cekisten SONRA sira
  // aliyor. Ekran eskiden atisi atik yigininin buyumesinden cikariyordu ve
  // iki ayri effect'in tanim sirasi yuzunden atis cekisten once oynuyordu.
  const atmaHareketi = { tip: 'atma', oyuncu, tas } as const;

  // §7 — tum taslarini indirmis ve son tasini ortaya atmis oyuncu eli bitirir.
  // §8 — "okeyle bitti" = ortaya atilan son tasin okey olmasi.
  if (bitiriyor) {
    return hareketlerle(elBitir(araDurum, 'normal', oyuncu, okeyMi(tas)), [atmaHareketi]);
  }

  // §7, §9 0.12 — deste bittiyse el, SON TASI CEKEN oyuncunun bu atisiyla
  // kapanir. Eskiden el ancak siradaki oyuncu cekmeye kalkinca kapaniyordu:
  // oyuncu "cekmeye calisinca oyun bitti" goruyordu ve siradaki, bu arada
  // atilan tasi yerden alip eli uzatabiliyordu.
  //
  // Atma fazinda deste bossa son tasi bu sirada biri cekti demektir (siradaki
  // ya da ceza tasini alan calan — calma sirayi harcamaz, atan yine bu
  // oyuncu). Eli bitiren atis yukarida, normal bitis olarak onde.
  if (araDurum.deste.length === 0) {
    return hareketlerle(elBitir(araDurum, 'deste-tukendi', null, false), [atmaHareketi]);
  }

  return hareketlerle(
    {
      ...araDurum,
      hamleSayisi: kayitGuncelle(durum.hamleSayisi, oyuncu, durum.hamleSayisi[oyuncu] + 1),
      siradaki: sonrakiOyuncu(oyuncu),
      faz: 'cekme',
      // §9 0.9 — pencerenin acilis ani tutulmuyor; sayac yok, kapanisi
      // sirasi gelenin hamlesi belirliyor.
      pencere: { atan: oyuncu, tasId: tas.id, talepler: [] },
      // Yeni tas atildi: onceki calmanin gosterimi bitti.
      sonCalan: null,
    },
    [atmaHareketi],
  );
}

// --- Acma, isleme, okey cekme ---------------------------------------------

function ac(
  durum: OyunDurumu,
  oyuncu: OyuncuId,
  gruplar: readonly (readonly TasId[])[],
  okeyAlimi: {
    readonly perId: number;
    readonly okeyTasId: TasId;
    readonly yerineTasIdler: readonly TasId[];
  } | null,
): AksiyonSonucu {
  const engel = siraKontrol(durum, oyuncu, 'atma');
  if (engel !== null) return hata(engel);
  // §3 — tur 16'da yere hic per inmez, kimse acmaz.
  if (eldenBitmeTuruMu(durum.tur)) return hata('tur-16-acma-yok');
  if (durum.acmisMi[oyuncu]) return hata('zaten-actin');

  let istaka = durum.istakalar[oyuncu];
  let yer = durum.yer;
  /** §6 istisnasi: okeyin yerine YERE konan taslar — onlar da ucuyor. */
  let okeyeVerilen: readonly Tas[] = [];

  if (okeyAlimi !== null) {
    // §6 istisnasi — hic acmamis oyuncu, okeyi alip ayni hamlede acabilir.
    const per = yerPeriBul(durum, okeyAlimi.perId);
    if (per === null) return hata('per-bulunamadi');
    const okey = tasBul(per.taslar, okeyAlimi.okeyTasId);
    if (okey === null || !okeyMi(okey)) return hata('okey-degil');
    const gercekler = taslariBul(istaka, okeyAlimi.yerineTasIdler);
    if (gercekler === null) return hata('tas-elinde-yok');
    if (!okeyCekilebilirMi(per, okeyAlimi.okeyTasId, gercekler)) return hata('okey-yerine-gecemez');

    okeyeVerilen = gercekler;
    istaka = [...tasCikar(istaka, gercekler.map((tas) => tas.id)), okey];
    yer = yer.map((p) =>
      p.id === per.id
        ? { ...p, taslar: [...p.taslar.filter((t) => t.id !== okey.id), ...gercekler] }
        : p,
    );
  }

  // Tur 15'in acilis sarti dort cifttir; diger turlarda kut/seri aranir.
  const cozum = gruplariCozumle(istaka, gruplar, durum.tur === 15);
  if (!cozum.ok) return hata(cozum.reason);

  // §6 — "Ne eksik, ne fazla."
  const sart = sartKarsilaniyorMu(cozum.perler, durum.tur);
  if (!sart.ok) return hata(sart.reason);

  // §6 — alinan okey o acilista kullanilmak ZORUNDA; istakaya saklanamaz.
  if (okeyAlimi !== null && !gruplar.some((g) => g.includes(okeyAlimi.okeyTasId))) {
    return hata('alinan-okey-kullanilmadi');
  }

  const kalan = tasCikar(istaka, gruplar.flat());
  // §7 — bitis son tasi ortaya atarak olur; acilis eli tamamen bosaltamaz.
  if (kalan.length === 0) return hata('son-tas-atilmali');

  const eklenen = yerePerEkle(durum, oyuncu, cozum.perler, yer);

  // Once okeyin yerine konan taslar (varsa), sonra inen perler: oyuncunun
  // yaptigi sira bu.
  const hareketler: TasHareketiGovdesi[] = [];
  if (okeyAlimi !== null && okeyeVerilen.length > 0) {
    hareketler.push({
      tip: 'isleme',
      oyuncu,
      perId: okeyAlimi.perId,
      taslar: okeyeVerilen,
    });
  }
  hareketler.push(...indirmeHareketleri(oyuncu, eklenen.yer, durum.sonrakiPerId));

  return hareketlerle(
    {
      ...durum,
      istakalar: kayitGuncelle(durum.istakalar, oyuncu, kalan),
      yer: eklenen.yer,
      sonrakiPerId: eklenen.sonrakiPerId,
      acmisMi: kayitGuncelle(durum.acmisMi, oyuncu, true),
      // §6 — acilis hamlesinde isleme yok; bir tur donmesi gerekir.
      acilisHamlesi: kayitGuncelle(durum.acilisHamlesi, oyuncu, durum.hamleSayisi[oyuncu]),
    },
    hareketler,
  );
}

function islemeIzni(durum: OyunDurumu, oyuncu: OyuncuId): HataKodu | null {
  if (eldenBitmeTuruMu(durum.tur)) return 'tur-16-isleme-yok';
  if (!durum.acmisMi[oyuncu]) return 'acmadin';
  // §6 — "Actiktan sonra bir tur donup sira sana tekrar geldiginde".
  if (!birTurDonduMu(durum, oyuncu)) return 'acilis-hamlesinde-isleme-yok';
  return null;
}

function isle(
  durum: OyunDurumu,
  oyuncu: OyuncuId,
  perId: number,
  tasIdler: readonly TasId[],
): AksiyonSonucu {
  const engel = siraKontrol(durum, oyuncu, 'atma');
  if (engel !== null) return hata(engel);
  const izin = islemeIzni(durum, oyuncu);
  if (izin !== null) return hata(izin);

  // §6 — kendi perlerine de baskalarininkine de isleyebilirsin.
  const per = yerPeriBul(durum, perId);
  if (per === null) return hata('per-bulunamadi');
  if (tasIdler.length === 0) return hata('tas-elinde-yok');
  if (!benzersizMi(tasIdler)) return hata('tekrarli-tas');

  const istaka = durum.istakalar[oyuncu];
  const eklenecek = taslariBul(istaka, tasIdler);
  if (eklenecek === null) return hata('tas-elinde-yok');

  const sonuc = pereIsle(per, eklenecek);
  if (!sonuc.ok) return hata(sonuc.reason);

  const kalan = tasCikar(istaka, tasIdler);
  if (kalan.length === 0) return hata('son-tas-atilmali');

  return hareketlerle(
    {
      ...durum,
      istakalar: kayitGuncelle(durum.istakalar, oyuncu, kalan),
      yer: durum.yer.map((p) => (p.id === per.id ? { ...p, taslar: sonuc.per.taslar } : p)),
    },
    // Ekran icin: tas oyuncunun istakasindan CIKIP hedef pere gidiyor.
    // Islenen taslar herkesin gordugu taslar — acik ucuyorlar.
    [{ tip: 'isleme', oyuncu, perId: per.id, taslar: eklenecek }],
  );
}

function perIndir(
  durum: OyunDurumu,
  oyuncu: OyuncuId,
  gruplar: readonly (readonly TasId[])[],
): AksiyonSonucu {
  const engel = siraKontrol(durum, oyuncu, 'atma');
  if (engel !== null) return hata(engel);
  const izin = islemeIzni(durum, oyuncu);
  if (izin !== null) return hata(izin);

  // §6 — "Fazladan kut ve seri indirebilirsin." Cift yalnizca acilis sartidir.
  const istaka = durum.istakalar[oyuncu];
  const cozum = gruplariCozumle(istaka, gruplar, false);
  if (!cozum.ok) return hata(cozum.reason);

  const kalan = tasCikar(istaka, gruplar.flat());
  if (kalan.length === 0) return hata('son-tas-atilmali');

  const eklenen = yerePerEkle(durum, oyuncu, cozum.perler, durum.yer);

  return hareketlerle(
    {
      ...durum,
      istakalar: kayitGuncelle(durum.istakalar, oyuncu, kalan),
      yer: eklenen.yer,
      sonrakiPerId: eklenen.sonrakiPerId,
    },
    indirmeHareketleri(oyuncu, eklenen.yer, durum.sonrakiPerId),
  );
}

function okeyCek(
  durum: OyunDurumu,
  oyuncu: OyuncuId,
  perId: number,
  okeyTasId: TasId,
  yerineTasIdler: readonly TasId[],
): AksiyonSonucu {
  const engel = siraKontrol(durum, oyuncu, 'atma');
  if (engel !== null) return hata(engel);
  // §6 normal yol: acmis ve uzerinden bir tur donmus olmali.
  const izin = islemeIzni(durum, oyuncu);
  if (izin !== null) return hata(izin);

  const per = yerPeriBul(durum, perId);
  if (per === null) return hata('per-bulunamadi');
  const okey = tasBul(per.taslar, okeyTasId);
  if (okey === null || !okeyMi(okey)) return hata('okey-degil');

  const istaka = durum.istakalar[oyuncu];
  const gercekler = taslariBul(istaka, yerineTasIdler);
  if (gercekler === null) return hata('tas-elinde-yok');
  if (!okeyCekilebilirMi(per, okeyTasId, gercekler)) return hata('okey-yerine-gecemez');

  return hareketlerle(
    {
      ...durum,
      istakalar: kayitGuncelle(durum.istakalar, oyuncu, [
        ...tasCikar(istaka, gercekler.map((tas) => tas.id)),
        okey,
      ]),
      yer: durum.yer.map((p) =>
        p.id === per.id
          ? { ...p, taslar: [...p.taslar.filter((t) => t.id !== okeyTasId), ...gercekler] }
          : p,
      ),
    },
    // Okeyin YERINE konan taslar ucuyor. Okeyin kendisinin perden istakaya
    // donusu icin ayri bir hareket YOK: ucus tipleri ortadan/oyuncuya ya da
    // oyuncudan pere gidiyor, "perden oyuncuya" diye bir yon henuz yok.
    [{ tip: 'isleme', oyuncu, perId: per.id, taslar: gercekler }],
  );
}

function bitirElden(
  durum: OyunDurumu,
  oyuncu: OyuncuId,
  gruplar: readonly (readonly TasId[])[],
  atilanTasId: TasId,
): AksiyonSonucu {
  const engel = siraKontrol(durum, oyuncu, 'atma');
  if (engel !== null) return hata(engel);
  if (!eldenBitmeTuruMu(durum.tur)) return hata('sadece-tur-16');

  const istaka = durum.istakalar[oyuncu];
  const atilan = tasBul(istaka, atilanTasId);
  if (atilan === null) return hata('tas-elinde-yok');

  const tumIdler = [...gruplar.flat(), atilanTasId];
  if (!benzersizMi(tumIdler)) return hata('tekrarli-tas');
  // §3 tur 16 — tek sart: artan tam olarak 1 tas.
  if (tumIdler.length !== istaka.length) return hata('artan-tas-bir-olmali');

  // §3 — per kompozisyonu serbesttir, sabit sart yoktur; hepsi gecerli per olmali.
  const cozum = gruplariCozumle(istaka, gruplar, false);
  if (!cozum.ok) return hata(cozum.reason);

  // §3 — tur 16'da yere per inmez; perler yalnizca dogrulama icindir.
  const araDurum: OyunDurumu = {
    ...durum,
    istakalar: kayitGuncelle(durum.istakalar, oyuncu, []),
    atikYiginlari: kayitGuncelle(durum.atikYiginlari, oyuncu, [
      ...durum.atikYiginlari[oyuncu],
      atilan,
    ]),
    atikSirasi: [...durum.atikSirasi, atilan.id],
  };

  // Tur 16'da yere per inmiyor ama SON TAS yine ortaya atiliyor (§7):
  // atis animasyonu burada da olmali.
  return hareketlerle(elBitir(araDurum, 'normal', oyuncu, okeyMi(atilan)), [
    { tip: 'atma', oyuncu, tas: atilan },
  ]);
}

// --- Indirgeyici -----------------------------------------------------------

export function reduce(durum: OyunDurumu, aksiyon: Aksiyon): AksiyonSonucu {
  switch (aksiyon.tip) {
    case 'CEK_DESTEDEN':
      return cekDesteden(durum, aksiyon.oyuncu);
    case 'CEK_ATIKTAN':
      return cekAtiktan(durum, aksiyon.oyuncu);
    case 'CALMA_TALEBI':
      return calmaTalebi(durum, aksiyon.oyuncu);
    case 'CIFT_TALEBI':
      return ciftTalebi(durum, aksiyon.oyuncu);
    case 'AT':
      return at(durum, aksiyon.oyuncu, aksiyon.tasId);
    case 'AC':
      return ac(durum, aksiyon.oyuncu, aksiyon.perler, aksiyon.okeyAlimi);
    case 'ISLE':
      return isle(durum, aksiyon.oyuncu, aksiyon.perId, aksiyon.tasIdler);
    case 'PER_INDIR':
      return perIndir(durum, aksiyon.oyuncu, aksiyon.perler);
    case 'OKEY_CEK':
      return okeyCek(
        durum,
        aksiyon.oyuncu,
        aksiyon.perId,
        aksiyon.okeyTasId,
        aksiyon.yerineTasIdler,
      );
    case 'BITIR_ELDEN':
      return bitirElden(durum, aksiyon.oyuncu, aksiyon.perler, aksiyon.atilanTasId);
  }
}

/** Bir aksiyon listesini sirayla uygular; ilk hatada durur. */
export function reduceHepsi(
  durum: OyunDurumu,
  aksiyonlar: readonly Aksiyon[],
): AksiyonSonucu {
  let mevcut = durum;
  for (const aksiyon of aksiyonlar) {
    const sonuc = reduce(mevcut, aksiyon);
    if (!sonuc.ok) return sonuc;
    mevcut = sonuc.state;
  }
  return tamam(mevcut);
}
