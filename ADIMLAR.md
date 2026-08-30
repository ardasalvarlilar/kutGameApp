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

**Yaş Sınırı** anketinde:

- "Simüle Edilmiş Kumar" → **Yok**
  (oyunda gerçek para ve paraya çevrilebilen jeton yok)
- Diğer hepsi → Yok

**App Privacy (Gizlilik Etiketleri)** → "Veri topluyoruz" de, sonra:

| Veri | Toplanıyor mu | Kimliğe bağlı mı | Takip için mi |
|---|---|---|---|
| E-posta adresi | Evet — Uygulama İşlevselliği | Evet | Hayır |
| Kullanıcı Kimliği | Evet — Uygulama İşlevselliği | Evet | Hayır |
| Kullanıcı İçeriği (görünen ad) | Evet — Uygulama İşlevselliği | Evet | Hayır |

Başka hiçbir kutuyu işaretleme. Reklam kimliği, konum, rehber, kullanım
verisi — hiçbiri toplanmıyor.

**İhracat uyumluluğu:** soru sorulmayacak; `app.json` içinde
`ITSAppUsesNonExemptEncryption: false` var.

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
