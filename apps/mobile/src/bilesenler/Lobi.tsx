// Lobi — masaya oturmanin bes yolu.
//
//   HIZLI OYNA   — secmeden, en dolu acik masaya oturur (dolunca baslar)
//   MASA BUL     — acik masalari listeler, oyuncu kendi secer
//   ÖZEL MASA    — dort haneli kod uretir; listede GORUNMEZ, yalnizca kodla
//   KODLA KATIL  — arkadasinin ozel masa kodunu yaz, koltuguna otur
//   ALIŞTIRMA    — cevrimdisi, uc yer tutucu oyuncuyla, bu cihazda
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
// Cevrimdisi mod, uygulamanin ne oldugunu tek basina gosterebilmesini
// sagliyor. Sunucu coktugunde de tek calisan yol bu.

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alan, AnaDugme, Hata } from './Alan';
import type { OyuncuOzeti } from '../ag/protokol';
import { renkler } from '../tema';

export interface LobiOzellikleri {
  readonly oyuncu: OyuncuOzeti | null;
  readonly bagli: boolean;
  readonly mesgul: boolean;
  readonly hata: string | null;
  readonly onHizli: () => void;
  readonly onMasaBul: () => void;
  readonly onMasaAc: () => void;
  readonly onKatil: (kod: string) => void;
  readonly onAlistirma: () => void;
  readonly onHesap: () => void;
}

export function Lobi({
  oyuncu,
  bagli,
  mesgul,
  hata,
  onHizli,
  onMasaBul,
  onMasaAc,
  onKatil,
  onAlistirma,
  onHesap,
}: LobiOzellikleri) {
  const [kod, setKod] = useState('');
  const kodTamam = kod.trim().length >= 3;

  return (
    <KeyboardAvoidingView
      style={stil.govde}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={stil.sol}>
        <Text style={stil.oyunAdi}>KÜT</Text>
        <Text style={stil.altBaslik}>okey taşlarıyla · 4 oyuncu · 16 tur</Text>

        <View style={stil.profil}>
          <Text style={stil.ad}>{oyuncu?.ad ?? '—'}</Text>
          <Text style={stil.istatistik}>
            {oyuncu === null ? '' : `${oyuncu.oynananEl} el · ${oyuncu.kazanilanEl} galibiyet`}
          </Text>
          {oyuncu?.misafirMi === true ? (
            // Misafir hesabi cihaza bagli: uygulama silinirse ilerleme gider.
            // Bunu oyuncuya SOYLEMEK, sonradan sikayet almaktan iyi.
            <Text style={stil.uyari}>
              Misafir oynuyorsun — hesap açmazsan ilerlemen bu telefonda kalır.
            </Text>
          ) : null}
        </View>

        <View style={stil.durumSatiri}>
          <View style={[stil.nokta, bagli ? stil.noktaAcik : stil.noktaKapali]} />
          <Text style={stil.durumYazi}>{bagli ? 'sunucuya bağlı' : 'bağlanılıyor…'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={stil.sag} keyboardShouldPersistTaps="handled">
        <AnaDugme etiket="HIZLI OYNA" onBas={onHizli} aktif={bagli && !mesgul} />
        <Text style={stil.aciklama}>Seni uygun bir masaya oturtur, dört kişi olunca başlar</Text>

        <AnaDugme etiket="MASA BUL" onBas={onMasaBul} aktif={bagli && !mesgul} tur="sade" />
        <Text style={stil.aciklama}>Açık masaları gör, istediğine otur</Text>

        <AnaDugme etiket="ÖZEL MASA" onBas={onMasaAc} aktif={bagli && !mesgul} tur="sade" />
        <Text style={stil.aciklama}>Kod üret; yalnızca kodu bilenler girebilir</Text>

        <View style={stil.katilKutu}>
          <Alan
            etiket="Arkadaşının masa kodu"
            value={kod}
            onChangeText={(yazi) => setKod(yazi.toLocaleUpperCase('tr-TR'))}
            placeholder="4F7A"
            maxLength={8}
            autoCapitalize="characters"
            onSubmitEditing={kodTamam ? () => onKatil(kod) : undefined}
            returnKeyType="go"
          />
          <AnaDugme
            etiket="KODLA KATIL"
            onBas={() => onKatil(kod)}
            aktif={bagli && !mesgul && kodTamam}
            tur="sade"
          />
        </View>

        <Hata metin={hata} />

        <View style={stil.ayirici} />

        {/* Cevrimdisi: sunucu gerekmiyor, bu yuzden `bagli` sartina bakmiyor.
            Baglanti yokken calisan tek giris bu. */}
        <AnaDugme etiket="ALIŞTIRMA" onBas={onAlistirma} tur="sade" />
        <Text style={stil.aciklama}>Üç yer tutucu oyuncuyla, çevrimdışı</Text>

        <AnaDugme etiket="HESAP" onBas={onHesap} tur="cizgi" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const stil = StyleSheet.create({
  govde: { flex: 1, flexDirection: 'row', padding: 16, gap: 24, alignItems: 'center' },

  sol: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  oyunAdi: { color: renkler.vurgu, fontSize: 52, fontWeight: '900', letterSpacing: 8 },
  altBaslik: { color: renkler.metinSolgun, fontSize: 12, letterSpacing: 0.5 },
  profil: { alignItems: 'center', gap: 3, marginTop: 12, maxWidth: 280 },
  ad: { color: renkler.metin, fontSize: 18, fontWeight: '800' },
  istatistik: { color: renkler.metinSolgun, fontSize: 11 },
  uyari: { color: renkler.uyari, fontSize: 10, textAlign: 'center', marginTop: 4 },

  durumSatiri: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  nokta: { width: 7, height: 7, borderRadius: 4 },
  noktaAcik: { backgroundColor: renkler.onay },
  noktaKapali: { backgroundColor: renkler.uyari },
  durumYazi: { color: renkler.metinSolgun, fontSize: 10 },

  sag: { width: 300, gap: 6, paddingBottom: 10 },
  aciklama: { color: renkler.metinSolgun, fontSize: 10, marginBottom: 4, marginLeft: 2 },
  katilKutu: { gap: 6, marginTop: 4 },
  ayirici: { height: 1, backgroundColor: renkler.kenar, marginVertical: 8 },
});
