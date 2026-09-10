// Ekran secici.
//
// Uygulamanin butun akisi tek bir yerde duruyor:
//
//   yukleniyor → giris → lobi → bekleme odasi → masa → (lobi)
//                          ├→ profil (hesap · arkadaslar · ayarlar)
//                          ├→ masa bul
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
import { Lobi } from './bilesenler/Lobi';
import { Profil } from './bilesenler/Profil';
import { MasaBul } from './bilesenler/MasaBul';
import type { MasadakiOyuncu } from './bilesenler/Ayarlar';
import { Masa } from './Masa';
import { useCevrimiciMasa } from './ag/cevrimiciOyun';
import { useKimlik } from './ag/kimlik';
import { useCeviri } from './dil';
import { useOyun } from './oyun';
import { ogreticiDestesi } from './ogretici/senaryo';
import { Ogretici } from './ogretici/Ogretici';
import { OgreticiSorusu } from './ogretici/OgreticiSorusu';
import { HedefSaglayici } from './ogretici/hedefKaydi';
import { ogreticiSorulduMu, ogreticiSorulduYaz } from './ag/depo';
import { yerTutucularOynasin, type Beklenti } from './ogretici/beklenti';
import type { SikayetSebebi } from './ag/api';
import { renkler } from './tema';

/** Lobiden acilan yan ekranlar. */
type YanEkran = 'yok' | 'profil' | 'alistirma' | 'masaBul';

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
function AlistirmaMasasi({
  onCik,
  ogretici,
}: {
  readonly onCik: () => void;
  /** Ogretici acikken el karistirilmiyor: senaryo destesiyle dagitiliyor. */
  readonly ogretici: boolean;
}) {
  const deste = useMemo(() => (ogretici ? ogreticiDestesi() : undefined), [ogretici]);
  const [ogreticiAcik, setOgreticiAcik] = useState(ogretici);
  const [beklenti, setBeklenti] = useState<Beklenti>('ileri');
  // Masa `key` ile yeniden kuruldugu icin bu state ogretici acilirken
  // dogru degerle basliyor; ayrica izlemeye gerek yok.

  // Ogretici acikken masa duruyor; yalnizca rakibin hamlesini bekleyen
  // adimlarda fren aciliyor (bkz. beklenti.ts).
  const fren = ogreticiAcik
    ? { sureDur: true, yerTutucularDursun: !yerTutucularOynasin(beklenti) }
    : undefined;

  const yerel = useOyun(1, deste, fren);

  return (
    <HedefSaglayici>
      <Masa surucu={yerel} onMasadanCik={onCik} />
      {ogreticiAcik ? (
        <Ogretici
          gorunum={yerel.gorunum}
          onAdim={setBeklenti}
          onBitti={() => setOgreticiAcik(false)}
        />
      ) : null}
    </HedefSaglayici>
  );
}

export function Uygulama() {
  const kimlik = useKimlik();
  const t = useCeviri();
  const oda = useCevrimiciMasa(kimlik.soket, kimlik.bagli);
  const [yanEkran, setYanEkran] = useState<YanEkran>('yok');
  /** Alistirmaya ogreticiyle mi girilecek — depo okunana kadar `bilinmiyor`. */
  const [ogreticiKarari, setOgreticiKarari] = useState<
    'bilinmiyor' | 'sor' | 'ogreticili' | 'ogreticisiz'
  >('bilinmiyor');

  const benimId = kimlik.oyuncu?.id ?? null;

  // Oturum degisince yan ekrani kapat.
  //
  // Olmazsa: hesabini silen oyuncu giris ekranina duser ama `yanEkran` hala
  // 'profil' kalir; yeni bir hesap acar acmaz kendini yine profil ekraninda
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
        <Perde yazi={t('uygulama.oturumAciliyor')} />
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
          <Perde yazi={t('uygulama.elDagitiliyor')} />
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
          onKoltugaGec={(koltuk) => void oda.koltugaGec(koltuk)}
          onKoltukTalebi={(koltuk) => void oda.koltukTalebi(koltuk)}
          onKoltukCevap={(isteyenId, kabul) => void oda.koltukCevap(isteyenId, kabul)}
          onBotlariDoldur={() => void oda.botlariDoldur()}
          onBotuCikar={(koltuk) => void oda.botuCikar(koltuk)}
        />
      </SafeAreaView>
    );
  }

  // Cevrimdisi masa: sunucu gerekmiyor. Baglanti yokken calisan tek yol bu ve
  // uygulamanin ne oldugunu tek basina gosterebilmesini sagliyor.
  if (yanEkran === 'alistirma') {
    // Ilk aliştirmada bir kez soruluyor; cevap ne olursa olsun bir daha
    // sorulmuyor (depo.ogreticiSorulduYaz). Fikri degisenin yolu lobideki
    // "ÖĞRETİCİ" baglantisi — o dogrudan `ogreticili` ile giriyor.
    if (ogreticiKarari === 'sor') {
      return (
        <SafeAreaView style={stil.ekran}>
          <StatusBar hidden />
          <OgreticiSorusu
            onEvet={() => {
              void ogreticiSorulduYaz();
              setOgreticiKarari('ogreticili');
            }}
            onHayir={() => {
              void ogreticiSorulduYaz();
              setOgreticiKarari('ogreticisiz');
            }}
          />
        </SafeAreaView>
      );
    }
    // Depo okunana kadar masayi kurmuyoruz: `ogretici` bayragi masanin
    // ilk elini belirliyor, sonradan degistirilemez.
    if (ogreticiKarari === 'bilinmiyor') {
      return (
        <SafeAreaView style={stil.ekran}>
          <StatusBar hidden />
          <Perde yazi={t('uygulama.yukleniyor')} />
        </SafeAreaView>
      );
    }
    return (
      <AlistirmaMasasi
        onCik={() => setYanEkran('yok')}
        ogretici={ogreticiKarari === 'ogreticili'}
      />
    );
  }

  // PROFIL. Arkadas listesindeki "KATIL" da buradan geciyor: masaya oturmayi
  // basarirsa `oda.masa` dolar ve yukaridaki dallardan biri devralir, bu
  // yuzden ekrani ayrica kapatmaya gerek yok.
  if (yanEkran === 'profil') {
    return (
      <SafeAreaView style={stil.ekran}>
        <StatusBar hidden />
        <Profil
          onKapat={() => setYanEkran('yok')}
          onMasayaKatil={(kod) => void oda.masayaKatil(kod)}
        />
      </SafeAreaView>
    );
  }

  // MASA BUL. Oturmayi basarirsa `oda.masa` dolar ve yukaridaki dallardan biri
  // devralir; bu yuzden ekrani ayrica kapatmaya gerek yok.
  if (yanEkran === 'masaBul') {
    return (
      <SafeAreaView style={stil.ekran}>
        <StatusBar hidden />
        <MasaBul
          masalariGetir={oda.acikMasalar}
          onKatil={(kod) => void oda.masayaKatil(kod)}
          onMasaAc={() => void oda.masaKur(false)}
          onKapat={() => setYanEkran('yok')}
          mesgul={oda.mesgul}
          hata={oda.hata}
        />
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
        onMasaBul={() => setYanEkran('masaBul')}
        onMasaAc={() => void oda.masaKur(true)}
        onKatil={(kod) => void oda.masayaKatil(kod)}
        onAlistirma={() => {
          setYanEkran('alistirma');
          setOgreticiKarari('bilinmiyor');
          void ogreticiSorulduMu().then((soruldu) =>
            setOgreticiKarari(soruldu ? 'ogreticisiz' : 'sor'),
          );
        }}
        onOgretici={() => {
          setYanEkran('alistirma');
          setOgreticiKarari('ogreticili');
        }}
        onProfil={() => setYanEkran('profil')}
        arkadaslar={kimlik.arkadaslar}
      />
    </SafeAreaView>
  );
}

const stil = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renkler.arka },
  perde: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  perdeYazi: { color: renkler.metinSolgun, fontSize: 12, letterSpacing: 1 },
});
