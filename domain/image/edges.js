/* aWardrobe domain: the final cut-out (FR-30), done once at save. Erode the outer ring of mixed
   pixels, feather the edge, give the rim and a band outside it the garment's own colour so no
   halo of background shows and JPEG compression has nothing dark to bleed in, then trim. Pure. */
import { bbox } from './mask.js';

/* Drops the outermost ring of kept pixels (and the picture's border). */
export function erode1(mask, w, h) {
  const out = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (mask[p] > 127 && mask[p - 1] > 127 && mask[p + 1] > 127 && mask[p - w] > 127 && mask[p + w] > 127) out[p] = 255;
    }
  }
  return out;
}

/* Two passes of a 3 by 3 average: a soft edge about two pixels wide, the inside untouched. */
export function feather(mask, w, h) {
  let cur = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) cur[i] = mask[i] > 127 ? 255 : 0;
  const tmp = new Float32Array(w * h);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const l = x > 0 ? cur[row + x - 1] : cur[row + x];
        const r = x < w - 1 ? cur[row + x + 1] : cur[row + x];
        tmp[row + x] = (l + cur[row + x] + r) / 3;
      }
    }
    for (let y = 0; y < h; y++) {
      const up = y > 0 ? (y - 1) * w : y * w;
      const down = y < h - 1 ? (y + 1) * w : y * w;
      for (let x = 0; x < w; x++) cur[y * w + x] = (tmp[up + x] + tmp[y * w + x] + tmp[down + x]) / 3;
    }
  }
  const out = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) out[i] = Math.round(cur[i]);
  return out;
}

/* Gives every pixel that is not fully opaque, within `passes` pixels of the opaque region, the
   average colour of its already-coloured neighbours (all eight), working outwards one ring per
   pass. The soft edge is four pixels wide (two inside the eroded outline, two outside); eight
   passes colour it and four pixels beyond, so an 8 by 8 JPEG block that straddles the edge has
   nothing foreign in it to bleed. */
export const DECONTAMINATE_PASSES = 8;
export function decontaminate(rgba, alpha, w, h, passes) {
  passes = passes || DECONTAMINATE_PASSES;
  let solid = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) solid[p] = alpha[p] === 255 ? 1 : 0;
  const fills = [];
  for (let pass = 0; pass < passes; pass++) {
    const next = solid.slice();
    fills.length = 0;
    for (let y = 0; y < h; y++) {
      const y0 = y > 0 ? y - 1 : y;
      const y1 = y < h - 1 ? y + 1 : y;
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (solid[p]) continue;
        const x0 = x > 0 ? x - 1 : x;
        const x1 = x < w - 1 ? x + 1 : x;
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let yy = y0; yy <= y1; yy++) {
          for (let xx = x0; xx <= x1; xx++) {
            const q = yy * w + xx;
            if (!solid[q]) continue;
            r += rgba[q * 4];
            g += rgba[q * 4 + 1];
            b += rgba[q * 4 + 2];
            n++;
          }
        }
        if (!n) continue;
        fills.push(p, Math.round(r / n), Math.round(g / n), Math.round(b / n));
        next[p] = 1;
      }
    }
    for (let i = 0; i < fills.length; i += 4) {
      const o = fills[i] * 4;
      rgba[o] = fills[i + 1];
      rgba[o + 1] = fills[i + 2];
      rgba[o + 2] = fills[i + 3];
    }
    solid = next;
    if (!fills.length) break;
  }
  return rgba;
}

/* The box round the visible part with a margin of 3% of its own size, clamped. Inclusive. */
export function trim(alpha, w, h, marginFrac, threshold) {
  const box = bbox(alpha, w, h, threshold === undefined ? 8 : threshold);
  if (!box) return null;
  const frac = marginFrac === undefined ? 0.03 : marginFrac;
  const mx = Math.round((box.x1 - box.x0 + 1) * frac);
  const my = Math.round((box.y1 - box.y0 + 1) * frac);
  return { x0: Math.max(0, box.x0 - mx), y0: Math.max(0, box.y0 - my), x1: Math.min(w - 1, box.x1 + mx), y1: Math.min(h - 1, box.y1 + my) };
}

/* The whole pure part of saving: erode, feather, decontaminate, trim. Returns the cropped pixels
   (with the garment colour under and around the soft edge) and the cropped alpha. */
export function finalCutout(rgba, mask, w, h, opts) {
  opts = opts || {};
  const eroded = erode1(mask, w, h);
  const alpha = feather(eroded, w, h);
  const colour = new Uint8ClampedArray(rgba);
  decontaminate(colour, alpha, w, h, opts.passes || DECONTAMINATE_PASSES);
  const box = trim(alpha, w, h, opts.margin) || { x0: 0, y0: 0, x1: w - 1, y1: h - 1 };
  const cw = box.x1 - box.x0 + 1;
  const ch = box.y1 - box.y0 + 1;
  const outRgba = new Uint8ClampedArray(cw * ch * 4);
  const outAlpha = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++) {
    const srow = (box.y0 + y) * w + box.x0;
    outRgba.set(colour.subarray(srow * 4, (srow + cw) * 4), y * cw * 4);
    outAlpha.set(alpha.subarray(srow, srow + cw), y * cw);
  }
  return { rgba: outRgba, alpha: outAlpha, width: cw, height: ch, box };
}
