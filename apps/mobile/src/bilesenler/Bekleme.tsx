// Bekleme odasi — masa kuruldu, dordunculer bekleniyor.
//
// Ekranin tek isi kodu BUYUK gostermek ve kimin oturdugunu saymak: masa
// kodu telefonda okunup sesli soyleniyor, kucuk yazi bu isi bozuyor.
//
// "Hazir" varsayilan olarak ACIK geliyor (packages/server masaServisi):
// dort arkadas toplaninca bir de es zamanli "ben hazirim" turu beklemek
// gereksiz bir adimdi. Fikri degisen dugmeyle geri alabiliyor.

import { StyleSheet, Text, View } from 'react-native';
import { AnaDugme, Hata } from './Alan';
import type { MasaGorunumu } from '../ag/protokol';
import { renkler } from '../tema';

export interface BeklemeOzellikleri {
  readonly masa: MasaGorunumu;
  readonly benimId: string | null;
  readonly mesgul: boolean;
  readonly hata: string | null;
  readonly onHazir: (hazir: boolean) => void;
  readonly onCik: () => void;
}

const KAPASITE = 4;

export function Bekleme({ masa, benimId, mesgul, hata, onHazir, onCik }: BeklemeOzellikleri) {
  const benimKoltuk = masa.koltuklar.find((koltuk) => koltuk.oyuncuId === benimId);
  const hazirim = benimKoltuk?.hazir ?? false;
  const bosSayisi = KAPASITE - masa.koltuklar.length;
  // Masa dolu ama biri "hazir degilim" demis olabilir: sunucu dordu de hazir
  // olmadan eli dagitmiyor. "El birazdan dagitiliyor" demek yanlis olurdu.
  const bekleyenSayisi = masa.koltuklar.filter((koltuk) => !koltuk.hazir).length;

  return (
    <View style={stil.govde}>
      <View style={stil.sol}>
        <Text style={stil.etiket}>MASA KODU</Text>
        <Text style={stil.kod}>{masa.kod}</Text>
        <Text style={stil.aciklama}>
          {masa.ozel
            ? 'Arkadaşlarına bu kodu söyle — “KODLA KATIL” ile otursunlar'
            : 'Açık masa — kod bilmeyenler de oturabilir'}
        </Text>
        <Text style={stil.sayac}>
          {bosSayisi > 0
            ? `${bosSayisi} kişi daha bekleniyor`
            : bekleyenSayisi > 0
              ? `${bekleyenSayisi} kişi henüz hazır değil`
              : 'Masa doldu — el birazdan dağıtılıyor'}
        </Text>
      </View>

      <View style={stil.sag}>
        <Text style={stil.etiket}>KOLTUKLAR</Text>
        <View style={stil.koltuklar}>
          {Array.from({ length: KAPASITE }, (_, no) => {
            const koltuk = masa.koltuklar.find((k) => k.no === no);
            const benMiyim = koltuk?.oyuncuId === benimId;
            return (
              <View key={no} style={[stil.koltuk, koltuk === undefined && stil.koltukBos]}>
                <Text style={[stil.koltukAd, benMiyim && stil.koltukBen]} numberOfLines={1}>
                  {koltuk === undefined ? 'boş' : koltuk.ad}
                </Text>
                {koltuk === undefined ? null : (
                  <Text style={[stil.rozet, koltuk.hazir ? stil.rozetHazir : stil.rozetBekler]}>
                    {koltuk.bagli ? (koltuk.hazir ? 'HAZIR' : 'BEKLİYOR') : 'KOPUK'}
                  </Text>
                )}
              </View>
            );
          })}
        </View>

        <Hata metin={hata} />

        <View style={stil.dugmeler}>
          <View style={stil.dugme}>
            <AnaDugme
              etiket={hazirim ? 'HAZIR DEĞİLİM' : 'HAZIRIM'}
              onBas={() => onHazir(!hazirim)}
              aktif={!mesgul}
              tur={hazirim ? 'sade' : 'vurgu'}
            />
          </View>
          <View style={stil.dugme}>
            <AnaDugme etiket="MASADAN ÇIK" onBas={onCik} aktif={!mesgul} tur="cizgi" />
          </View>
        </View>
      </View>
    </View>
  );
}

const stil = StyleSheet.create({
  govde: { flex: 1, flexDirection: 'row', padding: 20, gap: 24, alignItems: 'center' },

  sol: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  etiket: {
    color: renkler.metinSolgun,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  kod: { color: renkler.vurgu, fontSize: 68, fontWeight: '900', letterSpacing: 10 },
  aciklama: { color: renkler.metinSolgun, fontSize: 11, textAlign: 'center', maxWidth: 300 },
  sayac: { color: renkler.metin, fontSize: 13, fontWeight: '700', marginTop: 10 },

  sag: { width: 280, gap: 8 },
  koltuklar: { gap: 5 },
  koltuk: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: renkler.panel,
    borderWidth: 1,
    borderColor: renkler.kenar,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  koltukBos: { opacity: 0.35, borderStyle: 'dashed' },
  koltukAd: { color: renkler.metin, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  koltukBen: { color: renkler.vurgu },
  rozet: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  rozetHazir: { color: renkler.onay },
  rozetBekler: { color: renkler.metinSolgun },

  dugmeler: { flexDirection: 'row', gap: 6, marginTop: 4 },
  dugme: { flex: 1 },
});
