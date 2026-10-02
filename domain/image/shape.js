/* aWardrobe domain: what a garment is, from its outline (FR-57). Twelve numbers measured from
   the mask, a few rules with a reason in words, and a vote among the garments you have already
   typed when enough of them look alike. Pure. */

const COLS = 120;
export const FEATURE_NAMES = ['aspect', 'legShare', 'topSolid', 'shoulders', 'flare', 'symmetry', 'solidity', 'holes', 'widestRow', 'narrowestRow', 'topWidth', 'bottomWidth'];

/* Twelve features of the outline, each roughly 0..1, or null when there is too little to see. */
export function shapeFeatures(mask, w, h) {
  const step = Math.max(1, Math.floor(w / COLS));
  const rows = [];
  let minX = Infinity;
  let maxX = -1;
  for (let y = 0; y < h; y += step) {
    const segs = [];
    let start = -1;
    for (let x = 0; x <= w; x += step) {
      const on = x < w && mask[y * w + x] > 127;
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        if (x - start >= w * 0.03) segs.push([start, x]);
        start = -1;
      }
    }
    if (!segs.length) {
      rows.push(null);
      continue;
    }
    const first = segs[0][0];
    const last = segs[segs.length - 1][1];
    minX = Math.min(minX, first);
    maxX = Math.max(maxX, last);
    const bySize = segs.slice().sort((a, b) => b[1] - b[0] - (a[1] - a[0]));
    let gap = 0;
    if (bySize.length >= 2) gap = Math.max(bySize[0][0], bySize[1][0]) - Math.min(bySize[0][1], bySize[1][1]);
    rows.push({ y, width: last - first, gap, segs: segs.length, first, last });
  }
  const filled = rows.filter(Boolean);
  if (filled.length < 8 || maxX <= minX) return null;
  const firstRow = rows.findIndex(Boolean);
  let lastRow = rows.length - 1;
  while (lastRow > 0 && !rows[lastRow]) lastRow--;
  const n = lastRow - firstRow + 1;
  const bw = maxX - minX;
  const band = (a, b) => rows.slice(firstRow + Math.floor(n * a), firstRow + Math.ceil(n * b)).filter(Boolean);
  const meanW = (list) => (list.length ? list.reduce((s, r) => s + r.width, 0) / list.length : 0);
  const r = (n * step) / bw;
  const legBand = band(0.55, 0.97);
  const legShare = legBand.length ? legBand.filter((row) => row.segs >= 2 && row.gap >= bw * 0.05).length / legBand.length : 0;
  const topBand = band(0.08, 0.45);
  const topSolid = topBand.length ? topBand.filter((row) => row.segs === 1).length / topBand.length : 0;
  const midW = meanW(band(0.5, 0.7)) || 0.001;
  const shoulders = Math.max(...band(0.02, 0.5).map((row) => row.width), 0) / midW;
  const flare = meanW(band(0.8, 0.96)) / midW;
  /* symmetry: how much the outline overlaps its mirror image, about the box's centre */
  let overlap = 0;
  let area = 0;
  const mid = (minX + maxX) / 2;
  for (const row of filled) {
    for (let x = row.first; x < row.last; x += step) {
      area++;
      const mx = Math.round(2 * mid - x);
      if (mx >= 0 && mx < w && mask[row.y * w + mx] > 127) overlap++;
    }
  }
  const symmetry = area ? overlap / area : 0;
  let widest = filled[0];
  let narrowest = null;
  for (const row of filled) if (row.width > widest.width) widest = row;
  for (const row of band(0.1, 0.9)) if (!narrowest || row.width < narrowest.width) narrowest = row;
  const pos = (row) => (row ? (row.y - rows[firstRow].y) / Math.max(1, n * step) : 0.5);
  /* holes: rows where the pieces are separated by a gap that is enclosed above and below count
     as holes only when the gap is small; big gaps are legs */
  let holes = 0;
  for (const row of band(0.1, 0.9)) if (row.segs >= 2 && row.gap < bw * 0.05) holes++;
  const solidity = area / Math.max(1, (bw / step) * filled.length);
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  return Float32Array.from([
    clamp01(Math.min(3, r) / 3),
    clamp01(legShare),
    clamp01(topSolid),
    clamp01(Math.min(2, shoulders) / 2),
    clamp01(Math.min(2, flare) / 2),
    clamp01(symmetry),
    clamp01(solidity),
    clamp01(holes / Math.max(1, filled.length)),
    clamp01(pos(widest)),
    clamp01(pos(narrowest)),
    clamp01((band(0.02, 0.08)[0] || widest).width / bw),
    clamp01((band(0.92, 0.98).slice(-1)[0] || widest).width / bw)
  ]);
}

const DENIM = /Denim|Navy|Light blue|Blue/;

/* The rules: what the outline says, with the reason in words. */
export function guessByRules(f, colours) {
  if (!f) return null;
  const r = f[0] * 3;
  const legShare = f[1];
  const topSolid = f[2];
  const shoulders = f[3] * 2;
  const flare = f[4] * 2;
  const denim = (colours || []).some((c) => DENIM.test(c.name || ''));
  if (legShare > 0.45 && topSolid > 0.6) return r > 1.35 ? { category: 'bottoms', type: denim ? 'Jeans' : 'Trousers', confidence: 'high', why: 'two legs' } : { category: 'bottoms', type: 'Shorts', confidence: 'high', why: 'two short legs' };
  if (r < 0.8) return { category: 'shoes', type: 'Trainers', confidence: r < 0.7 ? 'high' : 'medium', why: 'wider than it is tall' };
  if (shoulders > 1.25 && r < 1.65) return { category: 'tops', type: 'T-shirt', confidence: 'medium', why: 'shoulders wider than the body' };
  if (r > 1.5 && flare > 1.1) return { category: 'dresses', type: 'Dress', confidence: 'medium', why: 'tall and flaring out' };
  if (r > 1.5) return { category: 'dresses', type: 'Dress', confidence: 'low', why: 'tall and narrow' };
  if (flare > 1.12 && shoulders < 1.15) return { category: 'bottoms', type: 'Skirt', confidence: 'low', why: 'wider at the bottom' };
  return { category: 'tops', type: 'Top', confidence: 'low', why: 'the outline' };
}

const plural = (type) => {
  const t = type.toLowerCase();
  return t.endsWith('s') ? t : t + 's';
};

/* The vote: the five nearest garments you have already typed, when at least three are close
   and most agree. examples: [{ shape: [12 numbers], category, type }]. */
export function guessWithExamples(f, examples, k) {
  if (!f || !examples || !examples.length) return null;
  k = k || 5;
  const near = examples
    .filter((e) => e.shape && e.shape.length === 12 && e.category && e.type)
    .map((e) => {
      let d = 0;
      for (let i = 0; i < 12; i++) d += (f[i] - e.shape[i]) * (f[i] - e.shape[i]);
      return { e, d: Math.sqrt(d) };
    })
    .filter((x) => x.d <= 0.35)
    .sort((a, b) => a.d - b.d)
    .slice(0, k);
  if (near.length < 3) return null;
  const votes = new Map();
  for (const x of near) {
    const key = x.e.category + '\u0000' + x.e.type;
    votes.set(key, (votes.get(key) || 0) + 1);
  }
  const [best, count] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
  if (count / near.length < 0.6) return null;
  const [category, type] = best.split('\u0000');
  return { category, type, confidence: count === near.length ? 'high' : 'medium', why: 'like your other ' + plural(type), votes: count, of: near.length };
}

export function guessType(f, examples, colours) {
  return guessWithExamples(f, examples) || guessByRules(f, colours);
}
