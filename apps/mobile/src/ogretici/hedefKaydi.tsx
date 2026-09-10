// Ogreticinin isik tutacagi ekran ogelerinin kaydi.
//
// Masa.tsx'teki dugmeler yan panelde saran bir izgarada duruyor; her birini
// bir View ile sarmalamak duzeni bozardi. Onun yerine ogeler kendi ref'lerini
// bu kayda birakiyor, ogretici de olcumu buradan istiyor.
//
// Kayit BAGLAM uzerinden gidiyor, modul seviyesinde bir Map degil: masa
// `key` degisince yeniden kuruluyor (temiz el) ve eski ref'lerin yeni masaya
// sizmamasi gerekiyor.

import { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import type { Dikdortgen } from './yerlesim';

export type OgreticiHedefi =
  | 'tur'
  | 'sart'
  | 'istaka'
  | 'orta'
  | 'ac'
  | 'indir'
  | 'isle'
  | 'okeyAl'
  | 'istiyorum'
  | 'ciftimVar'
  | 'ayarlar';

/** `measureInWindow` tasiyan her sey — View de Text de olur. */
interface Olculebilir {
  measureInWindow(geri: (x: number, y: number, en: number, boy: number) => void): void;
}

interface HedefKaydi {
  readonly kaydet: (ad: OgreticiHedefi, oge: Olculebilir | null) => void;
  /** Kayitli degilse ya da henuz yerlesmemisse null. */
  readonly olc: (ad: OgreticiHedefi) => Promise<Dikdortgen | null>;
}

const BOS: HedefKaydi = {
  kaydet: () => undefined,
  olc: async () => null,
};

const Baglam = createContext<HedefKaydi>(BOS);

export function HedefSaglayici({ children }: { readonly children: React.ReactNode }) {
  const ogeler = useRef(new Map<OgreticiHedefi, Olculebilir>());

  const kaydet = useCallback((ad: OgreticiHedefi, oge: Olculebilir | null) => {
    if (oge === null) ogeler.current.delete(ad);
    else ogeler.current.set(ad, oge);
  }, []);

  const olc = useCallback(async (ad: OgreticiHedefi): Promise<Dikdortgen | null> => {
    const oge = ogeler.current.get(ad);
    if (oge === undefined) return null;
    return new Promise((coz) => {
      oge.measureInWindow((x, y, en, boy) => {
        // Henuz yerlesmemis oge sifir olcu doner; ogretici bunu "hazir degil"
        // diye okuyup yeniden olcuyor.
        coz(en === 0 && boy === 0 ? null : { x, y, en, boy });
      });
    });
  }, []);

  const deger = useMemo<HedefKaydi>(() => ({ kaydet, olc }), [kaydet, olc]);
  return <Baglam.Provider value={deger}>{children}</Baglam.Provider>;
}

export function useHedefKaydi(): HedefKaydi {
  return useContext(Baglam);
}

/**
 * Bir ogeyi ogreticiye tanitan `ref` geri cagrisi.
 *
 * `ad` verilmezse hicbir sey yapmiyor — `Dugme` gibi ortak bilesenlerde
 * kanca kosulsuz cagrilabilsin diye.
 */
export function useHedef(ad?: OgreticiHedefi): (oge: Olculebilir | null) => void {
  const { kaydet } = useHedefKaydi();
  return useCallback(
    (oge: Olculebilir | null) => {
      if (ad !== undefined) kaydet(ad, oge);
    },
    [ad, kaydet],
  );
}
