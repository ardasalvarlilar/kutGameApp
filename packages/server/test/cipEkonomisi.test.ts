// Cip ekonomisinin Mongo tarafi: bakiye, kademe kilidi, tahsilat, iade.
//
// Kurallarin kendisi (pot, odul, seviye egrisi) @kut/ekonomi'de test ediliyor.
// Buradaki soru sunucunun onlari GUVENLE uygulayip uygulamadigi:
//   - yeni hesap baslangic cipiyle aciliyor mu
//   - kilitli ya da parasi yetmeyen kademeye oturulamiyor mu
//   - tahsilat "hepsi ya da hicbiri" mi — yarim tahsilat kalmiyor mu
//   - sunucu coktugunde giris iade ediliyor mu, IKI KEZ edilmiyor mu
//   - eski `cuzdan.jeton` belgeleri tasiniyor mu
//
// Mongo yoksa atlanir (bkz. cevrimici.test.ts):
//   docker run -d --name kut-mongo -p 27017:27017 mongo:7

import mongoose, { Types } from 'mongoose';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { BASLANGIC_CIPI, kademeBul, seviyeEsigi } from '@kut/ekonomi';
import { CipHareketi } from '../src/modeller/CipHareketi.js';
import { Masa } from '../src/modeller/Masa.js';
import { Oyuncu } from '../src/modeller/Oyuncu.js';
import { cipGocu, girisleriTahsilEt } from '../src/servisler/cuzdanServisi.js';
import { deneyimEkle } from '../src/servisler/ilerlemeServisi.js';
import {
  MasaHatasi,
  hizliMasa,
  masaKur,
  masayaKatil,
  yarimMasalariKapat,
} from '../src/servisler/masaServisi.js';

const MONGO = process.env['TEST_MONGO_URI'] ?? 'mongodb://127.0.0.1:27017';
const VERITABANI = `kut_test_cip_${Date.now()}`;

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
  await Masa.deleteMany({});
  await Oyuncu.deleteMany({});
  await CipHareketi.deleteMany({});
});

async function oyuncuAc(
  ad: string,
  ayar: { cip?: number; seviye?: number } = {},
): Promise<string> {
  const belge = await Oyuncu.create({
    ad,
    misafirMi: true,
    saglayicilar: [{ tip: 'misafir', disKimlik: `${ad}-${Date.now()}-${Math.random()}` }],
    ...(ayar.cip === undefined ? {} : { cuzdan: { cip: ayar.cip } }),
    ...(ayar.seviye === undefined ? {} : { ilerleme: { seviye: ayar.seviye } }),
  });
  return String(belge._id);
}

async function bakiye(oyuncuId: string): Promise<number> {
  const belge = await Oyuncu.findById(oyuncuId).lean();
  return belge!.cuzdan.cip;
}

/** Hatanin KODUNU yakalar: `rejects.toThrow` mesaj alt dizesine bakiyor. */
async function hataKodu(is: () => Promise<unknown>): Promise<string | null> {
  try {
    await is();
    return null;
  } catch (hata) {
    return hata instanceof MasaHatasi ? hata.message : String(hata);
  }
}

describe.skipIf(!mongoVar)('cip ekonomisi (Mongo)', () => {
  it('yeni hesap baslangic cipiyle aciliyor', async () => {
    const id = await oyuncuAc('Yeni');
    expect(await bakiye(id)).toBe(BASLANGIC_CIPI);
  });

  it('kilitli kademede masa kurulamaz, cipi yetmeyen de oturamaz', async () => {
    const caylak = await oyuncuAc('Caylak');
    expect(await hataKodu(() => masaKur(caylak, true, 'usta'))).toBe('seviye-yetersiz');

    const fakir = await oyuncuAc('Fakir', { cip: 1_000 });
    expect(await hataKodu(() => masaKur(fakir, true, 'caylak'))).toBe('cip-yetersiz');
    expect(await hataKodu(() => hizliMasa(fakir, 'caylak'))).toBe('cip-yetersiz');
  });

  it('kodu bilmek kilidi acmaz', async () => {
    const usta = await oyuncuAc('Usta', { seviye: 10, cip: 1_000_000 });
    const masa = await masaKur(usta, true, 'usta');
    expect(masa.giris).toBe(kademeBul('usta').giris);

    const caylak = await oyuncuAc('Caylak');
    expect(await hataKodu(() => masayaKatil(masa.kod, caylak))).toBe('seviye-yetersiz');
  });

  it('hizli eslesme yalnizca ayni kademedeki masaya oturtur', async () => {
    const a = await oyuncuAc('Oyuncu A', { seviye: 5, cip: 100_000 });
    const amatorMasa = await hizliMasa(a, 'amator');

    const b = await oyuncuAc('Oyuncu B', { seviye: 5, cip: 100_000 });
    const caylakMasa = await hizliMasa(b, 'caylak');
    expect(String(caylakMasa._id)).not.toBe(String(amatorMasa._id));

    const c = await oyuncuAc('Oyuncu C', { seviye: 5, cip: 100_000 });
    const yine = await hizliMasa(c, 'amator');
    expect(String(yine._id)).toBe(String(amatorMasa._id));
  });

  it('tahsilat herkesten dusup deftere yaziyor', async () => {
    const idler = await Promise.all(['Oyuncu A', 'Oyuncu B', 'Oyuncu C'].map((ad) => oyuncuAc(ad)));
    const masaId = String(new Types.ObjectId());

    const sonuc = await girisleriTahsilEt(masaId, idler, 5_000);
    expect(sonuc.yetersizler).toEqual([]);
    for (const id of idler) expect(await bakiye(id)).toBe(BASLANGIC_CIPI - 5_000);
    expect(await CipHareketi.countDocuments({ sebep: 'masa-giris' })).toBe(3);
  });

  it('biri oduyemezse KIMSEDEN tahsil edilmiyor', async () => {
    const zengin = await oyuncuAc('Zengin');
    const fakir = await oyuncuAc('Fakir', { cip: 100 });
    const masaId = String(new Types.ObjectId());

    const sonuc = await girisleriTahsilEt(masaId, [zengin, fakir], 5_000);
    expect(sonuc.odeyenler).toEqual([]);
    expect(sonuc.yetersizler).toEqual([fakir]);
    expect(await bakiye(zengin)).toBe(BASLANGIC_CIPI);
    expect(await bakiye(fakir)).toBe(100);
  });

  it('ayni anda iki tahsilat bakiyeyi eksiye dusuremez', async () => {
    const id = await oyuncuAc('Tek', { cip: 5_000 });
    const [bir, iki] = await Promise.all([
      girisleriTahsilEt(String(new Types.ObjectId()), [id], 5_000),
      girisleriTahsilEt(String(new Types.ObjectId()), [id], 5_000),
    ]);
    expect([bir.odeyenler.length, iki.odeyenler.length].sort()).toEqual([0, 1]);
    expect(await bakiye(id)).toBe(0);
  });

  it('sunucu coktugunde oturanlara iade, kacana degil, ikinci kez degil', async () => {
    const kalan = await oyuncuAc('Kalan');
    const kacan = await oyuncuAc('Kacan');
    const masa = await Masa.create({
      kod: 'IADE',
      sahip: kalan,
      durum: 'oynaniyor',
      kademe: 'caylak',
      giris: 5_000,
      pot: 10_000,
      odeyenler: [kalan, kacan],
      koltuklar: [
        { no: 0, oyuncu: kalan, bot: false, hazir: true },
        // Kacanin koltugu bota gecmis (masaServisi.koltuguBotaDevret).
        { no: 1, bot: true, hazir: true },
        { no: 2, bot: true, hazir: true },
        { no: 3, bot: true, hazir: true },
      ],
    });
    await Oyuncu.updateMany({ _id: { $in: [kalan, kacan] } }, { $inc: { 'cuzdan.cip': -5_000 } });

    await yarimMasalariKapat();
    await yarimMasalariKapat();

    expect(await bakiye(kalan)).toBe(BASLANGIC_CIPI);
    expect(await bakiye(kacan)).toBe(BASLANGIC_CIPI - 5_000);
    expect((await Masa.findById(masa._id))!.durum).toBe('bitti');
  });

  it('eski cuzdan.jeton belgeleri baslangic cipiyle tasiniyor', async () => {
    const { insertedId } = await Oyuncu.collection.insertOne({
      ad: 'Eski',
      misafirMi: true,
      saglayicilar: [],
      cuzdan: { jeton: 0, toplamAlinan: 0 },
      ilerleme: { seviye: 1, deneyim: 0 },
    });

    expect(await cipGocu()).toBe(1);
    const ham = await Oyuncu.collection.findOne({ _id: insertedId });
    expect(ham?.['cuzdan']).toEqual({ cip: BASLANGIC_CIPI, toplamAlinan: 0 });
    // Ikinci kosu bir sey yapmaz.
    expect(await cipGocu()).toBe(0);
  });

  it('deneyim esigi gecince seviye atliyor', async () => {
    const id = await oyuncuAc('Deneyimli');
    await deneyimEkle(id, seviyeEsigi(3) - 1);
    expect((await Oyuncu.findById(id).lean())!.ilerleme.seviye).toBe(2);
    await deneyimEkle(id, 1);
    expect((await Oyuncu.findById(id).lean())!.ilerleme.seviye).toBe(3);
  });
});
