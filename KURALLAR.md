# Küt — Kural Spesifikasyonu

> Sürüm 0.10. Kural motoru **yalnızca** bu dokümandan yazılır.
> Burada yazmayan kural oyunda yoktur. Belirsiz bir nokta varsa
> tahmin etme — "Karara bağlananlar" bölümüne bak, orada da yoksa sor.
>
> 0.1'de açık bırakılan yedi madde 27 Ağustos 2026'da karara bağlandı.
> 0.3'te dönüş yönü saat yönüne çevrildi, işler taş cezası ve kütteki okeyi
> alma şartı eklendi. 0.4'te sıra süresi geldi, 0.5'te eli bitiren atış
> işler taş cezasından muaf tutuldu, 0.6'da okeyin yerine geçen taş işler
> sayıldı, 0.7'de süre kademesi el sonunda sıfırlandı, 0.8'de yerdeki okeyin
> yeri sabitlendi, 0.9'da talep penceresinin süresi kaldırıldı, **0.10'da
> "çifti bende" anında sonuçlanan bir hamleye çevrildi** (bkz. §9).

Küt, halk arasında **Americano** olarak da bilinen oyunun okey taşlarıyla
oynanan hâlidir. 101'e benzer ama her turun kendi açılış şartı vardır.

- 4 oyuncu (zorunlu)
- 106 taş
- 16 tur
- **En düşük puan kazanır**

---

## 1. Kurulum

### Deste

- 1–13 arası sayılar, dört renkte: `kirmizi`, `siyah`, `mavi`, `sari`
- Her taştan iki kopya → 104 taş
- Artı **2 okey taşı** (fiziksel destedeki "sahte okey" taşları) → toplam **106**
- **Gösterge yoktur.** Hiçbir taş açık durmaz, hiçbir taş ters çevrilmez.
  101'deki "sarı 6 açıldı → sarı 7 okey oldu" mantığı Küt'te YOKTUR.
  Okey, doğrudan o iki taşın kendisidir.

### Dağıtım

- Her oyuncuya **14 taş**, başlayan oyuncuya **15 taş**
- Başlayan oyuncu ilk hamlesinde **taş çekmez**, doğrudan bir taş atarak başlar
- Dağıtımdan sonra destede `106 - 57 = 49` taş kalır
- Her el başlayan oyuncu bir sonrakine geçer

---

## 2. Perler

### Küt (grup)

Aynı sayının **farklı renklerdeki** taşları. Oyuna adını veren per budur.

- Renkler farklı olmak zorunda; aynı renkten iki taş bir kütte bulunamaz
- Dört renk olduğu için **bir küt en fazla 4 taştır**
- Okey ekleyerek beşli küt yapılamaz
- Minimum 3 taş

Örnek: `kirmizi7 + siyah7 + mavi7` (üçlü küt)

### Seri

Aynı rengin **ardışık** sayıları.

- Tek renk olmak zorunda
- **1 seriyi başlatabilir, bitiremez.** `1-2-3` geçerli; `12-13-1` GEÇERSİZ
- Seri 13'te durur, başa dönmez
- Minimum 3 taş, üst sınır yok (1'den 13'e tam seri mümkün)

Örnek: `mavi4 + mavi5 + mavi6` (üçlü seri)

### Okey

- İki okey taşı vardır ve **her taşın yerine geçebilir**
- Bir perde **iki okey birden** kullanılabilir
- Elde kalırsa **25 puan** ceza

---

> **Gösterim notu.** `kirmizi12 + kirmizi13 + okey` geçerli bir seridir:
> okey **11**'in yerine geçer, çünkü seri 13'te durur. Ekran taşları serideki
> yerlerine göre dizer (`★ 12 13`), geldikleri sırayla değil — aksi hâlde
> okey 13'ün sağında duruyormuş gibi görünüp "12-13-1" izlenimi verir.

---

## 3. Turlar

16 tur, **sabit sırayla** oynanır. Her turun açılış şartı vardır ve
şartın **tamamı tek hamlede** yere inmelidir.

| Tur | Açılış şartı | Taş |
|----:|---|---:|
| 1  | 2 × üçlü küt | 6 |
| 2  | 2 × üçlü seri | 6 |
| 3  | 1 üçlü küt + 1 üçlü seri | 6 |
| 4  | 1 × dörtlü küt | 4 |
| 5  | 1 × dörtlü seri | 4 |
| 6  | 2 × dörtlü küt | 8 |
| 7  | 2 × dörtlü seri | 8 |
| 8  | 1 dörtlü küt + 1 dörtlü seri | 8 |
| 9  | 1 × beşli seri | 5 |
| 10 | 1 beşli seri + 1 üçlü küt | 8 |
| 11 | 1 beşli seri + 1 üçlü seri | 8 |
| 12 | 1 beşli seri + 1 dörtlü küt | 9 |
| 13 | 1 beşli seri + 1 dörtlü seri | 9 |
| 14 | 2 × beşli seri | 10 |
| 15 | 4 çift | 8 |
| 16 | Elden bitme | tümü |

### Tur 15 — çift

**Çift = birebir aynı taş.** Aynı renk, aynı sayı: `kirmizi7 + kirmizi7`.
`kirmizi7 + mavi7` çift DEĞİLDİR.

- Okey her taşın yerine geçtiği için (§2) `kirmizi7 + okey` de çifttir
- İki okey taşı fiziksel olarak birebir aynıdır; ikisi birlikte çifttir
- Destede her taştan iki kopya olduğu için bir taşın eşi tektir
- Tur 15'in kendine özgü bir çalma hakkı vardır, bkz. §5

### Tur 16 — elden bitme

Diğer turlardan tek farkı: **yere hiç per inmez, kimse açmaz, kimse işleme
yapmaz.** Herkes tüm elini geçerli perlere bölmeye çalışır, geriye tek taş
kalır, onu ortaya atarak biter.

- Per kompozisyonu **serbesttir** — sabit şart yoktur.
  Dört üçlü seri + bir dörtlü küt de olur, 1'den 13'e tam seri + üçlü küt de olur.
- Tek şart: artan **tam olarak 1 taş** olacak
- Taş çalma bu turda da aynen geçerlidir

---

## 4. Sıra akışı

**Oyun saat yönünde döner.** Attığın taşı **sağındaki** oyuncu alır;
sıra da ona geçer.

Sırası gelen oyuncu iki şeyden birini yapar, sonra bir taş atar:

1. **Solundaki oyuncunun attığı taşı alır** — bedelsiz.
   (Yani kendi solundaki; oyun saat yönünde döndüğü için taşı ondan devralır.)
   101'deki "aldıysan açmak zorundasın" şartı Küt'te YOKTUR.
2. **Ya da desteden çeker.**

Ardından ıstakasından bir taş atar, sıra sağındaki oyuncuya geçer.
Atılan taş, atan ile sağındaki oyuncu arasındaki yığının üstüne gelir —
masada **dört ayrı atık yığını** vardır.

İstisna: elin ilk hamlesinde 15 taşlı oyuncu çekmeden doğrudan atar.

---

## 5. Taş çalma

Oyunun imza mekaniği. Yere atılan taşı **sıradaki oyuncudan başkası da
alabilir** — bedeli, desteden ek bir taş çekmek ve 5 ceza puanıdır.

### Öncelik

Bir oyuncu taş attığında öncelik oyun yönünde (saat yönünde) ilerler:

| Sıra | Kim | Bedel |
|---|---|---|
| 1 | Atanın sağındaki (sırası onda) | **Bedelsiz** |
| 2 | Ondan sonraki (atanın karşısındaki) | +1 ceza taşı, +5 puan |
| 3 | En sondaki (atanın solundaki) | +1 ceza taşı, +5 puan |

**Kim önce bastıysa değil, kim öncelikliyse alır.** Bu bilinçli bir tercih:
"önce basan alır" olsaydı interneti yavaş oyuncu her seferinde kaybederdi.
Koltuk sırası deterministiktir, ağ gecikmesinden etkilenmez.

### Talep penceresi

Pencerenin **süresi yoktur** (0.9 ile karara bağlandı). Sırası gelen oyuncu
hamlesini yapana kadar açık kalır; onun hamlesi pencereyi kapatır.

1. Taş atılır, pencere açılır. 3 ve 4 numaralıda "İstiyorum" butonu belirir.
2. 2 numaralı **beklemez**: dilerse aynı anda çeker. Kendi sıra süresi
   (§9 0.4, 30 sn) boyunca düşünebilir; diğerlerinin tepki süresi de tam
   olarak bu süredir.
3. 2 numaralı taşı alırsa iş biter, talepler düşer.
4. 2 numaralı desteden çekerse pencere kapanır ve o an talepte bulunanların
   **en öncelikli olanı** taşı alır: taş + desteden 1 ceza taşı + 5 puan.
5. Kimse talep etmemişse taş **yerde kalır.**
6. Talep **bağlayıcıdır.** İstedin ve sıra sana kaldıysa alırsın, ödersin.

Örnek: 1 numaralı attı. 5. saniyede 3 numaralı, 8. saniyede 4 numaralı
"istiyorum" dedi. 15. saniyede 2 numaralı taşı almayıp desteden çekti —
taş **3 numaralıya** gider (öncelik atan+2), 4 numaralının talebi düşer.

### Kurallar

- Yalnızca yığının **en üstteki** taşı alınabilir; altındakiler ölüdür
- Çalmanın **sınırı yoktur**
- Çalmak **sırayı harcamaz** → her çalış eli kalıcı olarak **2 taş büyütür**
  (çalınan taş + ceza taşı). Kendi sıran geldiğinde yine normal çeker/atarsın.
- Bunun sonucu: ıstakada 20+ taş olabilir. Veri modeli sabit el boyutu VARSAYMAMALI.

### Tur 15 — "çifti bende"

Yalnızca çift turunda geçerlidir. Atılan taşın **birebir eşini elinde tutan**
oyuncu koltuk önceliğinin tamamını geçer — sırası gelen oyuncunun bedelsiz
hakkı dahil.

**Bu bir talep değil, hamlenin kendisidir** (0.10). "Çiftim var" diyen oyuncu
taşı **o anda** alır; kuyruğa girmez, kimsenin sırasını beklemez. Kimin daha
önce "istiyorum" dediğinin bir önemi yoktur.

Örnek: 1 numaralı `kirmizi7` attı. 3 numaralı "istiyorum" dedi. 4 numaralının
elinde o taşın eşi var ve "çiftim var" diyor: taş **4 numaralınındır**.
4 numaralı taşı ve desteden 1 ceza taşını alır, 5 ceza puanı yazar — bedel
normal çalmanın aynısıdır ve sırayı yine harcamaz. 2 numaralı, kendi bedelsiz
hakkını kullanamaz; **desteden çeker** ve sırasına devam eder. 3 numaralının
talebi düşer.

**"Çiftim var" tuşu yalnızca eş gerçekten ıstakadaysa açılır** ve bu bir
kullanıcı kolaylığı değil, kuralın kendisidir. Elinde olmayan bir taş için
"çiftim var" diyebilmek, işine yarayan her taşı bedavaya toplamak olurdu.
Sunucu bunu ayrıca doğrular; olmayan talebi reddeder.

- **Blöf mümkün değildir.** Talep ancak taşın birebir eşi gerçekten ıstakada
  ise geçerlidir; sunucu bunu doğrular ve olmayan talebi reddeder. İstemcideki
  "çifti bende" tuşunun yalnızca eş eldeyken açılması kullanıcı kolaylığıdır,
  güvenlik değil.
- Bir taştan destede iki kopya olduğu için **en fazla bir oyuncu** hak sahibi
  olabilir; iki kişi aynı anda haklı çıkamaz.
- Elinde eş olan yoksa her şey yukarıdaki normal önceliğe göre işler.
- Çalmanın bedeli desteden bir taştır; **deste boşsa** çalınamaz.
- **Dört çiftini indirmiş (açmış) oyuncunun bu hakkı kapanır** (0.10). Açtıktan
  sonra oyun küt ve seriyle devam eder (§6, §10.2); çift toplamanın karşılığı
  kalmaz. "Çiftim var" tuşu da söner.
- Sırası gelen oyuncu taşı **önce** alırsa taş onundur: pencere onun hamlesiyle
  kapanır (0.9). Sayaç olmadığı için bu yarış kaçınılmazdır ve iki yönde de
  aynı işler.

### Talep görünürlüğü

Sıradaki oyuncu, diğerlerinin talebini **görür** ("3 numaralı bu taşı istiyor").
Masadaki sesli soruya sadık. Oda ayarı olarak kapatılabilir olmalı,
**varsayılan açık**.

---

## 6. Açma ve işleme

### Açma

- Turun şartının **tamamı** aynı hamlede yere iner
- **Ne eksik, ne fazla.** Şart üçlü kütse dörtlü küt açılamaz;
  şart 1 küt + 1 seriyse iki küt indirilemez
- Açtığın hamlede **işleme yapamazsın** (ne kendi perine, ne başkasınınkine)

### İşleme

Açtıktan sonra **bir tur dönüp sıra sana tekrar geldiğinde**:

- Kendi perlerine taş işleyebilirsin (tur 4'te dörtlü kütün 4. taşı böyle konur)
- **Başkalarının** perlerine taş işleyebilirsin
- Fazladan küt ve seri indirebilirsin

### Okey çekme

Yerdeki bir perde okey duruyorsa ve temsil ettiği gerçek taş sendeyse:

**Normal yol (açmış oyuncu):** Açmışsan ve açtıktan sonra bir tur dönmüşse,
okeyi alıp **ıstakana koyabilirsin**, istediğin yerde kullanırsın.

**İstisna (henüz açmamış oyuncu):** Hiç açmadıysan ve o okeyi aldığında turun
şartını **karşılayabiliyorsan**, okeyi alıp aynı hamlede açabilirsin.
Bekleme şartı yoktur. Ancak aldığın okeyi **o açılışta kullanmak zorundasın**;
ıstakana alıp saklayamazsın.

#### Kütteki okey: rengi tamamlamak zorunludur

Seride okeyin temsil ettiği taş bellidir; onu koyup okeyi alırsın.
`mavi4 + mavi5 + okey` için `mavi6` koymak yeter.

Kütte okeyin **hangi renk olduğu belirsiz** olabilir. `kirmizi5 + mavi5 + okey`
üçlüsünde okey hem `siyah5` hem `sari5` yerine geçiyor olabilir. Bu yüzden
kütteki okeyi almak için **kütü dört renge tamamlamak** gerekir:

- `kirmizi5 + mavi5 + okey` → okeyi almak için `siyah5` **ve** `sari5` konur
- `kirmizi5 + siyah5 + sari5 + okey` → okey kesin `mavi5`; tek taş yeter

Eksik taşların hepsi elinde yoksa o okeyi **alamazsın**; elindekini yalnızca
o pere **işleyebilirsin**.

---

## 7. El bitişi

### Normal bitiş

Tüm taşlarını yere indirmiş, işleyeceğini işlemiş ve elindeki **son taşı
ortaya atmış** oyuncu eli bitirir.

### Deste tükenmesi

Destedeki 49 taş biterse el kimse bitirmeden kapanır. Herkes ıstakasında
kalan sayıları ceza yazar; açamayanlar iki katını yazar.
Atık yığınları karılıp desteye geri KONMAZ.

- **Kimse -100 almaz.** El kazanansız kapanır.
- Çalma cezaları (5 × çalış) yine herkesin puanına eklenir.

---

## 8. Puanlama

Taşın puanı sayısıdır: `1 → 1`, `13 → 13`. Okey elde kalırsa **25**.

Her oyuncu için sırasıyla:

```
ceza = Σ(eldeki taşların sayıları)      // okey = 25

if (hiç açmadıysa)            ceza *= 2
if (kazanan okeyle bittiyse)  ceza *= 2   // ikisi birden → *4

ceza += 5 * (çalınan taş sayısı)        // çarpana GİRMEZ, en sonda eklenir
ceza += 50 * (atılan işler taş sayısı) // bu da çarpana GİRMEZ

kazanan.puan = (okeyle bittiyse -200, değilse -100)
             + 5 * (çalınan taş sayısı)          // kazanan da çalma bedelini öder
```

**"Okeyle bitti"** = bitiren oyuncunun **ortaya attığı son taşın okey olması**.
Perlerinde okey kullanmış olması bir şey ifade etmez.

### Okeyle bitirenin ödülü — -200 (0.11)

Okeyle bitmek rakiplere ×2 (açamayanlara ×4) yazdırır; bitirenin kendisi de
**-100 yerine -200** alır.

Ödül olmadan kural bitiren için nötrdü: elinde 25 puanlık okeyi tutup normal
bitmekle okeyi atıp bitmek arasında kazanan açısından hiçbir fark yoktu — tek
etkisi rakiplerin daha çok yazmasıydı. Okeyi son taş olarak saklamak
oynanabilir bir risk; karşılığı bitirenin kendi puanında görünmeli.

Tur 16'da bu ödül, ×2 çarpanıyla **aynı şarta** bağlıdır
(`tur16OkeyleBitmeCarpani`): çarpanın işlemediği bir turda kazanan da ödül
almaz. Çalma ve işler taş bedelleri -200'ün üstüne aynen eklenir.

### İşler taş atma — 50 puan

Yerdeki bir pere **işlenebilecek** bir taşı ortaya atan oyuncu **50 puan**
ceza yazar. Masaya dikkat etmemenin bedelidir.

Örnek: yerde `kirmizi 7-8-9` duruyor, oyuncunun elinde `kirmizi 10` var.
Onu atarsa o elde ıstakasında kalan taşların toplamına 50 puan eklenir.

- Peri kimin indirdiği fark etmez; ceza **atan** oyuncuya yazılır
- Oyuncunun açmış olması gerekmez; açmamış olan da ceza yazar
- Çarpanlara girmez, çalma cezası gibi en sonda eklenir
- Aynı elde birden çok işler taş atılırsa her biri için 50 puan
- Tur 16'da yere per inmediği için bu ceza işlemez
- **Yerdeki bir okeyin yerine geçen taş da işler sayılır** (0.6, bkz. §9).
  Yerde `kirmizi11 + okey + kirmizi13` varken elindeki `kirmizi12`, ya da
  `kirmizi3 + siyah3 + mavi3 + okey` kütü varken elindeki `sari3` böyledir
- **Eli bitiren atış bu cezayı yemez** (0.5 ile karara bağlandı, bkz. §9).
  Son taşı ortaya atmak dikkatsizlik değil, kazanan hamledir; ayrıca okeyle
  bitmek bu bölümde ×2 ile ödüllendiriliyor. Elin **önceki** atışları için
  ceza aynen geçerlidir

### Tur 16'da çarpanlar

Tur 16'da kimse yere per indirmez, yani teknik olarak kimse "açmış" olmaz.
Buna rağmen **her iki çarpan da işler:** eli bitiren dışındaki herkes
ıstakasında kalanın iki katını yazar; bitiren okeyi dışarı attıysa dört katını.

### Örnek

Elde 120 puanlık taş kaldı, hiç açılamadı, el boyunca 5 kez çalındı:

```
120 * 2 = 240
240 + (5 * 5) = 265
```

### Oyun sonu

16 turun puanları toplanır, **en düşük toplam kazanır**.
Örnek: toplam 600 ceza yedin ama 4 el kazandın → `600 - 400 = 200`.

---

## 9. Karara bağlananlar

0.1'de açık bırakılan yedi madde 27 Ağustos 2026'da karara bağlandı ve ilgili
bölümlere işlendi. Aşağıdaki tablo özet, kaynak metin ilgili bölümdür.

| # | Soru | Karar | Nerede |
|---|---|---|---|
| 1 | Tur 15'te "çift" nedir? | Birebir aynı taş: `kirmizi7 + kirmizi7` | §3 |
| 2 | Tur 4, 5, 9 gerçekten tek per mi? | Evet, §3'teki tablo doğru, değişmiyor | §3 |
| 3 | Tur 16'da "açamadın ×2" işliyor mu? | Evet, bitiren dışında herkes | §8 |
| 4 | Deste tükenince -100 var mı? | Yok. Ceza taşı puanları yine eklenir | §7 |
| 5 | Kazanan çalma cezası öder mi? | Öder: `-100 + 5 × çalış` | §8 |
| 6 | Talep penceresi kaç saniye? | ~~3000 ms~~ → **süresiz**, 0.9 ile değişti | §5, 0.9 |
| 7 | Tur 16'da okeyle bitme çarpanı? | Geçerli; açamama ile birlikte ×4 | §8 |

### 0.3 ile eklenenler (28 Ağustos 2026)

| Konu | Karar | Nerede |
|---|---|---|
| Oyunun dönüş yönü | **Saat yönü** — attığın taşı sağındaki alır | §4, §5 |
| İşler taş atma | 50 puan; çarpana girmez, herkes için geçerli | §8 |
| Kütteki okeyi alma | Kütü dört renge tamamlamak zorunlu | §6 |

Ayrıca 0.1'de hiç yazmayan **tur 15 "çifti bende" hakkı** eklendi (§5).
Bu hakkın nasıl işlediği 0.10 ile netleştirildi.

### 0.4 ile eklenenler (29 Ağustos 2026)

| Konu | Karar | Nerede |
|---|---|---|
| Sıra süresi | **30 → 20 → 10 sn** kademeli; oda ayarı | aşağıda |

**Sıra süresi.** Sırası gelen oyuncu taşını süresi içinde atmazsa yerine
oynanır: çekmediyse desteden çeker, sonra **işine yaramayan** bir taşı atar.

- Süre **iki kez başlar**: sıra oyuncuya geçtiğinde ve her **taş çekmeden**
  sonra. Yani çekmek için ayrı, atmak için ayrı hak verilir.
- Atılacak taş rastgele seçilmez. Sırasıyla elenir: okey, yerdeki bir pere
  işleyen taş (§8 — 50 puan ceza), elde bir pere giren taş. Geriye kalanlardan
  en yüksek puanlısı atılır. Hiçbiri kalmazsa eleme gevşetilir; sıra asla
  kilitlenmez.
- Seçim **deterministiktir**: aynı görünüm her zaman aynı taşı verir.

**Kademe düşüşü.** Süresini dolduran oyuncunun hakkı bir alt kademeye iner ve
sırası her geldiğinde o süreyi kullanır:

| Kaçıncı doluş | Bundan sonraki süre |
|---|---|
| — (hiç dolmadı) | 30 sn |
| 1. | 20 sn |
| 2. ve sonrası | 10 sn |

Son kademede kalır, daha aşağı inmez. Kademe oyuncuya özeldir; oyalanmayanı
etkilemez. El içinde yükselme yoktur — inen kademe o el boyunca inmiş kalır.
**Yeni el başlarken herkes tam süreye döner** (0.7 ile karara bağlandı).

Motorda sayaç yoktur. Ayarın değeri `KuralAyarlari.siraSureleriMs`'te durur;
geri sayımı istemci/sunucu tutar, motora yine `suAn` taşıyan normal bir
aksiyon gelir.

### 0.5 ile eklenenler (29 Ağustos 2026)

| Konu | Karar | Nerede |
|---|---|---|
| Eli bitiren atış ve §8 cezası | Bitiren atış **50 puan ceza yemez** | §8 |

Oyunda karşılaşıldı: elinde iki okey olan oyuncu son taş olarak okeyi atıp
eli bitirdi, çarpanı (×2) kazandı **ama aynı hamle için 50 puan da ceza
yazdı.** Okey yerdeki neredeyse her pere işlediği için, bu ayrım olmadan
okeyle bitmek fiilen her zaman cezalıydı — yani §8 aynı hamleyi hem
ödüllendirip hem cezalandırıyordu.

Karar: **eli bitiren atış §8'in dışındadır**, atılan taş ne olursa olsun.
Gerekçe §8'in kendi ifadesi: ceza "masaya dikkat etmemenin bedeli"dir, oysa
son taşı atmak (§7) elin kazanılma biçimidir. Elin önceki atışları için ceza
aynen işler; §10.6 o atışlar için geçerliliğini korur.

### 0.6 ile eklenenler (29 Ağustos 2026)

| Konu | Karar | Nerede |
|---|---|---|
| Okeyin yerine geçen taş | **İşler sayılır**, atılırsa 50 puan | §8 |

Yerdeki bir perde duran okeyin temsil ettiği gerçek taş elindeyse, o taş
masaya konabilecek bir taştır (§6 — okey çekme). Atmak, §8'in tarif ettiği
"masaya dikkat etmeme" durumudur; ceza işler.

Karar tek bir boşluğu kapatıyor: **dörtlü kütteki okey.**
`kirmizi3 + siyah3 + mavi3 + okey` kütüne beşinci taş eklenemez, ama `sari3`
okeyin yerine geçip okeyi çekebilir — artık o da işler sayılıyor.

> **0.8 ile düzeltildi.** Bu madde önce şöyle örneklendirilmişti: "yerdeki
> `11 + okey + 13` serisine `12` doğrudan eklenebiliyor (okey 10'a kayar,
> 10-11-12-13 olur)". Okeyin kayması 0.8 ile yasaklandı. `12` yine işler
> taştır — ama artık **okeyi çekerek** (§6), okeyi yerinden oynatarak değil.

Kütte okeyi çekmek birden fazla taş gerektirebildiği için (§6 — dört renk
tamamlanmalı) taşın **gereken taşlardan biri** olması aranır; eksik renklerin
hepsi elinde değilse o taş işler sayılmaz.

### 0.7 ile eklenenler (29 Ağustos 2026)

| Konu | Karar | Nerede |
|---|---|---|
| Süre kademesinin ömrü | **Yalnızca o el** — yeni elde sıfırlanır | §9 0.4 |

0.4'te kademe düşüşü kalıcıydı: bir kez gecikmek maçın kalanını 10 saniyeye
mahkûm ediyordu. Ceza artık **yalnızca o eli** kapsıyor; el bitip yenisi
dağıtıldığında herkes 30 saniyeyle başlar.

Gerekçe: kademe, o eldeki oyalanmayı caydırmak için var. 16 tur boyunca
taşınması, tek bir dalgınlığı maç boyu süren bir cezaya çeviriyordu.
El içindeki davranış değişmedi — dolduran her süre bir alt basamağa iner,
en alt basamakta kalır.

### 0.8 ile eklenenler (6 Eylül 2026)

| Konu | Karar | Nerede |
|---|---|---|
| Yerdeki okeyin yeri | **Kımıldamaz** — bir kez indiği sayıda kalır | §6, §8 |

Yere inmiş bir per artık oyuncunun değil masanındır: **taşların yeri
değişmez.** Bu, seride duran okeyi de kapsar — okey hangi taşın yerine
indiyse orada kalır.

- Yerdeki `siyah4 + siyah5 + siyah6 + okey` serisinde okey **siyah7**'dir
- `siyah3` ve `siyah8` işlenebilir; ikisi de okeye dokunmaz
- `siyah2` **işlenemez**: okeyi 3'e kaydırıp seriyi 2-3-4-5-6 yapardı
- `siyah7` işlenemez ama **okeyi çeker** (§6) — okeyin yerine geçen taş odur

Okeyin hangi sayıyı temsil ettiği belirsizse (`11 + 12 + okey` hem 10-11-12
hem 11-12-13 olabilir) okey **mümkün olduğunca sağa** düşer: 11-12-**13**.
Bu zaten perin ekranda gösterildiği düzendi; artık motor da aynı yeri okuyor.

Gerekçe: kayan okey, yere inmiş peri yeniden dizmek demek. Bir oyuncunun
açtığı `4-5-6-okey(7)` serisinin, başkası `siyah2` işlediği için sessizce
`2-3-4-5-6`ya dönüşmesi oyunun kabul ettiği bir hamle değil.

Kütte durum farklı ve **değişmedi**: kütteki okeyin rengi belirsiz olabildiği
için (§6 — dört rengi tamamlama şartı) orada sabitlenecek bir "yer" yok.

### 0.9 ile eklenenler (8 Eylül 2026)

| Konu | Karar | Nerede |
|---|---|---|
| Talep penceresinin süresi | **Kalktı.** Pencere, sırası gelen oyuncu oynayana kadar açıktır | §5 |

0.1'de pencereye 3 saniyelik bir sayaç konmuştu (§9.6) ve sırası gelen oyuncu
o süre boyunca desteden çekemiyordu. İki yönde birden yanlıştı:

- **Hızlı oynayan herkesi bekletiyordu.** Kimse taşı istemese bile sıradaki
  oyuncu her turda 3 saniye duruyordu; 16 turluk bir maçta bu, oyunun
  temposunu görünür biçimde düşürüyordu.
- **Düşünene az geliyordu.** 3 saniye, atılan taşın işine yarayıp
  yaramadığını anlamaya çoğu zaman yetmiyordu.

Yeni kural tek bir cümle: **pencere, sırası gelen oyuncu hamlesini yapana
kadar açıktır.** Tepki süresi artık sabit değil, sırası gelenin düşünme
süresi kadar — o da §9 0.4'ün 30 saniyesiyle zaten sınırlı, yani pencere
sonsuza kadar açık kalamıyor.

Sonuçları:

- Sırası gelen oyuncu **hiç beklemez**; taş atılır atılmaz çekebilir
- Diğerleri, sırası gelen oynamadan **önce** "istiyorum" demek zorunda
- Demezlerse hakları yanar; taş yerde kalır
- Öncelik değişmedi: talep edenlerin en öncelikli olanı alır (§5)
- Tur 15 "çifti bende" hakkı da aynı çizgiye geldi: talep **önce gelmişse**
  sırası gelenin bedelsiz hakkını geçer, gelmemişse geçmez

Motorda karşılığı: `KuralAyarlari.talepPenceresiMs` ve
`TalepPenceresi.acilisZamani` kaldırıldı, `pencere-suresi-dolmadi` hata
kodu silindi. Motor artık talep penceresi için **hiç saat okumuyor** —
CLAUDE.md #2 ile zaten aynı yöne bakan bir sadeleşme.

### 0.10 ile eklenenler (8 Eylül 2026)

| Konu | Karar | Nerede |
|---|---|---|
| "Çiftim var" | **Talep değil, anında sonuçlanan hamle** | §5 |
| Açmış oyuncunun çift hakkı | **Kapanır** — dört çiftten sonra çiftle iş biter | §5, §6 |

**Neden anında.** 0.9'da talep penceresinin süresi kalktı ve pencere artık
sırası gelen oyuncunun hamlesiyle kapanıyor. "Çifti bende" hakkı kuyruğa
giren bir talep olarak kalsaydı, sırası gelen oyuncu ondan önce davranıp taşı
alabilirdi — §5'in "koltuk önceliğinin tamamını geçer" sözü yalnızca yavaş
oynayana karşı geçerli olurdu. Herkesi bekletmek için sayaç koymak ise 0.9'un
kaldırdığı şeydi.

Geriye tek tutarlı okuma kalıyor: **çift talebi geldiği anda taşı alır.**
Bedeli değişmedi (taş + 1 ceza taşı + 5 puan) ve sırayı yine harcamıyor.
Sırası gelen oyuncu taşı kaptırmış olur; desteden çeker.

Bunun bir sonucu: kimin daha önce "istiyorum" dediği artık hiç fark etmiyor.
Normal talepler zaten koltuk önceliğine göre çözülüyordu (§5); çift talebi de
o sıralamanın dışında, kendi başına duruyor.

**Neden açan oyuncuda kapanıyor.** Tur 15'in açılış şartı dört çifttir ve
açıldıktan sonra fazladan çift indirilemez (§6, §10.2) — oyun küt ve seriyle
devam eder. Çift toplamaya devam edebilen bir oyuncu, karşılığı olmayan taşları
ceza ödeyerek biriktirmiş olurdu. Açtıktan sonra "çiftim var" tuşu söner;
oyuncu normal "istiyorum" hakkını kullanmaya devam eder.

Motorda karşılığı: `CIFT_TALEBI` artık durumu doğrudan değiştiriyor,
`TalepPenceresi.ciftTalebi` alanı kalktı, `cift-talebi-oncelikli` ve
`zaten-cift-talebi-var` hata kodları silindi, `ceza-tasi-kalmadi` eklendi.
Ekran için `OyunDurumu.sonCalan` eklendi: atık öbeğinden eksilen taşın kime
gittiğini göstermek gerekiyor.

Motor bu kararlara göre yazıldı; her biri için en az bir test var.

### 0.11 ile eklenenler (8 Eylül 2026)

| Konu | Karar | Nerede |
|---|---|---|
| Okeyle bitirenin puanı | **-100 değil -200** | §8 |

Oyunda fark edildi: okeyle bitmek yalnızca **rakiplerin** yazdığını artırıyor
(×2, açamayanlarda ×4), bitirenin kendi puanında hiçbir karşılığı yok. Elindeki
25 puanlık okeyi son taş olarak saklamak gerçek bir risk — deste tükenirse ya da
biri önce bitirirse 25 puan cebinde kalır — ama kazandığında getirisi normal
bitişle aynı -100'dü. Kural fiilen "rakiplerini cezalandır" idi, "iyi oyna" değil.

Ödül kazananın kendi satırına yazılıyor: **-200**. Çarpanlarla oynanmadı;
rakiplerin ×2/×4'ü aynen duruyor. Tur 16'da ödül `tur16OkeyleBitmeCarpani`
ayarına bağlı — çarpanın kapalı olduğu bir turda kazanan da ödül almasın diye
ikisi tek şarta bağlandı.

Motorda karşılığı: `KAZANAN_OKEYLE_PUANI` sabiti ve `PuanDetayi`de kazanan için
`okeyleBitmeCarpani` bayrağının anlamı ("çarpan yedi" değil, "-200 aldı").

---

## 10. Motorun spesifikasyondan türettiği okumalar

Aşağıdakiler bu dokümanda açıkça yazmıyor; motor bunları buradaki
maddelerden türetti. Yanlışlarsa tek yerde düzeltilir — söylemen yeterli.

1. **Okeyli çift.** §2 "okey her taşın yerine geçer" dediği için
   `kirmizi7 + okey` çift sayıldı. İki okey taşı birebir aynı olduğu için
   `okey + okey` de çift sayıldı.
2. **Tur 15'te fazladan indirme.** §6 "fazladan **küt ve seri**
   indirebilirsin" diyor. Motor bunu harfiyen uyguluyor: açtıktan sonra
   fazladan çift indirilemiyor, yalnızca küt ve seri inebiliyor.
3. **Atık yığınının altı görünmez.** §5 sadece "en üstteki alınabilir,
   altındakiler ölüdür" diyor. Projeksiyon oyunculara yalnızca en üstteki
   taşı ve yığındaki taş sayısını gösteriyor.
4. **Açılış eli boşaltamaz.** §7 bitişin son taşı ortaya atarak olduğunu
   söylüyor. Bu yüzden bir oyuncu açarken ya da işlerken elindeki son taşı
   yere indiremiyor; en az bir taş atmak üzere kalmak zorunda.
5. **Deste bitişinin kenar durumu.** Sırası gelen oyuncu desteden çekerken
   aynı anda bir çalma bedeli de ödenecekse ve deste ikisine birden
   yetmiyorsa, el "deste tükendi" ile kapanıyor.
6. **Kazanan işler taş cezasını da ödüyor.** §9.5'te kazananın çalma
   cezasını ödediği karara bağlandı; motor 50 puanlık işler taş cezasını da
   aynı mantıkla kazanana yazıyor. **Yalnız eli bitiren atış hariç** — 0.5
   ile karara bağlandı (§9). Kazanan, elin daha önceki işler atışları için
   ceza yazmaya devam eder.
7. **İki okeyli kütten okey alınamıyor.** Kütteki okeyi almak dört rengin
   tamamlanmasını gerektirdiği için, içinde iki okey olan bir kütten tek
   okey çekilemiyor — şart hiçbir zaman sağlanamıyor.
8. **El, çekilecek taş kalmayınca kapanıyor.** Deste boşaldığında değil,
   bir oyuncunun çekmesi gerektiği hâlde çekecek taş bulunmadığında.
   Böylece son çekilen taş normal biçimde oynanabiliyor.
