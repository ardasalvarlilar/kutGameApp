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
import { SABIT_REFERANS, masaKonumlari, type Konum } from '../masaDuzeni';
import { golge, renkler } from '../tema';

const KAPASITE = 4;

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
  konum,
  koltuk,
  hal,
  bekleyenTalep,
  mesgul,
  sahipMiyim,
  onBas,
  onBotuCikar,
}: {
  readonly no: OyuncuId;
  readonly konum: Konum;
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
    <View style={[stil.konumlayici, stil[konum]]}>
      <Pressable
        onPress={dokunulabilir ? onBas : undefined}
        style={({ pressed }) => [
          stil.koltuk,
          hal === 'bos' && stil.koltukBos,
          hal === 'benim' && stil.koltukBenim,
          pressed && dokunulabilir && stil.basili,
        ]}
      >
        <View style={stil.koltukUst}>
          <Text style={stil.koltukNo}>{no + 1}</Text>
          {/* Plan sabit oldugu icin kendi kartim her yerde olabilir; altin
              kenarlik tek basina yeterince bagirmiyordu. */}
          {hal === 'benim' ? (
            <View style={stil.senRozeti}>
              <Text style={stil.senYazi}>{t('bekleme.sen')}</Text>
            </View>
          ) : null}
          {hal === 'bot' && sahipMiyim ? (
            <Pressable onPress={mesgul ? undefined : onBotuCikar} hitSlop={8} style={stil.cikarDugme}>
              <Text style={stil.cikarYazi}>✕</Text>
            </Pressable>
          ) : null}
        </View>

        {koltuk === undefined ? (
          <>
            <View style={stil.bosCember} />
            <Text style={stil.bosYazi}>{t('bekleme.bosKoltuk')}</Text>
            <Text style={stil.ipucu}>{mesgul ? '…' : t('bekleme.dokunOtur')}</Text>
          </>
        ) : (
          <>
            <Avatar ad={koltuk.ad} boy={30} />
            <Text style={[stil.koltukAd, hal === 'benim' && stil.koltukBen]} numberOfLines={1}>
              {koltuk.ad}
            </Text>
            <Text style={[stil.ipucu, bekleyenTalep && stil.ipucuVurgu]} numberOfLines={1}>
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
            {hal !== 'bot' ? (
              <View style={[stil.rozet, koltuk.hazir ? stil.rozetHazir : stil.rozetBekler]}>
                <Text style={[stil.rozetYazi, koltuk.hazir && stil.rozetYaziHazir]}>
                  {t(koltuk.hazir ? 'bekleme.rozetHazir' : 'bekleme.rozetBekliyor')}
                </Text>
              </View>
            ) : null}
          </>
        )}
      </Pressable>
    </View>
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
        <Text style={stil.koltukIpucu}>{t('bekleme.koltukIpucu')}</Text>

        {/* Koltuk secimi SABIT bir masa plani: 1 numarali koltuk her zaman
            altta, herkes ayni plani gorur.

            Once "benim koltugum hep altta" diye ciziliyordu ve masa oyuncuyla
            BIRLIKTE dondugu icin baska koltuga gecmek ekranda hic
            degismiyordu: sunucuda koltuk degisiyor, oyuncu yerinde duruyor
            saniyordu. Plan sabit olunca kendi kartinin tasindigi goruluyor —
            ve "ustteki koltuga gec" demek de mumkun oluyor.

            Oyun baslayinca yerlesim yine oyuncuya doner (Masa.tsx): orada
            herkes kendini altta, sagindakini sagda gorur. */}
        <View style={stil.masaAlani}>
          <View style={stil.kece}>
            <Text style={stil.keceYazi}>KÜT</Text>
          </View>

          {/* Sira yonu: guney → dogu → kuzey → bati. `masaKonumlari` konumlari
              `siradaIleri` ile kurdugu icin bu yon planla birlikte hep dogru
              kalir. Sabit planda "sagimdaki" artik ekranin sagi olmadigindan
              yonu gostermek gerekiyor. */}
          <Text style={[stil.yonOku, stil.yonSagAlt]}>▲</Text>
          <Text style={[stil.yonOku, stil.yonSagUst]}>▲</Text>
          <Text style={[stil.yonOku, stil.yonSolUst]}>▲</Text>
          <Text style={[stil.yonOku, stil.yonSolAlt]}>▲</Text>

          {(Object.entries(masaKonumlari(SABIT_REFERANS)) as [Konum, OyuncuId][]).map(
            ([konum, no]) => {
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
                  konum={konum}
                  koltuk={koltuk}
                  hal={hal}
                  bekleyenTalep={benimTalebim?.hedefKoltuk === no}
                  mesgul={mesgul}
                  sahipMiyim={sahipMiyim}
                  onBas={() => koltugaBas(no, koltuk)}
                  onBotuCikar={() => onBotuCikar(no)}
                />
              );
            },
          )}
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
    borderRadius: 12,
    padding: 11,
    ...golge.kart,
  },
  botBaslik: { color: renkler.vurgu, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  botMetin: { color: renkler.metinSolgun, fontSize: 10, lineHeight: 14 },

  sag: { width: 390, gap: 6, paddingBottom: 10, alignItems: 'center' },
  koltukIpucu: {
    color: renkler.metinSolgun,
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    maxWidth: 340,
  },

  // --- Masa gorunumu -----------------------------------------------------
  // Konteynerin ortasinda kece, dort kosede koltuk karti — oyunun kendi
  // masa duzeniyle (Masa.tsx) ayni yerlesim mantigi.
  masaAlani: { width: 390, height: 300, marginVertical: 2 },
  kece: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -38,
    marginLeft: -85,
    width: 170,
    height: 76,
    borderRadius: 20,
    backgroundColor: renkler.masa,
    borderWidth: 2,
    borderColor: renkler.masaCizgi,
    alignItems: 'center',
    justifyContent: 'center',
    ...golge.masa,
  },
  keceYazi: { color: renkler.masaCizgi, fontSize: 20, fontWeight: '900', letterSpacing: 4 },

  // Sira yonu okları: koltuk kartlarinin arasindaki bos kosegen alanlarda.
  // "▲" yukari bakiyor; her ok bir sonraki koltuga donduruluyor.
  yonOku: {
    position: 'absolute',
    color: renkler.metinSolgun,
    fontSize: 13,
    opacity: 0.5,
  },
  yonSagAlt: { left: 264, top: 236, transform: [{ rotate: '45deg' }] },
  yonSagUst: { left: 264, top: 48, transform: [{ rotate: '-45deg' }] },
  yonSolUst: { left: 118, top: 48, transform: [{ rotate: '-135deg' }] },
  yonSolAlt: { left: 118, top: 236, transform: [{ rotate: '135deg' }] },

  konumlayici: { position: 'absolute', width: 100, alignItems: 'center' },
  guney: { bottom: 0, left: '50%', marginLeft: -50 },
  kuzey: { top: 0, left: '50%', marginLeft: -50 },
  dogu: { right: 0, top: '50%', marginTop: -52 },
  bati: { left: 0, top: '50%', marginTop: -52 },

  koltuk: {
    width: 100,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: renkler.panel,
    borderWidth: 1.5,
    borderColor: renkler.kenar,
    borderRadius: 13,
    paddingHorizontal: 5,
    paddingVertical: 6,
    ...golge.kart,
  },
  koltukBos: { borderStyle: 'dashed', backgroundColor: renkler.panelKoyu },
  koltukBenim: { borderColor: renkler.vurgu, borderWidth: 2, ...golge.yukseltilmis },
  basili: { transform: [{ scale: 0.96 }], opacity: 0.88 },

  koltukUst: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  koltukNo: { color: renkler.metinSolgun, fontSize: 10, fontWeight: '900' },
  senRozeti: {
    backgroundColor: renkler.vurgu,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  senYazi: { color: '#2a2000', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  cikarDugme: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: renkler.panelKoyu,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cikarYazi: { color: renkler.uyari, fontSize: 9, fontWeight: '900' },

  bosCember: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: renkler.kenar,
    borderStyle: 'dashed',
  },
  bosYazi: {
    color: renkler.metinSolgun,
    fontSize: 11,
    fontWeight: '700',
    fontStyle: 'italic',
    marginTop: 1,
  },
  ipucu: { color: renkler.metinSolgun, fontSize: 8, textAlign: 'center' },
  ipucuVurgu: { color: renkler.vurgu, fontWeight: '800' },

  koltukAd: { color: renkler.metin, fontSize: 12, fontWeight: '800', marginTop: 1 },
  koltukBen: { color: renkler.vurgu },

  rozet: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 1 },
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
    width: 340,
    gap: 6,
    backgroundColor: renkler.panelKoyu,
    borderWidth: 1,
    borderColor: renkler.vurgu,
    borderRadius: 9,
    padding: 9,
    ...golge.kart,
  },
  talepMetin: { color: renkler.metin, fontSize: 11, lineHeight: 15 },
  talepDugmeler: { flexDirection: 'row', gap: 6 },

  dugmeler: { flexDirection: 'row', gap: 6, marginTop: 4, width: 340 },
  dugme: { flex: 1 },
});
