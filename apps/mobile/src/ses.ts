// Hangi sesin calacagina karar veren saf mantik.
//
// Bilerek React ve expo-audio'dan AYRI bir dosyada: vitest bu modulu
// dogrudan okuyabiliyor (kosucu yalnizca src/**/*.test.ts aliyor ve native
// modulleri cozemiyor). Calma isi src/sesCalar.ts'te.

export type SesAdi = 'at' | 'cek' | 'isle';

export interface SesGirdisi {
  readonly atikAdedi: number;
  readonly desteSayisi: number;
  readonly yerdekiTasSayisi: number;
}

/**
 * Iki gorunum arasindaki degisimden calacak efekti secer; yoksa null.
 *
 * Sirasi onemli: ayni tick icinde hem cekme hem atma olabilir (sure dolunca
 * surucu ikisini de gonderir); o durumda atis duyulur, ekranda goze carpan o.
 */
export function sesSec(onceki: SesGirdisi, simdi: SesGirdisi): SesAdi | null {
  // Deste BUYUDUYSE yeni el dagitildi — kimse hamle yapmadi, ses de yok.
  // Bu kontrol olmasa "SONRAKI TUR"da atik sifirlandigi icin cekme sesi calardi.
  if (simdi.desteSayisi > onceki.desteSayisi) return null;
  if (simdi.atikAdedi > onceki.atikAdedi) return 'at';
  if (simdi.yerdekiTasSayisi > onceki.yerdekiTasSayisi) return 'isle';
  // Yerden alma atik sayisini dusurur; desteden cekme desteyi azaltir.
  if (simdi.atikAdedi < onceki.atikAdedi) return 'cek';
  if (simdi.desteSayisi < onceki.desteSayisi) return 'cek';
  return null;
}

/** `viewFor` projeksiyonundan ses girdisi — ekranin okudugu tek yer. */
export function sesGirdisi(gorunum: {
  readonly atikAdedi: number;
  readonly desteSayisi: number;
  readonly yer: readonly { readonly taslar: readonly unknown[] }[];
}): SesGirdisi {
  return {
    atikAdedi: gorunum.atikAdedi,
    desteSayisi: gorunum.desteSayisi,
    yerdekiTasSayisi: gorunum.yer.reduce((toplam, per) => toplam + per.taslar.length, 0),
  };
}
