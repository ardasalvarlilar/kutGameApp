// Hesap uclari — canli Mongo ile.
//
// Kayit ve giris parayla degil GUVENLIKLE ilgili oldugu icin buradaki
// testler mutlulugu degil, REDDEDILMESI GEREKENI kovaliyor: ayni e-posta
// iki kez, yanlis parola, sizdiran hata mesaji, misafirin ilerlemesinin
// kaybolmasi.
//
// Mongo yoksa atlanir (bkz. cevrimici.test.ts'teki ayni not).

import { createServer, type Server as HttpSunucusu } from 'node:http';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { uygulamayiKur } from '../src/app.js';
import { Oyuncu } from '../src/modeller/Oyuncu.js';

const MONGO = process.env['TEST_MONGO_URI'] ?? 'mongodb://127.0.0.1:27017';
const VERITABANI = `kut_test_kimlik_${Date.now()}`;

const mongoVar = await mongoose
  .connect(`${MONGO}/${VERITABANI}`, { serverSelectionTimeoutMS: 4000 })
  .then(() => true)
  .catch(() => false);

let http: HttpSunucusu;
let kok: string;

interface Cevap {
  readonly ok: boolean;
  readonly hata?: string;
  readonly veri?: {
    readonly jeton: string;
    readonly oyuncu: { id: string; ad: string; eposta: string | null; misafirMi: boolean; oynananEl: number };
  };
}

async function cagir(yol: string, govde: unknown, jeton?: string): Promise<{ durum: number; cevap: Cevap }> {
  const yanit = await fetch(`${kok}${yol}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(jeton === undefined ? {} : { authorization: `Bearer ${jeton}` }),
    },
    body: JSON.stringify(govde),
  });
  return { durum: yanit.status, cevap: (await yanit.json()) as Cevap };
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

describe.skipIf(!mongoVar)('hesap acma', () => {
  it('kayit olan oyuncu veritabanina yaziliyor', async () => {
    const { durum, cevap } = await cagir('/api/kimlik/kayit', {
      eposta: 'Yeni.Oyuncu@Ornek.com',
      parola: 'cokgizliparola',
      ad: 'Arda',
    });
    expect(durum).toBe(200);
    expect(cevap.ok).toBe(true);

    const belge = await Oyuncu.findById(cevap.veri!.oyuncu.id).select('+parolaOzeti');
    expect(belge).not.toBeNull();
    // E-posta kucuk harfe indirgeniyor; "Ali@x.com" ile "ali@x.com" ayni hesap.
    expect(belge!.eposta).toBe('yeni.oyuncu@ornek.com');
    expect(belge!.misafirMi).toBe(false);
    // Ham parola HICBIR YERDE durmuyor.
    expect(belge!.parolaOzeti).not.toBe('cokgizliparola');
    expect(belge!.parolaOzeti?.startsWith('$2')).toBe(true);
  });

  it('ayni e-posta ikinci kez kayit olamiyor', async () => {
    await cagir('/api/kimlik/kayit', { eposta: 'tek@ornek.com', parola: 'parolam123', ad: 'Bir' });
    const { durum, cevap } = await cagir('/api/kimlik/kayit', {
      eposta: 'tek@ornek.com',
      parola: 'baskaparola',
      ad: 'Iki',
    });
    expect(durum).toBe(400);
    expect(cevap.hata).toContain('zaten kayıtlı');
  });

  it('kisa parola reddediliyor', async () => {
    const { durum, cevap } = await cagir('/api/kimlik/kayit', {
      eposta: 'kisa@ornek.com',
      parola: 'abc',
      ad: 'Kisa',
    });
    expect(durum).toBe(400);
    expect(cevap.hata).toContain('8 karakter');
  });

  it('bozuk e-posta reddediliyor', async () => {
    const { durum } = await cagir('/api/kimlik/kayit', {
      eposta: 'bu-eposta-degil',
      parola: 'parolam123',
      ad: 'Bozuk',
    });
    expect(durum).toBe(400);
  });
});

describe.skipIf(!mongoVar)('giris', () => {
  const hesap = { eposta: 'giren@ornek.com', parola: 'dogruparola1', ad: 'Giren' };

  beforeAll(async () => {
    await cagir('/api/kimlik/kayit', hesap);
  });

  it('dogru parolayla giriliyor', async () => {
    const { durum, cevap } = await cagir('/api/kimlik/giris', {
      eposta: hesap.eposta,
      parola: hesap.parola,
    });
    expect(durum).toBe(200);
    expect(cevap.veri!.oyuncu.ad).toBe('Giren');
    expect(cevap.veri!.jeton.length).toBeGreaterThan(20);
  });

  it('yanlis parola reddediliyor', async () => {
    const { durum } = await cagir('/api/kimlik/giris', {
      eposta: hesap.eposta,
      parola: 'yanlisparola',
    });
    expect(durum).toBe(400);
  });

  it('hata mesaji hesabin VAR OLDUGUNU sizdirmiyor', async () => {
    const yanlisParola = await cagir('/api/kimlik/giris', {
      eposta: hesap.eposta,
      parola: 'yanlisparola',
    });
    const yokHesap = await cagir('/api/kimlik/giris', {
      eposta: 'hic-kayitli-degil@ornek.com',
      parola: 'yanlisparola',
    });
    // Iki mesaj AYNI olmali: farkli olsalari, hangi adreslerin kayitli
    // oldugunu deneme yanilmayla ogrenmeye yarardi.
    expect(yokHesap.cevap.hata).toBe(yanlisParola.cevap.hata);
  });
});

describe.skipIf(!mongoVar)('misafirden hesaba', () => {
  it('ayni cihaz kimligi ayni misafiri doner', async () => {
    const cihaz = `cihaz-ayni-${Date.now()}`;
    const bir = await cagir('/api/kimlik/misafir', { cihazKimligi: cihaz });
    const iki = await cagir('/api/kimlik/misafir', { cihazKimligi: cihaz });
    expect(iki.cevap.veri!.oyuncu.id).toBe(bir.cevap.veri!.oyuncu.id);
  });

  it('misafir hesap acinca AYNI belge kaliyor — ilerleme kaybolmuyor', async () => {
    const cihaz = `cihaz-yukselen-${Date.now()}`;
    const misafir = await cagir('/api/kimlik/misafir', { cihazKimligi: cihaz });
    const kimlik = misafir.cevap.veri!.oyuncu.id;
    expect(misafir.cevap.veri!.oyuncu.misafirMi).toBe(true);

    // Oynanmis el sayisi gibi bir ilerleme birakalim.
    await Oyuncu.updateOne({ _id: kimlik }, { $set: { 'ilerleme.oynananEl': 7 } });

    const kayit = await cagir('/api/kimlik/kayit', {
      eposta: `yukselen-${Date.now()}@ornek.com`,
      parola: 'parolam1234',
      ad: 'Yükselen',
      cihazKimligi: cihaz,
    });
    expect(kayit.cevap.veri!.oyuncu.id).toBe(kimlik);
    expect(kayit.cevap.veri!.oyuncu.misafirMi).toBe(false);
    expect(kayit.cevap.veri!.oyuncu.oynananEl).toBe(7);
  });

  it('jetonla yukseltme de ayni belgeyi kullaniyor', async () => {
    const cihaz = `cihaz-jetonla-${Date.now()}`;
    const misafir = await cagir('/api/kimlik/misafir', { cihazKimligi: cihaz });
    const jeton = misafir.cevap.veri!.jeton;

    const yukseltme = await cagir(
      '/api/kimlik/yukselt',
      { eposta: `jetonla-${Date.now()}@ornek.com`, parola: 'parolam1234', ad: 'Jetonla' },
      jeton,
    );
    expect(yukseltme.durum).toBe(200);
    expect(yukseltme.cevap.veri!.oyuncu.id).toBe(misafir.cevap.veri!.oyuncu.id);

    // Ikinci kez yukseltilemez: cihazi eline gecirenin hesabi ele
    // gecirmesine giden yol tam burasi.
    const ikinci = await cagir(
      '/api/kimlik/yukselt',
      { eposta: `ikinci-${Date.now()}@ornek.com`, parola: 'parolam1234', ad: 'Ikinci' },
      jeton,
    );
    expect(ikinci.durum).toBe(400);
  });

  it('hesap acmis bir cihazdan yeni kayit, eski hesabi DEVRALMIYOR', async () => {
    const cihaz = `cihaz-devralmaz-${Date.now()}`;
    const misafir = await cagir('/api/kimlik/misafir', { cihazKimligi: cihaz });
    await cagir('/api/kimlik/kayit', {
      eposta: `ilk-${Date.now()}@ornek.com`,
      parola: 'parolam1234',
      ad: 'İlk',
      cihazKimligi: cihaz,
    });

    const ikinci = await cagir('/api/kimlik/kayit', {
      eposta: `sonra-${Date.now()}@ornek.com`,
      parola: 'parolam1234',
      ad: 'Sonra',
      cihazKimligi: cihaz,
    });
    expect(ikinci.durum).toBe(200);
    expect(ikinci.cevap.veri!.oyuncu.id).not.toBe(misafir.cevap.veri!.oyuncu.id);
  });
});
