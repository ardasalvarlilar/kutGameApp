import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { OYUNCULAR, type ElSonucu, type OyuncuId, type OyuncuKaydi } from '@kut/engine';
import { renkler } from '../tema';

/**
 * El sonu ve mac sonu puan tablosu.
 *
 * KURALLAR.md §8 — her elin sonunda oyuncunun istakasinda kalan taslarin
 * toplami ceza olarak yazilir; acamayan iki kati, biri okeyle bittiyse yine
 * iki kati (ikisi birden dort kat) yazar. Eli bitiren -100 alir.
 *
 * Tablo bunlari AYRISTIRARAK gosteriyor: oyuncu neden o puani aldigini
 * gorebilmeli, yoksa carpanlar keyfi hissettiriyor.
 */
interface Ozellikler {
  readonly sonuc: ElSonucu;
  readonly adlar: Readonly<Record<OyuncuId, string>>;
  readonly macPuanlari: OyuncuKaydi<number>;
  readonly tur: number;
  /** Mac bittiyse kazananlar; bitmediyse bos. */
  readonly macKazananlari: readonly OyuncuId[];
  /** Sonraki ele gecmeden once beklenecek sure (sn). Mac bittiyse yok. */
  readonly geriSayimSn?: number;
  /**
   * Sonraki eli baslatan islev — ya da null.
   *
   * null demek "sonraki eli sunucu dagitiyor": o zaman basilabilir bir dugme
   * yerine isleyen bir geri sayim gosteriliyor. Cevrimici oyunda calismayan
   * bir dugme koymak, oyuncuya "bastim, olmadi" dedirtiyordu.
   */
  readonly onSonrakiTur: (() => void) | null;
  readonly onYeniMac: () => void;
}

export function PuanTablosu({
  sonuc,
  adlar,
  macPuanlari,
  tur,
  macKazananlari,
  geriSayimSn,
  onSonrakiTur,
  onYeniMac,
}: Ozellikler) {
  const macBitti = macKazananlari.length > 0;
  const [kalan, setKalan] = useState(geriSayimSn ?? 0);

  // Mac bitmediyse geri sayim isler. Sifirlaninca sonraki ele gecilir — ama
  // yalnizca ilerletme BIZDEYSE. Cevrimici oyunda eli sunucu dagitir ve yeni
  // gorunum geldiginde bu tablo zaten kapanir.
  useEffect(() => {
    if (macBitti || geriSayimSn === undefined) return;
    setKalan(geriSayimSn);
    const sayac = setInterval(() => {
      setKalan((onceki) => {
        if (onceki <= 1) {
          clearInterval(sayac);
          if (onSonrakiTur !== null) onSonrakiTur();
          return 0;
        }
        return onceki - 1;
      });
    }, 1000);
    return () => clearInterval(sayac);
  }, [macBitti, geriSayimSn, onSonrakiTur]);

  const siralama = [...OYUNCULAR].sort((a, b) => macPuanlari[a] - macPuanlari[b]);

  return (
    <View style={stil.perde}>
      <View style={stil.kutu}>
        <Text style={stil.baslik}>
          {macBitti ? 'MAÇ BİTTİ' : `TUR ${tur} SONUCU`}
        </Text>
        <Text style={stil.altBaslik}>
          {macBitti
            ? `${macKazananlari.map((o) => adlar[o]).join(' ve ')} kazandı — en düşük puan`
            : sonuc.kazanan === null
              ? 'Deste tükendi — kazanan yok'
              : `${adlar[sonuc.kazanan]} bitirdi${sonuc.okeyleBitti ? ' · okeyle!' : ''}`}
        </Text>

        <ScrollView style={stil.kaydirici} showsVerticalScrollIndicator={false}>
          <View style={stil.satir}>
            <Text style={[stil.baslikHucre, stil.adSutunu]}>OYUNCU</Text>
            {!macBitti ? <Text style={stil.baslikHucre}>ELDE</Text> : null}
            {!macBitti ? <Text style={stil.baslikHucre}>×</Text> : null}
            {!macBitti ? <Text style={stil.baslikHucre}>BU EL</Text> : null}
            <Text style={[stil.baslikHucre, stil.toplamSutunu]}>TOPLAM</Text>
          </View>

          {siralama.map((oyuncu, sira) => {
            const detay = sonuc.detaylar[oyuncu];
            const kazandi = macBitti && macKazananlari.includes(oyuncu);
            return (
              <View key={oyuncu} style={[stil.satir, kazandi && stil.kazananSatir]}>
                <Text style={[stil.hucre, stil.adSutunu, kazandi && stil.kazananMetin]}>
                  {macBitti ? `${sira + 1}. ` : ''}
                  {adlar[oyuncu]}
                </Text>
                {!macBitti ? <Text style={stil.hucre}>{detay.hamCeza}</Text> : null}
                {!macBitti ? (
                  <Text style={[stil.hucre, detay.carpan > 1 && stil.carpanVurgu]}>
                    {detay.carpan}
                  </Text>
                ) : null}
                {!macBitti ? (
                  <Text style={[stil.hucre, sonuc.puanlar[oyuncu] < 0 && stil.eksiPuan]}>
                    {sonuc.puanlar[oyuncu]}
                  </Text>
                ) : null}
                <Text
                  style={[
                    stil.hucre,
                    stil.toplamSutunu,
                    stil.toplamMetin,
                    kazandi && stil.kazananMetin,
                  ]}
                >
                  {macPuanlari[oyuncu]}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {/* Cezanin nereden geldigi acikca yazsin; carpan keyfi gorunmesin. */}
        {!macBitti ? (
          <Text style={stil.aciklama}>
            Elde kalan sayılar × çarpan. Açamayan ×2, biri okeyle bitmişse ×2 —
            ikisi birden ×4. Bitiren −100.
          </Text>
        ) : (
          <Text style={stil.aciklama}>16 tur tamamlandı. En düşük puan kazanır.</Text>
        )}

        <View style={stil.dugmeler}>
          {macBitti ? (
            <Pressable onPress={onYeniMac} style={[stil.dugme, stil.dugmeVurgu]}>
              <Text style={stil.dugmeMetinVurgu}>YENİ MAÇ</Text>
            </Pressable>
          ) : onSonrakiTur !== null ? (
            <Pressable onPress={onSonrakiTur} style={[stil.dugme, stil.dugmeVurgu]}>
              <Text style={stil.dugmeMetinVurgu}>
                SONRAKİ TUR{kalan > 0 ? ` (${kalan})` : ''}
              </Text>
            </Pressable>
          ) : (
            <View style={[stil.dugme, stil.bekleme]}>
              <Text style={stil.beklemeMetin}>
                {kalan > 0 ? `SONRAKİ EL ${kalan} SN İÇİNDE` : 'EL DAĞITILIYOR…'}
              </Text>
            </View>
          )}
        </View>
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
    backgroundColor: 'rgba(7, 28, 42, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  kutu: {
    width: '86%',
    maxWidth: 460,
    backgroundColor: renkler.panelKoyu,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: renkler.kenar,
    padding: 12,
    gap: 6,
  },
  baslik: { color: renkler.vurgu, fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  bekleme: { backgroundColor: renkler.arkaKoyu, borderWidth: 1, borderColor: renkler.kenar },
  beklemeMetin: { color: renkler.metinSolgun, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  altBaslik: { color: renkler.metin, fontSize: 11, marginBottom: 2 },

  kaydirici: { maxHeight: 150 },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: renkler.kenar,
  },
  kazananSatir: { backgroundColor: 'rgba(79, 191, 135, 0.14)' },
  baslikHucre: {
    flex: 1,
    color: renkler.metinSolgun,
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  hucre: { flex: 1, color: renkler.metin, fontSize: 13, textAlign: 'center' },
  adSutunu: { flex: 2, textAlign: 'left', paddingLeft: 4 },
  toplamSutunu: { flex: 1.3 },
  toplamMetin: { fontWeight: '800' },
  carpanVurgu: { color: renkler.uyari, fontWeight: '800' },
  eksiPuan: { color: renkler.onay, fontWeight: '800' },
  kazananMetin: { color: renkler.onay, fontWeight: '800' },

  aciklama: { color: renkler.metinSolgun, fontSize: 9, lineHeight: 13, marginTop: 2 },

  dugmeler: { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
  dugme: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: renkler.kenar,
    backgroundColor: renkler.panel,
  },
  dugmeVurgu: { backgroundColor: renkler.vurgu, borderColor: renkler.vurgu },
  dugmeMetinVurgu: { color: '#2a2000', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
});
