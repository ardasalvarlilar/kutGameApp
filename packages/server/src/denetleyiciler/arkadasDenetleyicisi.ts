// Arkadaslik uclari.
//
// Hepsi ayni sekli doner: durum degistiren her cagri, degistirdikten sonra
// GUNCEL LISTEYI de doner. Sebebi istemci tarafi: liste ekrani her islemden
// sonra ikinci bir GET atmak zorunda kalmasin ve iki istek arasinda eskimis
// bir liste gostermesin.

import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  ArkadasHatasi,
  arkadasDurumu,
  iliskiyiSil,
  istegiKabulEt,
  istekGonder,
  koduAra,
} from '../servisler/arkadasServisi.js';

const hedefGirdisi = z.object({ oyuncuId: z.string().min(1) });
const kodGirdisi = z.object({ kod: z.string().trim().min(3).max(24) });

/**
 * Beklenen hatalar 400 ile gider, beklenmeyenler yukari firlar ve
 * `hataYakala` onlari 500'e cevirir (araKatman/hataYakala.ts).
 */
async function calistir(yanit: Response, is: () => Promise<unknown>): Promise<void> {
  try {
    yanit.json({ ok: true, veri: await is() });
  } catch (hata) {
    if (hata instanceof ArkadasHatasi) {
      yanit.status(400).json({ ok: false, hata: hata.message });
      return;
    }
    throw hata;
  }
}

/** Arkadaslar + gelen/giden istekler + kendi arkadas kodum. */
export async function arkadaslar(istek: Request, yanit: Response): Promise<void> {
  await calistir(yanit, () => arkadasDurumu(istek.oyuncuId as string));
}

/**
 * Arkadas koduyla oyuncu arar.
 *
 * Bulunamayan kod da 200 doner (`{ bulunan: null }`), 404 degil: 404,
 * "böyle bir kod var ama sana kapali" ile "böyle bir kod yok" arasindaki
 * farki sizdirmaya baslardi (engellenen oyuncular da null donuyor).
 */
export async function ara(istek: Request, yanit: Response): Promise<void> {
  const cozum = kodGirdisi.safeParse({ kod: istek.query['kod'] });
  if (!cozum.success) {
    yanit.status(400).json({ ok: false, hata: 'Arkadaş kodu geçersiz' });
    return;
  }
  await calistir(yanit, async () => ({
    bulunan: await koduAra(istek.oyuncuId as string, cozum.data.kod),
  }));
}

export async function istek(istek: Request, yanit: Response): Promise<void> {
  const cozum = hedefGirdisi.safeParse(istek.body);
  if (!cozum.success) {
    yanit.status(400).json({ ok: false, hata: 'Geçersiz oyuncu' });
    return;
  }
  const benim = istek.oyuncuId as string;
  await calistir(yanit, async () => {
    const sonuc = await istekGonder(benim, cozum.data.oyuncuId);
    return { sonuc, ...(await arkadasDurumu(benim)) };
  });
}

export async function kabul(istek: Request, yanit: Response): Promise<void> {
  const cozum = hedefGirdisi.safeParse(istek.body);
  if (!cozum.success) {
    yanit.status(400).json({ ok: false, hata: 'Geçersiz oyuncu' });
    return;
  }
  const benim = istek.oyuncuId as string;
  await calistir(yanit, async () => {
    await istegiKabulEt(benim, cozum.data.oyuncuId);
    return arkadasDurumu(benim);
  });
}

/** Istegi reddetmek ve arkadasligi bitirmek AYNI ucta: ikisi de iliskiyi siler. */
export async function sil(istek: Request, yanit: Response): Promise<void> {
  const cozum = hedefGirdisi.safeParse(istek.body);
  if (!cozum.success) {
    yanit.status(400).json({ ok: false, hata: 'Geçersiz oyuncu' });
    return;
  }
  const benim = istek.oyuncuId as string;
  await calistir(yanit, async () => {
    await iliskiyiSil(benim, cozum.data.oyuncuId);
    return arkadasDurumu(benim);
  });
}
