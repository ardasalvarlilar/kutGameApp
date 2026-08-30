import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import {
  OYUNCULAR,
  eldenBitmeTuruMu,
  siradaIleri,
  turSarti,
  type OyuncuId,
  type TasId,
} from '@kut/engine';
import { Dugme, DizmeDugmesi } from './bilesenler/Dugme';
import { IZGARA_BOYU, Istaka, SLOT_EN } from './bilesenler/Istaka';
import { Orta } from './bilesenler/Orta';
import { OyuncuSeridi } from './bilesenler/OyuncuSeridi';
import { PerAlani } from './bilesenler/PerAlani';
import { PuanTablosu } from './bilesenler/PuanTablosu';
import { Ayarlar, type MasadakiOyuncu } from './bilesenler/Ayarlar';
import type { SikayetSebebi } from './ag/api';
import { UcanTas, type Nokta, type Ucus } from './bilesenler/UcanTas';
import { gruplariKimlige, kutDiz, seriDiz } from './dizme';
import { bitirenTaslar, eldenBitmeCozumu } from './eldenBitme';
import {
  ayir,
  duzenGruplari,
  duzenOlustur,
  duzenTazele,
  tasiTasi,
  topla,
  type Duzen,
} from './duzen';
import {
  MERKEZ_EN_AZ,
  SUTUN_BOSLUK,
  yanSutunEni,
  yanTasEni,
  yatayTasEni,
} from './olculer';
import {
  anahtardanHedef,
  hedefAnahtari,
  hedefBul,
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
import { ACIL_ESIGI_MS, kalanSiraSuresi } from './sure';
import { renkler } from './tema';

// Oyun saat yonunde doner (KURALLAR.md §4): attigim tasi SAGIMDAKI alir.
// Motor bunu koltuk numarasini AZALTARAK yapiyor (`siradaIleri`), yani
// benden bir sonraki oynayan sagimda oturur.
//
// Ekranda ben her zaman altta otururum — ama koltuk numaram 0 olmak zorunda
// degil. Cevrimici masada 2 numarali koltuga oturmus olabilirim; o yuzden
// yerlesim sabit degil, kendi koltugumdan TURETILIYOR.
const EN_AZ_SUTUN = 8;

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

  const INSAN = gorunum.ben;
  const yerlesim = useMemo(() => yerlesimKur(INSAN), [INSAN]);

  const [sutunSayisi, setSutunSayisi] = useState(20);
  const [duzen, setDuzen] = useState<Duzen>([]);
  const [secili, setSecili] = useState<readonly TasId[]>([]);
  const [an, setAn] = useState(() => Date.now());
  const [masaOlcu, setMasaOlcu] = useState({ en: 0, boy: 0 });
  const [ucus, setUcus] = useState<Ucus | null>(null);
  const [ayarlarAcik, setAyarlarAcik] = useState(false);
  const [sesAcik, setSesAcik] = useState(true);

  // Birakma hedeflerinin EKRANDAKI dikdortgenleri. Masaya tas indikce yan
  // sutunlar genisliyor, ortadaki obek kayiyor; sabit bir esik yerine
  // gercek konum olculuyor (src/hedefler.ts).
  const [hedefler, setHedefler] = useState<readonly HedefKaydi[]>([]);
  const hedefRefleri = useRef(new Map<string, ComponentRef<typeof View> | null>());

  const cal = useSes(sesAcik);
  const sesSecici = useSesSecici();
  const oncekiRef = useRef<{
    readonly atikAdet: Record<OyuncuId, number>;
    readonly desteSayisi: number;
    readonly siradaki: OyuncuId;
  } | null>(null);

  const istakam = gorunum.istakam;

  useEffect(() => {
    setDuzen((onceki) => duzenTazele(onceki, istakam, sutunSayisi));
    setSecili((onceki) => onceki.filter((id) => istakam.some((tas) => tas.id === id)));
  }, [istakam, sutunSayisi]);

  // Hem talep penceresi hem sira suresi geri sayiyor; ikisinden biri
  // acikken saat isliyor.
  const elBitti = gorunum.faz === 'el-bitti';
  useEffect(() => {
    if (elBitti || (gorunum.pencere === null && siraBitisi === null)) return;
    setAn(Date.now());
    const sayac = setInterval(() => setAn(Date.now()), 200);
    return () => clearInterval(sayac);
  }, [gorunum.pencere, siraBitisi, elBitti]);

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
  const ucusuBitir = useCallback(() => setUcus(null), []);

  // Durum degisiminden hangi tasin nereye gittigini cikarip animasyonu tetikler.
  useEffect(() => {
    const simdi = {
      atikAdet: {
        0: gorunum.atikYiginlari[0].adet,
        1: gorunum.atikYiginlari[1].adet,
        2: gorunum.atikYiginlari[2].adet,
        3: gorunum.atikYiginlari[3].adet,
      } as Record<OyuncuId, number>,
      desteSayisi: gorunum.desteSayisi,
      siradaki: gorunum.siradaki,
    };
    const onceki = oncekiRef.current;
    oncekiRef.current = simdi;
    if (onceki === null || masaOlcu.en === 0) return;

    for (const oyuncu of OYUNCULAR) {
      if (simdi.atikAdet[oyuncu] > onceki.atikAdet[oyuncu]) {
        setUcus({
          anahtar: `at-${oyuncu}-${simdi.atikAdet[oyuncu]}`,
          tas: gorunum.atikYiginlari[oyuncu].ustTas,
          baslangic: koltukNoktasi(oyuncu),
          bitis: merkezNokta,
        });
        return;
      }
      if (simdi.atikAdet[oyuncu] < onceki.atikAdet[oyuncu]) {
        setUcus({
          anahtar: `al-${oyuncu}-${simdi.atikAdet[oyuncu]}`,
          tas: null,
          baslangic: merkezNokta,
          bitis: koltukNoktasi(onceki.siradaki),
        });
        return;
      }
    }

    if (simdi.desteSayisi < onceki.desteSayisi) {
      setUcus({
        anahtar: `cek-${simdi.desteSayisi}`,
        tas: null,
        baslangic: merkezNokta,
        bitis: koltukNoktasi(onceki.siradaki),
      });
    }
  }, [gorunum, masaOlcu, koltukNoktasi, merkezNokta]);

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

  const izin = useMemo(() => yetkiler(gorunum, an), [gorunum, an]);
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
    (tasId: TasId) => {
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
            return;
          }
          // Motor reddettiyse israr etme; normal atisa dus.
        }
      }

      if (gonder({ tip: 'AT', oyuncu: INSAN, tasId, suAn })) setSecili([]);
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
      if (hedef === null) return;
      const suAn = Date.now();

      if (hedef.tip === 'atik') {
        // `at` uzerinden gidiyoruz, dogrudan `AT` gondermiyoruz: tur 16'da
        // elden bitme kontrolu orada (KURALLAR.md §3).
        at(tasId);
        return;
      }
      if (gonder({ tip: 'ISLE', oyuncu: INSAN, perId: hedef.perId, tasIdler: [tasId], suAn })) {
        setSecili((onceki) => onceki.filter((id) => id !== tasId));
      }
    },
    [hedefler, gonder, at],
  );

  const cekDesteden = useCallback(() => {
    gonder({ tip: 'CEK_DESTEDEN', oyuncu: INSAN, suAn: Date.now() });
  }, [gonder]);

  const cekYerden = useCallback(() => {
    gonder({ tip: 'CEK_ATIKTAN', oyuncu: INSAN, suAn: Date.now() });
  }, [gonder]);

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

  const kalanSure = gorunum.pencere === null ? 0 : Math.max(0, gorunum.pencere.kapanisZamani - an);
  const atikAlinabilir = izin.yerdenAlabilir && gorunum.atikUstu !== null;

  // Sira suresi geri sayimi — sure dolunca src/oyun.ts yerine oynuyor.
  const kalanSira = kalanSiraSuresi(siraBitisi, an);
  // §9 0.4 — suresini dolduran oyuncunun hakki 30 → 20 → 10 diye iner.
  // Kademeyi surucu bildirmiyor (sunucu tarafinda tutuluyor); tam sureden
  // kisa olmasi zaten kademeye inildiginin ta kendisi.
  const tamSure = gorunum.ayarlar.siraSureleriMs[0] ?? siraSuresi;
  const sureKisaldi = siraSuresi > 0 && siraSuresi < tamSure;
  const siraSayaciVar = siraBitisi !== null && !elBitti;
  const siraAcil = kalanSira <= ACIL_ESIGI_MS;
  const siraOrani = siraSuresi > 0 ? Math.round((kalanSira / siraSuresi) * 100) : 0;
  const fazMetni = elBitti
    ? 'El bitti'
    : gorunum.siradaki === INSAN
      ? gorunum.faz === 'cekme'
        ? 'Sıra sende — çek'
        : 'Sıra sende — aç, işle, at'
      : `${ADLAR[gorunum.siradaki]} oynuyor`;

  return (
    <SafeAreaView style={stil.ekran}>
      <StatusBar hidden />
      <View style={stil.govde}>
        <View style={stil.ustAlan}>
          <View
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
              <PerAlani oyuncu={yerlesim.karsi} gorunum={gorunum} tasEni={yatayTas} onPer={isle} perRef={perRef} />
            </View>

            <View style={stil.ortaSira}>
              <View style={[stil.solSutun, { maxWidth: yanSutun }]}>
                <OyuncuSeridi oyuncu={yerlesim.sol} ad={ADLAR[yerlesim.sol]} yon="sol" gorunum={gorunum} />
                <PerAlani oyuncu={yerlesim.sol} gorunum={gorunum} tasEni={yanTas} dikey onPer={isle} perRef={perRef} />
              </View>

              <View style={stil.merkez}>
                <Orta
                  gorunum={gorunum}
                  alinabilir={atikAlinabilir}
                  onYerdenAl={cekYerden}
                  onDesteden={cekDesteden}
                  cekilebilir={izin.cekebilir}
                  obekRef={obekRef}
                />
              </View>

              <View style={[stil.sagSutun, { maxWidth: yanSutun }]}>
                <PerAlani oyuncu={yerlesim.sag} gorunum={gorunum} tasEni={yanTas} dikey onPer={isle} perRef={perRef} />
                <OyuncuSeridi oyuncu={yerlesim.sag} ad={ADLAR[yerlesim.sag]} yon="sag" gorunum={gorunum} />
              </View>
            </View>

            {/* Kendi perlerim — istakamin hemen onunde */}
            <View style={stil.altSira}>
              <PerAlani oyuncu={INSAN} gorunum={gorunum} tasEni={yatayTas} onPer={isle} perRef={perRef} />
            </View>

            {ucus !== null ? <UcanTas ucus={ucus} onBitti={ucusuBitir} /> : null}

            {/* Baglanti koptugunda tahta donuyor. Uyari olmadan bu, "oyun
                kilitlendi" gibi gorunuyor — oysa sunucu senin yerine oynuyor
                ve geri geldiginde ayni koltuga oturuyorsun (MIMARI.md §3). */}
            {!bagli ? (
              <View style={stil.kopukPerde}>
                <Text style={stil.kopukBaslik}>BAĞLANTI YOK</Text>
                <Text style={stil.kopukMetin}>
                  Yeniden bağlanılıyor — koltuğun duruyor, sıran gelirse
                  sunucu senin yerine oynuyor.
                </Text>
              </View>
            ) : null}

            {/* Geri sayim masanin sol ust kosesinde; ortayi kapatmiyor */}
            {gorunum.pencere !== null && !elBitti ? (
              <View style={stil.pencere}>
                <Text style={stil.pencereBaslik}>
                  {ADLAR[gorunum.pencere.atan]} attı · {(kalanSure / 1000).toFixed(1)} sn
                </Text>
                <Text style={stil.pencereMetin}>
                  {gorunum.pencere.ciftTalebi !== null
                    ? `${ADLAR[gorunum.pencere.ciftTalebi]}: çifti bende!`
                    : gorunum.pencere.talepler.length > 0
                      ? `${gorunum.pencere.talepler.map((o) => ADLAR[o]).join(', ')} istiyor`
                      : 'talep yok'}
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
                <Text style={stil.turMetni}>TUR {gorunum.tur}/16</Text>
                {siraSayaciVar ? (
                  <Text style={[stil.sayacMetin, siraAcil && stil.sayacAcil]}>
                    {(kalanSira / 1000).toFixed(1)} sn
                  </Text>
                ) : null}
              </View>
              {siraSayaciVar ? (
                <View style={stil.sayacYol}>
                  <View
                    style={[
                      stil.sayacDolgu,
                      { width: `${siraOrani}%` },
                      siraAcil && stil.sayacDolguAcil,
                    ]}
                  />
                </View>
              ) : null}
              <Text style={stil.sartMetni}>{sart.aciklama}</Text>
              <Text style={stil.fazMetni}>
                {fazMetni}
                {/* §9 0.4 — suresini dolduran oyuncunun hakki kisalir. */}
                {sureKisaldi ? ` · süren ${Math.round(siraSuresi / 1000)} sn` : ''}
              </Text>
              {gorunum.calinanSayisi[INSAN] > 0 || gorunum.islerTasSayisi[INSAN] > 0 ? (
                <Text style={stil.cezaMetni}>
                  {gorunum.calinanSayisi[INSAN] > 0
                    ? `${gorunum.calinanSayisi[INSAN]}×çaldın (+${gorunum.calinanSayisi[INSAN] * 5}) `
                    : ''}
                  {gorunum.islerTasSayisi[INSAN] > 0
                    ? `${gorunum.islerTasSayisi[INSAN]}×işler (+${gorunum.islerTasSayisi[INSAN] * gorunum.ayarlar.islerTasCezasi})`
                    : ''}
                </Text>
              ) : null}
            </View>

            <ScrollView contentContainerStyle={stil.dugmeler} showsVerticalScrollIndicator={false}>
              {/* ÇEK / YERDEN AL / AT dugmeleri yok: cekme ortadaki desteyi ya
                  da obegi asagi surukleyerek, atma ise tasi istakadan yukari
                  surukleyerek yapiliyor. Kalan uzun etiketliler tam satiri
                  kapliyor ki yazi kirpilmasin. */}
              <Dugme etiket={`AÇ (${acilisGruplari.length})`} aktif={izin.atabilir && acilisGruplari.length > 0} onBas={ac} tur="vurgu" />
              <Dugme etiket="İNDİR" aktif={izin.atabilir && acilisGruplari.length > 0} onBas={indir} />
              <Dugme
                etiket="TAŞLARI İŞLE"
                aktif={izin.atabilir && gorunum.islemeYapabilirim && islenebilirVar}
                onBas={taslariIsle}
                tur="vurgu"
                genis
              />
              <Dugme
                etiket={`OKEY AL (${gorunum.okeyFirsatlarim.length})`}
                aktif={okeyAlinabilir}
                onBas={okeyAl}
                tur="vurgu"
                genis
              />
              <Dugme etiket="GRUBU SEÇ" aktif={secili.length > 0} onBas={grubuSec} />
              <Dugme etiket="AYIR" aktif={secili.length > 0} onBas={() => setDuzen(ayir(duzen, secili, sutunSayisi))} />
              <Dugme etiket="TOPLA" aktif={gruplar.length > 1} onBas={() => setDuzen(topla(duzen, sutunSayisi))} />
              <Dugme etiket="AYARLAR" aktif onBas={() => setAyarlarAcik(true)} />
              <Dugme etiket="İSTİYORUM" aktif={izin.talepEdebilir} onBas={() => gonder({ tip: 'CALMA_TALEBI', oyuncu: INSAN, suAn: Date.now() })} tur="vurgu" />
              <Dugme etiket="ÇİFTİM VAR" aktif={izin.ciftTalepEdebilir} onBas={() => gonder({ tip: 'CIFT_TALEBI', oyuncu: INSAN, suAn: Date.now() })} tur="vurgu" />
            </ScrollView>

            <Text style={stil.hata} numberOfLines={2}>
              {sonHata !== null
                ? sonHata
                : okeyAlinabilir
                  ? gorunum.acmisMi[INSAN]
                    ? 'Yerden okey çekebilirsin — OKEY AL'
                    : 'Okeyi alıp açabilirsin — OKEY AL'
                  : secili.length > 0 && izin.atabilir
                    ? 'Bir pere dokunarak işleyebilirsin'
                    : izin.atabilir && islenebilirVar && gorunum.islemeYapabilirim
                      ? 'İşleyecek taşın var — TAŞLARI İŞLE'
                      : izin.atabilir
                        ? 'Yığına sürükle → at · pere sürükle → işle'
                        : ''}
            </Text>
          </View>
        </View>

        <View style={[stil.altAlan, { height: IZGARA_BOYU + 22 }]}>
          <DizmeDugmesi ustSatir="KÜT" altSatir="DİZ" aktif={istakam.length > 0} onBas={() => dizle('kut')} />
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
            onSuruklemeBasladi={hedefleriOlc}
            onOlcum={olcumAl}
          />
          <DizmeDugmesi ustSatir="SERİ" altSatir="DİZ" aktif={istakam.length > 0} onBas={() => dizle('seri')} />
        </View>
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
  sayacMetin: { color: renkler.vurgu, fontSize: 12, fontWeight: '800' },
  sayacAcil: { color: renkler.uyari },
  sayacYol: {
    marginTop: 2,
    height: 3,
    borderRadius: 2,
    backgroundColor: renkler.arkaKoyu,
    overflow: 'hidden',
  },
  sayacDolgu: { height: 3, borderRadius: 2, backgroundColor: renkler.vurgu },
  sayacDolguAcil: { backgroundColor: renkler.uyari },
  dugmeler: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingBottom: 2 },
  hata: { color: renkler.uyari, fontSize: 10, minHeight: 22 },

  altAlan: { flexDirection: 'row', gap: 6 },
});
