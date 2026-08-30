import { Pressable, StyleSheet, Text, View } from 'react-native';
import { renkler } from '../tema';

interface Ozellikler {
  readonly etiket: string;
  readonly aktif: boolean;
  readonly onBas: () => void;
  readonly tur?: 'normal' | 'vurgu' | 'uyari';
  readonly genis?: boolean;
}

export function Dugme({ etiket, aktif, onBas, tur = 'normal', genis = false }: Ozellikler) {
  return (
    <Pressable
      onPress={aktif ? onBas : undefined}
      style={[
        stil.dugme,
        genis && stil.genis,
        aktif && tur === 'vurgu' && stil.vurgu,
        aktif && tur === 'uyari' && stil.uyari,
        !aktif && stil.pasif,
      ]}
    >
      <Text
        style={[
          stil.metin,
          aktif && tur === 'vurgu' && stil.metinVurgu,
          !aktif && stil.metinPasif,
        ]}
        numberOfLines={1}
      >
        {etiket}
      </Text>
    </Pressable>
  );
}

/** Istakanin iki ucundaki buyuk dizme dugmeleri. */
export function DizmeDugmesi({
  ustSatir,
  altSatir,
  aktif,
  onBas,
}: {
  readonly ustSatir: string;
  readonly altSatir: string;
  readonly aktif: boolean;
  readonly onBas: () => void;
}) {
  return (
    <Pressable onPress={aktif ? onBas : undefined} style={[stil.dizme, !aktif && stil.pasif]}>
      <View>
        <Text style={stil.dizmeMetin}>{ustSatir}</Text>
        <Text style={stil.dizmeMetin}>{altSatir}</Text>
      </View>
    </Pressable>
  );
}

const stil = StyleSheet.create({
  dugme: {
    // Yan panelde iki sutun: her dugme satirin yarisini kaplar. Etiketi
    // yarim sutuna sigmayan dugmeler `genis` ile tam satiri kapliyor —
    // yazi kirpilmasin diye.
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 66,
    paddingHorizontal: 4,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: renkler.panel,
    borderWidth: 1,
    borderColor: renkler.kenar,
    alignItems: 'center',
  },
  genis: { flexBasis: '100%' },
  vurgu: { backgroundColor: renkler.vurgu, borderColor: renkler.vurgu },
  uyari: { backgroundColor: renkler.uyari, borderColor: renkler.uyari },
  // Pasif dugme rengini birakir; solmus kirmizi/sari okunmuyor.
  pasif: { backgroundColor: renkler.panelKoyu, borderColor: renkler.kenar, opacity: 0.5 },
  metin: {
    color: renkler.metin,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  metinVurgu: { color: '#2a2000' },
  metinPasif: { color: renkler.metinSolgun },
  dizme: {
    width: 62,
    borderRadius: 8,
    backgroundColor: renkler.arkaKoyu,
    borderWidth: 1,
    borderColor: renkler.kenar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dizmeMetin: {
    color: renkler.metin,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
