# Iki asamali derleme: mobil uygulamanin KODLARI imaja girmez.
#
# Kaynak monorepo'da duruyor cunku sunucu ile mobil AYNI motoru VE AYNI bot
# politikasini paylasiyor (@kut/engine, @kut/politika). Ikisinin ikinci bir
# kopyasi olsaydi kurallar zamanla birbirinden ayrilirdi — projenin en temel
# degeri bunun olmamasi. Yeni bir workspace paketi @kut/server'a bagimlilik
# olarak eklendiginde BURAYA da (manifest + kaynak kopyalari) eklenmesi
# gerekiyor; pnpm'in workspace baglantisi Docker katmanlarini otomatik takip
# etmiyor.
#
# Calisan imaja giren: `dist/index.js` (motor VE politika bundle'in ICINDE) +
# yalnizca URETIM bagimliliklari. express/socket.io/mongoose bilerek
# bundle'a ALINMIYOR — dinamik require ve native eklenti kullaniyorlar,
# paketlenince calismiyorlar. Motor ve politika saf TypeScript oldugu icin
# sorunsuz bundle'a giriyor.

FROM node:22-alpine AS derleme
WORKDIR /uygulama
RUN corepack enable

# Once yalnizca manifestler: bagimlilik katmani onbellege alinsin, kaynak
# degistiginde yeniden kurulum yapilmasin.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/politika/package.json packages/politika/
COPY packages/server/package.json packages/server/
# apps/mobile'in yalnizca MANIFESTI: lockfile onu tanidigi icin dosya yoksa
# `--frozen-lockfile` "lockfile guncel degil" diye kirilir. Kodu kopyalanmiyor
# ve `--filter @kut/server...` sayesinde bagimliliklari da kurulmuyor.
COPY apps/mobile/package.json apps/mobile/

RUN pnpm install --frozen-lockfile --filter @kut/server...

# Sunucu, motorun ve politikanin kaynagi — apps/mobile/src hic kopyalanmiyor.
COPY tsconfig.base.json ./
COPY packages/engine packages/engine
COPY packages/politika packages/politika
COPY packages/server packages/server

RUN pnpm --filter @kut/server build

# Uretim bagimliliklarini bagimsiz, duz bir node_modules olarak topla.
# `pnpm deploy` tam bu is icin var: workspace baglarini cozup tek klasor verir.
RUN pnpm deploy --filter @kut/server --prod --legacy /paket


FROM node:22-alpine AS calisma
WORKDIR /uygulama
ENV NODE_ENV=production

# Kok yetkisiyle calismasin.
RUN addgroup -S kut && adduser -S kut -G kut
COPY --from=derleme --chown=kut:kut /paket/node_modules ./node_modules
COPY --from=derleme --chown=kut:kut /uygulama/packages/server/dist ./dist
COPY --from=derleme --chown=kut:kut /uygulama/packages/server/package.json ./package.json
USER kut

EXPOSE 4000

# Traefik ve compose saglikli olup olmadigini buradan anliyor. Alpine'da curl
# yok; Node'un kendi fetch'i yeterli.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/saglik').then(y=>process.exit(y.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
