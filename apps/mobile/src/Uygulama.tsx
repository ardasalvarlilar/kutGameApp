// Ekran secici.
//
// Uygulamanin butun akisi tek bir yerde duruyor:
//
//   yukleniyor → giris → lobi → bekleme odasi → masa → (lobi)
//                          ├→ hesap
//                          └→ alistirma (cevrimdisi masa)
//
// Karar veren iki sey var: oturum (`useKimlik`) ve masa (`useCevrimiciMasa`).
// Ikisi de kendi dosyasinda; burasi yalnizca hangisinin gosterilecegini
// soyluyor. Masa AYRI bir bilesen oldugu icin lobideyken oyun cizimi hic
// kosmuyor, masadan cikinca da durum kendiliginden temizleniyor.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { Bekleme } from './bilesenler/Bekleme';
import { Giris } from './bilesenler/Giris';
import { Hesap } from './bilesenler/Hesap';
import { Lobi } from './bilesenler/Lobi';
import type { MasadakiOyuncu } from './bilesenler/Ayarlar';
import { Masa } from './Masa';
import { useCevrimiciMasa } from './ag/cevrimiciOyun';
import { useKimlik } from './ag/kimlik';
import { useOyun } from './oyun';
import type { SikayetSebebi } from './ag/api';
import { renkler } from './tema';

/** Lobiden acilan yan ekranlar. */
type YanEkran = 'yok' | 'hesap' | 'alistirma';

function Perde({ yazi }: { readonly yazi: string }) {
  return (
    <View style={stil.perde}>
      <ActivityIndicator color={renkler.vurgu} size="large" />
      <Text style={stil.perdeYazi}>{yazi}</Text>
    </View>
  );
}

/**
 * Cevrimdisi masa.
 *
 * AYRI bir bilesen olmasi sart: `useOyun` bir kanca ve kancalar kosullu
 * cagrilamaz. Ana bilesende cagirsaydik, lobideyken bile el dagitilir ve
 * yer tutucularin zamanlayicisi bosuna kosardi.
 */
function AlistirmaMasasi({ onCik }: { readonly onCik: () => void }) {
  const yerel = useOyun(1);
  return <Masa surucu={yerel} onMasadanCik={onCik} />;
}

export function Uygulama() {
  const kimlik = useKimlik();
  const oda = useCevrimiciMasa(kimlik.soket, kimlik.bagli);
  const [yanEkran, setYanEkran] = useState<YanEkran>('yok');

  const benimId = kimlik.oyuncu?.id ?? null;

  // Oturum degisince yan ekrani kapat.
  //
  // Olmazsa: hesabini silen oyuncu giris ekranina duser ama `yanEkran` hala
  // 'hesap' kalir; yeni bir hesap acar acmaz kendini yine hesap ekraninda
  // bulur. Ayni sey cikis yapip baska hesapla girende de oluyordu.
  useEffect(() => {
    setYanEkran('yok');
  }, [benimId]);

  /** Masadaki DIGER oyuncular — bildirme ve engelleme listesi icin. */
  const masadakiler = useMemo<readonly MasadakiOyuncu[]>(
    () =>
      (oda.masa?.koltuklar ?? [])
        .filter((koltuk) => koltuk.oyuncuId !== benimId)
        .map((koltuk) => ({ oyuncuId: koltuk.oyuncuId, ad: koltuk.ad })),
    [oda.masa, benimId],
  );

  const engellenenIdler = useMemo(
    () => kimlik.engellenenler.map((kisi) => kisi.id),
    [kimlik.engellenenler],
  );

  const sikayetEt = useCallback(
    (oyuncuId: string, sebep: SikayetSebebi) => {
      void kimlik.sikayetEt({
        oyuncuId,
        sebep,
        ...(oda.masa === null ? {} : { masaId: oda.masa.masaId }),
      });
    },
    [kimlik, oda.masa],
  );

  const engelle = useCallback(
    (oyuncuId: string) => {
      void kimlik.engelle(oyuncuId);
    },
    [kimlik],
  );

  if (kimlik.durum === 'yukleniyor') {
    return (
      <SafeAreaView style={stil.ekran}>
        <StatusBar hidden />
        <Perde yazi="oturum açılıyor" />
      </SafeAreaView>
    );
  }

  if (kimlik.durum === 'giris') {
    return (
      <SafeAreaView style={stil.ekran}>
        <StatusBar hidden />
        <Giris />
      </SafeAreaView>
    );
  }

  // El basladiysa surucu dolu; mac bitene kadar masada kaliyoruz. El sonu ve
  // mac sonu tablolari da masanin ustunde gosteriliyor (PuanTablosu).
  if (oda.surucu !== null) {
    return (
      <Masa
        key={oda.masa?.masaId ?? 'masa'}
        surucu={oda.surucu}
        onMasadanCik={() => void oda.masadanCik()}
        masadakiler={masadakiler}
        engellenenIdler={engellenenIdler}
        onSikayet={sikayetEt}
        onEngelle={engelle}
      />
    );
  }

  if (oda.masa !== null) {
    if (oda.masa.durum === 'oynaniyor') {
      return (
        <SafeAreaView style={stil.ekran}>
          <StatusBar hidden />
          <Perde yazi="el dağıtılıyor" />
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={stil.ekran}>
        <StatusBar hidden />
        <Bekleme
          masa={oda.masa}
          benimId={benimId}
          mesgul={oda.mesgul}
          hata={oda.hata}
          onHazir={(hazir) => void oda.hazirOl(hazir)}
          onCik={() => void oda.masadanCik()}
        />
      </SafeAreaView>
    );
  }

  // Cevrimdisi masa: sunucu gerekmiyor. Baglanti yokken calisan tek yol bu ve
  // uygulamanin ne oldugunu tek basina gosterebilmesini sagliyor.
  if (yanEkran === 'alistirma') {
    return <AlistirmaMasasi onCik={() => setYanEkran('yok')} />;
  }

  if (yanEkran === 'hesap') {
    return (
      <SafeAreaView style={stil.ekran}>
        <StatusBar hidden />
        <Hesap onKapat={() => setYanEkran('yok')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={stil.ekran}>
      <StatusBar hidden />
      <Lobi
        oyuncu={kimlik.oyuncu}
        bagli={kimlik.bagli}
        mesgul={oda.mesgul}
        hata={oda.hata}
        onHizli={() => void oda.hizliOyna()}
        onMasaAc={() => void oda.masaKur(true)}
        onKatil={(kod) => void oda.masayaKatil(kod)}
        onAlistirma={() => setYanEkran('alistirma')}
        onHesap={() => setYanEkran('hesap')}
      />
    </SafeAreaView>
  );
}

const stil = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renkler.arka },
  perde: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  perdeYazi: { color: renkler.metinSolgun, fontSize: 12, letterSpacing: 1 },
});
