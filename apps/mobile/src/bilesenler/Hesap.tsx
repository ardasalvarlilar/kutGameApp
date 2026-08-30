// Hesap ekrani.
//
// Uc is goruyor ve ucu de App Store denetiminin bakacagi yerler:
//
//   ad degistirme  → uygunsuz ad sikayeti gelirse oyuncu duzeltebilsin
//   engel listesi  → 1.2, "engellediklerini gorup geri alabilme"
//   HESAP SILME    → 5.1.1(v), hesap acan her uygulama icin ZORUNLU
//
// Silme iki adimli: tek dokunusla silinen bir hesap, yanlislikla basmanin
// geri donusu olmayan hali demek. Onay ekraninda ne kaybedilecegi yaziyor.

import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alan, AnaDugme, Baglanti, Hata } from './Alan';
import { useKimlik } from '../ag/kimlik';
import { YASAL } from '../ag/yasal';
import { renkler } from '../tema';

export interface HesapOzellikleri {
  readonly onKapat: () => void;
}

export function Hesap({ onKapat }: HesapOzellikleri) {
  const kimlik = useKimlik();
  const oyuncu = kimlik.oyuncu;

  const [ad, setAd] = useState(oyuncu?.ad ?? '');
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  const [silmeOnayi, setSilmeOnayi] = useState(false);

  useEffect(() => {
    void kimlik.engelleriTazele();
  }, [kimlik]);

  async function calistir(is: () => Promise<string | null>, basarili?: string) {
    setBekliyor(true);
    setHata(null);
    setBilgi(null);
    const sorun = await is();
    setBekliyor(false);
    if (sorun !== null) setHata(sorun);
    else if (basarili !== undefined) setBilgi(basarili);
  }

  if (silmeOnayi) {
    return (
      <View style={stil.onayGovde}>
        <View style={stil.onayKutu}>
          <Text style={stil.onayBaslik}>HESABINI SİLMEK ÜZERESİN</Text>
          <Text style={stil.onayMetin}>
            Hesabın, görünen adın, e-posta adresin, istatistiklerin ve engel listen kalıcı
            olarak silinir.
          </Text>
          <Text style={stil.onayUyari}>Bu işlem geri alınamaz.</Text>
          <Hata metin={hata} />
          <View style={stil.onayDugmeler}>
            <View style={stil.esit}>
              <AnaDugme etiket="VAZGEÇ" onBas={() => setSilmeOnayi(false)} tur="sade" />
            </View>
            <View style={stil.esit}>
              <AnaDugme
                etiket="EVET, SİL"
                onBas={() => void calistir(() => kimlik.hesabiSil())}
                bekliyor={bekliyor}
                tur="tehlike"
              />
            </View>
          </View>
          <Baglanti etiket="Silme hakkında ayrıntı" adres={YASAL.hesapSilme} ortala />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={stil.govde}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={stil.sol}>
        <Text style={stil.baslik}>HESAP</Text>
        <Text style={stil.ad}>{oyuncu?.ad ?? '—'}</Text>
        <Text style={stil.satir}>{oyuncu?.eposta ?? 'misafir hesabı'}</Text>
        <Text style={stil.satir}>
          {oyuncu === null
            ? ''
            : `${oyuncu.oynananEl} el · ${oyuncu.kazanilanEl} galibiyet · ` +
              `${oyuncu.oynananMac} maç · ${oyuncu.kazanilanMac} maç galibiyeti`}
        </Text>

        {oyuncu?.misafirMi === true ? (
          <Text style={stil.uyari}>
            Misafir oynuyorsun. Hesap açmazsan ilerlemen bu telefonda kalır; uygulamayı
            silersen gider.
          </Text>
        ) : null}

        <View style={stil.yasal}>
          <Baglanti etiket="Gizlilik" adres={YASAL.gizlilik} />
          <Baglanti etiket="Koşullar" adres={YASAL.kosullar} />
          <Baglanti etiket="Destek" adres={YASAL.destek} />
        </View>
      </View>

      <ScrollView contentContainerStyle={stil.sag} keyboardShouldPersistTaps="handled">
        <Alan
          etiket="Görünen ad"
          value={ad}
          onChangeText={setAd}
          maxLength={24}
          autoCapitalize="words"
        />
        <AnaDugme
          etiket="ADI KAYDET"
          onBas={() => void calistir(() => kimlik.adiDegistir(ad), 'Ad güncellendi')}
          aktif={ad.trim().length >= 2 && ad.trim() !== oyuncu?.ad && !bekliyor}
          bekliyor={bekliyor}
        />

        <Text style={stil.bolum}>ENGELLEDİKLERİN</Text>
        {kimlik.engellenenler.length === 0 ? (
          <Text style={stil.bos}>Kimseyi engellemedin.</Text>
        ) : (
          kimlik.engellenenler.map((kisi) => (
            <View key={kisi.id} style={stil.engelSatiri}>
              <Text style={stil.engelAd} numberOfLines={1}>
                {kisi.ad}
              </Text>
              <View style={stil.kucukDugme}>
                <AnaDugme
                  etiket="KALDIR"
                  onBas={() => void calistir(() => kimlik.engelKaldir(kisi.id))}
                  tur="sade"
                />
              </View>
            </View>
          ))
        )}

        {bilgi !== null ? <Text style={stil.bilgi}>{bilgi}</Text> : null}
        <Hata metin={hata} />

        <View style={stil.altBoluk}>
          <AnaDugme etiket="LOBİYE DÖN" onBas={onKapat} tur="sade" />
          <AnaDugme etiket="ÇIKIŞ YAP" onBas={() => void kimlik.cikisYap()} tur="cizgi" />
          {/* App Store 5.1.1(v): hesap uygulamanin ICINDEN silinebilmeli.
              "Bize e-posta at" yetmiyor, denetimde ret sebebi. */}
          <AnaDugme etiket="HESABIMI SİL" onBas={() => setSilmeOnayi(true)} tur="tehlike" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const stil = StyleSheet.create({
  govde: { flex: 1, flexDirection: 'row', padding: 16, gap: 24, alignItems: 'center' },

  sol: { flex: 1, gap: 4, paddingLeft: 8 },
  baslik: { color: renkler.vurgu, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  ad: { color: renkler.metin, fontSize: 24, fontWeight: '800' },
  satir: { color: renkler.metinSolgun, fontSize: 11 },
  uyari: { color: renkler.uyari, fontSize: 10, marginTop: 6, maxWidth: 300 },
  yasal: { flexDirection: 'row', gap: 14, marginTop: 14 },

  sag: { width: 300, gap: 8, paddingBottom: 10 },
  bolum: {
    color: renkler.metinSolgun,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 10,
  },
  bos: { color: renkler.metinSolgun, fontSize: 11 },
  engelSatiri: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: renkler.panel,
    borderWidth: 1,
    borderColor: renkler.kenar,
    borderRadius: 8,
    paddingLeft: 10,
    paddingVertical: 4,
    paddingRight: 4,
  },
  engelAd: { flex: 1, color: renkler.metin, fontSize: 12, fontWeight: '700' },
  kucukDugme: { width: 92 },
  bilgi: { color: renkler.onay, fontSize: 11 },
  altBoluk: { gap: 6, marginTop: 14 },

  onayGovde: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: renkler.arka,
  },
  onayKutu: {
    width: '100%',
    maxWidth: 420,
    gap: 8,
    backgroundColor: renkler.panelKoyu,
    borderWidth: 1,
    borderColor: renkler.uyari,
    borderRadius: 10,
    padding: 16,
  },
  onayBaslik: { color: renkler.uyari, fontSize: 15, fontWeight: '900', letterSpacing: 0.8 },
  onayMetin: { color: renkler.metin, fontSize: 12, lineHeight: 17 },
  onayUyari: { color: renkler.uyari, fontSize: 12, fontWeight: '800' },
  onayDugmeler: { flexDirection: 'row', gap: 8, marginTop: 4 },
  esit: { flex: 1 },
});
