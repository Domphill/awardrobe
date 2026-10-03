/* aWardrobe app: the editor's state for one photo (architecture section 6). The worker owns the
   editing document and its undo history; this session keeps a preview copy of the pixels, the
   mask and the selection, sends commands and applies the rectangles that come back, so the
   screen never holds the only copy of anything. Also: open, the automatic cut-out, whole photo,
   colours and the type guess, the draft, and the final save. */
import { decodeOnMain } from '../infra/decode.js';
import { HEIC_HINT } from '../infra/image-pipeline.js';
import { decodeBlob } from './pictures.js';

const DRAFT_KEYS = ['width', 'height', 'original', 'strength', 'choice', 'autoWhole', 'coverage', 'lowContrast', 'separation', 'bg', 'method', 'colours', 'shape', 'guess', 'opens', 'tool', 'paintColour', 'originalId'];
/* with no cut-out, the colours are read from the middle of the picture, where the garment is */
const CENTRE_FROM = 0.22;
const CENTRE_TO = 0.78;
const RESTARTED = 'The photo tools restarted; your last change may be lost.';
export const DEFAULT_OPTIONS = { size: 'medium', tolerance: 30, snap: true, wandMode: 'remove', paintMode: 'dye', dropperTarget: 'garment', angle: 0 };

export function createSession(app) {
  const worker = app.images();
  const listeners = new Set();
  const s = {
    status: 'empty',
    busy: null,
    error: null,
    opens: 0,
    width: 0,
    height: 0,
    work: null,
    original: null,
    originalId: null,
    mask: null,
    sel: null,
    selection: 0,
    coverage: 0,
    lowContrast: false,
    separation: null,
    bg: null,
    method: null,
    autoWhole: false,
    extreme: null,
    choice: null,
    wholePhoto: false,
    strength: 50,
    colours: [],
    shape: null,
    guess: null,
    labels: { undo: null, redo: null },
    steps: 0,
    dirty: false,
    tool: 'move',
    paintColour: '#c8302c',
    bytes: 0,
    options: Object.assign({}, DEFAULT_OPTIONS)
  };
  /* revisions of the pixels and the mask, so the draft encodes only what changed */
  const rev = { pixels: 0, mask: 0 };
  let preview = null;
  let previewDirty = 'all';
  let originalCanvas = null;
  let selCanvas = null;
  let selDirty = 'all';
  let docOpen = false;
  let stroke = null;
  const draftCache = { opens: -1, photo: null, pixels: -1, mask: -1, maskBlob: null };
  const emit = () => {
    for (const fn of listeners) {
      try {
        fn(s);
      } catch (e) {
        console.error(e);
      }
    }
  };
  const rgbaCopy = () => new Uint8ClampedArray(s.work.data);
  const maskCopy = () => new Uint8Array(s.mask);
  const fullMask = () => new Uint8Array(s.width * s.height).fill(255);
  const centreMask = () => {
    const m = new Uint8Array(s.width * s.height);
    const x0 = Math.floor(s.width * CENTRE_FROM);
    const x1 = Math.ceil(s.width * CENTRE_TO);
    for (let y = Math.floor(s.height * CENTRE_FROM); y < s.height * CENTRE_TO; y++) m.fill(255, y * s.width + x0, y * s.width + x1);
    return m;
  };
  const effectiveWhole = () => (s.choice === null ? s.autoWhole : s.choice);
  const coverageOf = (m) => {
    let n = 0;
    for (let i = 0; i < m.length; i++) if (m[i] > 127) n++;
    return m.length ? n / m.length : 0;
  };
  const freeCanvas = (c) => {
    if (c) {
      c.width = 0;
      c.height = 0;
    }
  };
  const dropPreview = () => {
    freeCanvas(preview);
    preview = null;
    previewDirty = 'all';
    freeCanvas(originalCanvas);
    originalCanvas = null;
    freeCanvas(selCanvas);
    selCanvas = null;
    selDirty = 'all';
  };
  const unionRect = (a, b) => {
    if (a === 'all' || b === 'all') return 'all';
    if (!a) return b;
    return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
  };
  const countSel = () => {
    let n = 0;
    for (let i = 0; i < s.sel.length; i++) if (s.sel[i]) n++;
    return n;
  };

  /* ---------- the worker ---------- */
  async function decode(file) {
    try {
      return await worker.call('open', { file });
    } catch (e) {
      try {
        return await decodeOnMain(file, {});
      } catch (e2) {
        throw e && e.name === 'ImageError' ? e : e2;
      }
    }
  }
  /* the first automatic pass, which may keep the whole photo (FR-27) */
  async function firstCut(strength) {
    strength = strength === undefined ? 50 : strength;
    const rgba = rgbaCopy();
    const r = await worker.call('segment', { rgba, width: s.width, height: s.height, strength, keepWhole: true }, [rgba.buffer]);
    s.mask = r.mask || null;
    s.coverage = r.coverage || 0;
    s.lowContrast = !!r.lowContrast;
    s.separation = r.separation === undefined ? null : r.separation;
    s.bg = r.bg || null;
    s.method = r.method || null;
    s.autoWhole = !!r.wholePhoto;
    s.extreme = null;
    s.strength = strength;
    s.wholePhoto = effectiveWhole();
    rev.pixels++;
    rev.mask++;
  }
  /* a saved cut-out's alpha put back where it sat in the working picture (FR-31: carry on with
     the cut-out as it was, brush fixes and all). The saved working size may differ by a pixel or
     two from today's decode of the same original, so the box is scaled; a different shape (the
     picture was turned or cropped before saving) cannot be placed and gives null. */
  async function seededMask(seed) {
    if (!seed || !seed.alpha || !seed.box || !seed.work) return null;
    const sx = s.width / seed.work.width;
    const sy = s.height / seed.work.height;
    if (Math.abs(sx - sy) > 0.01) return null;
    const bmp = await decodeBlob(seed.alpha);
    const c = document.createElement('canvas');
    c.width = s.width;
    c.height = s.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const b = seed.box;
    ctx.drawImage(bmp, b.x0 * sx, b.y0 * sy, (b.x1 - b.x0 + 1) * sx, (b.y1 - b.y0 + 1) * sy);
    const d = ctx.getImageData(0, 0, s.width, s.height).data;
    const m = new Uint8Array(s.width * s.height);
    for (let p = 0, i = 0; p < m.length; p++, i += 4) m[p] = d[i + 3] ? d[i] : 0;
    freeCanvas(c);
    if (bmp.close) bmp.close();
    return m;
  }
  async function openDocument() {
    const rgba = rgbaCopy();
    const mask = s.mask ? maskCopy() : fullMask();
    const r = await worker.call('docOpen', { rgba, width: s.width, height: s.height, mask, strength: s.strength, lowContrast: s.lowContrast }, [rgba.buffer, mask.buffer]);
    docOpen = true;
    s.sel = new Uint8Array(s.width * s.height);
    s.selection = 0;
    s.labels = r.labels;
    s.steps = r.length || 0;
    s.bytes = r.bytes || 0;
  }
  /* the photo tools died under us: the document is opened again from the preview copies, so the
     picture and the cut-out as last drawn are kept and only the undo history is lost (section 11) */
  async function recover() {
    docOpen = false;
    stroke = null;
    try {
      await openDocument();
      s.error = RESTARTED;
    } catch (e) {
      s.error = (e && e.message) || RESTARTED;
    }
    emit();
  }
  async function docCall(type, params) {
    try {
      return await worker.call(type, params);
    } catch (e) {
      if (e && e.name === 'WorkerError' && s.work) {
        await recover();
        const err = new Error(RESTARTED);
        err.name = 'EditorRestarted';
        throw err;
      }
      throw e;
    }
  }
  async function detect() {
    const rgba = rgbaCopy();
    const useMask = !!s.mask && !s.wholePhoto;
    const alpha = useMask ? maskCopy() : centreMask();
    const jobs = [worker.call('colours', { rgba, alpha, width: s.width, height: s.height, bg: s.bg, count: 3 }, [rgba.buffer, alpha.buffer])];
    if (s.mask) {
      const m = maskCopy();
      jobs.push(worker.call('shape', { mask: m, width: s.width, height: s.height }, [m.buffer]));
    }
    const [colours, shape] = await Promise.all(jobs);
    s.colours = (colours || []).map((c) => ({ name: c.name, hex: c.hex, share: c.share }));
    s.shape = shape && shape.length === 12 ? Array.from(shape) : null;
    s.guess = app.garments.guess(s.shape, s.colours);
  }
  /* a reply from the document, applied to the preview copies */
  function sync(r) {
    if (!r || r.nothing) return;
    s.error = null;
    const resized = r.size && (r.size.width !== s.width || r.size.height !== s.height);
    if (r.full) {
      if (resized) {
        s.width = r.size.width;
        s.height = r.size.height;
      }
      if (r.rgba || resized) rev.pixels++;
      if (r.mask) rev.mask++;
      if (r.rgba) s.work = new ImageData(r.rgba, s.width, s.height);
      if (r.mask) s.mask = r.mask;
      if (r.sel) s.sel = r.sel;
      else if (resized || !s.sel || s.sel.length !== s.width * s.height) s.sel = new Uint8Array(s.width * s.height);
      s.selection = countSel();
      dropPreview();
    } else if (r.rect) {
      const { x0, y0, x1, y1 } = r.rect;
      const rw = x1 - x0;
      for (let y = y0; y < y1; y++) {
        const dst = y * s.width + x0;
        const src = (y - y0) * rw;
        if (r.mask) s.mask.set(r.mask.subarray(src, src + rw), dst);
        if (r.rgba) s.work.data.set(r.rgba.subarray(src * 4, (src + rw) * 4), dst * 4);
        if (r.sel) {
          for (let x = 0; x < rw; x++) s.selection += (r.sel[src + x] ? 1 : 0) - (s.sel[dst + x] ? 1 : 0);
          s.sel.set(r.sel.subarray(src, src + rw), dst);
        }
      }
      if (r.mask) rev.mask++;
      if (r.rgba) rev.pixels++;
      if (r.mask || r.rgba) previewDirty = unionRect(previewDirty, r.rect);
      if (r.rgba) {
        freeCanvas(originalCanvas);
        originalCanvas = null;
      }
      if (r.sel) selDirty = unionRect(selDirty, r.rect);
    }
    if (r.labels) s.labels = r.labels;
    if (typeof r.length === 'number') s.steps = r.length;
    if (typeof r.bytes === 'number') s.bytes = r.bytes;
    if (typeof r.coverage === 'number') s.coverage = r.coverage;
    if (typeof r.strength === 'number') s.strength = r.strength;
    if (r.extreme !== undefined) s.extreme = r.extreme;
    if (typeof r.lowContrast === 'boolean') s.lowContrast = r.lowContrast;
    if (r.separation !== undefined) s.separation = r.separation;
    if (typeof r.hasSelection === 'boolean' && !r.hasSelection) s.selection = 0;
    s.dirty = true;
  }
  const command = async (params) => {
    if (!docOpen || s.status !== 'ready') return { nothing: true, message: 'The photo is still being prepared.' };
    if (stroke) await api.endStroke();
    const r = await docCall('docCommand', params);
    sync(r);
    emit();
    return r;
  };
  const working = async (label, fn) => {
    const was = s.status;
    s.status = 'cutting';
    s.busy = label;
    emit();
    try {
      return await fn();
    } finally {
      s.status = s.work ? 'ready' : was === 'cutting' ? 'empty' : was;
      s.busy = null;
      emit();
    }
  };
  /* the commands that take a whole picture run with the busy sign but with the status kept
     ready, because the document itself is the one place the work happens */
  const heavy = async (label, params) => {
    if (!docOpen || s.status !== 'ready') return { nothing: true, message: 'The photo is still being prepared.' };
    if (stroke) await api.endStroke();
    s.busy = label;
    emit();
    try {
      const r = await docCall('docCommand', params);
      sync(r);
      return r;
    } finally {
      s.busy = null;
      emit();
    }
  };

  const api = {
    get state() {
      return s;
    },
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /* a photo file in: decode and orient, cut out at the middle strength, read colours and type */
    async open(file, opts) {
      opts = opts || {};
      if (s.status === 'opening' || s.status === 'cutting') return;
      s.status = 'opening';
      s.busy = 'Opening the photo…';
      s.error = null;
      emit();
      try {
        const d = await decode(file);
        if (docOpen) worker.call('docClose', {}).catch(() => {});
        docOpen = false;
        stroke = null;
        s.work = d.work;
        s.width = d.width;
        s.height = d.height;
        s.original = opts.keepOriginalId ? null : { blob: d.original, width: d.originalWidth, height: d.originalHeight };
        s.originalId = opts.keepOriginalId || null;
        s.opens++;
        s.dirty = false;
        s.choice = null;
        s.labels = { undo: null, redo: null };
        s.steps = 0;
        s.options.angle = 0;
        dropPreview();
        s.status = 'cutting';
        s.busy = 'Cutting it out…';
        emit();
        const seed = opts.seed || null;
        await firstCut(seed && typeof seed.strength === 'number' ? seed.strength : 50);
        let seeded = false;
        if (seed) {
          if (seed.wholePhoto) {
            s.choice = true;
            s.wholePhoto = true;
            seeded = true;
          } else {
            const m = await seededMask(seed);
            if (m) {
              s.mask = m;
              s.autoWhole = false;
              s.wholePhoto = effectiveWhole();
              s.coverage = coverageOf(m);
              rev.mask++;
              seeded = true;
            }
          }
        }
        await openDocument();
        await detect();
        s.status = 'ready';
        s.busy = null;
        emit();
        return { seeded };
      } catch (e) {
        s.status = s.work ? 'ready' : 'empty';
        s.busy = null;
        s.error = (e && e.message) || HEIC_HINT;
        emit();
        throw e;
      }
    },
    /* redo the cut-out of a saved garment from its reduced original (FR-31) */
    async openFromPicture(rec, opts) {
      if (!rec || !rec.colour) throw new Error('This garment has no reduced original to work from.');
      return api.open(new File([rec.colour], 'original.jpg', { type: rec.colour.type || 'image/jpeg' }), Object.assign({ keepOriginalId: rec.id }, opts || {}));
    },

    /* ---------- the tools, as commands in the document ---------- */
    async setStrength(v) {
      v = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
      if (s.status !== 'ready' || v === s.strength) return null;
      s.error = null;
      return heavy('Cutting it out…', { type: 'strength', strength: v });
    },
    cutAgain: () => heavy('Cutting it out…', { type: 'cutAgain' }),
    /* a stroke: begin with the first points, add more once per frame, end when the finger
       lifts. Points that arrive before the document has answered the start are held back. */
    async beginStroke(mode, points, radius) {
      if (stroke) await api.endStroke();
      const o = s.options;
      const params = { type: mode === 'dye' || mode === 'solid' ? 'paint' : 'brush', mode, points, radius, snap: !!o.snap, tolerance: o.tolerance, colour: hexToRgb(s.paintColour) };
      if (!docOpen || s.status !== 'ready') return { nothing: true, message: 'The photo is still being prepared.' };
      const st = { id: null, queue: [], sending: null, start: null };
      stroke = st;
      st.start = docCall('docCommand', params).then(
        (r) => {
          sync(r);
          emit();
          if (r && r.strokeId) st.id = r.strokeId;
          else if (stroke === st) stroke = null;
          return r;
        },
        (e) => {
          if (stroke === st) stroke = null;
          throw e;
        }
      );
      return st.start;
    },
    strokeMore(points) {
      if (!stroke || !points.length) return Promise.resolve(null);
      const st = stroke;
      st.queue.push(...points);
      if (st.sending) return st.sending;
      st.sending = (async () => {
        try {
          await st.start;
          while (st.id && st.queue.length && stroke === st && docOpen) {
            const batch = st.queue.splice(0, st.queue.length);
            const r = await docCall('docCommand', { type: 'brushMore', strokeId: st.id, points: batch });
            sync(r);
            emit();
            if (r && r.ended) {
              /* something else changed the picture in the middle of the stroke: it is over */
              if (stroke === st) stroke = null;
              break;
            }
          }
        } finally {
          st.sending = null;
        }
      })();
      return st.sending;
    },
    async endStroke() {
      const st = stroke;
      if (!st) return null;
      try {
        await st.start;
        if (st.sending) await st.sending;
      } finally {
        if (stroke === st) stroke = null;
      }
      if (!st.id || !docOpen) return null;
      const r = await docCall('docCommand', { type: 'brushEnd', strokeId: st.id });
      sync(r);
      emit();
      return r;
    },
    wand: (x, y) => command({ type: 'wand', x, y, tolerance: s.options.tolerance, mode: s.options.wandMode }),
    selectApply: (action) => command({ type: 'selectApply', action }),
    rotate: (degrees) => heavy('Turning the photo…', { type: 'rotate', degrees }),
    mirror: () => command({ type: 'mirror' }),
    crop: (box) => heavy('Cropping…', { type: 'crop', box }),
    skin: () => heavy('Looking for skin…', { type: 'skin' }),
    async undo() {
      if (!docOpen) return null;
      if (stroke) await api.endStroke();
      const r = await docCall('docUndo', {});
      sync(r);
      emit();
      return r;
    },
    async redo() {
      if (!docOpen) return null;
      if (stroke) await api.endStroke();
      const r = await docCall('docRedo', {});
      sync(r);
      emit();
      return r;
    },
    /* for the tests: the photo tools die as on a crash */
    crashTools() {
      if (worker.crash) worker.crash();
    },
    get undoLabel() {
      return s.labels.undo;
    },
    get redoLabel() {
      return s.labels.redo;
    },
    /* the colour under a point, for the Dropper (FR-42) */
    colourAt(x, y) {
      if (!s.work) return null;
      x = Math.round(x);
      y = Math.round(y);
      if (x < 0 || y < 0 || x >= s.width || y >= s.height) return null;
      const i = (y * s.width + x) * 4;
      const d = s.work.data;
      return [d[i], d[i + 1], d[i + 2]];
    },
    setTool(name) {
      s.tool = name;
      emit();
    },
    setOption(key, value) {
      s.options[key] = value;
      emit();
    },
    setPaintColour(hex) {
      s.paintColour = hex;
      emit();
    },
    /* keep the whole photo by choice (FR-50) */
    setWholePhoto(on) {
      s.choice = !!on;
      s.wholePhoto = effectiveWhole();
      s.dirty = true;
      dropPreview();
      emit();
    },
    async redetect() {
      if (s.status !== 'ready') return;
      await working('Reading the colours…', detect);
    },

    /* ---------- previews for the stage ---------- */
    preview() {
      if (!s.work) return null;
      if (!preview || preview.width !== s.width || preview.height !== s.height) {
        freeCanvas(preview);
        preview = document.createElement('canvas');
        preview.width = s.width;
        preview.height = s.height;
        previewDirty = 'all';
      }
      if (previewDirty) {
        const rect = previewDirty === 'all' ? { x0: 0, y0: 0, x1: s.width, y1: s.height } : previewDirty;
        const rw = rect.x1 - rect.x0;
        const rh = rect.y1 - rect.y0;
        const img = new ImageData(rw, rh);
        const d = img.data;
        const src = s.work.data;
        const whole = s.wholePhoto || !s.mask;
        for (let y = 0; y < rh; y++) {
          const row = (rect.y0 + y) * s.width + rect.x0;
          d.set(src.subarray(row * 4, (row + rw) * 4), y * rw * 4);
          if (!whole) for (let x = 0; x < rw; x++) d[(y * rw + x) * 4 + 3] = s.mask[row + x];
        }
        preview.getContext('2d').putImageData(img, rect.x0, rect.y0);
        previewDirty = null;
      }
      return preview;
    },
    original() {
      if (!s.work) return null;
      if (!originalCanvas || originalCanvas.width !== s.width || originalCanvas.height !== s.height) {
        freeCanvas(originalCanvas);
        originalCanvas = document.createElement('canvas');
        originalCanvas.width = s.width;
        originalCanvas.height = s.height;
        originalCanvas.getContext('2d').putImageData(s.work, 0, 0);
      }
      return originalCanvas;
    },
    /* the selection as a tape-coloured tint */
    selectionLayer() {
      if (!s.sel || !s.selection) return null;
      if (!selCanvas || selCanvas.width !== s.width || selCanvas.height !== s.height) {
        freeCanvas(selCanvas);
        selCanvas = document.createElement('canvas');
        selCanvas.width = s.width;
        selCanvas.height = s.height;
        selDirty = 'all';
      }
      if (selDirty) {
        const rect = selDirty === 'all' ? { x0: 0, y0: 0, x1: s.width, y1: s.height } : selDirty;
        const rw = rect.x1 - rect.x0;
        const rh = rect.y1 - rect.y0;
        const img = new ImageData(rw, rh);
        const d = img.data;
        for (let y = 0; y < rh; y++) {
          const row = (rect.y0 + y) * s.width + rect.x0;
          for (let x = 0; x < rw; x++) {
            const i = (y * rw + x) * 4;
            d[i] = 243;
            d[i + 1] = 201;
            d[i + 2] = 74;
            d[i + 3] = s.sel[row + x] ? 120 : 0;
          }
        }
        selCanvas.getContext('2d').putImageData(img, rect.x0, rect.y0);
        selDirty = null;
      }
      return selCanvas;
    },

    /* ---------- saving ---------- */
    async finalize() {
      if (!s.work) throw new Error('There is no photo to save.');
      if (stroke) await api.endStroke();
      const rgba = rgbaCopy();
      const original = s.originalId ? { keepId: s.originalId } : s.original;
      if (s.wholePhoto || !s.mask) {
        const out = await worker.call('finalizePhoto', { rgba, width: s.width, height: s.height }, [rgba.buffer]);
        return { kind: 'photo', cutout: out.cutout, thumb: out.thumb, original, strength: s.strength, method: 'photo', shape: s.shape, colours: s.colours };
      }
      const mask = maskCopy();
      const out = await worker.call('finalize', { rgba, mask, width: s.width, height: s.height }, [rgba.buffer, mask.buffer]);
      const method = s.method && s.method !== 'photo' ? s.method : 'seg-2';
      return { kind: 'cutout', cutout: out.cutout, thumb: out.thumb, original, strength: s.strength, method, shape: s.shape, colours: s.colours, box: out.box || null, work: { width: s.width, height: s.height } };
    },

    /* ---------- the draft (FR-49): photo as JPEG, mask as PNG, selection dropped ---------- */
    async toDraft(drafts) {
      if (!s.work) return null;
      const fresh = draftCache.opens !== s.opens || !draftCache.photo || draftCache.pixels !== rev.pixels;
      if (fresh) {
        draftCache.photo = await drafts.encodePhoto(s.work);
        draftCache.opens = s.opens;
        draftCache.pixels = rev.pixels;
        draftCache.mask = -1;
      }
      if (s.mask && draftCache.mask !== rev.mask) {
        draftCache.maskBlob = await drafts.encodeMask(s.mask, s.width, s.height);
        draftCache.mask = rev.mask;
      }
      const d = { photo: draftCache.photo, mask: s.mask ? draftCache.maskBlob : null };
      for (const k of DRAFT_KEYS) d[k] = s[k];
      d.options = Object.assign({}, s.options);
      return d;
    },
    async fromDraft(d) {
      const bmp = await decodeBlob(d.photo);
      const c = document.createElement('canvas');
      c.width = d.width;
      c.height = d.height;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(bmp, 0, 0, d.width, d.height);
      s.work = ctx.getImageData(0, 0, d.width, d.height);
      freeCanvas(c);
      if (d.mask) {
        const mb = await decodeBlob(d.mask);
        const mc = document.createElement('canvas');
        mc.width = d.width;
        mc.height = d.height;
        const mctx = mc.getContext('2d', { willReadFrequently: true });
        mctx.drawImage(mb, 0, 0, d.width, d.height);
        const md = mctx.getImageData(0, 0, d.width, d.height).data;
        s.mask = new Uint8Array(d.width * d.height);
        for (let p = 0, i = 0; p < s.mask.length; p++, i += 4) s.mask[p] = md[i];
        freeCanvas(mc);
      } else s.mask = null;
      for (const k of DRAFT_KEYS) if (d[k] !== undefined) s[k] = d[k];
      s.options = Object.assign({}, DEFAULT_OPTIONS, d.options || {}, { angle: 0 });
      s.tool = d.tool || 'move';
      s.wholePhoto = effectiveWhole();
      s.dirty = true;
      s.error = null;
      rev.pixels++;
      rev.mask++;
      draftCache.opens = s.opens;
      draftCache.photo = d.photo;
      draftCache.pixels = rev.pixels;
      draftCache.mask = s.mask ? rev.mask : -1;
      draftCache.maskBlob = d.mask || null;
      dropPreview();
      if (docOpen) worker.call('docClose', {}).catch(() => {});
      docOpen = false;
      await openDocument();
      s.status = 'ready';
      emit();
    },
    reset() {
      if (docOpen) worker.call('docClose', {}).catch(() => {});
      docOpen = false;
      stroke = null;
      Object.assign(s, { status: 'empty', busy: null, error: null, work: null, original: null, originalId: null, mask: null, sel: null, selection: 0, coverage: 0, lowContrast: false, separation: null, bg: null, method: null, autoWhole: false, extreme: null, choice: null, wholePhoto: false, strength: 50, colours: [], shape: null, guess: null, labels: { undo: null, redo: null }, steps: 0, dirty: false, tool: 'move', options: Object.assign({}, DEFAULT_OPTIONS) });
      dropPreview();
      emit();
    },
    close() {
      api.reset();
      listeners.clear();
    }
  };
  return api;
}

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
}
export const rgbToHex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
