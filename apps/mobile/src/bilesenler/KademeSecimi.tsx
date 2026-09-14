// Kademe secimi — HIZLI OYNA, ÖZEL MASA ve AÇIK MASA'nin ortak ilk adimi.
//
// Mac uzunlugu sabit (16 tur); oyuncunun sectigi sey masanin AGIRLIGI: giris
// ne kadar, kazanan ne alir. Kurallar @kut/ekonomi'de. Burasi yalnizca
// gosteriyor — seviye ve bakiye sunucuda da kontrol ediliyor.
//
// Kilitli kademeler GIZLENMIYOR, soluk duruyor: "Efsane 30. seviyede acilir"
// gormek oynamaya bir sebep. Cipi yetmeyen kademede dugme magazaya goturuyor.

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  KADEMELER,
  MASA_UCRETI_YUZDESI,
  kazananPayi,
  oturmaEngeli,
  potHesapla,
  type Kademe,
  type KademeKimligi,
} from '@kut/ekonomi';
import { AnaDugme, Hata } from './Alan';
import { useCeviri } from '../dil';
import type { MetinAnahtari } from '../dil/cevir';
import type { OyuncuOzeti } from '../ag/protokol';
import { cipKisa, cipYaz } from '../cip';
import { KADEME_ADLARI, KADEME_RENKLERI } from '../kademeGorunumu';
import { golge, renkler } from '../tema';

export type KademeAmaci = 'hizli' | 'ozel' | 'acik';

const BASLIKLAR: Record<KademeAmaci, MetinAnahtari> = {
  hizli: 'kademe.baslikHizli',
  ozel: 'kademe.baslikOzel',
  acik: 'kademe.baslikAcik',
};

export interface KademeSecimiOzellikleri {
  readonly amac: KademeAmaci;
  readonly oyuncu: OyuncuOzeti | null;
  readonly mesgul: boolean;
  readonly hata: string | null;
  readonly onSec: (kademe: KademeKimligi) => void;
  readonly onMagaza: () => void;
  readonly onKapat: () => void;
}

/** Dort insanli masada kazananin alacagi — kartta yazan sayi. */
function tamMasaOdulu(kademe: Kademe): number {
  return kazananPayi(potHesapla(4, kademe.giris), 1);
}

function KademeKarti({
  kademe,
  oyuncu,
  mesgul,
  onSec,
  onMagaza,
}: {
  readonly kademe: Kademe;
  readonly oyuncu: OyuncuOzeti | null;
  readonly mesgul: boolean;
  readonly onSec: () => void;
  readonly onMagaza: () => void;
}) {
  const t = useCeviri();
  const engel = oyuncu === null ? 'cip-yetersiz' : oturmaEngeli(oyuncu, kademe);
  const renk = KADEME_RENKLERI[kademe.kimlik];
  const kilitli = engel === 'seviye-yetersiz';

  return (
    <View style={[stil.kart, kilitli && stil.kilitli]}>
      <View style={[stil.serit, { backgroundColor: renk }]} />
      <View style={stil.kartGovde}>
        <Text style={[stil.ad, { color: renk }]} numberOfLines={1}>
          {t(KADEME_ADLARI[kademe.kimlik])}
        </Text>
        <View>
          <Text style={stil.etiket}>{t('kademe.giris')}</Text>
          <Text style={stil.deger}>{cipKisa(kademe.giris)}</Text>
        </View>
        <View>
          <Text style={stil.etiket}>{t('kademe.odul')}</Text>
          <Text style={[stil.deger, stil.odul]}>{cipKisa(tamMasaOdulu(kademe))}</Text>
        </View>
      </View>

      {kilitli ? (
        <View style={stil.kilitSatiri}>
          <Text style={stil.kilitYazi} numberOfLines={2}>
            {t('kademe.kilitli', { seviye: kademe.minSeviye })}
          </Text>
        </View>
      ) : engel === 'cip-yetersiz' ? (
        <Pressable onPress={onMagaza} style={[stil.dugme, stil.dugmeCizgi, { borderColor: renk }]}>
          <Text style={[stil.dugmeYazi, { color: renk }]}>{t('kademe.cipAl')}</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={mesgul ? undefined : onSec}
          style={({ pressed }) => [
            stil.dugme,
            { backgroundColor: renk },
            pressed && stil.basili,
            mesgul && stil.pasif,
          ]}
        >
          <Text style={[stil.dugmeYazi, stil.dugmeYaziDolu]}>{t('kademe.otur')}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function KademeSecimi({
  amac,
  oyuncu,
  mesgul,
  hata,
  onSec,
  onMagaza,
  onKapat,
}: KademeSecimiOzellikleri) {
  const t = useCeviri();

  return (
    <View style={stil.govde}>
      <View style={stil.baslikSatiri}>
        <View style={stil.baslikYazi}>
          <Text style={stil.baslik}>{t(BASLIKLAR[amac])}</Text>
          <Text style={stil.altBaslik}>
            {t('kademe.altBaslik', { yuzde: MASA_UCRETI_YUZDESI })}
          </Text>
        </View>
        <Pressable
          onPress={onMagaza}
          style={({ pressed }) => [stil.bakiye, pressed && stil.basili]}
        >
          <Text style={stil.bakiyeEtiket}>{t('kademe.bakiye')}</Text>
          <Text style={stil.bakiyeDeger}>{cipYaz(oyuncu?.cip ?? 0)}</Text>
        </Pressable>
        <AnaDugme etiket={t('kademe.geri')} onBas={onKapat} tur="cizgi" />
      </View>

      <Hata metin={hata} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={stil.kartlar}
      >
        {KADEMELER.map((kademe) => (
          <KademeKarti
            key={kademe.kimlik}
            kademe={kademe}
            oyuncu={oyuncu}
            mesgul={mesgul}
            onSec={() => onSec(kademe.kimlik)}
            onMagaza={onMagaza}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const stil = StyleSheet.create({
  govde: { flex: 1, padding: 16, gap: 10 },

  baslikSatiri: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  baslikYazi: { flex: 1, gap: 2 },
  baslik: { color: renkler.vurgu, fontSize: 22, fontWeight: '900', letterSpacing: 3 },
  altBaslik: { color: renkler.metinSolgun, fontSize: 11 },

  bakiye: {
    alignItems: 'flex-end',
    backgroundColor: renkler.panelKoyu,
    borderWidth: 1,
    borderColor: renkler.vurguKoyu,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  bakiyeEtiket: { color: renkler.metinSolgun, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  bakiyeDeger: { color: renkler.vurgu, fontSize: 15, fontWeight: '900' },

  kartlar: { gap: 10, paddingVertical: 4, paddingRight: 4, alignItems: 'center' },

  kart: {
    width: 124,
    height: 200,
    backgroundColor: renkler.panel,
    borderWidth: 1,
    borderColor: renkler.kenar,
    borderRadius: 12,
    overflow: 'hidden',
    ...golge.kart,
  },
  kilitli: { opacity: 0.45 },
  serit: { height: 5, width: '100%' },
  kartGovde: { flex: 1, padding: 10, justifyContent: 'space-between' },
  ad: { fontSize: 14, fontWeight: '900', letterSpacing: 0.4 },
  etiket: { color: renkler.metinSolgun, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  deger: { color: renkler.metin, fontSize: 20, fontWeight: '900' },
  odul: { color: renkler.onay },

  kilitSatiri: {
    paddingVertical: 7,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: renkler.kenar,
  },
  kilitYazi: { color: renkler.metinSolgun, fontSize: 9, fontWeight: '700', textAlign: 'center' },

  dugme: { paddingVertical: 8, alignItems: 'center' },
  dugmeCizgi: { backgroundColor: 'transparent', borderTopWidth: 1 },
  dugmeYazi: { fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  dugmeYaziDolu: { color: '#1a1400' },

  basili: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  pasif: { opacity: 0.5 },
});
