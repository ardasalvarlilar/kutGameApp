// Hediye cip, cihaz basina baslangic cipi ve reklam fisi.
//
//   - uygulamayi silip kuran / hesabini silip yeniden acan 15 bin cipi
//     ikinci kez almiyor mu
//   - hediye atomik mi, artan dakikalar korunuyor mu, tavan isliyor mu
//   - reklam fisi tek kullanimlik mi, imzasiz geri cagri reddediliyor mu
//
// Imza testi Mongo istemiyor; gerisi Mongo yoksa atlanir.

import { generateKeyPairSync, sign } from 'node:crypto';
import mongoose from 'mongoose';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { BASLANGIC_CIPI, SAAT_MS } from '@kut/ekonomi';
import { BaslangicHakki } from '../src/modeller/BaslangicHakki.js';
import { Oyuncu } from '../src/modeller/Oyuncu.js';
import { ReklamFisi } from '../src/modeller/ReklamFisi.js';
import { CuzdanHatasi, hediyeTopla } from '../src/servisler/cuzdanServisi.js';
import { hesabiSil, kayitOl, misafirGirisi } from '../src/servisler/kimlikServisi.js';
import { fisiBozdur, imzaDogruMu } from '../src/servisler/reklamServisi.js';

describe('AdMob imza dogrulamasi', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const anahtarlar = new Map([['42', publicKey.export({ type: 'spki', format: 'pem' }).toString()]]);

  function imzali(mesaj: string, anahtarKimligi = '42'): string {
    const imza = sign('sha256', Buffer.from(mesaj), privateKey).toString('base64url');
    return `${mesaj}&signature=${imza}&key_id=${anahtarKimligi}`;
  }

  const MESAJ =
    'ad_network=5450213213286189855&ad_unit=1234&custom_data=fis&reward_amount=1&reward_item=cip&timestamp=1700000000000&transaction_id=abc&user_id=oyuncu';

  it('dogru imza kabul', () => {
    expect(imzaDogruMu(imzali(MESAJ), anahtarlar)).toBe(true);
  });

  it('degistirilmis sorgu reddedilir', () => {
    const sahte = imzali(MESAJ).replace('custom_data=fis', 'custom_data=baska');
    expect(imzaDogruMu(sahte, anahtarlar)).toBe(false);
  });

  it('bilinmeyen anahtar ve imzasiz sorgu reddedilir', () => {
    expect(imzaDogruMu(imzali(MESAJ, '99'), anahtarlar)).toBe(false);
    expect(imzaDogruMu(MESAJ, anahtarlar)).toBe(false);
  });
});

const MONGO = process.env['TEST_MONGO_URI'] ?? 'mongodb://127.0.0.1:27017';
const VERITABANI = `kut_test_hediye_${Date.now()}`;

const mongoVar = await mongoose
  .connect(`${MONGO}/${VERITABANI}`, { serverSelectionTimeoutMS: 4000 })
  .then(() => true)
  .catch(() => false);

afterAll(async () => {
  if (!mongoVar) return;
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

beforeEach(async () => {
  if (!mongoVar) return;
  await Oyuncu.deleteMany({});
  await BaslangicHakki.deleteMany({});
  await ReklamFisi.deleteMany({});
});

async function bakiye(oyuncuId: string): Promise<number> {
  return (await Oyuncu.findById(oyuncuId).lean())!.cuzdan.cip;
}

async function hediyeSaatiniGeriAl(oyuncuId: string, ms: number): Promise<Date> {
  const eski = new Date(Date.now() - ms);
  await Oyuncu.updateOne({ _id: oyuncuId }, { $set: { 'cuzdan.sonHediye': eski } });
  return eski;
}

describe.skipIf(!mongoVar)('baslangic cipi cihaz basina bir kez', () => {
  it('yeni cihazdaki misafir baslangic cipini alir', async () => {
    const { oyuncu } = await misafirGirisi({ cihazKimligi: 'cihaz-birinci-telefon' });
    expect(await bakiye(String(oyuncu._id))).toBe(BASLANGIC_CIPI);
  });

  it('ayni cihaz AYNI hesaba doner — yeniden kurulum yeni cip vermez', async () => {
    const ilk = await misafirGirisi({ cihazKimligi: 'android-sabit-kimlik' });
    const ikinci = await misafirGirisi({ cihazKimligi: 'android-sabit-kimlik' });
    expect(String(ikinci.oyuncu._id)).toBe(String(ilk.oyuncu._id));
  });

  it('hesabini silip ayni cihazda yeniden acan cip almaz', async () => {
    const { oyuncu } = await misafirGirisi({ cihazKimligi: 'cihaz-silen' });
    await hesabiSil(String(oyuncu._id));
    const yeniden = await misafirGirisi({ cihazKimligi: 'cihaz-silen' });
    expect(await bakiye(String(yeniden.oyuncu._id))).toBe(0);
  });

  it('ayni cihazda ikinci e-posta hesabi cip almaz', async () => {
    const ilk = await kayitOl({
      eposta: 'ilk@ornek.com',
      parola: 'parola123',
      ad: 'Ilk Hesap',
      cihazKimligi: 'cihaz-ciftci',
    });
    expect(await bakiye(String(ilk.oyuncu._id))).toBe(BASLANGIC_CIPI);

    const ikinci = await kayitOl({
      eposta: 'ikinci@ornek.com',
      parola: 'parola123',
      ad: 'Ikinci Hesap',
      cihazKimligi: 'cihaz-ciftci',
    });
    expect(await bakiye(String(ikinci.oyuncu._id))).toBe(0);
  });
});

describe.skipIf(!mongoVar)('hediye cip', () => {
  async function yeniOyuncu(cihaz: string): Promise<string> {
    return String((await misafirGirisi({ cihazKimligi: cihaz })).oyuncu._id);
  }

  it('bir saat dolmadan toplanamaz', async () => {
    const id = await yeniOyuncu('cihaz-sabirsiz');
    await expect(hediyeTopla(id)).rejects.toThrow(CuzdanHatasi);
  });

  it('2 saat 40 dakikada 200 cip; artan 40 dakika kaybolmuyor', async () => {
    const id = await yeniOyuncu('cihaz-dakik');
    const suAn = Date.now();
    const eski = await hediyeSaatiniGeriAl(id, 2 * SAAT_MS + 40 * 60_000);

    const sonuc = await hediyeTopla(id, suAn);
    expect(sonuc.kazanilan).toBe(200);
    expect(sonuc.cip).toBe(BASLANGIC_CIPI + 200);
    expect(sonuc.fis.ekMiktar).toBe(200);

    const yeni = (await Oyuncu.findById(id).lean())!.cuzdan.sonHediye.getTime();
    expect(yeni).toBe(eski.getTime() + 2 * SAAT_MS);
  });

  it('bir hafta gelmeyen tavan kadar alir: 4.800', async () => {
    const id = await yeniOyuncu('cihaz-kayip');
    await hediyeSaatiniGeriAl(id, 7 * 24 * SAAT_MS);
    expect((await hediyeTopla(id)).kazanilan).toBe(4_800);
  });

  it('ayni anda iki toplama: yalnizca biri odenir', async () => {
    const id = await yeniOyuncu('cihaz-iki-el');
    await hediyeSaatiniGeriAl(id, 5 * SAAT_MS);
    const sonuclar = await Promise.allSettled([hediyeTopla(id), hediyeTopla(id)]);
    expect(sonuclar.filter((s) => s.status === 'fulfilled')).toHaveLength(1);
    expect(await bakiye(id)).toBe(BASLANGIC_CIPI + 500);
  });
});

describe.skipIf(!mongoVar)('reklam fisi', () => {
  it('bir kez bozdurulur; ayni islem ikinci kez cip vermez', async () => {
    const { oyuncu } = await misafirGirisi({ cihazKimligi: 'cihaz-reklamci' });
    const id = String(oyuncu._id);
    await hediyeSaatiniGeriAl(id, 3 * SAAT_MS);
    const { fis } = await hediyeTopla(id);

    expect(await fisiBozdur(fis.kimlik, id, 'islem-1')).toBe('verildi');
    expect(await fisiBozdur(fis.kimlik, id, 'islem-1')).toBe('zaten-verildi');
    expect(await fisiBozdur(fis.kimlik, id, 'islem-2')).toBe('gecersiz');
    expect(await bakiye(id)).toBe(BASLANGIC_CIPI + 300 + 300);
  });

  it('suresi gecen ya da baskasinin fisi bozdurulamaz', async () => {
    const a = String((await misafirGirisi({ cihazKimligi: 'cihaz-a' })).oyuncu._id);
    const b = String((await misafirGirisi({ cihazKimligi: 'cihaz-b' })).oyuncu._id);
    await hediyeSaatiniGeriAl(a, 2 * SAAT_MS);
    const { fis } = await hediyeTopla(a);

    expect(await fisiBozdur(fis.kimlik, b, 'islem-b')).toBe('gecersiz');
    expect(await fisiBozdur(fis.kimlik, a, 'islem-gec', Date.now() + 3600_000)).toBe('gecersiz');
  });
});
