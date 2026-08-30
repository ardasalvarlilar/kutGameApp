# Sesler

Buradaki üç dosya oyunda çalınıyor. Şu an duran sesler **geçici** — kod
üretti, gerçek bir kayıt değil. Beğenmediğin sesi aynı adla, aynı klasöre
kopyalaman yeterli; kodda değişiklik gerekmiyor.

| Dosya | Ne zaman çalar |
|---|---|
| `at.wav` | Taş ortaya atıldığında |
| `cek.wav` | Desteden ya da yerden taş çekildiğinde |
| `isle.wav` | Yerdeki bir pere taş işlendiğinde |

## Yeni ses koyarken

- **Ad ve uzantı aynı kalmalı**: `at.wav`, `cek.wav`, `isle.wav`.
  Başka bir uzantı (`.mp3` gibi) kullanacaksan `src/ses.ts` içindeki
  `require` satırlarını da değiştir.
- **Kısa olsun**: 100–250 ms. Uzun ses, hızlı oynanışta üst üste biner.
- **Baştan sessizlik olmasın.** Dosyanın başındaki boşluk, sesin geç
  gelmesi demek; taş ekranda düştükten sonra çalarsa yanlış hissettirir.
- **Sonu fade ile bitsin**, yoksa "klik" duyulur.
- Mono, 44.1 kHz yeterli. Stereo da çalışır ama gereksiz büyütür.

## Nereden bulunur

Ücretsiz ve ticari kullanıma açık kaynaklar: freesound.org (CC0 filtresi),
pixabay.com/sound-effects, mixkit.co. Aranacak terimler: *"mahjong tile
click"*, *"wooden tile place"*, *"domino click"*, *"poker chip"*.

Okey taşı sesine en yakını mahjong/domino kayıtlarıdır — plastik-ahşap arası
tok bir "tak".

## Ses açma/kapama

Oyun içindeki `AYARLAR` düğmesinden kapatılabiliyor. Tercih yalnızca o
oturum için geçerli; kalıcı kayıt sunucu/hesap işiyle birlikte gelecek.
