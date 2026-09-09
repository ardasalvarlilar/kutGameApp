// Dil sağlayıcısı — saf çekirdek `cevir.ts`te.
//
// Bileşenler buradan `useCeviri()` / `useDil()` alıyor; saf modüller (zaman,
// hataMetinleri) doğrudan `./dil/cevir`i kullanıyor ve React'e bağlanmıyor.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { diliOku, diliYaz } from '../ag/depo';
import { VARSAYILAN_DIL, cevir, dilGecerliMi, type Ceviri, type Dil } from './cevir';

export * from './cevir';

interface DilDurumu {
  readonly dil: Dil;
  readonly diliDegistir: (dil: Dil) => void;
  readonly t: Ceviri;
}

const DilBaglami = createContext<DilDurumu | null>(null);

export function DilSaglayici({ children }: { readonly children: ReactNode }) {
  const [dil, setDil] = useState<Dil>(VARSAYILAN_DIL);

  // Kayıtlı tercih asenkron geliyor; ilk kare varsayılanla çiziliyor.
  useEffect(() => {
    void diliOku().then((kayitli) => {
      if (dilGecerliMi(kayitli)) setDil(kayitli);
    });
  }, []);

  const diliDegistir = useCallback((yeni: Dil) => {
    setDil(yeni);
    void diliYaz(yeni);
  }, []);

  const t = useCallback<Ceviri>((anahtar, degerler) => cevir(dil, anahtar, degerler), [dil]);

  const deger = useMemo<DilDurumu>(() => ({ dil, diliDegistir, t }), [dil, diliDegistir, t]);
  return <DilBaglami.Provider value={deger}>{children}</DilBaglami.Provider>;
}

export function useDil(): DilDurumu {
  const deger = useContext(DilBaglami);
  if (deger === null) throw new Error('useDil, DilSaglayici içinde çağrılmalı');
  return deger;
}

/** Yalnızca çeviri gereken bileşenler için kısayol. */
export function useCeviri(): Ceviri {
  return useDil().t;
}
