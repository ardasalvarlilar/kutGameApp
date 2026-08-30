import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Motorun kendi kurallarina uydugunu insan dikkatine birakmiyoruz.
// CLAUDE.md motor kurallari #1 (yan etki yok) ve #2 (rastgelelik yok).

const src = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');

/** Yorumlari ayiklar — yasak ifadelerin yorumda gecmesi sorun degil. */
function kodu(icerik: string): string {
  return icerik.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const dosyalar = readdirSync(src)
  .filter((ad) => ad.endsWith('.ts'))
  .map((ad) => ({ ad, kod: kodu(readFileSync(join(src, ad), 'utf8')) }));

describe('motorun safligi', () => {
  it('kaynak dosyalari bulundu', () => {
    expect(dosyalar.length).toBeGreaterThan(8);
  });

  it.each([
    ['Math.random', /\bMath\.random\b/],
    ['Date.now', /\bDate\.now\b/],
    ['new Date', /\bnew Date\b/],
    ['console', /\bconsole\s*\./],
    ['setTimeout', /\bsetTimeout\b/],
    ['setInterval', /\bsetInterval\b/],
    ['fetch', /\bfetch\s*\(/],
    ['process', /\bprocess\s*\./],
    ['any tipi', /:\s*any\b|<any>|\bas any\b/],
  ])('kodda %s gecmiyor', (_ad, kalip) => {
    for (const dosya of dosyalar) {
      expect(kalip.test(dosya.kod), `${dosya.ad}`).toBe(false);
    }
  });
});
