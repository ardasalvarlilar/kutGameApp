import { defineConfig } from 'tsup';

// Sunucu tek dosyaya paketleniyor; @kut/engine ve @kut/politika bundle'in
// ICINE giriyor — motorun ve bot politikasinin ikinci bir kopyasi hicbir
// zaman olusmuyor (CLAUDE.md: kuralin tek kaynagi motordur, botun tek
// kaynagi politikadir).
//
// npm bagimliliklari (express, socket.io, mongoose) DISARIDA birakiliyor:
// dinamik require ve native eklenti kullandiklari icin paketlenince
// calismiyorlar. Uretimde node_modules gerekiyor; Dockerfile bunu
// `pnpm deploy --prod` ile topluyor.
export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  sourcemap: true,
  clean: true,
  // Yerel calisan bagimliliklar bundle'a girmesin; node_modules'tan gelsinler.
  noExternal: ['@kut/engine', '@kut/politika'],
});
