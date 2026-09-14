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
Karar `@kut/politika`da, saf ve testli.

> **Çözüldü.** Bu politika artık `packages/politika`da ve sunucu da aynı
> kodu kullanıyor. Online masaya bot eklenince ikisinin ayrı kalması
> imkânsızlaştı: sunucudaki botla çevrimdışı masadaki botun aynı oynaması
> gerekiyor. `soket/yerineOyna.ts` kaldırıldı.

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
| `oyuncular` | ad, `eposta`, `parolaOzeti`, `saglayicilar[]`, `arkadasKodu`, `cuzdan`, `ilerleme` |
| `masalar` | kod, sahip, koltuklar (bot dahil), koltuk talepleri, tur, maç puanları |
| `elKayitlari` | `tohum`, `baslayan`, `aksiyonlar[]`, `sonuc` |
| `sikayetler` | şikâyet eden, edilen, sebep, o anki ad |
| `arkadasliklar` | `kucuk`, `buyuk`, `isteyen`, `durum` |

**Bot koltuğu.** `koltuklar[].bot` true ise o koltuğu sunucu oynuyor ve
`oyuncu` alanı boştur. Oyun dört oyuncusuz ilerlemiyor (motor dört koltuk
bekliyor) ama dördünün de insan olması gerekmiyor — iki arkadaş toplandıysa
masayı doldurup oynayabilmeli. Botun kararı `@kut/politika`da, çevrimdışı
masadaki yer tutucularla aynı kod; bu paket tam da bunun için ayrıldı
(bkz. §6 notu).

**Koltuk talepleri.** Boş koltuğa geçmek serbest, dolu koltuk oturanın
onayından geçiyor. Kimin nerede oturduğu oyunu değiştirdiği için (attığın taşı
sağındaki alır) bu, tercih edilebilir olmalıydı.

**Arkadaşlık neden ayrı bir koleksiyon.** Engel listesi `oyuncular` içinde bir
dizi ve orada doğru duruyor: engelleme **tek taraflı** bir karar. Arkadaşlık
**iki taraflı** — bir istek var, bir de cevap. Bunu iki belgeye dağıtmak
(A'nın gideni + B'nin geleni) aynı gerçeği iki yerde tutmak demek; biri yazılıp
diğeri yazılamadığında istek tek tarafta asılı kalıyor.

Çift, kimliklerin **metin sırasıyla normalleştiriliyor** (`kucuk` daima
büyüğünden önce) ve `{kucuk, buyuk}` üstünde benzersiz indeks var. İstek başına
belge tutmak yarış açıyordu: iki kişi aynı anda birbirine istek atarsa iki ayrı
"bekliyor" kaydı oluşuyor, ikisi de karşı tarafın kabulünü bekliyordu. Şimdi
ikinci yazma E11000 alıyor ve servis onu arkadaşlığa çeviriyor — ikisi de
istiyorsa ayrıca onay istemek anlamsız. Testi `test/arkadas.test.ts`,
`Promise.all` ile karşılıklı isteği zorluyor.

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

## 5.5 Çip ekonomisi

Her online maç çiple oynanıyor. Kuralların tek kaynağı `packages/ekonomi`
(saf, testli); sunucu uyguluyor, istemci yalnızca gösteriyor.

Para biriminin adı **çip**, jeton değil: "jeton" bu kodda zaten oturum jetonu
(JWT) demek. Eski `cuzdan.jeton` alanı açılışta `cipGocu` ile taşınıyor.

**Kademeler** — maç uzunluğu sabit (16 tur), kademeyi giriş ve seviye ayırıyor:

| Kademe | Giriş | Açıldığı seviye |
|---|---|---|
| Çaylak | 5.000 | 1 |
| Amatör | 15.000 | 3 |
| Tecrübeli | 50.000 | 6 |
| Usta | 150.000 | 10 |
| Profesyonel | 500.000 | 15 |
| Şampiyon | 1.500.000 | 22 |
| Efsane | 5.000.000 | 30 |

Kilit yalnızca **alttan**: seviyen yettiği her kademeye oturursun. Ölçek
bilerek büyük (Okey 101 Plus gibi) — gerçek paradaki karşılığı paketlerde.

**Pot:** masaya oturan her insan girişi koyar, kazanan potu alır, pottan
**%20 masa ücreti** kesilir (QT Okey'de bu oran %37–60). Dört insanlı masada
kazanan girişin 3,2 katını alır. Beraberlikte havuz bölünür.

**Botlar pota girmez.** Girseydi bot çipi sunucunun cebinden basılmış olurdu
ve "üç botla oyna, kazan" çip basmanın yolu olurdu. Bot (ya da masadan kaçanın
yerine geçen bot) kazanırsa payı yanar.

**Giriş el başlarken tahsil ediliyor**, masaya otururken değil: bekleme
odasından kalkana iade gerekmesin. Başlatma tek bir atomik
`findOneAndUpdate` ile kilitleniyor (iki çağrı iki kez tahsil etmesin);
tahsilat "hepsi ya da hiçbiri" — biri ödeyemezse ödeyenlere iade edilir,
ödeyemeyen masadan kalkar, el başlamaz.

**Masadan çıkış:**

- Kendi isteğiyle (AYARLAR → masadan çık) → giriş **yanar**, koltuğu bot
  oynar, ödül ve XP alamaz.
- Bağlantı koparsa → giriş yanmaz. Koltuk duruyor (§3), sunucu yerine
  oynuyor; geri gelip devam eder, kazanırsa potu alır.
- Sunucu maç ortasında kapanırsa → açılışta `yarimMasalariKapat` hâlâ oturan
  ödeyenlere iade eder. Masa önce atomik olarak kapanıyor, iade sonra: iade
  sırasında yine düşerse ikinci kez iade edilmez. Maç sonunda da masa
  `bitti` olarak **ödülden önce** yazılıyor — ödül ile iade ikisi birden
  verilmesin.

**Deneyim ve seviye:** tamamlanan maçta sıraya göre 100 / 75 / 50 / 25 XP.
1→2 100 XP, her atlama 50 XP daha pahalı, en yüksek seviye 100.

**Başlangıç:** yeni hesaba 15.000 çip — Çaylak'ta üç maç. Kazanan devam
ediyor; kazanamayan satın alıyor ya da hediye çip bekliyor.

Başlangıç çipi **cihaz başına bir kez** (`BaslangicHakki`, cihaz kimliğinin
sha256 özeti; oyuncuya bağlı değil, hesap silinince de kalıyor). Hesabını
silip yeniden açan ya da aynı telefonda ikinci e-posta hesabı açan 0 çiple
başlar. Uygulamayı silip kuran ise yeni hesap bile açmıyor: cihaz kimliği
yeniden kurulumda değişmiyor — iOS'ta Keychain uygulama silinse de kalıyor,
Android'de kimlik ANDROID_ID'den türüyor (`ag/depo.ts`). Ekonomiden önce
açılmış misafirler açılışta "almış" sayılıyor (`baslangicHaklariniDoldur`).

**Hediye çip:** uzakta geçen her saat için 100 çip, en fazla 48 saat
(4.800). Bir hafta gelmeyen 16.800 değil 4.800 alır — düzenli gelen daha
çok toplar. Yalnızca tam saatler sayılıyor, artan dakikalar sonraki
toplamaya kalıyor; tavanda fazlası yanıyor. Saat sunucunun; toplama atomik
(`cuzdan.sonHediye` filtreli `findOneAndUpdate`). Lobide açılışta bir kez
pencere çıkıyor (`bilesenler/Hediye.tsx`).

**Ödüllü reklam (altyapı hazır, reklam yok):** her toplamada tek kullanımlık,
30 dakikalık bir `ReklamFisi` kesiliyor (toplanan kadar ek çip = 2 kat).
İstemci reklamı `serverSideVerificationOptions: { userId, customData:
fisKimligi }` ile gösterecek; Google `/api/reklam/admob` ucunu imzalı
çağırıyor, sunucu ECDSA imzasını Google'ın açık anahtarlarıyla doğrulayıp
fişi bozduruyor. Aynı `transaction_id` ikinci kez çip vermiyor. İstemcinin
"izledim" demesi hiçbir şey kazandırmıyor. Eksik olan yalnızca istemcideki
reklam SDK'sı (`src/reklam.ts` — hazır olmadıkça "2 KAT" düğmesi görünmüyor)
ve AdMob konsolunda SSV adresinin girilmesi.

**Defter:** her artış ve azalış `cipHareketleri` koleksiyonunda (destek ve
itiraz için); hesap silinince o da siliniyor.

**Hukuki ayrım:** çip **gerçek paraya çevrilemez**. Okey 101 Plus dahil bütün
"sosyal casino" oyunlarının modeli bu. Kazanılan çip nakde dönüyorsa oyun
kumar mevzuatına girer.

**Satın alma henüz yok.** Paketler (`ekonomi/paketler.ts`, 50 bin çip
39,99 ₺ → 30 milyon 1.199,99 ₺) mağaza ekranında görünüyor ama düğme kapalı.
Gerekenler: App Store Connect / Play Console'da ürün tanımları, istemcide IAP
kütüphanesi (Expo Go'da çalışmaz, dev build ister), sunucuda makbuz doğrulama
ucu (istemciye güvenilmez) ve `satin-alma` sebepli defter kaydı. iOS ve
Android'de dijital mal satışı mağazanın ödeme sisteminden geçmek zorunda —
komisyon %15–30.

**Kalan risk:** cihaz kimliğini istemci gönderiyor; uygulamayı kullanmadan
API'yi elle çağıran biri her istekte yeni bir kimlik uydurup yeni hesap
açabilir. Bunu ancak cihaz doğrulaması kapatır (iOS App Attest, Android Play
Integrity): sunucu, isteğin gerçekten mağazadan kurulmuş uygulamadan
geldiğini kanıtlatır. Kötüye kullanım görülürse sıradaki adım bu.

---

## 5.6 Yönetim paneli

Adres: `https://<alan-adı>/yonetim`. Uygulamada karşılığı **yok**; yasal
sayfalar gibi sunucudan veriliyor (`rotalar/yonetimPaneli.ts`,
`packages/server/yonetim/`). Düz HTML + JS, derleme adımı ve kütüphane yok.

**Kim girer:** `Oyuncu.rol === 'admin'` olan, e-posta + parolalı hesaplar.
Admin aynı zamanda oyuncu — ayrı bir hesap türü değil. Rol **her istekte
veritabanından** okunuyor (`araKatman/yoneticiDogrula.ts`), jetondan değil:
yetkisi alınan admin anında dışarıda kalır, askıya alınan admin giremez.

**Kurucu:** `KURUCU_EPOSTA` ile kayıtlı hesap rolden bağımsız her zaman admin.
İlk admin böyle oluşuyor. Kurucu panelden askıya alınamaz, silinemez, rolü
düşürülemez; hiçbir admin kendine de bu üçünü yapamaz. İkisi birlikte
"herkes kendini dışarıda bıraktı" durumunu imkânsız kılıyor.

**İşlemler:** genel bakış (oyuncu, masa, dolaşımdaki çip, son 24 saatin çip
akışı), oyuncu arama ve ayrıntısı (çip defteri, hakkındaki şikâyetler),
düzenleme (ad, rol, deneyim), çip ekleme/çıkarma (gerekçe zorunlu, deftere
`yonetici` sebebiyle yazılıyor), askıya alma (açık soket hemen kesiliyor),
hesap silme (oyuncunun kendi silmesiyle aynı yol), şikâyet kuyruğu ve
işlem kaydı.

**İşlem kaydı** (`yonetimKayitlari`): her değiştiren işlem — kim, kime, ne,
gerekçe. Hedefin adı saklanmıyor, yalnızca kimliği; silinen oyuncunun adı
burada kalsaydı hesap silmenin "kişisel bilgilerin silinir" sözü bozulurdu.

**Güvenlik:** oyuncu adları ve şikâyet metinleri panelde yalnızca metin
düğümü olarak basılıyor (`innerHTML` yok) — "<script>" adlı bir oyuncu
panelde kod çalıştıramaz. Betik ayrı dosyada, çünkü helmet'in içerik güvenliği
politikası satır içi script'e izin vermiyor. Jeton `sessionStorage`da
(sekme kapanınca gider). Sayfa `noindex` ve önbelleğe alınmıyor.

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
| 9 | Çip ekonomisi (§5.5) — kademe, pot, XP | **bitti** |
| 10 | Uygulama içi satın alma (§5.5) | sonra |
| 11 | Yönetim paneli (§5.6) | **bitti** |

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
