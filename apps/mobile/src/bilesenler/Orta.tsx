import { useMemo } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import type { ComponentRef } from 'react';
import type { OyuncuGorunumu } from '@kut/engine';
import { renkler } from '../tema';
import { KATMAN_KAYMASI, KATMAN_SINIRI, OLCULER, ORTA_ARASI } from '../olculer';
import { KapaliTas, TasGorseli } from './TasGorseli';

// Obegin altinda kac katman gorunsun (KATMAN_SINIRI) ve aradaki bosluk
// src/olculer.ts'te: merkezin en az eni bu sayilardan hesaplaniyor.
const TAS = OLCULER.orta;

/** Asagi dogru bu kadar suruklenirse tas istakaya cekiliyor sayilir. */
const ISTAKAYA_ESIGI = 22;

interface Ozellikler {
  readonly gorunum: OyuncuGorunumu;
  /** Obegin ustundeki tas su an bedelsiz alinabilir mi? */
  readonly alinabilir: boolean;
  readonly onYerdenAl: () => void;
  readonly onDesteden: () => void;
  readonly cekilebilir: boolean;
  /**
   * Atik obeginin ekrandaki yerini olcmek icin. Tas suruklerken oyuncunun
   * obege dogru birakip birakmadigi buradan anlasiliyor (src/hedefler.ts) —
   * obek masa doldukca kaydigi icin sabit bir esik yetmiyor.
   */
  readonly obekRef?: (gorunum: ComponentRef<typeof View> | null) => void;
}

/**
 * Hem dokunusu hem "asagi surukle" hareketini kabul eden tutamak.
 * Oyuncu tasi istakasina dogru cekerek de alabiliyor.
 */
function useCekmeTutamagi(aktif: boolean, tetikle: () => void) {
  return useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => aktif,
        onMoveShouldSetPanResponder: () => aktif,
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_olay, hareket) => {
          if (!aktif) return;
          const dokunus = Math.abs(hareket.dx) < 6 && Math.abs(hareket.dy) < 6;
          if (dokunus || hareket.dy > ISTAKAYA_ESIGI) tetikle();
        },
      }).panHandlers,
    [aktif, tetikle],
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
export function Orta({ gorunum, alinabilir, onYerdenAl, onDesteden, cekilebilir, obekRef }: Ozellikler) {
  const desteTutamagi = useCekmeTutamagi(cekilebilir, onDesteden);
  const obekTutamagi = useCekmeTutamagi(alinabilir, onYerdenAl);

  const katmanSayisi = Math.min(KATMAN_SINIRI, Math.max(0, gorunum.atikAdedi - 1));
  const obekYuksekligi = TAS.boy + katmanSayisi * KATMAN_KAYMASI;

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
          { width: TAS.en + katmanSayisi * KATMAN_KAYMASI, height: obekYuksekligi },
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

        {gorunum.atikUstu !== null ? (
          <View
            style={[
              stil.ustTas,
              { left: katmanSayisi * KATMAN_KAYMASI, top: katmanSayisi * KATMAN_KAYMASI },
            ]}
          >
            <TasGorseli tas={gorunum.atikUstu} boy="orta" />
          </View>
        ) : gorunum.atikAdedi > 0 ? (
          <View
            style={[
              stil.ustTas,
              { left: katmanSayisi * KATMAN_KAYMASI, top: katmanSayisi * KATMAN_KAYMASI },
            ]}
          >
            <KapaliTas boy="orta" />
          </View>
        ) : null}

        {gorunum.atikAdedi > 0 ? (
          <View style={stil.adetKutusu}>
            <Text style={stil.adet}>{gorunum.atikAdedi}</Text>
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
