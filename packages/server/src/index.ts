// Giris noktasi: veritabanini ac, HTTP + soket sunucusunu ayaga kaldir.

import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { uygulamayiKur } from './app.js';
import { config } from './config.js';
import { kayit } from './kayit.js';
import { soketiKur, kapanisaGec, oturumlariKapat } from './soket/index.js';
import { yarimMasalariKapat } from './servisler/masaServisi.js';
import { postayiDogrula } from './servisler/postaServisi.js';
import { veritabaniniAc, veritabaniniKapat } from './veritabani.js';

async function baslat(): Promise<void> {
  await veritabaniniAc();

  // Canli oyun durumu bellekte duruyor (servisler/oyunServisi.ts). Sunucu
  // yeniden baslayinca o durum gitti; Mongo'da "oynaniyor" kalan masa artik
  // geri kurulamaz. Temizlenmezse oyuncular bir daha hicbir masaya oturamaz.
  const kapatilan = await yarimMasalariKapat();
  if (kapatilan > 0) kayit.bilgi(`Yarim kalmis ${kapatilan} masa kapatildi`);

  // SMTP'yi acilista BIR KEZ dener. Basarisiz olsa da sunucu ayaga kalkar:
  // oyun e-postasiz da oynaniyor, yalnizca parola sifirlama calismaz. Yanlis
  // ayari uretimde ilk oyuncu denemeden once gormek istiyoruz.
  await postayiDogrula();

  const app = uygulamayiKur();
  const http = createServer(app);
  const io = new Server(http, {
    cors: {
      origin: config.corsKaynaklari.length > 0 ? config.corsKaynaklari : true,
      credentials: true,
    },
    // Mobil ag kopmalarinda soket hemen olmesin.
    pingInterval: 20_000,
    pingTimeout: 25_000,
  });

  soketiKur(io);

  http.listen(config.port, () => {
    kayit.bilgi(`Küt sunucusu ${config.port} portunda (${config.ortam})`);
  });

  // Kapanirken acik oturumlari ve baglantilari duzgun kapat: VPS'te yeniden
  // baslatma sirasinda yarim kalan zamanlayici birakmayalim.
  const kapan = async (isaret: string): Promise<void> => {
    kayit.bilgi(`${isaret} alindi, kapaniyor`);
    // Once bayrak: `io.close()` butun soketleri dusurecek ve her `disconnect`
    // isleyicisi Mongo'ya gidecek. Bayrak olmadan, kapanan baglantiya carpan
    // sorgu sureci dusuruyor.
    kapanisaGec();
    oturumlariKapat();
    // Soketler kapanmadan Mongo'yu kapatirsak, ucan sorgular baglantisiz
    // kalir. Sira onemli: once soket, sonra HTTP, en son veritabani.
    await new Promise<void>((coz) => io.close(() => coz()));
    await new Promise<void>((coz) => http.close(() => coz()));
    await veritabaniniKapat();
    process.exit(0);
  };
  process.on('SIGTERM', () => void kapan('SIGTERM'));
  process.on('SIGINT', () => void kapan('SIGINT'));
}

baslat().catch((hata) => {
  kayit.hata('Sunucu baslatilamadi', hata);
  process.exit(1);
});
