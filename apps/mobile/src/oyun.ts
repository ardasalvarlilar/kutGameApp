// Cevrimdisi oyun surucusu — lobideki ALISTIRMA bunu kullanir
// (src/Uygulama.tsx'teki `AlistirmaMasasi`).
//
// Asil oyun sunucuda kosuyor (src/ag/cevrimiciOyun.ts). Bu dosya ayni isi
// cihazda yapiyor: tam durumu tutuyor, aksiyonlari `reduce`'a veriyor,
// zamani (`Date.now`) disaridan besliyor. Motor saf kaliyor. Diger uc
// oyuncuyu `bot.ts` oynatiyor.
//
// Iki isi birden goruyor: sunucu ayakta olmadan oynanabilen tek yol bu
// (magaza denetcisi de dahil — CLAUDE.md), ve `MasaSurucusu` sozlesmesinin
// ikinci uygulamasi olarak arayuzun gercekten surucuden bagimsiz kaldigini
// kanitliyor.
//
// Ekran ve yer tutucu oyuncular durumu DOGRUDAN okumuyor; herkes kendi
// `viewFor` projeksiyonunu goruyor (CLAUDE.md motor kurali #3).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  OYUNCULAR,
  elBaslat,
  elKur,
  macKazanani,
  oyuncuKaydiOlustur,
  reduce,
  sonrakiBaslayan,
  viewFor,
  type Aksiyon,
  type HataKodu,
  type OyuncuGorunumu,
  type OyuncuId,
  type OyuncuKaydi,
  type OyunDurumu,
  type Tas,
  type TurNo,
} from '@kut/engine';
import { botAksiyonu, botTalebi } from '@kut/politika';
import { useCeviri, type MetinAnahtari } from './dil';
import type { MasaSurucusu } from './surucu';
import {
  kademeDusur,
  kademeSuresi,
  kademeleriSifirla,
  sureDolduAksiyonu,
} from '@kut/politika';

export const INSAN: OyuncuId = 0;

function tohumUret(): number {
  // Tohum motorun DISINDAN gelir (CLAUDE.md #2): rastgelelik motorda yasak,
  // burada serbest. Motorun belirlenimliligi bozulmuyor — ayni tohum yine
  // ayni eli kuruyor, degisen tek sey tohumun nereden geldigi.
  //
  // Eskiden tohum (tur, elSayaci)'nin saf bir fonksiyonuydu. Belirlenimli
  // olmasi test icin iyiydi ama oyun icin hataydi: her yeni alistirma masasi
  // 1. tura ayni sayaçla basladigi icin dagitim, cekilen taslarin sirasi ve
  // dolayisiyla yer tutucularin oynayisi her seferinde birebir ayniydi.
  // Sunucu ayni isi ayni sekilde yapiyor (servisler/oyunServisi.ts).
  return (Math.floor(Math.random() * 0xffffffff) | 0) >>> 0;
}

/** Yerel surucu — `MasaSurucusu` sozlesmesine ek olarak birkac ayrinti. */
export interface OyunArayuzu extends MasaSurucusu {
  readonly durum: OyunDurumu;
  /** Ayni tick icinde guncel durumu okumak icin — React state'i gecikmeli. */
  readonly suAnkiDurum: () => OyunDurumu;
  /** Ayni turu yeni bir tohumla yeniden dagitir. */
  readonly yeniEl: (tur: TurNo) => void;
  /** Kacinci kademede (0 = tam sure). Sure doldukca artar (§9 0.4). */
  readonly sureKademem: number;
  /** Oynanmis el sayisi — 16 olunca mac biter. */
  readonly oynananEl: number;
}

/**
 * Cevrimdisi masada karsindakilerin adi. Cevrimicide gercek adlar gelir.
 *
 * Yon adlari cevriliyor; hesabi olmayan yer tutuculara "Bot Ada" gibi bir ad
 * uydurmak yerine oturduklari yeri soylemek daha anlasilir.
 */
const YEREL_AD_ANAHTARLARI: Record<OyuncuId, MetinAnahtari> = {
  0: 'oyuncu.sen',
  1: 'oyuncu.sol',
  2: 'oyuncu.karsi',
  3: 'oyuncu.sag',
};

/** Tur sonu tablosunun ekranda kalma suresi (sn) — okunacak kadar. */
const TUR_ARASI_SN = 5;

/** Yer tutucu oyuncunun normal dusunme suresi (ms). */
const BOT_BEKLEMESI_MS = 700;

/**
 * Insanin "ISTIYORUM" diyebilmesi icin tanidigimiz sure (ms).
 *
 * §9 0.9 ile talep penceresinin sabit suresi kalkti: pencere artik sirasi
 * gelen oyuncu OYNAYANA KADAR acik. Cevrimici masada bunun karsiligi var —
 * sirasi gelen insan dusunurken digerleri karar verir. Cevrimdisi masada ise
 * sirasi gelen bir yer tutucu; 700 ms'de cekseydi insanin calma hakki
 * fiilen yok olurdu. Bu bir KURAL DEGIL, yer tutucunun temposu.
 */
const BOT_CALMA_PAYI_MS = 2600;

/**
 * Yer tutucunun "ISTIYORUM" demeden once bekledigi sure — INSAN calabilirken.
 *
 * BOT_CALMA_PAYI_MS'ten kisa: sirasi gelen yer tutucu pencereyi 2600 ms'de
 * kapatiyor, talep ondan once girmezse hic girmez. Sifir degil, cunku tur
 * 15'te `CIFT_TALEBI` aninda sonuclaniyor (§9 0.10) ve insanla yaris olabilir.
 */
const BOT_TALEP_GECIKMESI_MS = 1600;

/**
 * Insan calamiyorken talep gecikmesi (ms).
 *
 * Ayri deger sart: insan atan ya da sirasi gelen ise yer tutucu pencereyi
 * BOT_BEKLEMESI_MS'te (700 ms) kapatiyor. Tek bir 1600 ms'lik gecikme,
 * INSANIN ATTIGI taslar icin talebi fiilen imkansiz kilardi. Beklemenin
 * karsiligi da yok: tepki verecek insan zaten yok.
 */
const BOT_HIZLI_TALEP_MS = 350;

/** Pencere acikken "ISTIYORUM" diyebilecek bir insan var mi (§5)? */
function insanCalabilirMi(durum: OyunDurumu): boolean {
  const pencere = durum.pencere;
  return pencere !== null && pencere.atan !== INSAN && durum.siradaki !== INSAN;
}

/**
 * Sirasi gelen yer tutucu ne kadar bekleyecek?
 *
 * Cekme fazinda ve masada insanin calabilecegi bir tas varsa daha uzun:
 * insan ne atan ne de sirasi gelen ise "ISTIYORUM" diyebilir (§5).
 */
function botBeklemesi(durum: OyunDurumu): number {
  if (durum.faz !== 'cekme') return 800;
  return insanCalabilirMi(durum) ? BOT_CALMA_PAYI_MS : BOT_BEKLEMESI_MS;
}

/**
 * Ogretici acikken masanin frenleri.
 *
 * Ikisi de SART: ogretici bir adimi anlatirken masa kendi basina ilerlerse
 * (sure dolar, yerine oynanir; yer tutucular hamlelerini yapar) adimin
 * anlattigi durum daha kullanici okurken dagiliyor.
 */
export interface OgreticiFreni {
  /** Sira suresi islemesin — kullanici balonu okurken yerine oynanmasin. */
  readonly sureDur: boolean;
  /** Yer tutucular beklesin; ogretici siralarini geldiginde birakiyor. */
  readonly yerTutucularDursun: boolean;
}

/**
 * @param kuruluDeste Verilirse ILK el karistirilmadan bu desteyle dagitilir
 *   (ogretici senaryosu). Sonraki eller yine tohumlu — ogretici yalnizca tur
 *   1'i kapsiyor, sonrasinda masa normal alistirmaya donuyor.
 */
export function useOyun(
  baslangicTuru: TurNo = 1,
  kuruluDeste?: readonly Tas[],
  fren?: OgreticiFreni,
): OyunArayuzu {
  const [durum, setDurum] = useState<OyunDurumu>(() =>
    kuruluDeste === undefined
      ? elBaslat({ tur: baslangicTuru, baslayan: INSAN, tohum: tohumUret() })
      : elKur({ tur: baslangicTuru, baslayan: INSAN, deste: kuruluDeste }),
  );
  const t = useCeviri();
  const [sonHata, setSonHata] = useState<HataKodu | null>(null);
  const baslayanRef = useRef<OyuncuId>(INSAN);
  // Yeni el, sira degismeden de baslayabilir (insan basliyorsa). Sure sayaci
  // bu sayacla eli ayirt ediyor.
  const [elNo, setElNo] = useState(0);
  const [siraBitisi, setSiraBitisi] = useState<number | null>(null);
  // Bot ilerleyemediginde effect'i yeniden kosturmak icin. Reddedilen bir
  // aksiyon `durum`u degistirmedigi icin effect kendiliginden tetiklenmiyor;
  // bu sayac olmasa sira orada kilitli kalirdi.
  const [botTetik, setBotTetik] = useState(0);
  // KURALLAR.md §8 — her elin puani mac toplamina eklenir; 16 el sonunda
  // EN DUSUK toplam kazanir. Kazanan her elde -100 aldigi icin toplam
  // eksiye de inebilir.
  const [macPuanlari, setMacPuanlari] = useState<OyuncuKaydi<number>>(() =>
    oyuncuKaydiOlustur(() => 0),
  );
  const [oynananEl, setOynananEl] = useState(0);
  // Ayni elin puani iki kez eklenmesin: el bittiginde durum birden cok kez
  // render edilebiliyor.
  const islenenElRef = useRef<number>(-1);
  // §9 0.4 — her oyuncunun sure kademesi. Suresini dolduran bir alt kademeye
  // duser ve orada kalir; el degisince sifirlanmaz.
  const [sureKademeleri, setSureKademeleri] = useState<OyuncuKaydi<number>>(kademeleriSifirla);

  const yerelAdlar = useMemo<Record<OyuncuId, string>>(
    () => oyuncuKaydiOlustur((oyuncu) => t(YEREL_AD_ANAHTARLARI[oyuncu])),
    [t],
  );

  // React'te setState guncelleyicisi saf olmak zorunda, bu yuzden reduce
  // disarida calisiyor. Ref sayesinde ayni tick icinde art arda gonderilen
  // aksiyonlar da guncel durumu goruyor.
  const durumRef = useRef(durum);
  durumRef.current = durum;

  const gonder = useCallback((aksiyon: Aksiyon): boolean => {
    const sonuc = reduce(durumRef.current, aksiyon);
    if (!sonuc.ok) {
      setSonHata(sonuc.reason);
      return false;
    }
    durumRef.current = sonuc.state;
    setDurum(sonuc.state);
    setSonHata(null);
    return true;
  }, []);

  // Yeni el basliyor: el sayacini ilerlet ve sure kademelerini sifirla.
  // §9 0.7 — ceza yalnizca o eli kapsar, yeni ele herkes 30 saniyeyle baslar.
  const yeniElHazirla = useCallback(() => {
    setElNo((onceki) => onceki + 1);
    setSureKademeleri(kademeleriSifirla());
    setSonHata(null);
  }, []);

  const yeniEl = useCallback((tur: TurNo) => {
    yeniElHazirla();
    setDurum(elBaslat({ tur, baslayan: baslayanRef.current, tohum: tohumUret() }));
  }, [yeniElHazirla]);

  const sonrakiTur = useCallback(() => {
    baslayanRef.current = sonrakiBaslayan(baslayanRef.current);
    setDurum((mevcut) => {
      const tur = (mevcut.tur < 16 ? mevcut.tur + 1 : 1) as TurNo;
      yeniElHazirla();
      return elBaslat({ tur, baslayan: baslayanRef.current, tohum: tohumUret() });
    });
  }, [yeniElHazirla]);

  // --- Yer tutucu oyuncular ------------------------------------------------
  // Kendi `viewFor` projeksiyonlarindan fazlasini gormezler (motor kurali #3).
  // Karar mantigi src/bot.ts'te; burada yalnizca sirayla uygulaniyor.
  const yerTutucularDursun = fren?.yerTutucularDursun ?? false;

  useEffect(() => {
    if (durum.faz === 'el-bitti') return;
    if (durum.siradaki === INSAN) return;
    if (yerTutucularDursun) return;

    const siradaki = durum.siradaki;
    const bekleme = botBeklemesi(durum);

    const zamanlayici = setTimeout(() => {
      // Bir sirada birden cok hamle olabilir: acilis, isleme, sonra atis.
      for (let adim = 0; adim < 10; adim++) {
        const mevcut = durumRef.current;
        if (mevcut.faz === 'el-bitti' || mevcut.siradaki !== siradaki) break;

        const gorunumu = viewFor(mevcut, siradaki);
        const aksiyon = botAksiyonu(gorunumu, siradaki, Date.now());
        if (aksiyon === null) break;

        if (!gonder(aksiyon)) {
          // Motor reddetti. Kurtarma FAZA UYGUN olmali: cekme fazinda "at"
          // demek `once-cekmelisin` ile yine reddedilir ve sira kilitlenir.
          // `sureDolduAksiyonu` tam da bunu veriyor — cekmediyse desteden
          // ceker, cektiyse ise yaramayan tasi atar.
          const kurtarma = sureDolduAksiyonu(
            viewFor(durumRef.current, siradaki),
            siradaki,
            Date.now(),
          );
          if (kurtarma === null || !gonder(kurtarma)) {
            // Hala ilerleyemedik. Reddedilen aksiyon durumu degistirmedigi
            // icin bu effect bir daha kosmaz; sayaci artirip yeniden dene.
            setBotTetik((sayac) => sayac + 1);
          }
          break;
        }
        if (aksiyon.tip === 'AT') break;
      }
    }, bekleme);

    return () => clearTimeout(zamanlayici);
  }, [durum, gonder, botTetik, yerTutucularDursun]);

  // --- Yer tutucularin calma karari ----------------------------------------
  // KURALLAR.md §5: calma sira BASKASINDAYKEN yapilan bir hamle, bu yuzden
  // yukaridaki "sirasi gelen oynar" effect'i onu kapsamiyor. Karar
  // @kut/politika'da (`botTalebi`) — sunucudaki botlarla AYNI kod.
  useEffect(() => {
    if (durum.faz === 'el-bitti') return;
    if (durum.pencere === null) return;
    if (yerTutucularDursun) return;

    const zamanlayici = setTimeout(() => {
      for (const koltuk of OYUNCULAR) {
        if (koltuk === INSAN) continue;

        const mevcut = durumRef.current;
        // `CIFT_TALEBI` tasi aninda alip pencereyi kapatiyor (§9 0.10);
        // sonraki koltuklar icin ortada pencere kalmaz.
        if (mevcut.faz === 'el-bitti' || mevcut.pencere === null) break;

        const aksiyon = botTalebi(viewFor(mevcut, koltuk), koltuk, Date.now());
        // Reddedilecek talep hic gonderilmiyor; `botTalebi` uygun olmayan
        // koltuk icin null donuyor.
        if (aksiyon !== null) gonder(aksiyon);
      }
    }, insanCalabilirMi(durum) ? BOT_TALEP_GECIKMESI_MS : BOT_HIZLI_TALEP_MS);

    return () => clearTimeout(zamanlayici);
  }, [durum, gonder, yerTutucularDursun]);

  // --- Sira suresi ---------------------------------------------------------
  // Insan sure hakki icinde tasini atmazsa yerine oynanir.
  // Sayac burada duruyor: motorda zamanlayici yok (CLAUDE.md #1) ve zaman
  // disaridan geliyor (#2). Sunucu yazildiginda bu iki effect sunucuya
  // tasinacak, karar (src/sure.ts) oldugu yerde kalacak.
  //
  // Sure iki kez baslar (§9 0.4): sira insana GECTIGINDE ve her TAS
  // CEKME'den sonra. Yani cekmek icin bir hak, atmak icin ayri bir hak var.
  // Fazin degismesi tam da bu iki ani isaret ettigi icin effect ona bagli;
  // `durum`un tamamina baglansaydi her acilis/isleme de sayaci sifirlardi.
  const elBitti = durum.faz === 'el-bitti';
  const sureler = durum.ayarlar.siraSureleriMs;
  const siraSuresi = kademeSuresi(sureKademeleri[INSAN], sureler);

  const sureDur = fren?.sureDur ?? false;

  useEffect(() => {
    // Ogretici acikken sayac hic baslamiyor: balonu okumanin suresi olmaz.
    if (sureDur || elBitti || durum.siradaki !== INSAN) {
      setSiraBitisi(null);
      return;
    }
    setSiraBitisi(Date.now() + siraSuresi);
  }, [elNo, durum.siradaki, durum.faz, elBitti, siraSuresi, sureDur]);

  useEffect(() => {
    if (siraBitisi === null) return;

    const zamanlayici = setTimeout(() => {
      // Cekme + atma iki ayri aksiyon; ikincisi birincinin sonucuna bagli.
      let yerineOynandi = false;
      for (let adim = 0; adim < 4; adim++) {
        const aksiyon = sureDolduAksiyonu(
          viewFor(durumRef.current, INSAN),
          INSAN,
          Date.now(),
        );
        if (aksiyon === null) break;

        // Motor reddettiyse israr etmenin anlami yok: durum degismedigi icin
        // ayni aksiyon yine reddedilir. (§9 0.9'dan once burada bir istisna
        // vardi — talep penceresinin kapanmasini beklemek; o sure kalkti.)
        if (!gonder(aksiyon)) break;
        yerineOynandi = true;
        if (aksiyon.tip === 'AT') break;
      }

      // §9 0.4 — suresini dolduran oyuncu bir alt kademeye duser. Yukaridaki
      // dongu sirayi bitirdigi (AT) icin yeni sure pratikte siranin BIR
      // SONRAKI gelisinde devreye girer: kademe degisince effect yeniden
      // kosar ama o an sira artik insanda olmadigindan bitisi null yapar.
      if (yerineOynandi) {
        setSureKademeleri((onceki) => kademeDusur(onceki, INSAN, sureler));
      }
    }, Math.max(0, siraBitisi - Date.now()));

    return () => clearTimeout(zamanlayici);
  }, [siraBitisi, gonder, sureler]);

  // El kapandiginda puanlari mac toplamina ekle. `elNo` her el icin farkli
  // oldugu icin ayni el iki kez islenmiyor.
  useEffect(() => {
    if (durum.faz !== 'el-bitti' || durum.sonuc === null) return;
    if (islenenElRef.current === elNo) return;
    islenenElRef.current = elNo;

    const sonuc = durum.sonuc;
    setMacPuanlari((onceki) =>
      oyuncuKaydiOlustur((oyuncu) => onceki[oyuncu] + sonuc.puanlar[oyuncu]),
    );
    setOynananEl((sayi) => sayi + 1);
  }, [durum.faz, durum.sonuc, elNo]);

  // Mac, 16. TUR oynanip bittiginde biter (KURALLAR.md §3 — 16 tur).
  // El sayisina bakmak yanlis olurdu: ayni tur yeniden dagitilabiliyor.
  const macKazananlari = useMemo(
    () => (durum.faz === 'el-bitti' && durum.tur >= 16 ? macKazanani(macPuanlari) : []),
    [durum.faz, durum.tur, macPuanlari],
  );

  const gorunum = useMemo(() => viewFor(durum, INSAN), [durum]);

  const suAnkiDurum = useCallback(() => durumRef.current, []);

  return {
    gorunum,
    durum,
    // Surucu sozlesmesi HAZIR METIN istiyor: cevrimici surucude hata kodu
    // sunucudan geliyor ve ekran ikisini ayirt etmek zorunda kalmasin.
    // Kod olarak tasiniyor; cumleye ekran ceviriyor (hataMetinleri.ts).
    sonHata,
    gonder,
    suAnkiDurum,
    yeniEl,
    sonrakiTur,
    siraBitisi,
    siraSuresi,
    sureKademem: sureKademeleri[INSAN],
    macPuanlari,
    oynananEl,
    macKazananlari,
    turArasiSn: TUR_ARASI_SN,
    adlar: yerelAdlar,
    // Motor bu cihazda kosuyor; kopacak bir baglanti yok.
    bagli: true,
    cevrimici: false,
  };
}
