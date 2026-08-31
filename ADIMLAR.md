# Yayına çıkış — adım adım

Sırayla yap. Her adımın sonunda **kontrol** satırı var; o geçmeden sonrakine
geçme.

`ALANADIN.COM` yazan her yeri kendi alan adınla değiştir.

---

## 1. Hostinger — DNS

hPanel → **Alan adları** → alan adın → **DNS / Nameservers**

Yeni kayıt ekle:

| Tür | Ad | İçerik | TTL |
|---|---|---|---|
| A | `@` | VPS'inin IP adresi | 300 |

**Kontrol:** `dig +short ALANADIN.COM` VPS'in IP'sini yazmalı.
(Yayılması 5 dk–1 saat sürebilir. Bu bitmeden 6. adıma geçme, Let's Encrypt
sertifika veremez.)

---

## 2. Hostinger — e-posta hesabı

**Bu adım yapıldı** — `info@küt.com` posta kutusu açıldı, sunucu bilgileri
`.env` ve `packages/server/.env`'e yazıldı:

```
Giden (SMTP) : smtp.hostinger.com : 465 (SSL)
Gelen (IMAP) : imap.hostinger.com  — uygulama e-posta OKUMUYOR, kullanılmıyor
```

`SMTP_SIFRE` de girildi ve **gerçek gönderim test edildi**: kayıt açıp
`/api/kimlik/parola-unuttum` çağrıldı, e-posta IMAP'ten okunarak INBOX'ta
doğrulandı.

Kullanıcı adı **punycode formda** yazıldı (`info@xn--kt-xka.com`), `info@küt.com`
değil: SMTP AUTH ham bir dize gönderiyor, tarayıcı gibi otomatik IDNA çevirisi
yapmıyor. Doğru çıktı — Hostinger mail kutusunu DNS'teki gibi ASCII/punycode
adla tanıyor, Unicode formla kimlik doğrulaması muhtemelen reddederdi.

**Sıfırdan kuruyorsan:** hPanel → **E-postalar** → **E-posta hesapları** →
**Hesap oluştur** → `info@ALANADIN.COM` (ya da tercih ettiğin başka bir ad) →
şifreyi bir yere kaydet.

**Kontrol:** webmail'e (`https://mail.hostinger.com`) o adresle girebiliyorsan tamam.

---

## 3. Uygulamaya sunucu adresini yaz — 2 dosya

**Bu adım zaten yapıldı.** Alan adı `küt.com` — Unicode (ü) içerdiği için
ağ üzerinde her zaman punycode hâli (`xn--kt-xka.com`) gidiyor; ikisi de
`sunucu.ts` ve `eas.json`'a bu ASCII formuyla yazıldı.

Sıfırdan kuruyorsan aynı iki dosya:

### `apps/mobile/src/ag/sunucu.ts`

`VARSAYILAN` satırını bul, değiştir. Alan adında `ü/ş/ç` gibi bir harf varsa
önce punycode'a çevir (`python3 -c "print('domainin'.encode('idna').decode())"`),
düz ASCII bir alan adıysa doğrudan yaz:

```ts
const VARSAYILAN = 'https://ALANADIN.COM';
```

### `apps/mobile/eas.json`

`preview` ve `production` içindeki iki satırı değiştir:

```json
"env": { "EXPO_PUBLIC_SUNUCU_URL": "https://ALANADIN.COM" }
```

**Kontrol:** `grep -rn "kut.alanadin.com" apps/mobile/` hiçbir şey döndürmemeli.

---

## 4. Uygulama kimliğini kendine göre ayarla — 1 dosya

**Bu adım zaten yapıldı** — `com.kut.mobile` seçildi ve `apps/mobile/app.json`'a
yazıldı. **Bir daha değiştirme**, App Store'da bu kalıcı.

Sıfırdan kuruyorsan:

### `apps/mobile/app.json`

`bundleIdentifier` ve `package` şu an `dev.kut.mobile`. Kendi ters alan adını
yaz (App Store'da bir daha değiştirilemez, şimdi karar ver):

```json
"ios":     { "bundleIdentifier": "com.ALANADIN.kut", ... }
"android": { "package": "com.ALANADIN.kut", ... }
```

---

## 5. Üretim `.env` dosyasını hazırla

**Bu adım zaten yapıldı** — kök dizinde `.env` duruyor, `MONGO_URI` alanı
`packages/server/.env`'dekiyle **aynı** Atlas bağlantı dizesini taşıyor
(hangi veritabanına yazılacağını `NODE_ENV` ayırıyor, ikisi asla karışmaz —
bkz. `MIMARI.md` "Nerede barındırılır"). `JWT_GIZLI` ise development'takinden
**farklı**, ayrıca üretildi.

Doldurulması gereken tek şey `TODO` yazan üç satır — alan adını Hostinger'da
bağladıktan sonra:

```bash
grep -n TODO .env
```

```
ALAN_ADI=ALANADIN.COM
ACME_EPOSTA=sen@ALANADIN.COM
SMTP_SIFRE=<2. adımdaki şifre>
```

(`DESTEK_EPOSTA`, `SMTP_SUNUCU`, `SMTP_KULLANICI`, `SMTP_GONDEREN` zaten
`info@xn--kt-xka.com` ve `smtp.hostinger.com` ile dolduruldu — bkz. §2.)

> `JWT_GIZLI`'yi bir daha **değiştirme**. Değiştirdiğin an bütün oyuncular
> oturumdan düşer.

**Sıfırdan kuruyorsan** (yeni bir makinede, bu `.env` yoksa): Atlas'ta cluster
yoksa önce onu aç (`DAGITIM.md` §4'teki kutucuk), sonra:

```bash
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # JWT_GIZLI
```

**Kontrol:** `.env` dosyası `git status`'ta görünmemeli (`.gitignore`'da).

---

## 6. GitHub'a gönder

```bash
git init && git add -A && git commit -m "Küt — online oyun, hesap ve moderasyon"
```

```bash
git remote add origin git@github.com:KULLANICI/kut.git && git push -u origin main
```

**Kontrol:** GitHub'da `.env` **görünmemeli**, `.env.example` görünmeli.

---

## 7. VPS — kurulum

VPS'e bağlan (`ssh root@IP`), sırayla:

```bash
apt update && apt upgrade -y && curl -fsSL https://get.docker.com | sh
```

```bash
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

```bash
git clone https://github.com/KULLANICI/kut.git /opt/kut && cd /opt/kut
```

Şimdi `.env`'i VPS'e taşı. En kolayı kendi makinenden:

```bash
scp .env root@VPS_IP:/opt/kut/.env
```

---

## 8. VPS — başlat

```bash
cd /opt/kut && docker compose up -d --build
```

İlk derleme 3–5 dakika sürer.

```bash
docker compose logs -f sunucu
```

Şu üç satırı görmelisin:

```
MongoDB baglandi (veritabani: production)
SMTP hazir (smtp.hostinger.com)
Küt sunucusu 4000 portunda (production)
```

`MongoDB baglandi` gelmiyorsa Atlas → **Network Access**'te VPS'in IP'si
yoktur (ya da `0.0.0.0/0` eklemedin) — `DAGITIM.md` §8'e bak.

`SMTP dogrulanamadi` yazıyorsa `.env`'deki SMTP değerleri yanlış — düzelt ve
`docker compose up -d` ile yeniden başlat.

**Kontrol:**

```bash
curl https://ALANADIN.COM/api/saglik
```

`{"ok":true,...}` dönmeli. Sertifika hatası alırsan 1. adımdaki DNS henüz
yayılmamıştır; 10 dakika bekle, `docker compose restart traefik`.

Tarayıcıda da aç, ikisi de açılmalı:
`https://ALANADIN.COM/gizlilik` · `https://ALANADIN.COM/destek`

---

## 9. Uygulamayı derle ve TestFlight'a yolla

```bash
cd apps/mobile && corepack pnpm dlx eas-cli login
```

```bash
corepack pnpm dlx eas-cli build --platform ios --profile production
```

```bash
corepack pnpm dlx eas-cli submit --platform ios --latest
```

**Kontrol:** App Store Connect → uygulaman → TestFlight'ta yapı görünmeli
(işlenmesi 10–30 dk).

---

## 10. App Store Connect — doldurulacak alanlar

### Mağaza metinleri (Türkçe — asıl oyuncu kitlesi burada arama yapıyor)

**Promotional Text** (170 karakter sınırı):
```
Okey taşlarıyla 4 kişilik klasik Küt keyfi — gerçek zamanlı, ücretsiz, reklamsız. Masa kur, arkadaşlarını davet et, hemen oyna!
```

**Description** (4000 karakter sınırı):
```
Küt (Americano), okey taşlarıyla oynanan, dört kişilik ve on altı turluk klasik bir masa oyunudur. Bu uygulama Küt'ü tamamen online ve gerçek zamanlı oynatır — sunucu otoritesindedir, herkes aynı anda aynı masada oturur.

NASIL OYNANIR

Bir sırası gelen desteden ya da yerdeki atık yığınından taş çeker, elindeki taşlarla kut (aynı sayı, farklı renk) ya da seri (aynı renk, ardışık sayı) kurup yere indirir, sonra bir taş atar. Amaç elindeki taşları en düşük puanla bitirmek; on altı turun sonunda en düşük toplam puana sahip oyuncu kazanır.

ÇEVRİMİÇİ OYNAMANIN YOLLARI

• Hızlı Oyna — kod bilmeden, dört kişi dolana kadar bekleyen açık bir masaya otur
• Masa Aç — dört haneli bir kod üret, arkadaşlarına söyle
• Kodla Katıl — arkadaşının kurduğu masaya kodla katıl
• Alıştırma — üç yapay rakiple, çevrimdışı, tek başına pratik yap

MİSAFİR OLARAK HEMEN BAŞLA

Hesap açmadan, tek dokunuşla "Misafir Olarak Oyna" ile oyuna gir. İstersen sonra e-posta ile hesap açabilirsin; ilerlemen kaybolmaz, aynı hesapla başka bir telefondan da girebilirsin.

BAĞLANTIN KOPARSA OYUN DURMAZ

Sıran geldiğinde bağlantın kopmuşsa sunucu senin yerine makul bir hamle yapar; geri bağlandığında kaldığın yere, aynı elle devam edersin. Kimse senin yüzünden beklemez.

ADİL OYUN

Rahatsız edici bir oyuncuyu masadan bildirebilir, bir daha karşına çıkmaması için engelleyebilirsin.

ÜCRETSİZ, REKLAMSIZ

Uygulama tamamen ücretsizdir. Reklam yoktur, uygulama içi satın alma yoktur, gerçek parayla hiçbir işlem yapılmaz.

Dört arkadaş, on altı tur, tek kazanan. Masanı kur, taşları dağıt.
```

**Keywords** (100 karakter sınırı):
```
okey,küt,americano,taş oyunu,masa oyunu,online,çok oyunculu,4 kişilik,arkadaşla oyna,türk oyunu
```

> **Dil kararı:** Mağaza metinleri Türkçe — oyun kültürel olarak Türk okey/kut
> oyunu, gerçek oyuncu kitlesi Türkiye App Store'unda Türkçe arama yapacak.
> App Review Notes (aşağıda) ayrı: yalnızca Apple'ın inceleme ekibi görüyor,
> o yüzden İngilizce.

### Support URL / Marketing URL

| Alan | Değer | Not |
|---|---|---|
| Support URL | `https://küt.com/destek` | Zorunlu — App Store sayfasında herkese görünür |
| Marketing URL | *(boş bırak)* | İsteğe bağlı; ayrı bir tanıtım sitesi yoksa doldurmaya gerek yok |

### Copyright

```
© 2026 Arda Salvarlılar
```

Apple Developer hesabındaki adınla birebir eşleştir (build loglarında
"Arda Salvarlilar" — ı'sız — görünüyordu; hesabındaki tam adı kontrol et).

### App Review Information — Sign-In Required

**"Sign-in required" checkbox'ını KALDIR** — uygulama hesap istemiyor,
misafir modu birincil giriş yolu. Kaldırınca demo kullanıcı adı/şifre
alanları kayboluyor.

**Notes** alanına (4000 karakter sınırı, İngilizce):
```
SIGN-IN: NOT REQUIRED

Please uncheck "Sign-in required" in this section — the app does not require an account. Tap "MİSAFİR OLARAK OYNA" (Play as Guest) on the first screen to enter immediately with an anonymous device-linked account. This is the primary, always-available way to access every feature, including full gameplay.

An optional email+password account also exists (for playing across devices), but it is not needed to review the app.

HOW TO TEST THE GAME SOLO

Küt is a 4-player game and requires four seats to be filled before a hand starts. Since a reviewer is testing alone, we added a dedicated offline mode: from the lobby, tap "ALIŞTIRMA" (Practice). This starts a full hand immediately against three local computer-controlled opponents, with no server connection needed. This is the fastest way to see complete gameplay: drawing tiles, forming melds (sets/runs), discarding, and scoring across a hand.

If you'd like to test real-time online multiplayer instead, tap "HIZLI OYNA" (Quick Play) or "MASA AÇ" (Create Table); a hand starts automatically once 4 players are seated. Reaching 4 real online players during review may not be possible — the Practice mode above is the intended way to evaluate core gameplay in isolation.

GUIDELINE 5.1.1(v) — ACCOUNT DELETION

From the lobby: HESAP (Account) → "HESABIMI SİL" (Delete My Account) → confirm. This permanently deletes the account and personal data (see privacy policy link below for exactly what is deleted vs. retained).

GUIDELINE 1.2 — USER-GENERATED CONTENT MODERATION

The only free-text user content is the display name, which is filtered server-side against offensive terms at signup/rename time. During a multiplayer match: AYARLAR (Settings) → next to any other player → BİLDİR (Report, with a reason) or ENGELLE (Block, mutual — you will not be matched with that player again).

NO GAMBLING, NO IAP, NO ADS

There is no real-money gambling, no purchasable/tradable virtual currency, and no in-app purchases or advertising of any kind. Scoring is purely a traditional tile-game point count, not a casino mechanic.

LINKS

Privacy Policy: https://küt.com/gizlilik
Terms of Use: https://küt.com/kosullar
Support: https://küt.com/destek
Account deletion details: https://küt.com/hesap-sil

Contact for any question during review: info@küt.com
```

**Uygulama Bilgileri**

| Alan | Değer |
|---|---|
| Gizlilik Politikası URL | `https://ALANADIN.COM/gizlilik` |
| Kategori | Oyunlar → Kart / Tahta |

**Sürüm Bilgileri → Uygulama İncelemesi Bilgileri**

| Alan | Değer |
|---|---|
| Destek URL | `https://ALANADIN.COM/destek` |
| İletişim e-postası | `info@ALANADIN.COM` |
| Demo hesabı | **gerekmez** — "Misafir olarak oyna" ile giriş var |

**Notlar** kutusuna şunu yaz (bu önemli, ret riskini düşürür):

```
Oyun 4 kişiliktir ve online oynanır. İnceleme sırasında masada başka oyuncu
olmayabileceği için lobide "ALIŞTIRMA" seçeneği vardır: üç yer tutucu
oyuncuyla, sunucuya bağlanmadan tam bir el oynanabilir.

Giriş için hesap gerekmez, "MİSAFİR OLARAK OYNA" tek dokunuşla girer.

Hesap silme: Lobi → HESAP → Hesabımı sil.
Oyuncu bildirme/engelleme: masada AYARLAR → oyuncunun yanındaki BİLDİR / ENGELLE.
```

### Yaş Sınırı anketi (Age Rating)

2023'ten beri anket eskisinden çok daha ayrıntılı — her kategori için
ayrı soru geliyor. Küt'te hepsinin cevabı **"Yok"/"Hayır"**:

| Kategori | Cevap | Gerekçe |
|---|---|---|
| Çizgi/Fantastik Şiddet | Yok | — |
| Gerçekçi Şiddet | Yok | — |
| Uzun/Sadistik Gerçekçi Şiddet | Yok | — |
| Cinsel İçerik / Nudite | Yok | — |
| Küfür / Kaba Mizah | Yok | Sohbet yok; tek serbest metin görünen ad, sunucu tarafında filtreleniyor (`adFiltresi.ts`) |
| Alkol/Tütün/Uyuşturucu | Yok | — |
| Olgun/Müstehcen Temalar | Yok | — |
| Korku/Gerilim Temaları | Yok | — |
| Tıbbi/Tedavi Bilgisi | Yok | — |
| **Simüle Edilmiş Kumar** | **Yok** | Gerçek para yok, jeton paraya çevrilemez, hiçbir kazanç nakde dönmüyor — kural motoru yalnızca puan hesaplıyor (KURALLAR.md §8), kumar mekaniği (slot/rulet/bahis) içermiyor |
| Yarışmalar (Contests) | Hayır | Ödüllü yarışma/çekiliş yok |
| Sınırsız Web Erişimi | Hayır | Uygulama içi tarayıcı yok |
| Loot Box / Rastgele Satın Alma | Hayır | Uygulama içi satın alma hiç yok |

Hepsi "Yok/Hayır" olduğu için hesaplanan sınıf **4+** çıkmalı — form seni
otomatik oraya götürecek, elle bir yaş seçmiyorsun.

### Kullanıcı Üretimi İçerik gereksinimleri (Guideline 1.2)

Apple, hesap açılabilen ve kullanıcıdan serbest metin gelen (burada: görünen
ad) her uygulamada şunların **hepsini** istiyor — dördü de zaten yazılı kodda:

| Gereksinim | Nerede |
|---|---|
| Uygunsuz içeriği süzme | `adFiltresi.ts` — küfür, rakamla gizleme, "admin/destek" taklidi |
| Bildirme yolu | Masada AYARLAR → oyuncunun yanında BİLDİR |
| Engelleme yolu | Masada AYARLAR → ENGELLE (çift yönlü, `moderasyonServisi.ts`) |
| Yayınlanmış iletişim adresi | `/destek` sayfası + `info@ALANADIN.COM` |

İncelemede bunlardan biri sorulursa yukarıdaki tabloyla cevapla.

### App Privacy (Gizlilik Etiketleri) — "Veri topluyoruz" de, sonra:

| Apple kategorisi | Karşılığı | Toplanıyor mu | Kimliğe bağlı mı | Takip için mi | Amaç |
|---|---|---|---|---|---|
| Contact Info → Email Address | E-posta adresi | Evet | Evet | Hayır | Uygulama İşlevselliği |
| Identifiers → User ID | Hesap kimliği (misafir cihaz kimliği dahil) | Evet | Evet | Hayır | Uygulama İşlevselliği |
| User Content → Other User Content | Görünen ad | Evet | Evet | Hayır | Uygulama İşlevselliği |
| User Content → Gameplay Content | El kayıtları (tohum+hamleler), maç puanları | Evet | Evet | Hayır | Uygulama İşlevselliği |

**Diğer her kategoriyi "Yok" işaretle** — Konum, Sağlık, Finansal/Ödeme,
Rehber, Tarama Geçmişi, Arama Geçmişi, Fotoğraf/Video/Ses, Tanılama
(crash/analytics — hiç SDK entegre değil), Kullanım Verisi, Reklam Verisi,
Satın Alma Geçmişi — hiçbiri toplanmıyor.

Misafir cihaz kimliği "Device ID" değil "User ID" olarak işaretleniyor:
donanımdan türetilmiyor (IDFA/IDFV değil), uygulamanın kendi ürettiği
rastgele bir dize — işlevsel olarak bir hesap kimliği.

### Diğer sorular

| Soru | Cevap |
|---|---|
| Advertising Identifier (IDFA) kullanıyor musun? | Hayır |
| Üçüncü parti içerik gösteriyor musun? | Hayır |
| İhracat uyumluluğu (encryption) | Sorulmayacak — `app.json`'da `ITSAppUsesNonExemptEncryption: false` |
| AB Trader Status (Digital Services Act) | Hesap türü "Individual" — "Ticari satıcı değilim / bireysel geliştiriciyim" seç |

### Son kontrol

VPS + DNS ayakta olduktan sonra, formu doldurmadan **önce** tarayıcıda aç,
dördü de gerçekten görünmeli (Apple incelemecisi bu linklere tıklıyor):

```
https://ALANADIN.COM/gizlilik
https://ALANADIN.COM/kosullar
https://ALANADIN.COM/destek
https://ALANADIN.COM/hesap-sil
```

---

## 11. Arkadaşlarını ekle

App Store Connect → TestFlight → **Harici Test** (ya da 100 kişiye kadar
**Dahili Test**) → e-postalarını ekle.

Harici testte Apple kısa bir inceleme yapar (birkaç saat). Dahili testte
beklemezsin ama kişiler App Store Connect'te tanımlı olmalı.

---

## Güncelleme yaparken

Sunucu:

```bash
cd /opt/kut && git pull && docker compose up -d --build
```

> Sunucu yeniden başlarken **devam eden eller kesilir** (canlı oyun durumu
> bellekte). Kimse oynamıyorken güncelle.

Uygulama:

```bash
cd apps/mobile && corepack pnpm dlx eas-cli build --platform ios --profile production && corepack pnpm dlx eas-cli submit --platform ios --latest
```

`buildNumber` kendiliğinden artar (`eas.json` → `autoIncrement`).

---

## Bir şey ters giderse

| Belirti | Bak |
|---|---|
| Sertifika hatası | `docker compose logs traefik \| grep -i acme` — DNS yayılmış mı, 80 portu açık mı |
| Sunucu sürekli yeniden başlıyor | `docker compose logs sunucu \| head -30` — eksik `.env` değeri adıyla yazar |
| Mongo'ya bağlanamıyor | Atlas → **Network Access**'te VPS'in IP'si (ya da `0.0.0.0/0`) yok mu — `DAGITIM.md` §8 |
| Parola e-postası gelmiyor | `docker compose logs sunucu \| grep SMTP` · Hostinger'da o posta kutusunun şifresi doğru mu |
| Uygulama "sunucuya bağlanılamadı" diyor | `sunucu.ts`'teki `VARSAYILAN` ve `eas.json`'daki `EXPO_PUBLIC_SUNUCU_URL` doğru mu |
| "Zaten bir masadasın" | Sunucuyu yeniden başlat; açılışta yarım masaları temizler |

Daha ayrıntılı sorun giderme: `DAGITIM.md` §8.
