// Arkadaslik: kod, istek, kabul, silme — ve engelle olan kesisimi.
//
// Uc sey kovalaniyor:
//
//  1. Cift basina TEK belge gercekten tek mi? Iki taraf ayni anda birbirine
//     istek atarsa iki "bekliyor" kaydi olusmamali — arkadas olmalilar.
//     (modeller/Arkadaslik.ts'teki benzersiz indeksin sebebi bu.)
//  2. Engel arkadasligin ONUNE geciyor mu? Gecmezse engelledigin kisi
//     listende durmaya devam eder (App Store 1.2 ile celisir).
//  3. Arkadasin acik masasinin kodu listede gorunuyor mu? Ozelligin butun
//     amaci "kodu her seferinde yeniden paylasmamak".

import { createServer, type Server as HttpSunucusu } from 'node:http';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Posta sahteleniyor: hesap silme ucu "hesabin silindi" e-postasi gonderiyor
// ve .env'de gercek bir SMTP tanimliysa test GERCEKTEN posta atmaya
// calisiyor — ag koptugunda kirmizi, kopmadiginda gereksiz.
vi.mock('../src/servisler/postaServisi.js', () => ({
  parolaKoduGonder: async () => undefined,
  hesapSilindiBildir: async () => undefined,
  postayiDogrula: async () => true,
  PostaHatasi: class extends Error {},
}));

const { uygulamayiKur } = await import('../src/app.js');
const { masaKur } = await import('../src/servisler/masaServisi.js');

const MONGO = process.env['TEST_MONGO_URI'] ?? 'mongodb://127.0.0.1:27017';
const VERITABANI = `kut_test_arkadas_${Date.now()}`;

const mongoVar = await mongoose
  .connect(`${MONGO}/${VERITABANI}`, { serverSelectionTimeoutMS: 4000 })
  .then(() => true)
  .catch(() => false);

let http: HttpSunucusu;
let kok: string;

interface Cevap {
  readonly ok: boolean;
  readonly hata?: string;
  readonly veri?: Record<string, unknown>;
}

// Her cagri ayri bir IP'den geliyormus gibi: oran sinirlayici IP basina
// sayiyor ve bu dosya onlarca hesap aciyor (hesapYonetimi.test.ts'teki
// ayni gerekce).
let sahteIp = 0;
async function cagir(
  yontem: 'POST' | 'GET' | 'DELETE',
  yol: string,
  govde?: unknown,
  jeton?: string,
): Promise<{ durum: number; cevap: Cevap }> {
  sahteIp += 1;
  const yanit = await fetch(`${kok}${yol}`, {
    method: yontem,
    headers: {
      'x-forwarded-for': `198.51.100.${sahteIp % 250}, 10.0.0.1`,
      ...(govde === undefined ? {} : { 'content-type': 'application/json' }),
      ...(jeton === undefined ? {} : { authorization: `Bearer ${jeton}` }),
    },
    ...(govde === undefined ? {} : { body: JSON.stringify(govde) }),
  });
  return { durum: yanit.status, cevap: (await yanit.json()) as Cevap };
}

interface Hesap {
  readonly id: string;
  readonly jeton: string;
}

async function hesapAc(etiket: string): Promise<Hesap> {
  const eposta = `${etiket}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@ornek.com`;
  const { cevap } = await cagir('POST', '/api/kimlik/kayit', {
    eposta,
    parola: 'parolam1234',
    ad: etiket.slice(0, 12),
  });
  const veri = cevap.veri as { jeton: string; oyuncu: { id: string } };
  return { id: veri.oyuncu.id, jeton: veri.jeton };
}

interface Durum {
  readonly arkadaslar: { id: string; ad: string; masaKodu: string | null }[];
  readonly gelenIstekler: { id: string }[];
  readonly gidenIstekler: { id: string }[];
  readonly kodum: string;
}

async function durum(hesap: Hesap): Promise<Durum> {
  const { cevap } = await cagir('GET', '/api/arkadas', undefined, hesap.jeton);
  return cevap.veri as unknown as Durum;
}

beforeAll(async () => {
  if (!mongoVar) return;
  http = createServer(uygulamayiKur());
  await new Promise<void>((coz) => http.listen(0, coz));
  const adres = http.address();
  if (adres === null || typeof adres === 'string') throw new Error('port alinamadi');
  kok = `http://127.0.0.1:${adres.port}`;
});

afterAll(async () => {
  if (!mongoVar) return;
  await new Promise<void>((coz) => http.close(() => coz()));
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe.skipIf(!mongoVar)('arkadas kodu', () => {
  it('her oyuncuya bir kod uretiliyor ve degismiyor', async () => {
    const hesap = await hesapAc('kodlu');
    const bir = await durum(hesap);
    const iki = await durum(hesap);

    expect(bir.kodum).toMatch(/^KUT-[0-9A-Z]{5}$/);
    expect(iki.kodum).toBe(bir.kodum);
  });

  it('iki oyuncunun kodu farkli', async () => {
    const [a, b] = await Promise.all([hesapAc('kodA'), hesapAc('kodB')]);
    const [birinci, ikinci] = await Promise.all([durum(a), durum(b)]);
    expect(birinci.kodum).not.toBe(ikinci.kodum);
  });

  it('kodla aranan oyuncu bulunuyor; kucuk harf ve bosluk affediliyor', async () => {
    const aranan = await hesapAc('aranan');
    const arayan = await hesapAc('arayan');
    const kod = (await durum(aranan)).kodum;

    const { cevap } = await cagir(
      'GET',
      `/api/arkadas/ara?kod=${encodeURIComponent(kod.toLowerCase().replace('-', ' '))}`,
      undefined,
      arayan.jeton,
    );
    const bulunan = (cevap.veri as { bulunan: { id: string; iliski: string } | null }).bulunan;
    expect(bulunan?.id).toBe(aranan.id);
    expect(bulunan?.iliski).toBe('yok');
  });

  it('olmayan kod 200 ve null doner — 404 varligi sizdirirdi', async () => {
    const arayan = await hesapAc('bulamayan');
    const { durum: kod, cevap } = await cagir(
      'GET',
      '/api/arkadas/ara?kod=KUT-22222',
      undefined,
      arayan.jeton,
    );
    expect(kod).toBe(200);
    expect((cevap.veri as { bulunan: unknown }).bulunan).toBe(null);
  });
});

describe.skipIf(!mongoVar)('istek akisi', () => {
  it('istek gonderiliyor, kabul edilince iki tarafta da arkadas gorunuyor', async () => {
    const a = await hesapAc('istekA');
    const b = await hesapAc('istekB');

    const gonderim = await cagir(
      'POST',
      '/api/arkadas/istek',
      { oyuncuId: b.id },
      a.jeton,
    );
    expect(gonderim.cevap.ok).toBe(true);
    expect((gonderim.cevap.veri as { sonuc: string }).sonuc).toBe('gonderildi');

    expect((await durum(a)).gidenIstekler.map((i) => i.id)).toEqual([b.id]);
    expect((await durum(b)).gelenIstekler.map((i) => i.id)).toEqual([a.id]);

    const kabul = await cagir('POST', '/api/arkadas/kabul', { oyuncuId: a.id }, b.jeton);
    expect(kabul.cevap.ok).toBe(true);

    expect((await durum(a)).arkadaslar.map((k) => k.id)).toEqual([b.id]);
    expect((await durum(b)).arkadaslar.map((k) => k.id)).toEqual([a.id]);
  });

  it('KARSILIKLI istek dogrudan arkadaslik yapiyor — ikinci onaya gerek yok', async () => {
    const a = await hesapAc('karsiA');
    const b = await hesapAc('karsiB');

    await cagir('POST', '/api/arkadas/istek', { oyuncuId: b.id }, a.jeton);
    const ikinci = await cagir('POST', '/api/arkadas/istek', { oyuncuId: a.id }, b.jeton);

    expect((ikinci.cevap.veri as { sonuc: string }).sonuc).toBe('arkadas-oldunuz');
    expect((await durum(a)).arkadaslar.map((k) => k.id)).toEqual([b.id]);
    expect((await durum(b)).gelenIstekler).toEqual([]);
  });

  it('ayni anda gonderilen iki istek TEK kayit birakiyor', async () => {
    // modeller/Arkadaslik.ts'teki benzersiz indeksin sebebi tam olarak bu:
    // sirali cagrilarda hata hic gorunmuyor.
    const a = await hesapAc('yarisA');
    const b = await hesapAc('yarisB');

    await Promise.all([
      cagir('POST', '/api/arkadas/istek', { oyuncuId: b.id }, a.jeton),
      cagir('POST', '/api/arkadas/istek', { oyuncuId: a.id }, b.jeton),
    ]);

    const sonA = await durum(a);
    expect(sonA.arkadaslar.length + sonA.gelenIstekler.length + sonA.gidenIstekler.length).toBe(1);
  });

  it('kendine istek gonderilemiyor', async () => {
    const a = await hesapAc('kendisi');
    const { durum: kod, cevap } = await cagir(
      'POST',
      '/api/arkadas/istek',
      { oyuncuId: a.id },
      a.jeton,
    );
    expect(kod).toBe(400);
    expect(cevap.hata).toBe('kendine-istek');
  });

  it('kendi gonderdigi istegi kendisi kabul edemiyor', async () => {
    const a = await hesapAc('kabulA');
    const b = await hesapAc('kabulB');
    await cagir('POST', '/api/arkadas/istek', { oyuncuId: b.id }, a.jeton);

    const { durum: kod } = await cagir('POST', '/api/arkadas/kabul', { oyuncuId: b.id }, a.jeton);
    expect(kod).toBe(400);
  });

  it('silme hem istegi reddediyor hem arkadasligi bitiriyor', async () => {
    const a = await hesapAc('silA');
    const b = await hesapAc('silB');

    await cagir('POST', '/api/arkadas/istek', { oyuncuId: b.id }, a.jeton);
    await cagir('POST', '/api/arkadas/sil', { oyuncuId: a.id }, b.jeton);
    expect((await durum(a)).gidenIstekler).toEqual([]);

    await cagir('POST', '/api/arkadas/istek', { oyuncuId: b.id }, a.jeton);
    await cagir('POST', '/api/arkadas/kabul', { oyuncuId: a.id }, b.jeton);
    expect((await durum(a)).arkadaslar).toHaveLength(1);

    await cagir('POST', '/api/arkadas/sil', { oyuncuId: b.id }, a.jeton);
    expect((await durum(a)).arkadaslar).toEqual([]);
    expect((await durum(b)).arkadaslar).toEqual([]);
  });
});

describe.skipIf(!mongoVar)('engel arkadasligin onune geciyor', () => {
  it('engellenen oyuncu listede gorunmuyor, engel kalkinca geri geliyor', async () => {
    const a = await hesapAc('engelA');
    const b = await hesapAc('engelB');
    await cagir('POST', '/api/arkadas/istek', { oyuncuId: b.id }, a.jeton);
    await cagir('POST', '/api/arkadas/kabul', { oyuncuId: a.id }, b.jeton);

    await cagir('POST', '/api/moderasyon/engelle', { oyuncuId: b.id }, a.jeton);
    expect((await durum(a)).arkadaslar).toEqual([]);
    // Cift yonlu: engellenen de engelleyeni gormuyor.
    expect((await durum(b)).arkadaslar).toEqual([]);

    await cagir('POST', '/api/moderasyon/engel-kaldir', { oyuncuId: b.id }, a.jeton);
    expect((await durum(a)).arkadaslar.map((k) => k.id)).toEqual([b.id]);
  });

  it('engelliye istek gonderilemiyor', async () => {
    const a = await hesapAc('istemezA');
    const b = await hesapAc('istemezB');
    await cagir('POST', '/api/moderasyon/engelle', { oyuncuId: a.id }, b.jeton);

    const { durum: kod } = await cagir('POST', '/api/arkadas/istek', { oyuncuId: b.id }, a.jeton);
    expect(kod).toBe(400);
  });

  it('engelli oyuncu kodla da bulunamiyor', async () => {
    const a = await hesapAc('gizliA');
    const b = await hesapAc('gizliB');
    const kod = (await durum(b)).kodum;
    await cagir('POST', '/api/moderasyon/engelle', { oyuncuId: a.id }, b.jeton);

    const { cevap } = await cagir('GET', `/api/arkadas/ara?kod=${kod}`, undefined, a.jeton);
    expect((cevap.veri as { bulunan: unknown }).bulunan).toBe(null);
  });
});

describe.skipIf(!mongoVar)('arkadasin masasi', () => {
  it('arkadasin bekleyen masasinin kodu listede gorunuyor', async () => {
    const a = await hesapAc('masaA');
    const b = await hesapAc('masaB');
    await cagir('POST', '/api/arkadas/istek', { oyuncuId: b.id }, a.jeton);
    await cagir('POST', '/api/arkadas/kabul', { oyuncuId: a.id }, b.jeton);

    expect((await durum(a)).arkadaslar[0]?.masaKodu).toBe(null);

    const masa = await masaKur(b.id, true);
    // Ozel masa da gorunuyor: arkadasin zaten kodu paylasacagi kisi sensin.
    expect((await durum(a)).arkadaslar[0]?.masaKodu).toBe(masa.kod);
  });
});

describe.skipIf(!mongoVar)('hesap silinince iliskiler de gidiyor', () => {
  it('silinen oyuncu karsi tarafin listesinde kalmiyor', async () => {
    const a = await hesapAc('silinenA');
    const b = await hesapAc('kalanB');
    await cagir('POST', '/api/arkadas/istek', { oyuncuId: b.id }, a.jeton);
    await cagir('POST', '/api/arkadas/kabul', { oyuncuId: a.id }, b.jeton);

    await cagir('DELETE', '/api/kimlik/hesap', undefined, a.jeton);
    expect((await durum(b)).arkadaslar).toEqual([]);
  });
});

describe.skipIf(!mongoVar)('parola degistirme', () => {
  it('mevcut parola dogruysa degisiyor, eskisi calismiyor', async () => {
    const eposta = `parolaci-${Date.now()}@ornek.com`;
    const kayit = await cagir('POST', '/api/kimlik/kayit', {
      eposta,
      parola: 'eskiparola1',
      ad: 'Parolaci',
    });
    const jeton = (kayit.cevap.veri as { jeton: string }).jeton;

    const degisim = await cagir(
      'POST',
      '/api/kimlik/parola',
      { mevcutParola: 'eskiparola1', yeniParola: 'yeniparola9' },
      jeton,
    );
    expect(degisim.cevap.ok).toBe(true);

    const eskiyle = await cagir('POST', '/api/kimlik/giris', { eposta, parola: 'eskiparola1' });
    expect(eskiyle.durum).toBe(400);

    const yeniyle = await cagir('POST', '/api/kimlik/giris', { eposta, parola: 'yeniparola9' });
    expect(yeniyle.cevap.ok).toBe(true);
  });

  it('mevcut parola yanlissa reddediliyor', async () => {
    const hesap = await hesapAc('yanlisci');
    const { durum: kod, cevap } = await cagir(
      'POST',
      '/api/kimlik/parola',
      { mevcutParola: 'bambaskabiri', yeniParola: 'yeniparola9' },
      hesap.jeton,
    );
    expect(kod).toBe(400);
    expect(cevap.hata).toBe('mevcut-parola-hatali');
  });

  it('misafir hesabinda parola degistirilemiyor', async () => {
    const misafir = await cagir('POST', '/api/kimlik/misafir', {
      cihazKimligi: `cihaz-${Date.now()}-parola`,
    });
    const jeton = (misafir.cevap.veri as { jeton: string }).jeton;

    const { durum: kod } = await cagir(
      'POST',
      '/api/kimlik/parola',
      { mevcutParola: 'herhangibiri', yeniParola: 'yeniparola9' },
      jeton,
    );
    expect(kod).toBe(400);
  });
});
