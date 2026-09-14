// Yonetim uclari — girdiyi dogrular, servisi cagirir.
//
// Bu uclara `kimlikDogrula` + `yoneticiDogrula` ile geliniyor (rotalar).
// Silme ve askiya alma oyuncunun acik soketini de kesiyor.

import type { Request, Response } from 'express';
import { z } from 'zod';
import { Oyuncu, ROLLER } from '../modeller/Oyuncu.js';
import { SIKAYET_DURUMLARI } from '../modeller/Sikayet.js';
import { oyuncuyuBaglantidanAt } from '../soket/index.js';
import {
  YonetimHatasi,
  askiDurumu,
  cipAyarla,
  genelOzet,
  islemKayitlari,
  oyuncuAra,
  oyuncuDetayi,
  oyuncuyuDuzenle,
  oyuncuyuSil,
  sikayetDurumunuDegistir,
  sikayetleriGetir,
} from '../servisler/yonetimServisi.js';

const gerekce = z.string().trim().min(3).max(200);

const aramaSemasi = z.object({
  ara: z.string().max(100).default(''),
  sayfa: z.coerce.number().int().min(0).max(10_000).default(0),
});
const duzenlemeSemasi = z.object({
  ad: z.string().max(40).optional(),
  rol: z.enum(ROLLER).optional(),
  deneyim: z.number().int().min(0).max(100_000_000).optional(),
});
const cipSemasi = z.object({
  miktar: z
    .number()
    .int()
    .refine((m) => m !== 0 && Math.abs(m) <= 1_000_000_000),
  aciklama: gerekce,
});
const askiSemasi = z.object({ askida: z.boolean(), sebep: gerekce });
const silmeSemasi = z.object({ sebep: gerekce });
const sikayetFiltresi = z.object({ durum: z.enum(SIKAYET_DURUMLARI).optional() });
const sikayetDurumSemasi = z.object({ durum: z.enum(SIKAYET_DURUMLARI) });

function yonetici(istek: Request): string {
  return istek.oyuncuId as string;
}

function hedef(istek: Request): string {
  return String(istek.params['id'] ?? '');
}

async function calistir<T>(yanit: Response, is: () => Promise<T>): Promise<void> {
  try {
    yanit.json({ ok: true, veri: await is() });
  } catch (hata) {
    if (hata instanceof YonetimHatasi) {
      yanit.status(400).json({ ok: false, hata: hata.message });
      return;
    }
    throw hata;
  }
}

function gecersiz(yanit: Response): void {
  yanit.status(400).json({ ok: false, hata: 'gecersiz-istek' });
}

/** Panele giren admin kim — panel ust barinda gosteriliyor. */
export async function ben(istek: Request, yanit: Response): Promise<void> {
  await calistir(yanit, async () => {
    const oyuncu = await Oyuncu.findById(yonetici(istek)).select('ad eposta').lean();
    return { id: yonetici(istek), ad: oyuncu?.ad ?? '', eposta: oyuncu?.eposta ?? null };
  });
}

export async function ozet(_istek: Request, yanit: Response): Promise<void> {
  await calistir(yanit, () => genelOzet());
}

export async function oyuncular(istek: Request, yanit: Response): Promise<void> {
  const cozum = aramaSemasi.safeParse(istek.query);
  if (!cozum.success) return gecersiz(yanit);
  await calistir(yanit, () => oyuncuAra(cozum.data.ara, cozum.data.sayfa));
}

export async function oyuncu(istek: Request, yanit: Response): Promise<void> {
  await calistir(yanit, () => oyuncuDetayi(hedef(istek)));
}

export async function duzenle(istek: Request, yanit: Response): Promise<void> {
  const cozum = duzenlemeSemasi.safeParse(istek.body);
  if (!cozum.success) return gecersiz(yanit);
  await calistir(yanit, () => oyuncuyuDuzenle(yonetici(istek), hedef(istek), cozum.data));
}

export async function cip(istek: Request, yanit: Response): Promise<void> {
  const cozum = cipSemasi.safeParse(istek.body);
  if (!cozum.success) return gecersiz(yanit);
  await calistir(yanit, () =>
    cipAyarla(yonetici(istek), hedef(istek), cozum.data.miktar, cozum.data.aciklama),
  );
}

export async function aski(istek: Request, yanit: Response): Promise<void> {
  const cozum = askiSemasi.safeParse(istek.body);
  if (!cozum.success) return gecersiz(yanit);
  await calistir(yanit, async () => {
    const sonuc = await askiDurumu(
      yonetici(istek),
      hedef(istek),
      cozum.data.askida,
      cozum.data.sebep,
    );
    if (cozum.data.askida) oyuncuyuBaglantidanAt(hedef(istek));
    return sonuc;
  });
}

export async function sil(istek: Request, yanit: Response): Promise<void> {
  const cozum = silmeSemasi.safeParse(istek.body);
  if (!cozum.success) return gecersiz(yanit);
  await calistir(yanit, async () => {
    await oyuncuyuSil(yonetici(istek), hedef(istek), cozum.data.sebep);
    oyuncuyuBaglantidanAt(hedef(istek));
    return { silindi: true };
  });
}

export async function sikayetler(istek: Request, yanit: Response): Promise<void> {
  const cozum = sikayetFiltresi.safeParse(istek.query);
  if (!cozum.success) return gecersiz(yanit);
  await calistir(yanit, () => sikayetleriGetir(cozum.data.durum ?? null));
}

export async function sikayetDurumu(istek: Request, yanit: Response): Promise<void> {
  const cozum = sikayetDurumSemasi.safeParse(istek.body);
  if (!cozum.success) return gecersiz(yanit);
  await calistir(yanit, async () => {
    await sikayetDurumunuDegistir(yonetici(istek), hedef(istek), cozum.data.durum);
    return { durum: cozum.data.durum };
  });
}

export async function kayitlar(_istek: Request, yanit: Response): Promise<void> {
  await calistir(yanit, () => islemKayitlari());
}
