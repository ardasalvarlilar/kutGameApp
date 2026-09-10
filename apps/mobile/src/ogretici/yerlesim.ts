// Ogretici balonunun nereye konacagi — saf hesap, ekrandan bagimsiz.
//
// Perde hedefin UZERINI ORTMUYOR: karartma dort dikdortgen olarak hedefin
// etrafina koyuluyor, hedefin kendisi acikta kaliyor. Bunun iki faydasi var —
// spot isigi icin SVG maskesine gerek kalmiyor, ve dokunuslar gercek dugmeye
// geciyor (adimlar kullanicinin gercekten basmasini bekliyor).
//
// Balon da hedefi ortmemeli, yoksa "buraya bas" derken ustunu kapatir.

export interface Dikdortgen {
  readonly x: number;
  readonly y: number;
  readonly en: number;
  readonly boy: number;
}

export interface Olcu {
  readonly en: number;
  readonly boy: number;
}

export type Yon = 'alt' | 'ust' | 'sol' | 'sag';

export interface BalonYerlesimi {
  readonly yon: Yon;
  readonly x: number;
  readonly y: number;
}

/** Hedefin etrafini karartan dort dikdortgen. Ortadaki delik hedefin kendisi. */
export function karartmaParcalari(hedef: Dikdortgen, ekran: Olcu): readonly Dikdortgen[] {
  const sagKenar = hedef.x + hedef.en;
  const altKenar = hedef.y + hedef.boy;
  return [
    { x: 0, y: 0, en: ekran.en, boy: Math.max(0, hedef.y) },
    { x: 0, y: altKenar, en: ekran.en, boy: Math.max(0, ekran.boy - altKenar) },
    { x: 0, y: Math.max(0, hedef.y), en: Math.max(0, hedef.x), boy: hedef.boy },
    { x: sagKenar, y: Math.max(0, hedef.y), en: Math.max(0, ekran.en - sagKenar), boy: hedef.boy },
  ];
}

function sikistir(deger: number, enAz: number, enCok: number): number {
  return Math.min(Math.max(deger, enAz), Math.max(enAz, enCok));
}

/**
 * Balonu hedefin hangi tarafina koyacagimiz.
 *
 * Once TAM SIGDIGI bir taraf araniyor (alt → ust → sol → sag). Hicbiri
 * sigmiyorsa en cok yeri olan taraf secilip balon ekrana sikistiriliyor:
 * yatay masada yan paneldeki dugmeler ekranin sag kenarinda oldugu icin bu
 * durum gercekten olusuyor.
 */
export function balonYerlesimi(
  hedef: Dikdortgen,
  balon: Olcu,
  ekran: Olcu,
  bosluk = 12,
): BalonYerlesimi {
  const yerler: readonly { readonly yon: Yon; readonly alan: number; readonly x: number; readonly y: number }[] = [
    {
      yon: 'alt',
      alan: ekran.boy - (hedef.y + hedef.boy) - bosluk,
      x: hedef.x + hedef.en / 2 - balon.en / 2,
      y: hedef.y + hedef.boy + bosluk,
    },
    {
      yon: 'ust',
      alan: hedef.y - bosluk,
      x: hedef.x + hedef.en / 2 - balon.en / 2,
      y: hedef.y - bosluk - balon.boy,
    },
    {
      yon: 'sol',
      alan: hedef.x - bosluk,
      x: hedef.x - bosluk - balon.en,
      y: hedef.y + hedef.boy / 2 - balon.boy / 2,
    },
    {
      yon: 'sag',
      alan: ekran.en - (hedef.x + hedef.en) - bosluk,
      x: hedef.x + hedef.en + bosluk,
      y: hedef.y + hedef.boy / 2 - balon.boy / 2,
    },
  ];

  const dikey = (yon: Yon): boolean => yon === 'alt' || yon === 'ust';
  const sigiyorMu = (yer: (typeof yerler)[number]): boolean =>
    yer.alan >= (dikey(yer.yon) ? balon.boy : balon.en);

  const secilen =
    yerler.find(sigiyorMu) ??
    yerler.reduce((enIyi, aday) => (aday.alan > enIyi.alan ? aday : enIyi));

  return {
    yon: secilen.yon,
    x: sikistir(secilen.x, bosluk, ekran.en - balon.en - bosluk),
    y: sikistir(secilen.y, bosluk, ekran.boy - balon.boy - bosluk),
  };
}
