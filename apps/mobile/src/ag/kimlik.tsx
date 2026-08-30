// Oturum: kim giris yapti, jetonu ne, soketi acik mi.
//
// Bir context cunku uc ekran birden buna bakiyor (giris, lobi, masa) ve
// jetonu prop olarak gezdirmek her ekrana ilgisiz bir alan eklerdi.
//
// Akis:
//   yukleniyor → depodaki jetonu dogrula → varsa `hazir`, yoksa `giris`
//
// Jeton gecersizse (30 gun gecti, sunucu anahtari degisti) sessizce
// silinip giris ekranina donuluyor: oyuncuya "jetonun bozuk" demenin
// bir anlami yok, yeniden girmesi yeter.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as api from './api';
import { cihazKimligi, jetonuOku, jetonuSil, jetonuYaz } from './depo';
import { soketiAc, soketiKapat, type Socket } from './soket';
import type { GirisVerisi, OyuncuOzeti } from './protokol';

export type KimlikDurumu = 'yukleniyor' | 'giris' | 'hazir';

export interface Kimlik {
  readonly durum: KimlikDurumu;
  readonly oyuncu: OyuncuOzeti | null;
  readonly soket: Socket | null;
  /** Soket su an sunucuya bagli mi? Ekranlar buna gore uyari gosteriyor. */
  readonly bagli: boolean;
  readonly misafirGir: () => Promise<string | null>;
  readonly kayitOl: (girdi: api.KayitGirdisi) => Promise<string | null>;
  readonly girisYap: (eposta: string, parola: string) => Promise<string | null>;
  readonly cikisYap: () => Promise<void>;
  readonly oyuncuyuTazele: () => Promise<void>;

  /** Parola sifirlama kodu ister. Hata yoksa null. */
  readonly parolaKoduIste: (eposta: string) => Promise<string | null>;
  /** Kodu dogrular, parolayi degistirir ve oturumu ACAR. */
  readonly parolayiSifirla: (
    eposta: string,
    kod: string,
    yeniParola: string,
  ) => Promise<string | null>;
  readonly adiDegistir: (ad: string) => Promise<string | null>;
  /** App Store 5.1.1(v) — hesabi ve kisisel verileri kalici olarak siler. */
  readonly hesabiSil: () => Promise<string | null>;

  // --- Sikayet ve engelleme (App Store 1.2) ---------------------------------
  readonly engellenenler: readonly api.EngelliOzeti[];
  readonly engelleriTazele: () => Promise<void>;
  readonly engelle: (oyuncuId: string) => Promise<string | null>;
  readonly engelKaldir: (oyuncuId: string) => Promise<string | null>;
  readonly sikayetEt: (girdi: {
    readonly oyuncuId: string;
    readonly sebep: api.SikayetSebebi;
    readonly aciklama?: string;
    readonly masaId?: string;
  }) => Promise<string | null>;
}

const KimlikBaglami = createContext<Kimlik | null>(null);

// `children` bilerek Turkcelestirilmedi: bu bir oyun terimi degil, React'in
// kendi sozlesmesi — JSX cocuklari baska bir ada baglanamiyor.
export function KimlikSaglayici({ children }: { readonly children: ReactNode }) {
  const [durum, setDurum] = useState<KimlikDurumu>('yukleniyor');
  const [oyuncu, setOyuncu] = useState<OyuncuOzeti | null>(null);
  const [soket, setSoket] = useState<Socket | null>(null);
  const [bagli, setBagli] = useState(false);
  const [engellenenler, setEngellenenler] = useState<readonly api.EngelliOzeti[]>([]);
  const jetonRef = useRef<string | null>(null);

  /** Giris sonucunu uygular: jetonu sakla, soketi ac, ekrani gecir. */
  const oturumuKur = useCallback(async (veri: GirisVerisi): Promise<void> => {
    jetonRef.current = veri.jeton;
    await jetonuYaz(veri.jeton);
    setOyuncu(veri.oyuncu);
    setSoket(soketiAc(veri.jeton));
    setDurum('hazir');
  }, []);

  // Acilis: depodaki jetonu sunucuya dogrulat.
  useEffect(() => {
    let iptal = false;

    void (async () => {
      const jeton = await jetonuOku();
      if (iptal) return;
      if (jeton === null) {
        setDurum('giris');
        return;
      }

      const sonuc = await api.beniGetir(jeton);
      if (iptal) return;

      if (!sonuc.ok) {
        // Ag hatasi ile "jetonun gecersiz" ayni sey degil. Sunucuya
        // ulasilamadiysa jetonu SILMIYORUZ: ucakta acilan uygulama,
        // oyuncunun hesabini silmemeli.
        if (sonuc.hata.includes('bağlanılamadı') || sonuc.hata.includes('yanıt vermedi')) {
          setDurum('giris');
          return;
        }
        await jetonuSil();
        setDurum('giris');
        return;
      }

      jetonRef.current = jeton;
      setOyuncu(sonuc.veri.oyuncu);
      setSoket(soketiAc(jeton));
      setDurum('hazir');
    })();

    return () => {
      iptal = true;
    };
  }, []);

  // Baglanti durumunu izle — ekranlar "bağlantı yok" diyebilsin.
  useEffect(() => {
    if (soket === null) return;
    setBagli(soket.connected);

    const acildi = (): void => setBagli(true);
    const kapandi = (): void => setBagli(false);
    soket.on('connect', acildi);
    soket.on('disconnect', kapandi);
    return () => {
      soket.off('connect', acildi);
      soket.off('disconnect', kapandi);
    };
  }, [soket]);

  const misafirGir = useCallback(async (): Promise<string | null> => {
    const cihaz = await cihazKimligi();
    const sonuc = await api.misafirGir(cihaz);
    if (!sonuc.ok) return sonuc.hata;
    await oturumuKur(sonuc.veri);
    return null;
  }, [oturumuKur]);

  const kayitOl = useCallback(
    async (girdi: api.KayitGirdisi): Promise<string | null> => {
      // Cihaz kimligini her zaman gonderiyoruz: bu cihazda misafir olarak
      // oynanmissa ilerleme AYNI hesapta kalsin (sunucu karar veriyor).
      const cihaz = await cihazKimligi();
      const sonuc = await api.kayitOl({ ...girdi, cihazKimligi: cihaz });
      if (!sonuc.ok) return sonuc.hata;
      await oturumuKur(sonuc.veri);
      return null;
    },
    [oturumuKur],
  );

  const girisYap = useCallback(
    async (eposta: string, parola: string): Promise<string | null> => {
      const sonuc = await api.girisYap(eposta, parola);
      if (!sonuc.ok) return sonuc.hata;
      await oturumuKur(sonuc.veri);
      return null;
    },
    [oturumuKur],
  );

  const cikisYap = useCallback(async (): Promise<void> => {
    soketiKapat();
    await jetonuSil();
    jetonRef.current = null;
    setSoket(null);
    setOyuncu(null);
    setBagli(false);
    setEngellenenler([]);
    setDurum('giris');
  }, []);

  const oyuncuyuTazele = useCallback(async (): Promise<void> => {
    const jeton = jetonRef.current;
    if (jeton === null) return;
    const sonuc = await api.beniGetir(jeton);
    if (sonuc.ok) setOyuncu(sonuc.veri.oyuncu);
  }, []);

  // --- Parola sifirlama -----------------------------------------------------

  const parolaKoduIste = useCallback(async (eposta: string): Promise<string | null> => {
    const sonuc = await api.parolaKoduIste(eposta.trim());
    return sonuc.ok ? null : sonuc.hata;
  }, []);

  const parolayiSifirla = useCallback(
    async (eposta: string, kod: string, yeniParola: string): Promise<string | null> => {
      const sonuc = await api.parolayiSifirla(eposta.trim(), kod.trim(), yeniParola);
      if (!sonuc.ok) return sonuc.hata;
      // Sifirlama basarili olunca oturum da aciliyor: oyuncuyu bir de giris
      // ekranina geri gondermenin anlami yok, kimligini az once kanitladi.
      await oturumuKur(sonuc.veri);
      return null;
    },
    [oturumuKur],
  );

  // --- Hesap ----------------------------------------------------------------

  const adiDegistir = useCallback(async (ad: string): Promise<string | null> => {
    const jeton = jetonRef.current;
    if (jeton === null) return 'Oturum yok';
    const sonuc = await api.adiDegistir(jeton, ad.trim());
    if (!sonuc.ok) return sonuc.hata;
    setOyuncu(sonuc.veri.oyuncu);
    return null;
  }, []);

  const hesabiSil = useCallback(async (): Promise<string | null> => {
    const jeton = jetonRef.current;
    if (jeton === null) return 'Oturum yok';
    const sonuc = await api.hesabiSil(jeton);
    if (!sonuc.ok) return sonuc.hata;
    await cikisYap();
    return null;
  }, [cikisYap]);

  // --- Sikayet ve engelleme -------------------------------------------------

  const engelleriTazele = useCallback(async (): Promise<void> => {
    const jeton = jetonRef.current;
    if (jeton === null) return;
    const sonuc = await api.engellenenleriGetir(jeton);
    if (sonuc.ok) setEngellenenler(sonuc.veri.engellenenler);
  }, []);

  const engelle = useCallback(async (oyuncuId: string): Promise<string | null> => {
    const jeton = jetonRef.current;
    if (jeton === null) return 'Oturum yok';
    const sonuc = await api.engelle(jeton, oyuncuId);
    if (!sonuc.ok) return sonuc.hata;
    setEngellenenler(sonuc.veri.engellenenler);
    return null;
  }, []);

  const engelKaldir = useCallback(async (oyuncuId: string): Promise<string | null> => {
    const jeton = jetonRef.current;
    if (jeton === null) return 'Oturum yok';
    const sonuc = await api.engelKaldir(jeton, oyuncuId);
    if (!sonuc.ok) return sonuc.hata;
    setEngellenenler(sonuc.veri.engellenenler);
    return null;
  }, []);

  const sikayetEt = useCallback(
    async (girdi: {
      readonly oyuncuId: string;
      readonly sebep: api.SikayetSebebi;
      readonly aciklama?: string;
      readonly masaId?: string;
    }): Promise<string | null> => {
      const jeton = jetonRef.current;
      if (jeton === null) return 'Oturum yok';
      const sonuc = await api.sikayetEt(jeton, girdi);
      return sonuc.ok ? null : sonuc.hata;
    },
    [],
  );

  // Oturum acilinca engel listesini bir kez cek: masada "engelle" dugmesinin
  // hali (engelli mi degil mi) buna bagli.
  useEffect(() => {
    if (durum === 'hazir') void engelleriTazele();
  }, [durum, engelleriTazele]);

  const deger = useMemo<Kimlik>(
    () => ({
      durum,
      oyuncu,
      soket,
      bagli,
      misafirGir,
      kayitOl,
      girisYap,
      cikisYap,
      oyuncuyuTazele,
      parolaKoduIste,
      parolayiSifirla,
      adiDegistir,
      hesabiSil,
      engellenenler,
      engelleriTazele,
      engelle,
      engelKaldir,
      sikayetEt,
    }),
    [
      durum,
      oyuncu,
      soket,
      bagli,
      misafirGir,
      kayitOl,
      girisYap,
      cikisYap,
      oyuncuyuTazele,
      parolaKoduIste,
      parolayiSifirla,
      adiDegistir,
      hesabiSil,
      engellenenler,
      engelleriTazele,
      engelle,
      engelKaldir,
      sikayetEt,
    ],
  );

  return <KimlikBaglami.Provider value={deger}>{children}</KimlikBaglami.Provider>;
}

export function useKimlik(): Kimlik {
  const deger = useContext(KimlikBaglami);
  if (deger === null) throw new Error('useKimlik, KimlikSaglayici icinde cagrilmali');
  return deger;
}
