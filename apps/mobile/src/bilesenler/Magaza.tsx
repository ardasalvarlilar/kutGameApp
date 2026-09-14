// Cip magazasi.
//
// Paketler ve fiyatlar @kut/ekonomi'de (paketler.ts); ekran yalnizca
// gosteriyor.
//
// SATIN ALMA HENUZ YOK. Uygulama ici satin alma App Store Connect / Play
// Console'da urunlerin tanimlanmasini ve makbuzun SUNUCUDA dogrulanmasini
// istiyor (MIMARI.md §5.5 — istemciye guvenilmez). O gelene kadar dugme
// kapali ve bunu acikca yaziyor: calisiyor gibi duran bir dugme oyuncuya
// "bastim, olmadi" dedirtirdi.

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { CIP_PAKETLERI, paketAvantaji } from '@kut/ekonomi';
import { AnaDugme } from './Alan';
import { useCeviri } from '../dil';
import { cipYaz } from '../cip';
import { golge, renkler } from '../tema';

export interface MagazaOzellikleri {
  readonly cip: number;
  readonly onKapat: () => void;
}

/** 39.99 → "39,99". Magaza kendi fiyatini verene kadar gosterim icin. */
function fiyatYaz(fiyat: number): string {
  const [tam, kurus] = fiyat.toFixed(2).split('.');
  return `${cipYaz(Number(tam))},${kurus ?? '00'}`;
}

export function Magaza({ cip, onKapat }: MagazaOzellikleri) {
  const t = useCeviri();

  return (
    <View style={stil.govde}>
      <View style={stil.baslikSatiri}>
        <View style={stil.baslikYazi}>
          <Text style={stil.baslik}>{t('magaza.baslik')}</Text>
          <Text style={stil.altBaslik}>{t('magaza.altBaslik')}</Text>
        </View>
        <View style={stil.bakiye}>
          <Text style={stil.bakiyeEtiket}>{t('kademe.bakiye')}</Text>
          <Text style={stil.bakiyeDeger}>{cipYaz(cip)}</Text>
        </View>
        <AnaDugme etiket={t('magaza.geri')} onBas={onKapat} tur="cizgi" />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={stil.kartlar}
      >
        {CIP_PAKETLERI.map((paket) => {
          const avantaj = paketAvantaji(paket);
          return (
            <View key={paket.urunKimligi} style={stil.kart}>
              <View style={stil.rozetYeri}>
                {avantaj > 0 ? (
                  <View style={stil.rozet}>
                    <Text style={stil.rozetYazi}>{t('magaza.avantaj', { yuzde: avantaj })}</Text>
                  </View>
                ) : null}
              </View>
              <View style={stil.cipDaire} />
              <Text style={stil.cipMiktari}>{cipYaz(paket.cip)}</Text>
              <Text style={stil.cipBirim}>{t('profil.cip')}</Text>
              <View style={stil.fiyat}>
                <Text style={stil.fiyatYazi}>
                  {t('magaza.fiyat', { fiyat: fiyatYaz(paket.fiyatTl) })}
                </Text>
                <Text style={stil.yakinda}>{t('magaza.yakinda')}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Text style={stil.not}>{t('magaza.not')}</Text>
    </View>
  );
}

const stil = StyleSheet.create({
  govde: { flex: 1, padding: 16, gap: 10 },

  baslikSatiri: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  baslikYazi: { flex: 1, gap: 2 },
  baslik: { color: renkler.vurgu, fontSize: 22, fontWeight: '900', letterSpacing: 3 },
  altBaslik: { color: renkler.metinSolgun, fontSize: 11 },

  bakiye: {
    alignItems: 'flex-end',
    backgroundColor: renkler.panelKoyu,
    borderWidth: 1,
    borderColor: renkler.vurguKoyu,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  bakiyeEtiket: { color: renkler.metinSolgun, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  bakiyeDeger: { color: renkler.vurgu, fontSize: 15, fontWeight: '900' },

  kartlar: { gap: 10, paddingVertical: 4, paddingRight: 4, alignItems: 'center' },

  kart: {
    width: 128,
    height: 196,
    alignItems: 'center',
    backgroundColor: renkler.panel,
    borderWidth: 1,
    borderColor: renkler.kenar,
    borderRadius: 12,
    overflow: 'hidden',
    ...golge.kart,
  },
  rozetYeri: { height: 22, alignSelf: 'stretch', alignItems: 'flex-end', padding: 5 },
  rozet: { backgroundColor: renkler.onay, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  rozetYazi: { color: '#0b2717', fontSize: 9, fontWeight: '900' },

  cipDaire: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: renkler.vurgu,
    borderWidth: 4,
    borderColor: renkler.vurguKoyu,
    marginTop: 4,
  },
  cipMiktari: { color: renkler.metin, fontSize: 16, fontWeight: '900', marginTop: 8 },
  cipBirim: { color: renkler.metinSolgun, fontSize: 8, fontWeight: '800', letterSpacing: 1 },

  fiyat: {
    marginTop: 'auto',
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 7,
    backgroundColor: renkler.panelKoyu,
    borderTopWidth: 1,
    borderTopColor: renkler.kenar,
  },
  fiyatYazi: { color: renkler.vurgu, fontSize: 14, fontWeight: '900' },
  yakinda: { color: renkler.metinSolgun, fontSize: 8, fontWeight: '800', letterSpacing: 1 },

  not: { color: renkler.metinSolgun, fontSize: 10, lineHeight: 14, textAlign: 'center' },
});
