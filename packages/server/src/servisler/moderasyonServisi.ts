// Sikayet ve engelleme.
//
// App Store Review Guideline 1.2 kullanici uretimi icerik barindiran her
// uygulamadan uc sey istiyor: uygunsuz icerigi SUZMEK, sikayet YOLU acmak ve
// taciz edeni ENGELLEYEBILMEK. Bu oyunda:
//
//   suzme      → servisler/adFiltresi.ts (gorunen ad; sohbet yok)
//   sikayet    → modeller/Sikayet.ts + `sikayetEt`
//   engelleme  → `engelle` / `engelKaldir`
//
// Engellemenin GERCEK bir karsiligi olmali, yoksa dugme sustur: engellenen
// oyuncu hizli eslesmede ayni masaya dusmez ve engelleyenin masasina kodla da
// katilamaz.

import { Types } from 'mongoose';
import { Oyuncu } from '../modeller/Oyuncu.js';
import { Sikayet, type SikayetSebebi } from '../modeller/Sikayet.js';
import { kayit } from '../kayit.js';

export class ModerasyonHatasi extends Error {}

/** Ayni kisiyi arka arkaya bildirmek kayit sisirir; gunde bir kez yeter. */
const SIKAYET_ARALIGI_MS = 24 * 60 * 60 * 1000;

/** Bir oyuncu en fazla bu kadar kisiyi engelleyebilir. */
const EN_FAZLA_ENGEL = 500;

function kimlik(deger: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(deger)) throw new ModerasyonHatasi('Geçersiz oyuncu');
  return new Types.ObjectId(deger);
}

export interface SikayetGirdisi {
  readonly sikayetEdenId: string;
  readonly sikayetEdilenId: string;
  readonly sebep: SikayetSebebi;
  readonly aciklama?: string | undefined;
  readonly masaId?: string | undefined;
}

export async function sikayetEt(girdi: SikayetGirdisi): Promise<void> {
  if (girdi.sikayetEdenId === girdi.sikayetEdilenId) {
    throw new ModerasyonHatasi('Kendini bildiremezsin');
  }
  const eden = kimlik(girdi.sikayetEdenId);
  const edilen = kimlik(girdi.sikayetEdilenId);

  const hedef = await Oyuncu.findById(edilen).select('ad').lean();
  if (hedef === null) throw new ModerasyonHatasi('Oyuncu bulunamadı');

  const yakinda = await Sikayet.findOne({
    sikayetEden: eden,
    sikayetEdilen: edilen,
    createdAt: { $gt: new Date(Date.now() - SIKAYET_ARALIGI_MS) },
  }).lean();
  // Sessizce basarili donuyoruz: oyuncuya "zaten bildirdin" demek, bildirimin
  // ise yaramadigi izlenimi veriyor.
  if (yakinda !== null) return;

  await Sikayet.create({
    sikayetEden: eden,
    sikayetEdilen: edilen,
    sebep: girdi.sebep,
    ...(girdi.aciklama === undefined ? {} : { aciklama: girdi.aciklama }),
    oAndakiAd: hedef.ad,
    ...(girdi.masaId === undefined || !Types.ObjectId.isValid(girdi.masaId)
      ? {}
      : { masa: new Types.ObjectId(girdi.masaId) }),
  });

  kayit.uyari('Yeni sikayet', { edilen: girdi.sikayetEdilenId, sebep: girdi.sebep });
}

export async function engelle(oyuncuId: string, hedefId: string): Promise<void> {
  if (oyuncuId === hedefId) throw new ModerasyonHatasi('Kendini engelleyemezsin');
  const hedef = kimlik(hedefId);

  if ((await Oyuncu.countDocuments({ _id: hedef })) === 0) {
    throw new ModerasyonHatasi('Oyuncu bulunamadı');
  }
  const oyuncu = await Oyuncu.findById(oyuncuId).select('engellenenler');
  if (oyuncu === null) throw new ModerasyonHatasi('Oyuncu bulunamadı');
  if (oyuncu.engellenenler.length >= EN_FAZLA_ENGEL) {
    throw new ModerasyonHatasi('Engel listen dolu');
  }
  // `$addToSet`: iki kez engellemek listede iki kayit birakmasin.
  await Oyuncu.updateOne({ _id: oyuncuId }, { $addToSet: { engellenenler: hedef } });
}

export async function engelKaldir(oyuncuId: string, hedefId: string): Promise<void> {
  await Oyuncu.updateOne({ _id: oyuncuId }, { $pull: { engellenenler: kimlik(hedefId) } });
}

export interface EngelliOzeti {
  readonly id: string;
  readonly ad: string;
}

export async function engellenenler(oyuncuId: string): Promise<readonly EngelliOzeti[]> {
  const oyuncu = await Oyuncu.findById(oyuncuId).select('engellenenler').lean();
  if (oyuncu === null) return [];
  const kisiler = await Oyuncu.find({ _id: { $in: oyuncu.engellenenler } })
    .select('ad')
    .lean();
  return kisiler.map((k) => ({ id: String(k._id), ad: k.ad }));
}

/**
 * Iki oyuncu birbirini engellemis mi? Yon fark etmez.
 *
 * Cift yonlu bakmak SART: yalnizca engelleyenin tarafina baksaydik, taciz eden
 * kisi engellendigini fark edip yeni masa acarak yine karsisina cikabilirdi.
 */
export async function aralarindaEngelVarMi(
  birId: string,
  ikiId: string,
): Promise<boolean> {
  if (birId === ikiId) return false;
  const bir = kimlik(birId);
  const iki = kimlik(ikiId);
  const sayi = await Oyuncu.countDocuments({
    $or: [
      { _id: bir, engellenenler: iki },
      { _id: iki, engellenenler: bir },
    ],
  });
  return sayi > 0;
}

/** Verilen oyuncularin herhangi biriyle engel iliskisi var mi? */
export async function engelliBiriVarMi(
  oyuncuId: string,
  digerleri: readonly string[],
): Promise<boolean> {
  const baskalari = digerleri.filter((id) => id !== oyuncuId && Types.ObjectId.isValid(id));
  if (baskalari.length === 0) return false;

  const ben = kimlik(oyuncuId);
  const onlar = baskalari.map((id) => new Types.ObjectId(id));
  const sayi = await Oyuncu.countDocuments({
    $or: [
      { _id: ben, engellenenler: { $in: onlar } },
      { _id: { $in: onlar }, engellenenler: ben },
    ],
  });
  return sayi > 0;
}
