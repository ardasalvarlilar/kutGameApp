// Masa düzeni: bot koltukları ve koltuk seçme/değiştirme.
//
// Iki ozellik de oyunun KENDISINI degistiriyor, o yuzden uctan uca sinaniyor:
//
//  1. BOT KOLTUKLARI — oyun dort oyuncusuz ilerlemiyor (motor dort koltuk
//     bekliyor) ama dordunun de insan olmasi gerekmiyor. Iki arkadas
//     toplandiysa masayi botlarla doldurup oynayabilmeli. Test yalnizca
//     "koltuk doldu mu"ya bakmiyor: botun GERCEKTEN oynadigini, elin
//     ilerledigini de dogruluyor.
//  2. KOLTUK SECIMI — kimin nerede oturdugu oyunu degistiriyor: attigin tasi
//     saginda oturan alir (§4) ve calma onceligi koltuk sirasina gore isler
//     (§5). Bos koltuga gecmek serbest, dolu koltuk oturanin onayindan geciyor.
//
// Mongo yoksa testler atlanir (bkz. cevrimici.test.ts'teki ayni not).

import { createServer, type Server as HttpSunucusu } from 'node:http';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { io as istemciAc, type Socket as IstemciSoketi } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { OyuncuGorunumu } from '@kut/engine';
import { uygulamayiKur } from '../src/app.js';
import { oturumlariKapat, soketiKur } from '../src/soket/index.js';
import type { MasaGorunumu, Yanit } from '../src/tipler/protokol.js';

const MONGO = process.env['TEST_MONGO_URI'] ?? 'mongodb://127.0.0.1:27017';
const VERITABANI = `kut_test_duzen_${Date.now()}`;

const mongoVar = await mongoose
  .connect(`${MONGO}/${VERITABANI}`, { serverSelectionTimeoutMS: 4000 })
  .then(() => true)
  .catch((hata: unknown) => {
    console.warn(`[masaDuzeni] Mongo'ya baglanilamadi, testler atlaniyor: ${String(hata)}`);
    return false;
  });

let http: HttpSunucusu;
let io: Server;
let kok: string;

function olayBekle<T>(soket: IstemciSoketi, olay: string, sureMs = 15_000): Promise<T> {
  return new Promise<T>((coz, red) => {
    const sayac = setTimeout(() => {
      soket.off(olay, isle);
      red(new Error(`"${olay}" olayi ${sureMs}ms icinde gelmedi`));
    }, sureMs);
    function isle(veri: T): void {
      clearTimeout(sayac);
      soket.off(olay, isle);
      coz(veri);
    }
    soket.on(olay, isle);
  });
}

function sor<T>(soket: IstemciSoketi, olay: string, girdi: unknown = {}): Promise<Yanit<T>> {
  return new Promise<Yanit<T>>((coz) => soket.emit(olay, girdi, coz));
}

async function misafirJetonu(cihaz: string): Promise<string> {
  const yanit = await fetch(`${kok}/api/kimlik/misafir`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cihazKimligi: cihaz }),
  });
  const govde = (await yanit.json()) as { veri: { jeton: string } };
  return govde.veri.jeton;
}

async function soketAc(jeton: string): Promise<IstemciSoketi> {
  const soket = istemciAc(kok, { auth: { jeton }, transports: ['websocket'], forceNew: true });
  await new Promise<void>((coz, red) => {
    soket.once('connect', () => coz());
    soket.once('connect_error', (hata) => red(hata));
  });
  return soket;
}

/** `adet` kadar yeni misafir soketi. */
async function soketler(etiket: string, adet: number): Promise<IstemciSoketi[]> {
  const damga = `${etiket}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const jetonlar = await Promise.all(
    Array.from({ length: adet }, (_d, no) => misafirJetonu(`${damga}-${no}`)),
  );
  return Promise.all(jetonlar.map(soketAc));
}

function kapat(liste: readonly IstemciSoketi[]): void {
  for (const soket of liste) soket.disconnect();
}

/** Koltuk numarasina gore koltugu bulur. */
function koltuk(masa: MasaGorunumu, no: number) {
  return masa.koltuklar.find((k) => k.no === no);
}

beforeAll(async () => {
  if (!mongoVar) return;
  http = createServer(uygulamayiKur());
  io = new Server(http, { cors: { origin: true } });
  soketiKur(io);
  await new Promise<void>((coz) => http.listen(0, coz));
  const adres = http.address();
  if (adres === null || typeof adres === 'string') throw new Error('port alinamadi');
  kok = `http://127.0.0.1:${adres.port}`;
}, 30_000);

afterAll(async () => {
  if (!mongoVar) return;
  oturumlariKapat();
  io.close();
  await new Promise<void>((coz) => http.close(() => coz()));
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe.skipIf(!mongoVar)('bot koltuklari', () => {
  it('iki kisilik masa botlarla dolup el basliyor ve BOT GERCEKTEN oynuyor', async () => {
    const [sahip, arkadas] = await soketler('bot-el', 2);
    try {
      const kurulum = await sor<{ masa: MasaGorunumu }>(sahip!, 'masa:kur');
      expect(kurulum.ok).toBe(true);
      if (!kurulum.ok) return;
      await sor(arkadas!, 'masa:katil', { kod: kurulum.veri.masa.kod });

      // Gorunum, botlar oturur oturmaz gelmeye baslasin diye once dinliyoruz.
      const gorunumBekle = olayBekle<{ gorunum: OyuncuGorunumu }>(sahip!, 'oyun:gorunum');
      const doldur = await sor<{ masa: MasaGorunumu }>(sahip!, 'masa:botDoldur');
      expect(doldur.ok).toBe(true);
      if (!doldur.ok) return;

      expect(doldur.veri.masa.koltuklar).toHaveLength(4);
      const botlar = doldur.veri.masa.koltuklar.filter((k) => k.bot);
      expect(botlar).toHaveLength(2);
      // Bot koltugu bir oyuncu kimligi TASIMAZ; istemci ikisini karistirmasin.
      expect(botlar.every((k) => k.oyuncuId.startsWith('bot:'))).toBe(true);
      expect(botlar.every((k) => k.hazir)).toBe(true);

      const ilk = await gorunumBekle;
      expect(ilk.gorunum.istakam.length).toBeGreaterThan(0);
      // El, 0 numarali koltuktan basliyor (KURALLAR.md §1) — o da masayi acan.
      expect(ilk.gorunum.siradaki).toBe(0);
      expect(ilk.gorunum.ben).toBe(0);

      // Asil soru: bot oynuyor mu? Insan tasini atinca sira bota geciyor;
      // bot cekince deste azalmali. Kimse "yerine oynanmasini" beklemiyor —
      // 30 saniyelik sira suresi devreye girseydi bu test onu olcerdi.
      const baslangicDeste = ilk.gorunum.desteSayisi;
      const atilan = ilk.gorunum.istakam[0]!;
      const atis = await sor(sahip!, 'oyun:aksiyon', {
        aksiyon: { tip: 'AT', oyuncu: 0, tasId: atilan.id, suAn: Date.now() },
        hamleNo: 1,
      });
      expect(atis.ok).toBe(true);

      let sonDeste = baslangicDeste;
      for (let bekleme = 0; bekleme < 8 && sonDeste >= baslangicDeste; bekleme++) {
        const sonraki = await olayBekle<{ gorunum: OyuncuGorunumu }>(sahip!, 'oyun:gorunum', 8_000);
        sonDeste = sonraki.gorunum.desteSayisi;
      }
      expect(sonDeste).toBeLessThan(baslangicDeste);
    } finally {
      kapat([sahip!, arkadas!]);
    }
  }, 60_000);

  it('bot koltugu bosaltilabiliyor — yeri insana acilsin diye', async () => {
    const [sahip] = await soketler('bot-cikar', 1);
    try {
      const kurulum = await sor<{ masa: MasaGorunumu }>(sahip!, 'masa:kur');
      if (!kurulum.ok) return;

      // "Hazir degilim" demeden botlari doldurmak eli hemen baslatirdi;
      // bu test masanin BEKLEYEN halini sinamak istiyor.
      await sor(sahip!, 'masa:hazir', { hazir: false });
      const doldur = await sor<{ masa: MasaGorunumu }>(sahip!, 'masa:botDoldur');
      expect(doldur.ok).toBe(true);
      if (!doldur.ok) return;
      expect(doldur.veri.masa.durum).toBe('bekliyor');
      expect(doldur.veri.masa.koltuklar.filter((k) => k.bot)).toHaveLength(3);

      const cikar = await sor<{ masa: MasaGorunumu }>(sahip!, 'masa:botCikar', { koltuk: 2 });
      expect(cikar.ok).toBe(true);
      if (!cikar.ok) return;
      expect(cikar.veri.masa.koltuklar).toHaveLength(3);
      expect(koltuk(cikar.veri.masa, 2)).toBeUndefined();

      // Insan koltugu bu yoldan bosaltilamaz.
      const insan = await sor(sahip!, 'masa:botCikar', { koltuk: 0 });
      expect(insan.ok).toBe(false);
    } finally {
      kapat([sahip!]);
    }
  }, 30_000);

  it('masayi acmayan bot ekleyemiyor', async () => {
    const [sahip, arkadas] = await soketler('bot-yetki', 2);
    try {
      const kurulum = await sor<{ masa: MasaGorunumu }>(sahip!, 'masa:kur');
      if (!kurulum.ok) return;
      await sor(arkadas!, 'masa:katil', { kod: kurulum.veri.masa.kod });

      const sonuc = await sor(arkadas!, 'masa:botDoldur');
      expect(sonuc.ok).toBe(false);
      if (!sonuc.ok) expect(sonuc.hata).toBe('masa-sahibi-degilsin');
    } finally {
      kapat([sahip!, arkadas!]);
    }
  }, 30_000);
});

describe.skipIf(!mongoVar)('koltuk secme ve degistirme', () => {
  it('bos koltuga gecilebiliyor', async () => {
    const [sahip] = await soketler('koltuk-gec', 1);
    try {
      const kurulum = await sor<{ masa: MasaGorunumu }>(sahip!, 'masa:kur');
      if (!kurulum.ok) return;
      expect(koltuk(kurulum.veri.masa, 0)).toBeDefined();

      const gec = await sor<{ masa: MasaGorunumu }>(sahip!, 'masa:koltugaGec', { koltuk: 2 });
      expect(gec.ok).toBe(true);
      if (!gec.ok) return;

      expect(koltuk(gec.veri.masa, 0)).toBeUndefined();
      expect(koltuk(gec.veri.masa, 2)?.oyuncuId).toBe(kurulum.veri.masa.sahipId);
      // Koltuk sayisi degismedi: gecis, oturma degil.
      expect(gec.veri.masa.koltuklar).toHaveLength(1);
    } finally {
      kapat([sahip!]);
    }
  }, 30_000);

  it('dolu koltuga dogrudan gecilemiyor', async () => {
    const [sahip, arkadas] = await soketler('koltuk-dolu', 2);
    try {
      const kurulum = await sor<{ masa: MasaGorunumu }>(sahip!, 'masa:kur');
      if (!kurulum.ok) return;
      await sor(arkadas!, 'masa:katil', { kod: kurulum.veri.masa.kod });

      const sonuc = await sor(arkadas!, 'masa:koltugaGec', { koltuk: 0 });
      expect(sonuc.ok).toBe(false);
      if (!sonuc.ok) expect(sonuc.hata).toContain('dolu');
    } finally {
      kapat([sahip!, arkadas!]);
    }
  }, 30_000);

  it('talep kabul edilince koltuklar YER DEGISTIRIYOR', async () => {
    const [sahip, arkadas] = await soketler('koltuk-takas', 2);
    try {
      const kurulum = await sor<{ masa: MasaGorunumu }>(sahip!, 'masa:kur');
      if (!kurulum.ok) return;
      const sahipId = kurulum.veri.masa.sahipId;
      const katil = await sor<{ masa: MasaGorunumu }>(arkadas!, 'masa:katil', {
        kod: kurulum.veri.masa.kod,
      });
      if (!katil.ok) return;
      const arkadasId = koltuk(katil.veri.masa, 1)?.oyuncuId as string;

      const talep = await sor<{ masa: MasaGorunumu }>(arkadas!, 'masa:koltukTalebi', { koltuk: 0 });
      expect(talep.ok).toBe(true);
      if (!talep.ok) return;
      expect(talep.veri.masa.koltukTalepleri).toEqual([{ isteyenId: arkadasId, hedefKoltuk: 0 }]);

      const cevap = await sor<{ masa: MasaGorunumu }>(sahip!, 'masa:koltukCevap', {
        isteyenId: arkadasId,
        kabul: true,
      });
      expect(cevap.ok).toBe(true);
      if (!cevap.ok) return;

      expect(koltuk(cevap.veri.masa, 0)?.oyuncuId).toBe(arkadasId);
      expect(koltuk(cevap.veri.masa, 1)?.oyuncuId).toBe(sahipId);
      // Cevaplanan talep listede kalmiyor.
      expect(cevap.veri.masa.koltukTalepleri).toEqual([]);
    } finally {
      kapat([sahip!, arkadas!]);
    }
  }, 30_000);

  it('talep reddedilince koltuklar degismiyor', async () => {
    const [sahip, arkadas] = await soketler('koltuk-ret', 2);
    try {
      const kurulum = await sor<{ masa: MasaGorunumu }>(sahip!, 'masa:kur');
      if (!kurulum.ok) return;
      const sahipId = kurulum.veri.masa.sahipId;
      const katil = await sor<{ masa: MasaGorunumu }>(arkadas!, 'masa:katil', {
        kod: kurulum.veri.masa.kod,
      });
      if (!katil.ok) return;
      const arkadasId = koltuk(katil.veri.masa, 1)?.oyuncuId as string;

      await sor(arkadas!, 'masa:koltukTalebi', { koltuk: 0 });
      const cevap = await sor<{ masa: MasaGorunumu }>(sahip!, 'masa:koltukCevap', {
        isteyenId: arkadasId,
        kabul: false,
      });
      expect(cevap.ok).toBe(true);
      if (!cevap.ok) return;

      expect(koltuk(cevap.veri.masa, 0)?.oyuncuId).toBe(sahipId);
      expect(koltuk(cevap.veri.masa, 1)?.oyuncuId).toBe(arkadasId);
      expect(cevap.veri.masa.koltukTalepleri).toEqual([]);
    } finally {
      kapat([sahip!, arkadas!]);
    }
  }, 30_000);

  it('ayni oyuncunun bekleyen tek talebi olur — yenisi eskisinin yerine gecer', async () => {
    const [sahip, arkadas, ucuncu] = await soketler('koltuk-tek-talep', 3);
    try {
      const kurulum = await sor<{ masa: MasaGorunumu }>(sahip!, 'masa:kur');
      if (!kurulum.ok) return;
      await sor(arkadas!, 'masa:katil', { kod: kurulum.veri.masa.kod });
      const ucuncuKatil = await sor<{ masa: MasaGorunumu }>(ucuncu!, 'masa:katil', {
        kod: kurulum.veri.masa.kod,
      });
      if (!ucuncuKatil.ok) return;
      const ucuncuId = koltuk(ucuncuKatil.veri.masa, 2)?.oyuncuId as string;

      await sor(ucuncu!, 'masa:koltukTalebi', { koltuk: 0 });
      const ikinci = await sor<{ masa: MasaGorunumu }>(ucuncu!, 'masa:koltukTalebi', { koltuk: 1 });
      expect(ikinci.ok).toBe(true);
      if (!ikinci.ok) return;

      expect(ikinci.veri.masa.koltukTalepleri).toEqual([{ isteyenId: ucuncuId, hedefKoltuk: 1 }]);
    } finally {
      kapat([sahip!, arkadas!, ucuncu!]);
    }
  }, 30_000);

  it('koltugu artik kendisine ait olmayan oyuncu talebi cevaplayamiyor', async () => {
    const [sahip, arkadas] = await soketler('koltuk-gecersiz', 2);
    try {
      const kurulum = await sor<{ masa: MasaGorunumu }>(sahip!, 'masa:kur');
      if (!kurulum.ok) return;
      const katil = await sor<{ masa: MasaGorunumu }>(arkadas!, 'masa:katil', {
        kod: kurulum.veri.masa.kod,
      });
      if (!katil.ok) return;
      const arkadasId = koltuk(katil.veri.masa, 1)?.oyuncuId as string;

      await sor(arkadas!, 'masa:koltukTalebi', { koltuk: 0 });
      // Sahip cevap vermeden 3 numarali koltuga geciyor: talep bosa dusuyor.
      await sor(sahip!, 'masa:koltugaGec', { koltuk: 3 });

      const cevap = await sor(sahip!, 'masa:koltukCevap', { isteyenId: arkadasId, kabul: true });
      expect(cevap.ok).toBe(false);
    } finally {
      kapat([sahip!, arkadas!]);
    }
  }, 30_000);
});

/**
 * Oyun SURERKEN masadan ayrilma.
 *
 * Bu bir hatanin testi: "masadan cikamiyorum". Koltuk oyuncunun ustunde
 * birakiliyordu (MIMARI.md §3, dort koltuk dolu olmali) ve iki sonucu vardi:
 *
 *  1. `oyun:gorunum` masa odasina degil KISISEL odaya gidiyor; soketi masa
 *     odasindan cikarmak paketleri kesmiyordu. Ekran lobiye donuyor, ilk
 *     gorunum paketinde masaya geri sicriyordu.
 *  2. Koltuk durdugu icin `acikMasam` hala o masayi donduruyor, oyuncu
 *     "Zaten bir masadasin" ile yeni masa da acamiyordu.
 *
 * Cozum: koltuk BOTA devrediliyor. Test ucunu de kovaliyor.
 */
describe.skipIf(!mongoVar)('oyun sirasinda masadan ayrilma', () => {
  it('koltuk bota devrediliyor, gorunum kesiliyor, oyuncu serbest kaliyor', async () => {
    const [sahip, arkadas] = await soketler('cik-bot', 2);
    try {
      const kurulum = await sor<{ masa: MasaGorunumu }>(sahip!, 'masa:kur');
      expect(kurulum.ok).toBe(true);
      if (!kurulum.ok) return;
      await sor(arkadas!, 'masa:katil', { kod: kurulum.veri.masa.kod });

      // Gorunumu botlar oturmadan once dinliyoruz; el aninda basliyor.
      const ilkGorunum = olayBekle<{ gorunum: OyuncuGorunumu }>(arkadas!, 'oyun:gorunum');
      const doldur = await sor(sahip!, 'masa:botDoldur');
      expect(doldur.ok).toBe(true);
      const benimKoltuk = (await ilkGorunum).gorunum.ben;

      const cikis = await sor(arkadas!, 'masa:cik');
      expect(cikis.ok).toBe(true);

      // 1. Koltuk bosalmadi, BOT oldu — motor dort oyuncuyla devam ediyor.
      //    Yayin olayini beklemek yerine durumu SORUYORUZ: masada baska
      //    sebeplerle de `masa:durum` yayini olabiliyor, yakalanan paketin
      //    cikistan sonraki oldugu garanti degil.
      const sonrasi = await sor<{ masa: MasaGorunumu }>(sahip!, 'masa:benim');
      expect(sonrasi.ok).toBe(true);
      if (!sonrasi.ok) return;
      const guncel = sonrasi.veri.masa;
      expect(guncel.koltuklar).toHaveLength(4);
      const devredilen = koltuk(guncel, benimKoltuk);
      expect(devredilen?.bot).toBe(true);
      expect(devredilen?.oyuncuId).toBe(`bot:${benimKoltuk}`);

      // 2. Ayrilana artik gorunum GITMIYOR. Botlar ~1.4 sn'de bir oynuyor,
      //    dolayisiyla bu pencerede eskiden birkac paket gelirdi.
      let gorunumGeldi = false;
      arkadas!.on('oyun:gorunum', () => {
        gorunumGeldi = true;
      });
      await new Promise((coz) => setTimeout(coz, 4_000));
      expect(gorunumGeldi).toBe(false);

      // 3. Gercekten serbest: yeni masa acabiliyor.
      const yeni = await sor(arkadas!, 'masa:kur');
      expect(yeni.ok).toBe(true);
    } finally {
      kapat([sahip!, arkadas!]);
    }
  }, 40_000);
});
