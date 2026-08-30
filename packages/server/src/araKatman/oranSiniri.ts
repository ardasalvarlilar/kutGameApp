// Basit oran sinirlayici — giris uclarini kaba kuvvete karsi yavaslatir.
//
// Neden kutuphane degil: tek surec calisiyoruz ve sayac bellekte yeterli.
// Cok surece cikilirsa (birden fazla VPS ya da PM2 cluster) bu sinir surec
// basina isler; o gun geldiginde Redis'e tasinmali. Bugun tek surec var,
// bunu erken kurmak bagimlilik eklemekten baska ise yaramazdi.
//
// Amac hesap dogrulamak degil, GURULTUYU KESMEK: 15 dakikada 20 deneme,
// insanin parolasini hatirlamasina fazlasiyla yeter, sozluk saldirisina
// yetmez.

import type { NextFunction, Request, Response } from 'express';

interface Pencere {
  sayac: number;
  sifirlamaZamani: number;
}

export interface OranSeceneleri {
  readonly pencereMs: number;
  readonly enFazla: number;
}

/** Vekil sunucu arkasindayiz (Traefik): gercek IP `x-forwarded-for`da. */
function kaynak(istek: Request): string {
  const basli = istek.headers['x-forwarded-for'];
  const ham = Array.isArray(basli) ? basli[0] : basli;
  const ilk = ham?.split(',')[0]?.trim();
  return ilk !== undefined && ilk.length > 0 ? ilk : (istek.ip ?? 'bilinmeyen');
}

export function oranSiniri({ pencereMs, enFazla }: OranSeceneleri) {
  const kayitlar = new Map<string, Pencere>();

  return function sinirla(istek: Request, yanit: Response, sonraki: NextFunction): void {
    const suAn = Date.now();

    // Suresi gecmis kayitlari temizle; harita sinirsiz buyumesin.
    if (kayitlar.size > 10_000) {
      for (const [anahtar, pencere] of kayitlar) {
        if (pencere.sifirlamaZamani <= suAn) kayitlar.delete(anahtar);
      }
    }

    const anahtar = kaynak(istek);
    const mevcut = kayitlar.get(anahtar);

    if (mevcut === undefined || mevcut.sifirlamaZamani <= suAn) {
      kayitlar.set(anahtar, { sayac: 1, sifirlamaZamani: suAn + pencereMs });
      sonraki();
      return;
    }

    mevcut.sayac += 1;
    if (mevcut.sayac > enFazla) {
      const kalanSn = Math.ceil((mevcut.sifirlamaZamani - suAn) / 1000);
      yanit.status(429).json({ ok: false, hata: `Çok fazla deneme — ${kalanSn} sn sonra tekrar dene` });
      return;
    }
    sonraki();
  };
}
