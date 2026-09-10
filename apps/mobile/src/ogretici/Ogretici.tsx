// Ogreticinin surucusu: sirayla adimlari gezer, hedefi olcer, perdeyi cizer
// ve adimin bekledigi hamle olunca kendiliginden ilerler.

import { useEffect, useRef, useState } from 'react';
import type { OyuncuGorunumu } from '@kut/engine';
import { useCeviri } from '../dil';
import { OgreticiPerde } from './OgreticiPerde';
import { OGRETICI_ADIMLARI } from './adimlar';
import { beklentiKarsilandi, ozetle, type Beklenti, type OyunOzeti } from './beklenti';
import { useHedefKaydi } from './hedefKaydi';
import type { Dikdortgen } from './yerlesim';

/**
 * Olcum denemesi.
 *
 * Ilk denemede oge daha yerlesmemis olabiliyor (`measureInWindow` sifir olcu
 * doner) — ozellikle adim degistigi karede. Kisa araliklarla birkac kez
 * deneniyor; hicbiri tutmazsa balon ortada gosteriliyor, adim yine de
 * ilerleyebiliyor.
 */
const DENEME_SAYISI = 12;
const DENEME_ARALIGI_MS = 60;

export function Ogretici({
  gorunum,
  onAdim,
  onBitti,
}: {
  readonly gorunum: OyuncuGorunumu;
  /**
   * Bulunulan adimin beklentisi. Ust bilesen masanin frenini buna gore
   * kuruyor: kullanicidan hamle bekleyen adimlarda yer tutucular duruyor.
   */
  readonly onAdim: (beklenti: Beklenti) => void;
  readonly onBitti: () => void;
}) {
  const t = useCeviri();
  const { olc } = useHedefKaydi();
  const [sira, setSira] = useState(0);
  const [dikdortgen, setDikdortgen] = useState<Dikdortgen | null>(null);

  const adim = OGRETICI_ADIMLARI[sira];
  /** Adimin BASINDAKI durum — "bu adimda oldu mu" sorusunun olcutu. */
  const baslangicOzeti = useRef<OyunOzeti>(ozetle(gorunum));

  // Adim degisince yeni olcut aliniyor ve fren bildiriliyor.
  useEffect(() => {
    baslangicOzeti.current = ozetle(gorunum);
    if (adim !== undefined) onAdim(adim.bekler);
    // `gorunum`u bilerek izlemiyoruz: olcut adimin BASINDA donmali.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sira]);

  // Beklenen hamle olduysa kendiliginden ilerle.
  useEffect(() => {
    if (adim === undefined) return;
    if (!beklentiKarsilandi(adim.bekler, baslangicOzeti.current, ozetle(gorunum))) return;
    if (sira + 1 >= OGRETICI_ADIMLARI.length) onBitti();
    else setSira(sira + 1);
  }, [adim, gorunum, sira, onBitti]);

  useEffect(() => {
    if (adim === undefined) return;
    const hedef = adim.hedef;
    if (hedef === null) {
      setDikdortgen(null);
      return;
    }

    let iptal = false;
    let kalan = DENEME_SAYISI;
    let zamanlayici: ReturnType<typeof setTimeout> | undefined;

    const dene = (): void => {
      void olc(hedef).then((olculen) => {
        if (iptal) return;
        if (olculen !== null) {
          setDikdortgen(olculen);
          return;
        }
        kalan -= 1;
        if (kalan > 0) zamanlayici = setTimeout(dene, DENEME_ARALIGI_MS);
        else setDikdortgen(null);
      });
    };

    setDikdortgen(null);
    dene();
    return () => {
      iptal = true;
      if (zamanlayici !== undefined) clearTimeout(zamanlayici);
    };
    // Hedefin yeri hamleyle degisebiliyor (masaya tas indikce yan sutunlar
    // genisliyor), bu yuzden gorunum degisince yeniden olculuyor.
  }, [adim, olc, gorunum]);

  if (adim === undefined) return null;

  const ilerle = (): void => {
    if (sira + 1 >= OGRETICI_ADIMLARI.length) onBitti();
    else setSira(sira + 1);
  };

  return (
    <OgreticiPerde
      hedef={dikdortgen}
      baslik={t(adim.baslik)}
      metin={t(adim.metin)}
      {...(adim.ekBilgi === undefined ? {} : { ekBilgi: t(adim.ekBilgi) })}
      adimNo={sira + 1}
      adimSayisi={OGRETICI_ADIMLARI.length}
      ileriVar={adim.bekler === 'ileri'}
      onIleri={ilerle}
      onGec={ilerle}
      onKapat={onBitti}
    />
  );
}
