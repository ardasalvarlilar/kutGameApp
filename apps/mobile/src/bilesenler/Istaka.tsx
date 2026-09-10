import { useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import type { Tas, TasId } from '@kut/engine';
import { SATIR_SAYISI, type Duzen } from '../duzen';
import type { Nokta } from '../hedefler';
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
  readonly onDisariBirak: (tasId: TasId, nokta: Nokta) => void;
  /**
   * Tas ele alindi. `kose` tasin slotunun EKRANDAKI sol ust kosesi: Masa
   * tasi en ustteki katmanda, parmagin tuttugu yerden tasiyor.
   */
  readonly onSuruklemeBasladi: (tasId: TasId, nokta: Nokta, kose: Nokta) => void;
  readonly onSuruklemeHareket: (nokta: Nokta) => void;
  /** Tas istakanin icinde birakildi; yerini `onTasiTasi` degistirdi. */
  readonly onIstakadaBirakti: () => void;
  /** Hareketi sistem kesti — tas slotuna donmeli. */
  readonly onSuruklemeIptal: () => void;
  /**
   * Su an parmakta (ya da masaya birakilmis, hamlenin sonucunu bekleyen) tas.
   * Slotunda CIZILMIYOR: gercek istakada tasi aldiginda yeri bos kalir.
   */
  readonly tasinanTasId: TasId | null;
  readonly onOlcum: (genislik: number) => void;
  /**
   * Izgaranin kendisi — Masa, ortadan suruklenen tasin istakaya birakilip
   * birakilmadigini ve hangi slota dustugunu bununla olcuyor.
   */
  readonly izgaraRef?: (gorunum: View | null) => void;
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
 *
 * Suruklenen tas BURADA cizilmiyor, Masa'nin en ustteki katmaninda
 * ciziliyor. Eskiden buradaydi ve istakanin kutusu (`overflow: hidden`)
 * onu kirpiyordu: tas istakadan cikar cikmaz gozden kayboluyordu, oyuncu
 * masanin ustunde neyi nereye goturdugunu goremiyordu.
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
  onSuruklemeHareket,
  onIstakadaBirakti,
  onSuruklemeIptal,
  tasinanTasId,
  onOlcum,
  izgaraRef,
}: Ozellikler) {
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
    /** Slotun ekrandaki sol ust kosesi. */
    const slotKosesi = (slot: number): Nokta => ({
      x: kokRef.current.x + (slot % sutunSayisi) * SLOT_EN,
      y: kokRef.current.y + Math.floor(slot / sutunSayisi) * SLOT_BOY,
    });

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
      },
      onPanResponderMove: (olay, hareket) => {
        const basim = basimRef.current;
        if (basim.tasId === null) return;
        const nokta = { x: olay.nativeEvent.pageX, y: olay.nativeEvent.pageY };
        if (!basim.hareket) {
          if (
            Math.abs(hareket.dx) <= SURUKLEME_ESIGI &&
            Math.abs(hareket.dy) <= SURUKLEME_ESIGI
          ) {
            return;
          }
          basim.hareket = true;
          onSuruklemeBasladi(basim.tasId, nokta, slotKosesi(basim.kaynak));
        }
        onSuruklemeHareket(nokta);
      },
      onPanResponderRelease: (olay, hareket) => {
        const basim = basimRef.current;
        if (basim.tasId === null) return;

        // Ara hareket olayi hic gelmemis olabilir (hizli surukleme, olay
        // birlestirme); birakma anindaki mesafeye de bakiyoruz.
        const uzaklastiMi =
          Math.abs(hareket.dx) > SURUKLEME_ESIGI || Math.abs(hareket.dy) > SURUKLEME_ESIGI;
        if (!basim.hareket && !uzaklastiMi) {
          onTas(basim.tasId);
          return;
        }
        const birakma = { x: olay.nativeEvent.pageX, y: olay.nativeEvent.pageY };
        if (!basim.hareket) {
          onSuruklemeBasladi(
            basim.tasId,
            { x: birakma.x - hareket.dx, y: birakma.y - hareket.dy },
            slotKosesi(basim.kaynak),
          );
        }
        basim.hareket = false;

        const x = birakma.x - kokRef.current.x;
        const y = birakma.y - kokRef.current.y;

        // Istakanin ustune, masaya dogru surukleme: hedefi App bulsun.
        if (y < -MASAYA_ESIGI) {
          onDisariBirak(basim.tasId, birakma);
          return;
        }
        onTasiTasi(basim.kaynak, slotIndeksi(x, y));
        onIstakadaBirakti();
      },
      // Surukleme basladiktan sonra responder'i kimseye devretme. Aksi halde
      // ust bilesenler devralip release'i hic tetiklemiyor, tas yerine oturmuyor.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderTerminate: () => {
        const basim = basimRef.current;
        if (!basim.hareket) return;
        basim.hareket = false;
        onSuruklemeIptal();
      },
    });
  }, [
    duzen,
    sutunSayisi,
    onTas,
    onTasiTasi,
    onDisariBirak,
    onSuruklemeBasladi,
    onSuruklemeHareket,
    onIstakadaBirakti,
    onSuruklemeIptal,
  ]);

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
          if (tasId === null || tasId === tasinanTasId) return null;
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
                isler={islerTaslar.includes(tasId)}
                okeyeYarar={okeyeYarayanlar.includes(tasId)}
                bitirir={bitirenler.includes(tasId)}
              />
            </View>
          );
        })}

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
  bos: { color: renkler.ahsapKoyu, fontStyle: 'italic', alignSelf: 'center', marginTop: 24 },
});
