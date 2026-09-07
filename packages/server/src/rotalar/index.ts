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
  parolaDegistir,
  parolaSifirla,
  parolaUnuttum,
  sikayet,
  yukselt,
} from '../denetleyiciler/kimlikDenetleyicisi.js';
import {
  bildirimJetonuKaydet,
  bildirimJetonuSil,
} from '../denetleyiciler/bildirimDenetleyicisi.js';
import {
  ara as arkadasAra,
  arkadaslar,
  istek as arkadasIstegi,
  kabul as arkadasKabul,
  sil as arkadasSil,
} from '../denetleyiciler/arkadasDenetleyicisi.js';
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
  // Parola degistirme de bir bcrypt karsilastirmasi: parola siniri altinda.
  rota.post('/kimlik/parola', kimlikDogrula, parolaSiniri, sar(parolaDegistir));
  rota.post('/kimlik/ad', kimlikDogrula, genelSinir, sar(adDegistir));
  rota.get('/kimlik/ben', kimlikDogrula, sar(ben));

  // App Store 5.1.1(v) — hesap uygulama ICINDEN silinebilmeli.
  rota.delete('/kimlik/hesap', kimlikDogrula, genelSinir, sar(hesapSil));

  // Push bildirimi — cihaz kaydi. Uygulama izni alinca jetonu yolluyor,
  // cikis yaparken siliyor. Ne zaman bildirim gonderilecegi ayri bir konu
  // (servisler/bildirimServisi.ts).
  rota.post('/bildirim/jeton', kimlikDogrula, genelSinir, sar(bildirimJetonuKaydet));
  rota.delete('/bildirim/jeton', kimlikDogrula, genelSinir, sar(bildirimJetonuSil));

  // App Store 1.2 — sikayet ve engelleme.
  rota.post('/moderasyon/sikayet', kimlikDogrula, genelSinir, sar(sikayet));
  rota.post('/moderasyon/engelle', kimlikDogrula, genelSinir, sar(engelEkle));
  rota.post('/moderasyon/engel-kaldir', kimlikDogrula, genelSinir, sar(engelSil));
  rota.get('/moderasyon/engellenenler', kimlikDogrula, sar(engelListesi));

  // Arkadaslik. Arama ayri ve DAR bir sinirda: kod tahmin edilemez olsa da
  // deneme yanilmayla taranmasinin onune geciyor.
  const aramaSiniri = oranSiniri({ pencereMs: 60 * 1000, enFazla: 20 });
  rota.get('/arkadas', kimlikDogrula, sar(arkadaslar));
  rota.get('/arkadas/ara', kimlikDogrula, aramaSiniri, sar(arkadasAra));
  rota.post('/arkadas/istek', kimlikDogrula, genelSinir, sar(arkadasIstegi));
  rota.post('/arkadas/kabul', kimlikDogrula, genelSinir, sar(arkadasKabul));
  rota.post('/arkadas/sil', kimlikDogrula, genelSinir, sar(arkadasSil));

  return rota;
}
