import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import type { Tas } from '@kut/engine';
import { OLCULER } from '../olculer';
import { TasGorseli } from './TasGorseli';

const TAS = OLCULER.orta;
const SURE_MS = 340;

export interface Nokta {
  readonly x: number;
  readonly y: number;
}

export interface Ucus {
  /** Her ucus icin benzersiz; ayni tas iki kez uctugunda animasyon yeniden baslar. */
  readonly anahtar: string;
  readonly tas: Tas | null;
  readonly baslangic: Nokta;
  readonly bitis: Nokta;
}

/**
 * Masada bir noktadan digerine ucan tas. Yalnizca gorsel — oyun durumu
 * animasyondan once guncellenmis olur, bu yuzden bir sey kacirilmaz.
 */
export function UcanTas({ ucus, onBitti }: { readonly ucus: Ucus; readonly onBitti: () => void }) {
  const ilerleme = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    ilerleme.setValue(0);
    const animasyon = Animated.timing(ilerleme, {
      toValue: 1,
      duration: SURE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animasyon.start(({ finished }) => {
      if (finished) onBitti();
    });
    return () => animasyon.stop();
    // Anahtar degistiginde animasyon bastan baslar.
  }, [ucus.anahtar, ilerleme, onBitti]);

  const sol = ilerleme.interpolate({
    inputRange: [0, 1],
    outputRange: [ucus.baslangic.x - TAS.en / 2, ucus.bitis.x - TAS.en / 2],
  });
  const ust = ilerleme.interpolate({
    inputRange: [0, 1],
    outputRange: [ucus.baslangic.y - TAS.boy / 2, ucus.bitis.y - TAS.boy / 2],
  });
  const olcek = ilerleme.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.85, 1.15, 1] });

  return (
    <Animated.View
      style={[stil.govde, { left: sol, top: ust, transform: [{ scale: olcek }] }]}
    >
      {ucus.tas === null ? (
        <Animated.View style={stil.kapali} />
      ) : (
        <TasGorseli tas={ucus.tas} boy="orta" />
      )}
    </Animated.View>
  );
}

const stil = StyleSheet.create({
  govde: { position: 'absolute', zIndex: 20, pointerEvents: 'none' },
  kapali: {
    width: TAS.en,
    height: TAS.boy,
    borderRadius: TAS.yuvarlak,
    backgroundColor: '#1b5570',
    borderWidth: 1,
    borderColor: '#1d5872',
  },
});
