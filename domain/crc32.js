/* aWardrobe domain: the checksums that PNG and zip files require. Pure. */
const TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  TABLE[n] = c >>> 0;
}
/* a running CRC-32: update() with each piece, value() at the end */
export function crc32Stream() {
  let c = 0xffffffff;
  return {
    update(bytes) {
      for (let i = 0; i < bytes.length; i++) c = TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    },
    value: () => (c ^ 0xffffffff) >>> 0
  };
}
export function crc32(bytes) {
  const s = crc32Stream();
  s.update(bytes);
  return s.value();
}
/* the checksum zlib streams end with */
export function adler32(bytes) {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}
