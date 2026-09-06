// MASA BUL — acik masalarin listesi.
//
// Listenin tasidigi tek kural sudur: OZEL MASA BURADA GORUNMEZ. Oyuncu ozel
// masayi "yalnizca cagirdigim uc kisi otursun" diye aciyor; listede gorunmesi
// o masanin varlik sebebini yok ederdi.
//
// Ikinci kural engelleme (App Store 1.2): engellediginin ya da seni
// engelleyenin oturdugu masa listede HIC cikmaz. Gorunup katilirken
// reddedilmek, engellemeyi karsi tarafa sezdirirdi.

import mongoose from 'mongoose';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Masa } from '../src/modeller/Masa.js';
import { Oyuncu } from '../src/modeller/Oyuncu.js';
import { acikMasalar, masaKur, masayaKatil } from '../src/servisler/masaServisi.js';
import { engelle } from '../src/servisler/moderasyonServisi.js';

const MONGO = process.env['TEST_MONGO_URI'] ?? 'mongodb://127.0.0.1:27017';
const VERITABANI = `kut_test_liste_${Date.now()}`;

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

describe.skipIf(!mongoVar)('acikMasalar — MASA BUL', () => {
  it('ozel masa listede GORUNMEZ', async () => {
    const sahip = await oyuncuAc('Sahip');
    await masaKur(sahip, true);

    const bakan = await oyuncuAc('Bakan');
    expect(await acikMasalar(bakan)).toEqual([]);
  });

  it('acik masa listede gorunur, oturanlariyla birlikte', async () => {
    const sahip = await oyuncuAc('Sahip');
    const masa = await masaKur(sahip, false);

    const bakan = await oyuncuAc('Bakan');
    const liste = await acikMasalar(bakan);

    expect(liste).toHaveLength(1);
    expect(liste[0]?.kod).toBe(masa.kod);
    expect(liste[0]?.oyuncuSayisi).toBe(1);
    expect(liste[0]?.kapasite).toBe(4);
    expect(liste[0]?.oyuncular).toEqual(['Sahip']);
    expect(liste[0]?.benimMi).toBe(false);
  });

  it('dolu masa listeye girmez', async () => {
    const sahip = await oyuncuAc('Sahip');
    const masa = await masaKur(sahip, false);
    for (const ad of ['Bir', 'Iki', 'Uc']) {
      await masayaKatil(masa.kod, await oyuncuAc(ad));
    }

    const bakan = await oyuncuAc('Bakan');
    expect(await acikMasalar(bakan)).toEqual([]);
  });

  it('oynanan masa listeye girmez', async () => {
    const sahip = await oyuncuAc('Sahip');
    const masa = await masaKur(sahip, false);
    await Masa.updateOne({ _id: masa._id }, { durum: 'oynaniyor' });

    const bakan = await oyuncuAc('Bakan');
    expect(await acikMasalar(bakan)).toEqual([]);
  });

  it('en dolu masa basta gelir — oyuncular tek masada toplansin', async () => {
    const bosSahip = await oyuncuAc('BosSahip');
    const bos = await masaKur(bosSahip, false);

    const doluSahip = await oyuncuAc('DoluSahip');
    const dolu = await masaKur(doluSahip, false);
    await masayaKatil(dolu.kod, await oyuncuAc('Ikinci'));

    const bakan = await oyuncuAc('Bakan');
    const liste = await acikMasalar(bakan);
    expect(liste.map((m) => m.kod)).toEqual([dolu.kod, bos.kod]);
  });

  it('engellediginin masasi listede cikmaz', async () => {
    const kotu = await oyuncuAc('Kotu');
    await masaKur(kotu, false);

    const bakan = await oyuncuAc('Bakan');
    await engelle(bakan, kotu);

    expect(await acikMasalar(bakan)).toEqual([]);
  });

  it('SENI engelleyenin masasi da cikmaz — kontrol cift yonlu', async () => {
    // Tek yonlu olsaydi taciz eden, engellendigini fark edip yeni masa acarak
    // yine karsisina cikardi.
    const kotu = await oyuncuAc('Kotu');
    await masaKur(kotu, false);

    const bakan = await oyuncuAc('Bakan');
    await engelle(kotu, bakan);

    expect(await acikMasalar(bakan)).toEqual([]);
  });

  it('kendi oturdugu masayi benimMi ile isaretler', async () => {
    const ben = await oyuncuAc('Ben');
    await masaKur(ben, false);

    const liste = await acikMasalar(ben);
    expect(liste).toHaveLength(1);
    expect(liste[0]?.benimMi).toBe(true);
  });
});
