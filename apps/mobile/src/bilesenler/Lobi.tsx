// Lobi — uygulamanin ilk ekrani.
//
// Masaya oturmanin bes yolu duruyor, ama artik hepsi ayni agirlikta degil:
//
//   HIZLI OYNA   — secmeden, en dolu acik masaya oturur (dolunca baslar)
//   MASA BUL     — acik masalari listeler, oyuncu kendi secer
//   ÖZEL MASA    — dort haneli kod uretir; listede GORUNMEZ, yalnizca kodla
//   KODLA KATIL  — arkadasinin ozel masa kodunu yaz, koltuguna otur
//   ALIŞTIRMA    — cevrimdisi, uc yer tutucu oyuncuyla, bu cihazda
//
// --- Tasarim kararlari -------------------------------------------------------
//
// ONCEKI HALI bes esit dugmeydi ve her birinin altinda bir aciklama satiri
// vardi. Sonuc: hepsi ayni derecede onemli gorunuyor, ekran metin doluyor ve
// oyuncu "hangisi?" diye duruyordu. Yeni duzen bir HIYERARSI kuruyor:
//
//   1. HIZLI OYNA tek basina, buyuk. Cogu oyuncunun istedigi bu.
//   2. MASA BUL ve ÖZEL MASA yan yana, ikincil.
//   3. Kodla katilma bir ALAN — dugme degil; zaten kod yazmadan basilamiyor.
//   4. ALIŞTIRMA en altta, cizgi dugme. Sunucu yokken calisan tek yol
//      oldugu icin duruyor ama gunluk yol degil.
//
// Aciklamalar dugmelerin ICINE, ikinci satira girdi: ayni bilgi, yarisi
// kadar dikey yer.
//
// SOL SUTUN artik bir kimlik panosu: avatar, ad, istatistik, arkadas kodu ve
// ARKADASLAR seridi. Arkadas seridi burada duruyor cunku tek isi var —
// arkadasin acik masasi varsa tek dokunusla oturmak. Kod paylasip yazmak,
// arkadas listesinin cozmesi gereken asil zahmetti.
//
// Acik/ozel ayrimi: yabanciyla oynamaya acik olan MASA BUL'a bakar, yalnizca
// arkadaslariyla oynayacak olan ozel masa acip kodu paylasir. Ozel masaya
// kodu bilmeyen hicbir yoldan giremez — listede hic gorunmuyor.
//
// Kod, ayni Wi-Fi kesfi yerine bilerek secildi (MIMARI.md §5): ayni odada da
// farkli sehirde de ayni sekilde calisir, hicbir ag iznine ihtiyac duymaz.
//
// ALIŞTIRMA neden duruyor: oyun dort kisi olmadan baslamiyor. Yeni bir
// uygulamada "hep birlikte cevrimici" demek, tek basina acan kisinin bos bir
// masada beklemesi demek — App Store denetcisi de dahil (Guideline 2.1/4.2).
// Sunucu coktugunde de tek calisan yol bu.

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
import { Alan, AnaDugme, Hata } from './Alan';
import { Avatar } from './Avatar';
import { useCeviri } from '../dil';
import type { ArkadasDurumu } from '../ag/api';
import type { OyuncuOzeti } from '../ag/protokol';
import { golge, renkler } from '../tema';

export interface LobiOzellikleri {
  readonly oyuncu: OyuncuOzeti | null;
  readonly bagli: boolean;
  readonly mesgul: boolean;
  readonly hata: string | null;
  /** Arkadas listesi; henuz cekilmediyse null. */
  readonly arkadaslar: ArkadasDurumu | null;
  readonly onHizli: () => void;
  readonly onMasaBul: () => void;
  readonly onMasaAc: () => void;
  readonly onKatil: (kod: string) => void;
  readonly onAlistirma: () => void;
  readonly onProfil: () => void;
}

/**
 * Lobinin ana eylem dugmesi: baslik + ikinci satirda tek cumlelik aciklama.
 *
 * Aciklamayi dugmenin ALTINA yazmak yerine icine almak, bes dugmelik listede
 * on satir metni bese indiriyor — asil kazanc dikey yerde.
 */
function MasaDugmesi({
  etiket,
  aciklama,
  onBas,
  aktif = true,
  buyuk = false,
}: {
  readonly etiket: string;
  readonly aciklama: string;
  readonly onBas: () => void;
  readonly aktif?: boolean;
  readonly buyuk?: boolean;
}) {
  return (
    <Pressable
      onPress={aktif ? onBas : undefined}
      style={({ pressed }) => [
        stil.eylem,
        buyuk && stil.eylemBuyuk,
        pressed && aktif && stil.eylemBasili,
        !aktif && stil.pasif,
      ]}
    >
      <Text style={[stil.eylemEtiket, buyuk && stil.eylemEtiketBuyuk]}>{etiket}</Text>
      <Text style={[stil.eylemAciklama, buyuk && stil.eylemAciklamaBuyuk]}>{aciklama}</Text>
    </Pressable>
  );
}

/**
 * Arkadas seridi.
 *
 * Yalnizca ACIK MASASI OLAN arkadaslar listeleniyor; "cevrimici arkadas
 * listesi" degil, "su an katilabilecegin masa" listesi. Sunucu zaten masasi
 * olmayana `masaKodu: null` veriyor, karar orada (arkadasServisi).
 */
function ArkadasSeridi({
  arkadaslar,
  aktif,
  onKatil,
  onProfil,
}: {
  readonly arkadaslar: ArkadasDurumu | null;
  readonly aktif: boolean;
  readonly onKatil: (kod: string) => void;
  readonly onProfil: () => void;
}) {
  const t = useCeviri();
  if (arkadaslar === null) return null;

  const masadakiler = arkadaslar.arkadaslar.filter((kisi) => kisi.masaKodu !== null);
  const gelenSayisi = arkadaslar.gelenIstekler.length;

  return (
    <View style={stil.arkadasKutu}>
      <Pressable onPress={onProfil} style={stil.arkadasBaslikSatiri} hitSlop={6}>
        <Text style={stil.bolumBaslik}>{t('lobi.arkadaslar')}</Text>
        {gelenSayisi > 0 ? (
          // Bekleyen istek gorunur olmali, yoksa profil ekranina girmeyen
          // oyuncu istegin geldigini hic ogrenmiyor.
          <View style={stil.rozet}>
            <Text style={stil.rozetYazi}>{t('lobi.istekRozeti', { sayi: gelenSayisi })}</Text>
          </View>
        ) : null}
      </Pressable>

      {masadakiler.length === 0 ? (
        <Text style={stil.arkadasBos}>
          {t(
            arkadaslar.arkadaslar.length === 0 ? 'lobi.arkadasYok' : 'lobi.acikMasaYok',
          )}
        </Text>
      ) : (
        masadakiler.slice(0, 3).map((kisi) => (
          <View key={kisi.id} style={stil.arkadasSatiri}>
            <Avatar ad={kisi.ad} boy={26} />
            <View style={stil.arkadasBilgi}>
              <Text style={stil.arkadasAd} numberOfLines={1}>
                {kisi.ad}
              </Text>
              <Text style={stil.arkadasMasa}>{t('lobi.masaKodu', { kod: kisi.masaKodu ?? '' })}</Text>
            </View>
            <Pressable
              onPress={aktif ? () => onKatil(kisi.masaKodu as string) : undefined}
              style={({ pressed }) => [
                stil.katilDugmesi,
                pressed && aktif && stil.eylemBasili,
                !aktif && stil.pasif,
              ]}
            >
              <Text style={stil.katilYazi}>{t('lobi.katil')}</Text>
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}

export function Lobi({
  oyuncu,
  bagli,
  mesgul,
  hata,
  arkadaslar,
  onHizli,
  onMasaBul,
  onMasaAc,
  onKatil,
  onAlistirma,
  onProfil,
}: LobiOzellikleri) {
  const [kod, setKod] = useState('');
  const t = useCeviri();
  const kodTamam = kod.trim().length >= 3;
  const hazir = bagli && !mesgul;

  return (
    <KeyboardAvoidingView
      style={stil.govde}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={stil.sol}>
        <View style={stil.marka}>
          <Text style={stil.oyunAdi}>KÜT</Text>
          <Text style={stil.altBaslik}>{t('lobi.altBaslik')}</Text>
        </View>

        {/* Profil karti bir DUGME: hesap, arkadaslar ve ayarlar oraya
            baglaniyor. Ayri bir "HESAP" dugmesi tutmaktansa, oyuncunun
            zaten baktigi yeri tiklanabilir yapmak daha az yer kapliyor. */}
        <Pressable
          onPress={onProfil}
          style={({ pressed }) => [stil.profilKarti, pressed && stil.eylemBasili]}
        >
          <Avatar ad={oyuncu?.ad ?? '?'} boy={44} />
          <View style={stil.profilBilgi}>
            <Text style={stil.ad} numberOfLines={1}>
              {oyuncu?.ad ?? '—'}
            </Text>
            <Text style={stil.istatistik}>
              {oyuncu === null
                ? ''
                : t('lobi.istatistik', {
                    el: oyuncu.oynananEl,
                    galibiyet: oyuncu.kazanilanEl,
                  })}
            </Text>
          </View>
          <Text style={stil.profilOk}>›</Text>
        </Pressable>

        {oyuncu?.misafirMi === true ? (
          // Misafir hesabi cihaza bagli: uygulama silinirse ilerleme gider.
          // Bunu oyuncuya SOYLEMEK, sonradan sikayet almaktan iyi.
          <Text style={stil.uyari}>{t('lobi.misafirUyari')}</Text>
        ) : null}

        <ArkadasSeridi
          arkadaslar={arkadaslar}
          aktif={hazir}
          onKatil={onKatil}
          onProfil={onProfil}
        />

        <View style={stil.durumSatiri}>
          <View style={[stil.nokta, bagli ? stil.noktaAcik : stil.noktaKapali]} />
          <Text style={stil.durumYazi}>{t(bagli ? 'lobi.bagli' : 'lobi.baglaniyor')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={stil.sag} keyboardShouldPersistTaps="handled">
        <MasaDugmesi
          etiket={t('lobi.hizliOyna')}
          aciklama={t('lobi.hizliOynaAciklama')}
          onBas={onHizli}
          aktif={hazir}
          buyuk
        />

        <View style={stil.ikili}>
          <View style={stil.esit}>
            <MasaDugmesi
              etiket={t('lobi.masaBul')}
              aciklama={t('lobi.masaBulAciklama')}
              onBas={onMasaBul}
              aktif={hazir}
            />
          </View>
          <View style={stil.esit}>
            <MasaDugmesi
              etiket={t('lobi.ozelMasa')}
              aciklama={t('lobi.ozelMasaAciklama')}
              onBas={onMasaAc}
              aktif={hazir}
            />
          </View>
        </View>

        <View style={stil.katilKutu}>
          <Alan
            etiket={t('lobi.masaKoduAlani')}
            value={kod}
            onChangeText={(yazi) => setKod(yazi.toLocaleUpperCase('tr-TR'))}
            placeholder="4F7A"
            maxLength={8}
            autoCapitalize="characters"
            onSubmitEditing={kodTamam ? () => onKatil(kod) : undefined}
            returnKeyType="go"
          />
          <AnaDugme
            etiket={t('lobi.kodlaKatil')}
            onBas={() => onKatil(kod)}
            aktif={hazir && kodTamam}
            tur="sade"
          />
        </View>

        <Hata metin={hata} />

        <View style={stil.ayirici} />

        {/* Cevrimdisi: sunucu gerekmiyor, bu yuzden `bagli` sartina bakmiyor.
            Baglanti yokken calisan tek giris bu. */}
        <AnaDugme etiket={t('lobi.alistirma')} onBas={onAlistirma} tur="cizgi" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const stil = StyleSheet.create({
  govde: { flex: 1, flexDirection: 'row', padding: 16, gap: 20, alignItems: 'center' },

  // --- Sol sutun: kimlik ------------------------------------------------------
  sol: { flex: 1, gap: 10, maxWidth: 360 },
  marka: { alignItems: 'center', gap: 2 },
  oyunAdi: {
    color: renkler.vurgu,
    fontSize: 46,
    fontWeight: '900',
    letterSpacing: 8,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },
  altBaslik: { color: renkler.metinSolgun, fontSize: 11, letterSpacing: 0.5 },

  profilKarti: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: renkler.panelKoyu,
    borderWidth: 1,
    borderColor: renkler.kenar,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    ...golge.kart,
  },
  profilBilgi: { flex: 1, gap: 1 },
  profilOk: { color: renkler.metinSolgun, fontSize: 22, marginTop: -2 },
  ad: { color: renkler.metin, fontSize: 17, fontWeight: '800' },
  istatistik: { color: renkler.metinSolgun, fontSize: 11 },
  uyari: { color: renkler.uyari, fontSize: 10, lineHeight: 14 },

  // --- Arkadas seridi ---------------------------------------------------------
  arkadasKutu: {
    gap: 6,
    backgroundColor: renkler.panelKoyu,
    borderWidth: 1,
    borderColor: renkler.kenar,
    borderRadius: 14,
    padding: 11,
    ...golge.kart,
  },
  arkadasBaslikSatiri: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bolumBaslik: {
    color: renkler.metinSolgun,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  rozet: {
    backgroundColor: renkler.vurgu,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  rozetYazi: { color: '#2a2000', fontSize: 9, fontWeight: '900' },
  arkadasBos: { color: renkler.metinSolgun, fontSize: 10, lineHeight: 14 },
  arkadasSatiri: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arkadasBilgi: { flex: 1 },
  arkadasAd: { color: renkler.metin, fontSize: 12, fontWeight: '700' },
  arkadasMasa: { color: renkler.metinSolgun, fontSize: 10, letterSpacing: 0.6 },
  katilDugmesi: {
    backgroundColor: renkler.vurgu,
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  katilYazi: { color: '#2a2000', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },

  durumSatiri: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nokta: { width: 7, height: 7, borderRadius: 4 },
  noktaAcik: { backgroundColor: renkler.onay },
  noktaKapali: { backgroundColor: renkler.uyari },
  durumYazi: { color: renkler.metinSolgun, fontSize: 10 },

  // --- Sag sutun: oynama ------------------------------------------------------
  sag: { width: 320, gap: 8, paddingBottom: 10 },

  eylem: {
    backgroundColor: renkler.panel,
    borderWidth: 1,
    borderColor: renkler.kenar,
    borderRadius: 13,
    paddingVertical: 11,
    paddingHorizontal: 13,
    gap: 2,
    ...golge.kart,
  },
  eylemBuyuk: {
    backgroundColor: renkler.vurgu,
    borderColor: renkler.vurgu,
    paddingVertical: 16,
    ...golge.yukseltilmis,
  },
  eylemBasili: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  pasif: { opacity: 0.4 },
  eylemEtiket: { color: renkler.metin, fontSize: 13, fontWeight: '800', letterSpacing: 0.6 },
  eylemEtiketBuyuk: { color: '#2a2000', fontSize: 19, fontWeight: '900', letterSpacing: 1.2 },
  eylemAciklama: { color: renkler.metinSolgun, fontSize: 10 },
  eylemAciklamaBuyuk: { color: '#5a4712', fontSize: 11 },

  ikili: { flexDirection: 'row', gap: 8 },
  esit: { flex: 1 },
  katilKutu: { gap: 6, marginTop: 2 },
  ayirici: { height: 1, backgroundColor: renkler.kenar, marginVertical: 6 },
});
