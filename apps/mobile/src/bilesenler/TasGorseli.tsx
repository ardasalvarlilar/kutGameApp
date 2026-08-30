import { StyleSheet, Text, View } from 'react-native';
import type { Tas } from '@kut/engine';
import { OLCULER, type TasBoyu, type TasOlcusu } from '../olculer';
import { okeyRengi, renkler, tasRenkleri } from '../tema';

/** Kademe adi ya da dogrudan olcu — yere inen perler surekli olcu kullaniyor. */
export type TasBoyutu = TasBoyu | TasOlcusu;

function cozumle(boy: TasBoyutu): TasOlcusu {
  return typeof boy === 'string' ? OLCULER[boy] : boy;
}

interface Ozellikler {
  readonly tas: Tas;
  readonly boy?: TasBoyutu;
  readonly secili?: boolean;
  readonly soluk?: boolean;
  /** KURALLAR.md §8 — bu tas yerdeki bir pere isliyor; atilirsa 50 puan ceza. */
  readonly isler?: boolean;
  /**
   * KURALLAR.md §6 — bu tas yerdeki bir perden okey cekmeye yariyor.
   * `isler` ile AYRI tutuluyor: okey cekmek isleme degil, atmanin cezasi da
   * yok. Isaret de ayri renkte (okey moru), karistirilmasin.
   */
  readonly okeyeYarar?: boolean;
  /**
   * KURALLAR.md §3 — tur 16'da bu tasi atarsan el BITER.
   * En onemli bilgi oldugu icin diger iki isaretin onune geciyor.
   */
  readonly bitirir?: boolean;
}

export function TasGorseli({
  tas,
  boy = 'buyuk',
  secili = false,
  soluk = false,
  isler = false,
  okeyeYarar = false,
  bitirir = false,
}: Ozellikler) {
  const olcu = cozumle(boy);
  // Ic detaylar da olcuyle birlikte kuculur; sabit birakilirsa kucuk
  // taslarda sayi kutuyu tasiyor.
  const dip = Math.max(1, Math.round(olcu.en / 8));

  return (
    <View
      style={[
        stil.tas,
        { width: olcu.en, height: olcu.boy, borderRadius: olcu.yuvarlak },
        secili && stil.secili,
        soluk && stil.soluk,
      ]}
    >
      <Text
        style={[
          stil.sayi,
          {
            fontSize: olcu.yazi,
            marginTop: -dip,
            color: tas.tip === 'okey' ? okeyRengi : tasRenkleri[tas.renk],
          },
        ]}
      >
        {tas.tip === 'okey' ? '★' : tas.sayi}
      </Text>
      {isler || okeyeYarar || bitirir ? (
        // Sayinin altindaki isaret, oncelik sirasiyla:
        //   yesil  — bu tasi atarsan el biter (§3, tur 16)
        //   mor    — yerden okey cekmeye yarar (§6)
        //   turuncu— isler, atmak ceza getirir (§8)
        // Okey firsati veren tas §9 0.6'dan beri ZATEN isler sayiliyor;
        // daha ozel bilgi tasiyan isaret one geciyor.
        <View
          style={[
            stil.altIsaret,
            bitirir ? stil.bitirirIsareti : okeyeYarar ? stil.okeyIsareti : stil.islerIsareti,
            { width: Math.max(5, olcu.en - 8), bottom: dip, height: Math.max(2, dip) },
          ]}
        />
      ) : (
        <View
          style={[
            stil.nokta,
            { width: olcu.nokta, height: olcu.nokta, borderRadius: olcu.nokta / 2, bottom: dip },
          ]}
        />
      )}
    </View>
  );
}

/** Kapali tas — bos atik yigini icin. */
export function KapaliTas({ boy = 'kucuk' }: { readonly boy?: TasBoyutu }) {
  const olcu = cozumle(boy);
  return (
    <View
      style={[
        stil.tas,
        stil.kapali,
        { width: olcu.en, height: olcu.boy, borderRadius: olcu.yuvarlak },
      ]}
    />
  );
}

const stil = StyleSheet.create({
  tas: {
    backgroundColor: renkler.tasZemin,
    borderWidth: 1,
    borderColor: renkler.tasKenar,
    borderBottomWidth: 2,
    borderBottomColor: renkler.tasGolge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kapali: { backgroundColor: renkler.masaCizgi, borderColor: renkler.kenar },
  secili: { borderColor: renkler.vurgu, borderWidth: 2 },
  soluk: { opacity: 0.25 },
  sayi: { fontWeight: '800' },
  nokta: { backgroundColor: renkler.tasKenar, position: 'absolute' },
  altIsaret: { position: 'absolute', borderRadius: 2 },
  islerIsareti: { backgroundColor: renkler.uyari },
  okeyIsareti: { backgroundColor: okeyRengi },
  bitirirIsareti: { backgroundColor: renkler.onay },
});
