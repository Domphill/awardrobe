/* aWardrobe domain: the automatic cut-out (FR-23 to FR-27). Learns what the background looks like
   from several shades round the photo's edges and what the garment looks like from the middle,
   both in OKLab, then sorts every pixel between the two with the strength control leaning the
   decision. Shadows of the background are modelled as darker copies of its shades, so a cast
   shadow next to the garment counts as background. Pure maths; the worker runs it. */
import { smooth, dropSpecks, fillHoles, coverage, growFrom, toleranceThreshold } from './mask.js';

const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
const ANALYSIS_SIDE = 320;
const CLASSIFY_SIDE = 640;
const BORDER_BAND = 0.06;
const CENTRE_FROM = 0.22;
const CENTRE_TO = 0.78;
const FG_TIERS = [0.11, 0.035];
const MERGE_DISTANCE = 0.03;
const LOW_CONTRAST = 0.08;
const SHADOW_LEVELS = [0.85, 0.72];
const SHADOW_PENALTY = 0.05;
const L_WEIGHT = 0.6;
const MIN_SHADE_SHARE = 0.01;
const LOPSIDED_EDGE = 0.8;
const LOPSIDED_CENTRE = 0.1;
const LIGHTER_STEP = 0.12;
const CORNER_BOX = 0.1;
const CORNER_MIN = 0.15;
const NEAR_ANCHOR = 0.1;
const WHOLE_PHOTO_MIN = 0.002;
const WHOLE_PHOTO_MAX = 0.97;

/* OKLab of one pixel, written into out[o..o+2] without allocating */
function labInto(d, i, out, o) {
  const r = LIN[d[i]];
  const g = LIN[d[i + 1]];
  const b = LIN[d[i + 2]];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  out[o] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  out[o + 1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  out[o + 2] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
}
/* weighted distance: lightness counts less, so folds and shading stay with their fabric */
const dist2 = (lab, p, c) => {
  const dl = (lab[p * 3] - c[0]) * L_WEIGHT;
  const da = lab[p * 3 + 1] - c[1];
  const db = lab[p * 3 + 2] - c[2];
  return dl * dl + da * da + db * db;
};
const cdist = (a, b) => {
  const dl = (a[0] - b[0]) * L_WEIGHT;
  return Math.sqrt(dl * dl + (a[1] - b[1]) * (a[1] - b[1]) + (a[2] - b[2]) * (a[2] - b[2]));
};
/* how far a garment shade sits from a background shade: lightness counts less when the garment
   is the darker of the two (it could be a shadow), in full when it is the lighter */
const sepDist = (fgC, bgC) => (fgC[0] > bgC[0] ? Math.hypot(fgC[0] - bgC[0], fgC[1] - bgC[1], fgC[2] - bgC[2]) : cdist(fgC, bgC));
/* plain distance, lightness counted in full: for deciding what stands out from the background */
const dist2Plain = (lab, p, c) => {
  const dl = lab[p * 3] - c[0];
  const da = lab[p * 3 + 1] - c[1];
  const db = lab[p * 3 + 2] - c[2];
  return dl * dl + da * da + db * db;
};

/* a smaller copy of the picture, by averaging blocks, with OKLab per pixel */
function reduced(img, side) {
  const W = img.width;
  const H = img.height;
  const k = Math.min(1, side / Math.max(W, H));
  const w = Math.max(8, Math.round(W * k));
  const h = Math.max(8, Math.round(H * k));
  const rgb = new Uint8ClampedArray(w * h * 4);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const sy0 = Math.floor((y * H) / h);
    const sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) * H) / h));
    for (let x = 0; x < w; x++) {
      const sx0 = Math.floor((x * W) / w);
      const sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) * W) / w));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        let i = (sy * W + sx0) * 4;
        for (let sx = sx0; sx < sx1; sx++, i += 4) {
          r += d[i];
          g += d[i + 1];
          b += d[i + 2];
          n++;
        }
      }
      const o = (y * w + x) * 4;
      rgb[o] = r / n;
      rgb[o + 1] = g / n;
      rgb[o + 2] = b / n;
      rgb[o + 3] = 255;
    }
  }
  const lab = new Float32Array(w * h * 3);
  for (let p = 0; p < w * h; p++) labInto(rgb, p * 4, lab, p * 3);
  return { w, h, rgb, lab };
}

/* k-means over the points `idx` of `lab`, seeds spread out, centres merged when close */
function kmeans(lab, idx, k, iters) {
  const n = idx.length;
  const pick = (i) => [lab[i * 3], lab[i * 3 + 1], lab[i * 3 + 2]];
  const mean = [0, 0, 0];
  for (const i of idx) {
    mean[0] += lab[i * 3] / n;
    mean[1] += lab[i * 3 + 1] / n;
    mean[2] += lab[i * 3 + 2] / n;
  }
  const centres = [mean];
  const step = Math.max(1, Math.floor(n / 3000));
  while (centres.length < k) {
    let best = -1;
    let bd = -1;
    for (let j = 0; j < n; j += step) {
      let nd = Infinity;
      for (const c of centres) nd = Math.min(nd, dist2(lab, idx[j], c));
      if (nd > bd) {
        bd = nd;
        best = idx[j];
      }
    }
    if (best < 0 || bd < 1e-6) break;
    centres.push(pick(best));
  }
  let counts = centres.map(() => 0);
  for (let it = 0; it < iters; it++) {
    const sums = centres.map(() => [0, 0, 0, 0]);
    for (const i of idx) {
      let bi = 0;
      let bd = Infinity;
      for (let c = 0; c < centres.length; c++) {
        const dd = dist2(lab, i, centres[c]);
        if (dd < bd) {
          bd = dd;
          bi = c;
        }
      }
      const s = sums[bi];
      s[0] += lab[i * 3];
      s[1] += lab[i * 3 + 1];
      s[2] += lab[i * 3 + 2];
      s[3]++;
    }
    for (let c = 0; c < centres.length; c++) if (sums[c][3]) centres[c] = [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]];
    counts = sums.map((s) => s[3]);
  }
  /* merge centres that are nearly the same shade */
  const out = [];
  const weights = [];
  for (let c = 0; c < centres.length; c++) {
    if (!counts[c]) continue;
    let merged = false;
    for (let o = 0; o < out.length; o++) {
      if (cdist(out[o], centres[c]) < MERGE_DISTANCE) {
        const wsum = weights[o] + counts[c];
        out[o] = out[o].map((v, i) => (v * weights[o] + centres[c][i] * counts[c]) / wsum);
        weights[o] = wsum;
        merged = true;
        break;
      }
    }
    if (!merged) {
      out.push(centres[c]);
      weights.push(counts[c]);
    }
  }
  return { centres: out, weights };
}
const nearest = (lab, p, centres) => {
  let best = Infinity;
  for (const c of centres) {
    const d = dist2(lab, p, c);
    if (d < best) best = d;
  }
  return Math.sqrt(best);
};
const nearestPlain = (lab, p, centres) => {
  let best = Infinity;
  for (const c of centres) {
    const d = dist2Plain(lab, p, c);
    if (d < best) best = d;
  }
  return Math.sqrt(best);
};
const nearestIndex = (lab, p, centres) => {
  let bi = 0;
  let bd = Infinity;
  for (let c = 0; c < centres.length; c++) {
    const dd = dist2(lab, p, centres[c]);
    if (dd < bd) {
      bd = dd;
      bi = c;
    }
  }
  return bi;
};

/* The background's shades, from the band round the edges (FR-24). */
export function backgroundModel(img) {
  const a = reduced(img, ANALYSIS_SIDE);
  return modelFrom(a);
}
function modelFrom(a) {
  const { w, h, lab, rgb } = a;
  const band = Math.max(2, Math.round(Math.min(w, h) * BORDER_BAND));
  const idx = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < band || y < band || x >= w - band || y >= h - band) idx.push(y * w + x);
  const km = kmeans(lab, idx, 6, 8);
  /* a shade with almost no pixels is the mixed rim where something meets the background (a hem
     on the edge of the photo), not a shade of the background: leave it out */
  const total = km.weights.reduce((s, x) => s + x, 0);
  const centres = [];
  const weights = [];
  for (let i = 0; i < km.centres.length; i++) {
    if (km.weights[i] < total * MIN_SHADE_SHARE) continue;
    centres.push(km.centres[i]);
    weights.push(km.weights[i]);
  }
  /* which edges each shade sits on, how much of each corner it fills, and the dominant shade's
     colour in sRGB. The corners matter: whatever fills a corner is background for certain, while
     a shade that only meets the edges between the corners may be the garment reaching out. */
  const edges = centres.map(() => [0, 0, 0, 0]);
  const corners = centres.map(() => [0, 0, 0, 0]);
  const cornerPixels = [0, 0, 0, 0];
  const box = Math.max(2, Math.round(Math.min(w, h) * CORNER_BOX));
  let top = 0;
  for (let i = 1; i < weights.length; i++) if (weights[i] > weights[top]) top = i;
  const sum = [0, 0, 0];
  let n = 0;
  for (const p of idx) {
    const bi = nearestIndex(lab, p, centres);
    const x = p % w;
    const y = (p - x) / w;
    const e = y < band ? 0 : y >= h - band ? 1 : x < band ? 2 : 3;
    edges[bi][e]++;
    const cx = x < box ? 0 : x >= w - box ? 1 : -1;
    const cy = y < box ? 0 : y >= h - box ? 1 : -1;
    if (cx >= 0 && cy >= 0) {
      const c = cy * 2 + cx;
      corners[bi][c]++;
      cornerPixels[c]++;
    }
    if (bi !== top) continue;
    sum[0] += rgb[p * 4];
    sum[1] += rgb[p * 4 + 1];
    sum[2] += rgb[p * 4 + 2];
    n++;
  }
  const edgeShare = edges.map((e) => {
    const t = e[0] + e[1] + e[2] + e[3];
    return t ? Math.max(...e) / t : 0;
  });
  const cornerShare = corners.map((c) => Math.max(...c.map((v, k) => (cornerPixels[k] ? v / cornerPixels[k] : 0))));
  return { centres, weights, edgeShare, cornerShare, dominantRgb: n ? sum.map((v) => Math.round(v / n)) : [128, 128, 128] };
}

export const leanFor = (strength) => {
  const s = Math.min(100, Math.max(0, strength === undefined || strength === null ? 50 : strength));
  return s <= 50 ? 1 + ((50 - s) / 50) * 0.7 : 1 - ((s - 50) / 50) * 0.45;
};

/* The main method. Returns null when no garment stands out from the background. */
export function segment(img, opts) {
  opts = opts || {};
  const lean = leanFor(opts.strength);
  const a = reduced(img, ANALYSIS_SIDE);
  const { w, h, lab } = a;
  const bg = modelFrom(a);
  const cIdx = [];
  for (let y = Math.floor(h * CENTRE_FROM); y < h * CENTRE_TO; y++) for (let x = Math.floor(w * CENTRE_FROM); x < w * CENTRE_TO; x++) cIdx.push(y * w + x);
  /* a shade seen on one edge only that also fills much of the middle is the garment reaching
     the edge of the photo (a hem on the bottom edge), not the background: drop it */
  const centreShare = bg.centres.map(() => 0);
  for (const p of cIdx) centreShare[nearestIndex(lab, p, bg.centres)]++;
  /* and a shade that fills no corner, and is not close to one that does, is something reaching
     the edges from the middle (a shirt whose sleeves, collar and hem all cross the frame) */
  const anchored = bg.centres.filter((c, i) => bg.cornerShare[i] >= CORNER_MIN);
  const nearAnchor = (c) => !anchored.length || anchored.some((a) => cdist(a, c) < NEAR_ANCHOR);
  let bgLit = bg.centres.filter((c, i) => !(bg.edgeShare[i] >= LOPSIDED_EDGE && centreShare[i] / cIdx.length >= LOPSIDED_CENTRE) && (bg.cornerShare[i] >= CORNER_MIN || nearAnchor(c)));
  if (!bgLit.length) bgLit = bg.centres;
  /* the garment: middle pixels that are not any background shade. Lightness counts less, so a
     shadow on the sheet does not pass as garment; but a pixel clearly lighter than every
     background shade cannot be a shadow of it, so it counts as clearly different (a white shirt
     on a light grey sheet). A second, finer tier catches a garment that is only a little
     different from its background. For the warning, the same two bands are counted with
     lightness in full, because a pale shirt differs from a pale wall mostly in lightness. */
  const maxBgL = Math.max(...bgLit.map((c) => c[0]));
  const picked = [[], []];
  let clear = 0;
  let faint = 0;
  for (let j = 0; j < cIdx.length; j++) {
    const p = cIdx[j];
    const d = nearest(lab, p, bgLit);
    const isClear = d > FG_TIERS[0] || lab[p * 3] - maxBgL > LIGHTER_STEP;
    if (isClear) picked[0].push(p);
    if (isClear || d > FG_TIERS[1]) picked[1].push(p);
    const dp = nearestPlain(lab, p, bgLit);
    if (dp > FG_TIERS[0]) clear++;
    else if (dp > FG_TIERS[1]) faint++;
  }
  let fgIdx = null;
  let tier = -1;
  const need = Math.max(40, w * h * 0.004);
  for (let t = 0; t < picked.length; t++) {
    if (picked[t].length >= need) {
      fgIdx = picked[t];
      tier = t;
      break;
    }
  }
  if (!fgIdx) return null;
  const fg = kmeans(lab, fgIdx, 5, 8);
  /* confidence: how far the garment's shades sit from the background's, share-weighted median */
  const seps = fg.centres.map((c, i) => ({ d: Math.min(...bgLit.map((b) => sepDist(c, b))), w: fg.weights[i] })).sort((p, q) => p.d - q.d);
  const half = seps.reduce((s, x) => s + x.w, 0) / 2;
  let acc = 0;
  let separation = seps[seps.length - 1].d;
  for (const s of seps) {
    acc += s.w;
    if (acc >= half) {
      separation = s.d;
      break;
    }
  }
  /* low contrast: the finer tier was needed, the garment's shades sit close to the background's,
     or the faint population (a pale shirt) outnumbers the clear one (its dark print) */
  const lowContrast = tier > 0 || separation < LOW_CONTRAST || faint > clear;
  /* background shades plus their shadows, which cost a penalty so a garment of the same colour
     as a shadow still wins when the garment model knows it */
  const bgAll = [];
  for (const c of bgLit) {
    bgAll.push({ c, penalty: 0 });
    for (const f of SHADOW_LEVELS) bgAll.push({ c: [c[0] * f, c[1] * (0.6 + 0.4 * f), c[2] * (0.6 + 0.4 * f)], penalty: SHADOW_PENALTY });
  }
  /* classify at a middle size, as a soft score, then bring it up to full size smoothly */
  const cl = Math.max(img.width, img.height) > CLASSIFY_SIDE ? reduced(img, CLASSIFY_SIDE) : null;
  const cw = cl ? cl.w : img.width;
  const ch = cl ? cl.h : img.height;
  const clab = cl ? cl.lab : null;
  const score = new Float32Array(cw * ch);
  const tmp = new Float32Array(3);
  for (let p = 0; p < cw * ch; p++) {
    let L;
    let A;
    let B;
    if (clab) {
      L = clab[p * 3];
      A = clab[p * 3 + 1];
      B = clab[p * 3 + 2];
    } else {
      labInto(img.data, p * 4, tmp, 0);
      L = tmp[0];
      A = tmp[1];
      B = tmp[2];
    }
    let dFg = Infinity;
    for (const c of fg.centres) {
      const dl = (L - c[0]) * L_WEIGHT;
      const da = A - c[1];
      const db = B - c[2];
      const d = dl * dl + da * da + db * db;
      if (d < dFg) dFg = d;
    }
    dFg = Math.sqrt(dFg);
    let dBg = Infinity;
    for (const e of bgAll) {
      const c = e.c;
      const dl = (L - c[0]) * L_WEIGHT;
      const da = A - c[1];
      const db = B - c[2];
      const d = Math.sqrt(dl * dl + da * da + db * db) + e.penalty;
      if (d < dBg) dBg = d;
    }
    score[p] = lean * dBg - dFg;
  }
  const mask = new Uint8Array(img.width * img.height);
  if (cl) upsampleScore(score, cw, ch, mask, img.width, img.height);
  else for (let p = 0; p < mask.length; p++) mask[p] = score[p] > 0 ? 255 : 0;
  tidy(mask, img.width, img.height);
  const diag = { tier, clear, faint, centre: cIdx.length, shades: bg.centres.length, dropped: bg.centres.length - bgLit.length, anchored: anchored.length, bands: bg.centres.map((c, i) => [+bg.edgeShare[i].toFixed(2), +(centreShare[i] / cIdx.length).toFixed(2), +bg.cornerShare[i].toFixed(2), +c[0].toFixed(3)]) };
  return { mask, coverage: coverage(mask), lowContrast, separation, bg: bg.dominantRgb, bgCentres: bgLit, fgCentres: fg.centres, method: 'seg-2', diag };
}

/* bilinear upsampling of the soft score, thresholded at 0 */
function upsampleScore(score, sw, sh, mask, W, H) {
  const kx = sw / W;
  const ky = sh / H;
  for (let y = 0; y < H; y++) {
    const fy = Math.min(sh - 1, Math.max(0, (y + 0.5) * ky - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(sh - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < W; x++) {
      const fx = Math.min(sw - 1, Math.max(0, (x + 0.5) * kx - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(sw - 1, x0 + 1);
      const tx = fx - x0;
      const v = score[y0 * sw + x0] * (1 - tx) * (1 - ty) + score[y0 * sw + x1] * tx * (1 - ty) + score[y1 * sw + x0] * (1 - tx) * ty + score[y1 * sw + x1] * tx * ty;
      mask[y * W + x] = v > 0 ? 255 : 0;
    }
  }
}
function tidy(mask, w, h) {
  smooth(mask, w, h);
  smooth(mask, w, h);
  dropSpecks(mask, w, h, 0.003);
  fillHoles(mask, w, h, 0.04);
}

/* The simpler method: everything joined to the edge that matches the edge's colour goes. */
export function floodCutout(img, strength) {
  const W = img.width;
  const H = img.height;
  const d = img.data;
  const mask = new Uint8Array(W * H).fill(255);
  const step = Math.max(1, Math.round(Math.max(W, H) / 60));
  const seeds = [];
  for (let x = 0; x < W; x += step) seeds.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y += step) seeds.push(y * W, y * W + W - 1);
  /* the typical edge colour: the median of a sample of border pixels */
  const rs = [];
  const gs = [];
  const bs = [];
  for (const p of seeds) {
    rs.push(d[p * 4]);
    gs.push(d[p * 4 + 1]);
    bs.push(d[p * 4 + 2]);
  }
  const med = (a) => a.sort((p, q) => p - q)[Math.floor(a.length / 2)];
  const th = toleranceThreshold(strength === undefined ? 50 : strength);
  const seen = new Uint32Array(W * H);
  growFrom(d, W, H, mask, seeds, med(rs), med(gs), med(bs), th, 255, 0, seen, 1);
  /* a second pass from every edge pixel still kept, against its own colour, for an edge that is
     a different shade along one side; one visited-marker array, stamped per seed */
  let stamp = 2;
  for (const p of seeds) if (mask[p]) growFrom(d, W, H, mask, [p], d[p * 4], d[p * 4 + 1], d[p * 4 + 2], Math.max(6, th - 36), 255, 0, seen, stamp++);
  tidy(mask, W, H);
  return { mask, coverage: coverage(mask), method: 'flood', lowContrast: false, separation: null, bg: [med(rs), med(gs), med(bs)] };
}

/* What the app runs when a photo arrives: the main method, else the flood fill, else keep the
   whole photo when almost nothing or almost everything would be left (FR-27). With keepWhole
   false (a strength the user chose), the real result comes back whatever its size, marked
   `extreme` so the screen can say so. */
export function autoCutout(img, opts) {
  opts = opts || {};
  const strength = opts.strength === undefined ? 50 : opts.strength;
  const keepWhole = opts.keepWhole !== false;
  let r = segment(img, { strength });
  if (!r) r = floodCutout(img, strength);
  const extreme = r.coverage < WHOLE_PHOTO_MIN ? 'empty' : r.coverage > WHOLE_PHOTO_MAX ? 'full' : null;
  if (extreme && keepWhole) {
    return { mask: null, method: 'photo', wholePhoto: true, extreme, coverage: r.coverage, lowContrast: r.lowContrast, separation: r.separation, bg: r.bg, diag: r.diag };
  }
  return Object.assign({ wholePhoto: false, extreme }, r);
}
