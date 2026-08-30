// E-posta gonderimi — su an tek isi parola sifirlama kodu.
//
// Ayarlar ISTEGE BAGLI (config.posta.acikMi). SMTP tanimli degilse sunucu yine
// acilir; yalnizca parola sifirlama calismaz ve oyuncuya bunu soyleyen bir
// hata doner. E-posta ayari eksik diye butun oyunun ayaga kalkmamasi sacma
// olurdu — oyun e-postasiz da oynaniyor.
//
// Gelistirmede SMTP yoksa kod GUNLUGE yaziliyor: akisi denemek icin gercek
// bir posta sunucusu kurmak zorunda kalma.
//
// HTML degil DUZ METIN de gonderiliyor: bazi istemciler HTML'i gostermiyor ve
// spam filtreleri yalnizca-HTML iletileri asagi ceker.

import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config.js';
import { kayit } from '../kayit.js';

export class PostaHatasi extends Error {}

let tasiyici: Transporter | null = null;

function tasiyiciyiAl(): Transporter {
  if (tasiyici !== null) return tasiyici;
  tasiyici = nodemailer.createTransport({
    host: config.posta.sunucu,
    port: config.posta.port,
    // 465 = baglanti bastan TLS; 587 = duz baglanti sonra STARTTLS.
    // Hostinger ikisini de veriyor, varsayilan 465.
    secure: config.posta.guvenli,
    auth: { user: config.posta.kullanici, pass: config.posta.sifre },
  });
  return tasiyici;
}

interface Ileti {
  readonly kime: string;
  readonly konu: string;
  readonly metin: string;
  readonly html: string;
}

async function gonder(ileti: Ileti): Promise<void> {
  if (!config.posta.acikMi) {
    throw new PostaHatasi('E-posta gönderimi bu sunucuda ayarlı değil');
  }
  await tasiyiciyiAl().sendMail({
    from: `"${config.uygulamaAdi}" <${config.posta.gonderen}>`,
    to: ileti.kime,
    subject: ileti.konu,
    text: ileti.metin,
    html: ileti.html,
  });
}

/** Baglantiyi acilista bir kez dener; yanlis ayari uretimde erken gorelim. */
export async function postayiDogrula(): Promise<boolean> {
  if (!config.posta.acikMi) {
    kayit.uyari('SMTP ayarlanmamis — parola sifirlama kapali');
    return false;
  }
  try {
    await tasiyiciyiAl().verify();
    kayit.bilgi(`SMTP hazir (${config.posta.sunucu})`);
    return true;
  } catch (hata) {
    // Sunucuyu DUSURMUYORUZ: oyun e-postasiz da oynanir.
    kayit.hata('SMTP dogrulanamadi — parola sifirlama calismayacak', hata);
    return false;
  }
}

const kacis = (metin: string): string =>
  metin.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function parolaKoduGonder(eposta: string, kod: string, ad: string): Promise<void> {
  const dakika = Math.round(config.parolaSifirlama.omruMs / 60_000);
  const konu = `${config.uygulamaAdi} — parola sıfırlama kodun`;

  const metin = [
    `Merhaba ${ad},`,
    '',
    `${config.uygulamaAdi} hesabının parolasını sıfırlamak için kodun:`,
    '',
    `    ${kod}`,
    '',
    `Kod ${dakika} dakika geçerli.`,
    '',
    'Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; parolan değişmez.',
  ].join('\n');

  const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0b2739;color:#e9f3f8;padding:28px">
  <div style="max-width:440px;margin:0 auto;background:#0d2f40;border:1px solid #1d5872;border-radius:10px;padding:22px">
    <div style="color:#f2c14e;font-size:26px;font-weight:800;letter-spacing:5px">KÜT</div>
    <p style="margin:16px 0 6px">Merhaba ${kacis(ad)},</p>
    <p style="margin:0 0 14px;color:#7fa8bd;font-size:14px">Parolanı sıfırlamak için kodun:</p>
    <div style="font-size:30px;font-weight:800;letter-spacing:8px;color:#f2c14e;background:#071c2a;border-radius:8px;padding:14px;text-align:center">${kacis(kod)}</div>
    <p style="margin:14px 0 0;color:#7fa8bd;font-size:13px">Kod ${dakika} dakika geçerli.</p>
    <p style="margin:10px 0 0;color:#7fa8bd;font-size:12px">Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; parolan değişmez.</p>
  </div>
</div>`.trim();

  await gonder({ kime: eposta, konu, metin, html });
}

/** Hesap silindiginde onay — App Store 5.1.1(v) icin iz birakiyor. */
export async function hesapSilindiBildir(eposta: string, ad: string): Promise<void> {
  if (!config.posta.acikMi) return;
  const konu = `${config.uygulamaAdi} — hesabın silindi`;
  const metin = [
    `Merhaba ${ad},`,
    '',
    `${config.uygulamaAdi} hesabın ve hesabına bağlı bilgiler silindi.`,
    'Bu işlem geri alınamaz. Yeniden oynamak istersen yeni bir hesap açabilirsin.',
  ].join('\n');
  try {
    await gonder({ kime: eposta, konu, metin, html: `<pre>${kacis(metin)}</pre>` });
  } catch (hata) {
    // Silme ISLEMI zaten yapildi; bildirim gitmediyse oyuncuyu ilgilendirmez.
    kayit.uyari('Hesap silme bildirimi gonderilemedi', hata);
  }
}
