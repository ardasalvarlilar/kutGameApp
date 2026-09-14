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
// Duzen bir HIYERARSI kuruyor, eskisinden farkli bir GORUNUMLE:
//
//   1. Ust bar: kimlik (avatar, ad, seviye + XP cubugu, baglanti durumu)
//      solda; sagda cip bakiyesi (dokununca magaza) ve AYARLAR.
//   2. Sol serit: arkadas seridi (acik masasi olan arkadaslar) ve ogretici
//      banner'i. Ikisi de tek dokunusla bir yere goturuyor.
//   3. Orta: yatay kaydirilan renkli kartlar — MASA BUL, ÖZEL MASA,
//      KODLA KATIL, ALIŞTIRMA. HIZLI OYNA burada degil, cunku o tek basina
//      en onemli eylem.
//   4. Alt bar: HIZLI OYNA tek, buyuk, ortada — cogu oyuncunun istedigi bu.
//
// SOL SERIT hala bir kimlik panosu: arkadas seridi burada duruyor cunku tek
// isi var — arkadasin acik masasi varsa tek dokunusla oturmak. Kod paylasip
// yazmak, arkadas listesinin cozmesi gereken asil zahmetti.
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
import { seviyeIlerlemesi } from '@kut/ekonomi';
import { Alan, AnaDugme, Hata } from './Alan';
import { Avatar } from './Avatar';
import { useCeviri } from '../dil';
import type { ArkadasDurumu } from '../ag/api';
import type { OyuncuOzeti } from '../ag/protokol';
import { cipKisa } from '../cip';
import { golge, renkler, tasRenkleri, okeyRengi } from '../tema';

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
  /** Ogreticiyi dogrudan baslatir — ilk giristeki soruyu atlayarak. */
  readonly onOgretici: () => void;
  readonly onProfil: () => void;
  readonly onMagaza: () => void;
}

/** Seviye rozetinin altindaki ince cubuk: bu seviyede biriken XP. */
function XpCubugu({ deneyim }: { readonly deneyim: number }) {
  const { buSeviyede, gereken } = seviyeIlerlemesi(deneyim);
  const oran = gereken === null ? 1 : buSeviyede / gereken;
  return (
    <View style={stil.xpCubuk}>
      <View style={[stil.xpDolu, { width: `${Math.round(oran * 100)}%` }]} />
    </View>
  );
}

/**
 * Orta siradaki renkli eylem karti: baslik + aciklama, tek dokunuslu.
 *
 * `renk` yalnizca ustteki serit ve dugmeyi boyuyor — kartlar birbirinden bu
 * sekilde ayirt ediliyor, aksi halde dort kart da ayni gri kutu olurdu.
 */
function ModKarti({
  etiket,
  aciklama,
  simge,
  onBas,
  aktif = true,
  renk,
  dolu = true,
}: {
  readonly etiket: string;
  readonly aciklama: string;
  /** Kartin ortasini dolduran buyuk, soluk sembol — resim olmadigi icin. */
  readonly simge: string;
  readonly onBas: () => void;
  readonly aktif?: boolean;
  readonly renk: string;
  /** false ise dugme dolu degil, cizgili — ALIŞTIRMA gibi ikincil eylemler icin. */
  readonly dolu?: boolean;
}) {
  return (
    <Pressable
      onPress={aktif ? onBas : undefined}
      style={({ pressed }) => [
        stil.kart,
        pressed && aktif && stil.eylemBasili,
        !aktif && stil.pasif,
      ]}
    >
      <View style={[stil.kartSerit, { backgroundColor: renk }]} />
      <View style={stil.kartGovde}>
        <View>
          <Text style={stil.kartBaslik}>{etiket}</Text>
          <Text style={stil.kartAciklama}>{aciklama}</Text>
        </View>
        <Text style={[stil.kartSimge, { color: renk }]}>{simge}</Text>
      </View>
      <View
        style={[
          stil.kartDugme,
          dolu ? { backgroundColor: renk } : [stil.kartDugmeCizgi, { borderColor: renk }],
        ]}
      >
        <Text style={[stil.kartDugmeYazi, dolu ? stil.kartDugmeYaziDolu : { color: renk }]}>
          {etiket}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Arkadas seridi.
 *
 * Yalnizca ACIK MASASI OLAN arkadaslar listeleniyor; "kim cevrimici"
 * degil "hangi masaya oturabilirim" sorusunu cevapliyor. Sunucu zaten masasi
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
            <Avatar ad={kisi.ad} boy={24} />
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
  onOgretici,
  onProfil,
  onMagaza,
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
      {/* --- Ust bar: kimlik + ayarlar ------------------------------------- */}
      <View style={stil.ustBar}>
        <View style={stil.marka}>
          <Text style={stil.oyunAdi}>KÜT</Text>
          <Text style={stil.altBaslik} numberOfLines={1}>
            {t('lobi.altBaslik')}
          </Text>
        </View>

        <Pressable
          onPress={onProfil}
          style={({ pressed }) => [stil.profilKarti, pressed && stil.eylemBasili]}
        >
          <Avatar ad={oyuncu?.ad ?? '?'} boy={38} />
          <View style={stil.profilBilgi}>
            <View style={stil.profilAdSatiri}>
              <Text style={stil.ad} numberOfLines={1}>
                {oyuncu?.ad ?? '—'}
              </Text>
              {oyuncu !== null ? (
                <View style={stil.seviyeRozeti}>
                  <Text style={stil.seviyeYazi}>
                    {t('lobi.seviyeKisa', { seviye: oyuncu.seviye })}
                  </Text>
                </View>
              ) : null}
            </View>
            {oyuncu !== null ? <XpCubugu deneyim={oyuncu.deneyim} /> : null}
            <View style={stil.durumSatiri}>
              <View style={[stil.nokta, bagli ? stil.noktaAcik : stil.noktaKapali]} />
              <Text style={stil.durumYazi}>{t(bagli ? 'lobi.bagli' : 'lobi.baglaniyor')}</Text>
            </View>
          </View>
        </Pressable>

        <View style={stil.ustBosluk} />

        {/* Cip bakiyesi. Kisa bicimde ("1,5M"): tam sayi kademe secimi ve
            magazada yaziyor, burada yer dar. */}
        <Pressable
          onPress={onMagaza}
          hitSlop={6}
          style={({ pressed }) => [stil.cipHapi, pressed && stil.eylemBasili]}
        >
          <View style={stil.cipDaire} />
          <Text style={stil.cipYazi}>{cipKisa(oyuncu?.cip ?? 0)}</Text>
          <View style={stil.cipArti}>
            <Text style={stil.cipArtiYazi}>+</Text>
          </View>
        </Pressable>

        <Pressable
          onPress={onProfil}
          hitSlop={8}
          style={({ pressed }) => [stil.ayarlarDugmesi, pressed && stil.eylemBasili]}
        >
          <Text style={stil.ayarlarYazi}>⚙</Text>
        </Pressable>
      </View>

      {oyuncu?.misafirMi === true ? (
        // Misafir hesabi cihaza bagli: uygulama silinirse ilerleme gider.
        // Bunu oyuncuya SOYLEMEK, sonradan sikayet almaktan iyi.
        <Text style={stil.uyari}>{t('lobi.misafirUyari')}</Text>
      ) : null}

      {/* --- Orta: sol serit + kartlar --------------------------------------- */}
      <View style={stil.orta}>
        <View style={stil.sol}>
          <ArkadasSeridi
            arkadaslar={arkadaslar}
            aktif={hazir}
            onKatil={onKatil}
            onProfil={onProfil}
          />

          <Pressable
            onPress={onOgretici}
            style={({ pressed }) => [stil.banner, pressed && stil.eylemBasili]}
          >
            <View>
              <Text style={stil.bannerBaslik}>{t('lobi.ogreticiBaslat')}</Text>
              <Text style={stil.bannerAciklama}>{t('lobi.ogreticiIpucu')}</Text>
            </View>
            <Text style={stil.bannerSimge}>📖</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={stil.kartSatiri}
        >
          <ModKarti
            etiket={t('lobi.masaBul')}
            aciklama={t('lobi.masaBulAciklama')}
            simge="🔍"
            onBas={onMasaBul}
            aktif={hazir}
            renk={tasRenkleri.mavi}
          />

          <ModKarti
            etiket={t('lobi.ozelMasa')}
            aciklama={t('lobi.ozelMasaAciklama')}
            simge="🔒"
            onBas={onMasaAc}
            aktif={hazir}
            renk={okeyRengi}
          />

          <View style={stil.katilKart}>
            <View style={[stil.kartSerit, { backgroundColor: renkler.vurgu }]} />
            <View style={stil.katilKartGovde}>
              <Text style={stil.kartBaslik}>{t('lobi.kodlaKatil')}</Text>
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
          </View>

          <ModKarti
            etiket={t('lobi.alistirma')}
            aciklama={t('lobi.alistirmaAciklama')}
            simge="🤖"
            onBas={onAlistirma}
            renk={renkler.metinSolgun}
            dolu={false}
          />
        </ScrollView>
      </View>

      <Hata metin={hata} />

      {/* --- Alt bar: tek buyuk eylem ---------------------------------------- */}
      <View style={stil.altBar}>
        <Pressable
          onPress={hazir ? onHizli : undefined}
          style={({ pressed }) => [
            stil.hizliPill,
            pressed && hazir && stil.eylemBasili,
            !hazir && stil.pasif,
          ]}
        >
          <Text style={stil.hizliPillYazi}>{t('lobi.hizliOyna')}</Text>
          <Text style={stil.hizliPillAlt}>{t('lobi.hizliOynaAciklama')}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const stil = StyleSheet.create({
  govde: { flex: 1, padding: 12, gap: 8 },

  // --- Ust bar -----------------------------------------------------------
  ustBar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  marka: { alignItems: 'flex-start', gap: 0, marginRight: 4 },
  oyunAdi: {
    color: renkler.vurgu,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
  altBaslik: { color: renkler.metinSolgun, fontSize: 8, letterSpacing: 0.3, maxWidth: 110 },

  profilKarti: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: renkler.panelKoyu,
    borderWidth: 1,
    borderColor: renkler.kenar,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    ...golge.kart,
  },
  profilBilgi: { gap: 2 },
  profilAdSatiri: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ad: { color: renkler.metin, fontSize: 13, fontWeight: '800', maxWidth: 130 },
  seviyeRozeti: {
    backgroundColor: renkler.vurguKoyu,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  seviyeYazi: { color: renkler.vurgu, fontSize: 9, fontWeight: '800' },
  uyari: { color: renkler.uyari, fontSize: 10, lineHeight: 13 },

  durumSatiri: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  nokta: { width: 6, height: 6, borderRadius: 3 },
  noktaAcik: { backgroundColor: renkler.onay },
  noktaKapali: { backgroundColor: renkler.uyari },
  durumYazi: { color: renkler.metinSolgun, fontSize: 9 },

  ustBosluk: { flex: 1 },

  xpCubuk: {
    height: 3,
    width: 90,
    borderRadius: 2,
    backgroundColor: renkler.arkaKoyu,
    overflow: 'hidden',
  },
  xpDolu: { height: '100%', backgroundColor: renkler.vurgu },

  cipHapi: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingLeft: 5,
    paddingRight: 4,
    borderRadius: 15,
    backgroundColor: renkler.panelKoyu,
    borderWidth: 1,
    borderColor: renkler.vurguKoyu,
  },
  cipDaire: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: renkler.vurgu,
    borderWidth: 3,
    borderColor: renkler.vurguKoyu,
  },
  cipYazi: { color: renkler.vurgu, fontSize: 13, fontWeight: '900', minWidth: 34 },
  cipArti: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: renkler.onay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cipArtiYazi: { color: '#0b2717', fontSize: 14, fontWeight: '900', marginTop: -1 },

  ayarlarDugmesi: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: renkler.panelKoyu,
    borderWidth: 1,
    borderColor: renkler.kenar,
  },
  ayarlarYazi: { color: renkler.metinSolgun, fontSize: 16 },

  // --- Orta: sol serit + kartlar -------------------------------------------
  // `alignItems: 'center'` olmasa sol serit ve kartlar `orta`nin (flex:1)
  // butun yuksekligine gerilirdi — ekranin cogunu kaplayan devasa kutular
  // buradan geliyordu. Kartlarin boyu artik SABIT (`kart`/`katilKart`);
  // dikeyde ortalanmalari, ustte/altta kalan bosluk esit dagilsin diye.
  orta: { flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center' },

  sol: { width: 160, gap: 6 },

  arkadasKutu: {
    gap: 5,
    backgroundColor: renkler.panelKoyu,
    borderWidth: 1,
    borderColor: renkler.kenar,
    borderRadius: 12,
    padding: 9,
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
  arkadasBos: { color: renkler.metinSolgun, fontSize: 10, lineHeight: 13 },
  arkadasSatiri: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  arkadasBilgi: { flex: 1 },
  arkadasAd: { color: renkler.metin, fontSize: 11, fontWeight: '700' },
  arkadasMasa: { color: renkler.metinSolgun, fontSize: 9, letterSpacing: 0.4 },
  katilDugmesi: {
    backgroundColor: renkler.vurgu,
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  katilYazi: { color: '#2a2000', fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },

  banner: {
    backgroundColor: renkler.panel,
    borderWidth: 1,
    borderColor: renkler.vurguKoyu,
    borderRadius: 12,
    padding: 8,
    gap: 4,
    ...golge.kart,
  },
  bannerBaslik: { color: renkler.vurgu, fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },
  bannerAciklama: { color: renkler.metinSolgun, fontSize: 9, lineHeight: 12 },
  bannerSimge: { fontSize: 20, opacity: 0.5, alignSelf: 'center' },

  // --- Kartlar --------------------------------------------------------------
  // Sabit yukseklik bilerek: kartlar `orta`nin (flex:1) tum boyuna degil,
  // kendi icerigine gore boyutlaniyor — kucuk, kompakt kutular bunun icin.
  kartSatiri: { flexDirection: 'row', gap: 8, paddingRight: 4 },

  kart: {
    width: 132,
    height: 140,
    backgroundColor: renkler.panel,
    borderWidth: 1,
    borderColor: renkler.kenar,
    borderRadius: 12,
    overflow: 'hidden',
    ...golge.kart,
  },
  kartSerit: { height: 4, width: '100%' },
  kartGovde: { flex: 1, padding: 8, justifyContent: 'space-between' },
  kartBaslik: { color: renkler.metin, fontSize: 11, fontWeight: '900', letterSpacing: 0.3 },
  kartAciklama: { color: renkler.metinSolgun, fontSize: 9, lineHeight: 12, marginTop: 3 },
  kartSimge: { fontSize: 26, opacity: 0.5, alignSelf: 'center' },
  kartDugme: { paddingVertical: 6, alignItems: 'center' },
  kartDugmeCizgi: { backgroundColor: 'transparent', borderTopWidth: 1 },
  kartDugmeYazi: { fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
  kartDugmeYaziDolu: { color: '#2a2000' },

  katilKart: {
    width: 168,
    height: 168,
    backgroundColor: renkler.panel,
    borderWidth: 1,
    borderColor: renkler.kenar,
    borderRadius: 12,
    overflow: 'hidden',
    ...golge.kart,
  },
  katilKartGovde: { padding: 8, gap: 5 },

  eylemBasili: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  pasif: { opacity: 0.4 },

  // --- Alt bar ----------------------------------------------------------------
  altBar: { alignItems: 'center' },
  hizliPill: {
    backgroundColor: renkler.onay,
    borderRadius: 22,
    paddingVertical: 8,
    paddingHorizontal: 40,
    alignItems: 'center',
    minWidth: 260,
    ...golge.yukseltilmis,
  },
  hizliPillYazi: { color: '#0b2717', fontSize: 17, fontWeight: '900', letterSpacing: 1 },
  hizliPillAlt: { color: '#0b2717', fontSize: 10, fontWeight: '600', opacity: 0.8, marginTop: 1 },
});
