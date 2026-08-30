// Uctan uca soket testi: dort istemci, gercek Mongo, gercek Socket.io.
//
// Motor kurallarini SINAMAZ — onlarin testi packages/engine'de. Buradaki soru
// ag katmaninin sozunu tutup tutmadigi:
//   - dort kisi toplaninca el basliyor mu
//   - herkes KENDI gorunumunu mu aliyor (motor kurali #3)
//   - baskasinin adina hamle reddediliyor mu
//   - kopan oyuncu ayni koltuga geri oturuyor mu
//
// Mongo yoksa testler atlanir: gelistirici makinesinde Mongo olmayabilir,
// bu dosya yuzunden butun paket kirmizi olmasin.
//   docker run -d --name kut-mongo -p 27017:27017 mongo:7

import { createServer, type Server as HttpSunucusu } from 'node:http';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { io as istemciAc, type Socket as IstemciSoketi } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { OyuncuGorunumu, OyuncuId } from '@kut/engine';
import { uygulamayiKur } from '../src/app.js';
import { oturumlariKapat, soketiKur } from '../src/soket/index.js';
import type { MasaGorunumu, SureGorunumu, Yanit } from '../src/tipler/protokol.js';

const MONGO = process.env['TEST_MONGO_URI'] ?? 'mongodb://127.0.0.1:27017';
const VERITABANI = `kut_test_${Date.now()}`;

/**
 * Mongo baglantisi MODUL SEVIYESINDE kuruluyor, `beforeAll`da degil.
 *
 * Sebebi vitest'in `it.skipIf` kosulunu TOPLAMA aninda okumasi: beforeAll'da
 * kurulan bir bayrak heniz false oldugu icin butun dosya sessizce atlanirdi.
 * Bu satir, "test kosmadi ama yesil gorundu" tuzagini kapatiyor.
 */
const mongoVar = await mongoose
  .connect(`${MONGO}/${VERITABANI}`, { serverSelectionTimeoutMS: 4000 })
  .then(() => true)
  .catch((hata: unknown) => {
    console.warn(`[cevrimici] Mongo'ya baglanilamadi, testler atlaniyor: ${String(hata)}`);
    return false;
  });

let http: HttpSunucusu;
let io: Server;
let kok: string;

/** Olayin gelmesini bekler; gelmezse anlasilir bir hatayla duser. */
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

/** Geri cagrili olay gonderir ve yaniti bekler. */
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

beforeAll(async () => {
  if (!mongoVar) return;

  const app = uygulamayiKur();
  http = createServer(app);
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

describe('cevrimici masa', () => {
  it.skipIf(!mongoVar)(
    'dort oyuncu oturunca el basliyor ve herkes KENDI gorunumunu aliyor',
    async () => {
      const jetonlar = await Promise.all(
        [0, 1, 2, 3].map((no) => misafirJetonu(`test-cihaz-el-${no}-${Date.now()}`)),
      );
      const soketler = await Promise.all(jetonlar.map(soketAc));

      try {
        const kurulum = await sor<{ masa: MasaGorunumu }>(soketler[0]!, 'masa:kur');
        expect(kurulum.ok).toBe(true);
        if (!kurulum.ok) return;
        const kod = kurulum.veri.masa.kod;

        // Dorduncu oturdugunda el baslar; gorunumleri simdiden dinlemeye al.
        const gorunumler = soketler.map((soket) =>
          olayBekle<{ gorunum: OyuncuGorunumu }>(soket, 'oyun:gorunum'),
        );

        for (const soket of soketler.slice(1)) {
          const katilim = await sor<{ masa: MasaGorunumu }>(soket, 'masa:katil', { kod });
          expect(katilim.ok).toBe(true);
        }

        const gelenler = await Promise.all(gorunumler);

        // Her oyuncu kendi koltugunu goruyor.
        expect(gelenler.map((g) => g.gorunum.ben).sort()).toEqual([0, 1, 2, 3]);

        // Motor kurali #3: kimse baskasinin istakasini gormuyor. Istakalar
        // ayri ayri dagitildigi icin tas kimlikleri KESISMEMELI.
        const kimlikler = gelenler.map((g) => new Set(g.gorunum.istakam.map((t) => t.id)));
        for (let a = 0; a < kimlikler.length; a++) {
          for (let b = a + 1; b < kimlikler.length; b++) {
            const ortak = [...kimlikler[a]!].filter((id) => kimlikler[b]!.has(id));
            expect(ortak).toEqual([]);
          }
        }

        // Rakiplerin elinden gorunen tek sey tas sayisi.
        for (const gelen of gelenler) {
          expect(Object.keys(gelen.gorunum.tasSayilari)).toHaveLength(4);
          expect(gelen.gorunum).not.toHaveProperty('istakalar');
        }
      } finally {
        for (const soket of soketler) soket.disconnect();
      }
    },
    30_000,
  );

  it.skipIf(!mongoVar)(
    'baskasinin adina hamle reddediliyor, sira sahibi oynayabiliyor',
    async () => {
      const jetonlar = await Promise.all(
        [0, 1, 2, 3].map((no) => misafirJetonu(`test-cihaz-hamle-${no}-${Date.now()}`)),
      );
      const soketler = await Promise.all(jetonlar.map(soketAc));

      try {
        const kurulum = await sor<{ masa: MasaGorunumu }>(soketler[0]!, 'masa:kur');
        if (!kurulum.ok) throw new Error(kurulum.hata);
        const kod = kurulum.veri.masa.kod;

        const gorunumler = soketler.map((soket) =>
          olayBekle<{ gorunum: OyuncuGorunumu }>(soket, 'oyun:gorunum'),
        );
        const sureler = soketler.map((soket) => olayBekle<SureGorunumu>(soket, 'oyun:sure'));

        for (const soket of soketler.slice(1)) await sor(soket, 'masa:katil', { kod });
        const gelenler = await Promise.all(gorunumler);

        // Sunucu sira sayacini duyuruyor; bitis ani ilerideki bir an olmali.
        const sure = (await Promise.all(sureler))[0]!;
        expect(sure.bitisZamani).toBeGreaterThan(sure.sunucuZamani);
        expect(sure.sure).toBeGreaterThan(0);

        const siradaki = gelenler[0]!.gorunum.siradaki;
        const koltuguna = new Map(gelenler.map((g, i) => [g.gorunum.ben, soketler[i]!]));
        const oynayan = koltuguna.get(siradaki)!;
        const baskasi = koltuguna.get(((siradaki + 1) % 4) as OyuncuId)!;

        // Sirasi olmayan oynayamaz.
        const izinsiz = await sor(baskasi, 'oyun:aksiyon', {
          aksiyon: { tip: 'CEK_DESTEDEN', oyuncu: ((siradaki + 1) % 4) as OyuncuId },
          hamleNo: 1,
        });
        expect(izinsiz.ok).toBe(false);

        // Kendi soketiyle BASKASININ koltugu adina hamle: protokolun en
        // kritik kontrolu. Bu gecerse istemci istedigi eli oynatabilirdi.
        const kimlikHirsizligi = await sor(baskasi, 'oyun:aksiyon', {
          aksiyon: { tip: 'CEK_DESTEDEN', oyuncu: siradaki },
          hamleNo: 2,
        });
        expect(kimlikHirsizligi.ok).toBe(false);
        if (!kimlikHirsizligi.ok) {
          expect(kimlikHirsizligi.hata).toContain('adına');
        }

        // KURALLAR.md §1 — baslayan bir fazla tas alir ve CEKMEDEN atar.
        const benimGorunumum = gelenler.find((g) => g.gorunum.ben === siradaki)!.gorunum;
        expect(benimGorunumum.faz).toBe('atma');

        // Bu yuzden ilk hamlesi cekmek DEGIL: motor reddetmeli.
        const erkenCekme = await sor(oynayan, 'oyun:aksiyon', {
          aksiyon: { tip: 'CEK_DESTEDEN', oyuncu: siradaki },
          hamleNo: 3,
        });
        expect(erkenCekme.ok).toBe(false);

        // Atisin herkese yansimasi: sira ilerliyor, atik obegi buyuyor.
        const sagdaki = koltuguna.get(((siradaki + 3) % 4) as OyuncuId)!;
        const sagdakiGordu = olayBekle<{ gorunum: OyuncuGorunumu }>(sagdaki, 'oyun:gorunum');
        const atis = await sor(oynayan, 'oyun:aksiyon', {
          aksiyon: { tip: 'AT', oyuncu: siradaki, tasId: benimGorunumum.istakam[0]!.id },
          hamleNo: 4,
        });
        expect(atis.ok).toBe(true);

        const sonra = await sagdakiGordu;
        // §4 — oyun saat yonunde doner; atanin SAGINDAKI oynar.
        expect(sonra.gorunum.siradaki).toBe(((siradaki + 3) % 4) as OyuncuId);
        expect(sonra.gorunum.faz).toBe('cekme');
        expect(sonra.gorunum.atikUstu?.id).toBe(benimGorunumum.istakam[0]!.id);
        expect(sonra.gorunum.tasSayilari[siradaki]).toBe(benimGorunumum.istakam.length - 1);
      } finally {
        for (const soket of soketler) soket.disconnect();
      }
    },
    30_000,
  );

  it.skipIf(!mongoVar)(
    'kopan oyuncu ayni koltuga geri oturuyor ve elini geri aliyor',
    async () => {
      const cihazlar = [0, 1, 2, 3].map((no) => `test-cihaz-kopma-${no}-${Date.now()}`);
      const jetonlar = await Promise.all(cihazlar.map(misafirJetonu));
      const soketler = await Promise.all(jetonlar.map(soketAc));

      try {
        const kurulum = await sor<{ masa: MasaGorunumu }>(soketler[0]!, 'masa:kur');
        if (!kurulum.ok) throw new Error(kurulum.hata);

        const ilkGorunum = olayBekle<{ gorunum: OyuncuGorunumu }>(soketler[1]!, 'oyun:gorunum');
        for (const soket of soketler.slice(1)) {
          await sor(soket, 'masa:katil', { kod: kurulum.veri.masa.kod });
        }
        const once = await ilkGorunum;

        // 1 numarali oyuncunun baglantisi kopuyor.
        soketler[1]!.disconnect();
        await new Promise((coz) => setTimeout(coz, 300));

        // Ayni jetonla geri geliyor: koltugu ve eli duruyor olmali.
        const yeni = await soketAc(jetonlar[1]!);
        try {
          const geriGelen = olayBekle<{ gorunum: OyuncuGorunumu }>(yeni, 'oyun:gorunum');
          const durum = await sor<{ masa: MasaGorunumu | null }>(yeni, 'masa:benim');
          expect(durum.ok).toBe(true);
          if (!durum.ok) return;
          expect(durum.veri.masa?.masaId).toBe(kurulum.veri.masa.masaId);
          expect(durum.veri.masa?.durum).toBe('oynaniyor');

          const sonra = await geriGelen;
          expect(sonra.gorunum.ben).toBe(once.gorunum.ben);
          expect(sonra.gorunum.istakam.map((t) => t.id).sort()).toEqual(
            once.gorunum.istakam.map((t) => t.id).sort(),
          );
        } finally {
          yeni.disconnect();
        }
      } finally {
        for (const soket of soketler) soket.disconnect();
      }
    },
    30_000,
  );

  it.skipIf(!mongoVar)(
    'uydurma aksiyon tipi sunucuyu DUSURMUYOR',
    async () => {
      // Motorun `reduce`u tanimadigi bir `tip` icin hicbir dalla eslesmiyor
      // ve `undefined` donuyor; sunucu `sonuc.ok` okumaya calisip
      // dusuyordu. Kimligi dogrulanmis herhangi bir istemci tek paketle
      // sunucuyu kapatabiliyordu — bu test o kapinin kapali kalmasi icin.
      const jetonlar = await Promise.all(
        [0, 1, 2, 3].map((no) => misafirJetonu(`test-cihaz-uydurma-${no}-${Date.now()}`)),
      );
      const soketler = await Promise.all(jetonlar.map(soketAc));

      try {
        const kurulum = await sor<{ masa: MasaGorunumu }>(soketler[0]!, 'masa:kur');
        if (!kurulum.ok) throw new Error(kurulum.hata);

        const ilk = olayBekle<{ gorunum: OyuncuGorunumu }>(soketler[0]!, 'oyun:gorunum');
        for (const soket of soketler.slice(1)) {
          await sor(soket, 'masa:katil', { kod: kurulum.veri.masa.kod });
        }
        const gorunum = (await ilk).gorunum;

        const uydurma = await sor(soketler[0]!, 'oyun:aksiyon', {
          aksiyon: { tip: 'HER_SEYI_KAZAN', oyuncu: gorunum.ben },
          hamleNo: 1,
        });
        expect(uydurma.ok).toBe(false);

        // Asil sinav: sunucu hala ayakta mi?
        const saglik = await fetch(`${kok}/api/saglik`);
        expect(saglik.status).toBe(200);

        // Ve masa hala oynanabilir durumda.
        const durum = await sor<{ masa: MasaGorunumu | null }>(soketler[0]!, 'masa:benim');
        expect(durum.ok).toBe(true);
      } finally {
        for (const soket of soketler) soket.disconnect();
      }
    },
    30_000,
  );

  it.skipIf(!mongoVar)('jetonsuz soket hic acilmiyor', async () => {
    const soket = istemciAc(kok, { auth: {}, transports: ['websocket'], forceNew: true });
    const hata = await new Promise<Error>((coz) => soket.once('connect_error', coz));
    expect(hata.message).toContain('Jeton');
    soket.disconnect();
  });

  it.skipIf(!mongoVar)('olmayan masa koduna katilinamiyor', async () => {
    const soket = await soketAc(await misafirJetonu(`test-cihaz-kod-${Date.now()}`));
    try {
      const sonuc = await sor(soket, 'masa:katil', { kod: 'ZZZZ' });
      expect(sonuc.ok).toBe(false);
    } finally {
      soket.disconnect();
    }
  });
});
