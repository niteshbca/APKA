import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'icons');

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function inRoundedRect(x, y, rx, ry, rw, rh, r) {
  if (x < rx || x > rx + rw || y < ry || y > ry + rh) return false;
  const cx = Math.min(Math.max(x, rx + r), rx + rw - r);
  const cy = Math.min(Math.max(y, ry + r), ry + rh - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function drawIcon(size) {
  const g = 22, r = 163, b = 74;
  const white = [255, 255, 255, 255];
  const bg = [g, r, b, 255];
  const rgba = Buffer.alloc(size * size * 4);
  const s = size / 512;
  const bgRound = size * 0.18;
  const tx = size * 0.22, ty = size * 0.14, tw = size * 0.56, th = size * 0.72, tr = size * 0.05;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (!inRoundedRect(x, y, size * 0.04, size * 0.04, size * 0.92, size * 0.92, bgRound)) {
        rgba[i] = rgba[i + 1] = rgba[i + 2] = rgba[i + 3] = 0;
        continue;
      }
      rgba[i] = bg[0]; rgba[i + 1] = bg[1]; rgba[i + 2] = bg[2]; rgba[i + 3] = 255;

      if (!inRoundedRect(x, y, tx, ty, tw, th, tr)) continue;
      rgba[i] = white[0]; rgba[i + 1] = white[1]; rgba[i + 2] = white[2];

      const lx = tx + tw * 0.12, lw = tw * 0.76;
      const barH = th * 0.30, barTop = ty + th * 0.10;
      if (y >= barTop && y <= barTop + barH && x >= lx && x <= lx + lw) {
        const rel = (x - lx) / lw;
        if (rel > 0.72) rgba[i] = rgba[i + 1] = rgba[i + 2] = 255;
        else if ((rel * 18 | 0) % 3 === 0) { rgba[i] = g; rgba[i + 1] = r; rgba[i + 2] = b; }
      }

      const dashY = ty + th * 0.62;
      if (Math.abs(y - dashY) < size * 0.008 && x >= tx + tw * 0.12 && x <= tx + tw * 0.88) {
        const rel = (x - (tx + tw * 0.12)) / (tw * 0.76);
        if ((rel * 8 | 0) % 2 === 0) { rgba[i] = g; rgba[i + 1] = r; rgba[i + 2] = b; }
      }

      const dotCx = tx + tw / 2, dotCy = ty + th * 0.82, dotR = size * 0.05;
      if ((x - dotCx) ** 2 + (y - dotCy) ** 2 <= dotR * dotR) { rgba[i] = g; rgba[i + 1] = r; rgba[i + 2] = b; }
    }
  }
  return rgba;
}

mkdirSync(OUT, { recursive: true });
for (const size of [192, 512]) {
  const png = encodePNG(size, size, drawIcon(size));
  const file = join(OUT, `icon-${size}.png`);
  writeFileSync(file, png);
  console.log(`wrote ${file} (${png.length} bytes)`);
}
