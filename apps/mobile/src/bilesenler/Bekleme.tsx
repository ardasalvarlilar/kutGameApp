// Bekleme odasi — masa kuruldu, oyun baslamayi bekliyor.
//
// Ekranin isi sadece "kimin geldigini saymak" degil: MASANIN DUZENI burada
// kuruluyor.
//
// --- Neden koltuk seciliyor --------------------------------------------------
//
// Kimin nerede oturdugu oyunun kendisini degistiriyor. Attigin tasi SAGINDA
// oturan bedelsiz alir (KURALLAR.md §4, §5) ve calma onceligi koltuk
// sirasindan cikar. "Atilan her tasi alan arkadasimin sagina oturmak
// istemiyorum" gercek bir tercih; masada elle koltuk degistirmenin
// karsiligi bu ekranda olmaliydi.
//
//   bos koltuk  → dokun, otur. Kimsenin onayina gerek yok.
//   dolu koltuk → oturanla DEGISTIRME TALEBI. Kabul ederse koltuklar takas
//                 olur; iki tarafi da ilgilendirdigi icin tek tarafli degil.
//
// --- Neden bot koltugu ------------------------------------------------------
//
// Oyun dort oyuncusuz ilerlemiyor (motor dort koltuk bekliyor) ama dordunun de
// insan olmasi gerekmiyor. Iki arkadas toplandiysa tek secenek iki yabanci
// beklemek olmamali: masayi botlarla doldurup oynayabiliyorlar. Botu sunucu
// oynuyor, karari `@kut/politika`da — cevrimdisi masadaki yer tutucularla ayni
// kod.
//
// "Hazir" varsayilan olarak ACIK geliyor (packages/server masaServisi): dort
// arkadas toplaninca bir de es zamanli "ben hazirim" turu beklemek gereksiz
// bir adimdi. Fikri degisen dugmeyle geri alabiliyor.

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { OyuncuId } from '@kut/engine';
import { AnaDugme, Hata } from './Alan';
import { Avatar } from './Avatar';
import { useCeviri } from '../dil';
import type { KoltukGorunumu, MasaGorunumu } from '../ag/protokol';
import { renkler } from '../tema';

const KAPASITE = 4;
const KOLTUKLAR: readonly OyuncuId[] = [0, 1, 2, 3];

export interface BeklemeOzellikleri {
  readonly masa: MasaGorunumu;
  readonly benimId: string | null;
  readonly mesgul: boolean;
  readonly hata: string | null;
  readonly onHazir: (hazir: boolean) => void;
  readonly onCik: () => void;

  // --- Masa duzeni ---------------------------------------------------------
  readonly onKoltugaGec: (koltuk: OyuncuId) => void;
  readonly onKoltukTalebi: (koltuk: OyuncuId) => void;
  readonly onKoltukCevap: (isteyenId: string, kabul: boolean) => void;
  readonly onBotlariDoldur: () => void;
  readonly onBotuCikar: (koltuk: OyuncuId) => void;
}

/** Koltugun ekrandaki hali — dokununca ne olacagini da belirliyor. */
type KoltukHali = 'bos' | 'benim' | 'baskasi' | 'bot';

function KoltukKarti({
  no,
  koltuk,
  hal,
  bekleyenTalep,
  mesgul,
  sahipMiyim,
  onBas,
  onBotuCikar,
}: {
  readonly no: OyuncuId;
  readonly koltuk: KoltukGorunumu | undefined;
  readonly hal: KoltukHali;
  /** Bu koltuk icin BENIM bekleyen talebim var mi? */
  readonly bekleyenTalep: boolean;
  readonly mesgul: boolean;
  readonly sahipMiyim: boolean;
  readonly onBas: () => void;
  readonly onBotuCikar: () => void;
}) {
  const t = useCeviri();
  const dokunulabilir = !mesgul && (hal === 'bos' || hal === 'baskasi');

  return (
    <Pressable
      onPress={dokunulabilir ? onBas : undefined}
      style={({ pressed }) => [
        stil.koltuk,
        hal === 'bos' && stil.koltukBos,
        hal === 'benim' && stil.koltukBenim,
        pressed && dokunulabilir && stil.basili,
      ]}
    >
      <Text style={stil.koltukNo}>{no + 1}</Text>

      {koltuk === undefined ? (
        <View style={stil.koltukBilgi}>
          <Text style={stil.bosYazi}>{t('bekleme.bosKoltuk')}</Text>
          <Text style={stil.ipucu}>{mesgul ? '…' : t('bekleme.dokunOtur')}</Text>
        </View>
      ) : (
        <>
          <Avatar ad={koltuk.ad} boy={28} />
          <View style={stil.koltukBilgi}>
            <Text style={[stil.koltukAd, hal === 'benim' && stil.koltukBen]} numberOfLines={1}>
              {koltuk.ad}
            </Text>
            <Text style={stil.ipucu}>
              {hal === 'bot'
                ? t('bekleme.sunucuOynuyor')
                : bekleyenTalep
                  ? t('bekleme.talebinBekliyor')
                  : hal === 'baskasi'
                    ? t('bekleme.dokunYeriniIste')
                    : koltuk.bagli
                      ? t(koltuk.hazir ? 'bekleme.hazir' : 'bekleme.hazirDegil')
                      : t('bekleme.baglantiKoptu')}
            </Text>
          </View>
        </>
      )}

      {hal === 'bot' && sahipMiyim ? (
        <Pressable onPress={mesgul ? undefined : onBotuCikar} style={stil.kucukDugme} hitSlop={6}>
          <Text style={stil.kucukYazi}>{t('bekleme.cikar')}</Text>
        </Pressable>
      ) : koltuk !== undefined && hal !== 'bot' ? (
        <View style={[stil.rozet, koltuk.hazir ? stil.rozetHazir : stil.rozetBekler]}>
          <Text style={[stil.rozetYazi, koltuk.hazir && stil.rozetYaziHazir]}>
            {t(koltuk.hazir ? 'bekleme.rozetHazir' : 'bekleme.rozetBekliyor')}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Bekleme({
  masa,
  benimId,
  mesgul,
  hata,
  onHazir,
  onCik,
  onKoltugaGec,
  onKoltukTalebi,
  onKoltukCevap,
  onBotlariDoldur,
  onBotuCikar,
}: BeklemeOzellikleri) {
  const t = useCeviri();
  const benimKoltuk = masa.koltuklar.find((koltuk) => koltuk.oyuncuId === benimId);
  const hazirim = benimKoltuk?.hazir ?? false;
  const sahipMiyim = masa.sahipId === benimId;

  const bosSayisi = KAPASITE - masa.koltuklar.length;
  const insanlar = masa.koltuklar.filter((koltuk) => !koltuk.bot);
  // Masa dolu ama biri "hazir degilim" demis olabilir: sunucu dordu de hazir
  // olmadan eli dagitmiyor. "El birazdan dagitiliyor" demek yanlis olurdu.
  const bekleyenSayisi = insanlar.filter((koltuk) => !koltuk.hazir).length;

  /** BANA gelen talepler: benim oturdugum koltugu isteyenler. */
  const banaGelenler =
    benimKoltuk === undefined
      ? []
      : masa.koltukTalepleri.filter((talep) => talep.hedefKoltuk === benimKoltuk.no);
  /** BENIM gonderdigim talep; bir tane olabilir. */
  const benimTalebim = masa.koltukTalepleri.find((talep) => talep.isteyenId === benimId);

  const adiBul = (oyuncuId: string): string =>
    masa.koltuklar.find((koltuk) => koltuk.oyuncuId === oyuncuId)?.ad ??
    t('bekleme.bilinmeyenOyuncu');

  const koltugaBas = (no: OyuncuId, koltuk: KoltukGorunumu | undefined): void => {
    if (koltuk === undefined) onKoltugaGec(no);
    else if (!koltuk.bot && koltuk.oyuncuId !== benimId) onKoltukTalebi(no);
  };

  return (
    <View style={stil.govde}>
      <View style={stil.sol}>
        <Text style={stil.etiket}>{t('bekleme.masaKodu')}</Text>
        <Text style={stil.kod}>{masa.kod}</Text>
        <Text style={stil.aciklama}>
          {t(masa.ozel ? 'bekleme.ozelAciklama' : 'bekleme.acikAciklama')}
        </Text>
        <Text style={stil.sayac}>
          {bosSayisi > 0
            ? t('bekleme.bosKoltukSayisi', { sayi: bosSayisi })
            : bekleyenSayisi > 0
              ? t('bekleme.hazirOlmayan', { sayi: bekleyenSayisi })
              : t('bekleme.masaDoldu')}
        </Text>

        {/* Botlarla oynama: dort kisi toplanmadan da masa kurulabilsin.
            Yalnizca masayi acan karar veriyor — herkesin doldurabilmesi,
            biri gelmek uzereyken masanin kapanmasi demek olurdu. */}
        {bosSayisi > 0 && sahipMiyim ? (
          <View style={stil.botKutusu}>
            <Text style={stil.botBaslik}>{t('bekleme.botBaslik')}</Text>
            <Text style={stil.botMetin}>{t('bekleme.botMetin')}</Text>
            <AnaDugme
              etiket={t('bekleme.botDoldur', { sayi: bosSayisi })}
              onBas={onBotlariDoldur}
              aktif={!mesgul}
              tur="sade"
            />
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={stil.sag}>
        <Text style={stil.etiket}>{t('bekleme.koltuklar')}</Text>
        <Text style={stil.koltukIpucu}>{t('bekleme.koltukIpucu')}</Text>

        <View style={stil.koltuklar}>
          {KOLTUKLAR.map((no) => {
            const koltuk = masa.koltuklar.find((k) => k.no === no);
            const hal: KoltukHali =
              koltuk === undefined
                ? 'bos'
                : koltuk.bot
                  ? 'bot'
                  : koltuk.oyuncuId === benimId
                    ? 'benim'
                    : 'baskasi';
            return (
              <KoltukKarti
                key={no}
                no={no}
                koltuk={koltuk}
                hal={hal}
                bekleyenTalep={benimTalebim?.hedefKoltuk === no}
                mesgul={mesgul}
                sahipMiyim={sahipMiyim}
                onBas={() => koltugaBas(no, koltuk)}
                onBotuCikar={() => onBotuCikar(no)}
              />
            );
          })}
        </View>

        {/* Gelen talepler: koltugumu isteyen biri var. Onaylarsam yer
            degistiririz — tek tarafli bir tasima degil, TAKAS. */}
        {banaGelenler.map((talep) => (
          <View key={talep.isteyenId} style={stil.talep}>
            <Text style={stil.talepMetin} numberOfLines={2}>
              {t('bekleme.talepMetni', { ad: adiBul(talep.isteyenId) })}
            </Text>
            <View style={stil.talepDugmeler}>
              <Pressable
                onPress={mesgul ? undefined : () => onKoltukCevap(talep.isteyenId, true)}
                style={[stil.kucukDugme, stil.kucukVurgu]}
              >
                <Text style={[stil.kucukYazi, stil.kucukYaziVurgu]}>{t('bekleme.kabul')}</Text>
              </Pressable>
              <Pressable
                onPress={mesgul ? undefined : () => onKoltukCevap(talep.isteyenId, false)}
                style={stil.kucukDugme}
              >
                <Text style={stil.kucukYazi}>{t('bekleme.ret')}</Text>
              </Pressable>
            </View>
          </View>
        ))}

        <Hata metin={hata} />

        <View style={stil.dugmeler}>
          <View style={stil.dugme}>
            <AnaDugme
              etiket={t(hazirim ? 'bekleme.hazirDegilim' : 'bekleme.hazirim')}
              onBas={() => onHazir(!hazirim)}
              aktif={!mesgul}
              tur={hazirim ? 'sade' : 'vurgu'}
            />
          </View>
          <View style={stil.dugme}>
            <AnaDugme etiket={t('bekleme.masadanCik')} onBas={onCik} aktif={!mesgul} tur="cizgi" />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const stil = StyleSheet.create({
  govde: { flex: 1, flexDirection: 'row', padding: 16, gap: 20, alignItems: 'center' },

  sol: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  etiket: { color: renkler.metinSolgun, fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  kod: { color: renkler.vurgu, fontSize: 60, fontWeight: '900', letterSpacing: 9 },
  aciklama: { color: renkler.metinSolgun, fontSize: 11, textAlign: 'center', maxWidth: 300 },
  sayac: { color: renkler.metin, fontSize: 13, fontWeight: '700', marginTop: 8 },

  botKutusu: {
    marginTop: 14,
    maxWidth: 320,
    gap: 5,
    backgroundColor: renkler.panelKoyu,
    borderWidth: 1,
    borderColor: renkler.kenar,
    borderRadius: 10,
    padding: 10,
  },
  botBaslik: { color: renkler.vurgu, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  botMetin: { color: renkler.metinSolgun, fontSize: 10, lineHeight: 14 },

  sag: { width: 320, gap: 6, paddingBottom: 12 },
  koltukIpucu: { color: renkler.metinSolgun, fontSize: 10, lineHeight: 14, marginBottom: 2 },
  koltuklar: { gap: 5 },
  koltuk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: renkler.panel,
    borderWidth: 1,
    borderColor: renkler.kenar,
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  koltukBos: { borderStyle: 'dashed', backgroundColor: 'transparent' },
  koltukBenim: { borderColor: renkler.vurgu },
  basili: { opacity: 0.7 },
  koltukNo: { color: renkler.metinSolgun, fontSize: 11, fontWeight: '900', width: 12 },
  koltukBilgi: { flex: 1 },
  koltukAd: { color: renkler.metin, fontSize: 13, fontWeight: '700' },
  koltukBen: { color: renkler.vurgu },
  bosYazi: { color: renkler.metinSolgun, fontSize: 13, fontWeight: '700', fontStyle: 'italic' },
  ipucu: { color: renkler.metinSolgun, fontSize: 9 },

  rozet: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  rozetHazir: { backgroundColor: renkler.onay },
  rozetBekler: { backgroundColor: 'transparent' },
  rozetYazi: { color: renkler.metinSolgun, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  rozetYaziHazir: { color: '#0b2739' },

  kucukDugme: {
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: renkler.panelKoyu,
    borderWidth: 1,
    borderColor: renkler.kenar,
  },
  kucukVurgu: { backgroundColor: renkler.vurgu, borderColor: renkler.vurgu },
  kucukYazi: { color: renkler.metin, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  kucukYaziVurgu: { color: '#2a2000' },

  talep: {
    marginTop: 6,
    gap: 6,
    backgroundColor: renkler.panelKoyu,
    borderWidth: 1,
    borderColor: renkler.vurgu,
    borderRadius: 9,
    padding: 9,
  },
  talepMetin: { color: renkler.metin, fontSize: 11, lineHeight: 15 },
  talepDugmeler: { flexDirection: 'row', gap: 6 },

  dugmeler: { flexDirection: 'row', gap: 6, marginTop: 8 },
  dugme: { flex: 1 },
});
