import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  Animated,
  Easing,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  OYUNCULAR,
  eldenBitmeTuruMu,
  siradaIleri,
  turSarti,
  type OyuncuId,
  type Tas,
  type TasHareketi,
  type TasId,
  type TurNo,
} from '@kut/engine';
import { Dugme, DizmeDugmesi } from './bilesenler/Dugme';
import { useHedef } from './ogretici/hedefKaydi';
import { IZGARA_BOYU, Istaka, SLOT_BOY, SLOT_EN } from './bilesenler/Istaka';
import { Orta, type CekmeKaynagi } from './bilesenler/Orta';
import { KapaliTas, TasGorseli } from './bilesenler/TasGorseli';
import { OyuncuSeridi } from './bilesenler/OyuncuSeridi';
import { PerAlani } from './bilesenler/PerAlani';
import { PuanTablosu } from './bilesenler/PuanTablosu';
import { SiraSayaci } from './bilesenler/SiraSayaci';
import { Ayarlar, type MasadakiOyuncu } from './bilesenler/Ayarlar';
import type { SikayetSebebi } from './ag/api';
import { UcanTas, type Nokta, type Ucus } from './bilesenler/UcanTas';
import { hareketUcuslari, ucanTasIdleri } from './ucuslar';
import { atikAltindaki } from './atikBellegi';
import { useCeviri, type MetinAnahtari } from './dil';
import { hataMetni } from './hataMetinleri';
import { gruplariKimlige, kutDiz, seriDiz } from '@kut/politika';
import { bitirenTaslar, eldenBitmeCozumu } from './eldenBitme';
import {
  SATIR_SAYISI,
  ayir,
  duzenGruplari,
  duzenOlustur,
  duzenTazele,
  slotaYerlestir,
  tasiTasi,
  topla,
  type Duzen,
} from './duzen';
import {
  MERKEZ_EN_AZ,
  OLCULER,
  SUTUN_BOSLUK,
  yanSutunEni,
  yanTasEni,
  yatayTasEni,
} from './olculer';
import {
  anahtardanHedef,
  hedefAnahtari,
  hedefBul,
  istakaSlotuBul,
  merkez,
  type Dikdortgen,
  type HedefKaydi,
} from './hedefler';
import { islenecekTaslar } from './isleme';
import { islemePlani } from './islemePlani';
import { okeyAlinabilirMi, okeyFirsatiSec, okeyleAcilisBul } from './okey';
import type { MasaSurucusu } from './surucu';
import { yetkiler } from './yetkiler';
import { sesGirdisi } from './ses';
import { useSes, useSesSecici } from './sesCalar';
import { renkler } from './tema';

// Oyun saat yonunde doner (KURALLAR.md §4): attigim tasi SAGIMDAKI alir.
// Motor bunu koltuk numarasini AZALTARAK yapiyor (`siradaIleri`), yani
// benden bir sonraki oynayan sagimda oturur.
//
// Ekranda ben her zaman altta otururum — ama koltuk numaram 0 olmak zorunda
// degil. Cevrimici masada 2 numarali koltuga oturmus olabilirim; o yuzden
// yerlesim sabit degil, kendi koltugumdan TURETILIYOR.
const EN_AZ_SUTUN = 8;

/**
 * Tur -> acilis sartinin sozluk anahtari.
 *
 * Sart metni motorda da var (`turlar.ts`) ama orasi TURKCE ve oyle kalmali:
 * motor cevirilemez, KURALLAR.md'nin diliyle yazilmis bir spesifikasyon.
 * Ekran metnini tur numarasindan turetmek ikisini ayirmanin en ucuz yolu.
 */
const TUR_SART_ANAHTARLARI: Record<TurNo, MetinAnahtari> = {
  1: 'tur.sart1', 2: 'tur.sart2', 3: 'tur.sart3', 4: 'tur.sart4',
  5: 'tur.sart5', 6: 'tur.sart6', 7: 'tur.sart7', 8: 'tur.sart8',
  9: 'tur.sart9', 10: 'tur.sart10', 11: 'tur.sart11', 12: 'tur.sart12',
  13: 'tur.sart13', 14: 'tur.sart14', 15: 'tur.sart15', 16: 'tur.sart16',
};

/** Ekrandaki dort yer — koltuk numaralari `gorunum.ben`den hesaplanir. */
interface Yerlesim {
  readonly ben: OyuncuId;
  readonly sag: OyuncuId;
  readonly karsi: OyuncuId;
  readonly sol: OyuncuId;
}

function yerlesimKur(ben: OyuncuId): Yerlesim {
  return {
    ben,
    sag: siradaIleri(ben, 1),
    karsi: siradaIleri(ben, 2),
    sol: siradaIleri(ben, 3),
  };
}

/**
 * Parmaktaki tas: ortadan istakaya ya da istakadan masaya goturuluyor.
 * Ikisi de ayni, en ustteki katmanda ciziliyor.
 */
interface Cekme {
  readonly kaynak: CekmeKaynagi | 'istaka';
  /** Obekten ya da istakadan alinan tas acik; desteden gelen kapali (null). */
  readonly tas: Tas | null;
}

/** Istakaya birakildi, hamle gonderildi; tasin gelmesi bekleniyor. */
interface BekleyenCekim {
  /** Tasin konacagi slot — oyuncunun biraktigi yer. */
  readonly slot: number;
  /** Obekten alinan tasin kimligi; desteden cekilende bilinmiyor (null). */
  readonly tasId: TasId | null;
  /** Desteden cekilen tasi tanimak icin: cekmeden onceki istaka. */
  readonly oncekiler: ReadonlySet<TasId>;
}

/**
 * Sunucunun cevabi bu kadar surede gelmezse (ya da hamle reddedildiyse) tas
 * elde tutulmayi birakir.
 */
const CEKME_BEKLEME_MS = 2000;

/** Ekranin biriktirdigi hareket sayisi siniri (bkz. `hareketArsivi`). */
const ARSIV_SINIRI = 256;

/** Beklenen tas istakaya geldi mi? Geldiyse kimligi. */
function gelenTas(bekleyen: BekleyenCekim, istaka: readonly Tas[]): TasId | null {
  if (bekleyen.tasId !== null) {
    return istaka.some((tas) => tas.id === bekleyen.tasId) ? bekleyen.tasId : null;
  }
  return istaka.find((tas) => !bekleyen.oncekiler.has(tas.id))?.id ?? null;
}

export interface MasaOzellikleri {
  /** Oyunu besleyen surucu — cihazdaki motor ya da sunucu (src/surucu.ts). */
  readonly surucu: MasaSurucusu;
  /** Ayarlardan "masadan cik" secilince — lobiye doner. */
  readonly onMasadanCik: () => void;

  // --- Sikayet ve engelleme (App Store 1.2) ---------------------------------
  // Surucude DEGIL burada: bunlar oyun durumu degil, hesap islemleri. Motorun
  // ya da projeksiyonun bunlardan haberi olmasi gerekmiyor.
  //
  // Hepsi istege bagli: cevrimdisi masada yer tutucularin hesabi yok, kimse
  // bildirilemez ve liste hic gosterilmez.
  /** Masadaki DIGER oyuncular — kendim haric. */
  readonly masadakiler?: readonly MasadakiOyuncu[];
  readonly engellenenIdler?: readonly string[];
  readonly onSikayet?: (oyuncuId: string, sebep: SikayetSebebi) => void;
  readonly onEngelle?: (oyuncuId: string) => void;
}

export function Masa({
  surucu,
  onMasadanCik,
  masadakiler = [],
  engellenenIdler = [],
  onSikayet,
  onEngelle,
}: MasaOzellikleri) {
  const {
    gorunum,
    sonHata,
    gonder,
    sonrakiTur,
    siraBitisi,
    siraSuresi,
    macPuanlari,
    macKazananlari,
    turArasiSn,
    adlar: ADLAR,
    bagli,
    cevrimici,
  } = surucu;

  const t = useCeviri();
  const INSAN = gorunum.ben;
  const yerlesim = useMemo(() => yerlesimKur(INSAN), [INSAN]);

  // Ogreticinin isik tutacagi ogeler. Dugmeler kendi `hedef` ozelligiyle
  // kaydoluyor; buradakiler dugme olmayanlar.
  const turHedefi = useHedef('tur');
  const sartHedefi = useHedef('sart');
  const istakaHedefi = useHedef('istaka');
  const ortaHedefi = useHedef('orta');

  const [sutunSayisi, setSutunSayisi] = useState(20);
  const [duzen, setDuzen] = useState<Duzen>([]);
  const [secili, setSecili] = useState<readonly TasId[]>([]);
  const [masaOlcu, setMasaOlcu] = useState({ en: 0, boy: 0 });
  const [ucusKuyrugu, setUcusKuyrugu] = useState<readonly Ucus[]>([]);
  const [ayarlarAcik, setAyarlarAcik] = useState(false);
  const [sesAcik, setSesAcik] = useState(true);

  // Birakma hedeflerinin EKRANDAKI dikdortgenleri. Masaya tas indikce yan
  // sutunlar genisliyor, ortadaki obek kayiyor; sabit bir esik yerine
  // gercek konum olculuyor (src/hedefler.ts).
  const [hedefler, setHedefler] = useState<readonly HedefKaydi[]>([]);
  const hedefRefleri = useRef(new Map<string, ComponentRef<typeof View> | null>());

  // Ortadan cekilen tas EKRANIN EN USTUNDEKI katmanda ciziliyor: masa ile
  // istaka ayri kutular ve tas ikisinin arasinda gidip geliyor — birinin
  // icinde cizilse otekinin altinda kalirdi.
  const [cekme, setCekme] = useState<Cekme | null>(null);
  const cekmeKonumu = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const katmanRef = useRef<ComponentRef<typeof View> | null>(null);
  const katmanKokuRef = useRef<Nokta>({ x: 0, y: 0 });
  const izgaraRef = useRef<ComponentRef<typeof View> | null>(null);
  const izgaraAlaniRef = useRef<Dikdortgen | null>(null);
  const kaynakRef = useRef<CekmeKaynagi>('deste');
  /** Parmagin tasin sol ust kosesine gore yeri. */
  const tutusRef = useRef<Nokta>({ x: 0, y: 0 });
  /** Tasin alindigi yer — geri birakilirsa oraya doner. */
  const cikisKonumuRef = useRef<Nokta>({ x: 0, y: 0 });
  /** Her yeni surukleme artiriyor; eski geri donus animasyonu yenisini silmesin. */
  const cekmeNoRef = useRef(0);
  const bekleyenRef = useRef<BekleyenCekim | null>(null);
  const bekleyenZamanlayiciRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Surukleyerek cektigim tasin `cekim` hareketi geldiginde ucurulmasin: tas
   * parmagimla zaten istakaya geldi, ortadan bir kez daha ucmasi onu iki
   * kez getirmek olurdu.
   */
  const kendiCekimimRef = useRef(false);
  /**
   * Surukleyerek attigim ya da isledigim tas: `atma`/`isleme` hareketi
   * geldiginde koltuktan ucurulmasin, tas parmagimla zaten oraya gitti.
   */
  const kendiTasimRef = useRef<TasId | null>(null);
  /** Masaya birakilan istaka tasi; elimden cikinca parmaktaki kopya kalkiyor. */
  const bekleyenAtisRef = useRef<TasId | null>(null);
  /** Masaya birakilan tas hedefine otururken masadaki boya kuculuyor. */
  const cekmeOlcegi = useRef(new Animated.Value(1)).current;

  const cekmeyiBitir = useCallback(() => {
    if (bekleyenZamanlayiciRef.current !== null) clearTimeout(bekleyenZamanlayiciRef.current);
    bekleyenZamanlayiciRef.current = null;
    bekleyenRef.current = null;
    bekleyenAtisRef.current = null;
    setCekme(null);
  }, []);

  useEffect(
    () => () => {
      if (bekleyenZamanlayiciRef.current !== null) clearTimeout(bekleyenZamanlayiciRef.current);
    },
    [],
  );

  /** Parmak noktasini (ekran) katmandaki tasin sol ust kosesine cevirir. */
  const cekmeKonumuHesapla = useCallback(
    (nokta: Nokta): Nokta => ({
      x: nokta.x - katmanKokuRef.current.x - tutusRef.current.x,
      y: nokta.y - katmanKokuRef.current.y - tutusRef.current.y,
    }),
    [],
  );

  const katmaniOlc = useCallback(() => {
    katmanRef.current?.measureInWindow((x, y) => {
      katmanKokuRef.current = { x, y };
    });
  }, []);

  /**
   * Oyuncu vazgecti (tasi hedefe birakmadi) ya da hamle olmadi: tas alindigi
   * yere geri kayip orada kayboluyor — ortadan alinan ortaya, istakadan
   * alinan kendi slotuna.
   */
  const cekmeyiGeriGotur = useCallback(() => {
    const no = cekmeNoRef.current;
    Animated.parallel([
      Animated.timing(cekmeKonumu, {
        toValue: cikisKonumuRef.current,
        duration: 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(cekmeOlcegi, { toValue: 1, duration: 160, useNativeDriver: false }),
    ]).start(() => {
      if (cekmeNoRef.current === no) setCekme(null);
    });
  }, [cekmeKonumu, cekmeOlcegi]);

  const izgaraRefAl = useCallback((gorunum: ComponentRef<typeof View> | null) => {
    izgaraRef.current = gorunum;
  }, []);

  const cal = useSes(sesAcik);
  const sesSecici = useSesSecici();
  /**
   * En son ANIMASYONU OYNATILAN hareketin sira numarasi.
   *
   * `null` "henuz hicbir gorunum gormedim" demek; ilk gorunum yalnizca
   * kaydediliyor. Yeniden baglanmada sunucu mevcut durumu dogrudan
   * gonderiyor ve bu olmadan coktan olmus hareketler yeniden oynardi.
   */
  const sonHareketNoRef = useRef<number | null>(null);
  /** Ucus noktalari masaya gore; per olcumunde masanin ekran konumu gerekiyor. */
  const masaRef = useRef<ComponentRef<typeof View> | null>(null);

  const istakam = gorunum.istakam;

  // Istaka degistiginde duzeni ve secimi hizala.
  //
  // Iki guncelleyici de DEGISIKLIK YOKSA ONCEKI DEGERI donduruyor. Cevrimici
  // oyunda her sunucu paketi yeni bir `istakam` dizisi getiriyor ve bu effect
  // her pakette kosuyor; yeni dizi dondurmek, rakip hamlelerinde bile masayi
  // iki kez yeniden cizdiriyordu.
  //
  // Ortadan surukleyerek cektigim tas geldiyse `duzenTazele` onu sona koyuyor;
  // `slotaYerlestir` oradan oyuncunun biraktigi slota tasiyor.
  useEffect(() => {
    const bekleyen = bekleyenRef.current;
    const gelen = bekleyen === null ? null : gelenTas(bekleyen, istakam);
    setDuzen((onceki) => {
      const tazelenmis = duzenTazele(onceki, istakam, sutunSayisi);
      return bekleyen === null || gelen === null
        ? tazelenmis
        : slotaYerlestir(tazelenmis, gelen, bekleyen.slot, sutunSayisi);
    });
    // Masaya birakilan istaka tasi elimden cikti (atildi, islendi): parmaktaki
    // kopya kalkiyor, tas artik hedefinde cizili.
    const atilan = bekleyenAtisRef.current;
    const atildi = atilan !== null && !istakam.some((tas) => tas.id === atilan);
    if (gelen !== null || atildi) cekmeyiBitir();
    setSecili((onceki) => {
      const kalan = onceki.filter((id) => istakam.some((tas) => tas.id === id));
      return kalan.length === onceki.length ? onceki : kalan;
    });
  }, [istakam, sutunSayisi, cekmeyiBitir]);

  // Masada artik SAAT ISLEMIYOR.
  //
  // Iki sayac vardi: talep penceresi ve sira suresi. Ilki §9 0.9 ile kalkti;
  // ikincisi `bilesenler/SiraSayaci.tsx`e tasindi. Onceden 200 ms'de bir
  // tiklayan bir state buradaydi ve her tikte BUTUN masa yeniden ciziliyordu
  // — istaka, per alanlari, ortadaki obek, yan panel. Sayac kendi bilesenine
  // cekilince tikin dokundugu yer o kucuk kutuyla sinirli kaldi.
  const elBitti = gorunum.faz === 'el-bitti';

  // Masadaki oturma yerleri — ucan tas animasyonu bu noktalar arasinda gider.
  // Koltuk numarasi degil YERLESIM belirliyor: kendi koltugum hangisi olursa
  // olsun ekranin altinda otururum.
  const koltukNoktasi = useCallback(
    (oyuncu: OyuncuId): Nokta => {
      const { en, boy } = masaOlcu;
      if (oyuncu === yerlesim.ben) return { x: en / 2, y: boy - 12 };
      if (oyuncu === yerlesim.sol) return { x: 16, y: boy / 2 };
      if (oyuncu === yerlesim.karsi) return { x: en / 2, y: 14 };
      return { x: en - 16, y: boy / 2 };
    },
    [masaOlcu, yerlesim],
  );
  const merkezNokta = useMemo<Nokta>(
    () => ({ x: masaOlcu.en / 2, y: masaOlcu.boy / 2 }),
    [masaOlcu],
  );
  // Kuyruktaki ilk ucus oynuyor; bitince sirayi bir sonrakine biraktiriyor.
  // Tek bir `ucus` state'i yetmiyordu: bir `CEK_DESTEDEN` UC hareket
  // uretebiliyor (ceken + calan + ceza) ve ucu de gorunmeli.
  const ucus = ucusKuyrugu[0] ?? null;
  const ucusuBitir = useCallback(() => setUcusKuyrugu((kuyruk) => kuyruk.slice(1)), []);
  // Havadaki tas varis yerinde gorunmemeli: ayni sirada birden fazla hamle
  // varken (ac + at) atilan tas kendi ucusundan ONCE yiginda beliriyordu.
  const ucanlar = useMemo(() => ucanTasIdleri(ucusKuyrugu), [ucusKuyrugu]);
  // Parmaktaki tas da obekte degil. Ikisinde de obek ALTINDAKI tasi ciziyor
  // (`atikAlti`) — eskiden orada gri bir kapali tas cikiyordu.
  const ustTasGizli =
    gorunum.atikUstu !== null && (ucanlar.has(gorunum.atikUstu.id) || cekme?.kaynak === 'atik');
  // Projeksiyon alttaki tasi vermiyor (KURALLAR.md §10.3); oyuncunun az once
  // gordugu hareketlerden kuruluyor (src/atikBellegi.ts). Motorun listesi son
  // 8 hareketi tutuyor ve bir bot tek sirada alip acip isleyip atabiliyor —
  // alttaki tasin atisi o pencereden cikabiliyor. Bu yuzden gorulen
  // hareketler burada biriktiriliyor; tekrari sira numarasi eliyor.
  const hareketArsiviRef = useRef<{ liste: TasHareketi[]; sonNo: number }>({
    liste: [],
    sonNo: 0,
  });
  const hareketArsivi = useMemo(() => {
    const arsiv = hareketArsiviRef.current;
    // Yeni el: numara geri gitti.
    if (gorunum.sonHareketNo < arsiv.sonNo) arsiv.liste = [];
    for (const hareket of gorunum.sonHareketler) {
      if (hareket.sira > arsiv.sonNo) arsiv.liste.push(hareket);
    }
    arsiv.sonNo = gorunum.sonHareketNo;
    // Yiginin tamami bile 106 tasi gecmez; sinir yalnizca buyumeyi durduruyor.
    if (arsiv.liste.length > ARSIV_SINIRI) arsiv.liste = arsiv.liste.slice(-ARSIV_SINIRI);
    return arsiv.liste.slice();
  }, [gorunum.sonHareketler, gorunum.sonHareketNo]);
  const obekAltindaki = useMemo(
    () =>
      ustTasGizli ? atikAltindaki(hareketArsivi, gorunum.atikUstu, gorunum.atikAdedi) : null,
    [ustTasGizli, hareketArsivi, gorunum.atikUstu, gorunum.atikAdedi],
  );

  /**
   * Perin masa icindeki merkezi — olculemezse null.
   *
   * Iki olcum birden gerekiyor: `measureInWindow` EKRAN koordinati veriyor,
   * ucus noktalari ise masaya gore. Masanin kendi konumunu cikarinca ikisi
   * ayni duzleme geliyor.
   */
  const perNoktalariniOlc = useCallback(
    async (perIdler: readonly number[]): Promise<Map<number, Nokta>> => {
      const sonuc = new Map<number, Nokta>();
      const masa = masaRef.current;
      if (masa === null || perIdler.length === 0) return sonuc;

      const masaKonumu = await new Promise<Nokta>((coz) =>
        masa.measureInWindow((x, y) => coz({ x, y })),
      );

      await Promise.all(
        perIdler.map(
          (perId) =>
            new Promise<void>((coz) => {
              const perGorunum = hedefRefleri.current.get(
                hedefAnahtari({ tip: 'per', perId }),
              );
              if (perGorunum === undefined || perGorunum === null) return coz();
              perGorunum.measureInWindow((x, y, en, boy) => {
                // Henuz yerlesmemis gorunum 0×0 doner; onu hedef sayma.
                if (en > 0 && boy > 0) {
                  sonuc.set(perId, {
                    x: x - masaKonumu.x + en / 2,
                    y: y - masaKonumu.y + boy / 2,
                  });
                }
                coz();
              });
            }),
        ),
      );
      return sonuc;
    },
    [],
  );

  /**
   * Per olculemediginde kullanilan yedek nokta.
   *
   * Perler oyuncunun seridiyle merkez arasinda duruyor (`PerAlani`), o yuzden
   * SAHIBININ koltugu ile merkezin ortasi makul bir tahmin. Animasyonu
   * dusurmek yerine yaklasik oynatmak daha iyi: yon yine dogru okunuyor.
   */
  const perYedekNoktasi = useCallback(
    (perId: number): Nokta => {
      const sahibi = gorunum.yer.find((per) => per.id === perId)?.sahibi ?? gorunum.ben;
      const koltuk = koltukNoktasi(sahibi);
      return { x: (koltuk.x + merkezNokta.x) / 2, y: (koltuk.y + merkezNokta.y) / 2 };
    },
    [gorunum.yer, gorunum.ben, koltukNoktasi, merkezNokta],
  );

  // --- Tas hareketleri ------------------------------------------------------
  // TEK effect, cunku SIRA onemli: once cekis, sonra isleme, en son atis.
  // Once atis ayri bir effect'te sayac farkindan cikariliyordu ve iki
  // effect'in tanim sirasi yuzunden atis cekisten ONCE oynuyordu. Artik sirayi
  // motor veriyor (`sonHareketler`), ekran yalnizca noktalari kuruyor.
  useEffect(() => {
    const gorulen = sonHareketNoRef.current;
    sonHareketNoRef.current = gorunum.sonHareketNo;

    // Ilk gorunumde yalnizca kaydediyoruz: masaya el ortasinda katilan oyuncu
    // (ya da yeniden baglanan) coktan olmus bir hareketi izlememeli.
    if (gorulen === null || masaOlcu.en === 0) return;

    const yeniler = gorunum.sonHareketler
      .filter((hareket) => hareket.sira > gorulen)
      .filter((hareket) => {
        // Parmagimla tasidigim tasi bir de koltuktan/ortadan ucurmak onu iki
        // kez goturmek olurdu. Sure dolunca sunucunun benim yerime yaptigi
        // hamleler ise ucmaya devam ediyor — onlari ben tasimadim.
        if (hareket.oyuncu !== gorunum.ben) return true;

        if (
          kendiCekimimRef.current &&
          hareket.tip === 'cekim' &&
          (hareket.kaynak === 'deste' || hareket.kaynak === 'atik')
        ) {
          kendiCekimimRef.current = false;
          return false;
        }

        const tasim = kendiTasimRef.current;
        const benimTasim =
          tasim !== null &&
          ((hareket.tip === 'atma' && hareket.tas.id === tasim) ||
            (hareket.tip === 'isleme' &&
              hareket.taslar.length === 1 &&
              hareket.taslar[0]?.id === tasim));
        if (benimTasim) {
          kendiTasimRef.current = null;
          return false;
        }
        return true;
      });
    if (yeniler.length === 0) return;

    const kur = (perNoktalari: Map<number, Nokta>): void => {
      const ucuslar = hareketUcuslari(yeniler, {
        merkez: merkezNokta,
        koltuk: koltukNoktasi,
        per: (perId) => perNoktalari.get(perId) ?? perYedekNoktasi(perId),
      });
      if (ucuslar.length > 0) setUcusKuyrugu((kuyruk) => [...kuyruk, ...ucuslar]);
    };

    // Pere giden hareket yoksa olcume hic girme: cekis ve atis icin per
    // konumu gereksiz.
    const perIdler = yeniler
      .filter((hareket) => hareket.tip === 'isleme' || hareket.tip === 'indirme')
      .map((hareket) => hareket.perId);
    if (perIdler.length === 0) {
      kur(new Map());
      return;
    }

    let iptal = false;
    void perNoktalariniOlc(perIdler).then((perNoktalari) => {
      if (!iptal) kur(perNoktalari);
    });
    return () => {
      iptal = true;
    };
  }, [
    gorunum.ben,
    gorunum.sonHareketNo,
    gorunum.sonHareketler,
    masaOlcu,
    koltukNoktasi,
    merkezNokta,
    perNoktalariniOlc,
    perYedekNoktasi,
  ]);

  // Yere inen taslarin olcusu masanin eninden turetiliyor: 13'luk bir seri
  // (KURALLAR.md §2'nin en uzun peri) yan sutunlara kirpilmadan sigmali,
  // ortadaki deste ile atik obegi de ezilmemeli. Hesap src/olculer.ts'te.
  const yanTas = useMemo(() => yanTasEni(masaOlcu.en), [masaOlcu.en]);
  const yatayTas = useMemo(() => yatayTasEni(masaOlcu.en), [masaOlcu.en]);
  const yanSutun = useMemo(() => yanSutunEni(masaOlcu.en), [masaOlcu.en]);

  // Ses, motorun degil ekranin isi (CLAUDE.md #1). Durum degisimini gorup
  // hangi efektin calacagini `sesSec` saf fonksiyonu soyluyor.
  useEffect(() => {
    const efekt = sesSecici.hatirla(sesGirdisi(gorunum));
    if (efekt !== null) cal(efekt);
  }, [gorunum, sesSecici, cal]);

  // §9 0.9 — yetkiler artik ZAMANA bagli degil (talep penceresinin suresi
  // kalkti). `an` bagimliligini birakmak bosuna hesap degil: `an` 200 ms'de
  // bir tikliyor ve bu memo o tempoda yeniden kosuyordu.
  const izin = useMemo(() => yetkiler(gorunum), [gorunum]);
  const sart = turSarti(gorunum.tur);
  const gruplar = useMemo(() => duzenGruplari(duzen, sutunSayisi), [duzen, sutunSayisi]);

  const acilisGruplari = useMemo(
    () =>
      gruplar
        .map((grup) => grup.filter((id) => secili.includes(id)))
        .filter((grup) => grup.length > 0),
    [gruplar, secili],
  );

  const olcumAl = useCallback((genislik: number) => {
    const yeni = Math.max(EN_AZ_SUTUN, Math.floor(genislik / SLOT_EN));
    setSutunSayisi((onceki) => (onceki === yeni ? onceki : yeni));
  }, []);

  const tasSec = useCallback((tasId: TasId) => {
    setSecili((onceki) =>
      onceki.includes(tasId) ? onceki.filter((id) => id !== tasId) : [...onceki, tasId],
    );
  }, []);

  const tasSurukle = useCallback((kaynak: number, hedef: number) => {
    setDuzen((onceki) => tasiTasi(onceki, kaynak, hedef));
  }, []);

  /**
   * Tas atma.
   *
   * KURALLAR.md §3 — tur 16'da yere per inmez; oyuncu butun elini perlere
   * bolup son tasi atarak biter. Motorun bunun icin ayri bir aksiyonu var
   * (`BITIR_ELDEN`), normal `AT` eli BITIRMEZ. Bu yuzden tur 16'da once
   * bolunme aranir: bolunuyorsa bitirme hamlesi gonderilir.
   */
  const at = useCallback(
    (tasId: TasId): boolean => {
      const suAn = Date.now();

      if (eldenBitmeTuruMu(gorunum.tur)) {
        const cozum = eldenBitmeCozumu(gorunum.istakam, tasId);
        if (cozum !== null) {
          const bitti = gonder({
            tip: 'BITIR_ELDEN',
            oyuncu: INSAN,
            perler: cozum.perler,
            atilanTasId: cozum.atilanTasId,
            suAn,
          });
          if (bitti) {
            setSecili([]);
            return true;
          }
          // Motor reddettiyse israr etme; normal atisa dus.
        }
      }

      const gitti = gonder({ tip: 'AT', oyuncu: INSAN, tasId, suAn });
      if (gitti) setSecili([]);
      return gitti;
    },
    [gonder, gorunum.tur, gorunum.istakam],
  );

  /**
   * Tur 16'da hangi taslar atilirsa el biter — ekranda isaretlenirler ki
   * oyuncu tek tek denemek zorunda kalmasin.
   */
  const bitirenler = useMemo(
    () => (eldenBitmeTuruMu(gorunum.tur) ? bitirenTaslar(gorunum.istakam) : []),
    [gorunum.tur, gorunum.istakam],
  );

  // --- Surukleyip birakma hedefleri ------------------------------------------
  // Hedeflerin yeri masa doldukca degisiyor, bu yuzden SURUKLEME BASLARKEN
  // olculuyor: `measureInWindow` ekran koordinati verir, istakadan gelen
  // pageX/pageY ile ayni duzlemde olur.
  const hedefKaydet = useCallback(
    (anahtar: string, gorunum: ComponentRef<typeof View> | null) => {
      if (gorunum === null) hedefRefleri.current.delete(anahtar);
      else hedefRefleri.current.set(anahtar, gorunum);
    },
    [],
  );

  const obekRef = useCallback(
    (gorunum: ComponentRef<typeof View> | null) => hedefKaydet('atik', gorunum),
    [hedefKaydet],
  );
  const perRef = useCallback(
    (perId: number, gorunum: ComponentRef<typeof View> | null) =>
      hedefKaydet(hedefAnahtari({ tip: 'per', perId }), gorunum),
    [hedefKaydet],
  );

  const hedefleriOlc = useCallback(() => {
    const girisler = [...hedefRefleri.current.entries()];
    const olcumler = girisler.map(
      ([anahtar, gorunum]) =>
        new Promise<HedefKaydi | null>((coz) => {
          const hedef = anahtardanHedef(anahtar);
          if (gorunum === null || hedef === null) return coz(null);
          gorunum.measureInWindow((x, y, en, boy) => {
            // Henuz yerlesmemis gorunum 0×0 doner; onu hedef sayma.
            if (!(en > 0 && boy > 0)) return coz(null);
            const alan: Dikdortgen = { x, y, en, boy };
            coz({ hedef, alan });
          });
        }),
    );
    void Promise.all(olcumler).then((sonuc) => {
      setHedefler(sonuc.filter((kayit): kayit is HedefKaydi => kayit !== null));
    });
  }, []);

  // --- Istakadan tas tasima --------------------------------------------------
  // Istakadaki tas parmakla masanin ustune goturuluyor; ortadan cekmeyle ayni
  // katmanda ciziliyor. Yigina birakilirsa atilir, pere birakilirsa islenir,
  // istakaya birakilirsa oraya yerlesir; baska yere birakilirsa oyuncu
  // vazgecmis sayilir ve tas kendi slotuna kayarak doner.

  const istakadanBasla = useCallback(
    (tasId: TasId, nokta: Nokta, kose: Nokta) => {
      const tas = istakam.find((aday) => aday.id === tasId);
      if (tas === undefined) return;
      // Hedeflerin ekrandaki yeri masa doldukca kayiyor; tam bu anda olculuyor
      // ki birakirken guncel olsun.
      hedefleriOlc();
      katmaniOlc();
      cekmeNoRef.current += 1;
      cekmeKonumu.stopAnimation();
      cekmeOlcegi.stopAnimation();
      cekmeOlcegi.setValue(1);
      tutusRef.current = { x: nokta.x - kose.x, y: nokta.y - kose.y };
      const cikis = cekmeKonumuHesapla(nokta);
      cikisKonumuRef.current = cikis;
      cekmeKonumu.setValue(cikis);
      setCekme({ kaynak: 'istaka', tas });
    },
    [istakam, hedefleriOlc, katmaniOlc, cekmeKonumu, cekmeOlcegi, cekmeKonumuHesapla],
  );

  /** Tas istakanin icinde birakildi; yerini Istaka degistirdi, kopya kalkar. */
  const istakadaBirakti = useCallback(() => {
    cekmeNoRef.current += 1;
    setCekme(null);
  }, []);

  /**
   * Tas istakadan cikarilip masaya birakildi.
   *
   * Atik obegine dustuyse atilir, bir perin ustune dustuyse O PERE islenir.
   * Hicbirine denk gelmiyorsa hicbir sey olmaz — tas istakaya geri doner.
   * Boylece ayni tas hem seriye hem kute isleyebiliyorken hangisi oldugunu
   * oyuncu seciyor; motor yine gecerliligi soyluyor.
   */
  const masayaBirak = useCallback(
    (tasId: TasId, nokta: Nokta) => {
      const hedef = hedefBul(nokta, hedefler);
      const kayit =
        hedef === null
          ? undefined
          : hedefler.find((aday) => hedefAnahtari(aday.hedef) === hedefAnahtari(hedef));
      // Hicbir hedefe dusmedi ya da sira bende degil: oyuncu vazgecmis
      // sayilir, tas istakadaki yerine kayarak doner.
      if (hedef === null || kayit === undefined || !izin.atabilir) {
        cekmeyiGeriGotur();
        return;
      }

      kendiTasimRef.current = tasId;
      bekleyenAtisRef.current = tasId;
      const gitti =
        hedef.tip === 'atik'
          ? // `at` uzerinden gidiyoruz, dogrudan `AT` gondermiyoruz: tur 16'da
            // elden bitme kontrolu orada (KURALLAR.md §3).
            at(tasId)
          : gonder({
              tip: 'ISLE',
              oyuncu: INSAN,
              perId: hedef.perId,
              tasIdler: [tasId],
              suAn: Date.now(),
            });
      if (!gitti) {
        kendiTasimRef.current = null;
        bekleyenAtisRef.current = null;
        cekmeyiGeriGotur();
        return;
      }
      if (hedef.tip === 'per') setSecili((onceki) => onceki.filter((id) => id !== tasId));

      // Tas hedefin ustune kayip masadaki taslarin boyuna kuculuyor. Gercek tas
      // orada belirince parmaktaki kopya kalkiyor (istaka effect'i).
      const koku = katmanKokuRef.current;
      const orta = merkez(kayit.alan);
      Animated.parallel([
        Animated.timing(cekmeKonumu, {
          toValue: {
            x: orta.x - OLCULER.buyuk.en / 2 - koku.x,
            y: orta.y - OLCULER.buyuk.boy / 2 - koku.y,
          },
          duration: 110,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(cekmeOlcegi, {
          toValue: OLCULER.orta.en / OLCULER.buyuk.en,
          duration: 110,
          useNativeDriver: false,
        }),
      ]).start();

      // Cevrimici oyunda karar sunucuda. Cevap gelmez ya da hamle reddedilirse
      // tas elde kalir; o zaman kopya da istakadaki yerine doner.
      if (bekleyenZamanlayiciRef.current !== null) clearTimeout(bekleyenZamanlayiciRef.current);
      bekleyenZamanlayiciRef.current = setTimeout(() => {
        if (bekleyenAtisRef.current !== tasId) return;
        kendiTasimRef.current = null;
        bekleyenAtisRef.current = null;
        cekmeyiGeriGotur();
      }, CEKME_BEKLEME_MS);
    },
    [hedefler, izin.atabilir, at, gonder, INSAN, cekmeKonumu, cekmeOlcegi, cekmeyiGeriGotur],
  );

  function grubuSec() {
    const genisletilmis = gruplar.filter((grup) => grup.some((id) => secili.includes(id))).flat();
    if (genisletilmis.length > 0) setSecili(genisletilmis);
  }

  function dizle(hangisi: 'seri' | 'kut') {
    const bulunan = gruplariKimlige((hangisi === 'seri' ? seriDiz : kutDiz)(istakam));
    setDuzen(duzenOlustur(bulunan, sutunSayisi));
    setSecili([]);
  }

  function ac() {
    if (gonder({ tip: 'AC', oyuncu: INSAN, perler: acilisGruplari, okeyAlimi: null, suAn: Date.now() })) {
      setSecili([]);
    }
  }

  function indir() {
    if (gonder({ tip: 'PER_INDIR', oyuncu: INSAN, perler: acilisGruplari, suAn: Date.now() })) {
      setSecili([]);
    }
  }

  /**
   * Secili taslari — secim yoksa istakadaki butun isler taslari — uyduklari
   * perlere tek tek isler. Hangi tasin nereye gittigini oyuncunun tek tek
   * secmesine gerek kalmiyor.
   */
  function taslariIsle() {
    // Secim yoksa okey ve oyuncunun kurdugu perler korunur (src/isleme.ts).
    const { gonderilecek } = islenecekTaslar({
      secili,
      islerTaslarim: gorunum.islerTaslarim,
      istakam,
      gruplar,
    });

    // Plan GORUNUMDEN cikiyor, tam durumdan degil: cevrimici oyunda tam durum
    // istemcide yok (motor kurali #3). Hesap saf ve testli (src/islemePlani.ts).
    const suAn = Date.now();
    for (const adim of islemePlani(gonderilecek, istakam, gorunum.yer)) {
      gonder({ tip: 'ISLE', oyuncu: INSAN, perId: adim.perId, tasIdler: adim.tasIdler, suAn });
    }
    setSecili([]);
  }

  function isle(perId: number) {
    if (secili.length === 0 || !izin.atabilir) return;
    if (gonder({ tip: 'ISLE', oyuncu: INSAN, perId, tasIdler: secili, suAn: Date.now() })) {
      setSecili([]);
    }
  }

  // --- KURALLAR.md §6: yerden okey cekme ------------------------------------
  // Motor iki yolu da biliyor (`OKEY_CEK` ve `AC` icindeki `okeyAlimi`);
  // eksik olan ekrandi. Firsatlari projeksiyon veriyor (`okeyFirsatlarim`),
  // burasi yalnizca hangisinin kullanilacagini seciyor.

  /** Okey cekmeye yarayan taslarim — istakada mor isaretle gorunurler. */
  const okeyeYarayanlar = useMemo(
    () => [...new Set(gorunum.okeyFirsatlarim.flatMap((f) => f.yerineTasIdler))],
    [gorunum.okeyFirsatlarim],
  );

  /** Secime uyan firsat varsa o, yoksa ilki (src/okey.ts). */
  const okeyFirsati = useMemo(
    () => okeyFirsatiSec(gorunum.okeyFirsatlarim, secili),
    [gorunum.okeyFirsatlarim, secili],
  );

  const okeyAlinabilir = useMemo(
    () => okeyAlinabilirMi(gorunum, okeyFirsati),
    [gorunum, okeyFirsati],
  );

  function okeyAl() {
    if (okeyFirsati === null || !okeyAlinabilir) return;
    const suAn = Date.now();

    // §6 normal yol — acmis ve bir tur donmusse okey dogrudan istakaya gelir.
    if (gorunum.islemeYapabilirim) {
      if (gonder({ tip: 'OKEY_CEK', oyuncu: INSAN, ...okeyFirsati, suAn })) setSecili([]);
      return;
    }

    // §6 istisnasi — acmamis oyuncu okeyi alip ayni hamlede acar; aldigi
    // okeyi o acilista kullanmak zorunda oldugu icin acilis aranarak kuruluyor.
    const acilis = okeyleAcilisBul(gorunum, okeyFirsati);
    if (acilis === null) return;
    if (gonder({ tip: 'AC', oyuncu: INSAN, perler: acilis, okeyAlimi: okeyFirsati, suAn })) {
      setSecili([]);
    }
  }

  // Dugmenin aktifligi, GERCEKTEN gonderilecek tas olup olmadigina bagli.
  // Yoksa yalnizca okey korunurken buton aktif gorunur ama hicbir sey olmaz.
  const islenebilirVar = useMemo(() => {
    const { gonderilecek } = islenecekTaslar({
      secili,
      islerTaslarim: gorunum.islerTaslarim,
      istakam,
      gruplar,
    });
    // Yalnizca "isler tasim var" yetmiyor: o taslarin gercekten bir pere
    // YERLESEBILDIGINI de bilmeli, yoksa dugme bosa basiliyor.
    return islemePlani(gonderilecek, istakam, gorunum.yer).length > 0;
  }, [secili, gorunum.islerTaslarim, gorunum.yer, istakam, gruplar]);

  const atikAlinabilir = izin.yerdenAlabilir && gorunum.atikUstu !== null;

  // §9 0.4 — suresini dolduran oyuncunun hakki 30 → 20 → 10 diye iner.
  // Kademeyi surucu bildirmiyor (sunucu tarafinda tutuluyor); tam sureden
  // kisa olmasi zaten kademeye inildiginin ta kendisi.
  const tamSure = gorunum.ayarlar.siraSureleriMs[0] ?? siraSuresi;
  const sureKisaldi = siraSuresi > 0 && siraSuresi < tamSure;
  // Geri sayimin kendisi SiraSayaci'nda; buradan giden yalnizca bitis ani.
  const sayacBitisi = elBitti ? null : siraBitisi;
  const fazMetni = elBitti
    ? t('masa.elBitti')
    : gorunum.siradaki === INSAN
      ? t(gorunum.faz === 'cekme' ? 'masa.siraSendeCek' : 'masa.siraSendeOyna')
      : t('masa.oynuyor', { ad: ADLAR[gorunum.siradaki] });

  // --- Ortadan tas cekme ------------------------------------------------------
  // Tas desteden ya da obekten parmakla alinip istakaya goturuluyor, istakada
  // tas tasir gibi. Cekme ancak tas ISTAKANIN USTUNE birakilinca oluyor;
  // ortaya geri getirip birakan fikrini degistirmis sayilir, tas yerine doner.
  // Birakildigi slota da o yerlesiyor (`slotaYerlestir`).
  //
  // Eskiden deste ya da obek asagi "firlatilinca" cekiliyordu ve tas istakanin
  // sonunda beliriyordu; oyuncu ne vazgecebiliyor ne yerini secebiliyordu.

  const cekmeBasla = useCallback(
    (kaynak: CekmeKaynagi, nokta: Nokta, tutus: Nokta) => {
      cekmeNoRef.current += 1;
      cekmeKonumu.stopAnimation();
      cekmeOlcegi.stopAnimation();
      cekmeOlcegi.setValue(1);
      kaynakRef.current = kaynak;
      tutusRef.current = tutus;
      const cikis = cekmeKonumuHesapla(nokta);
      cikisKonumuRef.current = cikis;
      cekmeKonumu.setValue(cikis);
      setCekme({ kaynak, tas: kaynak === 'atik' ? gorunum.atikUstu : null });
      // Birakildiginda karar vermek icin: istakanin EKRANDAKI yeri.
      katmaniOlc();
      izgaraRef.current?.measureInWindow((x, y, en, boy) => {
        izgaraAlaniRef.current = en > 0 && boy > 0 ? { x, y, en, boy } : null;
      });
    },
    [cekmeKonumu, cekmeOlcegi, cekmeKonumuHesapla, katmaniOlc, gorunum.atikUstu],
  );

  const cekmeHareket = useCallback(
    (nokta: Nokta) => cekmeKonumu.setValue(cekmeKonumuHesapla(nokta)),
    [cekmeKonumu, cekmeKonumuHesapla],
  );

  const cekmeBirak = useCallback(
    (nokta: Nokta) => {
      const kaynak = kaynakRef.current;
      const alan = izgaraAlaniRef.current;
      const slot =
        alan === null
          ? null
          : istakaSlotuBul(nokta, alan, {
              sutunSayisi,
              satirSayisi: SATIR_SAYISI,
              slotEn: SLOT_EN,
              slotBoy: SLOT_BOY,
            });
      // Surukleme surerken sira degismis olabilir (sure doldu, sunucu cekti).
      const izinli = kaynak === 'atik' ? atikAlinabilir : izin.cekebilir;
      if (alan === null || slot === null || !izinli) {
        cekmeyiGeriGotur();
        return;
      }

      const bekleyen: BekleyenCekim = {
        slot,
        tasId: kaynak === 'atik' ? (gorunum.atikUstu?.id ?? null) : null,
        oncekiler: new Set(istakam.map((tas) => tas.id)),
      };
      bekleyenRef.current = bekleyen;
      kendiCekimimRef.current = true;
      const gitti = gonder(
        kaynak === 'atik'
          ? { tip: 'CEK_ATIKTAN', oyuncu: INSAN, suAn: Date.now() }
          : { tip: 'CEK_DESTEDEN', oyuncu: INSAN, suAn: Date.now() },
      );
      if (!gitti) {
        bekleyenRef.current = null;
        kendiCekimimRef.current = false;
        cekmeyiGeriGotur();
        return;
      }

      // Tas slotuna oturuyor ve sunucunun cevabi gelene kadar orada duruyor;
      // cevap gelince gercek tas ayni yerde beliriyor (yukaridaki effect).
      const koku = katmanKokuRef.current;
      Animated.timing(cekmeKonumu, {
        toValue: {
          x:
            alan.x +
            (slot % sutunSayisi) * SLOT_EN +
            (OLCULER.buyuk.en - OLCULER.orta.en) / 2 -
            koku.x,
          y:
            alan.y +
            Math.floor(slot / sutunSayisi) * SLOT_BOY +
            (OLCULER.buyuk.boy - OLCULER.orta.boy) / 2 -
            koku.y,
        },
        duration: 90,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();

      if (bekleyenZamanlayiciRef.current !== null) clearTimeout(bekleyenZamanlayiciRef.current);
      bekleyenZamanlayiciRef.current = setTimeout(() => {
        if (bekleyenRef.current !== bekleyen) return;
        kendiCekimimRef.current = false;
        cekmeyiBitir();
      }, CEKME_BEKLEME_MS);
    },
    [
      sutunSayisi,
      atikAlinabilir,
      izin.cekebilir,
      gorunum.atikUstu,
      istakam,
      gonder,
      INSAN,
      cekmeKonumu,
      cekmeyiGeriGotur,
      cekmeyiBitir,
    ],
  );

  return (
    <SafeAreaView style={stil.ekran}>
      <StatusBar hidden />
      <View style={stil.govde}>
        <View style={stil.ustAlan}>
          <View
            ref={masaRef}
            style={stil.masa}
            onLayout={(olay) =>
              setMasaOlcu({
                en: olay.nativeEvent.layout.width,
                boy: olay.nativeEvent.layout.height,
              })
            }
          >
            {/* Karsidaki oyuncu — ekranin en ustu */}
            <View style={stil.ustSira}>
              <OyuncuSeridi oyuncu={yerlesim.karsi} ad={ADLAR[yerlesim.karsi]} yon="ust" gorunum={gorunum} />
              <PerAlani oyuncu={yerlesim.karsi} gorunum={gorunum} tasEni={yatayTas} onPer={isle} perRef={perRef} ucanlar={ucanlar} />
            </View>

            <View style={stil.ortaSira}>
              <View style={[stil.solSutun, { maxWidth: yanSutun }]}>
                <OyuncuSeridi oyuncu={yerlesim.sol} ad={ADLAR[yerlesim.sol]} yon="sol" gorunum={gorunum} />
                <PerAlani oyuncu={yerlesim.sol} gorunum={gorunum} tasEni={yanTas} dikey onPer={isle} perRef={perRef} ucanlar={ucanlar} />
              </View>

              <View ref={ortaHedefi} collapsable={false} style={stil.merkez}>
                <Orta
                  gorunum={gorunum}
                  alinabilir={atikAlinabilir}
                  cekilebilir={izin.cekebilir}
                  obekRef={obekRef}
                  ustTasGizli={ustTasGizli}
                  altindaki={obekAltindaki}
                  onCekmeBasla={cekmeBasla}
                  onCekmeHareket={cekmeHareket}
                  onCekmeBirak={cekmeBirak}
                  onCekmeIptal={cekmeyiGeriGotur}
                />
              </View>

              <View style={[stil.sagSutun, { maxWidth: yanSutun }]}>
                <PerAlani oyuncu={yerlesim.sag} gorunum={gorunum} tasEni={yanTas} dikey onPer={isle} perRef={perRef} ucanlar={ucanlar} />
                <OyuncuSeridi oyuncu={yerlesim.sag} ad={ADLAR[yerlesim.sag]} yon="sag" gorunum={gorunum} />
              </View>
            </View>

            {/* Kendi perlerim — istakamin hemen onunde */}
            <View style={stil.altSira}>
              <PerAlani oyuncu={INSAN} gorunum={gorunum} tasEni={yatayTas} onPer={isle} perRef={perRef} ucanlar={ucanlar} />
            </View>

            {ucus !== null ? <UcanTas ucus={ucus} onBitti={ucusuBitir} /> : null}

            {/* Baglanti koptugunda tahta donuyor. Uyari olmadan bu, "oyun
                kilitlendi" gibi gorunuyor — oysa sunucu senin yerine oynuyor
                ve geri geldiginde ayni koltuga oturuyorsun (MIMARI.md §3). */}
            {!bagli ? (
              <View style={stil.kopukPerde}>
                <Text style={stil.kopukBaslik}>{t('masa.baglantiYok')}</Text>
                <Text style={stil.kopukMetin}>{t('masa.baglantiMetin')}</Text>
              </View>
            ) : null}

            {/* Talep penceresi masanin sol ust kosesinde; ortayi kapatmiyor.
                GERI SAYIM YOK (§9 0.9): pencere sirasi gelen oyuncu oynayana
                kadar acik. Gosterilecek sey sure degil, taleplerin kendisi —
                sirasi gelen oyuncu "kim istiyor"a bakip karar veriyor. */}
            {gorunum.pencere !== null && !elBitti ? (
              <View style={stil.pencere}>
                <Text style={stil.pencereBaslik}>
                  {t('masa.atti', { ad: ADLAR[gorunum.pencere.atan] })}
                </Text>
                <Text style={stil.pencereMetin}>
                  {gorunum.pencere.talepler.length > 0
                    ? t('masa.istiyor', {
                        adlar: gorunum.pencere.talepler.map((o) => ADLAR[o]).join(', '),
                      })
                    : gorunum.siradaki === INSAN
                      ? t('masa.talepYok')
                      : t('masa.kararVeriyor', { ad: ADLAR[gorunum.siradaki] })}
                </Text>
              </View>
            ) : null}

            {/* Cift calmasi ANINDA sonuclaniyor (§9 0.10): tas bir anda
                masadan kalkiyor. Kimin aldigini soylemezsek oyuncu neyin
                olduğunu anlamiyor — atik obegi sessizce bosaliyor. */}
            {gorunum.sonCalan !== null && !elBitti ? (
              <View style={stil.calmaUyarisi}>
                <Text style={stil.calmaYazi}>
                  {t('masa.tasiCaldi', { ad: ADLAR[gorunum.sonCalan] })}
                </Text>
              </View>
            ) : null}

            {elBitti && gorunum.sonuc !== null ? (
              <PuanTablosu
                sonuc={gorunum.sonuc}
                adlar={ADLAR}
                macPuanlari={macPuanlari}
                tur={gorunum.tur}
                macKazananlari={macKazananlari}
                {...(macKazananlari.length > 0 || turArasiSn === null
                  ? {}
                  : { geriSayimSn: turArasiSn })}
                onSonrakiTur={sonrakiTur}
                onYeniMac={onMasadanCik}
              />
            ) : null}
          </View>

          <View style={stil.yanPanel}>
            <View style={stil.durumKutusu}>
              {/* Geri sayim TUR satirinin sagina bindi: yan panelde alti
                  dugme satiri ancak boyle sigiyor. */}
              <View style={stil.durumUst}>
                <Text ref={turHedefi} style={stil.turMetni}>
                  {t('masa.turNo', { tur: gorunum.tur })}
                </Text>
                <SiraSayaci bitis={sayacBitisi} sure={siraSuresi} />
              </View>
              {/* Sart metni motorda TURKCE duruyor (turlar.ts); motor saf
                  kaldigi icin ceviri burada, tur numarasindan. */}
              <Text ref={sartHedefi} style={stil.sartMetni}>
                {t(TUR_SART_ANAHTARLARI[gorunum.tur])}
              </Text>
              <Text style={stil.fazMetni}>
                {fazMetni}
                {/* §9 0.4 — suresini dolduran oyuncunun hakki kisalir. */}
                {sureKisaldi ? t('masa.surenKisaldi', { sn: Math.round(siraSuresi / 1000) }) : ''}
              </Text>
              {gorunum.calinanSayisi[INSAN] > 0 || gorunum.islerTasSayisi[INSAN] > 0 ? (
                <Text style={stil.cezaMetni}>
                  {gorunum.calinanSayisi[INSAN] > 0
                    ? t('masa.caldin', {
                        sayi: gorunum.calinanSayisi[INSAN],
                        puan: gorunum.calinanSayisi[INSAN] * 5,
                      })
                    : ''}
                  {gorunum.islerTasSayisi[INSAN] > 0
                    ? t('masa.islerAttin', {
                        sayi: gorunum.islerTasSayisi[INSAN],
                        puan:
                          gorunum.islerTasSayisi[INSAN] * gorunum.ayarlar.islerTasCezasi,
                      })
                    : ''}
                </Text>
              ) : null}
            </View>

            <ScrollView contentContainerStyle={stil.dugmeler} showsVerticalScrollIndicator={false}>
              {/* ÇEK / YERDEN AL / AT dugmeleri yok: cekme ortadaki desteden
                  ya da obekten tasi istakaya surukleyip birakarak, atma ise
                  tasi istakadan obege surukleyerek yapiliyor. Kalan uzun etiketliler tam satiri
                  kapliyor ki yazi kirpilmasin. */}
              <Dugme etiket={t('masa.ac', { sayi: acilisGruplari.length })} aktif={izin.atabilir && acilisGruplari.length > 0} onBas={ac} tur="vurgu" hedef="ac" />
              <Dugme etiket={t('masa.indir')} aktif={izin.atabilir && acilisGruplari.length > 0} onBas={indir} hedef="indir" />
              <Dugme
                etiket={t('masa.taslariIsle')}
                aktif={izin.atabilir && gorunum.islemeYapabilirim && islenebilirVar}
                onBas={taslariIsle}
                tur="vurgu"
                genis
                hedef="isle"
              />
              <Dugme
                etiket={t('masa.okeyAl', { sayi: gorunum.okeyFirsatlarim.length })}
                aktif={okeyAlinabilir}
                onBas={okeyAl}
                tur="vurgu"
                genis
                hedef="okeyAl"
              />
              <Dugme etiket={t('masa.grubuSec')} aktif={secili.length > 0} onBas={grubuSec} />
              <Dugme etiket={t('masa.ayir')} aktif={secili.length > 0} onBas={() => setDuzen(ayir(duzen, secili, sutunSayisi))} />
              <Dugme etiket={t('masa.topla')} aktif={gruplar.length > 1} onBas={() => setDuzen(topla(duzen, sutunSayisi))} />
              <Dugme etiket={t('masa.ayarlar')} aktif onBas={() => setAyarlarAcik(true)} hedef="ayarlar" />
              <Dugme etiket={t('masa.istiyorum')} aktif={izin.talepEdebilir} onBas={() => gonder({ tip: 'CALMA_TALEBI', oyuncu: INSAN, suAn: Date.now() })} tur="vurgu" hedef="istiyorum" />
              <Dugme etiket={t('masa.ciftimVar')} aktif={izin.ciftTalepEdebilir} onBas={() => gonder({ tip: 'CIFT_TALEBI', oyuncu: INSAN, suAn: Date.now() })} tur="vurgu" hedef="ciftimVar" />
            </ScrollView>

            <Text style={stil.hata} numberOfLines={2}>
              {sonHata !== null
                ? hataMetni(sonHata, t)
                : okeyAlinabilir
                  ? t(
                      gorunum.acmisMi[INSAN]
                        ? 'masa.okeyCekebilirsin'
                        : 'masa.okeyleAcabilirsin',
                    )
                  : secili.length > 0 && izin.atabilir
                    ? t('masa.pereDokun')
                    : izin.atabilir && islenebilirVar && gorunum.islemeYapabilirim
                      ? t('masa.isleyecekTasVar')
                      : izin.atabilir
                        ? t('masa.surukleIpucu')
                        : ''}
            </Text>
          </View>
        </View>

        <View
          ref={istakaHedefi}
          collapsable={false}
          style={[stil.altAlan, { height: IZGARA_BOYU + 22 }]}
        >
          <DizmeDugmesi ustSatir={t('masa.kutDiz')} altSatir={t('masa.diz')} aktif={istakam.length > 0} onBas={() => dizle('kut')} />
          <Istaka
            taslar={istakam}
            duzen={duzen}
            sutunSayisi={sutunSayisi}
            secili={secili}
            islerTaslar={gorunum.islerTaslarim}
            okeyeYarayanlar={okeyeYarayanlar}
            bitirenler={bitirenler}
            onTas={tasSec}
            onTasiTasi={tasSurukle}
            onDisariBirak={masayaBirak}
            onSuruklemeBasladi={istakadanBasla}
            onSuruklemeHareket={cekmeHareket}
            onIstakadaBirakti={istakadaBirakti}
            onSuruklemeIptal={cekmeyiGeriGotur}
            tasinanTasId={cekme?.kaynak === 'istaka' ? (cekme.tas?.id ?? null) : null}
            onOlcum={olcumAl}
            izgaraRef={izgaraRefAl}
          />
          <DizmeDugmesi ustSatir={t('masa.seriDiz')} altSatir={t('masa.diz')} aktif={istakam.length > 0} onBas={() => dizle('seri')} />
        </View>
      </View>

      {/* Parmaktaki tas — ortadan cekilen ya da istakadan tasinan. Masanin
          da istakanin da ustunde. */}
      <View ref={katmanRef} collapsable={false} style={stil.cekmeKatmani} onLayout={katmaniOlc}>
        {cekme !== null ? (
          <Animated.View
            style={[
              stil.cekilenTas,
              { transform: [...cekmeKonumu.getTranslateTransform(), { scale: cekmeOlcegi }] },
            ]}
          >
            {cekme.tas === null ? (
              <KapaliTas boy="orta" />
            ) : cekme.kaynak === 'istaka' ? (
              <TasGorseli
                tas={cekme.tas}
                secili={secili.includes(cekme.tas.id)}
                isler={gorunum.islerTaslarim.includes(cekme.tas.id)}
                okeyeYarar={okeyeYarayanlar.includes(cekme.tas.id)}
                bitirir={bitirenler.includes(cekme.tas.id)}
              />
            ) : (
              <TasGorseli tas={cekme.tas} boy="orta" />
            )}
          </Animated.View>
        ) : null}
      </View>

      {ayarlarAcik ? (
        <Ayarlar
          sesAcik={sesAcik}
          onSes={setSesAcik}
          onMasadanCik={onMasadanCik}
          onKapat={() => setAyarlarAcik(false)}
          cevrimici={cevrimici}
          digerOyuncular={masadakiler}
          engellenenIdler={engellenenIdler}
          {...(onSikayet === undefined ? {} : { onSikayet })}
          {...(onEngelle === undefined ? {} : { onEngelle })}
        />
      ) : null}
    </SafeAreaView>
  );
}

const stil = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renkler.arka },
  govde: { flex: 1, padding: 6, gap: 6 },

  ustAlan: { flex: 1, flexDirection: 'row', gap: 6 },
  masa: {
    flex: 1,
    backgroundColor: renkler.masa,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: renkler.masaCizgi,
    padding: 5,
    gap: 3,
  },

  ustSira: { gap: 3 },
  ortaSira: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  // maxWidth artik sabit degil: masanin olculen eninden geliyor (olculer.ts).
  // Perler kisayken sutun kendiliginden daralir, ortaya yer kalir.
  solSutun: { flexDirection: 'row', alignItems: 'stretch', gap: SUTUN_BOSLUK },
  sagSutun: { flexDirection: 'row', alignItems: 'stretch', gap: SUTUN_BOSLUK },
  merkez: { flex: 1, alignItems: 'center', justifyContent: 'center', minWidth: MERKEZ_EN_AZ },
  altSira: { minHeight: 32, justifyContent: 'center' },

  pencere: {
    position: 'absolute',
    top: 4,
    left: 6,
    backgroundColor: renkler.arkaKoyu,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: renkler.vurgu,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  calmaUyarisi: {
    position: 'absolute',
    top: 6,
    alignSelf: 'center',
    backgroundColor: renkler.vurgu,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  calmaYazi: { color: '#2a2000', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  pencereBaslik: { color: renkler.vurgu, fontSize: 10, fontWeight: '800' },
  pencereMetin: { color: renkler.metin, fontSize: 9 },

  kopukPerde: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 40,
    backgroundColor: 'rgba(7, 28, 42, 0.82)',
  },
  kopukBaslik: { color: renkler.uyari, fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  kopukMetin: { color: renkler.metin, fontSize: 11, textAlign: 'center', maxWidth: 320 },


  // 168: yarim sutun dugmesinde 72px yazi alani birakiyor. En uzun yarim
  // etiket ("ÇİFTİM VAR") 11 punto kalinda 69px — uc piksel pay var.
  // Tek satira sigmayan tek etiket "TAŞLARI İŞLE" (79px), o `genis`.
  yanPanel: { width: 168, gap: 6 },
  durumKutusu: {
    backgroundColor: renkler.panelKoyu,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: renkler.kenar,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  turMetni: { color: renkler.metin, fontSize: 13, fontWeight: '800' },
  sartMetni: { color: renkler.vurgu, fontSize: 10, marginTop: 1 },
  fazMetni: { color: renkler.metinSolgun, fontSize: 10, marginTop: 1 },
  cezaMetni: { color: renkler.uyari, fontSize: 9, fontWeight: '700', marginTop: 2 },

  // Sira suresi geri sayimi (KURALLAR.md §9 0.4). Sure dolunca src/oyun.ts
  // oyuncunun yerine oynuyor; buradaki cubuk yalnizca gostergedir.
  durumUst: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  dugmeler: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingBottom: 2 },
  hata: { color: renkler.uyari, fontSize: 10, minHeight: 22 },

  altAlan: { flexDirection: 'row', gap: 6 },

  cekmeKatmani: { ...StyleSheet.absoluteFillObject, pointerEvents: 'none' },
  cekilenTas: {
    position: 'absolute',
    left: 0,
    top: 0,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
});
