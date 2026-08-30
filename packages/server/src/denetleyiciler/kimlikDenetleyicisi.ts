// Giris uclari.
//
// Hepsi ayni sekli doner: `{ ok, veri: { jeton, oyuncu } }`. Istemci tek bir
// cozumleyiciyle uc yolu da isliyor.

import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  KimlikHatasi,
  adSemasi,
  adiDegistir,
  girisSemasi,
  girisYap,
  hesabiSil,
  kayitOl,
  kayitSemasi,
  misafirGirisi,
  misafirGirisiSemasi,
  misafirYukselt,
  oyuncuOzeti,
  parolaKoduIste,
  parolaSifirlaSemasi,
  parolaUnuttumSemasi,
  parolayiSifirla,
  type GirisSonucu,
} from '../servisler/kimlikServisi.js';
import {
  ModerasyonHatasi,
  engelKaldir,
  engelle,
  engellenenler,
  sikayetEt,
} from '../servisler/moderasyonServisi.js';
import { SIKAYET_SEBEPLERI } from '../modeller/Sikayet.js';
import { Oyuncu } from '../modeller/Oyuncu.js';
// Bu dosyada `kayit` zaten bir denetleyicinin adi (hesap kaydi).
// Gunlukcuyu takma adla aliyoruz ki iki anlam carpismasin.
import { kayit as gunluk } from '../kayit.js';

/** Zod hatasindan oyuncuya gosterilecek TEK bir cumle cikarir. */
function ilkHata(hata: z.ZodError): string {
  return hata.issues[0]?.message ?? 'Girdi geçersiz';
}

function girisiYolla(yanit: Response, sonuc: GirisSonucu): void {
  yanit.json({
    ok: true,
    veri: { jeton: sonuc.jeton, oyuncu: oyuncuOzeti(sonuc.oyuncu) },
  });
}

/**
 * Beklenen hatalar 400 ile gider, beklenmeyenler yukari firlar ve
 * `hataYakala` onlari 500'e cevirir. Ayrim onemli: ic hata mesaji istemciye
 * sizmamali (araKatman/hataYakala.ts).
 */
async function calistir(yanit: Response, is: () => Promise<GirisSonucu>): Promise<void> {
  try {
    girisiYolla(yanit, await is());
  } catch (hata) {
    if (hata instanceof KimlikHatasi) {
      yanit.status(400).json({ ok: false, hata: hata.message });
      return;
    }
    throw hata;
  }
}

export async function misafir(istek: Request, yanit: Response): Promise<void> {
  const cozum = misafirGirisiSemasi.safeParse(istek.body);
  if (!cozum.success) {
    yanit.status(400).json({ ok: false, hata: 'Cihaz kimliği geçersiz' });
    return;
  }
  await calistir(yanit, () => misafirGirisi(cozum.data));
}

export async function kayit(istek: Request, yanit: Response): Promise<void> {
  const cozum = kayitSemasi.safeParse(istek.body);
  if (!cozum.success) {
    yanit.status(400).json({ ok: false, hata: ilkHata(cozum.error) });
    return;
  }
  await calistir(yanit, () => kayitOl(cozum.data));
}

export async function giris(istek: Request, yanit: Response): Promise<void> {
  const cozum = girisSemasi.safeParse(istek.body);
  if (!cozum.success) {
    yanit.status(400).json({ ok: false, hata: ilkHata(cozum.error) });
    return;
  }
  await calistir(yanit, () => girisYap(cozum.data));
}

/** Oturumu acik misafir hesabini kalicilastirir; ilerlemesi korunur. */
export async function yukselt(istek: Request, yanit: Response): Promise<void> {
  const cozum = kayitSemasi.omit({ cihazKimligi: true }).safeParse(istek.body);
  if (!cozum.success) {
    yanit.status(400).json({ ok: false, hata: ilkHata(cozum.error) });
    return;
  }
  await calistir(yanit, () => misafirYukselt(istek.oyuncuId as string, cozum.data));
}

const adGirdisi = z.object({ ad: adSemasi });

export async function adDegistir(istek: Request, yanit: Response): Promise<void> {
  const cozum = adGirdisi.safeParse(istek.body);
  if (!cozum.success) {
    yanit.status(400).json({ ok: false, hata: ilkHata(cozum.error) });
    return;
  }
  await calistir(yanit, () => adiDegistir(istek.oyuncuId as string, cozum.data.ad));
}

/** Jetonun sahibi — uygulama acilista kendini dogrulamak icin cagirir. */
export async function ben(istek: Request, yanit: Response): Promise<void> {
  const oyuncu = await Oyuncu.findById(istek.oyuncuId);
  if (oyuncu === null) {
    yanit.status(404).json({ ok: false, hata: 'Oyuncu bulunamadı' });
    return;
  }
  yanit.json({ ok: true, veri: { oyuncu: oyuncuOzeti(oyuncu) } });
}

// --- Parola sifirlama --------------------------------------------------------

/**
 * Kod ister.
 *
 * Adres kayitli olmasa da 200 doner: "böyle bir e-posta yok" demek, hangi
 * adreslerin kayitli oldugunu sizdirir. Oyuncuya her durumda ayni cumle.
 */
export async function parolaUnuttum(istek: Request, yanit: Response): Promise<void> {
  const cozum = parolaUnuttumSemasi.safeParse(istek.body);
  if (!cozum.success) {
    yanit.status(400).json({ ok: false, hata: ilkHata(cozum.error) });
    return;
  }
  try {
    const sonuc = await parolaKoduIste(cozum.data);
    if (!sonuc.postaGitti) gunluk.bilgi('Parola kodu istendi ama adres kayitli degil');
    yanit.json({
      ok: true,
      veri: { mesaj: 'Adres kayıtlıysa kod gönderildi — gelen kutunu kontrol et' },
    });
  } catch (hata) {
    if (hata instanceof KimlikHatasi) {
      yanit.status(400).json({ ok: false, hata: hata.message });
      return;
    }
    // SMTP hatasi: oyuncuya ic ayrinti verme, gunluge tam halini yaz.
    gunluk.hata('Parola kodu gonderilemedi', hata);
    yanit.status(502).json({ ok: false, hata: 'Kod gönderilemedi, biraz sonra tekrar dene' });
  }
}

export async function parolaSifirla(istek: Request, yanit: Response): Promise<void> {
  const cozum = parolaSifirlaSemasi.safeParse(istek.body);
  if (!cozum.success) {
    yanit.status(400).json({ ok: false, hata: ilkHata(cozum.error) });
    return;
  }
  await calistir(yanit, () => parolayiSifirla(cozum.data));
}

// --- Hesap silme -------------------------------------------------------------

/** App Store 5.1.1(v): hesap uygulama ICINDEN silinebilmeli. */
export async function hesapSil(istek: Request, yanit: Response): Promise<void> {
  try {
    await hesabiSil(istek.oyuncuId as string);
    yanit.json({ ok: true, veri: { silindi: true } });
  } catch (hata) {
    if (hata instanceof KimlikHatasi) {
      yanit.status(400).json({ ok: false, hata: hata.message });
      return;
    }
    throw hata;
  }
}

// --- Sikayet ve engelleme (App Store 1.2) ------------------------------------

const sikayetGirdisi = z.object({
  oyuncuId: z.string().min(1),
  sebep: z.enum(SIKAYET_SEBEPLERI),
  aciklama: z.string().trim().max(500).optional(),
  masaId: z.string().optional(),
});

const hedefGirdisi = z.object({ oyuncuId: z.string().min(1) });

async function moderasyon(yanit: Response, is: () => Promise<unknown>): Promise<void> {
  try {
    yanit.json({ ok: true, veri: await is() });
  } catch (hata) {
    if (hata instanceof ModerasyonHatasi) {
      yanit.status(400).json({ ok: false, hata: hata.message });
      return;
    }
    throw hata;
  }
}

export async function sikayet(istek: Request, yanit: Response): Promise<void> {
  const cozum = sikayetGirdisi.safeParse(istek.body);
  if (!cozum.success) {
    yanit.status(400).json({ ok: false, hata: ilkHata(cozum.error) });
    return;
  }
  await moderasyon(yanit, async () => {
    await sikayetEt({
      sikayetEdenId: istek.oyuncuId as string,
      sikayetEdilenId: cozum.data.oyuncuId,
      sebep: cozum.data.sebep,
      aciklama: cozum.data.aciklama,
      masaId: cozum.data.masaId,
    });
    return { bildirildi: true };
  });
}

export async function engelEkle(istek: Request, yanit: Response): Promise<void> {
  const cozum = hedefGirdisi.safeParse(istek.body);
  if (!cozum.success) {
    yanit.status(400).json({ ok: false, hata: 'Geçersiz oyuncu' });
    return;
  }
  await moderasyon(yanit, async () => {
    await engelle(istek.oyuncuId as string, cozum.data.oyuncuId);
    return { engellenenler: await engellenenler(istek.oyuncuId as string) };
  });
}

export async function engelSil(istek: Request, yanit: Response): Promise<void> {
  const cozum = hedefGirdisi.safeParse(istek.body);
  if (!cozum.success) {
    yanit.status(400).json({ ok: false, hata: 'Geçersiz oyuncu' });
    return;
  }
  await moderasyon(yanit, async () => {
    await engelKaldir(istek.oyuncuId as string, cozum.data.oyuncuId);
    return { engellenenler: await engellenenler(istek.oyuncuId as string) };
  });
}

export async function engelListesi(istek: Request, yanit: Response): Promise<void> {
  yanit.json({ ok: true, veri: { engellenenler: await engellenenler(istek.oyuncuId as string) } });
}
