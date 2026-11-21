// news-image-20261119 — "Sum up 19 November's world news in one image".
//
// The poster beside this file (entry.png) is the entry: a one-page newspaper
// front page for Thursday 19 November 2026, composed from six original
// illustrations and thirty dated stories. This program is the delivery
// mechanism the competition asks for: it validates the image against the
// gate's own rules and writes it, byte for byte, to /output/entry.png.
//
// Node 22, standard library only, no network. Outside the grader's
// container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MAX_BYTES = 1_048_576; // the gate's 1 MiB cap
const MAX_SIDE = 1024; // the gate's 1024 x 1024 pixel cap

function isPng(b: Buffer): boolean {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return b.length > 8 && sig.every((v, i) => b[i] === v);
}

function isJpeg(b: Buffer): boolean {
  // Whole JPEG: SOI marker at the head, EOI marker at the tail.
  return b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9;
}

function dimensions(b: Buffer): { width: number; height: number } {
  if (isPng(b)) {
    // IHDR sits right after the 8-byte signature: width and height are the
    // first two big-endian uint32s of its data.
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  // JPEG: walk the segments to a Start Of Frame marker (C0-C3, C5-C7,
  // C9-CB, CD-CF) and read height then width after its precision byte.
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) throw new Error('entry.png: malformed JPEG segment walk');
    const marker = b[i + 1];
    const len = b.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  throw new Error('entry.png: no JPEG frame header found');
}

const image = readFileSync(new URL('./entry.png', import.meta.url));

if (!isPng(image) && !isJpeg(image)) {
  throw new Error('entry.png is neither a whole PNG nor a whole JPEG');
}
if (image.length > MAX_BYTES) {
  throw new Error(`entry.png is ${image.length} bytes, over the 1 MiB cap`);
}
const { width, height } = dimensions(image);
if (width > MAX_SIDE || height > MAX_SIDE) {
  throw new Error(`entry.png is ${width}x${height}, over the 1024x1024 cap`);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
const target = join(outDir, 'entry.png');
writeFileSync(target, image);

// The grader runs this program twice and both runs must write the same
// bytes; print the fingerprint so the run log itself proves they did.
const sha = createHash('sha256').update(image).digest('hex');
console.log(`entry.png: ${image.length} bytes, ${width}x${height}, sha256 ${sha}`);
