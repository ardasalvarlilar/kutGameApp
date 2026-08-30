import { useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import type { Tas, TasId } from '@kut/engine';
import { SATIR_SAYISI, type Duzen } from '../duzen';
import { renkler } from '../tema';
import { OLCULER } from '../olculer';
import { TasGorseli } from './TasGorseli';

const TAS = OLCULER.buyuk;
/** Slot olculeri — surukleme hedefi bunlarla hesaplanir. */
export const SLOT_EN = TAS.en + 2;
export const SLOT_BOY = TAS.boy + 5;
export const IZGARA_BOYU = SATIR_SAYISI * SLOT_BOY;

/** Parmak bu kadar kaydiysa dokunus degil surukleme sayilir. */
const SURUKLEME_ESIGI = 5;

interface Ozellikler {
  readonly taslar: readonly Tas[];
  readonly duzen: Duzen;
  readonly sutunSayisi: number;
  readonly secili: readonly TasId[];
  /** KURALLAR.md §8 — atilirsa ceza getirecek taslar; altlarina isaret konur. */
  readonly islerTaslar: readonly TasId[];
  /** KURALLAR.md §6 — yerden okey cekmeye yarayan taslarim. */
  readonly okeyeYarayanlar: readonly TasId[];
  /** KURALLAR.md §3 — tur 16'da atilinca eli bitiren taslar. */
  readonly bitirenler: readonly TasId[];
  readonly onTas: (tasId: TasId) => void;
  readonly onTasiTasi: (kaynak: number, hedef: number) => void;
  /**
   * Tas istakanin disina, masaya dogru birakildi. Nokta EKRAN koordinati
   * (pageX/pageY); hangi hedefe dustugune App karar veriyor — atik obegi mi,
   * yerdeki bir per mi (src/hedefler.ts).
   */
  readonly onDisariBirak: (tasId: TasId, nokta: { readonly x: number; readonly y: number }) => void;
  /** Surukleme basladi — App bu anda hedeflerin konumunu olcuyor. */
  readonly onSuruklemeBasladi: () => void;
  readonly onOlcum: (genislik: number) => void;
}

/** Bu kadar yukari suruklenirse tas masaya atiliyor sayilir. */
const MASAYA_ESIGI = 26;

/**
 * Ahsap istaka — iki katli.
 *
 * Ustteki ve alttaki sira arasinda bir oluk (golge) var; gercek istakada
 * oldugu gibi taslar iki sirada durabiliyor. Bu oyunda calma yuzunden
 * istakada 24+ tas olabildigi icin tek sira yetmiyor (KURALLAR.md §5).
 *
 * Bolmeler ayri bir alanda degil, izgaradaki BOSLUKLARLA belli oluyor:
 * bitisik duran taslar bir per adayi sayiliyor. Taslar suruklenebilir,
 * boylece oyuncu kendi serisini/kutunu istedigi gibi kurabiliyor.
 */
export function Istaka({
  taslar,
  duzen,
  sutunSayisi,
  secili,
  islerTaslar,
  okeyeYarayanlar,
  bitirenler,
  onTas,
  onTasiTasi,
  onDisariBirak,
  onSuruklemeBasladi,
  onOlcum,
}: Ozellikler) {
  const [surukleme, setSurukleme] = useState<{ readonly tasId: TasId; readonly kaynak: number } | null>(
    null,
  );
  const konum = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const izgaraRef = useRef<View>(null);
  const kokRef = useRef({ x: 0, y: 0 });
  const basimRef = useRef({ kaynak: -1, tasId: null as TasId | null, hareket: false });

  const tasHaritasi = useMemo(() => {
    const harita = new Map<TasId, Tas>();
    for (const tas of taslar) harita.set(tas.id, tas);
    return harita;
  }, [taslar]);

  const panResponder = useMemo(() => {
    const slotIndeksi = (x: number, y: number): number => {
      const sutun = Math.min(sutunSayisi - 1, Math.max(0, Math.floor(x / SLOT_EN)));
      const satir = Math.min(SATIR_SAYISI - 1, Math.max(0, Math.floor(y / SLOT_BOY)));
      return satir * sutunSayisi + sutun;
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (olay) => {
        const olayVerisi = olay.nativeEvent;
        // Izgaranin sayfadaki koku: dokunulan noktanin sayfa konumundan ayni
        // noktanin izgara icindeki konumunu cikariyoruz. Boylece ayri bir
        // olcume (measureInWindow) hic bagli kalmiyoruz — o async ve ilk
        // yerlesimde henuz dogru degeri vermeyebiliyor.
        const yerelX = olayVerisi.locationX ?? 0;
        const yerelY = olayVerisi.locationY ?? 0;
        kokRef.current = { x: olayVerisi.pageX - yerelX, y: olayVerisi.pageY - yerelY };

        const kaynak = slotIndeksi(yerelX, yerelY);
        basimRef.current = { kaynak, tasId: duzen[kaynak] ?? null, hareket: false };
        konum.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_olay, hareket) => {
        const basim = basimRef.current;
        if (
          !basim.hareket &&
          (Math.abs(hareket.dx) > SURUKLEME_ESIGI || Math.abs(hareket.dy) > SURUKLEME_ESIGI)
        ) {
          basim.hareket = true;
          if (basim.tasId !== null) {
            setSurukleme({ tasId: basim.tasId, kaynak: basim.kaynak });
            // Hedeflerin ekrandaki yeri masa doldukca kayiyor; tam bu anda
            // olculuyor ki birakirken guncel olsun.
            onSuruklemeBasladi();
          }
        }
        if (basim.hareket) konum.setValue({ x: hareket.dx, y: hareket.dy });
      },
      onPanResponderRelease: (olay, hareket) => {
        const basim = basimRef.current;
        setSurukleme(null);
        if (basim.tasId === null) return;

        // Ara hareket olayi hic gelmemis olabilir (hizli surukleme, olay
        // birlestirme); birakma anindaki mesafeye de bakiyoruz.
        const uzaklastiMi =
          Math.abs(hareket.dx) > SURUKLEME_ESIGI || Math.abs(hareket.dy) > SURUKLEME_ESIGI;
        if (!basim.hareket && !uzaklastiMi) {
          onTas(basim.tasId);
          return;
        }
        const x = olay.nativeEvent.pageX - kokRef.current.x;
        const y = olay.nativeEvent.pageY - kokRef.current.y;

        // Istakanin ustune, masaya dogru surukleme: hedefi App bulsun.
        if (y < -MASAYA_ESIGI) {
          onDisariBirak(basim.tasId, {
            x: olay.nativeEvent.pageX,
            y: olay.nativeEvent.pageY,
          });
          return;
        }
        onTasiTasi(basim.kaynak, slotIndeksi(x, y));
      },
      // Surukleme basladiktan sonra responder'i kimseye devretme. Aksi halde
      // ust bilesenler devralip release'i hic tetiklemiyor, tas yerine oturmuyor.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderTerminate: () => setSurukleme(null),
    });
  }, [duzen, sutunSayisi, onTas, onTasiTasi, onDisariBirak, onSuruklemeBasladi, konum]);

  const surukleyenSatir = surukleme === null ? 0 : Math.floor(surukleme.kaynak / sutunSayisi);
  const surukleyenSutun = surukleme === null ? 0 : surukleme.kaynak % sutunSayisi;
  const surukleyenTas = surukleme === null ? undefined : tasHaritasi.get(surukleme.tasId);

  return (
    <View style={stil.govde}>
      <View style={stil.ustKenar} />
      <View
        ref={izgaraRef}
        style={[stil.izgara, { height: IZGARA_BOYU }]}
        onLayout={(olay) => onOlcum(olay.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        {/* Iki siranin oluklari — istakanin katlarini ayiran golge. */}
        {Array.from({ length: SATIR_SAYISI }, (_deger, satir) => (
          <View key={`oluk-${satir}`} style={[stil.oluk, { top: (satir + 1) * SLOT_BOY - 5 }]}>
            <View style={stil.olukIsik} />
            <View style={stil.olukGolge} />
          </View>
        ))}

        {duzen.map((tasId, indeks) => {
          if (tasId === null) return null;
          const tas = tasHaritasi.get(tasId);
          if (tas === undefined) return null;
          const satir = Math.floor(indeks / sutunSayisi);
          const sutun = indeks % sutunSayisi;
          return (
            <View
              key={tasId}
              style={[stil.yuva, { left: sutun * SLOT_EN, top: satir * SLOT_BOY }]}
            >
              <TasGorseli
                tas={tas}
                secili={secili.includes(tasId)}
                soluk={surukleme?.tasId === tasId}
                isler={islerTaslar.includes(tasId)}
                okeyeYarar={okeyeYarayanlar.includes(tasId)}
                bitirir={bitirenler.includes(tasId)}
              />
            </View>
          );
        })}

        {surukleme !== null && surukleyenTas !== undefined ? (
          <Animated.View
            style={[
              stil.yuva,
              stil.surukleniyor,
              {
                left: surukleyenSutun * SLOT_EN,
                top: surukleyenSatir * SLOT_BOY,
                transform: konum.getTranslateTransform(),
              },
            ]}
          >
            <TasGorseli
              tas={surukleyenTas}
              secili={secili.includes(surukleme.tasId)}
              isler={islerTaslar.includes(surukleme.tasId)}
              okeyeYarar={okeyeYarayanlar.includes(surukleme.tasId)}
              bitirir={bitirenler.includes(surukleme.tasId)}
            />
          </Animated.View>
        ) : null}

        {duzen.every((slot) => slot === null) ? (
          <Text style={stil.bos}>Istaka boş</Text>
        ) : null}
      </View>
      <View style={stil.altKenar} />
    </View>
  );
}

const stil = StyleSheet.create({
  govde: {
    flex: 1,
    backgroundColor: renkler.ahsap,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  ustKenar: { height: 4, backgroundColor: renkler.ahsapAcik },
  altKenar: { height: 6, backgroundColor: renkler.ahsapKoyu },
  izgara: { marginHorizontal: 6, marginVertical: 3, position: 'relative' },
  oluk: { position: 'absolute', left: -6, right: -6, height: 5, pointerEvents: 'none' },
  olukIsik: { height: 1, backgroundColor: renkler.ahsapAcik, opacity: 0.55 },
  olukGolge: { flex: 1, backgroundColor: renkler.ahsapKoyu },
  yuva: { position: 'absolute', pointerEvents: 'none' },
  surukleniyor: { zIndex: 10, elevation: 6, opacity: 0.92 },
  bos: { color: renkler.ahsapKoyu, fontStyle: 'italic', alignSelf: 'center', marginTop: 24 },
});
