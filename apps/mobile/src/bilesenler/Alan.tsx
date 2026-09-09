// Formlarda kullanilan metin alani ve dugmeler.
//
// Ayri dosya cunku giris ekrani, lobi ve bekleme odasi ayni gorunumu
// paylasiyor; her birinde yeniden yazmak uc ayri stil demek olurdu.

import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ComponentProps } from 'react';
import { golge, renkler } from '../tema';

interface AlanOzellikleri extends Omit<ComponentProps<typeof TextInput>, 'style'> {
  readonly etiket: string;
}

export function Alan({ etiket, ...kalan }: AlanOzellikleri) {
  // Odaklaninca kenarlik vurgu rengine doner — dokunulan alanin hangisi
  // oldugu bir onceki tasarimda yalnizca imlecten anlasiliyordu.
  const [odakta, setOdakta] = useState(false);
  return (
    <View style={stil.alanKutu}>
      <Text style={stil.etiket}>{etiket}</Text>
      <TextInput
        {...kalan}
        style={[stil.giris, odakta && stil.girisOdakta]}
        placeholderTextColor={renkler.metinSolgun}
        onFocus={(olay) => {
          setOdakta(true);
          kalan.onFocus?.(olay);
        }}
        onBlur={(olay) => {
          setOdakta(false);
          kalan.onBlur?.(olay);
        }}
        // Turkce klavyede otomatik buyuk harf e-postayi bozuyor; her alanda
        // bilerek kapali, gerekirse cagiran acar.
        autoCapitalize={kalan.autoCapitalize ?? 'none'}
        autoCorrect={kalan.autoCorrect ?? false}
      />
    </View>
  );
}

interface DugmeOzellikleri {
  readonly etiket: string;
  readonly onBas: () => void;
  readonly aktif?: boolean;
  readonly bekliyor?: boolean;
  readonly tur?: 'vurgu' | 'sade' | 'cizgi' | 'tehlike';
}

export function AnaDugme({
  etiket,
  onBas,
  aktif = true,
  bekliyor = false,
  tur = 'vurgu',
}: DugmeOzellikleri) {
  const basilabilir = aktif && !bekliyor;
  return (
    <Pressable
      onPress={basilabilir ? onBas : undefined}
      style={({ pressed }) => [
        stil.dugme,
        tur === 'vurgu' && stil.dugmeVurgu,
        tur === 'cizgi' && stil.dugmeCizgi,
        tur === 'tehlike' && stil.dugmeTehlike,
        !basilabilir && stil.dugmePasif,
        pressed && basilabilir && stil.dugmeBasili,
      ]}
    >
      {bekliyor ? (
        <ActivityIndicator color={tur === 'vurgu' ? '#2a2000' : renkler.metin} size="small" />
      ) : (
        <Text
          style={[
            stil.dugmeYazi,
            tur === 'vurgu' && stil.dugmeYaziVurgu,
            tur === 'tehlike' && stil.dugmeYaziTehlike,
          ]}
        >
          {etiket}
        </Text>
      )}
    </Pressable>
  );
}

export function Hata({ metin }: { readonly metin: string | null }) {
  if (metin === null) return null;
  return <Text style={stil.hata}>{metin}</Text>;
}

interface BaglantiOzellikleri {
  readonly etiket: string;
  /** Disaridaki bir sayfa (gizlilik, kosullar). `onBas` ile birlikte verilmez. */
  readonly adres?: string;
  readonly onBas?: () => void;
  readonly ortala?: boolean;
}

/**
 * Metin baglantisi.
 *
 * `adres` verilirse tarayicida acar. `Linking.openURL` reddedebilir (adres
 * bozuksa, tarayici yoksa); hata YUTULUYOR cunku bir gizlilik baglantisinin
 * acilmamasi uygulamayi cokertecek bir sey degil.
 */
export function Baglanti({ etiket, adres, onBas, ortala = false }: BaglantiOzellikleri) {
  const bas = (): void => {
    if (onBas !== undefined) {
      onBas();
      return;
    }
    if (adres !== undefined) void Linking.openURL(adres).catch(() => undefined);
  };
  return (
    <Pressable onPress={bas} hitSlop={8}>
      <Text style={[stil.baglanti, ortala && stil.baglantiOrta]}>{etiket}</Text>
    </Pressable>
  );
}

const stil = StyleSheet.create({
  alanKutu: { gap: 3 },
  etiket: {
    color: renkler.metinSolgun,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  giris: {
    backgroundColor: renkler.arkaKoyu,
    borderWidth: 1.5,
    borderColor: renkler.kenar,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: renkler.metin,
    fontSize: 14,
  },
  girisOdakta: { borderColor: renkler.vurgu },

  dugme: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: renkler.panel,
    borderWidth: 1,
    borderColor: renkler.kenar,
    minHeight: 44,
  },
  dugmeVurgu: { backgroundColor: renkler.vurgu, borderColor: renkler.vurgu, ...golge.kart },
  dugmeCizgi: { backgroundColor: 'transparent' },
  // Geri donusu olmayan islemler (hesap silme) ayri renkte: yanlislikla
  // basilan bir dugmenin diger dugmelere benzemesi kotu bir fikir.
  dugmeTehlike: { backgroundColor: 'transparent', borderColor: renkler.uyari },
  dugmePasif: { opacity: 0.4 },
  // Basinca hafif kuculme — dokunmanin karsiligini gorsel olarak verir.
  dugmeBasili: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  dugmeYazi: { color: renkler.metin, fontSize: 13, fontWeight: '800', letterSpacing: 0.6 },
  dugmeYaziVurgu: { color: '#2a2000' },
  dugmeYaziTehlike: { color: renkler.uyari },

  hata: { color: renkler.uyari, fontSize: 11, fontWeight: '600' },
  baglanti: { color: renkler.vurgu, fontSize: 11, textDecorationLine: 'underline' },
  baglantiOrta: { textAlign: 'center', marginTop: 2 },
});
