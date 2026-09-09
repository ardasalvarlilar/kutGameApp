// MASA BUL — oturulabilecek acik masalarin listesi.
//
// Ozel masalar buraya GIRMEZ: onlarin tek kapisi kod (bkz. Lobi'deki
// "ÖZEL MASA" ve "KODLA KATIL"). Ayrim veri modelinde zaten vardi
// (`Masa.ozel`); bu ekran onu gorunur kiliyor.
//
// Listede engellediginin ya da seni engelleyenin oturdugu masa hic cikmaz
// (App Store 1.2) — eleme sunucuda yapiliyor. Gorunup katilirken reddedilmek,
// engellemeyi karsi tarafa sezdirirdi.
//
// Liste KENDILIGINDEN tazelenmiyor, tazeleme tusu var: masalar saniyede bir
// degismiyor ve acik bir soket akisini bunun icin mesgul etmeye degmez.

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AnaDugme, Hata } from './Alan';
import type { AcikMasaOzeti } from '../ag/protokol';
import { useCeviri } from '../dil';
import { renkler } from '../tema';

export interface MasaBulOzellikleri {
  readonly masalariGetir: () => Promise<readonly AcikMasaOzeti[]>;
  readonly onKatil: (kod: string) => void;
  /** Hic acik masa yoksa oyuncu buradan kendi acik masasini acar. */
  readonly onMasaAc: () => void;
  readonly onKapat: () => void;
  readonly mesgul: boolean;
  readonly hata: string | null;
}

export function MasaBul({
  masalariGetir,
  onKatil,
  onMasaAc,
  onKapat,
  mesgul,
  hata,
}: MasaBulOzellikleri) {
  const t = useCeviri();
  const [masalar, setMasalar] = useState<readonly AcikMasaOzeti[] | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  const tazele = useCallback(() => {
    setYukleniyor(true);
    void masalariGetir()
      .then(setMasalar)
      .finally(() => setYukleniyor(false));
  }, [masalariGetir]);

  useEffect(tazele, [tazele]);

  return (
    <View style={stil.govde}>
      <View style={stil.baslikSatiri}>
        <View style={stil.baslikYazi}>
          <Text style={stil.baslik}>{t('masaBul.baslik')}</Text>
          <Text style={stil.altBaslik}>{t('masaBul.altBaslik')}</Text>
        </View>
        <View style={stil.baslikDugmeler}>
          <AnaDugme
            etiket={t('masaBul.tazele')}
            onBas={tazele}
            aktif={!yukleniyor && !mesgul}
            tur="cizgi"
          />
          <AnaDugme etiket={t('masaBul.geri')} onBas={onKapat} tur="cizgi" />
        </View>
      </View>

      <Hata metin={hata} />

      {masalar === null && yukleniyor ? (
        <View style={stil.orta}>
          <ActivityIndicator color={renkler.vurgu} />
          <Text style={stil.bilgi}>{t('masaBul.yukleniyor')}</Text>
        </View>
      ) : null}

      {masalar !== null && masalar.length === 0 ? (
        // Bos liste cikmaz sokak degil: oyuncu buradan kendi masasini acar,
        // sonra gelen ONUN masasina oturur.
        <View style={stil.orta}>
          <Text style={stil.bilgi}>{t('masaBul.bosListe')}</Text>
          <Text style={stil.bilgiKucuk}>{t('masaBul.bosListeIpucu')}</Text>
          <View style={stil.bosDugme}>
            <AnaDugme etiket={t('masaBul.masaAc')} onBas={onMasaAc} aktif={!mesgul} />
          </View>
        </View>
      ) : null}

      {masalar !== null && masalar.length > 0 ? (
        <ScrollView contentContainerStyle={stil.liste}>
          {masalar.map((masa) => (
            <Pressable
              key={masa.kod}
              onPress={mesgul ? undefined : () => onKatil(masa.kod)}
              style={[stil.satir, mesgul && stil.satirPasif]}
            >
              <View style={stil.satirSol}>
                <Text style={stil.oyuncular} numberOfLines={1}>
                  {masa.oyuncular.join(' · ')}
                </Text>
                <Text style={stil.kod}>{t('masaBul.masaKodu', { kod: masa.kod })}</Text>
              </View>
              <View style={stil.satirSag}>
                <Text style={stil.sayi}>
                  {masa.oyuncuSayisi}/{masa.kapasite}
                </Text>
                <Text style={stil.katilYazi}>
                  {t(masa.benimMi ? 'masaBul.masanaDon' : 'masaBul.katil')}
                </Text>
              </View>
            </Pressable>
          ))}

          <View style={stil.listeAlti}>
            <Text style={stil.bilgiKucuk}>{t('masaBul.begenmedin')}</Text>
            <AnaDugme
              etiket={t('masaBul.masaAc')}
              onBas={onMasaAc}
              aktif={!mesgul}
              tur="sade"
            />
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

const stil = StyleSheet.create({
  govde: { flex: 1, padding: 16, gap: 10 },

  baslikSatiri: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  baslikYazi: { flex: 1, gap: 2 },
  baslik: { color: renkler.vurgu, fontSize: 22, fontWeight: '900', letterSpacing: 3 },
  altBaslik: { color: renkler.metinSolgun, fontSize: 11 },
  baslikDugmeler: { flexDirection: 'row', gap: 8 },

  orta: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  bilgi: { color: renkler.metin, fontSize: 14, fontWeight: '700' },
  bilgiKucuk: { color: renkler.metinSolgun, fontSize: 11, textAlign: 'center' },
  bosDugme: { marginTop: 12, width: 220 },

  liste: { gap: 8, paddingBottom: 12 },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: renkler.panel,
    borderColor: renkler.kenar,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  satirPasif: { opacity: 0.5 },
  satirSol: { flex: 1, gap: 2 },
  oyuncular: { color: renkler.metin, fontSize: 14, fontWeight: '700' },
  kod: { color: renkler.metinSolgun, fontSize: 10, letterSpacing: 1 },
  satirSag: { alignItems: 'flex-end', gap: 2 },
  sayi: { color: renkler.vurgu, fontSize: 18, fontWeight: '900' },
  katilYazi: { color: renkler.metinSolgun, fontSize: 10 },

  listeAlti: { marginTop: 8, gap: 6, alignItems: 'stretch' },
});
