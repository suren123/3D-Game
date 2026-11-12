// Original car mark from index.html, rasterized locally without dependencies.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const output = fileURLToPath(new URL('../public/icons/', import.meta.url));
mkdirSync(output, { recursive: true });
const cream = [248, 247, 237];
const yellow = [255, 203, 105];
const coral = [238, 115, 90];
const dark = [41, 78, 72];

function markColor(x, y) {
  for (const cx of [22, 43]) {
    if ((x - cx) ** 2 + (y - 47) ** 2 <= 36) return dark;
  }
  if (x >= 14 && x <= 50 && y >= 31 && y <= 47) return coral;
  if (y >= 20 && y <= 33) {
    const t = (y - 20) / 13;
    if (x >= 22 - 5 * t && x <= 41 + 6 * t) return coral;
  }
  // Rounded yellow tile; the surrounding cream remains opaque on Apple icons.
  if (x >= 3 && x <= 61 && y >= 3 && y <= 61) {
    const nx = Math.max(21 - x, 0, x - 43);
    const ny = Math.max(21 - y, 0, y - 43);
    if (nx * nx + ny * ny <= 18 * 18) return yellow;
  }
  return cream;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

function png(size) {
  const samples = 4;
  const scanlines = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sum = [0, 0, 0];
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const color = markColor((x + (sx + 0.5) / samples) * 64 / size,
            (y + (sy + 0.5) / samples) * 64 / size);
          for (let channel = 0; channel < 3; channel++) sum[channel] += color[channel];
        }
      }
      const offset = y * (size * 3 + 1) + 1 + x * 3;
      for (let channel = 0; channel < 3; channel++) {
        scanlines[offset + channel] = Math.round(sum[channel] / (samples * samples));
      }
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2; // RGB, no alpha.
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(scanlines)), chunk('IEND', Buffer.alloc(0))]);
}

for (const [filename, size] of [
  ['apple-touch-icon.png', 180], ['icon-192.png', 192],
  ['icon-512.png', 512], ['favicon-32.png', 32],
]) {
  writeFileSync(`${output}${filename}`, png(size));
  console.log(`${filename}: ${size}×${size}`);
}
