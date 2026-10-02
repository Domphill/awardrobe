/* aWardrobe domain: the colours of a garment (FR-53 to FR-56). White balance from the photo's
   background when it is near neutral (FR-54); grouping in OKLab; the lit and shadowed parts of
   one fabric count as one colour (FR-55); the swatch is the lit side of the fabric. Pure. */
import { toLinear, linearToLab, labToRgb, lch, hueDiff, gam, hexOf } from './space.js';
import { nameColour } from './naming.js';

/* Gains that make the background grey, one per channel, when the background is near neutral.
   A coloured background (a red sheet) gives no correction. */
export function whiteBalanceGains(bg) {
  if (!bg) return [1, 1, 1];
  const bl = toLinear(bg[0], bg[1], bg[2]);
  const { L, C } = lch(linearToLab(bl[0], bl[1], bl[2]));
  /* near neutral: a sheet, a wall or a floor under a coloured bulb has chroma under about 0.08;
     a coloured sheet is well above it */
  if (C >= 0.08 || L <= 0.45) return [1, 1, 1];
  const avg = (bl[0] + bl[1] + bl[2]) / 3;
  return bl.map((c) => Math.min(2, Math.max(0.5, avg / Math.max(c, 0.001))));
}
export function correctColour(rgb, bg) {
  const g = whiteBalanceGains(bg);
  if (g[0] === 1 && g[1] === 1 && g[2] === 1) return rgb.slice();
  const lr = toLinear(rgb[0], rgb[1], rgb[2]);
  return lr.map((c, i) => Math.round(255 * gam(Math.min(1, c * g[i]))));
}

const dist2 = (p, q) => (p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1]) + (p[2] - q[2]) * (p[2] - q[2]);
const mean = (pts) => {
  const m = [0, 0, 0];
  for (const p of pts) {
    m[0] += p[0];
    m[1] += p[1];
    m[2] += p[2];
  }
  return m.map((v) => v / pts.length);
};

/* k-means in OKLab, seeded by spreading the seeds out */
export function kmeans(pts, k, iters) {
  const centres = [mean(pts)];
  while (centres.length < k) {
    let best = null;
    let bd = -1;
    for (const p of pts) {
      let nd = Infinity;
      for (const c of centres) nd = Math.min(nd, dist2(p, c));
      if (nd > bd) {
        bd = nd;
        best = p;
      }
    }
    if (!best || bd < 1e-8) break;
    centres.push(best.slice());
  }
  const labels = new Int16Array(pts.length);
  for (let it = 0; it < (iters || 12); it++) {
    const sums = centres.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < pts.length; i++) {
      let bi = 0;
      let bd = Infinity;
      for (let c = 0; c < centres.length; c++) {
        const d = dist2(pts[i], centres[c]);
        if (d < bd) {
          bd = d;
          bi = c;
        }
      }
      labels[i] = bi;
      const s = sums[bi];
      s[0] += pts[i][0];
      s[1] += pts[i][1];
      s[2] += pts[i][2];
      s[3]++;
    }
    for (let c = 0; c < centres.length; c++) if (sums[c][3]) centres[c] = [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]];
  }
  return { centres, labels };
}

/* The same fabric in different light: same hue and chroma, different lightness. */
function sameFabric(a, b) {
  const p = lch(a);
  const q = lch(b);
  if (p.C < 0.045 && q.C < 0.045) return Math.abs(p.L - q.L) < 0.22;
  if (p.C < 0.045 || q.C < 0.045) return Math.abs(p.C - q.C) < 0.03 && Math.abs(p.L - q.L) < 0.15;
  return hueDiff(p.h, q.h) < 20 && Math.abs(p.C - q.C) < 0.06 && Math.abs(p.L - q.L) < 0.4;
}

/* rgba: the pixels; alpha: one byte per pixel, 255 where the garment is; opts.bg: the photo's
   background colour for white balance; opts.count: how many colours at most (3). */
export function extractColours(rgba, alpha, w, h, opts) {
  opts = opts || {};
  const count = opts.count || 3;
  const gains = whiteBalanceGains(opts.bg);
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 9000)));
  const m = 3;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && alpha[y * w + x] >= 250;
  const pts = [];
  for (let y = m; y < h - m; y += step) {
    for (let x = m; x < w - m; x += step) {
      if (!solid(x, y) || !solid(x - m, y) || !solid(x + m, y) || !solid(x, y - m) || !solid(x, y + m)) continue;
      const i = (y * w + x) * 4;
      const l = toLinear(rgba[i], rgba[i + 1], rgba[i + 2]);
      pts.push(linearToLab(Math.min(1, l[0] * gains[0]), Math.min(1, l[1] * gains[1]), Math.min(1, l[2] * gains[2])));
    }
  }
  if (pts.length < 20) return [];
  const k = Math.min(6, Math.max(2, Math.floor(pts.length / 60)));
  const { centres, labels } = kmeans(pts, k, 12);
  let groups = centres.map(() => ({ lab: null, members: [] }));
  for (let i = 0; i < pts.length; i++) groups[labels[i]].members.push(pts[i]);
  groups = groups.filter((g) => g.members.length);
  for (const g of groups) g.lab = mean(g.members);
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        if (!sameFabric(groups[i].lab, groups[j].lab)) continue;
        const all = groups[i].members.concat(groups[j].members);
        groups.splice(j, 1);
        groups[i] = { lab: mean(all), members: all };
        merged = true;
        break outer;
      }
    }
  }
  groups.sort((a, b) => b.members.length - a.members.length);
  const out = [];
  for (const g of groups) {
    const share = g.members.length / pts.length;
    if (share < 0.07 && out.length) continue;
    /* the swatch is the lit part of the fabric, not its shadow */
    const ls = g.members.map((p) => p[0]).sort((a, b) => a - b);
    const median = ls[Math.floor(ls.length / 2)];
    const lit = g.members.filter((p) => p[0] >= median);
    const lab = mean(lit);
    const rgb = labToRgb(lab[0], lab[1], lab[2]);
    out.push({ hex: hexOf(rgb), name: nameColour(rgb), share: Math.round(share * 100) });
    if (out.length >= count) break;
  }
  /* two groups that end up with the same name are one colour */
  const seen = new Map();
  for (const c of out) {
    if (seen.has(c.name)) seen.get(c.name).share += c.share;
    else seen.set(c.name, c);
  }
  return [...seen.values()].sort((a, b) => b.share - a.share);
}
