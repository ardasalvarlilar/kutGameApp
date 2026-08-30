import { defineConfig } from 'vitest/config';

// Saf mantik testleri: Mongo ya da acik soket gerektiren test yok.
// Oyun akisi motorun uzerinde bellekte dogrulanir.
//
// Ortam degiskenleri burada veriliyor ki testler gelistiricinin `.env`
// dosyasina BAGLI OLMASIN — CI'da da, temiz bir klonda da ayni kossunlar.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      MONGO_URI: 'mongodb://127.0.0.1:27017/kut-test',
      JWT_GIZLI: 'test-ortami-icin-yeterince-uzun-sahte-anahtar',
      JWT_OMRU: '1h',
    },
  },
});
