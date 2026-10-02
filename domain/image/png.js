/* aWardrobe domain: a small PNG writer for 8-bit greyscale pictures, used for alpha masks
   (architecture 5.6). Browsers decode greyscale PNGs natively but can only write colour ones,
   so this writes the file by hand: the rows, deflated with the browser's own compressor, inside
   the three chunks a PNG needs. */
import { crc32, adler32 } from '../crc32.js';

const SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const be32 = (n) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const ascii = (s) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

function chunk(type, data) {
  const t = ascii(type);
  const body = new Uint8Array(t.length + data.length);
  body.set(t, 0);
  body.set(data, t.length);
  return [be32(data.length), body, be32(crc32(body))];
}

async function deflate(raw) {
  if (typeof CompressionStream === 'function') {
    const stream = new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  /* no compressor: a valid zlib stream of stored blocks, bigger but correct */
  const parts = [new Uint8Array([0x78, 0x01])];
  for (let off = 0; off < raw.length; off += 65535) {
    const len = Math.min(65535, raw.length - off);
    const last = off + len >= raw.length ? 1 : 0;
    parts.push(new Uint8Array([last, len & 255, (len >>> 8) & 255, ~len & 255, (~len >>> 8) & 255]));
    parts.push(raw.subarray(off, off + len));
  }
  if (!raw.length) parts.push(new Uint8Array([1, 0, 0, 255, 255]));
  parts.push(be32(adler32(raw)));
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/* bytes: one byte per pixel, row by row. Returns a Blob of type image/png. */
export async function encodeGrayPng(bytes, w, h) {
  const raw = new Uint8Array(h * (w + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w + 1)] = 0;
    raw.set(bytes.subarray(y * w, (y + 1) * w), y * (w + 1) + 1);
  }
  const ihdr = new Uint8Array(13);
  ihdr.set(be32(w), 0);
  ihdr.set(be32(h), 4);
  ihdr[8] = 8;
  ihdr[9] = 0;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = await deflate(raw);
  return new Blob([SIGNATURE, ...chunk('IHDR', ihdr), ...chunk('IDAT', idat), ...chunk('IEND', new Uint8Array(0))], { type: 'image/png' });
}
