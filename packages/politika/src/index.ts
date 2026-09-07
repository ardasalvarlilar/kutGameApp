// @kut/politika — oyuncu politikasi.
//
// --- Neden ayri bir paket ----------------------------------------------------
//
// Motor KURALI soyler ("bu hamle gecerli mi"), politika TERCIHI ("hangi
// hamle"). Ikisi ayri sorular ve ayri yerlerde durmali:
//
//   packages/engine   — kural. KURALLAR.md'nin tek karsiligi.
//   packages/politika — tercih. Yer tutucu oyuncu, sure dolunca yerine
//                       oynama, istakayi otomatik dizme.
//
// Bu kod eskiden `apps/mobile/src/{bot,dizme,sure}.ts`teydi ve sunucunun
// `soket/yerineOyna.ts`inde bir de kopyasi vardi — MIMARI.md bunu "ortak bir
// politika paketine cikarilmali" diye not etmisti. Online masaya BOT
// eklenince ikisinin ayri kalmasi imkansizlasti: sunucudaki bot ile
// cevrimdisi masadaki botun ayni oynamasi gerekiyor.
//
// --- Motorun kurallari burada de gecerli --------------------------------------
//
// 1. SAF. Yan etki yok; `tsconfig.json`da `types: []` bunu derlemede
//    zorluyor — Node ya da DOM API'si giren satir derlenmiyor.
// 2. RASTGELELIK YOK. `Math.random` ve `Date.now` burada da yasak: ayni
//    gorunum her zaman ayni hamleyi vermeli (motor kurali #2 ile ayni gerekce
//    — el kaydindan yeniden oynatilabilmesi lazim).
// 3. YALNIZCA PROJEKSIYON OKUNUR. Bot `OyuncuGorunumu` goruyor, tam durumu
//    degil: insandan fazlasini gormuyor (motor kurali #3).

export * from './bot';
export * from './dizme';
export * from './sure';
