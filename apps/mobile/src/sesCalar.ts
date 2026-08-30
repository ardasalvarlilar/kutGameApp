// Ses efektlerinin calinmasi.
//
// Kural degil, geri bildirim. Motor sesten haberdar degil (CLAUDE.md #1:
// yan etki yok); ekran durum degisimini gorup caliyor. Hangi sesin
// calacagina karar veren saf mantik src/ses.ts'te.
//
// Dosyalar `assets/sesler/` altinda — degistirmek icin ayni ada sahip yeni
// dosyayi oraya kopyalamak yeterli, bkz. assets/sesler/OKUBENI.md.

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { sesSec, type SesAdi, type SesGirdisi } from './ses';

// Metro `require`'i statik cozdugu icin liste burada sabit durmak zorunda.
const KAYNAKLAR: Record<SesAdi, number> = {
  at: require('../assets/sesler/at.wav'),
  cek: require('../assets/sesler/cek.wav'),
  isle: require('../assets/sesler/isle.wav'),
};

const ADLAR: readonly SesAdi[] = ['at', 'cek', 'isle'];

/**
 * Sesleri bir kez yukler ve `cal(ad)` doner.
 *
 * Ses cikmamasi oyunu bozmamali: her cagri sessizce yutuluyor. Cihazda ses
 * dosyasi acilamazsa oyun aksamadan devam eder.
 */
export function useSes(acik: boolean): (ad: SesAdi) => void {
  const calarlarRef = useRef<Partial<Record<SesAdi, AudioPlayer>>>({});
  const acikRef = useRef(acik);
  acikRef.current = acik;

  useEffect(() => {
    const calarlar: Partial<Record<SesAdi, AudioPlayer>> = {};

    // Sessiz moddaki telefonda da duyulsun; oyun sesi bildirim degil.
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(
      () => undefined,
    );

    for (const ad of ADLAR) {
      try {
        calarlar[ad] = createAudioPlayer(KAYNAKLAR[ad]);
      } catch {
        // Ses acilamadiysa o efekt sessiz kalir; oyun etkilenmez.
      }
    }
    calarlarRef.current = calarlar;

    return () => {
      calarlarRef.current = {};
      for (const calar of Object.values(calarlar)) {
        try {
          calar?.remove();
        } catch {
          // Kapanis sirasinda hata yutulur.
        }
      }
    };
  }, []);

  return useCallback((ad: SesAdi) => {
    if (!acikRef.current) return;
    const calar = calarlarRef.current[ad];
    if (calar === undefined) return;
    try {
      // Ust uste calmalarda bastan basla — arka arkaya atislar duyulsun.
      calar.seekTo(0);
      calar.play();
    } catch {
      // Ses cikmamasi oyunu durdurmaz.
    }
  }, []);
}

/** Onceki gorunumu hatirlayip `sesSec`i cagiran kucuk yardimci. */
export function useSesSecici(): { readonly hatirla: (girdi: SesGirdisi) => SesAdi | null } {
  const oncekiRef = useRef<SesGirdisi | null>(null);
  return useMemo(
    () => ({
      hatirla: (girdi: SesGirdisi) => {
        const onceki = oncekiRef.current;
        oncekiRef.current = girdi;
        if (onceki === null) return null;
        return sesSec(onceki, girdi);
      },
    }),
    [],
  );
}
