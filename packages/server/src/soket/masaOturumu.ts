// Bir masanin canli oturumu: oyun durumu + sira sayaci + yayin.
//
// Sunucu OTORITERDIR. Istemci "sunu yapmak istiyorum" der; karari motor
// verir, sonucu bu sinif yayar. Istemcideki motor kopyasi yalnizca iyimser
// gosterim icin — hicbir zaman gercegi belirlemez.
//
// Zamanlayici burada, motorda degil (CLAUDE.md #1). Sure dolunca oyuncunun
// yerine oynanir; karari `sureDolduAksiyonu` benzeri saf mantik verir.

import type { Server } from 'socket.io';
import type { Aksiyon, OyuncuId, TurNo } from '@kut/engine';
// Sure dolunca ne oynanacagi bir KURAL degil, politika: @kut/politika'da,
// cevrimdisi masayla AYNI dosyada. Eskiden burada bir kopyasi vardi
// (`soket/yerineOyna.ts`) ve iki botun ayni oynayacaginin garantisi yoktu.
import { botAksiyonu, sureDolduAksiyonu } from '@kut/politika';
import { OyunServisi } from '../servisler/oyunServisi.js';
import type { MasaGorunumu, SunucuOlaylari } from '../tipler/protokol.js';
import { kayit } from '../kayit.js';

/** Bir koltugun kim oldugu ve baglantisi. */
export interface Oturan {
  readonly koltuk: OyuncuId;
  /** Bot koltugunda `bot:<koltuk>` — gercek bir oyuncu kimligi degil. */
  readonly oyuncuId: string;
  /** Bu koltugu sunucunun botu mu oynuyor? */
  readonly bot: boolean;
  bagli: boolean;
}

/**
 * Botun "dusunme" suresi (ms).
 *
 * Sifir olsaydi bot masaya oturur oturmaz hamlelerini birden yapar, insan ne
 * oldugunu goremezdi. Bu bir kural degil, tempo.
 */
const BOT_GECIKMESI_MS = 1_400;

/**
 * Insanin "ISTIYORUM" diyebilmesi icin taninan sure (ms).
 *
 * §9 0.9 ile talep penceresi, sirasi gelen oyuncu OYNAYANA KADAR acik.
 * Sirasi gelen bir botsa ve masada calinabilecek bir tas varsa, bot 1.4
 * saniyede cekseydi insanin calma hakki fiilen yok olurdu.
 * (Cevrimdisi masada ayni karar `apps/mobile/src/oyun.ts`te.)
 */
const BOT_CALMA_PAYI_MS = 3_000;

export interface OturumSecenekleri {
  readonly masaId: string;
  readonly oturanlar: readonly Oturan[];
  readonly tur: TurNo;
  /** El bittiginde cagrilir; kayit ve puan islerini disarisi yapar. */
  readonly onElBitti: (oturum: MasaOturumu) => void | Promise<void>;
}

export class MasaOturumu {
  readonly masaId: string;
  readonly oturanlar: Oturan[];
  #oyun: OyunServisi;
  #io: Server;
  #zamanlayici: NodeJS.Timeout | null = null;
  /**
   * Botun sirasi geldiginde kurulan kisa zamanlayici.
   *
   * Sira suresinden AYRI: sira suresi (30 sn) guvenlik agi olarak durmaya
   * devam ediyor — bot bir sekilde ilerleyemezse oyun yine de kilitlenmesin.
   */
  #botZamanlayici: NodeJS.Timeout | null = null;
  /** Tur arasi bekleme. Ayri tutuluyor ki `kapat()` ikisini de iptal etsin. */
  #araZamanlayici: NodeJS.Timeout | null = null;
  #onElBitti: OturumSecenekleri['onElBitti'];
  /** Koltuk -> son islenen hamle numarasi. Tekrar gonderimi engeller. */
  #sonHamleNo = new Map<OyuncuId, number>();

  constructor(io: Server, secenekler: OturumSecenekleri) {
    this.#io = io;
    this.masaId = secenekler.masaId;
    this.oturanlar = secenekler.oturanlar.map((o) => ({ ...o }));
    this.#onElBitti = secenekler.onElBitti;
    this.#oyun = new OyunServisi(secenekler.tur);
  }

  get oyun(): OyunServisi {
    return this.#oyun;
  }

  get odaAdi(): string {
    return `masa:${this.masaId}`;
  }

  koltugu(oyuncuId: string): OyuncuId | null {
    return this.oturanlar.find((o) => o.oyuncuId === oyuncuId)?.koltuk ?? null;
  }

  oyuncusu(koltuk: OyuncuId): Oturan | undefined {
    return this.oturanlar.find((o) => o.koltuk === koltuk);
  }

  botMu(koltuk: OyuncuId): boolean {
    return this.oyuncusu(koltuk)?.bot ?? false;
  }

  /** Masadaki gercek oyuncular — istatistik, el kaydi ve yayin bunlari kullanir. */
  get insanlar(): readonly Oturan[] {
    return this.oturanlar.filter((oturan) => !oturan.bot);
  }

  baglantiDurumu(oyuncuId: string, bagli: boolean): void {
    const oturan = this.oturanlar.find((o) => o.oyuncuId === oyuncuId);
    if (oturan !== undefined) oturan.bagli = bagli;
  }

  get bagliOlanlar(): ReadonlySet<string> {
    return new Set(this.oturanlar.filter((o) => o.bagli).map((o) => o.oyuncuId));
  }

  // --- Yayin -----------------------------------------------------------------

  /**
   * Her koltuga KENDI gorunumunu gonderir.
   *
   * Tek bir "durum" yayini yapilamaz: `viewFor` gizli bilgiyi ayikliyor
   * (motor kurali #3). Herkese ayni paketi gondermek rakiplerin istakasini
   * sizdirirdi.
   */
  gorunumleriYay(hamleNo = 0): void {
    // Bot koltugunun kisisel odasini kimse dinlemiyor; paket uretmeye gerek yok.
    for (const oturan of this.insanlar) {
      this.#io.to(this.#kisiselOda(oturan.oyuncuId)).emit('oyun:gorunum', {
        gorunum: this.#oyun.gorunum(oturan.koltuk),
        hamleNo,
      });
    }
  }

  masayiYay(masa: MasaGorunumu): void {
    this.#io.to(this.odaAdi).emit('masa:durum', masa);
  }

  #kisiselOda(oyuncuId: string): string {
    return `oyuncu:${oyuncuId}`;
  }

  #yayinla<K extends keyof SunucuOlaylari>(olay: K, ...veri: Parameters<SunucuOlaylari[K]>): void {
    this.#io.to(this.odaAdi).emit(olay, ...(veri as unknown[]));
  }

  // --- Oyun akisi ------------------------------------------------------------

  /** Eli baslatir ve ilk sureyi kurar. */
  baslat(): void {
    this.gorunumleriYay();
    this.#sureyiKur();
  }

  /**
   * Istemciden gelen hamle. Dogrulama sirasi onemli:
   * once kimlik (koltugun mu?), sonra tekrar kontrolu, en son motor.
   */
  aksiyon(
    oyuncuId: string,
    aksiyon: Aksiyon,
    hamleNo: number,
  ): { ok: boolean; hata?: string | undefined } {
    const koltuk = this.koltugu(oyuncuId);
    if (koltuk === null) return { ok: false, hata: 'Bu masada değilsin' };

    // Istemci BASKASI adina hamle gonderemez. Bu kontrol olmadan protokol
    // guvenilmez olurdu; aksiyonun icindeki `oyuncu` alani istemciden geliyor.
    if (aksiyon.oyuncu !== koltuk) return { ok: false, hata: 'Başkasının adına oynayamazsın' };

    const oncekiHamle = this.#sonHamleNo.get(koltuk);
    if (oncekiHamle !== undefined && hamleNo <= oncekiHamle) {
      // Yeniden baglanmada tekrar gonderim olur; sessizce yut.
      return { ok: true };
    }

    // Zaman sunucunun: istemcinin gonderdigi `suAn` guvenilmez.
    const guvenliAksiyon = { ...aksiyon, suAn: Date.now() } as Aksiyon;
    const oncekiFaz = this.#oyun.durum.faz;
    const sonuc = this.#oyun.uygula(guvenliAksiyon);

    if (!sonuc.ok) {
      this.#io
        .to(this.#kisiselOda(oyuncuId))
        .emit('oyun:hata', { reason: sonuc.reason ?? 'bilinmeyen', hamleNo });
      return { ok: false, hata: sonuc.reason };
    }

    this.#sonHamleNo.set(koltuk, hamleNo);
    this.gorunumleriYay(hamleNo);

    if (this.#oyun.bittiMi) {
      this.#zamanlayiciyiDurdur();
      void this.#onElBitti(this);
      return { ok: true };
    }

    // KURALLAR.md §9 0.4 — sure sira gectiginde ve her CEKMEDEN sonra baslar.
    // Ikisi de fazin degistigi anlar; baska hicbir hamle sayaci sifirlamaz.
    if (this.#oyun.durum.faz !== oncekiFaz) this.#sureyiKur();
    return { ok: true };
  }

  // --- Sira suresi -----------------------------------------------------------

  #sureyiKur(): void {
    this.#zamanlayiciyiDurdur();
    if (this.#oyun.bittiMi) return;

    const bitis = this.#oyun.sureyiBaslat(Date.now());
    this.#yayinla('oyun:sure', {
      siradaki: this.#oyun.siradaki,
      bitisZamani: bitis,
      sure: this.#oyun.siraSuresi(),
      // Istemci kendi saatiyle farki alip ofsetini duzeltsin diye: telefonun
      // saati yanlissa geri sayim bozulmasin.
      sunucuZamani: Date.now(),
    });

    this.#zamanlayici = setTimeout(() => this.#sureDoldu(), Math.max(0, bitis - Date.now()));
    this.#botuPlanla();
  }

  #zamanlayiciyiDurdur(): void {
    if (this.#zamanlayici !== null) {
      clearTimeout(this.#zamanlayici);
      this.#zamanlayici = null;
    }
    if (this.#botZamanlayici !== null) {
      clearTimeout(this.#botZamanlayici);
      this.#botZamanlayici = null;
    }
  }

  // --- Bot koltuklari --------------------------------------------------------

  /**
   * Sira bir bottaysa hamlesini planlar.
   *
   * Karar `@kut/politika`da (`botAksiyonu`) — cevrimdisi masadaki yer
   * tutucularla AYNI kod. Bot da yalnizca kendi `viewFor` projeksiyonunu
   * okuyor: insandan fazlasini gormuyor (CLAUDE.md motor kurali #3).
   */
  #botuPlanla(): void {
    if (this.#oyun.bittiMi) return;
    const koltuk = this.#oyun.siradaki;
    if (!this.botMu(koltuk)) return;

    this.#botZamanlayici = setTimeout(() => {
      this.#botZamanlayici = null;
      this.#botOyna(koltuk);
    }, this.#botBeklemesi());
  }

  /**
   * Bot ne kadar beklesin?
   *
   * Cekme fazinda ve masada INSANIN calabilecegi bir tas varsa daha uzun:
   * pencere botun hamlesiyle kapaniyor (§9 0.9) ve 1.4 saniye insana
   * "istiyorum" demeye yetmez.
   */
  #botBeklemesi(): number {
    const durum = this.#oyun.durum;
    const pencere = durum.pencere;
    if (durum.faz !== 'cekme' || pencere === null) return BOT_GECIKMESI_MS;

    const calabilecekInsanVar = this.insanlar.some(
      (oturan) => oturan.koltuk !== pencere.atan && oturan.koltuk !== durum.siradaki,
    );
    return calabilecekInsanVar ? BOT_CALMA_PAYI_MS : BOT_GECIKMESI_MS;
  }

  /** Botun sirasi: acilis, isleme ve atis birden fazla hamle olabilir. */
  #botOyna(koltuk: OyuncuId): void {
    if (this.#oyun.bittiMi || this.#oyun.siradaki !== koltuk) return;

    for (let adim = 0; adim < 10; adim++) {
      if (this.#oyun.bittiMi || this.#oyun.siradaki !== koltuk) break;

      const aksiyon = botAksiyonu(this.#oyun.gorunum(koltuk), koltuk, Date.now());
      if (aksiyon === null) break;

      const sonuc = this.#oyun.uygula(aksiyon);
      if (!sonuc.ok) {
        // Motor reddetti. Kurtarma FAZA UYGUN olmali: cekme fazinda "at"
        // demek yine reddedilir ve sira kilitlenir.
        const kurtarma = sureDolduAksiyonu(this.#oyun.gorunum(koltuk), koltuk, Date.now());
        if (kurtarma === null || !this.#oyun.uygula(kurtarma).ok) {
          kayit.uyari(`Bot ilerleyemedi: ${sonuc.reason}`, { masaId: this.masaId, koltuk });
          break;
        }
      }
      if (aksiyon.tip === 'AT' || aksiyon.tip === 'BITIR_ELDEN') break;
    }

    this.gorunumleriYay();

    if (this.#oyun.bittiMi) {
      this.#zamanlayiciyiDurdur();
      void this.#onElBitti(this);
      return;
    }
    // Sira baska bir bota gectiyse `#sureyiKur` onu da planlar.
    this.#sureyiKur();
  }

  /**
   * Sure doldu: oyuncunun yerine oynanir.
   *
   * Kurtarma FAZA UYGUN olmali — cekme fazinda "at" demek motorca reddedilir
   * ve sira kilitlenir. (Ayni hata istemcide de yasanmisti; CLAUDE.md'de not.)
   */
  #sureDoldu(): void {
    if (this.#oyun.bittiMi) return;
    const koltuk = this.#oyun.siradaki;

    for (let adim = 0; adim < 4; adim++) {
      const gorunum = this.#oyun.gorunum(koltuk);
      const aksiyon = sureDolduAksiyonu(gorunum, koltuk, Date.now());
      if (aksiyon === null) break;

      const sonuc = this.#oyun.uygula(aksiyon);
      if (!sonuc.ok) {
        kayit.uyari(`Sure doldu ama hamle reddedildi: ${sonuc.reason}`, {
          masaId: this.masaId,
          koltuk,
        });
        break;
      }
      if (aksiyon.tip === 'AT') break;
    }

    this.#oyun.kademeDusur(koltuk);
    this.gorunumleriYay();

    if (this.#oyun.bittiMi) {
      this.#zamanlayiciyiDurdur();
      void this.#onElBitti(this);
      return;
    }
    this.#sureyiKur();
  }

  /** Yeni ele gecer; kademeler sifirlanir (§9 0.7). */
  yeniEl(tur: TurNo): void {
    this.#sonHamleNo.clear();
    this.#oyun.yeniEl(tur);
    this.baslat();
  }

  /**
   * Tur arasini kurar. Zamanlayici oturumun icinde duruyor ki masa
   * kapandiginda iptal edilebilsin — yoksa herkes ciktiktan sonra bile
   * yeni bir el dagitilirdi.
   */
  sonrakiElePlanla(gecikmeMs: number, is: () => void): void {
    if (this.#araZamanlayici !== null) clearTimeout(this.#araZamanlayici);
    this.#araZamanlayici = setTimeout(() => {
      this.#araZamanlayici = null;
      is();
    }, gecikmeMs);
  }

  kapat(): void {
    this.#zamanlayiciyiDurdur();
    if (this.#araZamanlayici !== null) {
      clearTimeout(this.#araZamanlayici);
      this.#araZamanlayici = null;
    }
  }
}
