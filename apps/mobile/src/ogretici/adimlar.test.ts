// Adim listesinin TUTARLILIGI.
//
// Bu dosyanin varlik sebebi gercek bir kilitlenme: `rakipler` adimi "yerde
// okey belirdi" diye bekliyordu. 3 numarali okeyle acar acmaz beklenti
// karsilaniyor, ogretici "sira sende, tas cek" adimina geciyor, o adimda da
// fren iniyordu — 2 ve 1 numarali hic oynamadan masa duruyor, sira kullaniciya
// hic gelmiyordu. Ekranda "tas cek" yaziyor ama cekilecek sira yok.
//
// Buradaki kural: KULLANICIDAN hamle bekleyen bir adima gecmeden once sira
// kullaniciya gelmis olmali. Sira gerektirmeyen bekleyisler (masayi izleten
// adimlar) freni acmak zorunda.

import { describe, expect, it } from 'vitest';
import { OGRETICI_ADIMLARI } from './adimlar';
import { yerTutucularOynasin, type Beklenti } from './beklenti';
import tr from '../dil/tr.json';
import en from '../dil/en.json';

/** Kullanicinin sirasi gelmeden yapilamayacak hamleler. */
const SIRA_ISTEYENLER: readonly Beklenti[] = ['cektim', 'isledim', 'okeyAldim', 'actim', 'attim'];

/** Masanin ilerlemesini bekleyen adimlar — bunlarda fren acik olmali. */
const MASAYI_BEKLEYENLER: readonly Beklenti[] = [
  'siramGeldi',
  'calabilirim',
  'talebimSonuclandi',
];

/**
 * Yalnizca SIRA SENDEYKEN calisan dugmeler (`yetkiler.atabilir`).
 *
 * `istiyorum` ve `ciftimVar` bu listede DEGIL: ikisi de sira baskasindayken
 * kullaniliyor (§5).
 */
const SIRA_ISTEYEN_HEDEFLER = ['ac', 'indir', 'isle', 'okeyAl'] as const;

describe('adim listesi', () => {
  it('her adimin metinleri iki sozlukte de var', () => {
    for (const adim of OGRETICI_ADIMLARI) {
      expect(tr, `tr/${adim.baslik}`).toHaveProperty(adim.baslik);
      expect(en, `en/${adim.baslik}`).toHaveProperty(adim.baslik);
      expect(tr, `tr/${adim.metin}`).toHaveProperty(adim.metin);
      expect(en, `en/${adim.metin}`).toHaveProperty(adim.metin);
      if (adim.ekBilgi !== undefined) {
        expect(tr, `tr/${adim.ekBilgi}`).toHaveProperty(adim.ekBilgi);
        expect(en, `en/${adim.ekBilgi}`).toHaveProperty(adim.ekBilgi);
      }
    }
  });

  it('adim adlari benzersiz', () => {
    const adlar = OGRETICI_ADIMLARI.map((adim) => adim.ad);
    expect(new Set(adlar).size).toBe(adlar.length);
  });

  // KILITLENMENIN TESTI.
  //
  // Adim listesini bastan sona yurutup sirayi takip ediyor. Kullanici
  // BASLAYAN oldugu icin (§1) elin basinda sira zaten onda; `attim` sirayi
  // birakiyor, `siramGeldi` geri aliyor. Sira kullanicida degilken ondan
  // hamle bekleyen bir adim gelirse ekranda "tas cek" yazip masanin durmasi
  // demektir — gercekten yasanan hata buydu.
  it('kullanicidan hamle bekleyen hicbir adim sirasiz kalmiyor', () => {
    let siraBende = true;

    for (const adim of OGRETICI_ADIMLARI) {
      if (SIRA_ISTEYENLER.includes(adim.bekler)) {
        expect(siraBende, `${adim.ad} sira kullanicida degilken hamle bekliyor`).toBe(true);
      }
      if (adim.bekler === 'attim') siraBende = false;
      if (adim.bekler === 'siramGeldi') siraBende = true;
    }
  });

  // Ayni kilitlenmenin ikinci yuzu: adim ILERI ile gecilebilir olsa bile,
  // kullaniciya SIRA GEREKTIREN bir dugmeyi gosteriyorsa o an sira onda
  // olmali. `indir` adimi calma sonrasina konmustu — dugme kapaliydi, masa
  // donuktu, sira hic gelmiyordu; oyuncu "indiremiyorum" diye takiliyordu.
  it('sira gerektiren dugmeyi gosteren adimlar sira kullanicidayken geliyor', () => {
    let siraBende = true;

    for (const adim of OGRETICI_ADIMLARI) {
      const hedef = adim.hedef;
      if (hedef !== null && (SIRA_ISTEYEN_HEDEFLER as readonly string[]).includes(hedef)) {
        expect(siraBende, `${adim.ad} adiminda ${hedef} dugmesi kapali olur`).toBe(true);
      }
      if (adim.bekler === 'attim') siraBende = false;
      if (adim.bekler === 'siramGeldi') siraBende = true;
    }
  });

  // Kilitlenmenin dorduncu yuzu: kullanici anlatilan bir adimin ustune oyun
  // hamlesi yapabiliyor. `indir` adimi ILERI beklerken oyuncu tasini da
  // atiyordu; sira gecmis oluyor ama fren hala kapali oldugu icin masa
  // donuyordu. Sira kullanicidayken duran adimlarin cikisi bir OYUN OLAYINA
  // bagli olmali — ILERI'ye degil.
  it('sira kullanicidayken masayi durduran adimlar oyun olayiyla cikiyor', () => {
    let siraBende = true;

    for (const adim of OGRETICI_ADIMLARI) {
      const hedef = adim.hedef;
      const oyunDugmesi =
        hedef !== null && (SIRA_ISTEYEN_HEDEFLER as readonly string[]).includes(hedef);
      if (siraBende && oyunDugmesi) {
        expect(adim.bekler, `${adim.ad} ILERI ile cikiyor, oyuncu erken oynarsa kilitlenir`).not.toBe(
          'ileri',
        );
      }
      if (adim.bekler === 'attim') siraBende = false;
      if (adim.bekler === 'siramGeldi') siraBende = true;
    }
  });

  it('sira birakildiktan sonra geri alinmadan yeni hamle istenmiyor', () => {
    const sirasi = (ad: string): number => OGRETICI_ADIMLARI.findIndex((adim) => adim.ad === ad);
    // `at` sirayi birakiyor, `rakipler` geri aliyor, `cek` ondan sonra.
    expect(sirasi('at')).toBeLessThan(sirasi('rakipler'));
    expect(sirasi('rakipler')).toBeLessThan(sirasi('cek'));
  });

  it('masayi bekleyen adimlarda fren ACIK', () => {
    for (const adim of OGRETICI_ADIMLARI) {
      if (!MASAYI_BEKLEYENLER.includes(adim.bekler)) continue;
      expect(yerTutucularOynasin(adim.bekler), adim.ad).toBe(true);
    }
  });

  it('kullanicidan hamle bekleyen adimlarda masa DURUYOR', () => {
    for (const adim of OGRETICI_ADIMLARI) {
      if (!SIRA_ISTEYENLER.includes(adim.bekler)) continue;
      expect(yerTutucularOynasin(adim.bekler), adim.ad).toBe(false);
    }
  });

  // `cek` mutlaka `isle`/`okeyAl`dan once gelmeli: sirasi gelen oyuncu once
  // ceker (§4), cekmeden isleme yapamaz.
  it('cekme adimi isleme ve okey adimlarindan once', () => {
    const sirasi = (ad: string): number => OGRETICI_ADIMLARI.findIndex((adim) => adim.ad === ad);
    expect(sirasi('cek')).toBeGreaterThan(-1);
    expect(sirasi('cek')).toBeLessThan(sirasi('isle'));
    expect(sirasi('cek')).toBeLessThan(sirasi('okeyAl'));
  });

  // Kullanicinin baslattigi ama MASANIN tamamladigi hamleler var: talep §5'e
  // gore sirasi gelen oyuncu hamlesini yapinca sonuclaniyor. Boyle bir adimin
  // ardindan freni acan bir adim gelmezse talep havada asili kaliyor —
  // calinan tas da ceza tasi da gelmiyor, oyun kilitlenmis gorunuyor.
  // Gercekten yasandi.
  it('talep baslatan adimdan sonra masayi calistiran bir adim var', () => {
    OGRETICI_ADIMLARI.forEach((adim, sira) => {
      if (adim.bekler !== 'talepEttim') return;
      const sonraki = OGRETICI_ADIMLARI[sira + 1];
      expect(sonraki, `${adim.ad} son adim olamaz`).toBeDefined();
      expect(
        sonraki === undefined ? false : yerTutucularOynasin(sonraki.bekler),
        `${adim.ad} sonrasi masa donuk kaliyor`,
      ).toBe(true);
    });
  });

  it('acilis, atmadan once', () => {
    const sirasi = (ad: string): number => OGRETICI_ADIMLARI.findIndex((adim) => adim.ad === ad);
    expect(sirasi('ac')).toBeLessThan(sirasi('at'));
  });
});
