// Yonetim paneli islemleri — Mongo tarafi.
//
// Panel (`packages/server/yonetim/`) yalnizca bu servisin uclarini cagiriyor.
// Her DEGISTIREN islem YonetimKaydi'na yaziliyor; cip degisiklikleri ayrica
// cip defterine, gerekcesiyle.
//
// Korumalar:
//  - Admin KENDINI askiya alamaz, silemez, rolunu dusuremez.
//  - Kurucu (`KURUCU_EPOSTA`) hicbir admin tarafindan askiya alinamaz,
//    silinemez, rolu dusurulemez.
//  Ikisi birlikte "herkes kendini disarida birakti" durumunu imkansiz kiliyor.
//
// Hata kodlari UYGULAMAYA hic gitmiyor (yonetim uclarini yalnizca panel
// cagiriyor); cevirileri panelin kendisinde.

import { Types } from 'mongoose';
import { seviyeHesapla } from '@kut/ekonomi';
import { config } from '../config.js';
import { kurucuMu } from '../araKatman/yoneticiDogrula.js';
import { CipHareketi } from '../modeller/CipHareketi.js';
import { Masa } from '../modeller/Masa.js';
import { Oyuncu, type Rol } from '../modeller/Oyuncu.js';
import { SIKAYET_DURUMLARI, Sikayet } from '../modeller/Sikayet.js';
import { YonetimKaydi, type YonetimIslemi } from '../modeller/YonetimKaydi.js';
import { adSorunu } from './adFiltresi.js';
import { cipDus, cipEkle } from './cuzdanServisi.js';
import { hesabiSil } from './kimlikServisi.js';

export class YonetimHatasi extends Error {}

type SikayetDurumu = (typeof SIKAYET_DURUMLARI)[number];

const SAYFA_BOYU = 25;

function kimlikGecerli(kimlik: string): void {
  if (!Types.ObjectId.isValid(kimlik)) throw new YonetimHatasi('oyuncu-bulunamadi');
}

async function kayitYaz(
  yoneticiId: string,
  islem: YonetimIslemi,
  hedef: string | null,
  ayrinti: string,
): Promise<void> {
  await YonetimKaydi.create({
    yonetici: yoneticiId,
    islem,
    ...(hedef === null ? {} : { hedef }),
    ayrinti: ayrinti.slice(0, 500),
  });
}

/** Admin kendine ve kurucuya yikici islem yapamaz. */
async function korumaKontrolu(yoneticiId: string, hedefId: string) {
  const hedef = await Oyuncu.findById(hedefId);
  if (hedef === null) throw new YonetimHatasi('oyuncu-bulunamadi');
  if (hedefId === yoneticiId) throw new YonetimHatasi('kendine-yapilamaz');
  if (kurucuMu(hedef.eposta)) throw new YonetimHatasi('kurucu-korunuyor');
  return hedef;
}

/** Kimlik -> ad; silinmis hesaplar icin yer tutucu. */
async function adHaritasi(kimlikler: readonly unknown[]): Promise<Map<string, string>> {
  const benzersiz = [...new Set(kimlikler.filter((k) => k != null).map(String))];
  const oyuncular = await Oyuncu.find({ _id: { $in: benzersiz } }).select('ad').lean();
  return new Map(oyuncular.map((o) => [String(o._id), o.ad]));
}

const SILINMIS = 'silinmiş oyuncu';

// --- Kurucu ------------------------------------------------------------------

/** Acilista kurucu hesabinin rolunu admin yapar (panelde dogru gorunsun). */
export async function kurucuyuYetkilendir(): Promise<boolean> {
  if (config.kurucuEposta === '') return false;
  const sonuc = await Oyuncu.updateOne(
    { eposta: config.kurucuEposta, rol: { $ne: 'admin' } },
    { $set: { rol: 'admin' } },
  );
  return sonuc.modifiedCount > 0;
}

// --- Genel bakis ------------------------------------------------------------

export async function genelOzet(suAn = Date.now()) {
  const dun = new Date(suAn - 24 * 3600 * 1000);
  const [
    oyuncu,
    misafir,
    admin,
    askida,
    son24Saat,
    yeni24Saat,
    bekleyenMasa,
    oynananMasa,
    yeniSikayet,
    cip,
    hareketler,
  ] = await Promise.all([
    Oyuncu.countDocuments(),
    Oyuncu.countDocuments({ misafirMi: true }),
    Oyuncu.countDocuments({ rol: 'admin' }),
    Oyuncu.countDocuments({ engelli: true }),
    Oyuncu.countDocuments({ sonGorulme: { $gte: dun } }),
    Oyuncu.countDocuments({ createdAt: { $gte: dun } }),
    Masa.countDocuments({ durum: 'bekliyor' }),
    Masa.countDocuments({ durum: 'oynaniyor' }),
    Sikayet.countDocuments({ durum: 'yeni' }),
    Oyuncu.aggregate<{ toplam: number }>([
      { $group: { _id: null, toplam: { $sum: '$cuzdan.cip' } } },
    ]),
    CipHareketi.aggregate<{ _id: string; toplam: number; adet: number }>([
      { $match: { createdAt: { $gte: dun } } },
      { $group: { _id: '$sebep', toplam: { $sum: '$miktar' }, adet: { $sum: 1 } } },
    ]),
  ]);

  const sebep = (ad: string): number => hareketler.find((h) => h._id === ad)?.toplam ?? 0;
  return {
    oyuncular: { toplam: oyuncu, misafir, kayitli: oyuncu - misafir, admin, askida },
    son24Saat: { gorulen: son24Saat, yeniHesap: yeni24Saat },
    masalar: { bekliyor: bekleyenMasa, oynaniyor: oynananMasa },
    yeniSikayet,
    dolasimdakiCip: cip[0]?.toplam ?? 0,
    son24SaatCip: {
      girisler: -sebep('masa-giris'),
      oduller: sebep('masa-odulu'),
      iadeler: sebep('masa-iadesi'),
      // Pottan kesilen: giren − odenen − iade edilen. Suren maclarin potu
      // henuz dagitilmadigi icin YAKLASIK.
      masaUcreti: -sebep('masa-giris') - sebep('masa-odulu') - sebep('masa-iadesi'),
      hediye: sebep('hediye'),
      reklam: sebep('reklam-odulu'),
      yonetici: sebep('yonetici'),
      baslangic: sebep('baslangic'),
    },
  };
}

// --- Oyuncular ---------------------------------------------------------------

function oyuncuSatiri(o: {
  _id: unknown;
  ad: string;
  eposta?: string | null;
  misafirMi: boolean;
  rol: string;
  engelli: boolean;
  cuzdan: { cip: number };
  ilerleme: { seviye: number };
  sonGorulme: Date;
  createdAt?: Date;
}) {
  return {
    id: String(o._id),
    ad: o.ad,
    eposta: o.eposta ?? null,
    misafirMi: o.misafirMi,
    rol: kurucuMu(o.eposta) ? 'admin' : o.rol,
    kurucu: kurucuMu(o.eposta),
    askida: o.engelli,
    cip: o.cuzdan.cip,
    seviye: o.ilerleme.seviye,
    sonGorulme: o.sonGorulme.toISOString(),
    acilis: o.createdAt?.toISOString() ?? null,
  };
}

/**
 * Ad, e-posta, arkadas kodu ya da kimlikle arar. Bos aramada en son
 * gorulenler.
 */
export async function oyuncuAra(ara: string, sayfa: number) {
  const temiz = ara.trim();
  const kacisli = temiz.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const filtre =
    temiz === ''
      ? {}
      : {
          $or: [
            { ad: { $regex: kacisli, $options: 'i' } },
            { eposta: { $regex: kacisli, $options: 'i' } },
            { arkadasKodu: temiz.toUpperCase() },
            ...(Types.ObjectId.isValid(temiz) ? [{ _id: new Types.ObjectId(temiz) }] : []),
          ],
        };

  const [oyuncular, toplam] = await Promise.all([
    Oyuncu.find(filtre)
      .sort({ sonGorulme: -1 })
      .skip(sayfa * SAYFA_BOYU)
      .limit(SAYFA_BOYU)
      .lean(),
    Oyuncu.countDocuments(filtre),
  ]);
  return { oyuncular: oyuncular.map(oyuncuSatiri), toplam, sayfaBoyu: SAYFA_BOYU };
}

export async function oyuncuDetayi(oyuncuId: string) {
  kimlikGecerli(oyuncuId);
  const oyuncu = await Oyuncu.findById(oyuncuId).lean();
  if (oyuncu === null) throw new YonetimHatasi('oyuncu-bulunamadi');

  const [defter, hakkindakiler, masa, islemler] = await Promise.all([
    CipHareketi.find({ oyuncu: oyuncuId }).sort({ createdAt: -1 }).limit(50).lean(),
    Sikayet.find({ sikayetEdilen: oyuncuId }).sort({ createdAt: -1 }).limit(20).lean(),
    Masa.findOne({ 'koltuklar.oyuncu': oyuncuId, durum: { $ne: 'bitti' } })
      .select('kod durum kademe tur')
      .lean(),
    YonetimKaydi.find({ hedef: oyuncuId }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);
  const adlar = await adHaritasi([
    ...hakkindakiler.map((s) => s.sikayetEden),
    ...islemler.map((k) => k.yonetici),
  ]);

  return {
    ...oyuncuSatiri(oyuncu),
    arkadasKodu: oyuncu.arkadasKodu ?? null,
    girisYollari: oyuncu.saglayicilar.map((s) => s.tip),
    deneyim: oyuncu.ilerleme.deneyim,
    istatistik: {
      oynananEl: oyuncu.ilerleme.oynananEl,
      kazanilanEl: oyuncu.ilerleme.kazanilanEl,
      oynananMac: oyuncu.ilerleme.oynananMac,
      kazanilanMac: oyuncu.ilerleme.kazanilanMac,
    },
    engelledigiSayisi: oyuncu.engellenenler.length,
    masa:
      masa === null
        ? null
        : { kod: masa.kod, durum: masa.durum, kademe: masa.kademe, tur: masa.tur },
    defter: defter.map((h) => ({
      zaman: h.createdAt.toISOString(),
      sebep: h.sebep,
      miktar: h.miktar,
      bakiye: h.bakiye,
      aciklama: h.aciklama ?? null,
    })),
    sikayetler: hakkindakiler.map((s) => ({
      id: String(s._id),
      zaman: s.createdAt.toISOString(),
      eden: adlar.get(String(s.sikayetEden)) ?? SILINMIS,
      sebep: s.sebep,
      aciklama: s.aciklama ?? null,
      durum: s.durum,
    })),
    islemler: islemler.map((k) => ({
      zaman: k.createdAt.toISOString(),
      yonetici: adlar.get(String(k.yonetici)) ?? SILINMIS,
      islem: k.islem,
      ayrinti: k.ayrinti ?? '',
    })),
  };
}

export interface OyuncuDuzenlemesi {
  readonly ad?: string | undefined;
  readonly rol?: Rol | undefined;
  readonly deneyim?: number | undefined;
}

export async function oyuncuyuDuzenle(
  yoneticiId: string,
  oyuncuId: string,
  degisiklik: OyuncuDuzenlemesi,
) {
  kimlikGecerli(oyuncuId);
  const oyuncu = await Oyuncu.findById(oyuncuId);
  if (oyuncu === null) throw new YonetimHatasi('oyuncu-bulunamadi');

  const notlar: string[] = [];

  if (degisiklik.ad !== undefined && degisiklik.ad.trim() !== oyuncu.ad) {
    const ad = degisiklik.ad.trim();
    // Admin de filtreden geciyor: uygunsuz adi duzeltirken bir digerini
    // koymak da mumkun olmamali.
    if (adSorunu(ad) !== null || ad.length > 24) throw new YonetimHatasi('ad-gecersiz');
    notlar.push(`ad: ${oyuncu.ad} → ${ad}`);
    oyuncu.ad = ad;
  }

  // Kurucuyu dusurme denemesi, kayitli rolu ne olursa olsun REDDEDILIR.
  // Kurucu rolden bagimsiz admin; belgede 'oyuncu' yaziyorsa bu istek "degisiklik
  // yok" sayilip sessizce basarili donmemeli.
  if (degisiklik.rol === 'oyuncu' && kurucuMu(oyuncu.eposta)) {
    throw new YonetimHatasi('kurucu-korunuyor');
  }
  if (degisiklik.rol !== undefined && degisiklik.rol !== oyuncu.rol) {
    if (degisiklik.rol === 'oyuncu' && oyuncuId === yoneticiId) {
      throw new YonetimHatasi('kendine-yapilamaz');
    }
    // Panele e-posta ve parolayla giriliyor; misafirin ikisi de yok.
    if (degisiklik.rol === 'admin' && oyuncu.misafirMi) {
      throw new YonetimHatasi('misafire-yetki-verilemez');
    }
    notlar.push(`rol: ${oyuncu.rol} → ${degisiklik.rol}`);
    oyuncu.rol = degisiklik.rol;
  }

  if (degisiklik.deneyim !== undefined && degisiklik.deneyim !== oyuncu.ilerleme.deneyim) {
    // Seviye deneyimden turuyor; elle ayri yazilmiyor. Dusurmek de mumkun
    // (yanlislikla verilen XP geri alinabilsin), bu yuzden $max degil.
    notlar.push(`deneyim: ${oyuncu.ilerleme.deneyim} → ${degisiklik.deneyim}`);
    oyuncu.ilerleme.deneyim = degisiklik.deneyim;
    oyuncu.ilerleme.seviye = seviyeHesapla(degisiklik.deneyim);
  }

  if (notlar.length === 0) return oyuncuDetayi(oyuncuId);
  await oyuncu.save();
  await kayitYaz(yoneticiId, 'duzenle', oyuncuId, notlar.join('; '));
  return oyuncuDetayi(oyuncuId);
}

/**
 * Cip ekler (arti) ya da cikarir (eksi). Gerekce ZORUNLU: "bu cip nereden
 * geldi" sorusu hem defterde hem islem kaydinda cevapli kalsin.
 */
export async function cipAyarla(
  yoneticiId: string,
  oyuncuId: string,
  miktar: number,
  aciklama: string,
) {
  kimlikGecerli(oyuncuId);
  const not = aciklama.trim();
  const bakiye =
    miktar > 0
      ? await cipEkle(oyuncuId, miktar, 'yonetici', undefined, not)
      : await cipDus(oyuncuId, -miktar, 'yonetici', undefined, not);

  if (bakiye === null) {
    const var_ = await Oyuncu.exists({ _id: oyuncuId });
    throw new YonetimHatasi(var_ === null ? 'oyuncu-bulunamadi' : 'cip-yetersiz');
  }
  await kayitYaz(yoneticiId, 'cip', oyuncuId, `${miktar > 0 ? '+' : ''}${miktar} — ${not}`);
  return { cip: bakiye };
}

export async function askiDurumu(
  yoneticiId: string,
  oyuncuId: string,
  askida: boolean,
  sebep: string,
) {
  kimlikGecerli(oyuncuId);
  const oyuncu = await korumaKontrolu(yoneticiId, oyuncuId);
  oyuncu.engelli = askida;
  await oyuncu.save();
  await kayitYaz(yoneticiId, askida ? 'askiya-al' : 'askidan-cikar', oyuncuId, sebep.trim());
  return oyuncuDetayi(oyuncuId);
}

/** Hesabi siler — oyuncunun kendi silmesiyle AYNI yol (arkadasliklar, defter). */
export async function oyuncuyuSil(yoneticiId: string, oyuncuId: string, sebep: string) {
  kimlikGecerli(oyuncuId);
  const oyuncu = await korumaKontrolu(yoneticiId, oyuncuId);
  await hesabiSil(String(oyuncu._id));
  await kayitYaz(yoneticiId, 'sil', oyuncuId, sebep.trim());
}

// --- Sikayetler --------------------------------------------------------------

export async function sikayetleriGetir(durum: SikayetDurumu | null) {
  const sikayetler = await Sikayet.find(durum === null ? {} : { durum })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  const adlar = await adHaritasi(sikayetler.flatMap((s) => [s.sikayetEden, s.sikayetEdilen]));
  return sikayetler.map((s) => ({
    id: String(s._id),
    zaman: s.createdAt.toISOString(),
    edenId: String(s.sikayetEden),
    eden: adlar.get(String(s.sikayetEden)) ?? SILINMIS,
    edilenId: String(s.sikayetEdilen),
    edilen: adlar.get(String(s.sikayetEdilen)) ?? SILINMIS,
    oAndakiAd: s.oAndakiAd,
    sebep: s.sebep,
    aciklama: s.aciklama ?? null,
    durum: s.durum,
  }));
}

export async function sikayetDurumunuDegistir(
  yoneticiId: string,
  sikayetId: string,
  durum: SikayetDurumu,
): Promise<void> {
  if (!Types.ObjectId.isValid(sikayetId)) throw new YonetimHatasi('sikayet-bulunamadi');
  const sikayet = await Sikayet.findByIdAndUpdate(sikayetId, { $set: { durum } }, { new: true });
  if (sikayet === null) throw new YonetimHatasi('sikayet-bulunamadi');
  await kayitYaz(yoneticiId, 'sikayet', String(sikayet.sikayetEdilen), `${sikayet.sebep}: ${durum}`);
}

// --- Islem kaydi -------------------------------------------------------------

export async function islemKayitlari() {
  const kayitlar = await YonetimKaydi.find().sort({ createdAt: -1 }).limit(200).lean();
  const adlar = await adHaritasi(kayitlar.flatMap((k) => [k.yonetici, k.hedef]));
  return kayitlar.map((k) => ({
    zaman: k.createdAt.toISOString(),
    yonetici: adlar.get(String(k.yonetici)) ?? SILINMIS,
    islem: k.islem,
    hedefId: k.hedef == null ? null : String(k.hedef),
    hedef: k.hedef == null ? null : (adlar.get(String(k.hedef)) ?? SILINMIS),
    ayrinti: k.ayrinti ?? '',
  }));
}
