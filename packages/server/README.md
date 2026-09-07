# @kut/server

Küt'ün otoriter oyun sunucusu. Express + Socket.io + MongoDB.

Mimari kararlar ve gerekçeleri `../../MIMARI.md` dosyasında.

## Çalıştırma

```bash
cp .env.example .env      # değerleri doldur
pnpm --filter @kut/server dev
```

`dev` betiği `tsx watch` kullanır; kaydettiğin an yeniden başlar.

## Ortam değişkenleri

Hepsi `src/config.ts`'ten geçer. **Hiçbir dosya `process.env`e doğrudan
bakmaz** — yeni bir değişken eklerken tek yapılacak şey oraya bir satır
eklemek. Eksik ya da bozuk değer varsa sunucu ayağa kalkmadan, ne yapılması
gerektiğini söyleyerek durur.

`JWT_GIZLI` için üretimde mutlaka yeni bir anahtar üret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## Yeniden başlatma ve yarım masalar

Canlı oyun durumu **bellekte** (`servisler/oyunServisi.ts`). Sunucu yeniden
başlayınca o durum gider; Mongo'da `oynaniyor` kalan masa artık geri
kurulamaz. Bu yüzden açılışta `yarimMasalariKapat()` çalışır ve onları
kapatır. Şart: temizlenmezse oyuncular "zaten bir masadasın" hatasıyla bir
daha hiçbir masaya oturamaz. El kayıtları silinmez.

Kapanışta sıra da önemli — önce soketler, sonra HTTP, en son Mongo. Ters
sırada, düşen soketlerin `disconnect` işleyicileri kapanmış bir bağlantıya
sorgu atıp süreci düşürüyordu.

## Üretim derlemesi

```bash
pnpm --filter @kut/server build
```

`dist/index.js` tek dosya çıkar (~65 KB) ve `@kut/engine` bundle'ın içindedir.
Yani VPS'e yalnızca şunlar gider:

```
dist/index.js
dist/index.js.map
.env
```

Mobil uygulamanın kodları sunucuya **hiç gitmez**.

## Katmanlar

| Klasör | İş |
|---|---|
| `config.ts` | Bütün ortam değişkenleri; tek kaynak |
| `modeller/` | Mongoose şemaları |
| `servisler/` | İş mantığı — Express'ten ve soketten bağımsız |
| `denetleyiciler/` | HTTP isteğini servise bağlar |
| `rotalar/` | REST uçları |
| `araKatman/` | Kimlik doğrulama, hata yakalama |
| `soket/` | Canlı oyun: oda, oturum, süre sayacı |
| `tipler/protokol.ts` | İstemci–sunucu sözleşmesi |

## Uçlar

| Yöntem | Yol | İş |
|---|---|---|
| GET | `/api/saglik` | Ayakta mı |
| POST | `/api/kimlik/misafir` | Cihaz kimliğiyle anonim giriş → jeton |
| POST | `/api/kimlik/kayit` | E-posta + parola ile hesap aç |
| POST | `/api/kimlik/giris` | E-posta + parola ile giriş |
| POST | `/api/kimlik/parola-unuttum` | Sıfırlama kodu ister (e-posta) |
| POST | `/api/kimlik/parola-sifirla` | Kod + yeni parola → oturum açar |
| POST | `/api/kimlik/yukselt` | Oturumu açık misafiri hesaba çevirir (jeton ister) |
| POST | `/api/kimlik/ad` | Görünen adı değiştir (jeton ister) |
| POST | `/api/kimlik/parola` | Parolayı değiştir — **mevcut parola zorunlu** |
| GET | `/api/kimlik/ben` | Jetonun sahibi |
| DELETE | `/api/kimlik/hesap` | **Hesabı siler** (App Store 5.1.1(v)) |
| POST | `/api/moderasyon/sikayet` | Oyuncuyu bildir |
| POST | `/api/moderasyon/engelle` | Oyuncuyu engelle |
| POST | `/api/moderasyon/engel-kaldir` | Engeli kaldır |
| GET | `/api/moderasyon/engellenenler` | Engel listesi |
| GET | `/api/arkadas` | Arkadaşlar + gelen/giden istekler + kendi kodun |
| GET | `/api/arkadas/ara?kod=` | Arkadaş koduyla oyuncu ara |
| POST | `/api/arkadas/istek` | İstek gönder |
| POST | `/api/arkadas/kabul` | Gelen isteği kabul et |
| POST | `/api/arkadas/sil` | İsteği reddet ya da arkadaşlığı bitir |

### Arkadaşlık

Üç karar şeklini belirledi:

- **Çift başına tek belge.** `Arkadaslik` koleksiyonu kimlikleri metin
  sırasına koyup (`kucuk`/`buyuk`) üstüne benzersiz indeks basıyor. İstek
  başına belge, iki kişi aynı anda birbirine istek attığında iki ayrı
  "bekliyor" kaydı bırakıyordu; ikisi de karşı tarafın kabulünü bekliyordu.
  Karşılıklı istek artık doğrudan **arkadaşlık** oluyor.
- **Arama yalnızca arkadaş koduyla** (`KUT-7F3A9`). Görünen ad benzersiz
  değil; e-postayla aramak ise hangi adreslerin kayıtlı olduğunu sızdırır.
  Kod tembel üretiliyor: ilk `/api/arkadas` çağrısında.
- **Engel arkadaşlığın önüne geçiyor.** Engellenen kişi listede görünmez ve
  ona istek gönderilemez; kodla da bulunamaz. İlişki silinmiyor — engel
  kalkarsa arkadaşlık geri geliyor (App Store 1.2 "geri alabilme").

Bir arkadaşın bekleyen masası varsa kodu listede görünür; katılmak tek
dokunuş. Özelliğin bütün amacı buydu: kodu her oturumda yeniden paylaşmamak.

Ayrıca dört HTML sayfası (`rotalar/sayfalar.ts`), API dışında:
`/gizlilik` · `/kosullar` · `/destek` · `/hesap-sil`. App Store Connect
gizlilik politikası ve destek URL'i istiyor; ikisinin de gerçekten açılması
gerekiyor.

`kayit` isteği cihaz kimliğini de kabul eder: o cihazda misafir olarak
oynanmışsa **aynı belgenin** üstüne e-posta biner, ilerleme kaybolmaz.

Giriş uçlarında oran sınırı var (`araKatman/oranSiniri.ts`): 15 dakikada 20
parola denemesi. Sayaç bellekte, yani süreç başına — çok süreçli kurulumda
Redis'e taşınmalı.

### Masa düzeni (soket)

| Olay | İş |
|---|---|
| `masa:botDoldur` | Boş koltukları botla doldur — yalnızca masayı açan |
| `masa:botCikar` | Bir bot koltuğunu boşalt |
| `masa:koltugaGec` | Boş bir koltuğa geç (atomik) |
| `masa:koltukTalebi` | Dolu koltuk için değiştirme talebi bırak |
| `masa:koltukCevap` | Gelen talebi kabul et / reddet → koltuklar takas olur |

Botu sunucu oynatıyor (`soket/masaOturumu.ts`), kararı `@kut/politika`da —
çevrimdışı masadaki yer tutucularla **aynı kod**. Sıra süresinden ayrı, kısa
bir zamanlayıcı kullanıyor; sıra süresi güvenlik ağı olarak duruyor.

Oyunun kendisi soket üzerinden akar; olay listesi `MIMARI.md §2`de.

## Test

```bash
pnpm --filter @kut/server test
```

Dört dosya:

| Dosya | Mongo | Kapsam |
|---|---|---|
| `oyunServisi.test.ts` | — | Motor kabuğu, süre kademeleri |
| `http.test.ts` | — | Sağlık ucu, jeton, güvenlik başlıkları |
| `adFiltresi.test.ts` | — | Görünen ad denetimi |
| `kimlik.test.ts` | **gerekir** | Kayıt, giriş, misafir yükseltme |
| `hesapYonetimi.test.ts` | **gerekir** | Parola sıfırlama, hesap silme, şikâyet, engelleme |
| `koltukYarisi.test.ts` | **gerekir** | Aynı anda katılan oyuncular ayrı koltuklara oturuyor mu |
| `arkadas.test.ts` | **gerekir** | Kod, istek/kabul/silme, engel kesişimi, parola değiştirme |
| `masaDuzeni.test.ts` | **gerekir** | Bot koltukları (bot gerçekten oynuyor mu), koltuk seçme ve takas |
| `cevrimici.test.ts` | **gerekir** | Dört istemciyle uçtan uca soket akışı |

Mongo yoksa `gerekir` yazanlar **atlanır**. Yerelde, atılabilir bir Mongo
yeter — bu, `.env`'deki geliştirme veritabanından (Atlas) **ayrı**, testler
kendi geçici veritabanlarını burada açıp kapatıyor:

```bash
docker run -d --name kut-mongo -p 27017:27017 mongo:7
```

> Atlama koşulu bilerek modül seviyesinde (`await mongoose.connect(...)`),
> `beforeAll` içinde değil: vitest `it.skipIf` koşulunu **toplama anında**
> okuyor. `beforeAll`da kurulan bayrak o an hâlâ `false` olduğu için bütün
> dosya sessizce atlanır ve testler koşmadığı hâlde yeşil görünürdü.
