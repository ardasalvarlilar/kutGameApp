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
import { SUNUCU_ADRESI } from '../ag/sunucu';
import { YASAL } from '../ag/yasal';
import { renkler } from '../tema';

type Sekme = 'giris' | 'kayit';
/** Parola sifirlama iki adim: once kod istenir, sonra yeni parola konur. */
type Sifirlama = 'kapali' | 'kod-iste' | 'kod-gir';

export function Giris() {
  const kimlik = useKimlik();
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
        setBilgi('Adres kayıtlıysa kod gönderildi. Gelen kutunu kontrol et.');
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
        <Text style={stil.altBaslik}>okey taşlarıyla · 4 oyuncu · 16 tur</Text>

        <View style={stil.misafirKutu}>
          <AnaDugme
            etiket="MİSAFİR OLARAK OYNA"
            onBas={misafirOyna}
            bekliyor={bekliyor === 'misafir'}
            aktif={bekliyor === null}
          />
          <Text style={stil.ipucu}>Hemen başla. Sonra hesap açarsan ilerlemen aynı kalır.</Text>
        </View>

        <View style={stil.yasal}>
          <Baglanti etiket="Gizlilik" adres={YASAL.gizlilik} />
          <Baglanti etiket="Koşullar" adres={YASAL.kosullar} />
          <Baglanti etiket="Destek" adres={YASAL.destek} />
        </View>
        <Text style={stil.adres} numberOfLines={1}>
          sunucu: {SUNUCU_ADRESI.replace(/^https?:\/\//, '')}
        </Text>
      </View>

      <View style={stil.sag}>
        {sifirlama === 'kapali' ? (
          <>
            <View style={stil.sekmeler}>
              {(['giris', 'kayit'] as const).map((secenek) => (
                <View key={secenek} style={stil.sekme}>
                  <AnaDugme
                    etiket={secenek === 'giris' ? 'GİRİŞ YAP' : 'HESAP AÇ'}
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
                  etiket="Görünen ad"
                  value={ad}
                  onChangeText={setAd}
                  placeholder="Masada bu ad görünecek"
                  autoCapitalize="words"
                  maxLength={24}
                />
              ) : null}

              <Alan
                etiket="E-posta"
                value={eposta}
                onChangeText={setEposta}
                placeholder="ornek@eposta.com"
                keyboardType="email-address"
                textContentType="emailAddress"
              />
              <Alan
                etiket="Parola"
                value={parola}
                onChangeText={setParola}
                placeholder={sekme === 'kayit' ? 'En az 8 karakter' : '••••••••'}
                secureTextEntry
                // iOS'un parola yoneticisi dogru alani tanisin diye ayri ipucu.
                textContentType={sekme === 'kayit' ? 'newPassword' : 'password'}
                onSubmitEditing={formTamam ? formuGonder : undefined}
                returnKeyType="go"
              />

              <Hata metin={hata} />

              <AnaDugme
                etiket={sekme === 'giris' ? 'GİRİŞ YAP' : 'HESABI OLUŞTUR'}
                onBas={formuGonder}
                aktif={formTamam && bekliyor === null}
                bekliyor={bekliyor === 'form'}
              />

              {sekme === 'giris' ? (
                <Baglanti
                  etiket="Parolamı unuttum"
                  onBas={() => {
                    setSifirlama('kod-iste');
                    setHata(null);
                  }}
                  ortala
                />
              ) : (
                <Text style={stil.sozlesme}>
                  Hesap açarak Kullanım Koşulları'nı ve Gizlilik Politikası'nı kabul etmiş
                  olursun.
                </Text>
              )}
            </ScrollView>
          </>
        ) : (
          <ScrollView contentContainerStyle={stil.form} keyboardShouldPersistTaps="handled">
            <Text style={stil.baslik}>PAROLA SIFIRLAMA</Text>

            <Alan
              etiket="E-posta"
              value={eposta}
              onChangeText={setEposta}
              placeholder="ornek@eposta.com"
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={sifirlama === 'kod-iste'}
            />

            {sifirlama === 'kod-gir' ? (
              <>
                <Alan
                  etiket="E-postana gelen kod"
                  value={kod}
                  onChangeText={(yazi) => setKod(yazi.replace(/\D/g, ''))}
                  placeholder="6 hane"
                  keyboardType="number-pad"
                  maxLength={6}
                  // iOS kodu klavye ustunde onersin diye.
                  textContentType="oneTimeCode"
                />
                <Alan
                  etiket="Yeni parola"
                  value={yeniParola}
                  onChangeText={setYeniParola}
                  placeholder="En az 8 karakter"
                  secureTextEntry
                  textContentType="newPassword"
                />
              </>
            ) : null}

            {bilgi !== null ? <Text style={stil.bilgi}>{bilgi}</Text> : null}
            <Hata metin={hata} />

            {sifirlama === 'kod-iste' ? (
              <AnaDugme
                etiket="KOD GÖNDER"
                onBas={koduIste}
                aktif={eposta.trim().length > 3 && bekliyor === null}
                bekliyor={bekliyor === 'form'}
              />
            ) : (
              <AnaDugme
                etiket="PAROLAYI DEĞİŞTİR"
                onBas={parolayiDegistir}
                aktif={kod.length >= 4 && yeniParola.length >= 8 && bekliyor === null}
                bekliyor={bekliyor === 'form'}
              />
            )}

            <AnaDugme etiket="VAZGEÇ" onBas={sifirlamayiKapat} tur="cizgi" />
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const stil = StyleSheet.create({
  govde: { flex: 1, flexDirection: 'row', padding: 16, gap: 24, alignItems: 'center' },

  sol: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  oyunAdi: { color: renkler.vurgu, fontSize: 56, fontWeight: '900', letterSpacing: 8 },
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
