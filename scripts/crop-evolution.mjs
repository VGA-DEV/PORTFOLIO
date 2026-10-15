// Cuts the matching section pairs for the design comparer out of the page captures: the first version's
// full-page capture (content/evolution/v1) and the current version's viewport captures (content/evolution/v2,
// one per language). The regions live in content/evolution/compare.json. Writes WebP files to
// public/images/evolution/. Run by hand when a capture or a region changes: node scripts/crop-evolution.mjs
import { mkdirSync, readFileSync } from 'node:fs';
import sharp from 'sharp';

const { width, height, pairs } = JSON.parse(readFileSync('content/evolution/compare.json', 'utf8'));
const out = 'public/images/evolution';
mkdirSync(out, { recursive: true });

const cut = (src, top, file) =>
  sharp(src)
    .extract({ left: 0, top, width, height })
    .webp({ quality: 82 })
    .toFile(`${out}/${file}`);

for (const pair of pairs) {
  await cut('content/evolution/v1/desktop-full-1440.png', pair.v1, `v1-${pair.id}.webp`);
  for (const lang of ['es', 'en']) {
    await cut(`content/evolution/v2/${lang}-${pair.id}.png`, pair.v2, `v2-${lang}-${pair.id}.webp`);
  }
}
console.log('done');
