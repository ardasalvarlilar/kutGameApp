// Ad bas harflerinden avatar.
//
// Gorsel yuklemek yok ve bilerek yok: kullanici uretimi GORSEL barindirmak,
// App Store 1.2'nin suzme/sikayet yukumluluklerini metinden goruntuye
// tasirdi (moderasyon icin ayri bir is). Bas harf, hicbir sey yuklemeden
// oyuncularin birbirini ayirt etmesine yetiyor.
//
// Renk ADDAN turetiliyor: ayni oyuncu her ekranda ayni renkte gorunuyor ve
// bunun icin sunucuda saklanacak bir alan gerekmiyor.
//
// Iki karar (bas harfler + renk) `src/kimlikGorseli.ts`te, saf ve testli:
// vitest React Native bilesenlerini kosmuyor (vitest.config.ts).

import { StyleSheet, Text, View } from 'react-native';
import { avatarRengi, basHarfler } from '../kimlikGorseli';
import { renkler } from '../tema';

export interface AvatarOzellikleri {
  readonly ad: string;
  /** Kenar uzunlugu (px). */
  readonly boy?: number;
}

export function Avatar({ ad, boy = 36 }: AvatarOzellikleri) {
  return (
    <View
      style={[
        stil.govde,
        {
          width: boy,
          height: boy,
          borderRadius: boy / 2,
          backgroundColor: avatarRengi(ad),
        },
      ]}
    >
      <Text style={[stil.yazi, { fontSize: Math.round(boy * 0.38) }]}>{basHarfler(ad)}</Text>
    </View>
  );
}

const stil = StyleSheet.create({
  govde: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: renkler.kenar,
  },
  yazi: { color: '#fff', fontWeight: '900', letterSpacing: 0.5 },
});
