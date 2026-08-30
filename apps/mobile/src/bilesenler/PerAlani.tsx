import { useMemo, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { perGoruntuSirasi, type OyuncuGorunumu, type OyuncuId } from '@kut/engine';
import { PER_ARASI, PER_CERCEVE, PER_TAS_BOSLUK, tasOlcusu } from '../olculer';
import { renkler } from '../tema';
import { TasGorseli } from './TasGorseli';

interface Ozellikler {
  readonly oyuncu: OyuncuId;
  readonly gorunum: OyuncuGorunumu;
  /**
   * Tas eni — masanin olculen eninden geliyor (src/olculer.ts).
   * Sabit degil: 13'luk bir seri (KURALLAR.md §2) kirpilmadan sigsin diye.
   */
  readonly tasEni: number;
  readonly dikey?: boolean;
  readonly onPer: (perId: number) => void;
  /** Perin ekrandaki yeri — tas suruklenerek buraya islenebiliyor. */
  readonly perRef?: (perId: number, gorunum: ComponentRef<typeof View> | null) => void;
}

/**
 * Bir oyuncunun yere indirdigi perler — kendi istakasinin onunde durur.
 * Ortada tek bir yigin yok; herkesin peri kendi tarafinda.
 */
export function PerAlani({ oyuncu, gorunum, tasEni, dikey = false, onPer, perRef }: Ozellikler) {
  const olcu = useMemo(() => tasOlcusu(tasEni), [tasEni]);
  const perler = gorunum.yer.filter((per) => per.sahibi === oyuncu);

  if (perler.length === 0) {
    return <View style={[stil.bos, dikey && stil.bosDikey]} />;
  }

  return (
    <ScrollView
      horizontal={!dikey}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[stil.serit, dikey && stil.seritDikey]}
    >
      {perler.map((per) => (
        <Pressable
          key={per.id}
          ref={perRef === undefined ? undefined : (gorunum) => perRef(per.id, gorunum)}
          onPress={() => onPer(per.id)}
          style={stil.per}
        >
          {/* Taslar geldigi sirayla degil, serideki YERINE gore dizilir:
              `12 + 13 + okey`de okey 11'in yerindedir, 13'un sagi degil (§2). */}
          <View style={stil.perTaslari}>
            {perGoruntuSirasi(per).map((tas) => (
              <TasGorseli key={tas.id} tas={tas} boy={olcu} />
            ))}
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const stil = StyleSheet.create({
  serit: { alignItems: 'center', gap: PER_ARASI, paddingHorizontal: 3 },
  seritDikey: { flexDirection: 'column' },
  bos: { minHeight: 30 },
  bosDikey: { minWidth: 30 },
  per: {
    backgroundColor: renkler.masaKoyu,
    borderRadius: 4,
    // PER_CERCEVE = iki yandan (dolgu + kenarlik)
    padding: PER_CERCEVE / 2 - 1,
    borderWidth: 1,
    borderColor: renkler.masaCizgi,
  },
  perTaslari: { flexDirection: 'row', gap: PER_TAS_BOSLUK },
});
