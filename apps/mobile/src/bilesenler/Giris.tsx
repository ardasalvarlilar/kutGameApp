// Acilis ekrani: hesap ac, giris yap, parolani sifirla ya da misafir oyna.
//
// Uc yolun uçu de ayni yere cikiyor (sunucuda tek `Oyuncu` belgesi). Misafir
// yolu bilerek ONDE ve tek dokunus: oyuncu daha oyunu gormeden kayit ekranina
// carpmasin (MIMARI.md §4). Hesap acmanin karsiligi da yazili — "aynı hesapla
// başka telefondan" — yoksa kimse acmaz.
//
// Misafirken hesap acilirsa ILERLEME KAYBOLMAZ: uygulama cihaz kimligini de
// yolluyor, sunucu ayni belgenin uzerine e-postayi biniyor.
//
// Gizlilik ve kosullar baglantilari BURADA duruyor. App Store denetiminde
// gizlilik politikasinin uygulamanin icinden ulasilabilir olmasi bekleniyor;
// yalnizca App Store Connect alanina yazmak her zaman yetmiyor.

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alan, AnaDugme, Baglanti, Hata } from './Alan';
import { useKimlik } from '../ag/kimlik';
import { useCeviri } from '../dil';
import { SUNUCU_ADRESI } from '../ag/sunucu';
import { YASAL } from '../ag/yasal';
import { renkler } from '../tema';

type Sekme = 'giris' | 'kayit';
/** Parola sifirlama iki adim: once kod istenir, sonra yeni parola konur. */
type Sifirlama = 'kapali' | 'kod-iste' | 'kod-gir';

export function Giris() {
  const kimlik = useKimlik();
  const t = useCeviri();
  const [sekme, setSekme] = useState<Sekme>('giris');
  const [sifirlama, setSifirlama] = useState<Sifirlama>('kapali');

  const [eposta, setEposta] = useState('');
  const [parola, setParola] = useState('');
  const [ad, setAd] = useState('');
  const [kod, setKod] = useState('');
  const [yeniParola, setYeniParola] = useState('');

  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState<'misafir' | 'form' | null>(null);

  async function calistir(hangisi: 'misafir' | 'form', is: () => Promise<string | null>) {
    setBekliyor(hangisi);
    setHata(null);
    const sorun = await is();
    setBekliyor(null);
    if (sorun !== null) setHata(sorun);
    return sorun;
  }

  const misafirOyna = (): void => {
    void calistir('misafir', () => kimlik.misafirGir());
  };

  const formuGonder = (): void => {
    void calistir('form', () =>
      sekme === 'giris'
        ? kimlik.girisYap(eposta.trim(), parola)
        : kimlik.kayitOl({ eposta: eposta.trim(), parola, ad: ad.trim() }),
    );
  };

  const koduIste = (): void => {
    void calistir('form', async () => {
      const sorun = await kimlik.parolaKoduIste(eposta);
      if (sorun === null) {
        setSifirlama('kod-gir');
        setBilgi(t('giris.kodGonderildi'));
      }
      return sorun;
    });
  };

  const parolayiDegistir = (): void => {
    void calistir('form', () => kimlik.parolayiSifirla(eposta, kod, yeniParola));
  };

  const sifirlamayiKapat = (): void => {
    setSifirlama('kapali');
    setHata(null);
    setBilgi(null);
    setKod('');
    setYeniParola('');
  };

  const formTamam =
    sekme === 'giris'
      ? eposta.trim().length > 3 && parola.length > 0
      : eposta.trim().length > 3 && parola.length >= 8 && ad.trim().length >= 2;

  return (
    <KeyboardAvoidingView
      style={stil.govde}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={stil.sol}>
        <Text style={stil.oyunAdi}>KÜT</Text>
        <Text style={stil.altBaslik}>{t('giris.altBaslik')}</Text>

        <View style={stil.misafirKutu}>
          <AnaDugme
            etiket={t('giris.misafirOyna')}
            onBas={misafirOyna}
            bekliyor={bekliyor === 'misafir'}
            aktif={bekliyor === null}
          />
          <Text style={stil.ipucu}>{t('giris.misafirIpucu')}</Text>
        </View>

        <View style={stil.yasal}>
          <Baglanti etiket={t('giris.gizlilik')} adres={YASAL.gizlilik} />
          <Baglanti etiket={t('giris.kosullar')} adres={YASAL.kosullar} />
          <Baglanti etiket={t('giris.destek')} adres={YASAL.destek} />
        </View>
        <Text style={stil.adres} numberOfLines={1}>
          {t('giris.sunucu', { adres: SUNUCU_ADRESI.replace(/^https?:\/\//, '') })}
        </Text>
      </View>

      <View style={stil.sag}>
        {sifirlama === 'kapali' ? (
          <>
            <View style={stil.sekmeler}>
              {(['giris', 'kayit'] as const).map((secenek) => (
                <View key={secenek} style={stil.sekme}>
                  <AnaDugme
                    etiket={t(secenek === 'giris' ? 'giris.girisYap' : 'giris.hesapAc')}
                    onBas={() => {
                      setSekme(secenek);
                      setHata(null);
                    }}
                    tur={sekme === secenek ? 'vurgu' : 'cizgi'}
                  />
                </View>
              ))}
            </View>

            <ScrollView contentContainerStyle={stil.form} keyboardShouldPersistTaps="handled">
              {sekme === 'kayit' ? (
                <Alan
                  etiket={t('giris.gorunenAd')}
                  value={ad}
                  onChangeText={setAd}
                  placeholder={t('giris.gorunenAdIpucu')}
                  autoCapitalize="words"
                  maxLength={24}
                />
              ) : null}

              <Alan
                etiket={t('giris.eposta')}
                value={eposta}
                onChangeText={setEposta}
                placeholder={t('giris.epostaIpucu')}
                keyboardType="email-address"
                textContentType="emailAddress"
              />
              <Alan
                etiket={t('giris.parola')}
                value={parola}
                onChangeText={setParola}
                placeholder={t(sekme === 'kayit' ? 'giris.parolaEnAz' : 'giris.parolaGizli')}
                secureTextEntry
                // iOS'un parola yoneticisi dogru alani tanisin diye ayri ipucu.
                textContentType={sekme === 'kayit' ? 'newPassword' : 'password'}
                onSubmitEditing={formTamam ? formuGonder : undefined}
                returnKeyType="go"
              />

              <Hata metin={hata} />

              <AnaDugme
                etiket={t(sekme === 'giris' ? 'giris.girisYap' : 'giris.hesabiOlustur')}
                onBas={formuGonder}
                aktif={formTamam && bekliyor === null}
                bekliyor={bekliyor === 'form'}
              />

              {sekme === 'giris' ? (
                <Baglanti
                  etiket={t('giris.parolamiUnuttum')}
                  onBas={() => {
                    setSifirlama('kod-iste');
                    setHata(null);
                  }}
                  ortala
                />
              ) : (
                <Text style={stil.sozlesme}>{t('giris.sozlesme')}</Text>
              )}
            </ScrollView>
          </>
        ) : (
          <ScrollView contentContainerStyle={stil.form} keyboardShouldPersistTaps="handled">
            <Text style={stil.baslik}>{t('giris.sifirlamaBaslik')}</Text>

            <Alan
              etiket={t('giris.eposta')}
              value={eposta}
              onChangeText={setEposta}
              placeholder={t('giris.epostaIpucu')}
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={sifirlama === 'kod-iste'}
            />

            {sifirlama === 'kod-gir' ? (
              <>
                <Alan
                  etiket={t('giris.gelenKod')}
                  value={kod}
                  onChangeText={(yazi) => setKod(yazi.replace(/\D/g, ''))}
                  placeholder={t('giris.altiHane')}
                  keyboardType="number-pad"
                  maxLength={6}
                  // iOS kodu klavye ustunde onersin diye.
                  textContentType="oneTimeCode"
                />
                <Alan
                  etiket={t('giris.yeniParola')}
                  value={yeniParola}
                  onChangeText={setYeniParola}
                  placeholder={t('giris.parolaEnAz')}
                  secureTextEntry
                  textContentType="newPassword"
                />
              </>
            ) : null}

            {bilgi !== null ? <Text style={stil.bilgi}>{bilgi}</Text> : null}
            <Hata metin={hata} />

            {sifirlama === 'kod-iste' ? (
              <AnaDugme
                etiket={t('giris.kodGonder')}
                onBas={koduIste}
                aktif={eposta.trim().length > 3 && bekliyor === null}
                bekliyor={bekliyor === 'form'}
              />
            ) : (
              <AnaDugme
                etiket={t('giris.parolayiDegistir')}
                onBas={parolayiDegistir}
                aktif={kod.length >= 4 && yeniParola.length >= 8 && bekliyor === null}
                bekliyor={bekliyor === 'form'}
              />
            )}

            <AnaDugme etiket={t('giris.vazgec')} onBas={sifirlamayiKapat} tur="cizgi" />
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const stil = StyleSheet.create({
  govde: { flex: 1, flexDirection: 'row', padding: 16, gap: 24, alignItems: 'center' },

  sol: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  oyunAdi: {
    color: renkler.vurgu,
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: 8,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },
  altBaslik: { color: renkler.metinSolgun, fontSize: 12, letterSpacing: 0.5 },
  misafirKutu: { width: 260, gap: 6, marginTop: 10 },
  ipucu: { color: renkler.metinSolgun, fontSize: 10, textAlign: 'center' },
  yasal: { flexDirection: 'row', gap: 14, marginTop: 8 },
  adres: { color: renkler.kenar, fontSize: 9 },

  sag: { width: 300, gap: 8 },
  baslik: { color: renkler.vurgu, fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  sekmeler: { flexDirection: 'row', gap: 6 },
  sekme: { flex: 1 },
  form: { gap: 8, paddingBottom: 8 },
  bilgi: { color: renkler.onay, fontSize: 11 },
  sozlesme: { color: renkler.metinSolgun, fontSize: 9, textAlign: 'center', lineHeight: 13 },
});
