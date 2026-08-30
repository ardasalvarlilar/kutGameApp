// Parola sifirlama, hesap silme, sikayet ve engelleme.
//
// Hepsi App Store denetiminin ARADIGI seyler (5.1.1(v) ve 1.2) — yani "var
// gorunmesi" degil GERCEKTEN calismasi gerekiyor. Testler tam da bunu
// kovaliyor: hesap silinince belge gidiyor mu, engel gercekten masaya
// oturmayi engelliyor mu, yanlis kod kac denemeden sonra yaniyor.
//
// E-posta gondermiyoruz: `postaServisi` sahteleniyor ve uretilen kod
// yakalaniyor. Gercek SMTP'ye baglanan bir test, ag koptugunda kirmizi olurdu.

import { createServer, type Server as HttpSunucusu } from 'node:http';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const gonderilenler: { eposta: string; kod: string }[] = [];

vi.mock('../src/servisler/postaServisi.js', () => ({
  parolaKoduGonder: async (eposta: string, kod: string) => {
    gonderilenler.push({ eposta, kod });
  },
  hesapSilindiBildir: async () => undefined,
  postayiDogrula: async () => true,
  PostaHatasi: class extends Error {},
}));

// SMTP ayarli sayilsin: `parolaKoduIste` once buna bakiyor.
vi.mock('../src/config.js', async (asilini) => {
  const modul = await asilini<typeof import('../src/config.js')>();
  return { config: { ...modul.config, posta: { ...modul.config.posta, acikMi: true } } };
});

const { uygulamayiKur } = await import('../src/app.js');
const { Oyuncu } = await import('../src/modeller/Oyuncu.js');
const { Sikayet } = await import('../src/modeller/Sikayet.js');
const { masaKur, masayaKatil, MasaHatasi } = await import('../src/servisler/masaServisi.js');

const MONGO = process.env['TEST_MONGO_URI'] ?? 'mongodb://127.0.0.1:27017';
const VERITABANI = `kut_test_hesap_${Date.now()}`;

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

/**
 * Her cagri AYRI bir IP'den geliyormus gibi davraniyor.
 *
 * Sebep: oran sinirlayici IP basina sayiyor ve bu dosya onlarca hesap aciyor;
 * hepsi ayni kovaya duserse testler 429 alip kirilir. Ayrica gercek hayatta
 * da her oyuncu ayri bir IP'den geliyor — sinirlayicinin `x-forwarded-for`
 * ile dogru anahtarladigini bu arada dogrulamis oluyoruz.
 */
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
      'x-forwarded-for': `203.0.113.${sahteIp % 250}, 10.0.0.1`,
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
  readonly eposta: string;
}

async function hesapAc(etiket: string): Promise<Hesap> {
  const eposta = `${etiket}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@ornek.com`;
  const { cevap } = await cagir('POST', '/api/kimlik/kayit', {
    eposta,
    parola: 'parolam1234',
    ad: etiket.slice(0, 12),
  });
  const veri = cevap.veri as { jeton: string; oyuncu: { id: string } };
  return { id: veri.oyuncu.id, jeton: veri.jeton, eposta };
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

describe.skipIf(!mongoVar)('parola sifirlama', () => {
  it('kod ile yeni parola konabiliyor ve eskisi calismiyor', async () => {
    const hesap = await hesapAc('sifirlayan');
    gonderilenler.length = 0;

    const istek = await cagir('POST', '/api/kimlik/parola-unuttum', { eposta: hesap.eposta });
    expect(istek.durum).toBe(200);
    const kod = gonderilenler.at(-1)?.kod;
    expect(kod).toMatch(/^\d{6}$/);

    const sifirlama = await cagir('POST', '/api/kimlik/parola-sifirla', {
      eposta: hesap.eposta,
      kod,
      yeniParola: 'yeniparolam99',
    });
    expect(sifirlama.durum).toBe(200);

    const yeniyle = await cagir('POST', '/api/kimlik/giris', {
      eposta: hesap.eposta,
      parola: 'yeniparolam99',
    });
    expect(yeniyle.durum).toBe(200);

    const eskiyle = await cagir('POST', '/api/kimlik/giris', {
      eposta: hesap.eposta,
      parola: 'parolam1234',
    });
    expect(eskiyle.durum).toBe(400);
  });

  it('kod TEK KULLANIMLIK — ikinci kez calismiyor', async () => {
    const hesap = await hesapAc('tekkullanim');
    gonderilenler.length = 0;
    await cagir('POST', '/api/kimlik/parola-unuttum', { eposta: hesap.eposta });
    const kod = gonderilenler.at(-1)!.kod;

    await cagir('POST', '/api/kimlik/parola-sifirla', {
      eposta: hesap.eposta,
      kod,
      yeniParola: 'birinciparola1',
    });
    const ikinci = await cagir('POST', '/api/kimlik/parola-sifirla', {
      eposta: hesap.eposta,
      kod,
      yeniParola: 'ikinciparola1',
    });
    expect(ikinci.durum).toBe(400);
  });

  it('yanlis kod bes denemeden sonra yaniyor', async () => {
    const hesap = await hesapAc('kabakuvvet');
    gonderilenler.length = 0;
    await cagir('POST', '/api/kimlik/parola-unuttum', { eposta: hesap.eposta });
    const kod = gonderilenler.at(-1)!.kod;
    const yanlis = kod === '000000' ? '111111' : '000000';

    for (let deneme = 0; deneme < 5; deneme++) {
      await cagir('POST', '/api/kimlik/parola-sifirla', {
        eposta: hesap.eposta,
        kod: yanlis,
        yeniParola: 'olmayanparola1',
      });
    }
    // Alti haneli kod, sinirsiz denemeyle bir dakikada kirilirdi. Sayac
    // dolunca DOGRU kod da artik calismamali.
    const dogruyla = await cagir('POST', '/api/kimlik/parola-sifirla', {
      eposta: hesap.eposta,
      kod,
      yeniParola: 'olmayanparola1',
    });
    expect(dogruyla.durum).toBe(400);
  });

  it('kayitli olmayan adres de 200 donuyor — hesap varligini sizdirmiyor', async () => {
    const sonuc = await cagir('POST', '/api/kimlik/parola-unuttum', {
      eposta: 'hic-kayitli-degil@ornek.com',
    });
    expect(sonuc.durum).toBe(200);
    expect(sonuc.cevap.ok).toBe(true);
  });
});

describe.skipIf(!mongoVar)('hesap silme', () => {
  it('belge gercekten siliniyor ve jeton geceriz kaliyor', async () => {
    const hesap = await hesapAc('silinen');

    const silme = await cagir('DELETE', '/api/kimlik/hesap', undefined, hesap.jeton);
    expect(silme.durum).toBe(200);

    expect(await Oyuncu.findById(hesap.id)).toBeNull();

    // Jeton hala imzali ama arkasinda belge yok: korumali uc 404 vermeli.
    const ben = await cagir('GET', '/api/kimlik/ben', undefined, hesap.jeton);
    expect(ben.durum).toBe(404);

    // Ayni e-posta yeniden kullanilabilmeli.
    const tekrar = await cagir('POST', '/api/kimlik/kayit', {
      eposta: hesap.eposta,
      parola: 'parolam1234',
      ad: 'Tekrar',
    });
    expect(tekrar.durum).toBe(200);
  });

  it('silinen oyuncu baskalarinin engel listesinden de dusuyor', async () => {
    const kalan = await hesapAc('kalan');
    const giden = await hesapAc('giden');

    await cagir('POST', '/api/moderasyon/engelle', { oyuncuId: giden.id }, kalan.jeton);
    await cagir('DELETE', '/api/kimlik/hesap', undefined, giden.jeton);

    const liste = await cagir('GET', '/api/moderasyon/engellenenler', undefined, kalan.jeton);
    expect(liste.cevap.veri?.['engellenenler']).toEqual([]);
  });
});

describe.skipIf(!mongoVar)('sikayet ve engelleme', () => {
  it('sikayet kaydediliyor', async () => {
    const eden = await hesapAc('bildiren');
    const edilen = await hesapAc('bildirilen');

    const sonuc = await cagir(
      'POST',
      '/api/moderasyon/sikayet',
      { oyuncuId: edilen.id, sebep: 'uygunsuz-ad', aciklama: 'adı hakaret içeriyor' },
      eden.jeton,
    );
    expect(sonuc.durum).toBe(200);

    const kayit = await Sikayet.findOne({ sikayetEdilen: edilen.id }).lean();
    expect(kayit?.sebep).toBe('uygunsuz-ad');
    // Ad o anki haliyle saklaniyor: sikayet edilen adini degistirse de
    // incelemede ne oldugu belli olsun.
    expect(kayit?.oAndakiAd).toContain('bildirilen'.slice(0, 12));
  });

  it('kendini bildiremiyor', async () => {
    const hesap = await hesapAc('kendisi');
    const sonuc = await cagir(
      'POST',
      '/api/moderasyon/sikayet',
      { oyuncuId: hesap.id, sebep: 'diger' },
      hesap.jeton,
    );
    expect(sonuc.durum).toBe(400);
  });

  it('engel GERCEKTEN ayni masaya oturmayi engelliyor', async () => {
    const engelleyen = await hesapAc('engelleyen');
    const engellenen = await hesapAc('engellenen');

    await cagir('POST', '/api/moderasyon/engelle', { oyuncuId: engellenen.id }, engelleyen.jeton);

    const masa = await masaKur(engelleyen.id);
    // Kodu bilse bile oturamamali — yoksa engelleme sus bir dugme olurdu.
    await expect(masayaKatil(masa.kod, engellenen.id)).rejects.toBeInstanceOf(MasaHatasi);
  });

  it('engel CIFT YONLU — engellenen de engelleyenin masasina alinmiyor', async () => {
    const engelleyen = await hesapAc('cift-engelleyen');
    const engellenen = await hesapAc('cift-engellenen');

    await cagir('POST', '/api/moderasyon/engelle', { oyuncuId: engellenen.id }, engelleyen.jeton);

    // Bu kez masayi ENGELLENEN aciyor. Tek yonlu bakilsaydi, taciz eden kisi
    // engellendigini fark edip yeni masa acarak yine karsisina cikabilirdi.
    const masa = await masaKur(engellenen.id);
    await expect(masayaKatil(masa.kod, engelleyen.id)).rejects.toBeInstanceOf(MasaHatasi);
  });

  it('engel kaldirilinca yeniden oturulabiliyor', async () => {
    const engelleyen = await hesapAc('kaldiran');
    const engellenen = await hesapAc('kaldirilan');

    await cagir('POST', '/api/moderasyon/engelle', { oyuncuId: engellenen.id }, engelleyen.jeton);
    await cagir(
      'POST',
      '/api/moderasyon/engel-kaldir',
      { oyuncuId: engellenen.id },
      engelleyen.jeton,
    );

    const masa = await masaKur(engelleyen.id);
    const katilim = await masayaKatil(masa.kod, engellenen.id);
    expect(katilim.koltuklar).toHaveLength(2);
  });
});

describe.skipIf(!mongoVar)('gorunen ad denetimi', () => {
  it('uygunsuz adla kayit olunamiyor', async () => {
    const sonuc = await cagir('POST', '/api/kimlik/kayit', {
      eposta: `kufur-${Date.now()}@ornek.com`,
      parola: 'parolam1234',
      ad: 'siktir',
    });
    expect(sonuc.durum).toBe(400);
    expect(sonuc.cevap.hata).toContain('uygun değil');
  });

  it('ad degistirirken de denetleniyor', async () => {
    const hesap = await hesapAc('adcinar');
    const sonuc = await cagir('POST', '/api/kimlik/ad', { ad: 'Admin' }, hesap.jeton);
    expect(sonuc.durum).toBe(400);
  });
});
