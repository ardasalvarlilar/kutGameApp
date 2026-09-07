// Arkadaslar — profil ekraninin bir sekmesi.
//
// Uc bolum: EKLE (kod), gelen istekler, liste.
//
// --- Neden kodla ekleniyor ---------------------------------------------------
//
// Gorunen ad benzersiz degil; "Ahmet" yazan on kisi cikiyor ve hangisinin
// arkadasin oldugunu ayirt etmenin yolu yok. E-posta ile aramak ise girilen
// adresin kayitli olup olmadigini sizdirir — adres toplamanin en kolay yolu
// olurdu. Kod paylasmak iradi bir hareket: kodu veren zaten bulunmak istiyor.
// (Ayni not sunucuda: servisler/arkadasServisi.ts.)
//
// --- Neden liste sunucudan geliyor -------------------------------------------
//
// Durum degistiren her uc GUNCEL LISTEYI de donuyor, bu yuzden bu ekran
// islemden sonra ayrica tazeleme istemiyor. Iki istek arasinda eskimis liste
// gostermenin onune geciyor.

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alan, AnaDugme, Hata } from './Alan';
import { Avatar } from './Avatar';
import type { ArkadasDurumu, BulunanOyuncu } from '../ag/api';
import { useKimlik } from '../ag/kimlik';
import { sonGorulmeMetni } from '../zaman';
import { renkler } from '../tema';

/** Arama sonucundaki iliskiye gore ne yazacagi. */
const ILISKI_METINLERI: Record<BulunanOyuncu['iliski'], string> = {
  yok: '',
  bekliyor: 'İstek gönderildi, cevap bekleniyor',
  'istek-geldi': 'Sana istek göndermiş — aşağıdan kabul et',
  arkadas: 'Zaten arkadaşsınız',
  ben: 'Bu senin kendi kodun',
};

function Satir({
  ad,
  altYazi,
  children,
}: {
  readonly ad: string;
  readonly altYazi: string;
  readonly children: React.ReactNode;
}) {
  return (
    <View style={stil.satir}>
      <Avatar ad={ad} boy={30} />
      <View style={stil.satirBilgi}>
        <Text style={stil.satirAd} numberOfLines={1}>
          {ad}
        </Text>
        <Text style={stil.satirAlt} numberOfLines={1}>
          {altYazi}
        </Text>
      </View>
      <View style={stil.satirDugmeler}>{children}</View>
    </View>
  );
}

function KucukDugme({
  etiket,
  onBas,
  tur = 'sade',
}: {
  readonly etiket: string;
  readonly onBas: () => void;
  readonly tur?: 'sade' | 'vurgu' | 'tehlike';
}) {
  return (
    <Pressable
      onPress={onBas}
      style={({ pressed }) => [
        stil.kucukDugme,
        tur === 'vurgu' && stil.kucukVurgu,
        tur === 'tehlike' && stil.kucukTehlike,
        pressed && stil.basili,
      ]}
    >
      <Text
        style={[
          stil.kucukYazi,
          tur === 'vurgu' && stil.kucukYaziVurgu,
          tur === 'tehlike' && stil.kucukYaziTehlike,
        ]}
      >
        {etiket}
      </Text>
    </Pressable>
  );
}

export interface ArkadaslarOzellikleri {
  /** Arkadasin masasina katilma — lobiye donup kodla katiliyor. */
  readonly onMasayaKatil: (kod: string) => void;
}

export function Arkadaslar({ onMasayaKatil }: ArkadaslarOzellikleri) {
  const kimlik = useKimlik();
  const [kod, setKod] = useState('');
  const [bulunan, setBulunan] = useState<BulunanOyuncu | null>(null);
  const [arandi, setArandi] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  const [an, setAn] = useState(() => Date.now());

  // Ekran acilinca listeyi tazele: baska bir cihazdan gelen istek gorunsun.
  useEffect(() => {
    void kimlik.arkadaslariTazele();
    setAn(Date.now());
    // `kimlik` her renderda yeni bir nesne olabiliyor; bagimliligi
    // fonksiyona daraltmak effect'in bir kez kosmasini garanti ediyor.
  }, [kimlik.arkadaslariTazele]); // eslint-disable-line react-hooks/exhaustive-deps

  const durum: ArkadasDurumu | null = kimlik.arkadaslar;

  async function calistir(is: () => Promise<string | null>): Promise<void> {
    setBekliyor(true);
    setHata(null);
    const sorun = await is();
    setBekliyor(false);
    if (sorun !== null) setHata(sorun);
  }

  async function ara(): Promise<void> {
    setBekliyor(true);
    setHata(null);
    setArandi(false);
    const sonuc = await kimlik.arkadasAra(kod);
    setBekliyor(false);
    setArandi(true);
    if (typeof sonuc === 'string') {
      setBulunan(null);
      setHata(sonuc);
      return;
    }
    setBulunan(sonuc);
  }

  async function ekle(oyuncuId: string): Promise<void> {
    await calistir(() => kimlik.arkadasIstegi(oyuncuId));
    setBulunan(null);
    setArandi(false);
    setKod('');
  }

  if (durum === null) {
    return (
      <View style={stil.govde}>
        <Text style={stil.bos}>Arkadaş listesi yükleniyor…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={stil.govde} keyboardShouldPersistTaps="handled">
      {/* --- Kendi kodum --------------------------------------------------- */}
      <View style={stil.kodKutusu}>
        <Text style={stil.bolum}>SENİN KODUN</Text>
        <Text style={stil.kodum} selectable>
          {durum.kodum}
        </Text>
        <Text style={stil.ipucu}>Bu kodu paylaş; arkadaşın seni buradan ekleyebilir.</Text>
      </View>

      {/* --- Kodla ekleme -------------------------------------------------- */}
      <Text style={stil.bolum}>ARKADAŞ EKLE</Text>
      <Alan
        etiket="Arkadaşının kodu"
        value={kod}
        onChangeText={(yazi) => setKod(yazi.toLocaleUpperCase('tr-TR'))}
        placeholder="KUT-7F3A9"
        maxLength={16}
        autoCapitalize="characters"
        onSubmitEditing={() => void ara()}
        returnKeyType="search"
      />
      <AnaDugme
        etiket="ARA"
        onBas={() => void ara()}
        aktif={kod.trim().length >= 3 && !bekliyor}
        bekliyor={bekliyor}
        tur="sade"
      />

      {arandi && bulunan === null && hata === null ? (
        <Text style={stil.bos}>Bu kodla bir oyuncu bulunamadı.</Text>
      ) : null}

      {bulunan !== null ? (
        <Satir ad={bulunan.ad} altYazi={ILISKI_METINLERI[bulunan.iliski]}>
          {bulunan.iliski === 'yok' ? (
            <KucukDugme etiket="EKLE" tur="vurgu" onBas={() => void ekle(bulunan.id)} />
          ) : bulunan.iliski === 'istek-geldi' ? (
            <KucukDugme
              etiket="KABUL"
              tur="vurgu"
              onBas={() => void calistir(() => kimlik.arkadasKabul(bulunan.id))}
            />
          ) : null}
        </Satir>
      ) : null}

      <Hata metin={hata} />

      {/* --- Gelen istekler ------------------------------------------------ */}
      {durum.gelenIstekler.length > 0 ? (
        <>
          <Text style={stil.bolum}>GELEN İSTEKLER</Text>
          {durum.gelenIstekler.map((kisi) => (
            <Satir key={kisi.id} ad={kisi.ad} altYazi={sonGorulmeMetni(kisi.zaman, an)}>
              <KucukDugme
                etiket="KABUL"
                tur="vurgu"
                onBas={() => void calistir(() => kimlik.arkadasKabul(kisi.id))}
              />
              <KucukDugme
                etiket="SİL"
                onBas={() => void calistir(() => kimlik.arkadasSil(kisi.id))}
              />
            </Satir>
          ))}
        </>
      ) : null}

      {/* --- Arkadaslar ---------------------------------------------------- */}
      <Text style={stil.bolum}>ARKADAŞLARIN ({durum.arkadaslar.length})</Text>
      {durum.arkadaslar.length === 0 ? (
        <Text style={stil.bos}>Henüz kimseyi eklemedin.</Text>
      ) : (
        durum.arkadaslar.map((kisi) => (
          <Satir
            key={kisi.id}
            ad={kisi.ad}
            altYazi={
              kisi.masaKodu !== null
                ? `masası açık · ${kisi.masaKodu}`
                : sonGorulmeMetni(kisi.sonGorulme, an)
            }
          >
            {kisi.masaKodu !== null ? (
              <KucukDugme
                etiket="KATIL"
                tur="vurgu"
                onBas={() => onMasayaKatil(kisi.masaKodu as string)}
              />
            ) : null}
            <KucukDugme
              etiket="ÇIKAR"
              tur="tehlike"
              onBas={() => void calistir(() => kimlik.arkadasSil(kisi.id))}
            />
          </Satir>
        ))
      )}

      {/* --- Giden istekler ------------------------------------------------ */}
      {durum.gidenIstekler.length > 0 ? (
        <>
          <Text style={stil.bolum}>GÖNDERDİKLERİN</Text>
          {durum.gidenIstekler.map((kisi) => (
            <Satir key={kisi.id} ad={kisi.ad} altYazi="cevap bekleniyor">
              <KucukDugme
                etiket="VAZGEÇ"
                onBas={() => void calistir(() => kimlik.arkadasSil(kisi.id))}
              />
            </Satir>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

const stil = StyleSheet.create({
  govde: { gap: 7, paddingBottom: 16 },

  kodKutusu: {
    backgroundColor: renkler.panelKoyu,
    borderWidth: 1,
    borderColor: renkler.kenar,
    borderRadius: 10,
    padding: 10,
    gap: 2,
  },
  kodum: { color: renkler.vurgu, fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  ipucu: { color: renkler.metinSolgun, fontSize: 10, lineHeight: 14 },

  bolum: {
    color: renkler.metinSolgun,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 8,
  },
  bos: { color: renkler.metinSolgun, fontSize: 11 },

  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: renkler.panel,
    borderWidth: 1,
    borderColor: renkler.kenar,
    borderRadius: 9,
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: 5,
  },
  satirBilgi: { flex: 1 },
  satirAd: { color: renkler.metin, fontSize: 12, fontWeight: '700' },
  satirAlt: { color: renkler.metinSolgun, fontSize: 10 },
  satirDugmeler: { flexDirection: 'row', gap: 5 },

  kucukDugme: {
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: renkler.panelKoyu,
    borderWidth: 1,
    borderColor: renkler.kenar,
  },
  kucukVurgu: { backgroundColor: renkler.vurgu, borderColor: renkler.vurgu },
  kucukTehlike: { backgroundColor: 'transparent', borderColor: renkler.uyari },
  basili: { opacity: 0.7 },
  kucukYazi: { color: renkler.metin, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  kucukYaziVurgu: { color: '#2a2000' },
  kucukYaziTehlike: { color: renkler.uyari },
});
