import { defineConfig } from 'vitest/config';

// Yalnizca saf mantik test edilir (dizme gibi). React Native bilesenleri
// bu kosucuya girmez.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
