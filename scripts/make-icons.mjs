// Dependency-free PNG icon generator (gradient sky + little red train). Run: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

function crc32(buf) {
  let c, crc = ~0;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return ~crc >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function render(size) {
  const px = Buffer.alloc(size * size * 4);
  const S = size / 512;
  const rrect = (x, y, x0, y0, w, h, r) => {
    x /= S; y /= S;
    const cx = Math.min(Math.max(x, x0 + r), x0 + w - r), cy = Math.min(Math.max(y, y0 + r), y0 + h - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
  const circ = (x, y, cx, cy, r) => (x / S - cx) ** 2 + (y / S - cy) ** 2 <= r * r;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let c = mix([59, 58, 140], [255, 157, 124], y / size);
      if (circ(x, y, 380, 130, 48)) c = [255, 246, 214];
      if (rrect(x, y, 40, 436, 432, 14, 7)) c = [47, 43, 69];
      if (rrect(x, y, 96, 250, 250, 130, 22) || rrect(x, y, 300, 190, 120, 190, 18)) c = [224, 68, 62];
      if (rrect(x, y, 322, 214, 76, 62, 10)) c = [255, 233, 168];
      if (rrect(x, y, 116, 196, 46, 70, 10)) c = [47, 43, 69];
      if (circ(x, y, 160, 400, 40) || circ(x, y, 260, 400, 40) || circ(x, y, 370, 400, 40)) c = [47, 43, 69];
      if (circ(x, y, 430, 300, 22)) c = [255, 243, 192];
      const i = (y * size + x) * 4;
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
    }
  }
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public', { recursive: true });
writeFileSync('public/icon-180.png', render(180));
writeFileSync('public/icon-512.png', render(512));
console.log('icons written');
