// Cevrimici masa surucusu.
//
// Sunucu OTORITER: bu dosya hicbir kural bilmiyor, motoru CAGIRMIYOR. Tek
// isi soketten gelen `viewFor` ciktisini tutmak ve oyuncunun niyetini
// `oyun:aksiyon` olarak yollamak. Karar sunucuda (packages/server).
//
// Iyimser gosterim YOK. Denendi ve dogru olmadigi gorulur: istemcide tam
// durum olmadigi icin `reduce` calistirilamiyor (rakiplerin istakasi gizli,
// motor kurali #3). Yani "once goster sonra dogrula" yapilamiyor; gecikme
// bir gidis-donus kadar. Yerel agda ve mobil veride bu 30-80 ms.
//
// Zaman: sunucu her sure paketinde kendi saatini de yolluyor. Telefonun saati
// yanlissa geri sayim bozulmasin diye ofset hesaplaniyor.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  VARSAYILAN_AYARLAR,
  oyuncuKaydiOlustur,
  type Aksiyon,
  type OyuncuGorunumu,
  type OyuncuId,
  type OyuncuKaydi,
} from '@kut/engine';
import type { MasaSurucusu } from '../surucu';
import { sor, type Socket } from './soket';
import type {
  AcikMasaOzeti,
  ElSonuVerisi,
  GorunumVerisi,
  HataVerisi,
  MasaGorunumu,
  SureGorunumu,
} from './protokol';

export interface CevrimiciMasa {
  /** Su an oturulan masa; hicbir masada degilsek null. */
  readonly masa: MasaGorunumu | null;
  /** El basladiysa surucu; baslamadiysa null (bekleme odasi gosterilir). */
  readonly surucu: MasaSurucusu | null;
  /** Masa islemleri sirasinda: "kuruluyor", "katiliniyor"... */
  readonly mesgul: boolean;
  /** Masa islemlerinin son hatasi (oyun hatasi degil). */
  readonly hata: string | null;
  readonly hatayiSil: () => void;

  readonly masaKur: (ozel?: boolean) => Promise<void>;
  readonly masayaKatil: (kod: string) => Promise<void>;
  readonly hizliOyna: () => Promise<void>;
  /** MASA BUL: oturulabilecek acik masalar. Masaya OTURTMAZ, yalnizca listeler. */
  readonly acikMasalar: () => Promise<readonly AcikMasaOzeti[]>;
  readonly hazirOl: (hazir: boolean) => Promise<void>;
  readonly masadanCik: () => Promise<void>;

  // --- Masa duzeni (yalnizca bekleme odasinda) -------------------------------
  //
  // Kimin nerede oturdugu oyunun kendisini degistiriyor: attigin tasi saginda
  // oturan alir (KURALLAR.md §4) ve calma onceligi koltuk sirasindan cikiyor
  // (§5). "Su kisinin sagina oturmak istemiyorum" gercek bir tercih.

  /** Bos koltuklari botla doldurur. Yalnizca masayi acan. */
  readonly botlariDoldur: () => Promise<void>;
  readonly botuCikar: (koltuk: OyuncuId) => Promise<void>;
  /** Bos bir koltuga gecer. */
  readonly koltugaGec: (koltuk: OyuncuId) => Promise<void>;
  /** Dolu bir koltuk icin degistirme talebi birakir. */
  readonly koltukTalebi: (koltuk: OyuncuId) => Promise<void>;
  readonly koltukCevap: (isteyenId: string, kabul: boolean) => Promise<void>;
}

/** Koltuk numarasindan ekranda gorunecek ad. */
function adlariCikar(masa: MasaGorunumu | null, ben: OyuncuId | null): Record<OyuncuId, string> {
  const yedek: Record<OyuncuId, string> = { 0: 'OYUNCU 1', 1: 'OYUNCU 2', 2: 'OYUNCU 3', 3: 'OYUNCU 4' };
  if (masa === null) return yedek;

  const adlar = { ...yedek };
  for (const koltuk of masa.koltuklar) {
    // Kendi koltugunda adin yerine "SEN": masada kendini aramak zorunda
    // kalmayasin. Baglantisi kopani da isaretliyoruz, sunucu onun yerine
    // oynadigi icin ekranda "donmus" gorunmesin.
    const ad = koltuk.no === ben ? 'SEN' : koltuk.ad.toLocaleUpperCase('tr-TR');
    // Bot koltugunun baglantisi kopmaz; "(kopuk)" yazmanin anlami yok.
    adlar[koltuk.no] = koltuk.bot || koltuk.bagli ? ad : `${ad} (kopuk)`;
  }
  return adlar;
}

/** `MasaGorunumu.puanlar` seyrek bir kayit; motorun bekledigi tam kayda cevirir. */
function puanlariCevir(masa: MasaGorunumu | null): OyuncuKaydi<number> {
  return oyuncuKaydiOlustur((koltuk) => masa?.puanlar[koltuk] ?? 0);
}

export function useCevrimiciMasa(soket: Socket | null, bagli: boolean): CevrimiciMasa {
  const [masa, setMasa] = useState<MasaGorunumu | null>(null);
  const [gorunum, setGorunum] = useState<OyuncuGorunumu | null>(null);
  const [sure, setSure] = useState<SureGorunumu | null>(null);
  const [elSonu, setElSonu] = useState<ElSonuVerisi | null>(null);
  const [oyunHatasi, setOyunHatasi] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);

  /** Sunucu saati eksi telefon saati. Geri sayim bununla duzeltiliyor. */
  const zamanOfsetiRef = useRef(0);
  /** Gonderilen her hamleye artan numara — sunucu tekrari boyle eliyor. */
  const hamleNoRef = useRef(0);

  // --- Sunucudan gelenler ----------------------------------------------------

  useEffect(() => {
    if (soket === null) return;

    const masaDurumu = (yeni: MasaGorunumu): void => {
      setMasa(yeni);
      // Masa kapandiysa elde tutulan gorunum yaniltir; ekran lobiye donsun.
      if (yeni.durum === 'bekliyor') {
        setGorunum(null);
        setSure(null);
        setElSonu(null);
      }
    };

    const oyunGorunumu = ({ gorunum: yeni }: GorunumVerisi): void => {
      setGorunum(yeni);
      setOyunHatasi(null);
      // Yeni el dagitildi: el sonu tablosu kapansin.
      if (yeni.faz !== 'el-bitti') setElSonu(null);
    };

    const oyunSuresi = (yeni: SureGorunumu): void => {
      zamanOfsetiRef.current = yeni.sunucuZamani - Date.now();
      setSure(yeni);
    };

    const elBitti = (veri: ElSonuVerisi): void => {
      setElSonu(veri);
      setMasa(veri.masa);
      setSure(null);
    };

    const oyunHatasiGeldi = ({ reason }: HataVerisi): void => {
      // Ham kod; ceviriyi ekran yapiyor, dil degisince metin de degissin diye.
      setOyunHatasi(reason);
    };

    const ayrildi = ({ sebep }: { sebep: string }): void => {
      setMasa(null);
      setGorunum(null);
      setSure(null);
      setElSonu(null);
      setHata(sebep);
    };

    soket.on('masa:durum', masaDurumu);
    soket.on('oyun:gorunum', oyunGorunumu);
    soket.on('oyun:sure', oyunSuresi);
    soket.on('oyun:elSonu', elBitti);
    soket.on('oyun:hata', oyunHatasiGeldi);
    soket.on('masa:ayrildi', ayrildi);

    return () => {
      soket.off('masa:durum', masaDurumu);
      soket.off('oyun:gorunum', oyunGorunumu);
      soket.off('oyun:sure', oyunSuresi);
      soket.off('oyun:elSonu', elBitti);
      soket.off('oyun:hata', oyunHatasiGeldi);
      soket.off('masa:ayrildi', ayrildi);
    };
  }, [soket]);

  // Baglanti (yeniden) kuruldugunda "hangi masadayim?" diye sor. Yeniden
  // baglanmanin butun isi bu: sunucu masayi, gorunumu ve sureyi geri yolluyor.
  useEffect(() => {
    if (soket === null) return;

    const durumuSor = (): void => {
      void sor<{ masa: MasaGorunumu | null }>(soket, 'masa:benim').then((sonuc) => {
        if (!sonuc.ok) return;
        setMasa(sonuc.veri.masa);

        // Masa YOKSA elde tuttugumuz gorunum de olu: masa kapanmis ya da
        // sunucu yeniden baslamis olabilir. Temizlemezsek ekranda donmus bir
        // tahta kaliyor ve oyuncu neden oynayamadigini anlamiyor.
        if (sonuc.veri.masa === null) {
          setGorunum(null);
          setSure(null);
          setElSonu(null);
        }
      });
    };

    if (soket.connected) durumuSor();
    soket.on('connect', durumuSor);
    return () => {
      soket.off('connect', durumuSor);
    };
  }, [soket]);

  // --- Oyuncunun istekleri ---------------------------------------------------

  const istek = useCallback(
    async (olay: string, girdi: unknown = {}): Promise<void> => {
      if (soket === null) {
        setHata('Sunucuya bağlı değilsin');
        return;
      }
      setMesgul(true);
      setHata(null);
      const sonuc = await sor<{ masa?: MasaGorunumu }>(soket, olay, girdi);
      setMesgul(false);

      if (!sonuc.ok) {
        setHata(sonuc.hata);
        return;
      }
      if (sonuc.veri.masa !== undefined) setMasa(sonuc.veri.masa);
    },
    [soket],
  );

  const masaKur = useCallback(
    async (ozel = true): Promise<void> => istek('masa:kur', { ozel }),
    [istek],
  );
  const masayaKatil = useCallback(
    async (kod: string): Promise<void> => istek('masa:katil', { kod: kod.trim().toUpperCase() }),
    [istek],
  );
  const hizliOyna = useCallback(async (): Promise<void> => istek('masa:hizli'), [istek]);

  // MASA BUL, `istek`ten GECMIYOR: o, donen `masa` alanini masaya oturmus
  // saymak icin var. Listeye bakmak masaya oturmak degil — oyuncu hala lobide.
  const acikMasalar = useCallback(async (): Promise<readonly AcikMasaOzeti[]> => {
    if (soket === null) {
      setHata('Sunucuya bağlı değilsin');
      return [];
    }
    const sonuc = await sor<{ masalar: readonly AcikMasaOzeti[] }>(soket, 'masa:liste');
    if (!sonuc.ok) {
      setHata(sonuc.hata);
      return [];
    }
    setHata(null);
    return sonuc.veri.masalar;
  }, [soket]);
  const hazirOl = useCallback(
    async (hazir: boolean): Promise<void> => istek('masa:hazir', { hazir }),
    [istek],
  );

  const botlariDoldur = useCallback(async (): Promise<void> => istek('masa:botDoldur'), [istek]);
  const botuCikar = useCallback(
    async (koltuk: OyuncuId): Promise<void> => istek('masa:botCikar', { koltuk }),
    [istek],
  );
  const koltugaGec = useCallback(
    async (koltuk: OyuncuId): Promise<void> => istek('masa:koltugaGec', { koltuk }),
    [istek],
  );
  const koltukTalebi = useCallback(
    async (koltuk: OyuncuId): Promise<void> => istek('masa:koltukTalebi', { koltuk }),
    [istek],
  );
  const koltukCevap = useCallback(
    async (isteyenId: string, kabul: boolean): Promise<void> =>
      istek('masa:koltukCevap', { isteyenId, kabul }),
    [istek],
  );

  const masadanCik = useCallback(async (): Promise<void> => {
    await istek('masa:cik');
    setMasa(null);
    setGorunum(null);
    setSure(null);
    setElSonu(null);
    setOyunHatasi(null);
  }, [istek]);

  const gonder = useCallback(
    (aksiyon: Aksiyon): boolean => {
      if (soket === null) return false;
      hamleNoRef.current += 1;
      // Yaniti beklemiyoruz: sonuc zaten `oyun:gorunum` ya da `oyun:hata`
      // olarak geliyor. Burada beklemek ekrani bosuna kilitlerdi.
      soket.emit('oyun:aksiyon', { aksiyon, hamleNo: hamleNoRef.current }, () => undefined);
      return true;
    },
    [soket],
  );

  // --- Surucu ----------------------------------------------------------------

  const ben = gorunum?.ben ?? null;
  const adlar = useMemo(() => adlariCikar(masa, ben), [masa, ben]);
  const macPuanlari = useMemo(() => puanlariCevir(masa), [masa]);

  const surucu = useMemo<MasaSurucusu | null>(() => {
    if (gorunum === null) return null;

    // Sure yalnizca SIRASI GELENIN sayaci; baskasinin sirasindayken
    // gosterilmiyor (yerel surucu de boyle davraniyor).
    const benimSiram = sure !== null && sure.siradaki === gorunum.ben;
    const siraBitisi =
      benimSiram && gorunum.faz !== 'el-bitti' ? sure.bitisZamani - zamanOfsetiRef.current : null;

    return {
      gorunum,
      sonHata: oyunHatasi,
      gonder,
      siraBitisi,
      siraSuresi: sure?.sure ?? VARSAYILAN_AYARLAR.siraSureleriMs[0] ?? 30_000,
      macPuanlari,
      macKazananlari: elSonu?.macKazananlari ?? [],
      turArasiSn: elSonu?.sonrakiElSn ?? null,
      // Sonraki eli SUNUCU dagitiyor. null, ekrana "dugme koyma, geri sayim
      // goster" diyor (src/surucu.ts).
      sonrakiTur: null,
      adlar,
      bagli,
      cevrimici: true,
    };
  }, [gorunum, oyunHatasi, gonder, sure, macPuanlari, elSonu, adlar, bagli]);

  const hatayiSil = useCallback(() => setHata(null), []);

  return {
    masa,
    surucu,
    mesgul,
    hata,
    hatayiSil,
    masaKur,
    masayaKatil,
    hizliOyna,
    acikMasalar,
    hazirOl,
    masadanCik,
    botlariDoldur,
    botuCikar,
    koltugaGec,
    koltukTalebi,
    koltukCevap,
  };
}
