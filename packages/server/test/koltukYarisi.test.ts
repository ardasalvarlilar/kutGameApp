// Ayni anda oturmaya calisan oyuncular.
//
// Bu dosya BIR HATANIN uzerine yazildi: dort arkadas masa kodunu ayni anda
// girdiginde ikisi de ayni koltuga oturdu. `findOne` ile okuyup `save()`
// demek klasik oku-degistir-yaz yarisi; ikisi de ayni belgeyi okuyup ayni bos
// koltugu sectiler. Sonuc: 1 numarali koltukta iki oyuncu, 3 numara bos.
// Ikisi ayni eli gordu, bos koltugu sunucu oynadi.
//
// `masayaKatil` artik `findOneAndUpdate` ile atomik yaziyor. Test paralel
// katilimi zorluyor — sirali cagrilarla bu hata HIC gorunmuyordu.

import mongoose from 'mongoose';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Masa } from '../src/modeller/Masa.js';
import { Oyuncu } from '../src/modeller/Oyuncu.js';
import { MASA_KAPASITESI, masaKur, masayaKatil } from '../src/servisler/masaServisi.js';

const MONGO = process.env['TEST_MONGO_URI'] ?? 'mongodb://127.0.0.1:27017';
const VERITABANI = `kut_test_yaris_${Date.now()}`;

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
});

async function oyuncuAc(ad: string): Promise<string> {
  const belge = await Oyuncu.create({
    ad,
    misafirMi: true,
    saglayicilar: [{ tip: 'misafir', disKimlik: `${ad}-${Date.now()}-${Math.random()}` }],
  });
  return String(belge._id);
}

describe.skipIf(!mongoVar)('koltuk yarisi', () => {
  it('ayni anda katilan uc oyuncu AYRI koltuklara oturuyor', async () => {
    const sahip = await oyuncuAc('Sahip');
    const masa = await masaKur(sahip);

    const digerleri = await Promise.all([oyuncuAc('Bir'), oyuncuAc('Iki'), oyuncuAc('Uc')]);
    // `Promise.all` sart: sirali cagrilarda hata HIC gorunmuyor.
    await Promise.all(digerleri.map((id) => masayaKatil(masa.kod, id)));

    const son = await Masa.findById(masa._id);
    const numaralar = son!.koltuklar.map((k) => k.no).sort();

    expect(son!.koltuklar).toHaveLength(MASA_KAPASITESI);
    expect(numaralar).toEqual([0, 1, 2, 3]);
    // Her koltukta AYRI oyuncu olmali.
    expect(new Set(son!.koltuklar.map((k) => String(k.oyuncu))).size).toBe(MASA_KAPASITESI);
  });

  it('kapasitenin uzerine cikilamiyor — fazlasi reddediliyor', async () => {
    const sahip = await oyuncuAc('Sahip');
    const masa = await masaKur(sahip);

    const kalabalik = await Promise.all(
      Array.from({ length: 7 }, (_, sira) => oyuncuAc(`Aday${sira}`)),
    );
    const sonuclar = await Promise.allSettled(
      kalabalik.map((id) => masayaKatil(masa.kod, id)),
    );

    const oturan = sonuclar.filter((s) => s.status === 'fulfilled').length;
    // Sahip zaten oturuyor: geri kalan uc koltuk dolabilir, digerleri hayir.
    expect(oturan).toBe(MASA_KAPASITESI - 1);

    const son = await Masa.findById(masa._id);
    expect(son!.koltuklar).toHaveLength(MASA_KAPASITESI);
    expect(son!.koltuklar.map((k) => k.no).sort()).toEqual([0, 1, 2, 3]);
  });

  it('ayni oyuncu iki kez katilinca ikinci koltuk ACILMIYOR', async () => {
    const sahip = await oyuncuAc('Sahip');
    const masa = await masaKur(sahip);
    const oyuncu = await oyuncuAc('Cift');

    // Iki cihaz ya da cift dokunus: ikisi de ayni anda gidiyor.
    await Promise.allSettled([
      masayaKatil(masa.kod, oyuncu),
      masayaKatil(masa.kod, oyuncu),
    ]);

    const son = await Masa.findById(masa._id);
    const benimkiler = son!.koltuklar.filter((k) => String(k.oyuncu) === oyuncu);
    expect(benimkiler).toHaveLength(1);
  });

  it('bosalan koltuk yeniden dolduruluyor', async () => {
    const sahip = await oyuncuAc('Sahip');
    const masa = await masaKur(sahip);
    const bir = await oyuncuAc('Bir');
    await masayaKatil(masa.kod, bir);

    // 1 numarayi elle bosalt; sonraki katilan orayi almali.
    await Masa.updateOne({ _id: masa._id }, { $pull: { koltuklar: { no: 1 } } });

    const iki = await oyuncuAc('Iki');
    const son = await masayaKatil(masa.kod, iki);
    expect(son.koltuklar.find((k) => String(k.oyuncu) === iki)?.no).toBe(1);
  });
});
