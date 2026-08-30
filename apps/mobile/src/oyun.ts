// Cevrimdisi oyun surucusu — UYGULAMADA KULLANILMIYOR.
//
// Asil oyun sunucuda kosuyor (src/ag/cevrimiciOyun.ts). Bu dosya ayni isi
// cihazda yapiyor: tam durumu tutuyor, aksiyonlari `reduce`'a veriyor,
// zamani (`Date.now`) disaridan besliyor. Motor saf kaliyor. Diger uc
// oyuncuyu `bot.ts` oynatiyor.
//
// LOBIDE GIRISI YOK — bilerek. Oyun cevrimici oynanmak uzere kuruldu.
//
// Yine de silinmedi: sunucu ayakta olmadan ekrani calistirmanin tek yolu bu,
// ve `MasaSurucusu` sozlesmesinin ikinci uygulamasi olarak arayuzun gercekten
// surucuden bagimsiz kaldigini kanitliyor.
//
// Acmak icin src/Uygulama.tsx'te iki satir yeter:
//
//     const yerel = useOyun(1);
//     return <Masa surucu={yerel} onMasadanCik={...} />;
//
// (Alistirma modu ya da magaza incelemesi icin bir giris gerekirse baslangic
// noktasi burasi.)
//
// Ekran ve yer tutucu oyuncular durumu DOGRUDAN okumuyor; herkes kendi
// `viewFor` projeksiyonunu goruyor (CLAUDE.md motor kurali #3).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  elBaslat,
  kalanPencereSuresi,
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
  type TurNo,
} from '@kut/engine';
import { botAksiyonu } from './bot';
import { hataMetni } from './hataMetinleri';
import type { MasaSurucusu } from './surucu';
import {
  kademeDusur,
  kademeSuresi,
  kademeleriSifirla,
  sureDolduAksiyonu,
} from './sure';

export const INSAN: OyuncuId = 0;

function tohumUret(tur: TurNo, elSayaci: number): number {
  // Tohum motorun disindan gelir (CLAUDE.md #2). Tur ve el sayacini
  // karistirarak her el farkli, ama ayni girdiyle her zaman ayni olsun.
  return (tur * 7919 + elSayaci * 104729 + 15485863) | 0;
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

/** Cevrimdisi masada karsindakilerin adi. Cevrimicide gercek adlar gelir. */
const YEREL_ADLAR: Record<OyuncuId, string> = {
  0: 'SEN',
  1: 'SOL',
  2: 'KARŞI',
  3: 'SAĞ',
};

/** Tur sonu tablosunun ekranda kalma suresi (sn) — okunacak kadar. */
const TUR_ARASI_SN = 5;

export function useOyun(baslangicTuru: TurNo = 1): OyunArayuzu {
  const [durum, setDurum] = useState<OyunDurumu>(() =>
    elBaslat({ tur: baslangicTuru, baslayan: INSAN, tohum: tohumUret(baslangicTuru, 0) }),
  );
  const [sonHata, setSonHata] = useState<HataKodu | null>(null);
  const baslayanRef = useRef<OyuncuId>(INSAN);
  const elSayaciRef = useRef(0);
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
    elSayaciRef.current += 1;
    yeniElHazirla();
    setDurum(
      elBaslat({ tur, baslayan: baslayanRef.current, tohum: tohumUret(tur, elSayaciRef.current) }),
    );
  }, [yeniElHazirla]);

  const sonrakiTur = useCallback(() => {
    baslayanRef.current = sonrakiBaslayan(baslayanRef.current);
    setDurum((mevcut) => {
      const tur = (mevcut.tur < 16 ? mevcut.tur + 1 : 1) as TurNo;
      elSayaciRef.current += 1;
      yeniElHazirla();
      return elBaslat({ tur, baslayan: baslayanRef.current, tohum: tohumUret(tur, elSayaciRef.current) });
    });
  }, [yeniElHazirla]);

  // --- Yer tutucu oyuncular ------------------------------------------------
  // Kendi `viewFor` projeksiyonlarindan fazlasini gormezler (motor kurali #3).
  // Karar mantigi src/bot.ts'te; burada yalnizca sirayla uygulaniyor.
  useEffect(() => {
    if (durum.faz === 'el-bitti') return;
    if (durum.siradaki === INSAN) return;

    const siradaki = durum.siradaki;
    const bekleme =
      durum.faz === 'cekme'
        ? Math.max(700, kalanPencereSuresi(durum, Date.now()) + 150)
        : 800;

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
            // (Ornegin talep penceresi henuz kapanmamissa, kapaninca gecer.)
            setBotTetik((sayac) => sayac + 1);
          }
          break;
        }
        if (aksiyon.tip === 'AT') break;
      }
    }, bekleme);

    return () => clearTimeout(zamanlayici);
  }, [durum, gonder, botTetik]);

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

  useEffect(() => {
    if (elBitti || durum.siradaki !== INSAN) {
      setSiraBitisi(null);
      return;
    }
    setSiraBitisi(Date.now() + siraSuresi);
  }, [elNo, durum.siradaki, durum.faz, elBitti, siraSuresi]);

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

        if (!gonder(aksiyon)) {
          // Tek beklenen ret: talep penceresi henuz kapanmadi (§5.2).
          // Kapanmasini bekleyip yeniden dene; baska bir sebepse birak.
          const kalan = kalanPencereSuresi(durumRef.current, Date.now());
          if (kalan > 0) setSiraBitisi(Date.now() + kalan + 50);
          break;
        }
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
    sonHata: hataMetni(sonHata),
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
    adlar: YEREL_ADLAR,
    // Motor bu cihazda kosuyor; kopacak bir baglanti yok.
    bagli: true,
    cevrimici: false,
  };
}
