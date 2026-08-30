# EAS derlemesi — bilinmesi gerekenler

`eas.json` üç profil taşıyor. Hepsinde tek bir değişken kritik:
**`EXPO_PUBLIC_SUNUCU_URL`**.

| Profil | Ne için | Sunucu adresi |
|---|---|---|
| `development` | Geliştirme derlemesi (dev client) | makinenin yerel IP'si |
| `preview` | TestFlight / iç dağıtım | üretim alan adı |
| `production` | App Store | üretim alan adı |

`preview` ve `production` içindeki `kut.alanadin.com` adresini **kendi alan
adınla değiştir**. Üç yerde geçiyor: `eas.json`'daki iki profil ve
`src/ag/sunucu.ts` içindeki `VARSAYILAN`.

## Neden `EXPO_PUBLIC_` öneki

Expo yalnızca bu önekli değişkenleri istemci paketine gömer. Öneksiz yazılan
bir değişken telefonda `undefined` gelir; uygulama "sunucuya bağlanılamadı"
der ve sebebi görünmez.

## `.env.local` EAS'e gitmez

`apps/mobile/.env.local` `.gitignore`'da (`.env.*` kuralıyla). EAS derlemeyi
git'ten aldığı için o dosya yüklemeye **karışmaz** — yerel `localhost:4000`
adresin yanlışlıkla mağazaya gitmez. Adres `eas.json`'daki `env` alanından
gelir.

## `autoIncrement`

`production` profilinde açık: her derlemede `buildNumber` bir artar. App Store
Connect aynı yapı numarasını iki kez kabul etmiyor; elle takip etmek unutulan
bir adım oluyordu.
