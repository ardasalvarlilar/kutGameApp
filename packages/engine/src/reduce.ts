// Saf indirgeyici. CLAUDE.md motor kurali #1: yan etki yok — ag, disk,
// zamanlayici, konsol yok. Ayni girdi her zaman ayni cikti.

import type { Aksiyon, AksiyonSonucu, HataKodu } from './aksiyonlar';
import {
  birTurDonduMu,
  yerPeriBul,
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
 * Tur 15'te (KURALLAR.md 0.2) "cifti bende" hakki her seyi geçer.
 * Normal oncelik: atan+2, sonra atan+3. atan+1 zaten sirasi gelen oyuncudur;
 * bu noktaya gelindiyse bedelsiz hakkini kullanmamis demektir.
 */
export function pencereKazanani(durum: OyunDurumu): OyuncuId | null {
  const pencere = durum.pencere;
  if (pencere === null) return null;

  if (durum.tur === 15 && durum.ayarlar.ciftCalmaHakki && pencere.ciftTalebi !== null) {
    return pencere.ciftTalebi;
  }

  // Oncelik oyun yonunde ilerler: atan+1 zaten sirasi gelen oyuncudur,
  // ondan sonraki iki oyuncu sirayla hak sahibi olur.
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

function cekDesteden(durum: OyunDurumu, oyuncu: OyuncuId, suAn: number): AksiyonSonucu {
  const engel = siraKontrol(durum, oyuncu, 'cekme');
  if (engel !== null) return hata(engel);

  const pencere = durum.pencere;
  // KURALLAR.md §5.2 — sirasi gelen oyuncu, tas atildiktan sonraki pencere
  // suresi boyunca desteden cekemez. Digerlerine garanti tepki suresi.
  if (pencere !== null && suAn < pencere.acilisZamani + durum.ayarlar.talepPenceresiMs) {
    return hata('pencere-suresi-dolmadi');
  }

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

  if (calan !== null && pencere !== null) {
    const yigin = atikYiginlari[pencere.atan];
    const ustTas = yigin[yigin.length - 1];
    if (ustTas === undefined || ustTas.id !== pencere.tasId) return hata('atik-yigini-bos');

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

  return tamam({
    ...durum,
    deste,
    istakalar,
    atikYiginlari,
    atikSirasi,
    calinanSayisi,
    faz: 'atma',
    pencere: null,
  });
}

function cekAtiktan(durum: OyunDurumu, oyuncu: OyuncuId, suAn: number): AksiyonSonucu {
  const engel = siraKontrol(durum, oyuncu, 'cekme');
  if (engel !== null) return hata(engel);

  const pencere = durum.pencere;
  if (pencere === null) return hata('talep-penceresi-kapali');

  // Tur 15 (KURALLAR.md 0.2): "cifti bende" hakki sirasi gelenin bedelsiz
  // hakkini da gecer. Pencere kapanmadan yerden tas alinamaz — alinsaydi
  // cifti tutan oyuncunun hakki dogmadan yok olurdu.
  if (durum.tur === 15 && durum.ayarlar.ciftCalmaHakki) {
    if (suAn < pencere.acilisZamani + durum.ayarlar.talepPenceresiMs) {
      return hata('pencere-suresi-dolmadi');
    }
    if (pencere.ciftTalebi !== null) return hata('cift-talebi-oncelikli');
  }

  const yigin = durum.atikYiginlari[pencere.atan];
  const ustTas = yigin[yigin.length - 1];
  if (ustTas === undefined) return hata('atik-yigini-bos');

  // §5.3 — sirasi gelen tasi alirsa is biter, talepler duser.
  return tamam({
    ...durum,
    istakalar: kayitGuncelle(durum.istakalar, oyuncu, [...durum.istakalar[oyuncu], ustTas]),
    atikYiginlari: kayitGuncelle(durum.atikYiginlari, pencere.atan, yigin.slice(0, -1)),
    atikSirasi: durum.atikSirasi.filter((id) => id !== ustTas.id),
    faz: 'atma',
    pencere: null,
  });
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

function ciftTalebi(durum: OyunDurumu, oyuncu: OyuncuId): AksiyonSonucu {
  if (durum.faz === 'el-bitti') return hata('el-bitti');
  if (durum.tur !== 15) return hata('cift-talebi-sadece-tur-15');
  if (!durum.ayarlar.ciftCalmaHakki) return hata('cift-calma-hakki-kapali');

  const pencere = durum.pencere;
  if (pencere === null) return hata('talep-penceresi-kapali');
  if (oyuncu === pencere.atan) return hata('atan-talep-edemez');
  if (oyuncu === durum.siradaki) return hata('sirasi-olan-talep-edemez');
  if (pencere.ciftTalebi !== null) return hata('zaten-cift-talebi-var');

  const yigin = durum.atikYiginlari[pencere.atan];
  const ustTas = yigin[yigin.length - 1];
  if (ustTas === undefined) return hata('atik-yigini-bos');

  // Blof engeli: talep ancak tasin birebir esi gercekten istakadaysa gecerli.
  // Istemcideki tusun kapali olmasi kullanici kolayligi; asil kontrol burada.
  const esiVar = durum.istakalar[oyuncu].some((tas) => birebirEsMi(tas, ustTas));
  if (!esiVar) return hata('cift-elinde-yok');

  return tamam({ ...durum, pencere: { ...pencere, ciftTalebi: oyuncu } });
}

// --- Atma ------------------------------------------------------------------

function at(durum: OyunDurumu, oyuncu: OyuncuId, tasId: TasId, suAn: number): AksiyonSonucu {
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

  // §7 — tum taslarini indirmis ve son tasini ortaya atmis oyuncu eli bitirir.
  // §8 — "okeyle bitti" = ortaya atilan son tasin okey olmasi.
  if (bitiriyor) {
    return tamam(elBitir(araDurum, 'normal', oyuncu, okeyMi(tas)));
  }

  return tamam({
    ...araDurum,
    hamleSayisi: kayitGuncelle(durum.hamleSayisi, oyuncu, durum.hamleSayisi[oyuncu] + 1),
    siradaki: sonrakiOyuncu(oyuncu),
    faz: 'cekme',
    pencere: {
      atan: oyuncu,
      tasId: tas.id,
      acilisZamani: suAn,
      talepler: [],
      ciftTalebi: null,
    },
  });
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

  if (okeyAlimi !== null) {
    // §6 istisnasi — hic acmamis oyuncu, okeyi alip ayni hamlede acabilir.
    const per = yerPeriBul(durum, okeyAlimi.perId);
    if (per === null) return hata('per-bulunamadi');
    const okey = tasBul(per.taslar, okeyAlimi.okeyTasId);
    if (okey === null || !okeyMi(okey)) return hata('okey-degil');
    const gercekler = taslariBul(istaka, okeyAlimi.yerineTasIdler);
    if (gercekler === null) return hata('tas-elinde-yok');
    if (!okeyCekilebilirMi(per, okeyAlimi.okeyTasId, gercekler)) return hata('okey-yerine-gecemez');

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

  return tamam({
    ...durum,
    istakalar: kayitGuncelle(durum.istakalar, oyuncu, kalan),
    yer: eklenen.yer,
    sonrakiPerId: eklenen.sonrakiPerId,
    acmisMi: kayitGuncelle(durum.acmisMi, oyuncu, true),
    // §6 — acilis hamlesinde isleme yok; bir tur donmesi gerekir.
    acilisHamlesi: kayitGuncelle(durum.acilisHamlesi, oyuncu, durum.hamleSayisi[oyuncu]),
  });
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

  return tamam({
    ...durum,
    istakalar: kayitGuncelle(durum.istakalar, oyuncu, kalan),
    yer: durum.yer.map((p) => (p.id === per.id ? { ...p, taslar: sonuc.per.taslar } : p)),
  });
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

  return tamam({
    ...durum,
    istakalar: kayitGuncelle(durum.istakalar, oyuncu, kalan),
    yer: eklenen.yer,
    sonrakiPerId: eklenen.sonrakiPerId,
  });
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

  return tamam({
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
  });
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

  return tamam(elBitir(araDurum, 'normal', oyuncu, okeyMi(atilan)));
}

// --- Indirgeyici -----------------------------------------------------------

export function reduce(durum: OyunDurumu, aksiyon: Aksiyon): AksiyonSonucu {
  switch (aksiyon.tip) {
    case 'CEK_DESTEDEN':
      return cekDesteden(durum, aksiyon.oyuncu, aksiyon.suAn);
    case 'CEK_ATIKTAN':
      return cekAtiktan(durum, aksiyon.oyuncu, aksiyon.suAn);
    case 'CALMA_TALEBI':
      return calmaTalebi(durum, aksiyon.oyuncu);
    case 'CIFT_TALEBI':
      return ciftTalebi(durum, aksiyon.oyuncu);
    case 'AT':
      return at(durum, aksiyon.oyuncu, aksiyon.tasId, aksiyon.suAn);
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
