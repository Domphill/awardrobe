/* aWardrobe app: the editor's state for one photo (architecture section 6). This milestone:
   open a photo, the automatic cut-out with the strength control, undo and redo of it, whole
   photo, the colours and the type guess, the draft, and the final save. The worker does the
   pixel work; the session keeps the working copy for the preview and sends copies across. */
import { decodeOnMain } from '../infra/decode.js';
import { HEIC_HINT } from '../infra/image-pipeline.js';
import { decodeBlob } from './pictures.js';

const HISTORY_LIMIT = 20;
const SNAP_KEYS = ['mask', 'coverage', 'lowContrast', 'separation', 'bg', 'method', 'autoWhole', 'strength', 'choice', 'wholePhoto'];
const DRAFT_KEYS = ['width', 'height', 'original', 'strength', 'choice', 'autoWhole', 'coverage', 'lowContrast', 'separation', 'bg', 'method', 'colours', 'shape', 'guess', 'opens'];

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
    mask: null,
    coverage: 0,
    lowContrast: false,
    separation: null,
    bg: null,
    method: null,
    autoWhole: false,
    choice: null,
    wholePhoto: false,
    strength: 50,
    colours: [],
    shape: null,
    guess: null,
    history: [],
    future: [],
    dirty: false
  };
  let preview = null;
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
  const effectiveWhole = () => (s.choice === null ? s.autoWhole : s.choice);

  /* the worker decodes; a worker that cannot (or died) hands over to the main thread */
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
  async function segmentNow(strength) {
    const rgba = rgbaCopy();
    const r = await worker.call('segment', { rgba, width: s.width, height: s.height, strength }, [rgba.buffer]);
    s.mask = r.mask || null;
    s.coverage = r.coverage || 0;
    s.lowContrast = !!r.lowContrast;
    s.separation = r.separation === undefined ? null : r.separation;
    s.bg = r.bg || null;
    s.method = r.method || null;
    s.autoWhole = !!r.wholePhoto;
    s.strength = strength;
    s.wholePhoto = effectiveWhole();
    preview = null;
  }
  async function detect() {
    const rgba = rgbaCopy();
    const alpha = s.mask && !s.wholePhoto ? maskCopy() : fullMask();
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
  const snapshot = () => {
    const snap = {};
    for (const k of SNAP_KEYS) snap[k] = s[k];
    return snap;
  };
  const restore = (snap) => {
    Object.assign(s, snap);
    preview = null;
  };
  const working = async (label, fn) => {
    const was = s.status;
    s.status = 'cutting';
    s.busy = label;
    emit();
    try {
      await fn();
    } finally {
      s.status = s.work ? 'ready' : was === 'cutting' ? 'empty' : was;
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
    async open(file) {
      s.status = 'opening';
      s.busy = 'Opening the photo…';
      s.error = null;
      emit();
      try {
        const d = await decode(file);
        s.work = d.work;
        s.width = d.width;
        s.height = d.height;
        s.original = { blob: d.original, width: d.originalWidth, height: d.originalHeight };
        s.opens++;
        s.history = [];
        s.future = [];
        s.dirty = false;
        s.choice = null;
        preview = null;
        s.status = 'cutting';
        s.busy = 'Cutting it out…';
        emit();
        await segmentNow(50);
        await detect();
        s.status = 'ready';
        s.busy = null;
        emit();
      } catch (e) {
        s.status = s.work ? 'ready' : 'empty';
        s.busy = null;
        s.error = (e && e.message) || HEIC_HINT;
        emit();
        throw e;
      }
    },
    /* the strength control re-runs the cut-out; the previous result can be undone (FR-25, FR-45) */
    async setStrength(v) {
      v = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
      if (s.status !== 'ready' || v === s.strength) return;
      s.history.push(snapshot());
      if (s.history.length > HISTORY_LIMIT) s.history.shift();
      s.future = [];
      await working('Cutting it out…', async () => {
        await segmentNow(v);
        s.dirty = true;
      });
    },
    undo() {
      if (!s.history.length || s.status !== 'ready') return false;
      s.future.push(snapshot());
      restore(s.history.pop());
      s.dirty = true;
      emit();
      return true;
    },
    redo() {
      if (!s.future.length || s.status !== 'ready') return false;
      s.history.push(snapshot());
      restore(s.future.pop());
      s.dirty = true;
      emit();
      return true;
    },
    get undoLabel() {
      return s.history.length ? 'Undo strength' : null;
    },
    get redoLabel() {
      return s.future.length ? 'Redo strength' : null;
    },
    /* keep the whole photo by choice (FR-50); unticking without a cut-out keeps everything */
    setWholePhoto(on) {
      s.choice = !!on;
      if (!on && !s.mask) s.mask = fullMask();
      s.wholePhoto = effectiveWhole();
      s.dirty = true;
      preview = null;
      emit();
    },
    async redetect() {
      if (s.status !== 'ready') return;
      await working('Reading the colours…', detect);
    },
    /* the preview: the working photo with the mask as its transparency, or plain for a whole photo */
    preview() {
      if (!s.work) return null;
      if (preview) return preview;
      const c = document.createElement('canvas');
      c.width = s.width;
      c.height = s.height;
      const ctx = c.getContext('2d');
      if (s.wholePhoto || !s.mask) ctx.putImageData(s.work, 0, 0);
      else {
        const img = new ImageData(new Uint8ClampedArray(s.work.data), s.width, s.height);
        const d = img.data;
        const m = s.mask;
        for (let p = 0, i = 3; p < m.length; p++, i += 4) d[i] = m[p];
        ctx.putImageData(img, 0, 0);
      }
      preview = c;
      return c;
    },
    /* everything the save needs, encoded in the worker (FR-29, FR-30) */
    async finalize() {
      if (!s.work) throw new Error('There is no photo to save.');
      const rgba = rgbaCopy();
      if (s.wholePhoto || !s.mask) {
        const out = await worker.call('finalizePhoto', { rgba, width: s.width, height: s.height }, [rgba.buffer]);
        return { kind: 'photo', cutout: out.cutout, thumb: out.thumb, original: s.original, strength: s.strength, method: 'photo', shape: s.shape, colours: s.colours };
      }
      const mask = maskCopy();
      const out = await worker.call('finalize', { rgba, mask, width: s.width, height: s.height }, [rgba.buffer, mask.buffer]);
      return { kind: 'cutout', cutout: out.cutout, thumb: out.thumb, original: s.original, strength: s.strength, method: s.method || 'seg-2', shape: s.shape, colours: s.colours };
    },
    /* the picture part of the draft; the screen adds the form fields */
    async toDraft(drafts) {
      if (!s.work) return null;
      const d = { photo: await drafts.encodePhoto(s.work), mask: s.mask ? await drafts.encodeMask(s.mask, s.width, s.height) : null };
      for (const k of DRAFT_KEYS) d[k] = s[k];
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
      c.width = 0;
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
        mc.width = 0;
      } else s.mask = null;
      for (const k of DRAFT_KEYS) if (d[k] !== undefined) s[k] = d[k];
      s.wholePhoto = effectiveWhole();
      s.history = [];
      s.future = [];
      s.dirty = true;
      s.error = null;
      s.status = 'ready';
      preview = null;
      emit();
    },
    reset() {
      Object.assign(s, { status: 'empty', busy: null, error: null, work: null, original: null, mask: null, coverage: 0, lowContrast: false, separation: null, bg: null, method: null, autoWhole: false, choice: null, wholePhoto: false, strength: 50, colours: [], shape: null, guess: null, history: [], future: [], dirty: false });
      preview = null;
      emit();
    }
  };
  return api;
}
