/* aWardrobe infra: the editing document that lives in the worker (architecture 6.1, 6.3). It
   owns the working pixels, the mask, the selection and the undo history. Every tool is a command
   here: it changes the document, keeps a record that reverses it, and answers with the rectangle
   that changed (a stroke in progress) or the whole picture (everything else). The main thread
   only draws previews and sends points. */
import { createStack } from '../domain/commands.js';
import { paintDisc, floodByColour, smartSelect, rleEncode, rleDecode, coverage } from '../domain/image/mask.js';
import { rotate, mirror, crop, MIN_CROP } from '../domain/image/raster.js';
import { removeSkin } from '../domain/image/skin.js';
import { autoCutout } from '../domain/image/segment.js';

const SNAP_REACH = 2.5;
const DYE_REFERENCE = 150;

/* ---------- lossless packing of a pixel buffer for rotate and crop records ---------- */
async function pack(bytes) {
  if (typeof CompressionStream !== 'function') return { raw: new Uint8Array(bytes) };
  const blob = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'))).blob();
  return { blob, length: bytes.length };
}
async function unpack(rec) {
  if (rec.raw) return new Uint8ClampedArray(rec.raw);
  const buf = await new Response(rec.blob.stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
  return new Uint8ClampedArray(buf);
}
const recordBytes = (rec) => (rec.raw ? rec.raw.length : rec.blob.size);

export function createDocument() {
  let doc = null;
  const strokes = new Map();
  let nextStroke = 1;
  let pending = null;

  const w = () => doc.width;
  const h = () => doc.height;
  const labels = () => doc.stack.labels();
  const state = () => ({ labels: labels(), coverage: coverage(doc.mask), width: doc.width, height: doc.height, hasSelection: doc.selCount > 0, length: doc.stack.length, bytes: doc.stack.bytes, strength: doc.strength, extreme: doc.extreme || null, lowContrast: !!doc.lowContrast });
  const countSel = () => {
    let n = 0;
    const s = doc.sel;
    for (let i = 0; i < s.length; i++) if (s[i]) n++;
    return n;
  };
  const clampRect = (x0, y0, x1, y1) => ({ x0: Math.max(0, Math.floor(x0)), y0: Math.max(0, Math.floor(y0)), x1: Math.min(w(), Math.ceil(x1)), y1: Math.min(h(), Math.ceil(y1)) });
  const unionRect = (a, b) => (a ? { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) } : b);
  const bytesIn = (buf, channels, rect) => {
    const rw = rect.x1 - rect.x0;
    const rh = rect.y1 - rect.y0;
    const out = channels === 4 ? new Uint8ClampedArray(rw * rh * 4) : new Uint8Array(rw * rh);
    for (let y = 0; y < rh; y++) {
      const src = ((rect.y0 + y) * w() + rect.x0) * channels;
      out.set(buf.subarray(src, src + rw * channels), y * rw * channels);
    }
    return out;
  };
  /* a reply with only the changed box */
  const rectReply = (rect, extra) => {
    const r = Object.assign({ rect }, state(), extra || {});
    const transfer = [];
    if (extra && extra.withRgba) {
      r.rgba = bytesIn(doc.rgba, 4, rect);
      transfer.push(r.rgba.buffer);
    }
    if (!extra || extra.withMask !== false) {
      r.mask = bytesIn(doc.mask, 1, rect);
      transfer.push(r.mask.buffer);
    }
    if (extra && extra.withSel) {
      r.sel = bytesIn(doc.sel, 1, rect);
      transfer.push(r.sel.buffer);
    }
    delete r.withRgba;
    delete r.withMask;
    delete r.withSel;
    return { result: r, transfer };
  };
  /* a reply with the whole picture: after a tap command, undo, redo, rotate, crop */
  const fullReply = (what, extra) => {
    const r = Object.assign({ full: true, size: { width: w(), height: h() } }, state(), extra || {});
    const transfer = [];
    if (what.rgba) {
      r.rgba = new Uint8ClampedArray(doc.rgba);
      transfer.push(r.rgba.buffer);
    }
    r.mask = new Uint8Array(doc.mask);
    transfer.push(r.mask.buffer);
    if (what.sel) {
      r.sel = new Uint8Array(doc.sel);
      transfer.push(r.sel.buffer);
    }
    return { result: r, transfer };
  };
  const nothing = (message) => ({ result: Object.assign({ nothing: true, message }, state()) });

  /* ---------- records ---------- */
  const maskSnapshot = () => rleEncode(doc.mask);
  const selSnapshot = () => rleEncode(doc.sel);
  const restoreMask = (snap) => {
    doc.mask = rleDecode(snap, w() * h());
  };
  const restoreSel = (snap) => {
    doc.sel = rleDecode(snap, w() * h());
    doc.selCount = countSel();
  };
  /* a command whose record is the mask (and selection) before and after */
  const flags = () => ({ strength: doc.strength, extreme: doc.extreme || null, lowContrast: !!doc.lowContrast });
  const setFlags = (f) => {
    doc.strength = f.strength;
    doc.extreme = f.extreme;
    doc.lowContrast = f.lowContrast;
  };
  const maskCommand = (label, change, opts) => {
    opts = opts || {};
    const before = maskSnapshot();
    const selBefore = opts.sel ? selSnapshot() : null;
    const flagsBefore = flags();
    const cmd = {
      label,
      bytes: before.byteLength + (selBefore ? selBefore.byteLength : 0),
      after: null,
      selAfter: null,
      flagsAfter: null,
      run: change,
      undo() {
        /* the after record is taken the first time only; redo puts the same bytes back */
        if (!cmd.after) {
          cmd.after = maskSnapshot();
          if (opts.sel) cmd.selAfter = selSnapshot();
          cmd.flagsAfter = flags();
          cmd.bytes += cmd.after.byteLength + (cmd.selAfter ? cmd.selAfter.byteLength : 0);
        }
        restoreMask(before);
        if (opts.sel) restoreSel(selBefore);
        setFlags(flagsBefore);
      },
      redo() {
        restoreMask(cmd.after);
        if (opts.sel) restoreSel(cmd.selAfter);
        setFlags(cmd.flagsAfter);
      },
      touches: { mask: true, sel: !!opts.sel }
    };
    return cmd;
  };

  /* ---------- strokes: eraser, restore, select, paint ---------- */
  /* `reach` is how far a disc can touch (the Select snap reaches past the brush), for the rect */
  const discsAlong = (stroke, points, fn, reach) => {
    let rect = null;
    const r = reach || stroke.radius;
    const step = Math.max(1, stroke.radius / 2);
    const W = w();
    const H = h();
    /* a disc wholly outside the picture (a finger in the letterbox margin) is skipped */
    const disc = (x, y) => {
      if (x < -r || y < -r || x > W + r || y > H + r) return;
      stroke.inside = true;
      fn(x, y);
      rect = unionRect(rect, clampRect(x - r - 1, y - r - 1, x + r + 1, y + r + 1));
    };
    for (const p of points) {
      const last = stroke.last;
      if (last) {
        const dist = Math.hypot(p.x - last.x, p.y - last.y);
        const steps = Math.max(1, Math.ceil(dist / step));
        for (let k = 1; k <= steps; k++) disc(last.x + ((p.x - last.x) * k) / steps, last.y + ((p.y - last.y) * k) / steps);
      } else disc(p.x, p.y);
      stroke.last = p;
    }
    return rect;
  };
  /* each apply returns the rectangle that changed, or null when the batch changed no pixel */
  const applyMaskStroke = (stroke, points) => {
    const value = stroke.mode === 'restore' ? 255 : 0;
    let n = 0;
    const rect = discsAlong(stroke, points, (x, y) => {
      n += paintDisc(doc.mask, w(), h(), x, y, stroke.radius, value);
    });
    return n ? rect : null;
  };
  const applySelectStroke = (stroke, points) => {
    const reach = stroke.snap ? stroke.radius * SNAP_REACH : stroke.radius;
    const tol = stroke.snap ? stroke.tolerance : null;
    if (tol !== null && !stroke.seen) stroke.seen = new Uint8Array(w() * h());
    const before = doc.selCount;
    const rect = discsAlong(stroke, points, (x, y) => {
      if (stroke.seen) {
        stroke.stamp = (stroke.stamp || 0) + 1;
        if (stroke.stamp > 255) {
          stroke.seen.fill(0);
          stroke.stamp = 1;
        }
      }
      doc.selCount += smartSelect(doc.rgba, w(), h(), doc.mask, doc.sel, x, y, reach, tol, stroke.seen, stroke.stamp);
    }, reach);
    return doc.selCount > before ? rect : null;
  };
  const applyPaintStroke = (stroke, points) => {
    const [cr, cg, cb] = stroke.colour;
    const rgba = doc.rgba;
    const W = w();
    const before = stroke.saved.n;
    const rect = discsAlong(stroke, points, (cx, cy) => {
      const r = stroke.radius;
      const x0 = Math.max(0, Math.floor(cx - r));
      const x1 = Math.min(W - 1, Math.ceil(cx + r));
      const y0 = Math.max(0, Math.floor(cy - r));
      const y1 = Math.min(h() - 1, Math.ceil(cy + r));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > r * r) continue;
          const p = y * W + x;
          /* a stroke paints each pixel once, so a pass back over it does not deepen the dye */
          if (doc.mask[p] <= 127 || stroke.touched[p]) continue;
          const i = p * 4;
          stroke.touched[p] = 1;
          savePixel(stroke.saved, p, rgba[i], rgba[i + 1], rgba[i + 2]);
          if (stroke.mode === 'dye') {
            const lum = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
            const f = Math.min(1.6, lum / DYE_REFERENCE);
            rgba[i] = Math.min(255, cr * f);
            rgba[i + 1] = Math.min(255, cg * f);
            rgba[i + 2] = Math.min(255, cb * f);
          } else {
            rgba[i] = cr;
            rgba[i + 1] = cg;
            rgba[i + 2] = cb;
          }
        }
      }
    });
    return stroke.saved.n > before ? rect : null;
  };
  /* a paint stroke's record: pixel indexes and their previous colours in typed arrays that grow */
  const newSaved = () => ({ idx: new Uint32Array(4096), col: new Uint8Array(4096 * 3), n: 0 });
  const savePixel = (sv, p, r, g, b) => {
    if (sv.n === sv.idx.length) {
      const idx = new Uint32Array(sv.idx.length * 2);
      idx.set(sv.idx);
      sv.idx = idx;
      const col = new Uint8Array(sv.col.length * 2);
      col.set(sv.col);
      sv.col = col;
    }
    sv.idx[sv.n] = p;
    sv.col[sv.n * 3] = r;
    sv.col[sv.n * 3 + 1] = g;
    sv.col[sv.n * 3 + 2] = b;
    sv.n++;
  };
  const startStroke = (params) => {
    const mode = params.mode;
    const isPaint = mode === 'dye' || mode === 'solid';
    const isSelect = mode === 'select';
    const stroke = { id: nextStroke++, mode, radius: Math.max(0.5, Number(params.radius) || 10), snap: !!params.snap, tolerance: params.tolerance === undefined ? 30 : params.tolerance, colour: params.colour || [0, 0, 0], last: null, touched: isPaint ? new Uint8Array(w() * h()) : null, saved: isPaint ? newSaved() : null, applied: false, inside: false };
    let cmd;
    if (isPaint) {
      cmd = {
        label: 'paint stroke',
        bytes: 0,
        after: null,
        run() {},
        extend() {},
        undo() {
          const sv = stroke.saved;
          if (!cmd.after) {
            cmd.after = new Uint8ClampedArray(sv.n * 3);
            cmd.bytes = sv.n * 7 + cmd.after.byteLength;
          }
          for (let k = 0; k < sv.n; k++) {
            const i = sv.idx[k] * 4;
            cmd.after[k * 3] = doc.rgba[i];
            cmd.after[k * 3 + 1] = doc.rgba[i + 1];
            cmd.after[k * 3 + 2] = doc.rgba[i + 2];
            doc.rgba[i] = sv.col[k * 3];
            doc.rgba[i + 1] = sv.col[k * 3 + 1];
            doc.rgba[i + 2] = sv.col[k * 3 + 2];
          }
        },
        redo() {
          const sv = stroke.saved;
          const a = cmd.after;
          for (let k = 0; k < sv.n; k++) {
            const i = sv.idx[k] * 4;
            doc.rgba[i] = a[k * 3];
            doc.rgba[i + 1] = a[k * 3 + 1];
            doc.rgba[i + 2] = a[k * 3 + 2];
          }
        },
        release() {
          stroke.saved = newSaved();
          cmd.after = null;
        },
        touches: { rgba: true }
      };
    } else {
      cmd = maskCommand(isSelect ? 'selection' : 'brush stroke', () => {}, { sel: isSelect });
      cmd.extend = () => {};
    }
    stroke.cmd = cmd;
    strokes.set(stroke.id, stroke);
    return stroke;
  };
  const strokeApply = (stroke, points) => {
    if (stroke.mode === 'select') return applySelectStroke(stroke, points);
    if (stroke.mode === 'dye' || stroke.mode === 'solid') return applyPaintStroke(stroke, points);
    return applyMaskStroke(stroke, points);
  };
  const strokeReply = (stroke, rect) => {
    if (stroke.mode === 'select') return rectReply(rect, { strokeId: stroke.id, withMask: false, withSel: true });
    if (stroke.mode === 'dye' || stroke.mode === 'solid') {
      stroke.cmd.bytes = stroke.saved.n * 7;
      return rectReply(rect, { strokeId: stroke.id, withMask: false, withRgba: true });
    }
    return rectReply(rect, { strokeId: stroke.id });
  };
  const isPaintStroke = (stroke) => stroke.mode === 'dye' || stroke.mode === 'solid';
  /* after a batch of points: the stroke joins the history the first time it touches the picture
     (a stroke that starts in the margin stays pending until it comes in) */
  const strokeProgress = (stroke, rect) => {
    if (!rect) {
      const msg = stroke.inside && isPaintStroke(stroke) && !stroke.applied ? 'Paint only colours the cut-out. Brush over the garment.' : null;
      return { result: Object.assign({ nothing: true, strokeId: stroke.id, pending: !stroke.applied }, msg ? { message: msg } : {}, state()) };
    }
    if (!stroke.applied) {
      stroke.applied = true;
      doc.stack.apply(stroke.cmd);
    } else doc.stack.extend(stroke.cmd, []);
    return strokeReply(stroke, rect);
  };

  /* ---------- the commands that take a whole picture ---------- */
  async function applyPixelCommand(label, compute) {
    const prevRgba = await pack(doc.rgba);
    const prevMask = maskSnapshot();
    const prevSel = selSnapshot();
    const prevSize = { width: w(), height: h() };
    const prevStrength = doc.strength;
    let nextRgba = null;
    let nextMask = null;
    let nextSize = null;
    const cmd = {
      label,
      bytes: recordBytes(prevRgba) + prevMask.byteLength + prevSel.byteLength,
      run() {
        const out = compute();
        doc.rgba = out.rgba;
        doc.mask = out.mask;
        doc.width = out.width;
        doc.height = out.height;
        doc.sel = new Uint8Array(out.width * out.height);
        doc.selCount = 0;
      },
      undo() {
        pending = (async () => {
          if (!nextRgba) {
            nextRgba = await pack(doc.rgba);
            nextMask = maskSnapshot();
            nextSize = { width: w(), height: h() };
            cmd.bytes += recordBytes(nextRgba) + nextMask.byteLength;
          }
          doc.width = prevSize.width;
          doc.height = prevSize.height;
          doc.rgba = await unpack(prevRgba);
          restoreMask(prevMask);
          restoreSel(prevSel);
          doc.strength = prevStrength;
        })();
      },
      redo() {
        pending = (async () => {
          doc.width = nextSize.width;
          doc.height = nextSize.height;
          doc.rgba = await unpack(nextRgba);
          restoreMask(nextMask);
          doc.sel = new Uint8Array(w() * h());
          doc.selCount = 0;
        })();
      },
      release() {
        nextRgba = null;
      },
      touches: { rgba: true, sel: true, size: true }
    };
    doc.stack.apply(cmd);
    return fullReply({ rgba: true, sel: true });
  }

  /* ---------- the public handlers ---------- */
  const api = {
    open({ rgba, width, height, mask, strength, lowContrast }) {
      api.close();
      doc = { rgba: new Uint8ClampedArray(rgba.buffer ? rgba : new Uint8ClampedArray(rgba)), mask: mask ? new Uint8Array(mask) : new Uint8Array(width * height).fill(255), sel: new Uint8Array(width * height), selCount: 0, width, height, strength: strength === undefined ? 50 : strength, lowContrast: !!lowContrast, extreme: null, stack: createStack() };
      return { result: state() };
    },
    close() {
      if (doc) doc.stack.clear();
      doc = null;
      strokes.clear();
      return { result: { ok: true } };
    },
    state() {
      return { result: state() };
    },
    snapshot() {
      return fullReply({ rgba: true, sel: true });
    },
    async command(params) {
      if (!doc) throw new Error('No photo is open in the editor.');
      const t = params.type;
      if (t === 'brush' || t === 'paint') {
        const stroke = startStroke(params);
        return strokeProgress(stroke, strokeApply(stroke, params.points || []));
      }
      if (t === 'brushMore') {
        const stroke = strokes.get(params.strokeId);
        if (!stroke) return nothing('That stroke has already ended.');
        /* an undo, a tap or a button in the middle of a stroke ended it: nothing more is applied */
        if (stroke.applied && doc.stack.latest !== stroke.cmd) {
          strokes.delete(stroke.id);
          return { result: Object.assign({ nothing: true, strokeId: stroke.id, ended: true }, state()) };
        }
        return strokeProgress(stroke, strokeApply(stroke, params.points || []));
      }
      if (t === 'brushEnd') {
        const stroke = strokes.get(params.strokeId);
        if (stroke) {
          stroke.touched = null;
          stroke.seen = null;
          strokes.delete(stroke.id);
        }
        return { result: state() };
      }
      if (t === 'wand') {
        const remove = params.mode !== 'restore';
        const snap = maskSnapshot();
        const changed = floodByColour(doc.rgba, w(), h(), doc.mask, params.x, params.y, params.tolerance === undefined ? 30 : params.tolerance, remove ? 255 : 0, remove ? 0 : 255);
        if (!changed) return nothing(remove ? 'Nothing to remove there.' : 'Nothing to bring back there.');
        /* the change is already made; the command records it */
        const cmd = maskCommandFrom(snap, 'wand');
        doc.stack.apply(cmd);
        return fullReply({}, { changed });
      }
      if (t === 'selectApply') {
        const action = params.action;
        if (action === 'clear') {
          if (!doc.selCount) return nothing('Nothing is selected.');
          const cmd = maskCommand('clear selection', () => {
            doc.sel.fill(0);
            doc.selCount = 0;
          }, { sel: true });
          doc.stack.apply(cmd);
          return fullReply({ sel: true });
        }
        if (!doc.selCount) return nothing('Brush over the area first, then choose what to do with it.');
        const keep = action === 'keep';
        const cmd = maskCommand(keep ? 'keep only this' : 'remove this', () => {
          const m = doc.mask;
          const s = doc.sel;
          for (let i = 0; i < m.length; i++) {
            if (keep) {
              if (!s[i]) m[i] = 0;
            } else if (s[i]) m[i] = 0;
          }
          doc.sel.fill(0);
          doc.selCount = 0;
        }, { sel: true });
        doc.stack.apply(cmd);
        return fullReply({ sel: true });
      }
      if (t === 'skin') {
        const snap = maskSnapshot();
        const keptBefore = Math.round(coverage(doc.mask) * w() * h());
        const removed = removeSkin(doc.rgba, w(), h(), doc.mask);
        if (!removed) return nothing('No skin found in the cut-out.');
        doc.stack.apply(maskCommandFrom(snap, 'remove skin'));
        return fullReply({}, { removed, removedShare: keptBefore ? removed / keptBefore : 0 });
      }
      if (t === 'strength' || t === 'cutAgain') {
        const strength = t === 'strength' ? Math.max(0, Math.min(100, Math.round(Number(params.strength) || 0))) : doc.strength;
        const r = autoCutout(new ImageData(doc.rgba, w(), h()), { strength, keepWhole: false });
        const snap = maskSnapshot();
        const cmd = maskCommandFrom(snap, t === 'strength' ? 'strength' : 'cut out again');
        doc.mask = r.mask;
        doc.strength = strength;
        doc.extreme = r.extreme || null;
        doc.lowContrast = !!r.lowContrast;
        doc.stack.apply(cmd);
        return fullReply({}, { separation: r.separation, method: r.method, bg: r.bg });
      }
      if (t === 'mirror') {
        const cmd = {
          label: 'mirror',
          bytes: 0,
          run() {
            const out = mirror(doc.rgba, doc.mask, w(), h());
            doc.rgba = out.rgba;
            doc.mask = out.mask;
            const s = new Uint8Array(w() * h());
            for (let y = 0; y < h(); y++) for (let x = 0; x < w(); x++) s[y * w() + (w() - 1 - x)] = doc.sel[y * w() + x];
            doc.sel = s;
          },
          undo() {
            cmd.run();
          },
          touches: { rgba: true, sel: true }
        };
        doc.stack.apply(cmd);
        return fullReply({ rgba: true, sel: true });
      }
      if (t === 'rotate') {
        const deg = Number(params.degrees) || 0;
        if (((deg % 360) + 360) % 360 === 0) return nothing('No turn to make.');
        return applyPixelCommand('rotate', () => rotate(doc.rgba, doc.mask, w(), h(), deg, params.fill));
      }
      if (t === 'crop') {
        const box = params.box || {};
        const x0 = Math.max(0, Math.round(Math.min(box.x0, box.x1)));
        const y0 = Math.max(0, Math.round(Math.min(box.y0, box.y1)));
        const x1 = Math.min(w(), Math.round(Math.max(box.x0, box.x1)));
        const y1 = Math.min(h(), Math.round(Math.max(box.y0, box.y1)));
        if (x1 - x0 < MIN_CROP || y1 - y0 < MIN_CROP) return nothing('That box is too small to crop to: make it at least ' + MIN_CROP + ' pixels each way.');
        if (x0 === 0 && y0 === 0 && x1 === w() && y1 === h()) return nothing('That box is the whole picture.');
        return applyPixelCommand('crop', () => crop(doc.rgba, doc.mask, w(), h(), { x0, y0, x1, y1 }));
      }
      throw new Error('unknown command ' + t);
    },
    async undo() {
      if (!doc || !doc.stack.canUndo) return nothing('Nothing to undo.');
      const cmd = doc.stack.latest;
      doc.stack.undo();
      if (pending) await pending;
      pending = null;
      return fullReply({ rgba: !!(cmd.touches && cmd.touches.rgba), sel: !!(cmd.touches && cmd.touches.sel) });
    },
    async redo() {
      if (!doc || !doc.stack.canRedo) return nothing('Nothing to redo.');
      doc.stack.redo();
      if (pending) await pending;
      pending = null;
      const cmd = doc.stack.latest;
      return fullReply({ rgba: !!(cmd.touches && cmd.touches.rgba), sel: !!(cmd.touches && cmd.touches.sel) });
    }
  };

  /* a mask command whose change has already been made: the record is the snapshot from before */
  function maskCommandFrom(before, label) {
    const flagsBefore = flags();
    const cmd = {
      label,
      bytes: before.byteLength,
      after: null,
      flagsAfter: null,
      run() {},
      undo() {
        if (!cmd.after) {
          cmd.after = maskSnapshot();
          cmd.flagsAfter = flags();
          cmd.bytes += cmd.after.byteLength;
        }
        restoreMask(before);
        setFlags(flagsBefore);
      },
      redo() {
        restoreMask(cmd.after);
        setFlags(cmd.flagsAfter);
      },
      touches: { mask: true }
    };
    return cmd;
  }
  return api;
}
