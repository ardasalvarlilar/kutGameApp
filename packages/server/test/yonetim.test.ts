// Yonetim paneli: kapi, korumalar ve islemler.
//
//   - oyuncu jetonuyla yonetim uclarina girilemiyor mu
//   - kurucu rolden bagimsiz admin mi, ve kimse onu disarida birakamiyor mu
//   - admin kendini askiya alamiyor / silemiyor mu
//   - cip gerekcesiyle deftere, her islem islem kaydina yaziliyor mu
//   - panel sayfasi veriliyor ve arama motoruna kapali mi
//
// Kurucu adresi vitest.config.ts'te: kurucu@ornek.com. Mongo yoksa islem
// testleri atlanir; sayfa testi her zaman kosar.

import { createServer, type Server } from 'node:http';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BASLANGIC_CIPI } from '@kut/ekonomi';
import { uygulamayiKur } from '../src/app.js';
import { CipHareketi } from '../src/modeller/CipHareketi.js';
import { Oyuncu } from '../src/modeller/Oyuncu.js';
import { YonetimKaydi } from '../src/modeller/YonetimKaydi.js';

const MONGO = process.env['TEST_MONGO_URI'] ?? 'mongodb://127.0.0.1:27017';
const VERITABANI = `kut_test_yonetim_${Date.now()}`;

const mongoVar = await mongoose
  .connect(`${MONGO}/${VERITABANI}`, { serverSelectionTimeoutMS: 4000 })
  .then(() => true)
  .catch(() => false);

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
  if (!mongoVar) return;
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

interface Cevap {
  readonly kod: number;
  readonly govde: { ok: boolean; veri?: unknown; hata?: string };
}

async function cagir(yontem: string, yol: string, govde?: unknown, jeton?: string): Promise<Cevap> {
  const yanit = await fetch(`${kok}/api${yol}`, {
    method: yontem,
    headers: {
      ...(govde === undefined ? {} : { 'content-type': 'application/json' }),
      ...(jeton === undefined ? {} : { authorization: `Bearer ${jeton}` }),
    },
    ...(govde === undefined ? {} : { body: JSON.stringify(govde) }),
  });
  return { kod: yanit.status, govde: (await yanit.json()) as Cevap['govde'] };
}

interface Hesap {
  readonly id: string;
  readonly jeton: string;
}

async function hesapAc(eposta: string, ad: string): Promise<Hesap> {
  const { govde } = await cagir('POST', '/kimlik/kayit', {
    eposta,
    parola: 'parolam1234',
    ad,
    cihazKimligi: `cihaz-${eposta}`,
  });
  const veri = govde.veri as { jeton: string; oyuncu: { id: string } };
  return { id: veri.oyuncu.id, jeton: veri.jeton };
}

describe('panel sayfasi', () => {
  it('/yonetim/ HTML veriyor ve arama motoruna kapali', async () => {
    const yanit = await fetch(`${kok}/yonetim/`);
    expect(yanit.status).toBe(200);
    expect(yanit.headers.get('content-type')).toContain('text/html');
    expect(yanit.headers.get('x-robots-tag')).toContain('noindex');
    expect(await yanit.text()).toContain('panel.js');
  });

  it('panel betigi ayri dosya olarak veriliyor (CSP satir ici script istemiyor)', async () => {
    const yanit = await fetch(`${kok}/yonetim/panel.js`);
    expect(yanit.status).toBe(200);
    expect(yanit.headers.get('content-type')).toContain('javascript');
  });

  it('jetonsuz yonetim ucu 401', async () => {
    expect((await cagir('GET', '/yonetim/ozet')).kod).toBe(401);
  });
});

describe.skipIf(!mongoVar)('yonetim islemleri', () => {
  let kurucu: Hesap;
  let oyuncu: Hesap;

  beforeAll(async () => {
    kurucu = await hesapAc('kurucu@ornek.com', 'Kurucu');
    oyuncu = await hesapAc(`oyuncu-${Date.now()}@ornek.com`, 'Siradan');
  });

  it('oyuncu jetonuyla girilemez', async () => {
    const { kod, govde } = await cagir('GET', '/yonetim/ozet', undefined, oyuncu.jeton);
    expect(kod).toBe(403);
    expect(govde.hata).toBe('yetki-yok');
  });

  it('kurucu, rolu yazilmamis olsa da admin', async () => {
    await Oyuncu.updateOne({ _id: kurucu.id }, { $set: { rol: 'oyuncu' } });
    expect((await cagir('GET', '/yonetim/ozet', undefined, kurucu.jeton)).kod).toBe(200);
  });

  it('cip gerekcesiyle ekleniyor ve deftere yaziliyor', async () => {
    const { kod } = await cagir(
      'POST',
      `/yonetim/oyuncular/${oyuncu.id}/cip`,
      { miktar: 50_000, aciklama: 'turnuva odulu' },
      kurucu.jeton,
    );
    expect(kod).toBe(200);
    expect((await Oyuncu.findById(oyuncu.id).lean())!.cuzdan.cip).toBe(BASLANGIC_CIPI + 50_000);
    const hareket = await CipHareketi.findOne({ oyuncu: oyuncu.id, sebep: 'yonetici' }).lean();
    expect(hareket?.aciklama).toBe('turnuva odulu');
  });

  it('gerekcesiz cip reddediliyor, bakiyeden fazlasi cikarilamiyor', async () => {
    const gerekcesiz = await cagir(
      'POST',
      `/yonetim/oyuncular/${oyuncu.id}/cip`,
      { miktar: 1_000, aciklama: '' },
      kurucu.jeton,
    );
    expect(gerekcesiz.govde.hata).toBe('gecersiz-istek');

    const fazla = await cagir(
      'POST',
      `/yonetim/oyuncular/${oyuncu.id}/cip`,
      { miktar: -10_000_000, aciklama: 'hatali cikis' },
      kurucu.jeton,
    );
    expect(fazla.govde.hata).toBe('cip-yetersiz');
  });

  it('rol verilen oyuncu panele girer ama kurucuya ve kendine dokunamaz', async () => {
    await cagir('PATCH', `/yonetim/oyuncular/${oyuncu.id}`, { rol: 'admin' }, kurucu.jeton);
    expect((await cagir('GET', '/yonetim/ozet', undefined, oyuncu.jeton)).kod).toBe(200);

    const kurucuyuDusur = await cagir(
      'PATCH',
      `/yonetim/oyuncular/${kurucu.id}`,
      { rol: 'oyuncu' },
      oyuncu.jeton,
    );
    expect(kurucuyuDusur.govde.hata).toBe('kurucu-korunuyor');

    const kurucuyuSil = await cagir(
      'DELETE',
      `/yonetim/oyuncular/${kurucu.id}`,
      { sebep: 'deneme' },
      oyuncu.jeton,
    );
    expect(kurucuyuSil.govde.hata).toBe('kurucu-korunuyor');

    const kendiniAski = await cagir(
      'POST',
      `/yonetim/oyuncular/${oyuncu.id}/aski`,
      { askida: true, sebep: 'deneme' },
      oyuncu.jeton,
    );
    expect(kendiniAski.govde.hata).toBe('kendine-yapilamaz');
  });

  it('misafire yonetici rolu verilemez', async () => {
    const { govde } = await cagir('POST', '/kimlik/misafir', { cihazKimligi: 'cihaz-misafir-yonetim' });
    const misafirId = (govde.veri as { oyuncu: { id: string } }).oyuncu.id;
    const sonuc = await cagir('PATCH', `/yonetim/oyuncular/${misafirId}`, { rol: 'admin' }, kurucu.jeton);
    expect(sonuc.govde.hata).toBe('misafire-yetki-verilemez');
  });

  it('yetkisi alinan admin HEMEN disarida kalir', async () => {
    await cagir('PATCH', `/yonetim/oyuncular/${oyuncu.id}`, { rol: 'oyuncu' }, kurucu.jeton);
    expect((await cagir('GET', '/yonetim/ozet', undefined, oyuncu.jeton)).kod).toBe(403);
  });

  it('askiya alinan oyuncu giris yapamaz; silinen kaybolur; hepsi kayitta', async () => {
    const hedef = await hesapAc(`hedef-${Date.now()}@ornek.com`, 'Hedef');
    await cagir(
      'POST',
      `/yonetim/oyuncular/${hedef.id}/aski`,
      { askida: true, sebep: 'taciz sikayetleri' },
      kurucu.jeton,
    );
    expect((await Oyuncu.findById(hedef.id).lean())!.engelli).toBe(true);

    const silme = await cagir(
      'DELETE',
      `/yonetim/oyuncular/${hedef.id}`,
      { sebep: 'kalici ihlal' },
      kurucu.jeton,
    );
    expect(silme.kod).toBe(200);
    expect(await Oyuncu.exists({ _id: hedef.id })).toBeNull();

    const islemler = await YonetimKaydi.find({ hedef: hedef.id }).lean();
    expect(islemler.map((k) => k.islem).sort()).toEqual(['askiya-al', 'sil']);
  });

  it('arama adla buluyor', async () => {
    const { govde } = await cagir('GET', '/yonetim/oyuncular?ara=sirad', undefined, kurucu.jeton);
    const veri = govde.veri as { oyuncular: { id: string }[] };
    expect(veri.oyuncular.map((o) => o.id)).toContain(oyuncu.id);
  });
});
