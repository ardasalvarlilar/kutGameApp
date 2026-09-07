// Sira suresi geri sayimi — KURALLAR.md §9 0.4.
//
// AYRI BIR BILESEN OLMASI PERFORMANS KARARI. Geri sayim saniyenin onda biri
// gosterildigi icin saat 200 ms'de bir tikliyor. Bu tik `Masa.tsx`in kendi
// state'inde dururken her tikte butun masa yeniden ciziliyordu: ıstakadaki
// 20+ tas, dort per alani, ortadaki obek, yan paneldeki on dugme — saniyede
// bes kez, el boyunca kesintisiz. Sayac buraya tasindiginda tikin dokundugu
// tek sey bu kucuk bilesen oldu.
//
// Sayacin KENDISI de burada: `an`i disaridan almak, tikin yine yukarida
// olmasi demek olurdu.
//
// Karar (hangi tasin atilacagi, kademenin dusmesi) burada DEGIL: o
// `@kut/politika`da, saf ve testli. Burasi yalnizca gosterim.

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ACIL_ESIGI_MS, kalanSiraSuresi } from '@kut/politika';
import { renkler } from '../tema';

/** Geri sayim ne siklikta tazelensin (ms). Onda birlik gosterime yetiyor. */
const TIK_MS = 200;

export interface SiraSayaciOzellikleri {
  /** Sure sonu ani; sayac yoksa null (o zaman hicbir sey cizilmez). */
  readonly bitis: number | null;
  /** Bu siranin toplam hakki (ms) — cubugun orani buradan cikiyor. */
  readonly sure: number;
}

export function SiraSayaci({ bitis, sure }: SiraSayaciOzellikleri) {
  const [an, setAn] = useState(() => Date.now());

  useEffect(() => {
    if (bitis === null) return;
    setAn(Date.now());
    const sayac = setInterval(() => setAn(Date.now()), TIK_MS);
    return () => clearInterval(sayac);
  }, [bitis]);

  if (bitis === null) return null;

  const kalan = kalanSiraSuresi(bitis, an);
  const acil = kalan <= ACIL_ESIGI_MS;
  const oran = sure > 0 ? Math.round((kalan / sure) * 100) : 0;

  return (
    <View>
      <Text style={[stil.metin, acil && stil.acil]}>{(kalan / 1000).toFixed(1)} sn</Text>
      <View style={stil.yol}>
        <View style={[stil.dolgu, { width: `${oran}%` }, acil && stil.dolguAcil]} />
      </View>
    </View>
  );
}

const stil = StyleSheet.create({
  metin: { color: renkler.vurgu, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  acil: { color: renkler.uyari },
  yol: {
    height: 3,
    borderRadius: 2,
    backgroundColor: renkler.masaKoyu,
    overflow: 'hidden',
    marginTop: 3,
    width: 64,
  },
  dolgu: { height: 3, borderRadius: 2, backgroundColor: renkler.vurgu },
  dolguAcil: { backgroundColor: renkler.uyari },
});
