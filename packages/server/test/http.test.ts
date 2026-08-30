import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { uygulamayiKur } from '../src/app.js';
import { jetonuCoz } from '../src/servisler/kimlikServisi.js';
import jwt from 'jsonwebtoken';
import { config } from '../src/config.js';

// Mongo GEREKTIRMEYEN katmanlar. Veritabanina dokunan uclar (misafir girisi,
// masa islemleri) canli Mongo ile dogrulanir — adimlari MIMARI.md'de.

let sunucu: Server;
let kok: string;

beforeAll(async () => {
  sunucu = createServer(uygulamayiKur());
  await new Promise<void>((coz) => sunucu.listen(0, coz));
  const adres = sunucu.address();
  if (adres === null || typeof adres === 'string') throw new Error('port alinamadi');
  kok = `http://127.0.0.1:${adres.port}`;
});

afterAll(async () => {
  await new Promise<void>((coz) => sunucu.close(() => coz()));
});

describe('HTTP katmani', () => {
  it('saglik ucu ayakta oldugunu soyluyor', async () => {
    const yanit = await fetch(`${kok}/api/saglik`);
    expect(yanit.status).toBe(200);
    const govde = (await yanit.json()) as { ok: boolean; veri: { ayakta: boolean } };
    expect(govde.ok).toBe(true);
    expect(govde.veri.ayakta).toBe(true);
  });

  it('bilinmeyen uc 404 veriyor', async () => {
    const yanit = await fetch(`${kok}/api/olmayan-uc`);
    expect(yanit.status).toBe(404);
    expect(((await yanit.json()) as { ok: boolean }).ok).toBe(false);
  });

  it('korumali uc jetonsuz 401 veriyor', async () => {
    const yanit = await fetch(`${kok}/api/kimlik/ben`);
    expect(yanit.status).toBe(401);
  });

  it('bozuk jeton 401 veriyor', async () => {
    const yanit = await fetch(`${kok}/api/kimlik/ben`, {
      headers: { authorization: 'Bearer uydurma.jeton.degeri' },
    });
    expect(yanit.status).toBe(401);
  });

  it('sunucu kendini tanitmiyor — x-powered-by kapali', async () => {
    const yanit = await fetch(`${kok}/api/saglik`);
    expect(yanit.headers.get('x-powered-by')).toBeNull();
  });

  it('helmet guvenlik basliklarini koyuyor', async () => {
    const yanit = await fetch(`${kok}/api/saglik`);
    expect(yanit.headers.get('x-content-type-options')).toBe('nosniff');
  });
});

describe('jeton', () => {
  it('uretilen jeton geri cozuluyor', () => {
    const jeton = jwt.sign({ oyuncuId: 'abc123' }, config.jwtGizli, { expiresIn: '1h' });
    expect(jetonuCoz(jeton)).toEqual({ oyuncuId: 'abc123' });
  });

  it('baska anahtarla imzalanan jeton reddediliyor', () => {
    const jeton = jwt.sign({ oyuncuId: 'abc123' }, 'baska-bir-anahtar-yeterince-uzun-olsun', {
      expiresIn: '1h',
    });
    expect(jetonuCoz(jeton)).toBeNull();
  });

  it('suresi gecmis jeton reddediliyor', () => {
    const jeton = jwt.sign({ oyuncuId: 'abc123' }, config.jwtGizli, { expiresIn: -10 });
    expect(jetonuCoz(jeton)).toBeNull();
  });

  it('icerigi eksik jeton reddediliyor', () => {
    const jeton = jwt.sign({ baskaAlan: 1 }, config.jwtGizli, { expiresIn: '1h' });
    expect(jetonuCoz(jeton)).toBeNull();
  });

  it('cop metin reddediliyor', () => {
    expect(jetonuCoz('bu bir jeton degil')).toBeNull();
  });
});
