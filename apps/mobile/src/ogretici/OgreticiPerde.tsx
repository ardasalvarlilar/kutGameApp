// Ogretici perdesi: hedefin etrafini karartir, yanina bir balon koyar.
//
// Karartma DORT DIKDORTGEN (bkz. yerlesim.ts). Bunun tek sebebi SVG'den
// kacinmak degil: delik gercekten acik kaldigi icin dokunuslar altindaki
// GERCEK dugmeye geciyor. Adimlar kullanicinin gercekten basmasini
// bekledigi icin bu sart.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useCeviri } from '../dil';
import { golge, renkler } from '../tema';
import { balonYerlesimi, karartmaParcalari, type Dikdortgen } from './yerlesim';

const BALON_ENI = 268;
/** Olculene kadarki tahmin; ilk cizimde balonun yeri buna gore secilir. */
const BALON_BOYU_TAHMINI = 132;

export interface OgreticiPerdesiOzellikleri {
  /** Isik tutulacak oge; null ise balon ekranin ortasinda durur. */
  readonly hedef: Dikdortgen | null;
  readonly baslik: string;
  readonly metin: string;
  /** Kuralin ince yeri — varsa balonun altinda ayri bir satirda. */
  readonly ekBilgi?: string;
  readonly adimNo: number;
  readonly adimSayisi: number;
  /**
   * `false` ise ILERI dugmesi yok: adim kullanicinin hamlesini bekliyor.
   * GEC ve KAPAT her adimda duruyor — kimse ogreticide sikismasin.
   */
  readonly ileriVar: boolean;
  readonly onIleri: () => void;
  readonly onGec: () => void;
  readonly onKapat: () => void;
}

export function OgreticiPerde({
  hedef,
  baslik,
  metin,
  ekBilgi,
  adimNo,
  adimSayisi,
  ileriVar,
  onIleri,
  onGec,
  onKapat,
}: OgreticiPerdesiOzellikleri) {
  const t = useCeviri();
  const { width: en, height: boy } = useWindowDimensions();
  const [balonBoyu, setBalonBoyu] = useState(BALON_BOYU_TAHMINI);

  const ekran = { en, boy };
  const yerlesim =
    hedef === null
      ? { x: en / 2 - BALON_ENI / 2, y: boy / 2 - balonBoyu / 2 }
      : balonYerlesimi(hedef, { en: BALON_ENI, boy: balonBoyu }, ekran);

  return (
    // `box-none`: perdenin kendisi dokunus yakalamiyor, yalnizca cocuklari.
    // Delikteki gercek dugme boylece basilabilir kaliyor.
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Karartma dokunus YAKALAMIYOR: adimlar cogu zaman birden fazla ogeyle
          is goruyor ("taslari sec, sonra AÇ'a bas"). Isik yalnizca dikkati
          yonlendiriyor, ekrani kilitlemiyor. Yanlis yere basan kullaniciyi
          adimin beklentisi zaten geri tutuyor. */}
      {hedef === null ? (
        <View style={[StyleSheet.absoluteFill, stil.karartma]} pointerEvents="none" />
      ) : (
        <>
          {karartmaParcalari(hedef, ekran).map((parca, sira) => (
            <View
              key={sira}
              pointerEvents="none"
              style={[
                stil.karartma,
                { position: 'absolute', left: parca.x, top: parca.y, width: parca.en, height: parca.boy },
              ]}
            />
          ))}
          {/* Delige altin cerceve: isigin nereye tutuldugu belli olsun. */}
          <View
            pointerEvents="none"
            style={[
              stil.cerceve,
              { left: hedef.x - 3, top: hedef.y - 3, width: hedef.en + 6, height: hedef.boy + 6 },
            ]}
          />
        </>
      )}

      <View
        pointerEvents="auto"
        onLayout={(olay) => setBalonBoyu(olay.nativeEvent.layout.height)}
        style={[stil.balon, { left: yerlesim.x, top: yerlesim.y }]}
      >
        <Text style={stil.sayac}>
          {t('ogretici.adimSayaci', { adim: adimNo, toplam: adimSayisi })}
        </Text>
        <Text style={stil.baslik}>{baslik}</Text>
        <Text style={stil.metin}>{metin}</Text>
        {ekBilgi !== undefined ? <Text style={stil.ekBilgi}>{ekBilgi}</Text> : null}

        <View style={stil.dugmeler}>
          <Pressable onPress={onKapat} hitSlop={8} style={stil.cizgiDugme}>
            <Text style={stil.cizgiYazi}>{t('ogretici.kapat')}</Text>
          </Pressable>
          <View style={stil.bosluk} />
          {ileriVar ? (
            <Pressable
              onPress={onIleri}
              style={({ pressed }) => [stil.anaDugme, pressed && stil.basili]}
            >
              <Text style={stil.anaYazi}>{t('ogretici.ileri')}</Text>
            </Pressable>
          ) : (
            <Pressable onPress={onGec} hitSlop={8} style={stil.cizgiDugme}>
              <Text style={stil.cizgiYazi}>{t('ogretici.gec')}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const stil = StyleSheet.create({
  karartma: { backgroundColor: 'rgba(4, 16, 24, 0.78)' },
  cerceve: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: renkler.vurgu,
    borderRadius: 8,
  },

  balon: {
    position: 'absolute',
    width: BALON_ENI,
    backgroundColor: renkler.panelKoyu,
    borderWidth: 1.5,
    borderColor: renkler.vurgu,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
    gap: 4,
    ...golge.yukseltilmis,
  },
  sayac: { color: renkler.vurgu, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  baslik: { color: renkler.metin, fontSize: 14, fontWeight: '800' },
  metin: { color: renkler.metin, fontSize: 12, lineHeight: 17 },
  ekBilgi: {
    color: renkler.metinSolgun,
    fontSize: 10,
    lineHeight: 14,
    borderLeftWidth: 2,
    borderLeftColor: renkler.kenar,
    paddingLeft: 7,
    marginTop: 2,
  },

  dugmeler: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  bosluk: { flex: 1 },
  anaDugme: {
    backgroundColor: renkler.vurgu,
    borderRadius: 9,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 34,
    justifyContent: 'center',
  },
  basili: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  anaYazi: { color: '#2a2000', fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  cizgiDugme: { paddingHorizontal: 4, paddingVertical: 8 },
  cizgiYazi: { color: renkler.metinSolgun, fontSize: 11, fontWeight: '700' },
});
