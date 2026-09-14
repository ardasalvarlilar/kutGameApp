// Socket.io katmani: kimlik dogrulama, oda olaylari, oyun olaylari.
//
// Sunucu OTORITER. Istemci hicbir zaman "su oldu" demiyor, "sunu yapmak
// istiyorum" diyor; karari motor veriyor.
//
// Her oyuncu iki odada birden: masanin odasi (`masa:<id>`, herkese acik
// yayinlar icin) ve kendi kisisel odasi (`oyuncu:<id>`, `viewFor` ciktisi
// icin). Ikinci oda sart — gorunum kisiye ozel, ortak yayin sizinti olurdu.
//
// Yardimcilar bilerek MODUL SEVIYESINDE ve `io`yu parametre aliyor: masayi
// baslatan soket kopsa bile eli bitiren geri cagri calisabilmeli. Baglantiya
// kapatilmis olsalardi, masayi kuran kisi cikinca el sonu islenmezdi.

import type { Server, Socket } from 'socket.io';
import { Types } from 'mongoose';
import { z } from 'zod';
import {
  AKSIYON_TIPLERI,
  OYUNCULAR,
  macKazanani,
  oyuncuKaydiOlustur,
  type OyuncuId,
  type OyuncuKaydi,
  type TurNo,
} from '@kut/engine';
import {
  KADEME_KIMLIKLERI,
  kazananPayi,
  macDeneyimi,
  macSiralari,
  potHesapla,
} from '@kut/ekonomi';
import { kayit } from '../kayit.js';
import { ElKaydi } from '../modeller/ElKaydi.js';
import { Masa, type MasaBelgesi } from '../modeller/Masa.js';
import { jetonuCoz } from '../servisler/kimlikServisi.js';
import { cipEkle, cuzdanDurumlari, girisleriTahsilEt } from '../servisler/cuzdanServisi.js';
import { deneyimEkle, elIsle, macIsle } from '../servisler/ilerlemeServisi.js';
import {
  MASA_KAPASITESI,
  MasaHatasi,
  acikMasalar,
  acikMasam,
  baslayabilirMi,
  botKimligi,
  botlariDoldur,
  botuCikar,
  hazirDurumu,
  hizliMasa,
  koltugaGec,
  koltukTalebiCevapla,
  koltukTalebiGonder,
  masaGorunumu,
  masaKur,
  masadanCik,
  koltuguBotaDevret,
  masayaKatil,
} from '../servisler/masaServisi.js';
import { Oyuncu } from '../modeller/Oyuncu.js';
import { basarili, basarisiz, type MacSonu, type Yanit } from '../tipler/protokol.js';
import { MasaOturumu, type Oturan } from './masaOturumu.js';

/** Canli oturumlar — masaId -> oturum. Bellekte; kalici olan el kaydi. */
const oturumlar = new Map<string, MasaOturumu>();

/**
 * Sunucu kapaniyor mu?
 *
 * `io.close()` butun soketleri dusuruyor ve her biri `disconnect` isleyicisini
 * calistiriyor; o isleyici de Mongo'ya gidiyor. Ama kapanis sirasinda Mongo
 * baglantisi da kapaniyor — yarista kalan sorgu `MongoNotConnectedError`
 * firlatip SURECI DUSURUYORDU. Her dagitimda gorulen bu cokusun sebebi buydu.
 *
 * Bayrak, kapanista temizlik yapmaya calismayi engelliyor: zaten yapacak bir
 * sey yok, canli durum bellekte ve gidiyor. Acilista `yarimMasalariKapat`
 * geride kalan masalari topluyor.
 */
let kapaniyor = false;

/** Kapanis basladi: artik veritabanina dokunan isleyici calismasin. */
export function kapanisaGec(): void {
  kapaniyor = true;
}

/** `soketiKur`un aldigi sunucu — REST katmani oyuncuyu atabilsin diye. */
let aktifIo: Server | null = null;

/**
 * Oyuncunun acik soketlerini keser (yonetici askiya aldiysa ya da sildiyse).
 *
 * Soketin kimlik kontrolu yalnizca BAGLANIRKEN yapiliyor (`io.use`); askiya
 * alinan oyuncu kesilmezse o oturum boyunca oynamaya devam ederdi. Yeniden
 * baglanmaya calistiginda `hesap-askida` aliyor.
 */
export function oyuncuyuBaglantidanAt(oyuncuId: string): void {
  aktifIo?.in(`oyuncu:${oyuncuId}`).disconnectSockets(true);
}

/** El bitince sonraki elin dagitilmasi icin beklenen sure (ms). */
const TUR_ARASI_MS = 6_000;

const katilSemasi = z.object({ kod: z.string().trim().min(3).max(12) });
// Kademe bos gelirse Caylak: kademeden habersiz eski bir istemci de oynayabilsin.
const kademeAlani = z.enum(KADEME_KIMLIKLERI).optional();
const kurSemasi = z.object({ ozel: z.boolean().optional(), kademe: kademeAlani });
const hizliSemasi = z.object({ kademe: kademeAlani });
const hazirSemasi = z.object({ hazir: z.boolean() });
const koltukSemasi = z.object({ koltuk: z.number().int().min(0).max(3) });
const koltukCevapSemasi = z.object({ isteyenId: z.string().min(1), kabul: z.boolean() });
const aksiyonSemasi = z.object({
  aksiyon: z
    .object({
      // `z.string()` DEGIL, kapali liste. Motorun `reduce`u tanimadigi bir
      // `tip` icin hicbir dalla eslesmiyor ve `undefined` donuyor; sunucu da
      // `sonuc.ok` okumaya calisip dusuyordu. Yani kimliği dogrulanmis
      // herhangi bir istemci tek paketle sunucuyu kapatabiliyordu.
      // Liste motordan geliyor (`AKSIYON_TIPLERI`) ve orada birlesime
      // kilitli — biri degisip digeri unutulamaz.
      tip: z.enum(AKSIYON_TIPLERI),
      oyuncu: z.number().int().min(0).max(3),
    })
    // Alanlarin geri kalanini motor dogruluyor: `tasId` elinde mi, `perId`
    // yerde mi... Hepsini burada tekrarlamak iki ayri kural kaynagi olurdu.
    .passthrough(),
  hamleNo: z.number().int().nonnegative(),
});

function oyuncuId(soket: Socket): string {
  return soket.data.oyuncuId as string;
}

/** Hata mesajini istemciye guvenle gecirir; beklenmeyeni gizler. */
function hataMesaji(hata: unknown): string {
  if (hata instanceof MasaHatasi) return hata.message;
  kayit.hata('Beklenmeyen soket hatasi', hata);
  return 'beklenmeyen-hata';
}

// --- Masa akisi --------------------------------------------------------------

/** Masa durumunu tum masaya yayar. */
async function masayiYay(io: Server, masaId: string): Promise<void> {
  const masa = await Masa.findById(masaId);
  if (masa === null) return;
  const oturum = oturumlar.get(masaId);
  io.to(`masa:${masaId}`).emit(
    'masa:durum',
    await masaGorunumu(masa, {
      ...(oturum === undefined ? {} : { bagliOlanlar: oturum.bagliOlanlar }),
    }),
  );
}

/** Bakiyesi ya da seviyesi degisen oyunculara ust barlari icin yeni ozet. */
async function cuzdanlariGonder(io: Server, oyuncuIdler: readonly string[]): Promise<void> {
  try {
    const durumlar = await cuzdanDurumlari(oyuncuIdler);
    for (const [oyuncuId, durum] of durumlar) {
      io.to(`oyuncu:${oyuncuId}`).emit('oyuncu:cuzdan', durum);
    }
  } catch (hata) {
    kayit.uyari('Cuzdan ozeti gonderilemedi', hata);
  }
}

/**
 * Girisi oduyemeyen var: masa bekleme odasina doner, oduyemeyenler kalkar.
 *
 * Kalkanlarin soketi masa odasindan cikariliyor ve `masaId`leri siliniyor;
 * yoksa ekran lobiye donse de masanin yayinlari gelmeye devam ederdi.
 */
async function baslatmayiGeriAl(
  io: Server,
  masaId: string,
  yetersizler: readonly string[],
): Promise<void> {
  await Masa.updateOne({ _id: masaId }, { $set: { durum: 'bekliyor' } });
  for (const oyuncuId of yetersizler) {
    const kalan = await masadanCik(oyuncuId);
    for (const soket of await io.in(`oyuncu:${oyuncuId}`).fetchSockets()) {
      soket.leave(`masa:${masaId}`);
      soket.data.masaId = null;
      soket.emit('masa:ayrildi', { sebep: 'cip-yetersiz' });
    }
    if (kalan !== null && kalan.durum === 'bitti') oturumuBitir(io, masaId, 'masa-kapandi');
  }
  await masayiYay(io, masaId);
}

/** Dort kisi hazirsa girisleri tahsil eder ve eli baslatir. */
async function gerekirseBaslat(io: Server, masaId: string): Promise<void> {
  if (oturumlar.has(masaId)) return;
  const onizleme = await Masa.findById(masaId);
  if (onizleme === null || !baslayabilirMi(onizleme)) return;

  // Baslatmayi TEK bir cagri kazanmali. Katilma ve "hazir" ayni anda gelip
  // ikisi de buraya dusebiliyor; ikisi de gecseydi giris IKI KEZ tahsil
  // edilirdi. Filtre `baslayabilirMi`nin kosullarini Mongo'da tekrarliyor:
  // okuma ile bu yazma arasinda biri kalkmis ya da "hazir degilim" demis
  // olabilir.
  const masa = await Masa.findOneAndUpdate(
    {
      _id: masaId,
      durum: 'bekliyor',
      $expr: { $eq: [{ $size: '$koltuklar' }, MASA_KAPASITESI] },
      koltuklar: { $not: { $elemMatch: { bot: false, hazir: false } } },
    },
    // El basladi: bekleyen koltuk talepleri artik anlamsiz.
    { $set: { durum: 'oynaniyor', koltukTalepleri: [] } },
    { new: true },
  );
  if (masa === null) return;

  // Botlar pota girmez (@kut/ekonomi odul.ts); yalnizca insanlar oduyor.
  const insanIdler = masa.koltuklar
    .filter((koltuk) => !koltuk.bot)
    .map((koltuk) => String(koltuk.oyuncu));
  const tahsilat = await girisleriTahsilEt(masaId, insanIdler, masa.giris);
  if (tahsilat.yetersizler.length > 0) {
    await baslatmayiGeriAl(io, masaId, tahsilat.yetersizler);
    return;
  }

  masa.pot = potHesapla(tahsilat.odeyenler.length, masa.giris);
  masa.set(
    'odeyenler',
    tahsilat.odeyenler.map((oyuncuId) => new Types.ObjectId(oyuncuId)),
  );
  await masa.save();
  void cuzdanlariGonder(io, tahsilat.odeyenler);

  const oturanlar: Oturan[] = masa.koltuklar
    .slice()
    .sort((a, b) => a.no - b.no)
    .map((koltuk) => ({
      koltuk: koltuk.no as OyuncuId,
      oyuncuId: koltuk.bot ? botKimligi(koltuk.no) : String(koltuk.oyuncu),
      bot: koltuk.bot,
      bagli: true,
    }));

  const oturum = new MasaOturumu(io, {
    masaId,
    oturanlar,
    tur: masa.tur as TurNo,
    onElBitti: (biten) => elBittiginde(io, biten),
  });
  oturumlar.set(masaId, oturum);
  await masayiYay(io, masaId);
  oturum.baslat();
  kayit.bilgi('El başladı', { masaId, tur: masa.tur });
}

/**
 * Mac bitti: potu kazanana, deneyimi siraya gore dagit.
 *
 * Odul yalnizca girisi odemis ve HALA oturan insan kazanana. Masadan kendi
 * istegiyle kalkanin koltugunu bot oynadi; o koltuk kazanirsa pay yanar.
 * Baglantisi kopan ise koltugunda duruyor (MIMARI.md §3) — geri gelmese de
 * kazandiysa alir.
 *
 * Deneyim de ayni sekilde: maci bitiren insan koltuklarina.
 */
async function macSonunuIsle(
  masa: MasaBelgesi & { _id: unknown },
  oturum: MasaOturumu,
  toplamlar: OyuncuKaydi<number>,
  kazananlar: readonly OyuncuId[],
): Promise<MacSonu> {
  const masaId = String(masa._id);
  const cip: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const deneyim: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };

  const odeyenler = new Set(masa.odeyenler.map(String));
  const pay = kazananPayi(masa.pot, kazananlar.length);
  for (const koltuk of kazananlar) {
    const oturan = oturum.oyuncusu(koltuk);
    if (oturan === undefined || oturan.bot || !odeyenler.has(oturan.oyuncuId)) continue;
    try {
      await cipEkle(oturan.oyuncuId, pay, 'masa-odulu', masaId);
      cip[koltuk] = pay;
    } catch (hata) {
      kayit.hata('Mac odulu yazilamadi', { masaId, oyuncuId: oturan.oyuncuId, pay, hata });
    }
  }

  const siralar = macSiralari(OYUNCULAR.map((koltuk) => toplamlar[koltuk]));
  for (const oturan of oturum.insanlar) {
    const kazanilan = macDeneyimi(siralar[oturan.koltuk] ?? OYUNCULAR.length - 1);
    await deneyimEkle(oturan.oyuncuId, kazanilan);
    deneyim[oturan.koltuk] = kazanilan;
  }

  return { cip, deneyim };
}

/**
 * El kapandi: kaydi yaz, puanlari isle, siradaki tura gec.
 * Motor kurali #2 sayesinde `tohum + aksiyonlar` eli birebir geri kurar.
 */
async function elBittiginde(io: Server, oturum: MasaOturumu): Promise<void> {
  const masa = await Masa.findById(oturum.masaId);
  if (masa === null) {
    oturum.kapat();
    oturumlar.delete(oturum.masaId);
    return;
  }

  const bilgi = oturum.oyun.elBilgisi;
  const sonuc = oturum.oyun.sonuc;
  const sirali = oturum.oturanlar.slice().sort((a, b) => a.koltuk - b.koltuk);
  // Istatistik ve el kaydi yalnizca GERCEK oyuncular icin: bot kimligi
  // (`bot:2`) bir ObjectId degil, Mongo sorgusunda hata verirdi.
  const insanlar = sirali.filter((o) => !o.bot);

  await ElKaydi.create({
    masa: masa._id,
    tur: bilgi.tur,
    tohum: bilgi.tohum,
    baslayan: bilgi.baslayan,
    oturanlar: sirali.map((o) =>
      o.bot ? { no: o.koltuk, bot: true } : { no: o.koltuk, oyuncu: o.oyuncuId, bot: false },
    ),
    aksiyonlar: bilgi.aksiyonlar,
    sonuc,
  });

  if (sonuc !== null) {
    for (const oturan of oturum.oturanlar) {
      const onceki = masa.puanlar.get(String(oturan.koltuk)) ?? 0;
      masa.puanlar.set(String(oturan.koltuk), onceki + sonuc.puanlar[oturan.koltuk]);
    }
    const kazanan = sonuc.kazanan === null ? undefined : oturum.oyuncusu(sonuc.kazanan);
    void elIsle({
      oyuncuIdler: insanlar.map((o) => o.oyuncuId),
      kazananId: kazanan === undefined || kazanan.bot ? null : kazanan.oyuncuId,
    });
  }

  // Mac 16. TUR oynanip bitince biter (KURALLAR.md §3). El sayisina bakmak
  // yanlis olurdu: ayni tur yeniden dagitilabiliyor.
  const macBitti = masa.tur >= 16;

  // Toplam puanlari motorun bekledigi sekle cevir; eksik koltuk 0 sayilir.
  const toplamlar = oyuncuKaydiOlustur((koltuk) => masa.puanlar.get(String(koltuk)) ?? 0);
  const macKazananlari = macBitti ? macKazanani(toplamlar) : [];

  if (macBitti) {
    masa.durum = 'bitti';
    // Istemciler son tabloyu okusun diye birkac dakika daha duruyor.
    masa.set('kapanmaZamani', new Date(Date.now() + 5 * 60_000));
  } else {
    masa.tur += 1;
  }
  // Masa `bitti` olarak ODULDEN ONCE yaziliyor: arada sunucu duserse acilis
  // iadesi (yarimMasalariKapat) bu masayi gormesin — odul ile iade ikisi
  // birden verilmesin.
  await masa.save();

  const macSonu = macBitti
    ? await macSonunuIsle(masa, oturum, toplamlar, macKazananlari)
    : null;

  if (sonuc !== null) {
    io.to(`masa:${oturum.masaId}`).emit('oyun:elSonu', {
      sonuc,
      masa: await masaGorunumu(masa, { bagliOlanlar: oturum.bagliOlanlar }),
      macKazananlari,
      sonrakiElSn: macBitti ? null : Math.round(TUR_ARASI_MS / 1000),
      macSonu,
    });
  }
  await masayiYay(io, oturum.masaId);
  if (macBitti) void cuzdanlariGonder(io, insanlar.map((o) => o.oyuncuId));

  if (macBitti) {
    void macIsle(
      insanlar.map((o) => o.oyuncuId),
      macKazananlari
        .map((koltuk) => oturum.oyuncusu(koltuk))
        .filter((oturan): oturan is NonNullable<typeof oturan> => oturan !== undefined && !oturan.bot)
        .map((oturan) => oturan.oyuncuId),
    );
    oturum.kapat();
    oturumlar.delete(oturum.masaId);
    kayit.bilgi('Maç bitti', { masaId: oturum.masaId });
    return;
  }

  // Sonraki el hemen degil, sonucu gorsunler diye kisa bir ara.
  const sonrakiTur = masa.tur as TurNo;
  oturum.sonrakiElePlanla(TUR_ARASI_MS, () => {
    // Ara sirasinda masa kapandiysa (herkes cikti) yeni el dagitma.
    if (!oturumlar.has(oturum.masaId)) return;
    oturum.yeniEl(sonrakiTur);
    void masayiYay(io, oturum.masaId);
  });
}

/** Masa artik oynanamiyor: oturumu kapat, oyuncuları bilgilendir. */
function oturumuBitir(io: Server, masaId: string, sebep: string): void {
  const oturum = oturumlar.get(masaId);
  if (oturum === undefined) return;
  oturum.kapat();
  oturumlar.delete(masaId);
  io.to(`masa:${masaId}`).emit('masa:ayrildi', { sebep });
}

// --- Baglanti ----------------------------------------------------------------

export function soketiKur(io: Server): void {
  aktifIo = io;
  // --- Kimlik ---------------------------------------------------------------
  // Baglanti kurulmadan once dogrulanir; jetonsuz soket hic acilmaz.
  io.use(async (soket, sonraki) => {
    const jeton = (soket.handshake.auth as { jeton?: string } | undefined)?.jeton;
    if (typeof jeton !== 'string') return sonraki(new Error('jeton-gerekli'));

    const icerik = jetonuCoz(jeton);
    if (icerik === null) return sonraki(new Error('jeton-gecersiz'));

    const oyuncu = await Oyuncu.findById(icerik.oyuncuId).select('ad engelli').lean();
    if (oyuncu === null) return sonraki(new Error('oyuncu-bulunamadi'));
    if (oyuncu.engelli) return sonraki(new Error('hesap-askida'));

    soket.data.oyuncuId = icerik.oyuncuId;
    soket.data.ad = oyuncu.ad;
    soket.data.masaId = null;
    sonraki();
  });

  io.on('connection', (soket) => {
    const kimlik = oyuncuId(soket);
    void soket.join(`oyuncu:${kimlik}`);
    kayit.bilgi(`Bağlandı: ${soket.data.ad as string}`, { kimlik });

    /**
     * Devam eden bir elde oyuncuya durumu geri verir.
     *
     * Yeniden baglanmanin butun isi burada: gorunum kisisel odaya degil
     * DOGRUDAN bu sokete gidiyor, cunku ayni oyuncunun eski (olu) soketi
     * hala odada olabilir ve iki kopya gondermenin anlami yok.
     */
    const oyunuGeriVer = (masaId: string): void => {
      const oturum = oturumlar.get(masaId);
      if (oturum === undefined) return;

      oturum.baglantiDurumu(kimlik, true);
      const koltuk = oturum.koltugu(kimlik);
      if (koltuk === null) return;

      soket.emit('oyun:gorunum', { gorunum: oturum.oyun.gorunum(koltuk), hamleNo: 0 });
      const bitis = oturum.oyun.siraBitisi;
      if (bitis !== null) {
        soket.emit('oyun:sure', {
          siradaki: oturum.oyun.siradaki,
          bitisZamani: bitis,
          sure: oturum.oyun.siraSuresi(),
          sunucuZamani: Date.now(),
        });
      }
    };

    /** Soketi masanin odasina alir ve kimligini isaretler. */
    const odayaGir = async (masaId: string): Promise<void> => {
      soket.data.masaId = masaId;
      await soket.join(`masa:${masaId}`);
    };

    // --- Masa olaylari -------------------------------------------------------

    // Acilis ve yeniden baglanmanin tek ucu: "hangi masadayim?"
    soket.on('masa:benim', async (_girdi: unknown, yanit: (s: Yanit<unknown>) => void) => {
      try {
        const masa = await acikMasam(kimlik);
        if (masa === null) return yanit(basarili({ masa: null }));

        const masaId = String(masa._id);
        await odayaGir(masaId);
        const oturum = oturumlar.get(masaId);
        const gorunum = await masaGorunumu(masa, {
          ...(oturum === undefined ? {} : { bagliOlanlar: oturum.bagliOlanlar }),
        });
        yanit(basarili({ masa: gorunum }));
        oyunuGeriVer(masaId);
        await masayiYay(io, masaId);
      } catch (hata) {
        yanit(basarisiz(hataMesaji(hata)));
      }
    });

    soket.on('masa:kur', async (girdi: unknown, yanit: (s: Yanit<unknown>) => void) => {
      const cozum = kurSemasi.safeParse(girdi ?? {});
      if (!cozum.success) return yanit(basarisiz('gecersiz-istek'));
      try {
        const masa = await masaKur(kimlik, cozum.data.ozel ?? true, cozum.data.kademe);
        const masaId = String(masa._id);
        await odayaGir(masaId);
        yanit(basarili({ masa: await masaGorunumu(masa) }));
      } catch (hata) {
        yanit(basarisiz(hataMesaji(hata)));
      }
    });

    soket.on('masa:katil', async (girdi: unknown, yanit: (s: Yanit<unknown>) => void) => {
      const cozum = katilSemasi.safeParse(girdi);
      if (!cozum.success) return yanit(basarisiz('masa-kodu-gecersiz'));
      try {
        const masa = await masayaKatil(cozum.data.kod, kimlik);
        const masaId = String(masa._id);
        await odayaGir(masaId);

        const oturum = oturumlar.get(masaId);
        yanit(
          basarili({
            masa: await masaGorunumu(masa, {
              ...(oturum === undefined ? {} : { bagliOlanlar: oturum.bagliOlanlar }),
            }),
          }),
        );
        // Yeniden baglanma: oturum varsa koltugu geri ver ve durumu gonder.
        oyunuGeriVer(masaId);
        await masayiYay(io, masaId);
        await gerekirseBaslat(io, masaId);
      } catch (hata) {
        yanit(basarisiz(hataMesaji(hata)));
      }
    });

    soket.on('masa:hizli', async (girdi: unknown, yanit: (s: Yanit<unknown>) => void) => {
      const cozum = hizliSemasi.safeParse(girdi ?? {});
      if (!cozum.success) return yanit(basarisiz('gecersiz-istek'));
      try {
        const masa = await hizliMasa(kimlik, cozum.data.kademe);
        const masaId = String(masa._id);
        await odayaGir(masaId);
        yanit(basarili({ masa: await masaGorunumu(masa) }));
        oyunuGeriVer(masaId);
        await masayiYay(io, masaId);
        await gerekirseBaslat(io, masaId);
      } catch (hata) {
        yanit(basarisiz(hataMesaji(hata)));
      }
    });

    // MASA BUL — oturmadan once bakmak icin. Odaya girmez, durum degistirmez.
    soket.on('masa:liste', async (_girdi: unknown, yanit: (s: Yanit<unknown>) => void) => {
      try {
        yanit(basarili({ masalar: await acikMasalar(kimlik) }));
      } catch (hata) {
        yanit(basarisiz(hataMesaji(hata)));
      }
    });

    soket.on('masa:hazir', async (girdi: unknown, yanit: (s: Yanit<unknown>) => void) => {
      const cozum = hazirSemasi.safeParse(girdi);
      if (!cozum.success) return yanit(basarisiz('gecersiz-istek'));
      try {
        const masa = await hazirDurumu(kimlik, cozum.data.hazir);
        const masaId = String(masa._id);
        yanit(basarili({ masa: await masaGorunumu(masa) }));
        await masayiYay(io, masaId);
        await gerekirseBaslat(io, masaId);
      } catch (hata) {
        yanit(basarisiz(hataMesaji(hata)));
      }
    });

    // --- Masa duzeni: botlar ve koltuklar ------------------------------------
    //
    // Hepsi yalnizca `bekliyor` durumunda calisiyor; kontroller servis
    // katmaninda (masaServisi), burasi yalnizca girdiyi cozup yayin yapiyor.

    /** Ortak kalip: masa duzenini degistir, herkese yay, gerekirse basla. */
    const duzeniDegistir = async (
      yanit: (s: Yanit<unknown>) => void,
      is: () => Promise<{ _id: unknown }>,
    ): Promise<void> => {
      try {
        const masa = await is();
        const masaId = String(masa._id);
        yanit(basarili({ masa: await masaGorunumu(masa as never) }));
        await masayiYay(io, masaId);
        await gerekirseBaslat(io, masaId);
      } catch (hata) {
        yanit(basarisiz(hataMesaji(hata)));
      }
    };

    soket.on('masa:botDoldur', async (_girdi: unknown, yanit: (s: Yanit<unknown>) => void) => {
      await duzeniDegistir(yanit, () => botlariDoldur(kimlik));
    });

    soket.on('masa:botCikar', async (girdi: unknown, yanit: (s: Yanit<unknown>) => void) => {
      const cozum = koltukSemasi.safeParse(girdi);
      if (!cozum.success) return yanit(basarisiz('gecersiz-koltuk'));
      await duzeniDegistir(yanit, () => botuCikar(kimlik, cozum.data.koltuk));
    });

    soket.on('masa:koltugaGec', async (girdi: unknown, yanit: (s: Yanit<unknown>) => void) => {
      const cozum = koltukSemasi.safeParse(girdi);
      if (!cozum.success) return yanit(basarisiz('gecersiz-koltuk'));
      await duzeniDegistir(yanit, () => koltugaGec(kimlik, cozum.data.koltuk));
    });

    soket.on('masa:koltukTalebi', async (girdi: unknown, yanit: (s: Yanit<unknown>) => void) => {
      const cozum = koltukSemasi.safeParse(girdi);
      if (!cozum.success) return yanit(basarisiz('gecersiz-koltuk'));
      await duzeniDegistir(yanit, () => koltukTalebiGonder(kimlik, cozum.data.koltuk));
    });

    soket.on('masa:koltukCevap', async (girdi: unknown, yanit: (s: Yanit<unknown>) => void) => {
      const cozum = koltukCevapSemasi.safeParse(girdi);
      if (!cozum.success) return yanit(basarisiz('gecersiz-istek'));
      await duzeniDegistir(yanit, () =>
        koltukTalebiCevapla(kimlik, cozum.data.isteyenId, cozum.data.kabul),
      );
    });

    soket.on('masa:cik', async (_girdi: unknown, yanit: (s: Yanit<unknown>) => void) => {
      try {
        const mevcut = await acikMasam(kimlik);
        if (mevcut === null) {
          soket.data.masaId = null;
          return yanit(basarili(null));
        }

        const masaId = String(mevcut._id);
        // Oyun basladiysa koltuk BOSALMAZ ama oyuncuda da kalmaz: yerine BOT
        // oturur (MIMARI.md §3 — motor dort koltuk bekliyor). Koltugu oyuncuda
        // birakmak "masadan cikamiyorum"a yol aciyordu: gorunum kisisel odaya
        // gittigi icin ekran masaya geri sicriyor, acik masasi durdugu icin
        // yeni masa da acamiyordu.
        if (mevcut.durum === 'oynaniyor') {
          oturumlar.get(masaId)?.botaDevret(kimlik);
          const masa = await koltuguBotaDevret(kimlik);
          await soket.leave(`masa:${masaId}`);
          soket.data.masaId = null;
          if (masa !== null) {
            if (masa.durum === 'bitti') oturumuBitir(io, masaId, 'Masa kapandı');
            else await masayiYay(io, masaId);
          }
          return yanit(basarili(null));
        }

        const masa = await masadanCik(kimlik);
        await soket.leave(`masa:${masaId}`);
        soket.data.masaId = null;
        if (masa !== null) {
          if (masa.durum === 'bitti') oturumuBitir(io, masaId, 'Masa kapandı');
          await masayiYay(io, masaId);
        }
        yanit(basarili(null));
      } catch (hata) {
        yanit(basarisiz(hataMesaji(hata)));
      }
    });

    // --- Oyun olaylari -------------------------------------------------------

    soket.on('oyun:aksiyon', (girdi: unknown, yanit: (s: Yanit<unknown>) => void) => {
      const cozum = aksiyonSemasi.safeParse(girdi);
      if (!cozum.success) return yanit(basarisiz('gecersiz-aksiyon'));

      const masaId = soket.data.masaId as string | null;
      if (masaId === null) return yanit(basarisiz('masada-degilsin'));

      const oturum = oturumlar.get(masaId);
      if (oturum === undefined) return yanit(basarisiz('masada-oyun-yok'));

      const sonuc = oturum.aksiyon(kimlik, cozum.data.aksiyon as never, cozum.data.hamleNo);
      yanit(sonuc.ok ? basarili(null) : basarisiz(sonuc.hata ?? 'hamle-reddedildi'));
    });

    // --- Kopma ---------------------------------------------------------------
    // Koltuk BOSALMAZ (MIMARI.md §3): oyun durmaz, sure normal isler ve
    // dolunca oyuncunun yerine oynanir. Geri baglanan ayni koltuga oturur.
    soket.on('disconnect', async () => {
      const masaId = soket.data.masaId as string | null;
      kayit.bilgi(`Ayrıldı: ${soket.data.ad as string}`, { kimlik });
      if (masaId === null || kapaniyor) return;

      // Govde try/catch icinde: bu isleyicinin cagirani yok, firlatan bir
      // satir dogrudan "unhandled rejection" oluyor ve Node'u dusurebiliyor.
      // Gercek bir ornegi var: iki oyuncu ayni anda kopunca ikisi de ayni
      // masa belgesini `save()` etmeye calisiyor ve ikincisi mongoose'un
      // `VersionError`unu aliyor. Kopan bir soket yuzunden sunucunun
      // dusmemesi gerekiyor.
      try {

        // Ayni oyuncunun baska bir soketi hala aciksa (uygulama yeniden
        // yuklendi, iki sekme) baglanti kopmus SAYILMAZ.
        const baskaSoket = (await io.in(`oyuncu:${kimlik}`).fetchSockets()).some(
          (baska) => baska.id !== soket.id,
        );
        if (baskaSoket) return;

        oturumlar.get(masaId)?.baglantiDurumu(kimlik, false);

        // Oyun baslamadiysa koltugu bosalt; bekleyen masa kilitlenmesin.
        const masa = await Masa.findById(masaId);
        if (masa !== null && masa.durum === 'bekliyor') {
          const kalan = await masadanCik(kimlik);
          if (kalan !== null && kalan.durum === 'bitti') oturumuBitir(io, masaId, 'Masa kapandı');
        }
        await masayiYay(io, masaId);
      } catch (hata) {
        kayit.uyari('Kopma islenirken hata', hata);
      }
    });
  });
}

/** Test ve kapanis icin: acik oturumlari temizler. */
export function oturumlariKapat(): void {
  for (const oturum of oturumlar.values()) oturum.kapat();
  oturumlar.clear();
}

export { acikMasam };
