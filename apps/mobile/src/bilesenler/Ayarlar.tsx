// Masa ustundeki ayarlar penceresi.
//
// Uc is goruyor: ses anahtari, masadan cikis ve OYUNCU BILDIRME/ENGELLEME.
//
// Sonuncusu App Store Review Guideline 1.2'nin karsiligi: kullanici uretimi
// icerik (burada gorunen ad) barindiran her uygulamada, rahatsiz eden bir
// kullaniciyi bildirmenin ve engellemenin bir yolu OLMAK ZORUNDA. Yeri
// bilerek masa icinde: sikayet edilecek kisi tam da orada oturuyor, oyuncuyu
// lobiye geri gonderip listede aratmak ise yaramaz.
//
// Cevrimdisi masada oyuncu listesi hic gosterilmiyor: yer tutucularin hesabi
// yok, bildirilecek kimse yok.

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SIKAYET_METINLERI, SIKAYET_SEBEPLERI, type SikayetSebebi } from '../ag/api';
import { renkler } from '../tema';

/** Masadaki baska bir oyuncu — bildirmek ve engellemek icin gereken en az bilgi. */
export interface MasadakiOyuncu {
  readonly oyuncuId: string;
  readonly ad: string;
}

interface Ozellikler {
  readonly sesAcik: boolean;
  readonly onSes: (acik: boolean) => void;
  readonly onMasadanCik: () => void;
  readonly onKapat: () => void;
  /** Oyun sunucuda mi kosuyor? Cikis ipucu buna gore degisiyor. */
  readonly cevrimici?: boolean;
  /** Masadaki DIGER oyuncular. Cevrimdisi oyunda bos. */
  readonly digerOyuncular?: readonly MasadakiOyuncu[];
  readonly engellenenIdler?: readonly string[];
  readonly onSikayet?: (oyuncuId: string, sebep: SikayetSebebi) => void;
  readonly onEngelle?: (oyuncuId: string) => void;
}

export function Ayarlar({
  sesAcik,
  onSes,
  onMasadanCik,
  onKapat,
  cevrimici = true,
  digerOyuncular = [],
  engellenenIdler = [],
  onSikayet,
  onEngelle,
}: Ozellikler) {
  /** Sebep listesi acilan oyuncu; hicbiri acik degilse null. */
  const [sebepSecilen, setSebepSecilen] = useState<string | null>(null);
  const [bildirilenler, setBildirilenler] = useState<readonly string[]>([]);

  const bildir = (oyuncuId: string, sebep: SikayetSebebi): void => {
    onSikayet?.(oyuncuId, sebep);
    setSebepSecilen(null);
    setBildirilenler((onceki) => [...onceki, oyuncuId]);
  };

  return (
    <View style={stil.perde}>
      <View style={stil.kutu}>
        <View style={stil.baslikSatiri}>
          <Text style={stil.baslik}>AYARLAR</Text>
          <Pressable onPress={onKapat} style={stil.kapat} hitSlop={8}>
            <Text style={stil.kapatMetin}>✕</Text>
          </Pressable>
        </View>

        <ScrollView style={stil.kaydirici} showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => onSes(!sesAcik)} style={stil.satir}>
            <Text style={stil.satirMetin}>Ses</Text>
            <View style={[stil.anahtar, sesAcik && stil.anahtarAcik]}>
              <Text style={[stil.anahtarMetin, sesAcik && stil.anahtarMetinAcik]}>
                {sesAcik ? 'AÇIK' : 'KAPALI'}
              </Text>
            </View>
          </Pressable>

          {digerOyuncular.length > 0 ? (
            <>
              <Text style={stil.bolum}>MASADAKİLER</Text>
              {digerOyuncular.map((kisi) => {
                const engelli = engellenenIdler.includes(kisi.oyuncuId);
                const bildirildi = bildirilenler.includes(kisi.oyuncuId);
                const acik = sebepSecilen === kisi.oyuncuId;
                return (
                  <View key={kisi.oyuncuId} style={stil.oyuncuKutu}>
                    <View style={stil.oyuncuSatiri}>
                      <Text style={stil.oyuncuAd} numberOfLines={1}>
                        {kisi.ad}
                      </Text>
                      <Pressable
                        onPress={() => setSebepSecilen(acik ? null : kisi.oyuncuId)}
                        style={stil.kucukDugme}
                        hitSlop={4}
                      >
                        <Text style={stil.kucukMetin}>
                          {bildirildi ? 'BİLDİRİLDİ' : 'BİLDİR'}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={engelli ? undefined : () => onEngelle?.(kisi.oyuncuId)}
                        style={[stil.kucukDugme, engelli && stil.kucukPasif]}
                        hitSlop={4}
                      >
                        <Text style={[stil.kucukMetin, stil.tehlikeMetin]}>
                          {engelli ? 'ENGELLİ' : 'ENGELLE'}
                        </Text>
                      </Pressable>
                    </View>

                    {acik ? (
                      <View style={stil.sebepler}>
                        <Text style={stil.sebepBaslik}>Sebep nedir?</Text>
                        {SIKAYET_SEBEPLERI.map((sebep) => (
                          <Pressable
                            key={sebep}
                            onPress={() => bildir(kisi.oyuncuId, sebep)}
                            style={stil.sebep}
                          >
                            <Text style={stil.sebepMetin}>{SIKAYET_METINLERI[sebep]}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
              <Text style={stil.ipucu}>
                Engellediğin oyuncuyla bir daha aynı masaya düşmezsin.
              </Text>
            </>
          ) : null}

          {/* Cevrimicide ipucu bilerek "el kaybolur" DEGIL: koltuk bosalmiyor
              (MIMARI.md §3), dort koltuk dolu olmadan motor ilerleyemez ve
              cikan biri masayi kilitlerdi. Cevrimdisi masada sunucu yok, el
              gercekten bitiyor — ayni cumleyi orada yazmak yalan olurdu. */}
          <Pressable onPress={onMasadanCik} style={[stil.satir, stil.cikis]}>
            <Text style={[stil.satirMetin, stil.cikisMetin]}>Masadan çık</Text>
            <Text style={stil.cikisIpucu}>
              {cevrimici ? 'yerine sunucu oynar' : 'el biter'}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );
}

const stil = StyleSheet.create({
  perde: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(7, 28, 42, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  kutu: {
    width: 300,
    maxHeight: '92%',
    backgroundColor: renkler.panelKoyu,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: renkler.kenar,
    padding: 12,
    gap: 8,
  },
  kaydirici: { flexGrow: 0 },
  baslikSatiri: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  baslik: { color: renkler.vurgu, fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  kapat: { paddingHorizontal: 4 },
  kapatMetin: { color: renkler.metinSolgun, fontSize: 16, fontWeight: '800' },

  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: renkler.panel,
    borderWidth: 1,
    borderColor: renkler.kenar,
    marginTop: 6,
  },
  satirMetin: { color: renkler.metin, fontSize: 13, fontWeight: '700' },
  anahtar: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: renkler.arkaKoyu,
    borderWidth: 1,
    borderColor: renkler.kenar,
  },
  anahtarAcik: { backgroundColor: renkler.onay, borderColor: renkler.onay },
  anahtarMetin: { color: renkler.metinSolgun, fontSize: 10, fontWeight: '800' },
  anahtarMetinAcik: { color: '#0b2739' },

  bolum: {
    color: renkler.metinSolgun,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 2,
  },
  oyuncuKutu: {
    backgroundColor: renkler.panel,
    borderWidth: 1,
    borderColor: renkler.kenar,
    borderRadius: 8,
    padding: 6,
    marginTop: 4,
  },
  oyuncuSatiri: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  oyuncuAd: { flex: 1, color: renkler.metin, fontSize: 12, fontWeight: '700' },
  kucukDugme: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: renkler.kenar,
    backgroundColor: renkler.arkaKoyu,
  },
  kucukPasif: { opacity: 0.45 },
  kucukMetin: { color: renkler.metinSolgun, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  tehlikeMetin: { color: renkler.uyari },

  sebepler: { marginTop: 6, gap: 3 },
  sebepBaslik: { color: renkler.metinSolgun, fontSize: 9, fontWeight: '700' },
  sebep: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: renkler.arkaKoyu,
    borderWidth: 1,
    borderColor: renkler.kenar,
  },
  sebepMetin: { color: renkler.metin, fontSize: 11 },
  ipucu: { color: renkler.metinSolgun, fontSize: 9, marginTop: 6 },

  cikis: { borderColor: renkler.uyari, marginTop: 12 },
  cikisMetin: { color: renkler.uyari },
  cikisIpucu: { color: renkler.metinSolgun, fontSize: 9 },
});
