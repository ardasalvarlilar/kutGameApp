import { useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import type { ComponentRef } from 'react';
import type { OyuncuGorunumu, Tas } from '@kut/engine';
import { renkler } from '../tema';
import { KATMAN_KAYMASI, KATMAN_SINIRI, OLCULER, ORTA_ARASI } from '../olculer';
import type { Nokta } from '../hedefler';
import { KapaliTas, TasGorseli } from './TasGorseli';

// Obegin altinda kac katman gorunsun (KATMAN_SINIRI) ve aradaki bosluk
// src/olculer.ts'te: merkezin en az eni bu sayilardan hesaplaniyor.
const TAS = OLCULER.orta;

/** Parmak bu kadar kaydiysa tas ele alinmis sayilir — istakadaki esikle ayni. */
const SURUKLEME_ESIGI = 5;

/** Deste kutusunda tasin sol ust kosesi: kenar (1) + dolgu (3). */
const DESTE_OFSETI: Nokta = { x: 4, y: 4 };
/** Obegin kenar kalinligi — ustteki tas bunun icinde basliyor. */
const OBEK_KENARI = 2;

export type CekmeKaynagi = 'deste' | 'atik';

/**
 * Ortadan tas cekme hareketinin olaylari. Karari Masa veriyor: tasin
 * istakanin ustune birakilip birakilmadigini yalnizca o biliyor.
 */
export interface CekmeOlaylari {
  /**
   * Tas ele alindi. `tutus` parmagin TASIN sol ust kosesine gore yeri — tas
   * parmagin altinda, tutuldugu yerden tasiniyor.
   */
  readonly onCekmeBasla: (kaynak: CekmeKaynagi, nokta: Nokta, tutus: Nokta) => void;
  /** Nokta EKRAN koordinati (pageX/pageY). */
  readonly onCekmeHareket: (nokta: Nokta) => void;
  readonly onCekmeBirak: (nokta: Nokta) => void;
  /** Hareketi sistem kesti (gelen arama vb.) — tas yerine donmeli. */
  readonly onCekmeIptal: () => void;
}

interface Ozellikler extends CekmeOlaylari {
  readonly gorunum: OyuncuGorunumu;
  /** Obegin ustundeki tas su an bedelsiz alinabilir mi? */
  readonly alinabilir: boolean;
  readonly cekilebilir: boolean;
  /**
   * Atik obeginin ekrandaki yerini olcmek icin. Tas suruklerken oyuncunun
   * obege dogru birakip birakmadigi buradan anlasiliyor (src/hedefler.ts) —
   * obek masa doldukca kaydigi icin sabit bir esik yetmiyor.
   */
  readonly obekRef?: (gorunum: ComponentRef<typeof View> | null) => void;
  /**
   * Ustteki tas su an obekte DEGIL mi — havada (ucus kuyrugunda) ya da
   * oyuncunun parmaginda? Oyleyse obek o tas hic atilmamis gibi ciziliyor:
   * bir eksik adet ve ustte ALTINDAKI tas.
   */
  readonly ustTasGizli?: boolean;
  /**
   * Ustteki tasin altindaki tas — bilinmiyorsa null (src/atikBellegi.ts).
   * Yalnizca `ustTasGizli` iken cizilir; projeksiyonda yok (KURALLAR.md §10.3).
   */
  readonly altindaki?: Tas | null;
}

/**
 * Tasi ortadan parmakla alip goturmeye yarayan tutamak.
 *
 * Dokunus tek basina bir sey yapmiyor: cekme, tas istakanin ustune
 * birakilinca oluyor. Eskiden dokunmak ya da asagi "firlatmak" yetiyordu;
 * tas istakanin sonunda beliriyordu ve oyuncu fikrini degistiremiyordu.
 *
 * Hareketin durumu REF'te: `aktif` ya da ofset surukleme sirasinda
 * degisirse (obekteki tas gizlenince katman sayisi azaliyor) PanResponder
 * yeniden kuruluyor ve yenisi hareketin ortasinda devraliyor. Durum
 * closure'da kalsaydi birakma "baslamamis" sayilir, tas ekranda asili kalirdi.
 */
function useCekmeTutamagi(
  aktif: boolean,
  kaynak: CekmeKaynagi,
  tasOfseti: Nokta,
  olaylar: CekmeOlaylari,
) {
  const olayRef = useRef(olaylar);
  olayRef.current = olaylar;
  const hareketRef = useRef({ basladi: false, tutus: { x: 0, y: 0 } as Nokta });

  return useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => aktif,
        onMoveShouldSetPanResponder: () => aktif,
        onPanResponderGrant: (olay) => {
          const { locationX, locationY } = olay.nativeEvent;
          hareketRef.current = {
            basladi: false,
            tutus: {
              x: Math.min(TAS.en, Math.max(0, (locationX ?? 0) - tasOfseti.x)),
              y: Math.min(TAS.boy, Math.max(0, (locationY ?? 0) - tasOfseti.y)),
            },
          };
        },
        onPanResponderMove: (olay, hareket) => {
          const durum = hareketRef.current;
          const nokta = { x: olay.nativeEvent.pageX, y: olay.nativeEvent.pageY };
          if (!durum.basladi) {
            if (
              Math.abs(hareket.dx) <= SURUKLEME_ESIGI &&
              Math.abs(hareket.dy) <= SURUKLEME_ESIGI
            ) {
              return;
            }
            durum.basladi = true;
            olayRef.current.onCekmeBasla(kaynak, nokta, durum.tutus);
          }
          olayRef.current.onCekmeHareket(nokta);
        },
        onPanResponderRelease: (olay, hareket) => {
          const durum = hareketRef.current;
          const birakma = { x: olay.nativeEvent.pageX, y: olay.nativeEvent.pageY };
          if (!durum.basladi) {
            // Ara hareket olayi hic gelmemis olabilir (hizli surukleme, olay
            // birlestirme) — istakadaki gibi birakma anindaki mesafeye de
            // bakiliyor. Yoksa hizli bir cekis "vazgecti" sayilirdi.
            const uzaklasti =
              Math.abs(hareket.dx) > SURUKLEME_ESIGI || Math.abs(hareket.dy) > SURUKLEME_ESIGI;
            if (!uzaklasti) return; // Dokunus: cekme yok.
            olayRef.current.onCekmeBasla(
              kaynak,
              { x: birakma.x - hareket.dx, y: birakma.y - hareket.dy },
              durum.tutus,
            );
          }
          durum.basladi = false;
          olayRef.current.onCekmeBirak(birakma);
        },
        // Surukleme basladiktan sonra responder'i kimseye devretme; aksi halde
        // birakma hic gelmiyor ve tas havada kaliyor.
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderTerminate: () => {
          const durum = hareketRef.current;
          if (!durum.basladi) return;
          durum.basladi = false;
          olayRef.current.onCekmeIptal();
        },
      }).panHandlers,
    [aktif, kaynak, tasOfseti.x, tasOfseti.y],
  );
}

/**
 * Masanin ortasi: deste ve tek bir atik obegi.
 *
 * KURALLAR.md §4 motorda dort ayri yigin tutuyor — kimin hangi tasi
 * alabilecegi ona bagli. Masada ise hepsi tek obek halinde duruyor ve en son
 * atilan tas ustte. Bu gorsel bir sadelestirme degil, kurala da uyuyor:
 * §5 geregi zaten yalnizca en usttteki tas alinabilir, altindakiler oludur.
 */
export function Orta({
  gorunum,
  alinabilir,
  cekilebilir,
  obekRef,
  ustTasGizli = false,
  altindaki = null,
  ...olaylar
}: Ozellikler) {
  // Ustteki tas havadaysa ya da parmaktaysa obek, o tas hic atilmamis gibi
  // gorunuyor. Eskiden burada gri bir kapali tas cikiyordu — oysa altta
  // duran tasi herkes gordu ve orada durmaya devam ediyor.
  const gizli = ustTasGizli && gorunum.atikUstu !== null;
  const adet = gizli ? gorunum.atikAdedi - 1 : gorunum.atikAdedi;
  // Alttaki bilinmiyorsa (hareket listesinin disinda kaldiysa) kapali tas.
  const ustte = gizli ? altindaki : gorunum.atikUstu;

  const katmanSayisi = Math.min(KATMAN_SINIRI, Math.max(0, adet - 1));
  const obekYuksekligi = TAS.boy + katmanSayisi * KATMAN_KAYMASI;
  const ustKayma = katmanSayisi * KATMAN_KAYMASI;

  const desteTutamagi = useCekmeTutamagi(cekilebilir, 'deste', DESTE_OFSETI, olaylar);
  const obekOfseti = OBEK_KENARI + ustKayma;
  const obekTutamagi = useCekmeTutamagi(
    alinabilir,
    'atik',
    { x: obekOfseti, y: obekOfseti },
    olaylar,
  );

  return (
    <View style={stil.govde}>
      <View {...desteTutamagi} style={[stil.deste, cekilebilir && stil.destePar]}>
        <KapaliTas boy="orta" />
        <View style={stil.desteSayiKutusu}>
          <Text style={stil.desteSayi}>{gorunum.desteSayisi}</Text>
        </View>
      </View>

      <View
        ref={obekRef}
        {...obekTutamagi}
        style={[
          stil.obek,
          { width: TAS.en + ustKayma, height: obekYuksekligi },
          alinabilir && stil.obekAlinabilir,
        ]}
      >
        {/* Altta kalan taslar — oludur, yalnizca derinlik gosterir. */}
        {Array.from({ length: katmanSayisi }, (_deger, katman) => (
          <View
            key={`katman-${katman}`}
            style={[stil.katman, { left: katman * KATMAN_KAYMASI, top: katman * KATMAN_KAYMASI }]}
          />
        ))}

        {ustte !== null ? (
          <View style={[stil.ustTas, { left: ustKayma, top: ustKayma }]}>
            <TasGorseli tas={ustte} boy="orta" />
          </View>
        ) : adet > 0 ? (
          <View style={[stil.ustTas, { left: ustKayma, top: ustKayma }]}>
            <KapaliTas boy="orta" />
          </View>
        ) : null}

        {adet > 0 ? (
          <View style={stil.adetKutusu}>
            <Text style={stil.adet}>{adet}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const stil = StyleSheet.create({
  govde: { flexDirection: 'row', alignItems: 'center', gap: ORTA_ARASI },
  deste: {
    alignItems: 'center',
    padding: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  destePar: { borderColor: renkler.vurgu, backgroundColor: renkler.masaKoyu },
  desteSayiKutusu: {
    pointerEvents: 'none',
    position: 'absolute',
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desteSayi: { color: renkler.metin, fontSize: 12, fontWeight: '800' },
  obek: {
    minWidth: TAS.en,
    minHeight: TAS.boy,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  obekAlinabilir: { borderColor: renkler.vurgu },
  katman: {
    pointerEvents: 'none',
    position: 'absolute',
    width: TAS.en,
    height: TAS.boy,
    borderRadius: TAS.yuvarlak,
    backgroundColor: renkler.tasGolge,
    borderWidth: 1,
    borderColor: renkler.masaCizgi,
  },
  ustTas: { position: 'absolute', pointerEvents: 'none' },
  adetKutusu: {
    pointerEvents: 'none',
    position: 'absolute',
    right: -8,
    bottom: -6,
    minWidth: 15,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: renkler.arkaKoyu,
    borderWidth: 1,
    borderColor: renkler.kenar,
    alignItems: 'center',
  },
  adet: { color: renkler.metinSolgun, fontSize: 9, fontWeight: '700' },
});
