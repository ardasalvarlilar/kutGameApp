# Küt — VPS'e dağıtım

> **Sırayla ne yapacağını arıyorsan `ADIMLAR.md`'ye bak** — DNS'ten App
> Store'a kadar kontrol listesi. Bu belge *neden* öyle olduğunu anlatıyor.

Hedef: VPS'e girip **tek komut** çalıştırmak.

```bash
docker compose up -d --build
```

Sunucu ve TLS sertifikası ayağa kalkar. Veritabanı ayrı — MongoDB Atlas'ta,
buluttadır — ona sadece bağlanılıyor. Aşağısı buna kadar olan yolu anlatıyor.

---

## Özet: hangi klasör nereye gidiyor

Kısa cevap: **hiçbir dosyayı elle kopyalamıyorsun.** Depoyu GitHub'a
gönderiyorsun, VPS'te `git clone` yapıyorsun, `docker compose` gerisini
hallediyor.

Derlemeyi yerelde alıp göndermene gerek yok — `--build` bunu VPS'te yapıyor.
Mobil uygulamanın kodları depoda duruyor ama **sunucu imajına girmiyor**;
`.dockerignore` ve Dockerfile bunu garantiliyor (aşağıda doğrulaması var).

---

## 1. Alan adı

Bir A kaydı aç, VPS'in IP'sine baksın:

```
kut.alanadin.com    A    <VPS_IP>
```

Bunu **önce** yap. Let's Encrypt sertifikayı ancak DNS doğru gösterirse
verir; hazır olmadan başlatırsan Traefik boşuna deneyip
[limite](https://letsencrypt.org/docs/rate-limits/) yaklaşır.

Yayıldığını doğrula:

```bash
dig +short kut.alanadin.com     # VPS'in IP'sini yazmalı
```

---

## 2. VPS hazırlığı

Hetzner'de Ubuntu 24.04 yeterli. En küçük paket (CX22 / 2 vCPU / 4 GB) bu
oyun için fazlasıyla yeter.

```bash
ssh root@<VPS_IP>

# Sistem
apt update && apt upgrade -y

# Docker (resmi kurulum betiği)
curl -fsSL https://get.docker.com | sh

# Kök kullanıcıyla çalışma: kendine bir kullanıcı aç
adduser kut
usermod -aG docker,sudo kut
```

### Güvenlik duvarı

Yalnızca üç port açık kalsın:

```bash
ufw allow OpenSSH
ufw allow 80/tcp      # Let's Encrypt HTTP doğrulaması için ZORUNLU
ufw allow 443/tcp
ufw enable
```

27017'yi açmana zaten gerek yok — Mongo bu VPS'te çalışmıyor, Atlas'ta.
Onun erişim kontrolü kendi panelinde: Atlas → Network Access.

---

## 3. Depoyu GitHub'a gönder

Yerelde, proje kökünde:

```bash
git init                      # zaten depo değilse
git add .
git commit -m "Küt: motor, mobil ve sunucu"

gh repo create kut --private --source=. --push
# ya da GitHub'da depo açıp:
# git remote add origin git@github.com:<kullanici>/kut.git
# git push -u origin main
```

**`.env` git'e girmez** — `.gitignore` engelliyor. Gizli değerler yalnızca
VPS'te duracak. Doğrula:

```bash
git status --porcelain | grep -c "^.. \.env$"    # 0 yazmalı
```

---

## 4. VPS'te çek ve başlat

```bash
ssh kut@<VPS_IP>
git clone git@github.com:<kullanici>/kut.git
cd kut

cp .env.example .env
nano .env
```

Doldurulacaklar:

| Değişken | Ne yazılacak |
|---|---|
| `ALAN_ADI` | `kut.alanadin.com` — **başında `https://` yok** |
| `ACME_EPOSTA` | Sertifika uyarılarının gideceği adres |
| `MONGO_URI` | Atlas bağlantı dizesi — bkz. aşağıda |
| `JWT_GIZLI` | Aşağıdaki komut |
| `JWT_OMRU` | `30d` |
| `CORS_KAYNAKLARI` | Boş bırak (mobilde tarayıcı kaynağı yok) |

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
# Node yoksa: openssl rand -base64 48
```

**Veritabanı VPS'te DEĞİL, MongoDB Atlas'ta.** `docker-compose.yml` kendi
Mongo konteynerini kaldırmıyor — bu ölçekte kendi Mongo'nu barındırmanın
getirisi yok, Atlas'ın ücretsiz katmanı yeterli. `MONGO_URI`, geliştirmede
kullandığın (`packages/server/.env`) URI ile **birebir aynı** olabilir:
hangi veritabanına yazılacağını `NODE_ENV` belirliyor
(`packages/server/src/veritabani.ts`, `dbName` seçeneği) — bu dosyada zaten
`NODE_ENV=production` sabit, yani development'takiyle asla karışmaz.

Atlas'ta henüz cluster yoksa: [Atlas'a](https://cloud.mongodb.com) ücretsiz
kaydol → **M0 (Free)** cluster aç → **Database Access**'ten bir kullanıcı
oluştur → **Network Access**'ten `0.0.0.0/0`'ı izin ver (VPS'in IP'si sabit
değilse pratik olan bu; sabitse yalnızca o IP'yi ekle) → **Connect →
Drivers**'tan bağlantı dizesini kopyala.

Sonra:

```bash
docker compose up -d --build
```

İlk derleme birkaç dakika sürer; sonrakiler önbellekten hızlı gelir.

---

## 5. Çalıştığını doğrula

```bash
docker compose ps
```

İkisi de `healthy` olmalı:

```
kut-sunucu    Up (healthy)
kut-traefik   Up (healthy)
```

`kut-sunucu` loglarında `MongoDB baglandi (veritabani: production)` satırını
gör — bağlanamıyorsa Atlas'ın **Network Access** listesinde VPS'in IP'si yok
demektir (§8'e bak).

Sonra dışarıdan:

```bash
curl https://kut.alanadin.com/api/saglik
# {"ok":true,"veri":{"ayakta":true,...}}
```

`-k` olmadan çalışıyorsa sertifika alınmış demektir.

Misafir girişini de dene — bu Mongo'ya yazan ilk yol:

```bash
curl -X POST https://kut.alanadin.com/api/kimlik/misafir \
  -H 'content-type: application/json' \
  -d '{"cihazKimligi":"deneme-cihaz-1"}'
```

Aynı komutu **ikinci kez** çalıştır: dönen `oyuncu.id` birincisiyle **aynı**
olmalı. Farklıysa her açılışta yeni hesap açılıyor demektir.

### Sunucu dışarı kapalı mı

```bash
docker compose ps --format "{{.Name}} -> {{.Ports}}"
```

Yalnızca `kut-traefik` satırında `0.0.0.0:80` ve `0.0.0.0:443` görünmeli.
`kut-sunucu` yalnızca iç port göstermeli (`4000/tcp`) — host bağlantısı
olmamalı. (Mongo zaten VPS'te değil, Atlas'ta; onun erişimini Atlas'ın
**Network Access** listesi kontrol ediyor.)

---

## 6. Güncelleme

Yerelde çalış, gönder; VPS'te çek ve yeniden kur:

```bash
# yerelde
git add . && git commit -m "..." && git push

# VPS'te
cd kut
git pull
docker compose up -d --build
```

Yalnızca değişen servis yeniden kurulur. Veritabanı zaten Atlas'ta durduğu
için güncelleme sunucu konteynerini etkilemez — veri hiçbir zaman VPS'in
diskinde olmadı.

---

## 7. Günlük işler

```bash
docker compose logs -f sunucu        # canlı log
docker compose logs --tail=100 traefik
docker compose restart sunucu
docker compose down                  # durdur (veri durur)
docker compose down -v               # DIKKAT: volume'leri de siler, veri gider
```

### Veritabanı yedeği

**Atlas'ın ücretsiz (M0) katmanında otomatik yedek YOK** — bu yalnızca M10 ve
üstü ücretli cluster'larda geliyor. M0'dayken yedeği kendin almalısın.

Mongo artık bir konteyner değil, `docker compose exec` işe yaramaz. Doğrudan
Atlas URI'sine `mongodump` çalıştır — VPS'te de yerelinde de olur, ikisi de
aynı ağdan (internet) bağlanıyor:

```bash
mongodump --uri "$MONGO_URI" --archive --gzip > yedek-$(date +%F).gz
```

Geri yükleme:

```bash
mongorestore --uri "$MONGO_URI" --archive --gzip < yedek-2026-08-29.gz
```

`mongodump`/`mongorestore` yoksa: `brew install mongodb-database-tools`
(Mac) ya da `apt install mongodb-database-tools` (VPS). Bunu bir cron'a
bağla; Atlas'ın cluster'ı silinirse ya da yanlışlıkla veri bozulursa tek
koruman bu. Cluster M10'a yükseltirsen Atlas'ın kendi sürekli yedeklemesini
(Continuous Cloud Backup) açman, bu elle işi gereksiz kılar.

---

## 8. Sık karşılaşılanlar

**Sertifika gelmiyor / tarayıcı uyarı veriyor**

```bash
docker compose logs traefik | grep -i acme
```

En sık üç sebep: DNS henüz yayılmamış, 80 portu kapalı (`ufw status`), ya da
`ALAN_ADI`'nda `https://` veya sonda `/` var.

**`sunucu` sürekli yeniden başlıyor**

```bash
docker compose logs sunucu | head -30
```

Ortam değişkeni eksikse sunucu ne olduğunu yazıp durur — `JWT_GIZLI` 32
karakterden kısaysa açılmaz, bu bilerek böyle.

**Mongo'ya bağlanamıyor (Atlas)**

```bash
docker compose logs sunucu | grep -i mongo
```

En sık üç sebep:
- **Network Access.** Atlas → Network Access listesinde VPS'in IP'si yok.
  En pratik çözüm `0.0.0.0/0` eklemek (VPS'in IP'si sabit değilse zaten tek
  seçenek); güvenlik istersen yalnızca VPS'in IP'sini ekle.
- **Yanlış kullanıcı/şifre.** Atlas → Database Access'te kullanıcının
  şifresini görmüyorsun, yalnızca sıfırlayabiliyorsun — `.env`'deki
  `MONGO_URI` içindeki şifreyle Atlas'takini karşılaştıramazsın, şüpheliysen
  Atlas'tan yeni şifre üret ve `.env`'i güncelle.
- **Cluster duraklamış.** Ücretsiz cluster uzun süre kullanılmazsa Atlas onu
  otomatik duraklatabilir; panelden "Resume" demen gerekir.

**Traefik "Provider error" veriyor**

Traefik sürümü Docker API'sinden eskidir. `docker-compose.yml`'deki
`traefik:v3.7` etiketini güncelle.

---

## 9. Mobil uygulamaya sunucu adresini vermek

`.env`'deki `ALAN_ADI` yalnızca **sunucu** tarafını ilgilendiriyor. Uygulama
adresi kendi içinde taşır ve derleme anında gömülür.

Adres iki yerden okunuyor, sırayla:

1. `EXPO_PUBLIC_SUNUCU_URL` ortam değişkeni
2. `apps/mobile/src/ag/sunucu.ts` içindeki `VARSAYILAN`

Mağazaya gidecek derleme için **2. yolu kullan** — dosyadaki `VARSAYILAN`
satırını kendi alan adınla değiştir:

```ts
const VARSAYILAN = 'https://kut.alanadin.com';
```

`EXPO_PUBLIC_` öneki şart: Expo yalnızca bu önekli değişkenleri istemci
paketine gömer. Öneksiz yazılan bir değişken telefonda `undefined` gelir ve
uygulama "sunucuya bağlanılamadı" der — sebebi de görünmez.

Socket.io aynı kökten `wss://`'e kendisi yükseltir; ayrı bir port ya da yol
gerekmez. Traefik `Upgrade` başlığını kendiliğinden geçirdiği için ek ayar da
yok.

### Yerelde denerken

```
# apps/mobile/.env.local
EXPO_PUBLIC_SUNUCU_URL=http://192.168.1.20:4000
```

Telefondan (Expo Go) denerken **`localhost` işe yaramaz**: telefon kendi
localhost'una bakar. Makinenin yerel IP'sini yaz (`ipconfig getifaddr en0`).

Tarayıcı önizlemesinde `http://localhost:4000` yeterli; sunucunun
`CORS_KAYNAKLARI` değişkenine önizleme adresini eklemeyi unutma. Mobil
uygulamada tarayıcı kaynağı olmadığı için üretimde bu değişken boş
kalabilir.

---

## 10. TestFlight'a çıkarken

Mağaza incelemesi sürerken arkadaşlarını test kullanıcısı olarak eklemek için
sırayla:

```bash
# 1. Sunucu ayakta ve sertifikası geçerli mi
curl https://kut.alanadin.com/api/saglik

# 2. Uygulamadaki VARSAYILAN adresi kendi alan adına çevir
#    apps/mobile/src/ag/sunucu.ts

# 3. Derleme ve yükleme (EAS hesabı gerekir)
cd apps/mobile
pnpm dlx eas-cli build --platform ios --profile production
pnpm dlx eas-cli submit --platform ios
```

Dikkat edilecek üç şey:

- **`JWT_GIZLI`'yi bir daha değiştirme.** Değiştirdiğin an bütün oyuncular
  oturumdan düşer ve yeniden giriş yapmak zorunda kalır.
- **Sunucuyu güncellerken oyun kesilir.** Yeniden başlayan sunucu yarım
  masaları kapatır (canlı durum bellekte). Kimse oynamıyorken güncelle.
- **Dört oyuncu gerekiyor.** Masa dört koltuk dolmadan başlamaz; bot yok.
  Arkadaşların aynı anda çevrimiçi olmalı.
