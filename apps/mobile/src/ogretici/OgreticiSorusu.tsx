// "Ogretici ile baslamak ister misin?" — alistirmaya ILK girildiginde.
//
// Cevap ne olursa olsun bir daha sorulmuyor (`depo.ogreticiSorulduYaz`).
// Hayir diyene her alistirmada tekrar sormak sinir bozucu olurdu; fikri
// degisenin yolu Ayarlar'daki "Ogreticiyi oynat".

import { StyleSheet, Text, View } from 'react-native';
import { AnaDugme } from '../bilesenler/Alan';
import { useCeviri } from '../dil';
import { golge, renkler } from '../tema';

export function OgreticiSorusu({
  onEvet,
  onHayir,
}: {
  readonly onEvet: () => void;
  readonly onHayir: () => void;
}) {
  const t = useCeviri();
  return (
    <View style={stil.perde}>
      <View style={stil.kutu}>
        <Text style={stil.baslik}>{t('ogretici.soruBaslik')}</Text>
        <Text style={stil.metin}>{t('ogretici.soruMetin')}</Text>
        <View style={stil.dugmeler}>
          <View style={stil.esit}>
            <AnaDugme etiket={t('ogretici.soruHayir')} onBas={onHayir} tur="cizgi" />
          </View>
          <View style={stil.esit}>
            <AnaDugme etiket={t('ogretici.soruEvet')} onBas={onEvet} />
          </View>
        </View>
      </View>
    </View>
  );
}

const stil = StyleSheet.create({
  perde: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4, 16, 24, 0.82)',
    padding: 20,
  },
  kutu: {
    width: '100%',
    maxWidth: 360,
    gap: 8,
    backgroundColor: renkler.panelKoyu,
    borderWidth: 1.5,
    borderColor: renkler.vurgu,
    borderRadius: 14,
    padding: 16,
    ...golge.yukseltilmis,
  },
  baslik: { color: renkler.metin, fontSize: 16, fontWeight: '800' },
  metin: { color: renkler.metin, fontSize: 12, lineHeight: 17 },
  dugmeler: { flexDirection: 'row', gap: 8, marginTop: 6 },
  esit: { flex: 1 },
});
