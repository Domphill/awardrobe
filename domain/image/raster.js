/* aWardrobe domain: resizing, rotating, cropping and mirroring pixel buffers and their masks
   (FR-22, FR-40, FR-41, NFR-16). Pure maths on typed arrays; no canvas. */

export function fitSize(w, h, maxSide) {
  if (Math.max(w, h) <= maxSide) return [w, h];
  const k = maxSide / Math.max(w, h);
  return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))];
}

/* Area average when shrinking, bilinear when growing. */
export function resize(rgba, w, h, nw, nh) {
  const out = new Uint8ClampedArray(nw * nh * 4);
  if (nw <= w && nh <= h) {
    for (let y = 0; y < nh; y++) {
      const sy0 = Math.floor((y * h) / nh);
      const sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) * h) / nh));
      for (let x = 0; x < nw; x++) {
        const sx0 = Math.floor((x * w) / nw);
        const sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) * w) / nw));
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        let n = 0;
        for (let sy = sy0; sy < sy1; sy++) {
          let i = (sy * w + sx0) * 4;
          for (let sx = sx0; sx < sx1; sx++, i += 4) {
            r += rgba[i];
            g += rgba[i + 1];
            b += rgba[i + 2];
            a += rgba[i + 3];
            n++;
          }
        }
        const o = (y * nw + x) * 4;
        out[o] = r / n;
        out[o + 1] = g / n;
        out[o + 2] = b / n;
        out[o + 3] = a / n;
      }
    }
    return out;
  }
  for (let y = 0; y < nh; y++) {
    const fy = Math.min(h - 1, Math.max(0, ((y + 0.5) * h) / nh - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(h - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < nw; x++) {
      const fx = Math.min(w - 1, Math.max(0, ((x + 0.5) * w) / nw - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(w - 1, x0 + 1);
      const tx = fx - x0;
      const o = (y * nw + x) * 4;
      for (let c = 0; c < 4; c++) {
        out[o + c] = rgba[(y0 * w + x0) * 4 + c] * (1 - tx) * (1 - ty) + rgba[(y0 * w + x1) * 4 + c] * tx * (1 - ty) + rgba[(y1 * w + x0) * 4 + c] * (1 - tx) * ty + rgba[(y1 * w + x1) * 4 + c] * tx * ty;
      }
    }
  }
  return out;
}

/* One byte per pixel, averaged when shrinking (for soft alpha), nearest when growing. */
export function resizeGray(bytes, w, h, nw, nh) {
  const out = new Uint8Array(nw * nh);
  for (let y = 0; y < nh; y++) {
    const sy0 = Math.floor((y * h) / nh);
    const sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) * h) / nh));
    for (let x = 0; x < nw; x++) {
      const sx0 = Math.floor((x * w) / nw);
      const sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) * w) / nw));
      let sum = 0;
      let n = 0;
      for (let sy = sy0; sy < sy1; sy++) for (let sx = sx0; sx < sx1; sx++) {
        sum += bytes[sy * w + sx];
        n++;
      }
      out[y * nw + x] = Math.round(sum / n);
    }
  }
  return out;
}

export function resizeMask(mask, w, h, nw, nh) {
  const out = new Uint8Array(nw * nh);
  for (let y = 0; y < nh; y++) {
    const sy0 = Math.floor((y * h) / nh);
    const sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) * h) / nh));
    for (let x = 0; x < nw; x++) {
      const sx0 = Math.floor((x * w) / nw);
      const sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) * w) / nw));
      let on = 0;
      let n = 0;
      for (let sy = sy0; sy < sy1; sy++) for (let sx = sx0; sx < sx1; sx++) {
        if (mask[sy * w + sx] > 127) on++;
        n++;
      }
      out[y * nw + x] = on * 2 >= n ? 255 : 0;
    }
  }
  return out;
}

/* Turns the picture and its mask clockwise by any angle in degrees. The canvas grows to hold the
   whole turned picture; the corners that open up take the fill colour. Multiples of 90 are exact. */
export function rotate(rgba, mask, w, h, deg, fill) {
  fill = fill || [255, 255, 255];
  let d = ((deg % 360) + 360) % 360;
  if (d % 90 === 0) {
    const q = d / 90;
    const nw = q % 2 ? h : w;
    const nh = q % 2 ? w : h;
    const out = new Uint8ClampedArray(nw * nh * 4);
    const om = new Uint8Array(nw * nh);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let nx;
        let ny;
        if (q === 0) {
          nx = x;
          ny = y;
        } else if (q === 1) {
          nx = h - 1 - y;
          ny = x;
        } else if (q === 2) {
          nx = w - 1 - x;
          ny = h - 1 - y;
        } else {
          nx = y;
          ny = w - 1 - x;
        }
        const s = (y * w + x) * 4;
        const t = (ny * nw + nx) * 4;
        out[t] = rgba[s];
        out[t + 1] = rgba[s + 1];
        out[t + 2] = rgba[s + 2];
        out[t + 3] = rgba[s + 3];
        om[ny * nw + nx] = mask[y * w + x];
      }
    }
    return { rgba: out, mask: om, width: nw, height: nh };
  }
  const rad = (d * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const nw = Math.max(1, Math.round(w * Math.abs(cos) + h * Math.abs(sin)));
  const nh = Math.max(1, Math.round(w * Math.abs(sin) + h * Math.abs(cos)));
  const out = new Uint8ClampedArray(nw * nh * 4);
  const om = new Uint8Array(nw * nh);
  const cx = w / 2;
  const cy = h / 2;
  const ncx = nw / 2;
  const ncy = nh / 2;
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      /* where this destination pixel came from: turn back by the angle */
      const dx = x + 0.5 - ncx;
      const dy = y + 0.5 - ncy;
      const sx = cos * dx + sin * dy + cx - 0.5;
      const sy = -sin * dx + cos * dy + cy - 0.5;
      const o = (y * nw + x) * 4;
      if (sx < -0.5 || sy < -0.5 || sx > w - 0.5 || sy > h - 0.5) {
        out[o] = fill[0];
        out[o + 1] = fill[1];
        out[o + 2] = fill[2];
        out[o + 3] = 255;
        continue;
      }
      const x0 = Math.max(0, Math.floor(sx));
      const y0 = Math.max(0, Math.floor(sy));
      const x1 = Math.min(w - 1, x0 + 1);
      const y1 = Math.min(h - 1, y0 + 1);
      const tx = Math.min(1, Math.max(0, sx - x0));
      const ty = Math.min(1, Math.max(0, sy - y0));
      for (let c = 0; c < 4; c++) {
        out[o + c] = rgba[(y0 * w + x0) * 4 + c] * (1 - tx) * (1 - ty) + rgba[(y0 * w + x1) * 4 + c] * tx * (1 - ty) + rgba[(y1 * w + x0) * 4 + c] * (1 - tx) * ty + rgba[(y1 * w + x1) * 4 + c] * tx * ty;
      }
      const mx = Math.min(w - 1, Math.max(0, Math.round(sx)));
      const my = Math.min(h - 1, Math.max(0, Math.round(sy)));
      om[y * nw + x] = mask[my * w + mx] > 127 ? 255 : 0;
    }
  }
  return { rgba: out, mask: om, width: nw, height: nh };
}

export function mirror(rgba, mask, w, h) {
  const out = new Uint8ClampedArray(w * h * 4);
  const om = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4;
      const t = (y * w + (w - 1 - x)) * 4;
      out[t] = rgba[s];
      out[t + 1] = rgba[s + 1];
      out[t + 2] = rgba[s + 2];
      out[t + 3] = rgba[s + 3];
      om[y * w + (w - 1 - x)] = mask[y * w + x];
    }
  }
  return { rgba: out, mask: om, width: w, height: h };
}

export const MIN_CROP = 20;
/* box: x0, y0 inclusive; x1, y1 exclusive. Clamped to the picture. */
export function crop(rgba, mask, w, h, box) {
  const x0 = Math.max(0, Math.round(Math.min(box.x0, box.x1)));
  const y0 = Math.max(0, Math.round(Math.min(box.y0, box.y1)));
  const x1 = Math.min(w, Math.round(Math.max(box.x0, box.x1)));
  const y1 = Math.min(h, Math.round(Math.max(box.y0, box.y1)));
  const cw = x1 - x0;
  const ch = y1 - y0;
  if (cw < MIN_CROP || ch < MIN_CROP) throw new RangeError('The crop is too small: keep at least ' + MIN_CROP + ' pixels each way.');
  const out = new Uint8ClampedArray(cw * ch * 4);
  const om = mask ? new Uint8Array(cw * ch) : null;
  for (let y = 0; y < ch; y++) {
    const srow = (y0 + y) * w + x0;
    out.set(rgba.subarray(srow * 4, (srow + cw) * 4), y * cw * 4);
    if (om) om.set(mask.subarray(srow, srow + cw), y * cw);
  }
  return { rgba: out, mask: om, width: cw, height: ch };
}
