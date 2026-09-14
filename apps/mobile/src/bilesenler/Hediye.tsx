// Hediye cip — uygulamayi acan oyuncuya, uzaktayken biriken cip.
//
// Kurallar @kut/ekonomi hediye.ts'te: saatte 100 cip, en fazla 48 saat.
// Toplama sunucuda ve atomik; bu ekran yalnizca gosteriyor ve istiyor.
//
// Iki parca: lobinin sol altinda birikimi gosteren kucuk dugme ve toplama
// penceresi. Pencere, birikim varsa uygulama acilisinda BIR KEZ kendiliginden
// aciliyor (modul seviyesindeki bayrak: lobiden cikip donunce tekrar
// acilmasin). Kapatan oyuncu dugmeden yine acabiliyor.
//
// Reklam: `odulluReklam.hazirMi()` true olunca "REKLAM IZLE" dugmesi cikiyor.
// Ek cipi sunucu, reklam aginin imzali geri cagrisiyla veriyor (src/reklam.ts).

import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useKimlik } from '../ag/kimlik';
import type { HediyeDurumu } from '../ag/protokol';
import { cipKisa, cipYaz } from '../cip';
import { useCeviri } from '../dil';
import { hataMetni } from '../hataMetinleri';
import { odulluReklam } from '../reklam';
import { golge, renkler } from '../tema';

/** Uygulama oturumunda pencere kendiliginden acildi mi? */
let otomatikAcildi = false;

/** Reklamdan sonra sunucunun odulu yazmasi icin taninan sure (ms). */
const REKLAM_ODULU_BEKLEMESI_MS = 3_000;

export function Hediye() {
  const kimlik = useKimlik();
  const t = useCeviri();
  const [durum, setDurum] = useState<HediyeDurumu | null>(null);
  const [acik, setAcik] = useState(false);
  const [mesgul, setMesgul] = useState(false);
  const [bilgi, setBilgi] = useState<string | null>(null);

  const tazele = useCallback(async (): Promise<void> => {
    const yeni = await kimlik.hediyeDurumuGetir();
    setDurum(yeni);
    if (yeni !== null && yeni.miktar > 0 && !otomatikAcildi) {
      otomatikAcildi = true;
      setAcik(true);
    }
  }, [kimlik]);

  useEffect(() => {
    void tazele();
  }, [tazele]);

  // Lobide beklerken saat dolarsa dugme kendiliginden belirsin.
  useEffect(() => {
    if (durum === null || durum.sonrakiSaatMs === null || durum.miktar > 0) return;
    const sayac = setTimeout(() => void tazele(), durum.sonrakiSaatMs + 1_000);
    return () => clearTimeout(sayac);
  }, [durum, tazele]);

  const topla = async (reklamla: boolean): Promise<void> => {
    setMesgul(true);
    setBilgi(null);
    const sonuc = await kimlik.hediyeTopla();
    if (typeof sonuc === 'string') {
      setMesgul(false);
      setBilgi(hataMetni(sonuc, t));
      return;
    }

    let metin = t('hediye.alindi', { miktar: cipYaz(sonuc.kazanilan) });
    if (reklamla && kimlik.oyuncu !== null) {
      const izleme = await odulluReklam.goster({
        fisKimligi: sonuc.fis.kimlik,
        oyuncuId: kimlik.oyuncu.id,
      });
      if (izleme === 'izlendi') {
        metin = t('hediye.reklamBekleniyor');
        // Ek cip sunucuya reklam aginin geri cagrisiyla geliyor; biraz sonra
        // bakiyeyi tazele.
        setTimeout(() => void kimlik.oyuncuyuTazele(), REKLAM_ODULU_BEKLEMESI_MS);
      }
    }

    setMesgul(false);
    setBilgi(metin);
    setAcik(false);
    void tazele();
  };

  const miktar = durum?.miktar ?? 0;
  const reklamVar = odulluReklam.hazirMi();

  return (
    <>
      {miktar > 0 && !acik ? (
        <Pressable
          onPress={() => setAcik(true)}
          style={({ pressed }) => [stil.dugme, pressed && stil.basili]}
        >
          <Text style={stil.dugmeSimge}>🎁</Text>
          <Text style={stil.dugmeYazi}>{t('hediye.dugme', { miktar: cipKisa(miktar) })}</Text>
        </Pressable>
      ) : null}

      {bilgi !== null && !acik ? (
        <Pressable onPress={() => setBilgi(null)} style={stil.bilgi}>
          <Text style={stil.bilgiYazi}>{bilgi}</Text>
        </Pressable>
      ) : null}

      {acik && durum !== null ? (
        <View style={stil.perde}>
          <View style={stil.kutu}>
            <Text style={stil.baslik}>{t('hediye.baslik')}</Text>
            <Text style={stil.altBaslik}>{t('hediye.birikti')}</Text>
            <View style={stil.cipDaire} />
            <Text style={stil.miktar}>+{cipYaz(miktar)}</Text>
            <Text style={stil.aciklama}>
              {durum.tavanda
                ? t('hediye.tavanda')
                : t('hediye.aciklama', {
                    saatlik: cipYaz(durum.saatlik),
                    tavan: durum.tavanSaat,
                    tavanMiktar: cipYaz(durum.saatlik * durum.tavanSaat),
                  })}
            </Text>

            <View style={stil.dugmeler}>
              <Pressable
                onPress={mesgul ? undefined : () => void topla(false)}
                style={[stil.ana, mesgul && stil.pasif]}
              >
                <Text style={stil.anaYazi}>{t('hediye.al')}</Text>
              </Pressable>
              {reklamVar ? (
                <Pressable
                  onPress={mesgul ? undefined : () => void topla(true)}
                  style={[stil.ana, stil.reklam, mesgul && stil.pasif]}
                >
                  <Text style={stil.anaYazi}>
                    {t('hediye.reklamla', { miktar: cipYaz(miktar * durum.reklamCarpani) })}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable onPress={() => setAcik(false)} hitSlop={8}>
              <Text style={stil.sonra}>{t('hediye.sonra')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </>
  );
}

const stil = StyleSheet.create({
  dugme: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: renkler.panel,
    borderWidth: 1,
    borderColor: renkler.vurgu,
    ...golge.yukseltilmis,
  },
  dugmeSimge: { fontSize: 15 },
  dugmeYazi: { color: renkler.vurgu, fontSize: 13, fontWeight: '900' },
  basili: { opacity: 0.85, transform: [{ scale: 0.97 }] },

  bilgi: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    maxWidth: 260,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: renkler.panelKoyu,
    borderWidth: 1,
    borderColor: renkler.onay,
  },
  bilgiYazi: { color: renkler.onay, fontSize: 11, fontWeight: '800' },

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
    width: 320,
    maxWidth: '100%',
    alignItems: 'center',
    gap: 6,
    backgroundColor: renkler.panelKoyu,
    borderWidth: 1,
    borderColor: renkler.vurguKoyu,
    borderRadius: 14,
    padding: 16,
    ...golge.yukseltilmis,
  },
  baslik: { color: renkler.vurgu, fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  altBaslik: { color: renkler.metin, fontSize: 12 },
  cipDaire: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: renkler.vurgu,
    borderWidth: 5,
    borderColor: renkler.vurguKoyu,
    marginTop: 4,
  },
  miktar: { color: renkler.onay, fontSize: 28, fontWeight: '900' },
  aciklama: { color: renkler.metinSolgun, fontSize: 10, lineHeight: 14, textAlign: 'center' },

  dugmeler: { flexDirection: 'row', gap: 8, marginTop: 6, alignSelf: 'stretch' },
  ana: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: renkler.vurgu,
  },
  reklam: { backgroundColor: renkler.onay },
  anaYazi: { color: '#1a1400', fontSize: 13, fontWeight: '900', letterSpacing: 0.6 },
  pasif: { opacity: 0.5 },
  sonra: { color: renkler.metinSolgun, fontSize: 11, fontWeight: '800', marginTop: 4 },
});
