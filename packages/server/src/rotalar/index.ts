// REST uclari.
//
// Oyunun kendisi SOKET uzerinden akiyor; burasi yalnizca giris ve profil
// gibi tek seferlik isler icin. Masa islemleri de sokette, cunku masaya
// katilmak ayni anda bir odaya girmek demek.

import { Router, type Request, type RequestHandler, type Response } from 'express';
import {
  adDegistir,
  ben,
  engelEkle,
  engelListesi,
  engelSil,
  giris,
  hesapSil,
  kayit,
  misafir,
  parolaSifirla,
  parolaUnuttum,
  sikayet,
  yukselt,
} from '../denetleyiciler/kimlikDenetleyicisi.js';
import { kimlikDogrula } from '../araKatman/kimlikDogrula.js';
import { oranSiniri } from '../araKatman/oranSiniri.js';

/** `async` denetleyiciyi Express'in hata zincirine baglar. */
const sar =
  (is: (istek: Request, yanit: Response) => Promise<void>): RequestHandler =>
  (istek, yanit, sonraki) => {
    is(istek, yanit).catch(sonraki);
  };

export function rotalariKur(): Router {
  const rota = Router();

  // Parola denemesi pahali (bcrypt) ve saldiri hedefi; misafir girisi ise
  // uygulamanin her acilisinda geliyor — ikisine ayri sinir.
  //
  // 40, "ayni evdeki dort arkadas" ile "sozluk saldirisi" arasindaki denge:
  // ayni Wi-Fi'dan cikan herkes tek IP gorunuyor ve kayit + giris + birkac
  // yanlis deneme bu kovayi paylasiyor. Saldirgan icin 15 dakikada 40 deneme
  // hicbir sozlugu bitirmiyor.
  const parolaSiniri = oranSiniri({ pencereMs: 15 * 60 * 1000, enFazla: 40 });
  const genelSinir = oranSiniri({ pencereMs: 60 * 1000, enFazla: 60 });

  // Yuk dengeleyici ve izleme icin; kimlik istemez.
  rota.get('/saglik', (_istek, yanit) => {
    yanit.json({ ok: true, veri: { ayakta: true, zaman: new Date().toISOString() } });
  });

  rota.post('/kimlik/misafir', genelSinir, sar(misafir));
  rota.post('/kimlik/kayit', parolaSiniri, sar(kayit));
  rota.post('/kimlik/giris', parolaSiniri, sar(giris));

  // Parola sifirlama e-posta gonderiyor: kotuye kullanimi hem oyuncuyu spam'e
  // bogar hem posta sunucusunun itibarini yakar. Ayri ve DAR bir sinir.
  const kodSiniri = oranSiniri({ pencereMs: 15 * 60 * 1000, enFazla: 5 });
  rota.post('/kimlik/parola-unuttum', kodSiniri, sar(parolaUnuttum));
  rota.post('/kimlik/parola-sifirla', parolaSiniri, sar(parolaSifirla));

  rota.post('/kimlik/yukselt', kimlikDogrula, parolaSiniri, sar(yukselt));
  rota.post('/kimlik/ad', kimlikDogrula, genelSinir, sar(adDegistir));
  rota.get('/kimlik/ben', kimlikDogrula, sar(ben));

  // App Store 5.1.1(v) — hesap uygulama ICINDEN silinebilmeli.
  rota.delete('/kimlik/hesap', kimlikDogrula, genelSinir, sar(hesapSil));

  // App Store 1.2 — sikayet ve engelleme.
  rota.post('/moderasyon/sikayet', kimlikDogrula, genelSinir, sar(sikayet));
  rota.post('/moderasyon/engelle', kimlikDogrula, genelSinir, sar(engelEkle));
  rota.post('/moderasyon/engel-kaldir', kimlikDogrula, genelSinir, sar(engelSil));
  rota.get('/moderasyon/engellenenler', kimlikDogrula, sar(engelListesi));

  return rota;
}
