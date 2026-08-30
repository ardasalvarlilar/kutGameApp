// Bir masanin CANLI oyun durumu — sunucunun otoritesi burada.
//
// Motor saf ve zamansiz; bu sinif onun etrafindaki kabuk: tohumu uretir,
// aksiyonlari sirayla `reduce`a verir, her oyuncuya kendi `viewFor`unu
// hazirlar ve sira sayacini tutar.
//
// Neden ayri bir sinif: motorun tasarim kurallari (CLAUDE.md) yan etkiyi
// yasakliyor. `Date.now`, zamanlayici ve rastgelelik burada yasiyor, motorda
// degil. Sunucu bu sinifi kullanir; motor sunucuyu hic bilmez.
//
// Bellekte durur, Mongo'da degil: durum saniyede birkac kez degisiyor.
// Kalici olan sey el KAYDI (modeller/ElKaydi.ts) — tohum + aksiyon listesi
// eli birebir yeniden kurar (motor kurali #2).

import {
  OYUNCULAR,
  elBaslat,
  reduce,
  sonrakiBaslayan,
  viewFor,
  type Aksiyon,
  type ElSonucu,
  type HataKodu,
  type OyuncuGorunumu,
  type OyuncuId,
  type OyunDurumu,
  type TurNo,
} from '@kut/engine';

export interface AksiyonSonucu {
  readonly ok: boolean;
  readonly reason?: HataKodu;
  /** El bu aksiyonla kapandiysa dolu. */
  readonly elSonucu?: ElSonucu;
}

/** Bir elin baslangic parametreleri — el kaydina birebir yazilir. */
export interface ElBilgisi {
  readonly tur: TurNo;
  readonly tohum: number;
  readonly baslayan: OyuncuId;
  readonly aksiyonlar: readonly Aksiyon[];
}

/**
 * Tohum uretimi. Motorun DISINDA olmak zorunda (kural #2); burasi dogru yer.
 * `crypto` yerine basit bir karisim yeterli: amac tahmin edilemezlik degil,
 * her elin farkli ve KAYDEDILEBILIR olmasi.
 */
function tohumUret(): number {
  return (Math.floor(Math.random() * 0xffffffff) | 0) >>> 0;
}

export class OyunServisi {
  #durum: OyunDurumu;
  #baslayan: OyuncuId;
  #tohum: number;
  #aksiyonlar: Aksiyon[] = [];
  /** Her oyuncunun sure kademesi. KURALLAR.md §9 0.7 — her elde sifirlanir. */
  #sureKademeleri: Record<OyuncuId, number>;
  #siraBitisi: number | null = null;

  constructor(tur: TurNo, baslayan: OyuncuId = 0) {
    this.#tohum = tohumUret();
    this.#baslayan = baslayan;
    this.#durum = elBaslat({ tur, baslayan, tohum: this.#tohum });
    this.#sureKademeleri = { 0: 0, 1: 0, 2: 0, 3: 0 };
  }

  get durum(): OyunDurumu {
    return this.#durum;
  }

  get bittiMi(): boolean {
    return this.#durum.faz === 'el-bitti';
  }

  get siradaki(): OyuncuId {
    return this.#durum.siradaki;
  }

  get sonuc(): ElSonucu | null {
    return this.#durum.sonuc;
  }

  get elBilgisi(): ElBilgisi {
    return {
      tur: this.#durum.tur,
      tohum: this.#tohum,
      baslayan: this.#baslayan,
      aksiyonlar: [...this.#aksiyonlar],
    };
  }

  /** Oyuncunun gorebilecegi her sey — gizli bilgi buradan gecmez (kural #3). */
  gorunum(oyuncu: OyuncuId): OyuncuGorunumu {
    return viewFor(this.#durum, oyuncu);
  }

  /**
   * Bir aksiyonu uygular. Gecersizse durum DEGISMEZ ve sebep doner —
   * motorun 4 numarali kurali ag katmanina kadar tasiniyor.
   */
  uygula(aksiyon: Aksiyon): AksiyonSonucu {
    const sonuc = reduce(this.#durum, aksiyon);
    if (!sonuc.ok) return { ok: false, reason: sonuc.reason };

    this.#durum = sonuc.state;
    this.#aksiyonlar.push(aksiyon);

    if (this.bittiMi) {
      this.#siraBitisi = null;
      return { ok: true, ...(this.#durum.sonuc === null ? {} : { elSonucu: this.#durum.sonuc }) };
    }
    return { ok: true };
  }

  // --- Sira suresi -----------------------------------------------------------
  // KURALLAR.md §9 0.4/0.7. Sayac sunucuda: istemciye yalnizca bitis ani
  // gidiyor, boylece yavas telefon ya da geri alinmis saat oyunu bozamiyor.

  /** Sirasi gelen oyuncunun su anki hakki (ms). */
  siraSuresi(oyuncu: OyuncuId = this.siradaki): number {
    const sureler = this.#durum.ayarlar.siraSureleriMs;
    if (sureler.length === 0) return 0;
    const kademe = Math.min(this.#sureKademeleri[oyuncu], sureler.length - 1);
    return sureler[kademe] as number;
  }

  get siraBitisi(): number | null {
    return this.#siraBitisi;
  }

  /**
   * Sureyi bastan baslatir. KURALLAR.md §9 0.4: sira gectiginde ve HER TAS
   * CEKMEDEN sonra. Cagirmayi surucu yapiyor cunku "ne zaman" karari akisa ait.
   */
  sureyiBaslat(suAn: number): number {
    this.#siraBitisi = suAn + this.siraSuresi();
    return this.#siraBitisi;
  }

  sureyiDurdur(): void {
    this.#siraBitisi = null;
  }

  /** Suresini dolduran oyuncu bir alt kademeye iner; en altta kalir. */
  kademeDusur(oyuncu: OyuncuId): void {
    const sureler = this.#durum.ayarlar.siraSureleriMs;
    if (sureler.length === 0) return;
    this.#sureKademeleri[oyuncu] = Math.min(
      this.#sureKademeleri[oyuncu] + 1,
      sureler.length - 1,
    );
  }

  /** Bir sonraki eli baslatir; kademeler sifirlanir (§9 0.7). */
  yeniEl(tur: TurNo): void {
    this.#baslayan = sonrakiBaslayan(this.#baslayan);
    this.#tohum = tohumUret();
    this.#aksiyonlar = [];
    this.#siraBitisi = null;
    this.#sureKademeleri = { 0: 0, 1: 0, 2: 0, 3: 0 };
    this.#durum = elBaslat({ tur, baslayan: this.#baslayan, tohum: this.#tohum });
  }

  /** Her koltugun gorunumu — yayin yaparken tek tek uretmek icin. */
  tumGorunumler(): Record<OyuncuId, OyuncuGorunumu> {
    return {
      0: this.gorunum(0),
      1: this.gorunum(1),
      2: this.gorunum(2),
      3: this.gorunum(3),
    };
  }

  static get koltuklar(): readonly OyuncuId[] {
    return OYUNCULAR;
  }
}
