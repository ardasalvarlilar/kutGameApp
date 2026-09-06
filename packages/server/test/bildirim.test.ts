// Push bildirimi altyapisi.
//
// Iki tur test var:
//
//   saf     — jeton bicimi ve yigina bolme; Mongo gerektirmez
//   Mongo'lu — jetonun hangi oyuncuya bagli oldugu
//
// Gonderimin KENDISI (Expo'ya HTTP) burada test edilmiyor: disaridaki bir
// servise baglanmak testi ag durumuna bagimli kilardi. Test edilen sey, o
// gonderimin dogru jetonlarla ve dogru sayida parcayla cagrilmasi.

import mongoose from 'mongoose';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Oyuncu } from '../src/modeller/Oyuncu.js';
import {
  jetonGecerliMi,
  jetonKaydet,
  jetonSil,
  yiginaBol,
} from '../src/servisler/bildirimServisi.js';

const MONGO = process.env['TEST_MONGO_URI'] ?? 'mongodb://127.0.0.1:27017';
const VERITABANI = `kut_test_bildirim_${Date.now()}`;

const JETON = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
const JETON_IKI = 'ExponentPushToken[yyyyyyyyyyyyyyyyyyyyyy]';

describe('jetonGecerliMi', () => {
  it('Expo jetonlarini kabul eder', () => {
    expect(jetonGecerliMi(JETON)).toBe(true);
    expect(jetonGecerliMi('ExpoPushToken[abc123]')).toBe(true);
  });

  it('bozuk jetonu reddeder — cop veritabanina girmesin', () => {
    expect(jetonGecerliMi('')).toBe(false);
    expect(jetonGecerliMi('merhaba')).toBe(false);
    expect(jetonGecerliMi('ExponentPushToken[')).toBe(false);
    // APNs'in ham jetonu; Expo'ya yollanamaz.
    expect(jetonGecerliMi('a1b2c3d4e5f6'.repeat(4))).toBe(false);
  });
});

describe('yiginaBol', () => {
  it('Expo sinirina gore parcalar', () => {
    const yuz = Array.from({ length: 250 }, (_, i) => i);
    const yiginlar = yiginaBol(yuz, 100);
    expect(yiginlar.map((y) => y.length)).toEqual([100, 100, 50]);
  });

  it('sinirin altinda tek parca kalir', () => {
    expect(yiginaBol([1, 2, 3], 100)).toEqual([[1, 2, 3]]);
  });

  it('bos liste bos doner', () => {
    expect(yiginaBol([], 100)).toEqual([]);
  });
});

// --- Mongo gerektirenler -----------------------------------------------------

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
});

async function oyuncuAc(ad: string): Promise<string> {
  const belge = await Oyuncu.create({
    ad,
    misafirMi: true,
    saglayicilar: [{ tip: 'misafir', disKimlik: `${ad}-${Date.now()}-${Math.random()}` }],
  });
  return String(belge._id);
}

async function jetonlari(oyuncuId: string): Promise<readonly string[]> {
  const belge = await Oyuncu.findById(oyuncuId).select('bildirimJetonlari').lean();
  return (belge?.bildirimJetonlari ?? []).map((k) => k.jeton);
}

describe.skipIf(!mongoVar)('jetonKaydet', () => {
  it('cihazi oyuncuya baglar', async () => {
    const oyuncu = await oyuncuAc('Bir');
    await jetonKaydet(oyuncu, JETON, 'ios');
    expect(await jetonlari(oyuncu)).toEqual([JETON]);
  });

  it('ayni jeton iki kez eklenmez — tazelenir', async () => {
    const oyuncu = await oyuncuAc('Bir');
    await jetonKaydet(oyuncu, JETON, 'ios');
    await jetonKaydet(oyuncu, JETON, 'ios');
    expect(await jetonlari(oyuncu)).toEqual([JETON]);
  });

  it('bir oyuncunun birden cok cihazi olabilir', async () => {
    const oyuncu = await oyuncuAc('Bir');
    await jetonKaydet(oyuncu, JETON, 'ios');
    await jetonKaydet(oyuncu, JETON_IKI, 'android');
    expect(new Set(await jetonlari(oyuncu))).toEqual(new Set([JETON, JETON_IKI]));
  });

  it('CIHAZ baska hesaba girerse jeton TASINIR, kopyalanmaz', async () => {
    // Kritik: kopyalansaydi bildirim eski sahibinin adina bu telefona
    // dusmeye devam ederdi — baskasinin bilgisi yabancinin kilit ekraninda.
    const eski = await oyuncuAc('Eski');
    const yeni = await oyuncuAc('Yeni');

    await jetonKaydet(eski, JETON, 'ios');
    await jetonKaydet(yeni, JETON, 'ios');

    expect(await jetonlari(eski)).toEqual([]);
    expect(await jetonlari(yeni)).toEqual([JETON]);
  });

  it('bozuk jeton kaydedilmez', async () => {
    const oyuncu = await oyuncuAc('Bir');
    await expect(jetonKaydet(oyuncu, 'cop', 'ios')).rejects.toThrow();
    expect(await jetonlari(oyuncu)).toEqual([]);
  });
});

describe.skipIf(!mongoVar)('jetonSil', () => {
  it('cikis yapan cihaz artik bildirim almaz', async () => {
    const oyuncu = await oyuncuAc('Bir');
    await jetonKaydet(oyuncu, JETON, 'ios');
    await jetonSil(JETON);
    expect(await jetonlari(oyuncu)).toEqual([]);
  });

  it('kayitli olmayan jetonu silmek sorun degil', async () => {
    await expect(jetonSil(JETON_IKI)).resolves.toBeUndefined();
  });
});
