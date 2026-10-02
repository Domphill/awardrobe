/* aWardrobe domain: skin detection, for photos of someone wearing the garment (FR-43). A pixel is
   skin when its colour falls in the usual range of skin tones in YCbCr, the colour space that
   separates brightness from hue. Pure. */

export function isSkin(r, g, b) {
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173 && r > 95 && g > 40 && b > 20 && r > g && r > b && r - Math.min(g, b) > 15;
}

/* Removes skin-coloured pixels from the mask. Returns how many it removed. */
export function removeSkin(rgba, w, h, mask) {
  let n = 0;
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    if (mask[p] <= 127) continue;
    if (isSkin(rgba[i], rgba[i + 1], rgba[i + 2])) {
      mask[p] = 0;
      n++;
    }
  }
  return n;
}
