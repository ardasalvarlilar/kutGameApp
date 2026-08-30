# Küt — Kural Spesifikasyonu

> Sürüm 0.7. Kural motoru **yalnızca** bu dokümandan yazılır.
> Burada yazmayan kural oyunda yoktur. Belirsiz bir nokta varsa
> tahmin etme — "Karara bağlananlar" bölümüne bak, orada da yoksa sor.
>
> 0.1'de açık bırakılan yedi madde 27 Ağustos 2026'da karara bağlandı.
> 0.3'te dönüş yönü saat yönüne çevrildi, işler taş cezası ve kütteki okeyi
> alma şartı eklendi. 0.4'te sıra süresi geldi, 0.5'te eli bitiren atış
> işler taş cezasından muaf tutuldu, 0.6'da okeyin yerine geçen taş işler
> sayıldı, 0.7'de süre kademesi el sonunda sıfırlandı (bkz. §9).

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

1. Taş atılır, pencere açılır. 3 ve 4 numaralıda "İstiyorum" butonu belirir.
2. 2 numaralı, taş atıldıktan sonraki **ilk 2–3 saniye desteden çekemez**
   (diğerlerine garanti tepki süresi). Süre yapılandırılabilir olmalı.
3. 2 numaralı taşı alırsa iş biter, talepler düşer.
4. 2 numaralı desteden çekerse pencere kapanır ve o an talepte bulunanların
   **en öncelikli olanı** taşı alır: taş + desteden 1 ceza taşı + 5 puan.
5. Talep **bağlayıcıdır.** İstedin ve sıra sana kaldıysa alırsın, ödersin.

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

Örnek: 1 numaralı `kirmizi7` attı, o taşın eşi 4 numaralının ıstakasında.
2 numaralı taşı alamaz; desteden çeker ve sırasına devam eder. 4 numaralı
taşı alır, desteden 1 ceza taşı çeker, 5 ceza puanı yazar — bedel normal
çalmanın aynısıdır ve sırayı yine harcamaz.

- **Blöf mümkün değildir.** Talep ancak taşın birebir eşi gerçekten ıstakada
  ise geçerlidir; sunucu bunu doğrular ve olmayan talebi reddeder. İstemcideki
  "çifti bende" tuşunun yalnızca eş eldeyken açılması kullanıcı kolaylığıdır,
  güvenlik değil.
- Bir taştan destede iki kopya olduğu için **en fazla bir oyuncu** hak sahibi
  olabilir; iki kişi aynı anda haklı çıkamaz.
- Elinde eş olan yoksa her şey yukarıdaki normal önceliğe göre işler.
- Bu hak sırası gelen oyuncunun hakkını geçtiği için, tur 15'te sırası gelen
  oyuncu **talep penceresi kapanmadan yerden taş alamaz.** Diğer 15 turda
  pencere yalnızca desteden çekmeyi geciktirir.

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

kazanan.puan = -100 + 5 * (çalınan taş sayısı)   // kazanan da çalma bedelini öder
```

**"Okeyle bitti"** = bitiren oyuncunun **ortaya attığı son taşın okey olması**.
Perlerinde okey kullanmış olması bir şey ifade etmez.

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
| 6 | Talep penceresi kaç saniye? | 3000 ms; oda ayarı olarak değiştirilebilir | §5 |
| 7 | Tur 16'da okeyle bitme çarpanı? | Geçerli; açamama ile birlikte ×4 | §8 |

### 0.3 ile eklenenler (28 Ağustos 2026)

| Konu | Karar | Nerede |
|---|---|---|
| Oyunun dönüş yönü | **Saat yönü** — attığın taşı sağındaki alır | §4, §5 |
| İşler taş atma | 50 puan; çarpana girmez, herkes için geçerli | §8 |
| Kütteki okeyi alma | Kütü dört renge tamamlamak zorunlu | §6 |

Ayrıca 0.1'de hiç yazmayan **tur 15 "çifti bende" hakkı** eklendi (§5).

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

Çoğu durumda bu zaten böyleydi: yerdeki `11 + okey + 13` serisine `12`
**doğrudan eklenebiliyor** (okey 10'a kayar, 10-11-12-13 olur), yani `12`
eskiden de işler taştı. Karar tek bir boşluğu kapatıyor: **dörtlü kütteki
okey.** `kirmizi3 + siyah3 + mavi3 + okey` kütüne beşinci taş eklenemez, ama
`sari3` okeyin yerine geçip okeyi çekebilir — artık o da işler sayılıyor.

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

Motor bu kararlara göre yazıldı; her biri için en az bir test var.

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
