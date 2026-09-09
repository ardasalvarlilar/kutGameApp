// Masa kurma, katilma, cikma — Mongo tarafi.
//
// Canli oyun durumu burada DEGIL (bkz. servisler/oyunServisi.ts). Bu servis
// yalnizca "kim nerede oturuyor" sorusunu cevapliyor.
//
// Aynı Wi-Fi keşfi yerine ODA KODU secildi (MIMARI.md §5): ayni odada da,
// farkli sehirde de ayni sekilde calisir ve hicbir ag iznine ihtiyac duymaz.

import { Types } from 'mongoose';
import { config } from '../config.js';
import { BOT_ADLARI, Masa, type MasaBelgesi } from '../modeller/Masa.js';
import { Oyuncu } from '../modeller/Oyuncu.js';
import { engelliBiriVarMi, engelliKimlikler } from './moderasyonServisi.js';
import type { AcikMasaOzeti, KoltukGorunumu, MasaGorunumu } from '../tipler/protokol.js';
import type { OyuncuId } from '@kut/engine';

/** Karisabilecek harfler yok: 0/O, 1/I/L cikarildi — kod sesli soyleniyor. */
const KOD_ALFABESI = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export const MASA_KAPASITESI = 4;

export class MasaHatasi extends Error {}

function kodUret(uzunluk: number): string {
  let kod = '';
  for (let i = 0; i < uzunluk; i++) {
    kod += KOD_ALFABESI[Math.floor(Math.random() * KOD_ALFABESI.length)];
  }
  return kod;
}

/** Cakisma ihtimaline karsi birkac kez dener; hepsi tutmazsa hata. */
async function benzersizKod(): Promise<string> {
  for (let deneme = 0; deneme < 8; deneme++) {
    const kod = kodUret(config.oda.kodUzunlugu);
    if ((await Masa.countDocuments({ kod })) === 0) return kod;
  }
  throw new MasaHatasi('masa-kodu-uretilemedi');
}

/** Bos koltuklarin en kucugu; masa doluysa null. */
function bosKoltuk(masa: MasaBelgesi): OyuncuId | null {
  const dolu = new Set(masa.koltuklar.map((koltuk) => koltuk.no));
  for (let no = 0; no < MASA_KAPASITESI; no++) {
    if (!dolu.has(no)) return no as OyuncuId;
  }
  return null;
}

export interface MasaGorunumuSecenekleri {
  /** Su an soketi acik olan oyuncu kimlikleri. */
  readonly bagliOlanlar?: ReadonlySet<string>;
}

/** Mongo belgesini istemcinin gordugu sekle cevirir. */
export async function masaGorunumu(
  masa: MasaBelgesi & { _id: unknown },
  secenekler: MasaGorunumuSecenekleri = {},
): Promise<MasaGorunumu> {
  const kimlikler = masa.koltuklar
    .map((koltuk) => koltuk.oyuncu)
    .filter((kimlik): kimlik is NonNullable<typeof kimlik> => kimlik !== null && kimlik !== undefined);
  const oyuncular = await Oyuncu.find({ _id: { $in: kimlikler } }).select('ad').lean();
  const adlar = new Map(oyuncular.map((o) => [String(o._id), o.ad]));

  const koltuklar: KoltukGorunumu[] = masa.koltuklar
    .slice()
    .sort((a, b) => a.no - b.no)
    .map((koltuk) => {
      // Bot koltugunda `oyuncu` yok; kimlik yerine koltuga sabit bir isaret
      // veriyoruz ki istemci onu bir oyuncu kimligiyle karistirmasin.
      if (koltuk.bot) {
        return {
          no: koltuk.no as OyuncuId,
          oyuncuId: botKimligi(koltuk.no),
          ad: botAdi(koltuk.no),
          bot: true,
          hazir: true,
          bagli: true,
        };
      }
      const oyuncuId = String(koltuk.oyuncu);
      return {
        no: koltuk.no as OyuncuId,
        oyuncuId,
        ad: adlar.get(oyuncuId) ?? 'Oyuncu',
        bot: false,
        hazir: koltuk.hazir,
        bagli: secenekler.bagliOlanlar?.has(oyuncuId) ?? true,
      };
    });

  const puanlar: Record<number, number> = {};
  for (const [anahtar, deger] of masa.puanlar.entries()) puanlar[Number(anahtar)] = deger;

  return {
    masaId: String(masa._id),
    kod: masa.kod,
    durum: masa.durum,
    sahipId: String(masa.sahip),
    tur: masa.tur,
    ozel: masa.ozel,
    koltuklar,
    koltukTalepleri: masa.koltukTalepleri.map((talep) => ({
      isteyenId: String(talep.isteyen),
      hedefKoltuk: talep.hedefKoltuk as OyuncuId,
    })),
    puanlar,
  };
}

/** Oyuncunun icinde oldugu acik masa; yoksa null. */
export async function acikMasam(oyuncuId: string) {
  return Masa.findOne({
    'koltuklar.oyuncu': new Types.ObjectId(oyuncuId),
    durum: { $ne: 'bitti' },
  });
}

/**
 * MASA BUL — kod bilmeden oturulabilecek ACIK masalar.
 *
 * Ozel masalar bu listeye GIRMEZ; onlarin tek kapisi koddur. Ayrim veri
 * modelinde zaten vardi (`Masa.ozel`), eksik olan onu gosteren bu uctu.
 *
 * Siralama `hizliMasa` ile ayni: en dolu masa once. Oyuncular tek masada
 * toplansin — az oyuncu varken bu, oyunun hic baslamamasiyla baslamasi
 * arasindaki fark oluyor.
 *
 * Engel elemesi burada da yapiliyor (App Store 1.2): engellediginin ya da
 * seni engelleyenin oturdugu masa listede hic gorunmez. Gorunup katilirken
 * reddedilmesi, engellemeyi karsi tarafa sezdirirdi.
 */
export async function acikMasalar(oyuncuId: string): Promise<readonly AcikMasaOzeti[]> {
  const masalar = await Masa.find({ durum: 'bekliyor', ozel: false })
    .sort({ createdAt: 1 })
    .limit(config.oda.listeSiniri);

  const engelliler = await engelliKimlikler(oyuncuId);

  const uygun = masalar.filter(
    (masa) =>
      masa.koltuklar.length < MASA_KAPASITESI &&
      !masa.koltuklar.some((koltuk) => engelliler.has(String(koltuk.oyuncu))),
  );

  // Adlari tek sorguda al: masa basina sorgu atmak N+1 olurdu.
  const kimlikler = uygun.flatMap((masa) => masa.koltuklar.map((koltuk) => koltuk.oyuncu));
  const oyuncular = await Oyuncu.find({ _id: { $in: kimlikler } }).select('ad').lean();
  const adlar = new Map(oyuncular.map((o) => [String(o._id), o.ad]));

  return uygun
    .map((masa) => ({
      kod: masa.kod,
      oyuncuSayisi: masa.koltuklar.length,
      kapasite: MASA_KAPASITESI,
      oyuncular: masa.koltuklar
        .slice()
        .sort((a, b) => a.no - b.no)
        .map((koltuk) => adlar.get(String(koltuk.oyuncu)) ?? 'Oyuncu'),
      benimMi: masa.koltuklar.some((koltuk) => String(koltuk.oyuncu) === oyuncuId),
    }))
    .sort((a, b) => b.oyuncuSayisi - a.oyuncuSayisi);
}

// --- Bot koltuklari ----------------------------------------------------------
//
// Oyun dort oyuncusuz ilerlemiyor (motor dort koltuk bekliyor) ama dordunun de
// insan olmasi gerekmiyor. Iki arkadas toplandiysa masayi botlarla doldurup
// oynayabilmeli — aksi halde tek secenek iki yabanci beklemek.
//
// Botu SUNUCU oynuyor (`soket/masaOturumu.ts`), karar `@kut/politika`da:
// cevrimdisi masadaki yer tutucularla AYNI kod. Iki ayri bot yazmak, ikisinin
// zamanla ayrisması demek olurdu.

/** Bot koltugunun istemciye giden sahte kimligi. Oyuncu kimligiyle karismaz. */
export function botKimligi(koltuk: number): string {
  return `bot:${koltuk}`;
}

export function botMu(oyuncuId: string): boolean {
  return oyuncuId.startsWith('bot:');
}

export function botAdi(koltuk: number): string {
  return BOT_ADLARI[koltuk] ?? `Bot ${koltuk + 1}`;
}

/** Masadaki butun bos koltuklari botla doldurur. Yalnizca masanin sahibi. */
export async function botlariDoldur(oyuncuId: string) {
  const masa = await sahibiOldugumMasa(oyuncuId);

  const dolu = new Set(masa.koltuklar.map((koltuk) => koltuk.no));
  const eklenecek = [];
  for (let no = 0; no < MASA_KAPASITESI; no++) {
    if (!dolu.has(no)) eklenecek.push({ no, bot: true, hazir: true });
  }
  if (eklenecek.length === 0) throw new MasaHatasi('bos-koltuk-yok');

  // Atomik: bu arada biri oturduysa masa dolar ve kosul tutmaz.
  const guncel = await Masa.findOneAndUpdate(
    {
      _id: masa._id,
      durum: 'bekliyor',
      $expr: { $lt: [{ $size: '$koltuklar' }, MASA_KAPASITESI] },
    },
    { $push: { koltuklar: { $each: eklenecek } }, $unset: { kapanmaZamani: '' } },
    { new: true },
  );
  if (guncel === null) throw new MasaHatasi('masa-doldu-tekrar');
  return guncel;
}

/** Bir bot koltugunu bosaltir — yeri insana acilsin diye. */
export async function botuCikar(oyuncuId: string, koltuk: number) {
  const masa = await sahibiOldugumMasa(oyuncuId);
  const hedef = masa.koltuklar.find((k) => k.no === koltuk);
  if (hedef === undefined || !hedef.bot) throw new MasaHatasi('koltukta-bot-yok');

  masa.set(
    'koltuklar',
    masa.koltuklar.filter((k) => !(k.no === koltuk && k.bot)),
  );
  await masa.save();
  return masa;
}

/** Sahibi oldugum, hala bekleyen masa. Bot ve koltuk islemlerinin on kosulu. */
async function sahibiOldugumMasa(oyuncuId: string) {
  const masa = await acikMasam(oyuncuId);
  if (masa === null) throw new MasaHatasi('masada-degilsin');
  if (masa.durum !== 'bekliyor') throw new MasaHatasi('oyun-basladi');
  if (String(masa.sahip) !== oyuncuId) throw new MasaHatasi('masa-sahibi-degilsin');
  return masa;
}

// --- Koltuk secme ve degistirme ----------------------------------------------
//
// Kimin nerede oturdugu oyunun kendisini degistiriyor: attigin tasi SAGINDAKI
// alir (§4) ve calma onceligi koltuk sirasina gore isler (§5). "Su kisinin
// sagina oturmak istemiyorum" gercek bir tercih; masa kurulurken karar
// verilebilmeli.
//
// Bos koltuga gecmek talep gerektirmiyor. DOLU koltuga gecmek oturanin
// onayindan geciyor.

/** Bos bir koltuga gecer. Atomik: koltugu bu arada baskasi kapabilir. */
export async function koltugaGec(oyuncuId: string, hedefKoltuk: number) {
  if (!Number.isInteger(hedefKoltuk) || hedefKoltuk < 0 || hedefKoltuk >= MASA_KAPASITESI) {
    throw new MasaHatasi('gecersiz-koltuk');
  }
  const masa = await acikMasam(oyuncuId);
  if (masa === null) throw new MasaHatasi('masada-degilsin');
  if (masa.durum !== 'bekliyor') throw new MasaHatasi('oyun-basladi');

  const benim = masa.koltuklar.find((k) => String(k.oyuncu) === oyuncuId);
  if (benim === undefined) throw new MasaHatasi('koltugun-yok');
  if (benim.no === hedefKoltuk) return masa;
  if (masa.koltuklar.some((k) => k.no === hedefKoltuk)) {
    throw new MasaHatasi('koltuk-dolu-iste');
  }

  // Tek islemde: eski koltugu cikar, yenisini koy. Filtre "hedef HALA bos".
  const guncel = await Masa.findOneAndUpdate(
    { _id: masa._id, durum: 'bekliyor', 'koltuklar.no': { $ne: hedefKoltuk } },
    { $set: { 'koltuklar.$[benim].no': hedefKoltuk } },
    { new: true, arrayFilters: [{ 'benim.oyuncu': new Types.ObjectId(oyuncuId) }] },
  );
  if (guncel === null) throw new MasaHatasi('koltuk-kapildi');
  return guncel;
}

/** Dolu bir koltuk icin degistirme talebi birakir. */
export async function koltukTalebiGonder(oyuncuId: string, hedefKoltuk: number) {
  const masa = await acikMasam(oyuncuId);
  if (masa === null) throw new MasaHatasi('masada-degilsin');
  if (masa.durum !== 'bekliyor') throw new MasaHatasi('oyun-basladi');

  const benim = masa.koltuklar.find((k) => String(k.oyuncu) === oyuncuId);
  if (benim === undefined) throw new MasaHatasi('koltugun-yok');
  if (benim.no === hedefKoltuk) throw new MasaHatasi('zaten-o-koltukta');

  const hedef = masa.koltuklar.find((k) => k.no === hedefKoltuk);
  if (hedef === undefined) throw new MasaHatasi('koltuk-bos-dogrudan-gec');
  // Bot kimseye sormaz: sahibi onu zaten cikarabiliyor.
  if (hedef.bot) throw new MasaHatasi('bot-koltugu-talep-gerekmez');

  await Masa.updateOne(
    { _id: masa._id },
    {
      // Ayni oyuncunun bekleyen tek talebi olur: fikri degisirse yenisi
      // eskisinin yerine gecer.
      $pull: { koltukTalepleri: { isteyen: new Types.ObjectId(oyuncuId) } },
    },
  );
  await Masa.updateOne(
    { _id: masa._id, durum: 'bekliyor' },
    { $push: { koltukTalepleri: { isteyen: new Types.ObjectId(oyuncuId), hedefKoltuk } } },
  );
  return (await Masa.findById(masa._id)) as NonNullable<typeof masa>;
}

/**
 * Gelen koltuk talebini cevaplar.
 *
 * Kabul edilirse iki koltuk YER DEGISTIRIR. Cevap veren oyuncunun hedef
 * koltukta HALA oturuyor olmasi araniyor: arada koltuk degistirmis olabilir.
 */
export async function koltukTalebiCevapla(oyuncuId: string, isteyenId: string, kabul: boolean) {
  const masa = await acikMasam(oyuncuId);
  if (masa === null) throw new MasaHatasi('masada-degilsin');
  if (masa.durum !== 'bekliyor') throw new MasaHatasi('oyun-basladi');

  const talep = masa.koltukTalepleri.find((t) => String(t.isteyen) === isteyenId);
  if (talep === undefined) throw new MasaHatasi('talep-yok');

  const benim = masa.koltuklar.find((k) => String(k.oyuncu) === oyuncuId);
  if (benim === undefined || benim.no !== talep.hedefKoltuk) {
    // Talep artik bana ait degil; sessizce dussun.
    masa.set(
      'koltukTalepleri',
      masa.koltukTalepleri.filter((t) => String(t.isteyen) !== isteyenId),
    );
    await masa.save();
    throw new MasaHatasi('talep-gecersiz');
  }

  if (kabul) {
    const isteyen = masa.koltuklar.find((k) => String(k.oyuncu) === isteyenId);
    if (isteyen === undefined) throw new MasaHatasi('isteyen-masadan-cikmis');
    const benimNo = benim.no;
    benim.no = isteyen.no;
    isteyen.no = benimNo;
  }

  masa.set(
    'koltukTalepleri',
    masa.koltukTalepleri.filter((t) => String(t.isteyen) !== isteyenId),
  );
  await masa.save();
  return masa;
}

export async function masaKur(oyuncuId: string, ozel = true) {
  if ((await acikMasam(oyuncuId)) !== null) {
    throw new MasaHatasi('zaten-masadasin');
  }
  const kod = await benzersizKod();
  return Masa.create({
    kod,
    sahip: new Types.ObjectId(oyuncuId),
    ozel,
    // Masayi acan koltugunda HAZIR baslar: dort kisi toplandiginda bir de
    // "ben hazirim" turu beklemek, dort arkadasin es zamanli olmasini
    // gerektiriyordu. Isteyen `masa:hazir` ile geri alabilir.
    koltuklar: [{ no: 0, oyuncu: new Types.ObjectId(oyuncuId), bot: false, hazir: true }],
    // Kimse katilmazsa kendiliginden silinsin; ilk katilimda temizlenir.
    kapanmaZamani: new Date(Date.now() + config.oda.bosMasaOmruMs),
  });
}

/**
 * Hizli eslesme: kod bilmeden oynamak isteyeni bekleyen bir ACIK masaya
 * oturtur; yoksa yeni bir acik masa acar.
 *
 * En dolu masa oncelikli (`koltuklar` cok olan): oyuncular tek bir masada
 * toplansin, dort ayri masada birer kisi beklemesin. Az oyuncu varken bu
 * fark, oyunun hic baslamamasiyla baslamasi arasindaki fark oluyor.
 */
export async function hizliMasa(oyuncuId: string) {
  const mevcut = await acikMasam(oyuncuId);
  if (mevcut !== null) return mevcut;

  const adaylar = await Masa.find({ durum: 'bekliyor', ozel: false }).sort({ createdAt: 1 });
  const siralanmis = adaylar
    .filter((masa) => masa.koltuklar.length < MASA_KAPASITESI)
    .sort((a, b) => b.koltuklar.length - a.koltuklar.length);

  // Engelli biri oturuyorsa o masa atlanir (App Store 1.2). Kontrol burada da
  // yapiliyor cunku `masayaKatil` hata firlatir; hizli eslesmede hata degil
  // BIR SONRAKI MASA istiyoruz — oyuncu neden reddedildigini anlamak zorunda
  // kalmasin.
  for (const masa of siralanmis) {
    const oturanlar = masa.koltuklar.filter((k) => !k.bot).map((k) => String(k.oyuncu));
    if (await engelliBiriVarMi(oyuncuId, oturanlar)) continue;
    return masayaKatil(masa.kod, oyuncuId);
  }
  return masaKur(oyuncuId, false);
}

/** Ayni anda oturmaya calisan oyuncular icin kac kez denenecek. */
const KOLTUK_DENEMESI = 8;

/**
 * Masaya oturur.
 *
 * Koltuk secimi ATOMIK olmak zorunda. Once `findOne` ile okuyup sonra
 * `save()` demek klasik oku-degistir-yaz yarisi: dort arkadas kodu ayni anda
 * girdiginde ikisi de ayni belgeyi okuyup ayni bos koltugu secebiliyor. Bu
 * gercekten yasandi — iki oyuncu 1 numarali koltukta otururken 3 numara bos
 * kaldi; ikisi ayni eli gordu, bos koltugu da sunucu oynadi.
 *
 * Cozum: `findOneAndUpdate` filtresine "bu koltuk HALA bos ve masa HALA dolu
 * degil" sartini koymak. Mongo bu kontrolu ve yazmayi tek islemde yapiyor.
 * Kaybeden istemci null aliyor ve bir sonraki bos koltuk icin yeniden
 * deniyor.
 */
export async function masayaKatil(kod: string, oyuncuId: string) {
  const temizKod = kod.trim().toUpperCase();
  const kimlik = new Types.ObjectId(oyuncuId);

  for (let deneme = 0; deneme < KOLTUK_DENEMESI; deneme++) {
    const masa = await Masa.findOne({ kod: temizKod });
    if (masa === null) throw new MasaHatasi('masa-bulunamadi');
    if (masa.durum === 'bitti') throw new MasaHatasi('masa-kapandi');

    const zatenVar = masa.koltuklar.some((koltuk) => String(koltuk.oyuncu) === oyuncuId);
    if (zatenVar) return masa; // Yeniden baglanma: koltugu duruyor.

    if (masa.durum === 'oynaniyor') throw new MasaHatasi('masa-basladi');

    const baskaMasa = await acikMasam(oyuncuId);
    if (baskaMasa !== null) throw new MasaHatasi('zaten-masadasin');

    const koltuk = bosKoltuk(masa);
    if (koltuk === null) throw new MasaHatasi('masa-dolu');

    // Engelin GERCEK bir karsiligi olmali (App Store 1.2). Engelledigin ya da
    // seni engelleyen biriyle ayni masaya oturmuyorsun — kodu bilse bile.
    const oturanlar = masa.koltuklar.filter((k) => !k.bot).map((k) => String(k.oyuncu));
    if (await engelliBiriVarMi(oyuncuId, oturanlar)) {
      throw new MasaHatasi('masada-engelli-oyuncu');
    }

    const guncel = await Masa.findOneAndUpdate(
      {
        _id: masa._id,
        durum: 'bekliyor',
        // Koltuk HALA bos mu? Dizide o numaradan bir eleman olmamali.
        'koltuklar.no': { $ne: koltuk },
        // Masa HALA dolu degil mi? Bu olmadan bes kisi oturabilirdi.
        $expr: { $lt: [{ $size: '$koltuklar' }, MASA_KAPASITESI] },
        // Ayni oyuncu iki koltuga oturmasin (iki cihaz, cift dokunus).
        'koltuklar.oyuncu': { $ne: kimlik },
      },
      {
        $push: { koltuklar: { no: koltuk, oyuncu: kimlik, bot: false, hazir: true } },
        // Artik bos degil: kendiliginden silinme kalksin.
        $unset: { kapanmaZamani: '' },
      },
      { new: true },
    );

    // null: baskasi bu koltugu bizden once kaptı. Yeniden oku ve dene.
    if (guncel !== null) return guncel;
  }

  throw new MasaHatasi('masa-yogun');
}

/**
 * Oyun SURERKEN masadan ayrilma: koltuk BOTA devredilir.
 *
 * Dort koltuk dolu olmadan motor ilerlemiyor, bu yuzden koltugu bosaltmak
 * eli kilitlerdi. Onceki cozum koltugu oyuncunun ustunde birakmakti; sonucu
 * "masadan cikamiyorum" oldu ve iki yerden birden geliyordu:
 *
 *  1. `oyun:gorunum` masa odasina degil KISISEL odaya gidiyor. Soketi masa
 *     odasindan cikarmak paketleri kesmiyordu; istemci lobiye donuyor, ilk
 *     gorunum paketinde masaya geri sicriyordu.
 *  2. Koltuk durdugu icin `acikMasam` hala o masayi donduruyordu — oyuncu
 *     "Zaten bir masadasin" ile yeni masa da acamiyordu.
 *
 * Koltugu bota devretmek ikisini birden cozuyor: oyuncu `insanlar`
 * listesinden dusuyor (gorunum gitmiyor) ve acik masasi kalmiyor. Bot
 * koltugu altyapisi zaten vardi (`masa:botDoldur`), yeni bir kavram degil.
 *
 * Geri donus yok: ele devam eden bot. Ekran bunu onay sorarak soyluyor.
 */
export async function koltuguBotaDevret(oyuncuId: string) {
  const masa = await acikMasam(oyuncuId);
  if (masa === null) return null;
  if (masa.durum !== 'oynaniyor') return null;
  if (!masa.koltuklar.some((koltuk) => String(koltuk.oyuncu) === oyuncuId)) return null;

  // Mongoose alt-belge dizisine duz dizi atanamiyor; `set` ile veriyoruz.
  // Devredilen koltuk `oyuncu` alanini HIC tasimamali (bot koltugunun sozlesmesi).
  masa.set(
    'koltuklar',
    masa.koltuklar.map((koltuk) =>
      String(koltuk.oyuncu) === oyuncuId
        ? { no: koltuk.no, bot: true, hazir: true }
        : { no: koltuk.no, oyuncu: koltuk.oyuncu, bot: koltuk.bot, hazir: koltuk.hazir },
    ),
  );

  const insanlar = masa.koltuklar.filter((koltuk) => !koltuk.bot);
  if (insanlar.length === 0) {
    // Son insan da cikti: botlarin kendi kendine oynadigi masayi ayakta
    // tutmanin anlami yok.
    masa.durum = 'bitti';
    masa.set('kapanmaZamani', new Date());
  } else if (String(masa.sahip) === oyuncuId) {
    const yeniSahip = insanlar.slice().sort((a, b) => a.no - b.no)[0];
    if (yeniSahip?.oyuncu != null) masa.sahip = yeniSahip.oyuncu;
  }

  await masa.save();
  return masa;
}

/**
 * Masadan cikma — BEKLEYEN masa icin.
 *
 * Oyun basladiysa koltuk bosaltilamaz (motor dort oyuncu bekliyor); o durumda
 * cagiran `koltuguBotaDevret`i kullanir. Burasi `oynaniyor` masada hicbir sey
 * yapmaz ve null doner.
 */
export async function masadanCik(oyuncuId: string) {
  const masa = await acikMasam(oyuncuId);
  if (masa === null) return null;
  if (masa.durum === 'oynaniyor') return null;

  // Mongoose alt-belge dizisine duz dizi atanamiyor; `set` ile veriyoruz.
  masa.set(
    'koltuklar',
    masa.koltuklar.filter((koltuk) => String(koltuk.oyuncu) !== oyuncuId),
  );

  // Cikan oyuncunun bekleyen talebi de dussun.
  masa.set(
    'koltukTalepleri',
    masa.koltukTalepleri.filter((talep) => String(talep.isteyen) !== oyuncuId),
  );

  const insanlar = masa.koltuklar.filter((koltuk) => !koltuk.bot);
  if (insanlar.length === 0) {
    // Insan kalmadi: masa hemen kapanir. Botlarla dolu bir masayi ayakta
    // tutmanin anlami yok — kimse oynamiyor, sunucu bosuna el dagitirdi.
    masa.durum = 'bitti';
    masa.set('kapanmaZamani', new Date());
  } else if (String(masa.sahip) === oyuncuId) {
    // Sahip cikarsa masa sahipsiz kalmasin; en kucuk INSAN koltugu devralir.
    const yeniSahip = insanlar.slice().sort((a, b) => a.no - b.no)[0];
    if (yeniSahip?.oyuncu != null) masa.sahip = yeniSahip.oyuncu;
  }
  await masa.save();
  return masa;
}

export async function hazirDurumu(oyuncuId: string, hazir: boolean) {
  const masa = await acikMasam(oyuncuId);
  if (masa === null) throw new MasaHatasi('masada-degilsin');

  const koltuk = masa.koltuklar.find((k) => String(k.oyuncu) === oyuncuId);
  if (koltuk === undefined) throw new MasaHatasi('koltugun-yok');

  koltuk.hazir = hazir;
  await masa.save();
  return masa;
}

/**
 * Oyun baslayabilir mi? Dort koltuk dolu ve INSAN koltuklarinin hepsi hazir.
 *
 * Bot koltugu her zaman hazir sayilir (`hazir: true` ile ekleniyor); bekleyen
 * bir botun kimseye faydasi yok.
 */
export function baslayabilirMi(masa: MasaBelgesi): boolean {
  return (
    masa.durum === 'bekliyor' &&
    masa.koltuklar.length === MASA_KAPASITESI &&
    masa.koltuklar.every((koltuk) => koltuk.bot || koltuk.hazir)
  );
}

/**
 * Acilista yarim kalmis masalari kapatir.
 *
 * Canli oyun durumu BELLEKTE (servisler/oyunServisi.ts). Sunucu yeniden
 * baslayinca o durum gider; Mongo'da `oynaniyor` kalan masa artik geri
 * kurulamaz. Temizlemezsek oyuncular sonsuza kadar "zaten bir masadasin"
 * hatasi alir ve hicbir masaya oturamaz.
 *
 * El kayitlari SILINMEZ — onlar zaten kalici (modeller/ElKaydi.ts).
 */
export async function yarimMasalariKapat(): Promise<number> {
  const sonuc = await Masa.updateMany(
    { durum: { $ne: 'bitti' } },
    { $set: { durum: 'bitti', kapanmaZamani: new Date() } },
  );
  return sonuc.modifiedCount;
}
