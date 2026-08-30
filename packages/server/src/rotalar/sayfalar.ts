// Yasal ve destek sayfalari.
//
// App Store Connect uc URL istiyor ve ucu de CALISAN bir adres olmali:
//
//   Gizlilik Politikasi  → /gizlilik   (zorunlu)
//   Destek URL'i         → /destek     (zorunlu)
//   Kullanim Kosullari   → /kosullar   (zorunlu degil ama denetimi rahatlatir)
//
// Ayri bir site kurmak yerine sunucudan veriliyor: alan adi ve TLS zaten var,
// ikinci bir yerde tutmak "biri guncellenir digeri unutulur" demek.
//
// Sablon degil duz metin: bir sablon motoru eklemek, uc sayfa icin bagimlilik
// ve derleme adimi getirirdi.

import { Router } from 'express';
import { config } from '../config.js';

const GUNCELLEME = '29 Ağustos 2026';

const kacis = (metin: string): string =>
  metin.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function sayfa(baslik: string, govde: string): string {
  const ad = kacis(config.uygulamaAdi);
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${kacis(baslik)} — ${ad}</title>
<style>
  :root { color-scheme: dark; }
  body {
    margin: 0; padding: 32px 20px 64px;
    background: #0b2739; color: #e9f3f8;
    font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  main { max-width: 680px; margin: 0 auto; }
  .marka { color: #f2c14e; font-size: 30px; font-weight: 800; letter-spacing: 7px; }
  h1 { font-size: 24px; margin: 20px 0 4px; }
  h2 { font-size: 17px; margin: 26px 0 6px; color: #f2c14e; }
  p, li { color: #cfe3ee; }
  a { color: #f2c14e; }
  .tarih { color: #7fa8bd; font-size: 13px; margin: 0 0 8px; }
  nav { margin-top: 40px; border-top: 1px solid #1d5872; padding-top: 14px; font-size: 14px; }
  nav a { margin-right: 16px; }
  code { background: #071c2a; padding: 2px 6px; border-radius: 4px; font-size: 14px; }
</style>
</head>
<body>
<main>
  <div class="marka">KÜT</div>
  <h1>${kacis(baslik)}</h1>
  <p class="tarih">Son güncelleme: ${GUNCELLEME}</p>
  ${govde}
  <nav>
    <a href="/gizlilik">Gizlilik</a>
    <a href="/kosullar">Koşullar</a>
    <a href="/destek">Destek</a>
    <a href="/hesap-sil">Hesap silme</a>
  </nav>
</main>
</body>
</html>`;
}

/** Destek adresi ayarlanmadiysa sayfa yine calissin, ama bunu soylesin. */
function destekAdresi(): string {
  return config.destekEposta === ''
    ? 'destek adresi henüz tanımlanmadı'
    : `<a href="mailto:${kacis(config.destekEposta)}">${kacis(config.destekEposta)}</a>`;
}

const GIZLILIK = `
<p>${'Küt'} bir okey oyunudur. Bu sayfa, oyunun hangi bilgileri neden topladığını
ve ne kadar sakladığını anlatır. Sade tutuldu: toplanan şey az.</p>

<h2>Toplananlar</h2>
<ul>
  <li><strong>Görünen ad.</strong> Masada diğer oyuncuların gördüğü ad. Sen seçersin.</li>
  <li><strong>E-posta adresi</strong> — yalnızca hesap açtıysan. Giriş yapmak ve
      parolanı sıfırlamak için kullanılır. Pazarlama e-postası gönderilmez.</li>
  <li><strong>Parola</strong> — düz hâli <em>hiçbir yerde saklanmaz</em>; yalnızca
      geri çevrilemez bir özeti (bcrypt) tutulur.</li>
  <li><strong>Cihaz kimliği</strong> — misafir oynuyorsan. Uygulamanın kendi
      ürettiği rastgele bir metindir; reklam kimliği değildir, cihazın donanım
      numarası değildir ve başka bir uygulamayla paylaşılmaz.</li>
  <li><strong>Oyun kayıtları.</strong> Oynanan eller (dağıtım tohumu ve hamleler),
      maç puanları, oynanan/kazanılan el sayısı.</li>
</ul>

<h2>Toplanmayanlar</h2>
<ul>
  <li>Konum, rehber, fotoğraf, mikrofon, kamera — hiçbirine erişilmez.</li>
  <li>Reklam kimliği ve izleme çerezi yok. Uygulama seni başka uygulamalarda
      veya sitelerde <strong>takip etmez</strong>.</li>
  <li>Ödeme bilgisi alınmaz; uygulama içi satın alma yoktur.</li>
</ul>

<h2>Neden ve ne kadar</h2>
<p>Veriler oyunu çalıştırmak için işlenir: masaya oturmak, sıranı bilmek, puanı
hesaplamak. Oyun kayıtları hata ayıklama ve "hile yapıldı" tartışmalarını
çözmek için tutulur; içlerinde kişisel bilgi yoktur, yalnızca taş dizileri
vardır.</p>
<p>Hesabın açık kaldığı sürece saklanır. Hesabını sildiğinde hesabın ve ona
bağlı kişisel bilgiler kalıcı olarak silinir.</p>

<h2>Paylaşım</h2>
<p>Verilerin üçüncü taraflara satılmaz ve pazarlama amacıyla paylaşılmaz.
Yalnızca oyunun barındırıldığı sunucu sağlayıcısı ve parola sıfırlama
e-postasını ileten posta sağlayıcısı, işi gereği bu verilere teknik olarak
erişebilir.</p>

<h2>Haklarınız</h2>
<p>Hesabını uygulama içinden silebilirsin: <code>HESAP → Hesabımı sil</code>.
Silme geri alınamaz. Verilerinin bir kopyasını istemek ya da başka bir soru
sormak için: ${destekAdresi()}.</p>

<h2>Çocuklar</h2>
<p>Uygulama 13 yaşın altındaki çocuklara yönelik değildir ve bilerek onlardan
veri toplamaz.</p>

<h2>Değişiklikler</h2>
<p>Bu metin değişirse yukarıdaki tarih güncellenir.</p>
`;

const KOSULLAR = `
<h2>Oyun</h2>
<p>Küt, okey taşlarıyla oynanan dört kişilik bir kâğıt oyunudur. Ücretsizdir,
uygulama içi satın alma yoktur.</p>

<h2>Kumar değildir</h2>
<p>Oyunda gerçek para yoktur. Kazanılan hiçbir şey <strong>gerçek paraya
çevrilemez</strong>, başka oyunculara aktarılamaz ve nakde dönüştürülemez.
Oyun yalnızca eğlence amaçlıdır.</p>

<h2>Hesabın</h2>
<p>Hesabının ve parolanın güvenliğinden sen sorumlusun. Görünen adın başkalarını
rahatsız edici, hakaret içeren ya da oyunun görevlisiymişsin izlenimi veren bir
ad olamaz. Böyle adlar engellenir.</p>

<h2>Davranış</h2>
<p>Diğer oyunculara taciz, hakaret ve tehdit yasaktır. Oyunu kasten bozmak
(sürekli süre doldurmak, masayı kilitlemek) da yasaktır.</p>
<p>Rahatsız eden bir oyuncuyu masadaki <strong>BİLDİR</strong> düğmesiyle
bildirebilir, <strong>ENGELLE</strong> ile bir daha karşına çıkmamasını
sağlayabilirsin. Bildirimler incelenir; kural ihlali görülen hesaplar
askıya alınabilir.</p>

<h2>Kesinti</h2>
<p>Oyun "olduğu gibi" sunulur. Sunucu bakımı, güncelleme ya da arıza nedeniyle
kesinti olabilir; devam eden bir el kesilebilir.</p>

<h2>Sorumluluk</h2>
<p>Yasaların izin verdiği ölçüde, oyunun kullanımından doğan dolaylı zararlardan
sorumluluk kabul edilmez.</p>

<h2>İletişim</h2>
<p>${destekAdresi()}</p>
`;

const DESTEK = `
<p>Bir sorun mu var, bir sorun mu buldun? Yaz: ${destekAdresi()}</p>

<h2>Sık sorulanlar</h2>

<h2>Masa başlamıyor</h2>
<p>Bir el ancak dört koltuk dolduğunda dağıtılır. <strong>HIZLI OYNA</strong>
seni açık bir masaya oturtur; kimse yoksa yeni bir masa açar ve beklersin.
Arkadaşlarınla oynayacaksan <strong>MASA AÇ</strong> deyip ekrandaki dört haneli
kodu onlara söyle.</p>

<h2>Bağlantım koptu, elim ne oldu?</h2>
<p>Koltuğun boşalmaz. Sıran geldiğinde süren dolarsa sunucu senin yerine oynar
(destede çeker, işine yaramayan bir taş atar). Geri bağlandığında aynı koltuğa
aynı elle dönersin.</p>

<h2>Parolamı unuttum</h2>
<p>Giriş ekranında <strong>Parolamı unuttum</strong>'a bas. Kayıtlı adresine
altı haneli bir kod gelir; kod 15 dakika geçerlidir.</p>

<h2>Adımı değiştirmek istiyorum</h2>
<p>Lobide <strong>HESAP</strong> → görünen adını yaz → kaydet.</p>

<h2>Hesabımı silmek istiyorum</h2>
<p>Lobide <strong>HESAP</strong> → <strong>Hesabımı sil</strong>. İşlem geri
alınamaz; ayrıntı için <a href="/hesap-sil">hesap silme sayfası</a>.</p>

<h2>Birini bildirmek ya da engellemek istiyorum</h2>
<p>Masada <strong>AYARLAR</strong> → oyuncunun yanındaki
<strong>BİLDİR</strong> / <strong>ENGELLE</strong>. Engellediğin oyuncuyla bir
daha aynı masaya düşmezsin.</p>
`;

const HESAP_SIL = `
<p>Hesabını uygulamanın içinden silebilirsin — ayrı bir form doldurman ya da
bize yazman gerekmez.</p>

<h2>Adımlar</h2>
<ol>
  <li>Uygulamayı aç ve giriş yap.</li>
  <li>Lobide <strong>HESAP</strong>'a bas.</li>
  <li><strong>Hesabımı sil</strong> → onayla.</li>
</ol>

<h2>Ne siliniyor</h2>
<p>Hesabın, görünen adın, e-posta adresin, parola özetin, istatistiklerin ve
engel listen kalıcı olarak silinir. İşlem <strong>geri alınamaz</strong>.</p>

<h2>Ne kalıyor</h2>
<p>Oynanmış ellerin kaydı (dağıtım tohumu ve hamle listesi) kalır. İçinde adın,
e-postan ya da seni tanımlayan başka bir bilgi yoktur — yalnızca taş dizileri
vardır ve artık hiçbir hesaba bağlanmaz. Silinmeleri, o ellerde oynayan diğer
üç oyuncunun maç geçmişini de yok ederdi.</p>

<p>Uygulamaya erişemiyorsan ${destekAdresi()} adresine yaz.</p>
`;

export function sayfalariKur(): Router {
  const rota = Router();
  rota.get('/gizlilik', (_istek, yanit) => yanit.type('html').send(sayfa('Gizlilik Politikası', GIZLILIK)));
  rota.get('/kosullar', (_istek, yanit) => yanit.type('html').send(sayfa('Kullanım Koşulları', KOSULLAR)));
  rota.get('/destek', (_istek, yanit) => yanit.type('html').send(sayfa('Destek', DESTEK)));
  rota.get('/hesap-sil', (_istek, yanit) => yanit.type('html').send(sayfa('Hesap Silme', HESAP_SIL)));
  // Koke gelen bir tarayici bos sayfa gormesin; App Store denetcisi de bazen
  // alan adini dogrudan aciyor.
  rota.get('/', (_istek, yanit) => yanit.redirect('/destek'));
  return rota;
}
