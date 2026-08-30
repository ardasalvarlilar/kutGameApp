# Küt — Proje Rehberi

Okey taşlarıyla oynanan **Küt** (nam-ı diğer Americano) oyununun mobil
uygulaması. 4 oyunculu, online, sunucu otoriteli.

**Kuralların tek kaynağı `KURALLAR.md` dosyasıdır.** Kod yazmadan önce oku.
Orada yazmayan bir kuralı ASLA uydurma — 9. bölüm karara bağlanmış maddeleri,
10. bölüm motorun spesifikasyondan türettiği okumaları listeler. İkisinde de
yoksa dur ve sor.

---

## Teknoloji

| Katman | Seçim | Neden |
|---|---|---|
| Kural motoru | Saf TypeScript, bağımlılıksız | Hem sunucuda hem istemcide çalışacak |
| Sunucu | Node + Socket.io | Otorite ve gizli bilgi burada |
| İstemci | React Native + Expo (TS) | Tek kod tabanı, iOS + Android |
| Test | Vitest | Motor testleri |

## Depo yapısı

```
packages/engine/    # saf kural motoru — UI yok, ağ yok, I/O yok
packages/server/    # otoriter oyun sunucusu — Express + Socket.io + MongoDB
apps/mobile/        # Expo uygulaması — sunucuya bağlı, online oynanıyor
KURALLAR.md         # kuralların tek kaynağı
MIMARI.md           # online mimarisi: soket, oda, hesap, sıra
DAGITIM.md          # VPS'e dağıtım: gerekçeleriyle
ADIMLAR.md          # yayına çıkış: sırayla yapılacaklar (DNS → App Store)
docker-compose.yml  # traefik + mongo + sunucu
```

## Komutlar

`pnpm` global olarak kurulu değil; Node ile gelen `corepack` üzerinden çalışır.

```
pnpm install                        # bağımlılıklar
pnpm -r test                        # tüm testler
pnpm -r typecheck                   # tip kontrolü
pnpm --filter @kut/engine test      # yalnızca motor
pnpm --filter @kut/mobile start     # Expo — telefonda Expo Go ile aç
pnpm --filter @kut/mobile web       # tarayıcıda önizleme
pnpm --filter @kut/server dev       # sunucu (önce packages/server/.env)
pnpm --filter @kut/server build     # tek dosya üretim derlemesi
```

Sunucunun test dosyalarından dördü **canlı Mongo ister**; yoksa sessizce
atlanırlar. Yerelde, atılabilir bir Mongo yeter:

```
docker run -d --name kut-mongo -p 27017:27017 mongo:7
```

Bu, uygulamanın kendi geliştirme veritabanından **ayrı**: `pnpm dev` Atlas'a
bağlanır (`packages/server/.env`), testler kendi geçici veritabanlarını bu
yerel konteynerde açıp kapatır (`TEST_MONGO_URI`, varsayılan
`mongodb://127.0.0.1:27017`). Biri olmasa da diğeri çalışır.

Uygulamanın hangi sunucuya bağlanacağı `EXPO_PUBLIC_SUNUCU_URL` ile
belirlenir (`apps/mobile/.env.local`); yoksa `src/ag/sunucu.ts`'teki üretim
adresi kullanılır. **Telefondan denerken `localhost` işe yaramaz** — telefon
kendi localhost'una bakar, makinenin yerel IP'sini yaz.

Motorun `tsconfig.json`'ı `types: []` ile derlenir: Node ya da DOM API'si
kullanan bir satır girerse derleme kırılır. Testler ayrı `tsconfig.test.json`
kullanır.

Metro sembolik linkleri iyi izlemediği için `pnpm-workspace.yaml`'da
`nodeLinker: hoisted` açık. Motor, `apps/mobile` tarafından TypeScript
kaynağı olarak doğrudan tüketiliyor — ara derleme adımı yok.

### Ekranlar

Akış tek yerde: `src/Uygulama.tsx`.

```
yükleniyor → giriş → lobi → bekleme odası → masa → (lobi)
```

| Ekran | Dosya | İş |
|---|---|---|
| Giriş | `bilesenler/Giris.tsx` | Misafir oyna · hesap aç · giriş yap |
| Lobi | `bilesenler/Lobi.tsx` | Hızlı oyna · masa aç · kodla katıl |
| Bekleme | `bilesenler/Bekleme.tsx` | Masa kodu, koltuklar, hazır düğmesi |
| Masa | `src/Masa.tsx` | Oyunun kendisi |

Kararı iki şey veriyor: oturum (`ag/kimlik.tsx`) ve masa
(`ag/cevrimiciOyun.ts`). `App.tsx` yalnızca `KimlikSaglayici`yı kurar.

**`ALIŞTIRMA` çevrimdışı oynanır** (`src/oyun.ts` + `src/bot.ts`): üç yer
tutucu oyuncuyla, sunucuya hiç bağlanmadan. Duruyor çünkü oyun dört kişi
olmadan başlamıyor; yeni bir uygulamada bu, tek başına açan kişinin boş bir
masada beklemesi demek — App Store denetçisi de dahil (Guideline 2.1/4.2).
Sunucu çöktüğünde de çalışan tek yol bu.

`AlistirmaMasasi` ayrı bir bileşen: `useOyun` bir kanca ve kancalar koşullu
çağrılamaz. Ana bileşende çağrılsaydı lobideyken bile el dağıtılır, yer
tutucuların zamanlayıcısı boşuna koşardı.

Ortak yardımcılar bilerek sürücülerin dışında: `src/yetkiler.ts` (hangi düğme
aktif) ve `src/hataMetinleri.ts` (hata kodu → cümle). `src/oyun.ts`te
dursalardı ekran onları kullanabilmek için çevrimdışı sürücünün tamamını —
botlar dahil — pakete sokmak zorunda kalırdı.

Masa ayrı bir bileşen: lobideyken oyun çizimi hiç koşmaz. Masadan çıkınca
`key` değiştiği için React yeni bir masa kurar — el temiz başlar.

### packages/server

Otoriter oyun sunucusu. Ayrıntı `MIMARI.md`de, katman listesi
`packages/server/README.md`de.

Üç kural burada da geçerli:

- **Sunucu otoriterdir.** İstemci "şu oldu" demez, "şunu yapmak istiyorum"
  der. Kararı motor verir. `soket/masaOturumu.ts` istemciden gelen `suAn`'ı
  kullanmaz — zaman sunucunundur; aksiyonun içindeki `oyuncu` alanının
  gerçekten o soketin koltuğu olduğu ayrıca doğrulanır.
- **Görünüm kişiye özeldir.** `oyun:gorunum` masaya değil, oyuncunun kişisel
  odasına gider. Ortak yayın rakiplerin ıstakasını sızdırırdı (motor kuralı #3).
- **Bütün ortam değişkenleri `src/config.ts`ten geçer.** Hiçbir dosya
  `process.env`e doğrudan bakmaz; eksik değerde sunucu ayağa kalkmadan durur.

Canlı oyun durumu bellekte, Mongo'da değil. Kalıcı olan el kaydı: `tohum +
aksiyonlar` bir eli birebir geri kurar (motor kuralı #2).

Bunun iki sonucu var ve ikisi de kodda karşılık buluyor:

- **Açılışta `yarimMasalariKapat()`.** Yeniden başlayan sunucu, Mongo'da
  `oynaniyor` kalan masaları kapatır. Temizlenmezse oyuncular "zaten bir
  masadasın" hatasıyla bir daha hiçbir masaya oturamaz.
- **Kapanışta sıra: soket → HTTP → Mongo.** Ters sırada, düşen soketlerin
  `disconnect` işleyicileri kapanmış bağlantıya sorgu atıp süreci
  düşürüyordu. `kapanisaGec()` bayrağı bu işleyicileri susturur.

Hesap tarafında: misafir ve e-posta **aynı** `Oyuncu` belgesine çıkar.
Misafirken hesap açılırsa üstüne biner — ilerleme kaybolmaz. Bir belge
yalnızca bir kez yükseltilebilir; ikincisine izin vermek, cihazı eline
geçirenin hesabı ele geçirmesi demek olurdu.

**Masaya oturma ATOMİK.** `masayaKatil` koltuğu `findOneAndUpdate` ile,
"bu koltuk hâlâ boş ve masa hâlâ dolu değil" filtresiyle yazar. Önce okuyup
sonra `save()` demek klasik oku-değiştir-yaz yarışıydı ve gerçekten yaşandı:
dört arkadaş kodu aynı anda girdiğinde ikisi 1 numaralı koltuğa oturdu,
3 numara boş kaldı — iki oyuncu aynı eli gördü, boş koltuğu sunucu oynadı.
Testi `test/koltukYarisi.test.ts`, `Promise.all` ile paralel katılım zorluyor
(sıralı çağrılarda hata hiç görünmüyor).

### App Store için eklenenler

Denetimin aradığı üç şey koda karşılık buluyor:

| Kural | Nerede |
|---|---|
| 5.1.1(v) — hesap **uygulama içinden** silinebilmeli | `kimlikServisi.hesabiSil` · Lobi → HESAP → Hesabımı sil |
| 1.2 — uygunsuz içeriği süz, şikâyet et, engelle | `adFiltresi.ts` · `moderasyonServisi.ts` · masada AYARLAR |
| Gizlilik politikası ve destek URL'i | `rotalar/sayfalar.ts` — `/gizlilik`, `/kosullar`, `/destek`, `/hesap-sil` |

Yasal sayfalar ayrı bir site yerine sunucudan veriliyor: alan adı ve TLS
zaten orada, ikinci bir yerde tutmak "biri güncellenir diğeri unutulur" demek.

Engellemenin **gerçek** bir karşılığı var, yoksa düğme sus olurdu: engellenen
oyuncu hızlı eşleşmede aynı masaya düşmez ve kodu bilse bile o masaya
katılamaz. Kontrol **çift yönlü** — tek yönlü olsaydı taciz eden kişi
engellendiğini fark edip yeni masa açarak yine karşısına çıkabilirdi.

Parola sıfırlama bağlantı değil **kod** kullanıyor: e-postadaki bağlantıdan
uygulamaya dönmek derin bağlantı (universal link) kurmayı gerektiriyor ve o,
App Store için ayrı bir yapılandırma. Kod her cihazda aynı şekilde çalışıyor.
SMTP ayarlanmamışsa sunucu yine açılır, yalnızca sıfırlama çalışmaz — oyun
e-postasız da oynanıyor.

### Dağıtım

`docker compose up -d --build` üç servisi birden kaldırır: Traefik (TLS,
Let's Encrypt), Mongo ve sunucu. Adımlar `DAGITIM.md`de.

İki şey bilerek böyle:

- **Dışarı yalnızca 80/443 açık.** Sunucunun ve Mongo'nun portları host'a
  yayınlanmıyor; her istek Traefik'ten geçer. Mongo'yu internete açmak,
  otomatik taranıp silinmesiyle sonuçlanır.
- **npm bağımlılıkları bundle'a alınmıyor.** `express`, `socket.io` ve
  `mongoose` dinamik require/native eklenti kullandığı için paketlenince
  çalışmıyorlar; imaja `pnpm deploy --prod` ile ayrıca giriyorlar. Motor saf
  TypeScript olduğu için bundle'ın içinde — ikinci kopya oluşmuyor.

### apps/mobile'ın ağ katmanı

Oyun **sunucuda** koşuyor. Ekran hiçbir kural bilmiyor; gördüğü tek şey
`viewFor` projeksiyonu ve gönderdiği tek şey aksiyon.

```
src/ag/protokol.ts        # sunucu sözleşmesinin istemci kopyası
src/ag/sunucu.ts          # adres (EXPO_PUBLIC_SUNUCU_URL)
src/ag/depo.ts            # jeton + cihaz kimliği (SecureStore / localStorage)
src/ag/api.ts             # REST: kayıt, giriş, misafir, ben
src/ag/kimlik.tsx         # oturum context'i; soketi açar
src/ag/soket.ts           # tek socket.io bağlantısı, modül seviyesinde
src/ag/cevrimiciOyun.ts   # masa + görünüm + süre → MasaSurucusu
```

`Masa.tsx` artık `useOyun`u doğrudan çağırmıyor; bir **sürücü** alıyor
(`src/surucu.ts`). İki sürücü var ve ikisi de aynı sözleşmeyi dolduruyor:

| Sürücü | Motor nerede |
|---|---|
| `src/oyun.ts` (`useOyun`) | Cihazda — geliştirme, `bot-simulasyon.test.ts` |
| `src/ag/cevrimiciOyun.ts` | Sunucuda — asıl oyun |

Bu ayrım mümkün, çünkü ekran zaten tam durumu değil projeksiyonu okuyordu
(motor kuralı #3).

Dikkat edilecek üç şey:

- **İyimser gösterim yok.** İstemci `reduce` çalıştıramaz — rakiplerin
  ıstakası gizli olduğu için tam durumu hiç görmüyor. `gonder`'in dönen
  değeri "kabul edildi" değil, "gönderildi" demek.
- **Koltuk numaram 0 olmak zorunda değil.** Çevrimiçi masada 2 numaraya da
  oturabilirim. Ekrandaki yerleşim `gorunum.ben`den türetiliyor
  (`yerlesimKur`): sağım `siradaIleri(ben,1)`, karşım 2, solum 3. `INSAN`
  sabiti kalktı.
- **Zaman sunucunun.** `oyun:sure` paketi `sunucuZamani`'nı da taşıyor;
  istemci farkı alıp ofsetini düzeltiyor. Telefonun saati yanlışsa geri
  sayım yine doğru işler.

Bağlantı koptuğunda masanın üstüne uyarı perdesi iner. Şart: uyarı olmadan
donmuş tahta "oyun kilitlendi" gibi görünüyor, oysa koltuk duruyor ve sıra
gelirse sunucu yerine oynuyor (MIMARI.md §3).

`TAŞLARI İŞLE` eskiden her adımda tam durumu okuyup sıradaki taşı
yerleştiriyordu. O durum artık istemcide yok; plan yalnızca görünümden
çıkarılıyor (`src/islemePlani.ts`, saf ve testli).

Arayüz **landscape**'e kilitli (Okey 101 Plus düzeni):

- Oyuncular masada oturur gibi yerleşir: karşındaki üstte, solundaki solda,
  sağındaki sağda. Her biri ıstaka renginde bir şerittir; üzerindeki taşlar
  görünmez. Yere indirdiği perler kendi şeridinin önünde durur
- Yere inen taşların boyu sabit değil, **masanın ölçülen eninden türetilir**
  (`src/olculer.ts`). Sol ve sağdaki oyuncunun perleri ortaya doğru uzadığı
  için sınır orası: 13 taşlık bir seri (KURALLAR.md §2'nin en uzun peri)
  kırpılmadan sığmalı ve ortadaki deste ile atık öbeği ezilmemeli. Hesap saf
  ve testli; ekranın yaptığı tek şey `masaOlcu.en`'i beslemek
- **Atık yığınları ortada** tek bir öbekte toplanır; her yığın sahibinin
  oturduğu yöne doğru kaydırılır, alınabilecek olan çerçevelenir. Yanında
  deste sembolü ve kalan taş sayısı vardır
- Taşı **yukarı sürükleyerek** atarsın; ortadaki yığından ya da desteden
  **aşağı sürükleyerek** çekersin. Atma ve çekme masada uçan taşla canlanır.
  Bunların ayrı `ÇEK` / `YERDEN AL` / `AT` düğmesi **yoktur** — hareket
  yeterli, düğme yan paneli şişiriyordu
- Sırası gelen oyuncunun **30 saniyesi** vardır (KURALLAR.md §9 0.4,
  `ayarlar.siraSureleriMs`). Süre iki kez başlar: sıra geçtiğinde ve her
  **taş çekmeden** sonra. Geri sayım `TUR` satırının sağında, altında ince
  bir çubukla; son 5 saniyede kırmızıya döner. Süre dolarsa oyuncunun
  yerine oynanır: çekmediyse desteden çeker, sonra işine yaramayan bir taşı
  atar. Süresini dolduran oyuncunun hakkı **30 → 20 → 10** diye iner ve
  10'da kalır. Kademe oyuncuya özeldir ve **yalnızca o eli kapsar**: yeni el
  dağıtıldığında herkes 30 saniyeye döner (§9 0.7).
  İş bölümü üçe ayrık — sayaç `src/oyun.ts`'te (zaman motorun dışında),
  karar `src/sure.ts`'te (saf, testli), uygulama yine motorda
- **Yerden okey çekme** (KURALLAR.md §6) ekranda `OKEY AL` düğmesiyle.
  Kural motorda zaten vardı (`okeyCekilebilirMi`, `OKEY_CEK`, `AC` içindeki
  `okeyAlimi`); eksik olan projeksiyon ve arayüzdü. `viewFor` artık
  `okeyFirsatlarim` üretiyor, ıstakada işe yarayan taşların altında **mor**
  bir işaret çıkıyor. Mor, `isler` turuncusundan ayrı: okey çekmek işleme
  değildir, atmanın §8 cezası da yoktur — ikisini birleştirmek puanlamayı
  sessizce değiştirirdi.
  Düğme iki yolu da yürütüyor (`src/okey.ts`): açmış oyuncu için `OKEY_CEK`,
  hiç açmamış oyuncu için §6 istisnası — okeyi alıp aynı hamlede açar.
  İstisnada açılışı ekran arıyor, çünkü okey henüz oyuncunun elinde değil:
  `acilisBul`a **zorunlu taş** olarak veriliyor, böylece §6'nın "aldığın
  okeyi o açılışta kullanmak zorundasın" şartı sağlanıyor
- KURALLAR.md §8'e göre işler olan taşların altında turuncu bir işaret çıkar.
  Yerdeki bir okeyi çekmeye yarayan taşlar §9 0.6'dan beri **zaten işler
  sayılıyor**; onlarda mor işaret öncelikli, çünkü daha özel bilgi taşıyor
- Yerdeki perler taşların **dizi sırasıyla değil, serideki yerlerine göre**
  çizilir (`perGoruntuSirasi`). `12 + 13 + okey` geçerli bir seridir ama okey
  **11**'in yerine geçer; ham sırayla çizince okey 13'ün sağında görünüp
  "12-13-1 açmış" izlenimi veriyordu (KURALLAR.md §2 gösterim notu)
- Istakadaki taş sayısı **gösterilmez** — ne kendinin ne rakiplerin.
  `viewFor` sayıyı üretmeye devam ediyor, karar yalnızca ekranda
- Istaka **iki katlı**: `src/duzen.ts` iki sıralı bir slot ızgarası tutar.
  Çalma yüzünden ıstakada 24+ taş olabildiği için (KURALLAR.md §5) tek sıra
  yetmiyor. Taşlar bilerek küçük
- Ayrı bir "hazırlanan perler" alanı yoktur; per adayları ızgaradaki
  **boşluklarla** belli olur — bitişik taşlar bir grup sayılır
- Taşlar **sürüklenebilir**: boş slota taşınır, dolu slotta yer değiştirir.
  Oyuncu kendi serisini/kütünü istediği gibi kurabilir
- `AÇ` seçili taşları ızgaradaki grup sınırlarına göre perlere ayırır
- `SERİ DİZ` / `KÜT DİZ` eli otomatik gruplara dizer

`TAŞLARI İŞLE` düğmesi, seçili taşları uydukları perlere tek tek işler.
Hangi taşın nereye gideceğini oyuncunun seçmesine gerek yok.

**Seçim yoksa** ıstakadaki işler taşları gider ama ikisi korunur (`src/isleme.ts`):
okey (elde 25 puan, bilerek istenmeli) ve oyuncunun ızgarada kurduğu geçerli
perlerin taşları. Düğme bir kolaylık; oyuncunun kurduğu şeyi dağıtmamalı.
Okey yerdeki neredeyse her pere işlediği için, bu ayrım olmadan kendi
perindeki okey de yere gidiyordu. Seçim varsa niyet açıktır — ne seçildiyse o
gider, okey dahil.

Çevrimdışı sürücüde diğer üç oyuncu `src/bot.ts` ile oynuyor: çeker,
açabiliyorsa turun şartını arayıp açar, açtıysa işler, sonra en az işe
yarayan taşı atar. Çevrimiçi masada bot yok — dört gerçek oyuncu oturur;
süresi dolanın yerine sunucu oynar (`packages/server/src/soket/yerineOyna.ts`).

Bot **alamayacağı taşı istememeli**: motor reddettiğinde durum değişmediği
için sürücünün effect'i yeniden koşmuyor ve sıra kilitleniyor. Tur 15'te
"çifti bende" hakkı sırası gelenin bedelsiz hakkını geçtiği için
(KURALLAR.md §5) `yerdenAlmaliMi` bunu ayrıca kontrol ediyor. Güvenlik ağı
olarak sürücü, reddedilen her hamlede **faza uygun** bir kurtarma deniyor
(`sureDolduAksiyonu`) ve yine ilerleyemezse `botTetik` sayacını artırıp
tekrar deniyor — kurtarmanın faza uygun olması şart, çekme fazında "at"
demek yine reddedilir. Bot da yalnızca
kendi `viewFor` projeksiyonunu okur — insandan fazlasını görmez. Bilerek kodla
yazıldı, LLM ile değil: motor kuralı #2 aynı tohumun aynı oyunu üretmesini
istiyor, LLM bunu kırardı. `src/bot-simulasyon.test.ts` dört botla 16 turun
hepsini oynatıp elin sorunsuz kapandığını ve taş sayısının korunduğunu
doğruluyor.

`src/dizme.ts` bir **kural değil**, kolaylıktır: hiçbir oyun durumu
değiştirmez, geçerlilik kararını yine motora (`seriMu` / `kutMu`) sorar.
İki kuralı var: okey kıt kaynak olduğu için önce pere dönüşecek yerlere
harcanır, ve yalnızca **açılabilir** perler (3+ taş) gruplanır — `kirmizi1 +
kirmizi2` ardışık olsa da ayrı bölme yapılmaz, açılamaz çünkü.

Yan paneldeki düğmeler iki sütuna dizilir; etiketi yarım sütuna sığmayan
tek düğme (`TAŞLARI İŞLE`) tam satırı kaplar. Panelin eni (168) en uzun
yarım etikete göre seçildi — tarayıcıda ölçüldü, tahmin değil.

### Tur 16 — elden bitme

Motorun ayrı bir aksiyonu var: `BITIR_ELDEN`. Normal `AT` tur 16'da eli
**bitirmez** — bu bir kez atlandı ve oyun son taş atıldığında devam etti.

Ekran artık tur 16'da atıştan önce `eldenBitmeCozumu` ile elin perlere
bölünüp bölünmediğine bakıyor (`src/eldenBitme.ts`, saf ve testli); bölünüyorsa
`BITIR_ELDEN` gönderiyor. Bölünmüyorsa normal atış yapılıyor.

Atılınca eli bitirecek taşların altında **yeşil** işaret çıkıyor. İşaret
önceliği: yeşil (biter) → mor (okey çeker) → turuncu (işler).

**Dikkat:** sürükleyerek atma `masayaBirak` üzerinden gidiyor ve o da `at`'i
çağırmak zorunda. Doğrudan `AT` gönderirse tur 16 kontrolü atlanır — ilk
denemede tam bu oldu.

### Puan tablosu

`src/bilesenler/PuanTablosu.tsx` iki işi görüyor: el sonunda o turun dökümü
(elde kalan × çarpan = bu el, artı maç toplamı) ve 16. tur sonunda maç
tablosu. Tur arası 5 saniyelik geri sayımla otomatik ilerliyor.

Maç boyu puanlar çevrimiçi oyunda **sunucuda** birikiyor (`masa.puanlar`) ve
istemciye `masa:durum` ile geliyor; çevrimdışı sürücüde `useOyun`'da. Maç
sonu kararı **tur numarasına** bağlı (`tur >= 16`), oynanan el sayısına değil
— aynı tur yeniden dağıtılabildiği için el saymak yanlış sonuç verirdi.

Tur arası geri sayımı da sunucudan geliyor (`oyun:elSonu.sonrakiElSn`).
Süre dolunca istemci bir şey yapmıyor: yeni eli sunucu dağıtıyor, gelen
`oyun:gorunum` tabloyu kendiliğinden kapatıyor.

`AYARLAR` düğmesi ses anahtarını ve masadan çıkışı taşır. (Eski `YENİ EL`
düğmesi kaldırıldı; el sonu ekranındaki `SONRAKİ TUR` / `TEKRAR` duruyor.)

### Sürükle-bırak hedefleri

Taş artık "yukarı sürükleyince" atılmıyor; **nereye bırakıldığına** bakılıyor:

- ortadaki **atık öbeğine** bırakılırsa atılır
- yerdeki bir **pere** bırakılırsa o pere işlenir

Sebep: aynı taş hem bir seriye hem bir küte işleyebiliyor (siyah 7, yerdeki
`siyah 4-5-6` ve `sarı7+mavi7+kırmızı7`). `TAŞLARI İŞLE` bunu oyuncu adına
seçiyordu; sürükleme kararı oyuncuya bırakıyor. İki yol da duruyor.

Hedeflerin ekran dikdörtgenleri **durumda tutuluyor** ve sürükleme
başlarken `measureInWindow` ile ölçülüyor — masaya taş indikçe yan sütunlar
genişleyip ortadaki öbek kaydığı için sabit bir eşik yetmiyordu. Hangi
hedefe düşüldüğü `src/hedefler.ts`'te (saf, testli); yakalama payı sayesinde
öbeğe tam nişan almak gerekmiyor.

### Ses

`src/ses.ts` hangi efektin çalacağına karar verir (saf, testli),
`src/sesCalar.ts` `expo-audio` ile çalar. Ayrımın sebebi vitest: koşucu
native modülleri çözemiyor.

Dosyalar `assets/sesler/` altında (`at.wav`, `cek.wav`, `isle.wav`) ve şu an
**geçici** — kod üretti, gerçek kayıt değil. Değiştirmek için aynı adla yeni
dosyayı o klasöre kopyalamak yeterli; ayrıntı `assets/sesler/OKUBENI.md`'de.

---

## Motorun tasarım kuralları

Bunlar pazarlığa açık değil; motorun tüm değeri bunlara uymasından geliyor.

**1. Saf indirgeyici (reducer).**
`reduce(state, action) => state`. Motor hiçbir yan etki üretmez:
ağ yok, disk yok, zamanlayıcı yok, konsol yok.

**2. Motorun içinde rastgelelik olamaz.**
`Math.random()` ve `Date.now()` motorda YASAK. Karıştırma, tohumlu (seeded)
bir RNG ile yapılır ve tohum dışarıdan verilir. Sebebi: aynı tohum + aynı
aksiyon listesi her zaman aynı oyunu üretmeli. Bu olmadan ne hata
ayıklayabiliriz, ne kopan bağlantıda oyunu geri kurabiliriz.

**3. Gizli bilgi projeksiyonla çözülür.**
`state` tam durumu tutar. İstemciye gönderilecek olan
`viewFor(state, playerId)` fonksiyonundan geçer ve o oyuncunun görmemesi
gereken hiçbir şeyi içermez. Rakiplerin ıstakasından yalnızca **taş sayısı**
görünür. Botlar da bu projeksiyonu kullanır — bot insandan fazlasını görmez.

**4. Geçersiz hamle istisna değil, sonuçtur.**
Her aksiyon `{ ok: true, state } | { ok: false, reason }` döner.
Sunucu bu sonucu doğrudan istemciye iletebilmeli.

**5. Sabit el boyutu varsayma.**
Çalma mekaniği yüzünden bir ıstakada 20+ taş olabilir. El boyutunu
sabit sayan hiçbir dizi, tip veya döngü yazma.

**6. Taşlar kimliklidir.**
Destede her taştan iki kopya var. Her taş fiziksel örneğini temsil eden
benzersiz bir `id` taşır; `renk + sayı` bir taşı tanımlamaya yetmez.

---

## Terimler

Kodda oyunun kendi kelimelerini kullan (Türkçe, şapkasız). Çeviri yapma —
"kut" ile "set", "seri" ile "run" arasında gidip gelmek kafa karıştırır.

| Terim | Anlamı |
|---|---|
| `kut` | Aynı sayı, farklı renkler (3–4 taş) |
| `seri` | Aynı renk, ardışık sayılar (3+ taş) |
| `per` | Genel olarak kut veya seri |
| `okey` | Joker taş (destede 2 adet) |
| `istaka` | Oyuncunun elindeki taşlar |
| `acmak` | Turun şartını yerine getirip yere per indirmek |
| `islemek` | Yerdeki bir pere taş eklemek |
| `calmak` | Sırası olmadan atılan taşı ceza ödeyerek almak |
| `tur` | 16 elden biri |

Renkler: `kirmizi` `siyah` `mavi` `sari`

---

## Çalışma tarzı

- **Kural belirsizse dur ve sor.** Uydurulmuş bir kural, sessizce yanlış
  çalışan bir oyun demektir; onu aylar sonra fark ederiz.
- **Faz atlama.** Motor bitmeden sunucu, sunucu bitmeden UI yazma.
- **Her kural bir testtir.** `KURALLAR.md`'deki bir madde koda giriyorsa,
  onu doğrulayan bir test de girmeli.
- TypeScript `strict` açık. `any` kullanma.
- Yorumları Türkçe yaz, kural referansı ver (`// KURALLAR.md §5`).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
