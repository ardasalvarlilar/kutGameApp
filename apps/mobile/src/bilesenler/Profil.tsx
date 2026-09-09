// Profil — hesap, arkadaslar ve ayarlar tek ekranda.
//
// Eskiden burada `Hesap.tsx` vardi: ad degistirme, engel listesi ve hesap
// silme alt alta duran tek bir liste. Arkadaslik gelince o liste artik
// tasimiyordu; ikinci bir ekran acmak yerine ayni ekrani UC SEKMEYE ayirdik:
//
//   PROFİL     — kim oldugun: ad, e-posta, arkadas kodu, istatistik
//   ARKADAŞLAR — liste, istekler, kodla ekleme (bilesenler/Arkadaslar.tsx)
//   AYARLAR    — ad, parola, engelliler, yasal, cikis, hesap silme
//
// Ayrimin olcutu "ne kadar sik bakilir": profil ve arkadaslar sik, ayarlar
// nadir. Ayarlarin en altinda duran GERI DONUSU OLMAYAN islemler (cikis,
// hesap silme) boylece gunluk akisin disinda kaliyor.
//
// App Store'un aradigi uc sey burada ve YERI DEGISMEDI:
//   ad degistirme  → uygunsuz ad sikayeti gelirse oyuncu duzeltebilsin
//   engel listesi  → 1.2, "engellediklerini gorup geri alabilme"
//   HESAP SILME    → 5.1.1(v), hesap acan her uygulama icin ZORUNLU
//
// Silme iki adimli: tek dokunusla silinen bir hesap, yanlislikla basmanin
// geri donusu olmayan hali demek. Onay ekraninda ne kaybedilecegi yaziyor.

import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Alan, AnaDugme, Baglanti, Hata } from './Alan';
import { Arkadaslar } from './Arkadaslar';
import { Avatar } from './Avatar';
import { useKimlik } from '../ag/kimlik';
import { DILLER, DIL_ADLARI, useCeviri, useDil, type MetinAnahtari } from '../dil';
import { YASAL } from '../ag/yasal';
import { golge, renkler } from '../tema';

type Sekme = 'profil' | 'arkadaslar' | 'ayarlar';

const SEKME_ANAHTARLARI: Record<Sekme, MetinAnahtari> = {
  profil: 'profil.sekmeProfil',
  arkadaslar: 'profil.sekmeArkadaslar',
  ayarlar: 'profil.sekmeAyarlar',
};

export interface ProfilOzellikleri {
  readonly onKapat: () => void;
  /** Arkadasin masasina katilma — lobiye donup kodla oturuyor. */
  readonly onMasayaKatil: (kod: string) => void;
  /** Acilista hangi sekme? Lobideki "istek var" rozetinden gelirken arkadaslar. */
  readonly baslangicSekmesi?: Sekme;
}

export function Profil({
  onKapat,
  onMasayaKatil,
  baslangicSekmesi = 'profil',
}: ProfilOzellikleri) {
  const kimlik = useKimlik();
  const t = useCeviri();
  const oyuncu = kimlik.oyuncu;

  const [sekme, setSekme] = useState<Sekme>(baslangicSekmesi);
  const [silmeOnayi, setSilmeOnayi] = useState(false);

  const gelenSayisi = kimlik.arkadaslar?.gelenIstekler.length ?? 0;
  // Kod hesap ozetinde bos olabilir (sunucuda TEMBEL uretiliyor); arkadas
  // listesi cekildiginde dolu geliyor.
  const kodum = kimlik.arkadaslar?.kodum ?? oyuncu?.arkadasKodu ?? null;

  if (silmeOnayi) {
    return <SilmeOnayi onVazgec={() => setSilmeOnayi(false)} />;
  }

  return (
    <KeyboardAvoidingView
      style={stil.govde}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* --- Sol: kimlik ozeti + sekme rayi ------------------------------- */}
      <View style={stil.sol}>
        <View style={stil.kimlik}>
          <Avatar ad={oyuncu?.ad ?? '?'} boy={52} />
          <View style={stil.kimlikBilgi}>
            <Text style={stil.ad} numberOfLines={1}>
              {oyuncu?.ad ?? '—'}
            </Text>
            <Text style={stil.satir} numberOfLines={1}>
              {oyuncu?.eposta ?? t('profil.misafirHesabi')}
            </Text>
            {kodum !== null ? <Text style={stil.kod}>{kodum}</Text> : null}
          </View>
        </View>

        <View style={stil.ray}>
          {(['profil', 'arkadaslar', 'ayarlar'] as const).map((secenek) => (
            <Pressable
              key={secenek}
              onPress={() => setSekme(secenek)}
              style={({ pressed }) => [
                stil.raySekmesi,
                sekme === secenek && stil.raySekmesiAcik,
                pressed && stil.basili,
              ]}
            >
              <Text style={[stil.rayYazi, sekme === secenek && stil.rayYaziAcik]}>
                {t(SEKME_ANAHTARLARI[secenek])}
              </Text>
              {secenek === 'arkadaslar' && gelenSayisi > 0 ? (
                <View style={stil.rozet}>
                  <Text style={stil.rozetYazi}>{gelenSayisi}</Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>

        <View style={stil.solAlt}>
          <AnaDugme etiket={t('profil.lobiyeDon')} onBas={onKapat} tur="sade" />
        </View>
      </View>

      {/* --- Sag: secili sekme -------------------------------------------- */}
      <View style={stil.sag}>
        {sekme === 'profil' ? <ProfilSekmesi /> : null}
        {sekme === 'arkadaslar' ? <Arkadaslar onMasayaKatil={onMasayaKatil} /> : null}
        {sekme === 'ayarlar' ? <AyarlarSekmesi onSil={() => setSilmeOnayi(true)} /> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

// --- PROFİL sekmesi ----------------------------------------------------------

function Kutucuk({ deger, etiket }: { readonly deger: number; readonly etiket: string }) {
  return (
    <View style={stil.kutucuk}>
      <Text style={stil.kutucukDeger}>{deger}</Text>
      <Text style={stil.kutucukEtiket}>{etiket}</Text>
    </View>
  );
}

function ProfilSekmesi() {
  const kimlik = useKimlik();
  const t = useCeviri();
  const oyuncu = kimlik.oyuncu;
  if (oyuncu === null) return null;

  return (
    <ScrollView contentContainerStyle={stil.icerik}>
      <Text style={stil.bolum}>{t('profil.istatistik')}</Text>
      <View style={stil.kutucukSirasi}>
        <Kutucuk deger={oyuncu.oynananEl} etiket={t('profil.el')} />
        <Kutucuk deger={oyuncu.kazanilanEl} etiket={t('profil.elGalibiyeti')} />
        <Kutucuk deger={oyuncu.oynananMac} etiket={t('profil.mac')} />
        <Kutucuk deger={oyuncu.kazanilanMac} etiket={t('profil.macGalibiyeti')} />
      </View>

      {oyuncu.misafirMi ? (
        <View style={stil.uyariKutusu}>
          <Text style={stil.uyariBaslik}>{t('profil.misafirBaslik')}</Text>
          <Text style={stil.uyariMetin}>{t('profil.misafirMetin')}</Text>
        </View>
      ) : null}

      <Text style={stil.bolum}>{t('profil.arkadasKodun')}</Text>
      <Text style={stil.aciklama}>{t('profil.kodAciklama')}</Text>
      <Text style={stil.kodBuyuk} selectable>
        {kimlik.arkadaslar?.kodum ?? oyuncu.arkadasKodu ?? '…'}
      </Text>
    </ScrollView>
  );
}

// --- AYARLAR sekmesi ---------------------------------------------------------

function AyarlarSekmesi({ onSil }: { readonly onSil: () => void }) {
  const kimlik = useKimlik();
  const { dil, diliDegistir, t } = useDil();
  const oyuncu = kimlik.oyuncu;

  const [ad, setAd] = useState(oyuncu?.ad ?? '');
  const [mevcutParola, setMevcutParola] = useState('');
  const [yeniParola, setYeniParola] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  async function calistir(is: () => Promise<string | null>, basarili?: string): Promise<void> {
    setBekliyor(true);
    setHata(null);
    setBilgi(null);
    const sorun = await is();
    setBekliyor(false);
    if (sorun !== null) setHata(sorun);
    else if (basarili !== undefined) setBilgi(basarili);
  }

  const parolaTamam = mevcutParola.length >= 1 && yeniParola.length >= 8;

  return (
    <ScrollView contentContainerStyle={stil.icerik} keyboardShouldPersistTaps="handled">
      <Text style={stil.bolum}>{t('profil.gorunenAd')}</Text>
      <Alan
        etiket={t('profil.ad')}
        value={ad}
        onChangeText={setAd}
        maxLength={24}
        autoCapitalize="words"
      />
      <AnaDugme
        etiket={t('profil.adiKaydet')}
        onBas={() => void calistir(() => kimlik.adiDegistir(ad), t('profil.adGuncellendi'))}
        aktif={ad.trim().length >= 2 && ad.trim() !== oyuncu?.ad && !bekliyor}
        bekliyor={bekliyor}
      />

      {/* Parola yalnizca e-posta hesabinda: misafirin degistirecek parolasi
          yok, alani gostermek "neden calismiyor" sorusu uretirdi. */}
      {oyuncu !== null && !oyuncu.misafirMi ? (
        <>
          <Text style={stil.bolum}>{t('profil.parola')}</Text>
          <Text style={stil.aciklama}>{t('profil.parolaAciklama')}</Text>
          <Alan
            etiket={t('profil.mevcutParola')}
            value={mevcutParola}
            onChangeText={setMevcutParola}
            secureTextEntry
            maxLength={72}
          />
          <Alan
            etiket={t('profil.yeniParola')}
            value={yeniParola}
            onChangeText={setYeniParola}
            secureTextEntry
            maxLength={72}
          />
          <AnaDugme
            etiket={t('profil.parolayiDegistir')}
            onBas={() =>
              void calistir(async () => {
                const sorun = await kimlik.parolayiDegistir(mevcutParola, yeniParola);
                if (sorun === null) {
                  setMevcutParola('');
                  setYeniParola('');
                }
                return sorun;
              }, t('profil.parolaDegisti'))
            }
            aktif={parolaTamam && !bekliyor}
            bekliyor={bekliyor}
          />
        </>
      ) : null}

      <Text style={stil.bolum}>{t('profil.engelledikerin')}</Text>
      {kimlik.engellenenler.length === 0 ? (
        <Text style={stil.aciklama}>{t('profil.kimseyiEngellemedin')}</Text>
      ) : (
        kimlik.engellenenler.map((kisi) => (
          <View key={kisi.id} style={stil.engelSatiri}>
            <Avatar ad={kisi.ad} boy={26} />
            <Text style={stil.engelAd} numberOfLines={1}>
              {kisi.ad}
            </Text>
            <View style={stil.engelDugmesi}>
              <AnaDugme
                etiket={t('profil.kaldir')}
                onBas={() => void calistir(() => kimlik.engelKaldir(kisi.id))}
                tur="sade"
              />
            </View>
          </View>
        ))
      )}

      {bilgi !== null ? <Text style={stil.bilgi}>{bilgi}</Text> : null}
      <Hata metin={hata} />

      <Text style={stil.bolum}>{t('profil.dil')}</Text>
      <Text style={stil.aciklama}>{t('profil.dilAciklama')}</Text>
      <View style={stil.dilSatiri}>
        {DILLER.map((secenek) => (
          <View key={secenek} style={stil.esit}>
            <AnaDugme
              etiket={DIL_ADLARI[secenek]}
              onBas={() => diliDegistir(secenek)}
              tur={dil === secenek ? 'vurgu' : 'cizgi'}
            />
          </View>
        ))}
      </View>

      <Text style={stil.bolum}>{t('profil.yasal')}</Text>
      <View style={stil.yasal}>
        <Baglanti etiket={t('profil.gizlilik')} adres={YASAL.gizlilik} />
        <Baglanti etiket={t('profil.kosullar')} adres={YASAL.kosullar} />
        <Baglanti etiket={t('profil.destek')} adres={YASAL.destek} />
      </View>

      {/* Geri donusu olmayan islemler en altta ve ayri: yanlislikla basilan
          bir dugmenin diger dugmelere benzemesi kotu bir fikir. */}
      <View style={stil.tehlikeBolgesi}>
        <AnaDugme etiket={t('profil.cikisYap')} onBas={() => void kimlik.cikisYap()} tur="cizgi" />
        {/* App Store 5.1.1(v): hesap uygulamanin ICINDEN silinebilmeli.
            "Bize e-posta at" yetmiyor, denetimde ret sebebi. */}
        <AnaDugme etiket={t('profil.hesabimiSil')} onBas={onSil} tur="tehlike" />
      </View>
    </ScrollView>
  );
}

// --- Hesap silme onayi -------------------------------------------------------

function SilmeOnayi({ onVazgec }: { readonly onVazgec: () => void }) {
  const kimlik = useKimlik();
  const t = useCeviri();
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  async function sil(): Promise<void> {
    setBekliyor(true);
    setHata(null);
    const sorun = await kimlik.hesabiSil();
    setBekliyor(false);
    if (sorun !== null) setHata(sorun);
  }

  return (
    <View style={stil.onayGovde}>
      <View style={stil.onayKutu}>
        <Text style={stil.onayBaslik}>{t('profil.silmeBaslik')}</Text>
        <Text style={stil.onayMetin}>{t('profil.silmeMetin')}</Text>
        <Text style={stil.onayUyari}>{t('profil.silmeUyari')}</Text>
        <Hata metin={hata} />
        <View style={stil.onayDugmeler}>
          <View style={stil.esit}>
            <AnaDugme etiket={t('profil.vazgec')} onBas={onVazgec} tur="sade" />
          </View>
          <View style={stil.esit}>
            <AnaDugme
              etiket={t('profil.evetSil')}
              onBas={() => void sil()}
              bekliyor={bekliyor}
              tur="tehlike"
            />
          </View>
        </View>
        <Baglanti etiket={t('profil.silmeAyrinti')} adres={YASAL.hesapSilme} ortala />
      </View>
    </View>
  );
}

const stil = StyleSheet.create({
  govde: { flex: 1, flexDirection: 'row', padding: 16, gap: 18 },

  // --- Sol sutun --------------------------------------------------------------
  sol: { width: 250, gap: 10 },
  kimlik: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kimlikBilgi: { flex: 1, gap: 1 },
  ad: { color: renkler.metin, fontSize: 19, fontWeight: '800' },
  satir: { color: renkler.metinSolgun, fontSize: 10 },
  kod: { color: renkler.vurgu, fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  ray: { gap: 4, marginTop: 4 },
  raySekmesi: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 9,
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  raySekmesiAcik: { backgroundColor: renkler.panel, borderColor: renkler.kenar, ...golge.kart },
  basili: { opacity: 0.7 },
  rayYazi: { flex: 1, color: renkler.metinSolgun, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  rayYaziAcik: { color: renkler.vurgu },
  rozet: { backgroundColor: renkler.vurgu, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  rozetYazi: { color: '#2a2000', fontSize: 9, fontWeight: '900' },

  solAlt: { marginTop: 'auto' },

  // --- Sag sutun --------------------------------------------------------------
  sag: { flex: 1 },
  icerik: { gap: 7, paddingBottom: 16, paddingRight: 4 },
  bolum: {
    color: renkler.metinSolgun,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 10,
  },
  aciklama: { color: renkler.metinSolgun, fontSize: 10, lineHeight: 14 },
  bilgi: { color: renkler.onay, fontSize: 11 },

  kutucukSirasi: { flexDirection: 'row', gap: 6 },
  kutucuk: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: renkler.panelKoyu,
    borderWidth: 1,
    borderColor: renkler.kenar,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 2,
    ...golge.kart,
  },
  kutucukDeger: { color: renkler.metin, fontSize: 20, fontWeight: '900' },
  kutucukEtiket: { color: renkler.metinSolgun, fontSize: 8, fontWeight: '800', letterSpacing: 0.6 },

  kodBuyuk: { color: renkler.vurgu, fontSize: 26, fontWeight: '900', letterSpacing: 3 },

  uyariKutusu: {
    backgroundColor: renkler.panelKoyu,
    borderWidth: 1,
    borderColor: renkler.uyari,
    borderRadius: 10,
    padding: 10,
    gap: 3,
    marginTop: 10,
  },
  uyariBaslik: { color: renkler.uyari, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  uyariMetin: { color: renkler.metin, fontSize: 11, lineHeight: 15 },

  engelSatiri: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: renkler.panel,
    borderWidth: 1,
    borderColor: renkler.kenar,
    borderRadius: 9,
    paddingLeft: 8,
    paddingVertical: 4,
    paddingRight: 4,
  },
  engelAd: { flex: 1, color: renkler.metin, fontSize: 12, fontWeight: '700' },
  engelDugmesi: { width: 92 },

  yasal: { flexDirection: 'row', gap: 14 },
  tehlikeBolgesi: {
    gap: 6,
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: renkler.kenar,
    paddingTop: 12,
  },

  // --- Silme onayi ------------------------------------------------------------
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
    borderRadius: 14,
    padding: 18,
    ...golge.yukseltilmis,
  },
  onayBaslik: { color: renkler.uyari, fontSize: 15, fontWeight: '900', letterSpacing: 0.8 },
  onayMetin: { color: renkler.metin, fontSize: 12, lineHeight: 17 },
  onayUyari: { color: renkler.uyari, fontSize: 12, fontWeight: '800' },
  onayDugmeler: { flexDirection: 'row', gap: 8, marginTop: 4 },
  esit: { flex: 1 },
  dilSatiri: { flexDirection: 'row', gap: 8 },
});
