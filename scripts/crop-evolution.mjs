// Cuts the matching section pairs for the design comparer out of the page captures: the first version's
// full-page capture (content/evolution/v1) and the current version's viewport captures (content/evolution/v2,
// one per language, taken with scripts/capture-evolution.mjs). Both sides come out as a "screen" of the site
// with its header on top: the first version's header is fixed to the top of its page, so it is pasted over
// each cut. The regions live in content/evolution/compare.json. Writes WebP files to public/images/evolution/.
// Run by hand when a capture or a region changes: node scripts/crop-evolution.mjs
import { mkdirSync, readFileSync } from 'node:fs';
import sharp from 'sharp';

const { width, height, v1: first, pairs } = JSON.parse(readFileSync('content/evolution/compare.json', 'utf8'));
const [r, g, b] = first.background;
const background = { r, g, b, alpha: 1 };
const out = 'public/images/evolution';
mkdirSync(out, { recursive: true });
const V1 = 'content/evolution/v1/desktop-full-1440.png';

/** Thumbnails: half of the first version's cut and half of the current one's, side by side. */
const THUMB_WIDTH = 360;
const THUMB_HEIGHT = Math.round((THUMB_WIDTH * height) / width);
const half = THUMB_WIDTH / 2;
async function thumb(firstImage, currentFile, file) {
  const left = await firstImage.clone().resize(THUMB_WIDTH, THUMB_HEIGHT).extract({ left: 0, top: 0, width: half, height: THUMB_HEIGHT }).toBuffer();
  const right = await sharp(currentFile).extract({ left: 0, top: 0, width, height }).resize(THUMB_WIDTH, THUMB_HEIGHT).extract({ left: half, top: 0, width: half, height: THUMB_HEIGHT }).toBuffer();
  await sharp({ create: { width: THUMB_WIDTH, height: THUMB_HEIGHT, channels: 3, background } })
    .composite([{ input: left, left: 0, top: 0 }, { input: right, left: half, top: 0 }])
    .webp({ quality: 78 })
    .toFile(`${out}/${file}`);
}

const save = (image, file) => image.webp({ quality: 82 }).toFile(`${out}/${file}`);

/** A screen of the first version: its header (if asked) and then a cut of the page, padded with the page colour. */
async function cutFirst({ top, header, body }) {
  const head = header ? first.header : 0;
  const bodyHeight = body ?? height - head;
  const pieces = [];
  if (header) {
    pieces.push({ input: await sharp(V1).extract({ left: 0, top: 0, width, height: head }).toBuffer(), top: 0, left: 0 });
  }
  pieces.push({
    input: await sharp(V1).extract({ left: 0, top, width, height: bodyHeight }).toBuffer(),
    top: head,
    left: 0,
  });
  return sharp({ create: { width, height, channels: 3, background } }).composite(pieces);
}

for (const pair of pairs) {
  const firstImage = await cutFirst(pair.v1);
  await save(firstImage.clone(), `v1-${pair.id}.webp`);
  const firstBuffer = sharp(await firstImage.clone().png().toBuffer());
  for (const lang of ['es', 'en']) {
    await thumb(firstBuffer, `content/evolution/v2/${lang}-${pair.id}.png`, `thumb-${lang}-${pair.id}.webp`);
    await save(
      sharp(`content/evolution/v2/${lang}-${pair.id}.png`).extract({ left: 0, top: pair.v2.top, width, height }),
      `v2-${lang}-${pair.id}.webp`,
    );
  }
}
console.log('done');
