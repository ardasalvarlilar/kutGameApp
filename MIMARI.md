# Küt — Online Mimarisi

> **Online çalışıyor.** `packages/server` (Express + Socket.io + MongoDB) ve
> `apps/mobile/src/ag/` birbirine bağlı: hesap açma, oda kodu, hızlı eşleşme,
> sıra sayacı, kopan bağlantıda koltuğu koruma ve el kaydı ayakta.
> Uçtan uca soket testi `packages/server/test/cevrimici.test.ts`.
>
> Kural kararları buraya yazılmaz — onların yeri `KURALLAR.md`.

---

## 0. Bugün elimizde ne var

Kritik nokta: **motor zaten sunucuya hazır.** `CLAUDE.md`'deki tasarım
kuralları tam olarak bunun için kondu ve karşılığını burada veriyor.

| Kural | Online için ne demek |
|---|---|
| Saf indirgeyici | Sunucu `reduce(state, action)` çağırır, başka hiçbir şey yapmaz |
| Motorda rastgelelik yok | Tohum sunucuda üretilir; el, aksiyon listesinden **yeniden kurulabilir** |
| Gizli bilgi projeksiyonla | `viewFor(state, oyuncu)` her istemciye ayrı üretilir; kimse fazlasını görmez |
| Geçersiz hamle sonuçtur | `{ok:false, reason}` doğrudan istemciye iletilir, sunucu çökmez |
| Zaman dışarıdan | `suAn` parametresi sunucunun saatiyle dolar |

`apps/mobile/src/oyun.ts` bilerek "sunucu taklidi" olarak yazılmıştı ve
tahmin tuttu: online'a geçerken ekranın **tek satır oyun mantığı**
değişmedi. Değişen şey, `Masa.tsx`'in artık `useOyun`u doğrudan çağırmak
yerine bir **sürücü** alması oldu (`src/surucu.ts`):

| Sürücü | Motor nerede koşuyor |
|---|---|
| `src/oyun.ts` (`useOyun`) | Cihazda — geliştirme ve `bot-simulasyon.test.ts` için |
| `src/ag/cevrimiciOyun.ts` (`useCevrimiciMasa`) | Sunucuda — asıl oyun |

Bunun mümkün olmasının sebebi motor kuralı #3: ekran zaten tam durumu değil
`viewFor` projeksiyonunu okuyordu. Arayüzü ona daraltınca çevrimiçi sürücü
hiçbir ekran kodunu değiştirmeden yerine geçebildi.

Tek gerçek uyarlama `TAŞLARI İŞLE` idi: eskiden her adımda tam durumu okuyup
sıradaki taşı yerleştiriyordu. Çevrimiçi oyunda o durum istemcide yok, bu
yüzden plan artık yalnızca görünümden çıkarılıyor (`src/islemePlani.ts`,
saf ve testli).

**İyimser gösterim yok.** İstemci `reduce` çalıştıramaz — rakiplerin ıstakası
gizli olduğu için tam durumu hiçbir zaman görmüyor. Gecikme bir gidiş-dönüş
kadar; mobil veride 30–80 ms, oyunun temposunda fark edilmiyor.

---

## 1. Genel şekil

```
  Telefon (Expo)                    Sunucu (Node)
  ┌──────────────┐                 ┌────────────────────────┐
  │ ekran        │                 │ oda yöneticisi         │
  │ src/oyun.ts  │ ──aksiyon────▶  │  ├ @kut/engine reduce  │
  │ (soket)      │ ◀──görünüm───   │  ├ viewFor(oyuncu)     │
  └──────────────┘   Socket.io     │  └ süre sayacı         │
                                   └────────────────────────┘
                                              │
                                     ┌────────┴────────┐
                                     │ MongoDB         │
                                     │ oyuncular       │
                                     │ masalar         │
                                     │ elKayitlari     │
                                     └─────────────────┘
```

**Sunucu otoriterdir.** İstemci hiçbir zaman "şu oldu" demez, "şunu yapmak
istiyorum" der. Karar motorundur, motor sunucudadır. İstemcideki motor
kopyası yalnızca **iyimser gösterim** ve doğrulama için kalır.

### Neden Socket.io

`CLAUDE.md` zaten Socket.io diyor, doğru seçim:

- Otomatik yeniden bağlanma — mobilde şart (tünel, asansör, uygulama arkaya
  alınıp geri gelme)
- Oda (room) kavramı hazır: bir masa = bir oda
- WebSocket kurulamayan ağlarda HTTP long-polling'e düşer
- Olay tabanlı API, `{ tip, ... }` aksiyonlarımıza birebir oturur

Ham `ws` daha hafif ama yeniden bağlanma, oda ve fallback'i elle yazmak
gerekir. Bu oyunun ölçeğinde Socket.io'nun maliyeti ihmal edilebilir.

---

## 2. Protokol

Aksiyon tipleri **zaten var** (`packages/engine/src/aksiyonlar.ts`). Protokol
onların üstüne ince bir zarf ekler.

### İstemci → sunucu

| Olay | İçerik |
|---|---|
| `masa:benim` | `{}` → `{ masa \| null }` — "hangi masadayım?" |
| `masa:kur` | `{ ozel? }` → `{ masa }` |
| `masa:katil` | `{ kod }` → `{ masa }` |
| `masa:hizli` | `{}` → `{ masa }` — açık masaya otur, yoksa aç |
| `masa:cik` | `{}` |
| `masa:hazir` | `{ hazir: boolean }` |
| `oyun:aksiyon` | `{ aksiyon: Aksiyon, hamleNo: number }` |

`masa:benim` yeniden bağlanmanın tamamı: istemci her `connect` olayında bunu
soruyor, sunucu masayı, kişisel görünümü ve süre sayacını geri yolluyor.
Ayrı bir "yeniden katıl" akışı yok — tek uç yetiyor.

Hepsi Socket.io **acknowledgement** ile cevaplanır:
`{ ok: true, veri }` ya da `{ ok: false, hata }`. Motorun 4 numaralı kuralı
("geçersiz hamle istisna değil, sonuçtur") ağ katmanına da taşındı.

### Sunucu → istemci

| Olay | İçerik |
|---|---|
| `masa:durum` | Koltuklar, kimin hazır olduğu, kimin bağlı olduğu |
| `masa:ayrildi` | `{ sebep }` — sunucu masadan çıkardı |
| `oyun:gorunum` | `viewFor` çıktısı + `hamleNo` — **kişiye özel** |
| `oyun:hata` | `{ reason: HataKodu, hamleNo }` — yalnızca hamleyi yapana |
| `oyun:sure` | `{ siradaki, bitisZamani, sure, sunucuZamani }` |
| `oyun:elSonu` | `{ sonuc, masa, macKazananlari, sonrakiElSn }` |

`oyun:sure` içindeki **`sunucuZamani`** olmadan geri sayım güvenilmez olurdu:
`bitisZamani` sunucu saatine göre. Telefonun saati birkaç dakika ileri ya da
geriyse süre ya hemen dolmuş ya hiç bitmeyecek gibi görünürdü. İstemci farkı
alıp kendi ofsetini düzeltiyor.

`oyun:gorunum` masaya değil, oyuncunun **kişisel odasına** gider
(`oyuncu:<id>`). Tek bir ortak yayın yapılamaz: `viewFor` gizli bilgiyi
ayıklıyor, herkese aynı paketi göndermek rakiplerin ıstakasını sızdırırdı.

**`hamleNo`** iki işi birden görür: aynı aksiyonun iki kez işlenmesini
engeller (yeniden bağlanmada tekrar gönderim olur) ve istemcinin hangi
görünümün hangi hamleye ait olduğunu bilmesini sağlar.

**Görünüm mü, olay mı gönderelim?** Başlangıçta **tam görünüm** gönderin.
Bir `viewFor` çıktısı birkaç KB; 4 oyunculu bir masada hamle başına ~4 mesaj.
Delta göndermek erken optimizasyon olur ve senkron hatalarının en sinsi
kaynağıdır. Ölçüp gerekirse sonra bakılır.

### Süre sunucuda

`ayarlar.siraSureleriMs` (KURALLAR.md §9 0.4/0.7) sunucuda sayılıyor
(`soket/masaOturumu.ts`); istemci yalnızca `bitisZamani`'nı alıp geri sayımı
çizer. Böylece yavaş telefon ya da geri alınmış saat oyunu bozamıyor.

Süre dolunca oyuncunun yerine oynanır — kurtarma **faza uygun** olmak
zorunda: çekme fazında "at" demek motorca reddedilir ve sıra kilitlenir.
Karar `soket/yerineOyna.ts`'te, saf ve testli.

> **Not.** `apps/mobile/src/sure.ts` + `bot.ts` aynı işi tek oyunculu mod
> için yapıyor. Bugün iki ayrı kopya; sunucu otorite olduğu için fark oyunu
> bozmuyor ama ideal değil. İleride ortak bir `packages/politika` paketine
> çıkarılmalı.

Saat farkı için: sunucu her süre paketinde `sunucuZamani`'nı da gönderir,
istemci farkı alıp ofsetini düzeltir. Ayrı bir `ping/pong` turu gerekmedi —
bilgi zaten gönderilen pakette.

---

## 3. Kopan bağlantı

Mobil oyunda **en kritik** konu bu; baştan çözülmeli.

- Oda state'i sunucunun belleğinde durur; oyuncu düşerse koltuğu **boşalmaz**,
  `bagli: false` olur.
- Sırası gelen bağlı değilse süre normal işler ve dolunca `sureDolduAksiyonu`
  onun yerine oynar. Oyun durmaz.
- Geri bağlanan oyuncu `masa:benim` ile aynı koltuğa oturur, tam görünümü ve
  süre sayacını alır. Motor deterministik olduğu için ek bir kurtarma
  mantığı gerekmez.
- **Masadan çıkmak da koltuğu boşaltmıyor** — ama yalnızca oyun başladıysa.
  Dört koltuk dolu olmadan motor ilerleyemez; çıkan biri masayı kilitlerdi.
  Bekleyen masada çıkış koltuğu gerçekten boşaltır.
- İki soketle aynı hesap: `disconnect` gelince sunucu oyuncunun **başka açık
  soketi var mı** diye bakıyor. Bakmasaydı uygulamayı yeniden yükleyen
  oyuncu bir an "kopuk" görünürdü.
- Sunucu yeniden başlarsa canlı durum gider (bellekte). Açılışta
  `yarimMasalariKapat()` yarım masaları kapatır. Bu **şart**: temizlenmezse
  oyuncular "zaten bir masadasın" hatasıyla bir daha hiçbir masaya oturamaz.
  El kayıtları silinmez.
  İleride `elKayitlari.tohum + aksiyonlar` ile el birebir geri kurulabilir
  (motor kuralı #2 tam olarak bunu mümkün kılıyor); bugün yapılmıyor.

---

## 4. Hesap ve giriş

### Yazılan: misafir + e-posta, ikisi de aynı belgeye

```
1. Uygulama açılır  → giriş ekranı
2. "MİSAFİR OLARAK OYNA" → cihaz kimliğiyle anonim hesap, tek dokunuş
3. "HESAP AÇ" → e-posta + parola; misafirken açılırsa AYNI belgenin üstüne biner
```

Misafir yolu bilerek önde ve tek dokunuş: kayıt ekranı, oyuncu daha oyunu
görmeden gelen bir engeldir.

Yükseltmenin ilerlemeyi koruması önemli. Uygulama kayıt isteğine cihaz
kimliğini de ekliyor; sunucu o cihazın misafir belgesini bulup üstüne
e-postayı yazıyor (`kimlikServisi.kayitOl`). Yeni belge açılmıyor, oynanan
eller kaybolmuyor. Oturumu açık misafir için ayrıca `POST /api/kimlik/yukselt`
var.

Bir belge **yalnızca bir kez** yükseltilebilir: hesap açılmış bir belgeye
ikinci bir e-posta bağlamak, cihazı eline geçirenin hesabı ele geçirmesine
giden yol olurdu. Testi `test/kimlik.test.ts`te.

### Hangi sağlayıcı

| Yöntem | Durum | Neden |
|---|---|---|
| **Misafir** | ✅ yazıldı | Engelsiz başlangıç; cihaz kimliğine bağlı |
| **E-posta + parola** | ✅ yazıldı | Aynı hesapla ikinci telefondan girebilmek için — asıl istenen buydu |
| **Google** | ⏳ sonra | Android'de zaten oturum açık, tek dokunuş |
| **Apple ile Giriş** | ⏳ Google ile BİRLİKTE | App Store kuralı: başka bir **sosyal** giriş sunarsan Apple'ı da sunmalısın. E-posta+parola tek başına bu kuralı tetiklemez |
| **Facebook** | ❌ Önermem | Onay süreci ağır, veri yükümlülüğü fazla |
| **Instagram** | ❌ Mümkün değil | Giriş sağlayıcısı değildir |

> **Karar değişikliği.** Bu belge önce e-posta+parolayı "sonraya" bırakıyordu
> (şifre sıfırlama, doğrulama maili, sızıntı riski). Karar değişti: arkadaşlar
> aynı hesapla iki cihazdan girmek istiyor ve Google/Apple akışı App Store
> teslimini geciktiriyordu.

### Parola sıfırlama

Altı haneli kod, 15 dakika, en fazla 5 deneme (`config.parolaSifirlama`).

**Bağlantı değil kod**, çünkü e-postadaki bağlantıdan uygulamaya dönmek derin
bağlantı (universal link) kurmayı gerektiriyor: `apple-app-site-association`
dosyası, alan adı doğrulaması, App Store'da ayrı yapılandırma. Kod her
istemcide aynı şekilde çalışıyor ve bugün elimizde olan şey bir tek alan adı.

Kodun kendisi değil **özeti** saklanıyor (bcrypt): veritabanı yedeği sızarsa
kod tek başına hesabın anahtarı olurdu. `deneme` sayacı kaba kuvvete karşı —
altı haneli bir kod, sınırsız denemeyle bir dakikada kırılır.

Gönderim `nodemailer` + SMTP (Hostinger). Ayar **isteğe bağlı**: SMTP yoksa
sunucu yine açılır ve yalnızca sıfırlama çalışmaz. E-posta ayarı eksik diye
bütün oyunun ayağa kalkmaması saçma olurdu.

Parola tarafında yazılanlar:

- bcrypt (10 tur), ham parola hiçbir yerde durmuyor; alan `select: false`
- "e-posta yok" ile "parola yanlış" **aynı mesajı** döner — hangi adreslerin
  kayıtlı olduğu deneme yanılmayla öğrenilemesin
- kayıtsız adreste de bcrypt çalıştırılıyor: yanıt süresinden hesabın var
  olup olmadığı anlaşılmasın
- giriş uçlarında oran sınırı: 15 dakikada 20 deneme
  (`araKatman/oranSiniri.ts`)

### Veri modeli (asgari)

Yazılan koleksiyonlar (`packages/server/src/modeller/`):

| Koleksiyon | Ne tutar |
|---|---|
| `oyuncular` | ad, `eposta`, `parolaOzeti`, `saglayicilar[]`, `cuzdan`, `ilerleme` |
| `masalar` | kod, sahip, koltuklar, tur, maç puanları, `giris` (jeton) |
| `elKayitlari` | `tohum`, `baslayan`, `aksiyonlar[]`, `sonuc` |

`saglayicilar` bir **dizi**: misafir hesabı silinmeden üstüne Google/Apple
eklenir, oyuncu ilerlemesini kaybetmez.

`elKayitlari.tohum + aksiyonlar` sayesinde herhangi bir el **birebir geri
oynatılabilir**. Hata ayıklama, "hile mi yaptı" tartışması ve tekrar izleme
bu tek kayıttan çıkar — motor kuralı #2'nin ikinci getirisi.

**Canlı oyun durumu Mongo'da DEĞİL**, sunucunun belleğinde
(`servisler/oyunServisi.ts`). Saniyede birkaç kez değişen bir şeyi her
seferinde yazmak hem gereksiz hem yavaş; kalıcı olması gereken şey el kaydı.

---

## 5. Aynı Wi‑Fi'de oynamak

Bunu **ikinci yol** olarak düşünmeni öneririm, birinci değil.

Cihaz keşfi (mDNS/Bonjour) mobilde sorunlu: iOS 14+ yerel ağ izni ister,
kurumsal ve misafir Wi‑Fi ağlarında cihazlar arası trafik çoğu zaman kapalı
(AP isolation), Android üreticileri farklı davranır. "Aynı Wi‑Fi'dekileri
otomatik bul" özelliği sık sık boş liste gösterir — ve boş liste, bozuk bir
özellik gibi hissettirir.

**Daha sağlam ve daha basit alternatif: oda kodu.**

```
Sen:        MASA AÇ  →  kod: 4F7A
Arkadaşın:  MASA BUL →  4F7A yaz
```

Bu yol aynı odada da, farklı şehirde de aynı şekilde çalışır; öğrenmesi
kolaydır ve hiçbir ağ iznine ihtiyaç duymaz. Kod alfabesinde karışabilecek
harfler yok (`0/O`, `1/I/L` çıkarıldı) — telefonda sesli söylenebilsin diye. İnternet olmadan oynamak
gerçekten gerekiyorsa, sonradan "yerel sunucu modu" eklenebilir: bir telefon
sunucuyu kendi üstünde çalıştırır, diğerleri IP ile bağlanır. Ama bunu
**ilk sürüme koyma** — kazancı az, bakım maliyeti yüksek.

---

## 5.5 Jeton ekonomisi — MVP'de YOK, altyapı hazır

Karar: **jeton MVP'ye girmiyor.** Şemalarda alanları duruyor
(`oyuncu.cuzdan`, `oyuncu.ilerleme`, `masa.giris`) ama hiçbir yerde
okunmuyor. Sebep, alanları sonradan eklemenin üzerinde veri olan bir
koleksiyonda göç işi çıkarması.

Neden şimdi değil:

1. **Mağaza kuralları.** iOS ve Android'de dijital mal satışı kendi ödeme
   sistemlerinden geçmek zorunda — komisyon %15–30. Kendi ödeme sağlayıcını
   koyamazsın; koyarsan uygulama mağazadan kalkar.
2. **Hukuki ayrım.** Jeton **gerçek paraya çevrilemez** olmalı. Okey 101 Plus
   dahil bütün "sosyal casino" oyunlarının modeli bu. Kazanılan jeton nakde
   dönüyorsa oyun kumar mevzuatına girer; hem mağazadan kalkarsın hem ciddi
   yasal risk alırsın. Şema bunu `cuzdan.jeton` yorumunda not ediyor.
3. **Sıra meselesi.** MVP'nin cevaplaması gereken soru "insanlar bunu oynuyor
   mu?" — ödeme akışı o cevabı vermiyor, sadece geciktiriyor.

Eklendiğinde gerekecekler: `IAP` doğrulama ucu (Apple/Google makbuzu sunucuda
doğrulanır, istemciye güvenilmez), `jetonHareketi` koleksiyonu (her artış ve
azalış kayıtlı olmalı — destek ve itiraz için), masa girişinde bakiye kontrolü
ve el sonunda dağıtım. Seviye/deneyim `oyuncu.ilerleme`de zaten duruyor.

---

## 6. Önerilen sıra

Her adım kendi başına çalışır durumda bırakır; yarım kalırsa oyun bozulmaz.

| # | Adım | Durum |
|---|---|---|
| 1 | `packages/server`: Socket.io + oda + motor + süre + el kaydı | **bitti** |
| 2 | Misafir girişi (JWT), kopma/geri bağlanma | **bitti** |
| 3 | E-posta + parola ile hesap; misafiri yükseltme | **bitti** |
| 4 | `apps/mobile/src/ag/`: soket sürücüsü, `Masa`nın sürücüden ayrılması | **bitti** |
| 5 | Giriş / lobi / bekleme odası ekranları, hızlı eşleşme | **bitti** |
| 6 | Parola sıfırlama (SMTP), hesap silme, şikâyet/engelleme | **bitti** |
| 7 | Google + Apple girişi | sonra |
| 8 | Arkadaş listesi, davet | sonra |
| 9 | Jeton ekonomisi (§5.5) | sonra |

7. adım bugün **gerekmiyor**: Apple'ın "Sign in with Apple" şartı yalnızca
başka bir **sosyal** giriş (Google, Facebook…) sunan uygulamalar için. Sadece
e-posta+parola bu kuralı tetiklemiyor. Google girişi eklendiği gün Apple
girişi de aynı sürümde eklenmeli.

---

## 6.5 App Store denetimi — nelerin karşılığı var

| Guideline | İstenen | Kod |
|---|---|---|
| 2.1 / 4.2 | Denetçi uygulamanın ne olduğunu görebilmeli | Lobide `ALIŞTIRMA` — çevrimdışı, üç yer tutucuyla tam bir el |
| 5.1.1(v) | Hesap **uygulama içinden** silinebilmeli | `DELETE /api/kimlik/hesap` · Lobi → HESAP → Hesabımı sil |
| 1.2 | Uygunsuz içeriği süz, şikâyet et, engelle | `adFiltresi.ts` · `Sikayet` · `engellenenler` |
| 5.1.1 | Gizlilik politikası ulaşılabilir olmalı | `/gizlilik` — giriş ve hesap ekranından bağlantılı |
| 5.1.2 | Takip yok beyanı | Reklam kimliği hiç okunmuyor; ATT izni istemiyoruz |

**2.1 en kritik olanı ve gerekçesi ince.** "Online-only oyun reddedilir"
diye bir kural yok — Okey 101 Plus da online. Fark, o oyunun her an binlerce
kişisinin çevrimiçi olması: denetçi masaya oturur oturmaz oyun başlıyor. Yeni
bir uygulamada kimse yok; denetçi boş bir masada bekler ve gördüğü şey
"çalışmayan uygulama" olur. `ALIŞTIRMA` tam bu boşluğu kapatıyor.

**5.1.1(v) pazarlığa açık değil.** Hesap açmaya izin veren her uygulama, o
hesabın uygulama içinden silinmesine de izin vermek zorunda. "Bize e-posta
at" kabul edilmiyor.

**1.2'nin bu oyundaki karşılığı ince:** sohbet yok, yani kullanıcıdan gelen
tek serbest metin **görünen ad**. Taciz kanalı da odur. Bu yüzden süzme
adın üzerinde (`adFiltresi.ts`), şikâyet ve engelleme ise masadaki oyuncular
üzerinde.

Engelleme **çift yönlü** bakılıyor: tek yönlü olsaydı taciz eden kişi
engellendiğini fark edip yeni bir masa açarak yine karşısına çıkabilirdi.

### Canlı Mongo ile doğrulama

Veritabanına ve sokete dokunan yollar artık **testli**: `test/kimlik.test.ts`
ve `test/cevrimici.test.ts` gerçek Mongo ve gerçek Socket.io ile koşuyor
(dört istemci, el başlatma, görünüm mahremiyeti, başkasının adına hamle,
kopup geri gelme). Mongo yoksa bu iki dosya atlanır:

```bash
docker run -d --name kut-mongo -p 27017:27017 mongo:7
pnpm --filter @kut/server test
```

Elle bakmak istersen: 

```bash
# 1. Sunucu ayakta mı
curl localhost:4000/api/saglik

# 2. Misafir girişi — jeton dönmeli
curl -X POST localhost:4000/api/kimlik/misafir \
  -H 'content-type: application/json' \
  -d '{"cihazKimligi":"deneme-cihaz-1"}'

# 3. Aynı cihaz kimliği AYNI oyuncuyu dönmeli (yeni hesap açmamalı)
#    → ikinci çağrıda dönen oyuncu.id birincisiyle aynı olmalı

# 4. Jetonla kendini doğrula
curl localhost:4000/api/kimlik/ben -H "authorization: Bearer <jeton>"
```

Soket tarafını elle denemek için dört istemci gerekiyor. Tarayıcıda dört
sekme açmak İŞE YARAMAZ: jeton `localStorage`da duruyor ve aynı köken
(origin) dört sekmede aynı hesabı verir. Pratik yol, bir sekmeyi kendin
oynayıp kalan üç koltuğu küçük bir betikle doldurmak (misafir girişi →
`masa:katil` → `oyun:gorunum` geldikçe çek/at).

Koltuklar `hazir: true` başlıyor: dördüncü oyuncu oturduğu anda el dağıtılır.
Fikri değişen `masa:hazir` ile geri alabilir.

### Nerede barındırılır

Hetzner VPS + Docker. `packages/server/Dockerfile` iki aşamalı: mobil
uygulamanın kodları imaja **girmez**, çalışan imaj yalnızca `dist/index.js`
içerir (~65 KB; `@kut/engine` bundle'ın içinde).

Docker istemiyorsan `pnpm --filter @kut/server build` çıktısını de
gönderebilirsin — `dist/` + `.env` yeterli, `node dist/index.js` ile çalışır.
Üretimde `node_modules` bile gerekmiyor.

Önüne bir ters vekil (Caddy ya da nginx) koy: TLS ve WebSocket yükseltmesi
oradan geçsin. Süreç yöneticisi olarak systemd ya da `docker compose
restart: always` yeter.

Oyun state'i bellekte durduğu için **yatay ölçeklemede dikkat**: aynı odanın
bütün oyuncuları aynı sürece düşmeli (sticky session ya da Socket.io'nun
Redis adapter'ı). Tek süreçle başla — bir VPS binlerce eşzamanlı masayı
rahat taşır.

**Veritabanı VPS'te değil, MongoDB Atlas'ta.** `docker-compose.yml` bir zamanlar
kendi Mongo konteynerini de kaldırıyordu; kaldırıldı. Gerekçe: bu ölçekte
kendi Mongo'nu barındırmanın getirisi yok (yedekleme, güncelleme, izleme hepsi
elle), Atlas'ın ücretsiz katmanı yeterli ve VPS'in belleği/diski sunucu
sürecine kalıyor. Development ve production **aynı cluster'ı, aynı
`MONGO_URI`'yi** paylaşıyor — ayrımı `NODE_ENV` yapıyor
(`packages/server/src/veritabani.ts`, `dbName` seçeneği): development ortamı
"development" veritabanına yazar, production "production"a. İkisi asla
karışmaz çünkü Mongo düzeyinde tamamen ayrı koleksiyon kümeleri.

---

## 7. Bu belge güncellenmeli

Adımlar tamamlandıkça bu doküman da güncellenir. Bir karar değişirse tek
yerde döner — tıpkı `KURALLAR.md` gibi.
