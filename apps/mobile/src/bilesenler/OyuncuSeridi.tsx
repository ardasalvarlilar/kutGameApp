import { StyleSheet, Text, View } from 'react-native';
import type { OyuncuGorunumu, OyuncuId } from '@kut/engine';
import { SERIT_EN } from '../olculer';
import { renkler } from '../tema';

export type SeritYonu = 'ust' | 'sol' | 'sag';

interface Ozellikler {
  readonly oyuncu: OyuncuId;
  readonly ad: string;
  readonly yon: SeritYonu;
  readonly gorunum: OyuncuGorunumu;
}

/**
 * Rakibin istakasi — masada karsinda duran ahsap serit.
 * Uzerindeki taslar gorunmez; yalnizca kim oldugu ve durumu yazar.
 * Istakadaki tas sayisi bilerek gosterilmiyor.
 */
export function OyuncuSeridi({ oyuncu, ad, yon, gorunum }: Ozellikler) {
  const siradaMi = gorunum.siradaki === oyuncu && gorunum.faz !== 'el-bitti';
  const dikey = yon !== 'ust';

  return (
    <View style={[stil.govde, dikey ? stil.dikey : stil.yatay, siradaMi && stil.sirada]}>
      <View style={dikey ? stil.dikeyIsik : stil.yatayIsik} />
      <View style={[stil.icerik, dikey && stil.icerikDikey]}>
        <Text style={[stil.ad, dikey && stil.adDikey]} numberOfLines={1}>
          {ad}
        </Text>
        {gorunum.acmisMi[oyuncu] ? <Text style={stil.rozet}>açtı</Text> : null}
        {gorunum.calinanSayisi[oyuncu] > 0 ? (
          <Text style={stil.rozetUyari}>{gorunum.calinanSayisi[oyuncu]}×çaldı</Text>
        ) : null}
        {gorunum.islerTasSayisi[oyuncu] > 0 ? (
          <Text style={stil.rozetUyari}>{gorunum.islerTasSayisi[oyuncu]}×işler</Text>
        ) : null}
      </View>
    </View>
  );
}

const stil = StyleSheet.create({
  govde: {
    backgroundColor: renkler.ahsap,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  yatay: { height: 22, flexDirection: 'column' },
  dikey: { width: SERIT_EN, flexDirection: 'row' },
  sirada: { borderColor: renkler.vurgu },
  yatayIsik: { height: 3, backgroundColor: renkler.ahsapAcik },
  dikeyIsik: { width: 3, backgroundColor: renkler.ahsapAcik },
  icerik: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  icerikDikey: { flexDirection: 'column', gap: 2 },
  ad: { color: '#3b2408', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  adDikey: { fontSize: 8, letterSpacing: 0 },
  rozet: { color: '#1d5c34', fontSize: 9, fontWeight: '700' },
  rozetUyari: { color: '#7d2a10', fontSize: 9, fontWeight: '700' },
});
