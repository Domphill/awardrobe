/* aWardrobe domain: mask operations. A mask is one byte per pixel: 255 keeps the pixel, 0 makes
   it transparent. Pure maths on typed arrays; no screen, no storage. */

/* colour distance in weighted RGB, as the Wand and Select tools judge "similar" */
export const colourDistance = (d, i, r, g, b) => {
  const dr = d[i] - r;
  const dg = d[i + 1] - g;
  const db = d[i + 2] - b;
  return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);
};
/* tolerance 0..100 becomes a colour distance: 0 is the exact colour only. The middle of the
   slider, 30, reaches about 20 levels a channel: a shade step, not a grey tee against a sheet. */
export const toleranceThreshold = (t) => 4 + 2 * Math.min(100, Math.max(0, t));

/* Closes gaps in the kept area narrower than about 2r pixels: a grow by r, then a shrink by r
   (a morphological closing with a square window, done as two separable passes each way). It
   fills the notches a striped garment gets along its outline where a stripe matches the sheet,
   and the thin slits eaten into it, while a garment's own concave corners, far wider than 2r,
   are left alone. Kept pixels are never lost. */
export function closeGaps(mask, w, h, r) {
  r = r || 3;
  const n = w * h;
  const a = new Uint8Array(n);
  const b = new Uint8Array(n);
  /* one direction of a grow (pick 255) or a shrink (pick 0): a pixel takes `pick` when a `pick`
     pixel lies within r of it along the line, found with two linear scans of the distance */
  const line = (src, so, step, len, dst, pick) => {
    let dist = len;
    for (let k = 0; k < len; k++) {
      const i = so + k * step;
      dist = src[i] === pick ? 0 : dist + 1;
      dst[i] = dist <= r ? pick : src[i];
    }
    dist = len;
    for (let k = len - 1; k >= 0; k--) {
      const i = so + k * step;
      dist = src[i] === pick ? 0 : dist + 1;
      if (dist <= r) dst[i] = pick;
    }
  };
  const pass = (src, dst, pick) => {
    for (let y = 0; y < h; y++) line(src, y * w, 1, w, dst, pick);
    for (let x = 0; x < w; x++) line(dst, x, w, h, dst, pick);
  };
  for (let i = 0; i < n; i++) a[i] = mask[i] > 127 ? 255 : 0;
  pass(a, b, 255);
  pass(b, a, 0);
  /* the shrink must not reach the picture's border inwards: pixels that were kept stay kept */
  for (let i = 0; i < n; i++) mask[i] = mask[i] > 127 || a[i] === 255 ? 255 : 0;
  return mask;
}

/* Paints a round spot of `value` into the mask. Returns how many pixels changed. */
export function paintDisc(mask, w, h, cx, cy, r, value) {
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(h - 1, Math.ceil(cy + r));
  const r2 = r * r;
  let n = 0;
  for (let y = y0; y <= y1; y++) {
    const dy = y - cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      if (dx * dx + dy * dy > r2) continue;
      const p = y * w + x;
      if (mask[p] !== value) {
        mask[p] = value;
        n++;
      }
    }
  }
  return n;
}

/* Grows from (x, y) over connected pixels that have the mask value `from` and are within the
   tolerance of the colour under the start point; sets them to `to`. Returns how many changed. */
export function floodByColour(rgba, w, h, mask, x, y, tolerance, from, to) {
  x = Math.min(w - 1, Math.max(0, Math.round(x)));
  y = Math.min(h - 1, Math.max(0, Math.round(y)));
  const start = y * w + x;
  if (mask[start] !== from) return 0;
  const i0 = start * 4;
  return growFrom(rgba, w, h, mask, [start], rgba[i0], rgba[i0 + 1], rgba[i0 + 2], toleranceThreshold(tolerance), from, to);
}
/* `seen` and `stamp` let a caller reuse one visited-marker array across many fills. */
export function growFrom(rgba, w, h, mask, seeds, r, g, b, threshold, from, to, seen, stamp) {
  if (!seen) {
    seen = new Uint8Array(w * h);
    stamp = 1;
  }
  const stack = [];
  for (const p of seeds) {
    if (mask[p] === from && seen[p] !== stamp && colourDistance(rgba, p * 4, r, g, b) <= threshold) {
      seen[p] = stamp;
      stack.push(p);
    }
  }
  let changed = 0;
  const visit = (q) => {
    if (seen[q] === stamp || mask[q] !== from) return;
    seen[q] = stamp;
    if (colourDistance(rgba, q * 4, r, g, b) <= threshold) stack.push(q);
  };
  while (stack.length) {
    const p = stack.pop();
    mask[p] = to;
    changed++;
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) visit(p - 1);
    if (x < w - 1) visit(p + 1);
    if (y > 0) visit(p - w);
    if (y < h - 1) visit(p + w);
  }
  return changed;
}

/* Connected pieces of the mask that have `value`: a label per pixel (-1 elsewhere), each piece's
   size, and whether it touches the picture's edge. */
export function components(mask, w, h, value) {
  const label = new Int32Array(w * h).fill(-1);
  const sizes = [];
  const border = [];
  const stack = [];
  for (let p = 0; p < w * h; p++) {
    if (mask[p] !== value || label[p] >= 0) continue;
    const id = sizes.length;
    sizes.push(0);
    border.push(false);
    label[p] = id;
    stack.push(p);
    while (stack.length) {
      const q = stack.pop();
      sizes[id]++;
      const x = q % w;
      const y = (q - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border[id] = true;
      if (x > 0 && mask[q - 1] === value && label[q - 1] < 0) {
        label[q - 1] = id;
        stack.push(q - 1);
      }
      if (x < w - 1 && mask[q + 1] === value && label[q + 1] < 0) {
        label[q + 1] = id;
        stack.push(q + 1);
      }
      if (y > 0 && mask[q - w] === value && label[q - w] < 0) {
        label[q - w] = id;
        stack.push(q - w);
      }
      if (y < h - 1 && mask[q + w] === value && label[q + w] < 0) {
        label[q + w] = id;
        stack.push(q + w);
      }
    }
  }
  return { label, sizes, border };
}

/* Drops kept pieces smaller than a share of the picture; the biggest piece always stays. */
export function dropSpecks(mask, w, h, minShare) {
  const { label, sizes } = components(mask, w, h, 255);
  if (!sizes.length) return mask;
  let biggest = 0;
  for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[biggest]) biggest = i;
  const min = Math.max(1, Math.round(w * h * minShare));
  for (let p = 0; p < w * h; p++) {
    const id = label[p];
    if (id >= 0 && id !== biggest && sizes[id] < min) mask[p] = 0;
  }
  return mask;
}

/* Fills transparent holes inside the garment (a print the colour of the wall) up to a share of
   the picture; holes that touch the edge are background, not holes. */
export function fillHoles(mask, w, h, maxShare) {
  const { label, sizes, border } = components(mask, w, h, 0);
  const max = Math.round(w * h * maxShare);
  for (let p = 0; p < w * h; p++) {
    const id = label[p];
    if (id >= 0 && !border[id] && sizes[id] <= max) mask[p] = 255;
  }
  return mask;
}

/* Smooths the edge: each pixel goes with the majority of its 3 by 3 neighbourhood. */
export function smooth(mask, w, h) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - 1);
    const y1 = Math.min(h - 1, y + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - 1);
      const x1 = Math.min(w - 1, x + 1);
      let n = 0;
      let t = 0;
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
        if (mask[yy * w + xx] > 127) n++;
        t++;
      }
      out[y * w + x] = n * 2 > t ? 255 : 0;
    }
  }
  mask.set(out);
  return mask;
}

/* The box round the kept pixels (inclusive), or null when nothing is kept. */
export function bbox(mask, w, h, threshold) {
  const th = threshold === undefined ? 128 : threshold;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (mask[row + x] >= th) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}
/* a picture with no see-through pixels is a photo kept whole; a rounding wobble is not transparency */
export function pictureKind(alpha) {
  for (let i = 0; i < alpha.length; i++) if (alpha[i] < 250) return 'cutout';
  return 'photo';
}
export function coverage(mask) {
  let n = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i] > 127) n++;
  return mask.length ? n / mask.length : 0;
}

/* Run-length encoding: alternating run lengths, starting with a run of transparent pixels. */
export function rleEncode(mask) {
  const runs = [];
  let v = false;
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    const on = mask[i] > 127;
    if (on === v) n++;
    else {
      runs.push(n);
      v = on;
      n = 1;
    }
  }
  runs.push(n);
  return Uint32Array.from(runs);
}
export function rleDecode(runs, length) {
  const out = new Uint8Array(length);
  let p = 0;
  let v = 0;
  for (let i = 0; i < runs.length; i++) {
    const n = runs[i];
    if (v) out.fill(255, p, p + n);
    p += n;
    v = v ? 0 : 255;
  }
  return out;
}

/* The Select brush. With a tolerance, the selection grows from the point over kept pixels within
   `reach` that are similar in colour to the pixel under the point, so it snaps to the garment's
   edge; with tolerance null it is a plain disc over kept pixels. Returns how many were added.
   `seen` and `stamp` let a stroke reuse one visited-marker array for all its discs. */
export function smartSelect(rgba, w, h, kept, sel, cx, cy, reach, tolerance, seen, stamp) {
  const x = Math.round(cx);
  const y = Math.round(cy);
  if (x < 0 || y < 0 || x >= w || y >= h) return 0;
  if (tolerance === null || tolerance === undefined) {
    const x0 = Math.max(0, Math.floor(cx - reach));
    const x1 = Math.min(w - 1, Math.ceil(cx + reach));
    const y0 = Math.max(0, Math.floor(cy - reach));
    const y1 = Math.min(h - 1, Math.ceil(cy + reach));
    const r2 = reach * reach;
    let n = 0;
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
      if ((xx - cx) * (xx - cx) + (yy - cy) * (yy - cy) > r2) continue;
      const p = yy * w + xx;
      if (kept[p] > 127 && sel[p] !== 255) {
        sel[p] = 255;
        n++;
      }
    }
    return n;
  }
  const start = y * w + x;
  if (kept[start] <= 127) return 0;
  const i0 = start * 4;
  const r = rgba[i0];
  const g = rgba[i0 + 1];
  const b = rgba[i0 + 2];
  const th = toleranceThreshold(tolerance);
  const r2 = reach * reach;
  if (!seen) {
    seen = new Uint8Array(w * h);
    stamp = 1;
  }
  const stack = [start];
  seen[start] = stamp;
  let n = 0;
  const visit = (q) => {
    if (seen[q] === stamp || kept[q] <= 127) return;
    seen[q] = stamp;
    const qx = q % w;
    const qy = (q - qx) / w;
    if ((qx - cx) * (qx - cx) + (qy - cy) * (qy - cy) > r2) return;
    if (colourDistance(rgba, q * 4, r, g, b) <= th) stack.push(q);
  };
  while (stack.length) {
    const p = stack.pop();
    if (sel[p] !== 255) {
      sel[p] = 255;
      n++;
    }
    const px = p % w;
    const py = (p - px) / w;
    if (px > 0) visit(p - 1);
    if (px < w - 1) visit(p + 1);
    if (py > 0) visit(p - w);
    if (py < h - 1) visit(p + w);
  }
  return n;
}
