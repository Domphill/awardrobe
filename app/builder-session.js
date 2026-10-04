/* aWardrobe app: the outfit builder's state (architecture section 7): pieces and slots, every
   change a command with undo and redo, two-finger gestures as one step each, mix and match,
   shuffle with a seed, the suggested name, the draft (FR-64 to FR-74, FR-49). */
import { createStack, jsonCommand } from '../domain/commands.js';
import { tidyLayout, placeNew } from '../domain/layout.js';
import { candidates, turnSlot, initialSlots, addSlot, removeSlot, shuffle, suggestOutfitName, nextId } from '../domain/builder.js';
import { isGone, category as categoryOf } from '../domain/model.js';
const categoryLabel = (key) => categoryOf(key).label;

export const TILT_STEP = 5;
export const MIN_W = 0.12;
export const MAX_W = 1;
const DRAFT_KEYS = ['pieces', 'slots', 'form', 'nameChosen', 'mixer'];

export const builderDraftKey = (outfitId) => (outfitId ? 'builder:' + outfitId : 'builder');

export function createBuilderSession(app, opts) {
  opts = opts || {};
  const existing = opts.existing || null;
  const listeners = new Set();
  const stack = createStack();
  const s = {
    pieces: [],
    slots: [],
    selectedId: null,
    mixer: false,
    form: { name: '', seasons: [], occasions: [], favourite: false },
    nameChosen: false,
    labels: { undo: null, redo: null },
    steps: 0,
    dirty: false,
    seed: Math.floor(Math.random() * 1e9)
  };
  if (existing) {
    s.pieces = (existing.pieces || []).map((p) => Object.assign({ id: nextId('pc') }, p));
    s.form = { name: existing.name || '', seasons: (existing.seasons || []).slice(), occasions: (existing.occasions || []).slice(), favourite: !!existing.favourite };
    s.nameChosen = true;
  }
  let gesture = null;
  const emit = () => {
    for (const fn of listeners) {
      try {
        fn(s);
      } catch (e) {
        console.error(e);
      }
    }
  };
  const garmentOf = (id) => app.records.get('garments', id) || null;
  const wearable = () => app.records.list('garments').filter((g) => !isGone(g));
  const infoOf = (id) => {
    const g = garmentOf(id);
    if (!g) return null;
    const c = g.cutout || {};
    return { category: g.category || 'other', aspect: c.width && c.height ? c.height / c.width : 1.2 };
  };
  const get = () => ({ pieces: s.pieces, slots: s.slots });
  const set = (next) => {
    s.pieces = next.pieces;
    s.slots = next.slots;
    if (s.selectedId && !s.pieces.some((p) => p.id === s.selectedId)) s.selectedId = null;
  };
  const after = () => {
    s.labels = stack.labels();
    s.steps = stack.length;
    s.dirty = true;
    if (!s.nameChosen) s.form.name = suggestOutfitName(s.pieces, garmentOf);
    emit();
  };
  const command = (label, change) => {
    if (gesture) api.endGesture();
    const cmd = jsonCommand(label, get, set, change);
    stack.apply(cmd);
    after();
    return cmd;
  };
  const piece = (id) => s.pieces.find((p) => p.id === id) || null;
  const clampPiece = (p) => {
    p.w = Math.max(MIN_W, Math.min(MAX_W, p.w));
    const info = infoOf(p.garmentId) || { aspect: 1.2 };
    const h = p.w * info.aspect;
    /* a piece can be pushed half off the edge but no further */
    p.x = Math.max(-p.w / 2, Math.min(1 - p.w / 2, p.x));
    p.y = Math.max(-h / 2, Math.min(4 / 3 - h / 2, p.y));
    p.rot = ((Math.round(p.rot) + 540) % 360) - 180;
    if (p.rot === -180) p.rot = 180;
    return p;
  };

  const api = {
    get state() {
      return s;
    },
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    garmentOf,
    infoOf,
    wearable,
    /* pieces come from the closet in the tidy layout, without moving what is placed (FR-66) */
    addPieces(garmentIds) {
      const ids = garmentIds.filter((id) => garmentOf(id) && !s.pieces.some((p) => p.garmentId === id));
      if (!ids.length) return { nothing: true, message: 'Those pieces are already on the canvas.' };
      command('add pieces', () => {
        const placed = placeNew(s.pieces, ids.map((id) => ({ id: nextId('pc'), garmentId: id, x: 0, y: 0, w: 0.4, z: 0, rot: 0, flip: false })), infoOf);
        s.pieces = s.pieces.concat(placed);
        for (const p of placed) if (s.mixer) s.slots = s.slots.concat([{ id: nextId('sl'), category: (infoOf(p.garmentId) || {}).category || 'other', pieceId: p.id }]);
      });
      return { added: ids.length };
    },
    takeOff(id) {
      if (!piece(id)) return;
      command('take off', () => {
        s.pieces = s.pieces.filter((p) => p.id !== id);
        s.slots = s.slots.map((sl) => (sl.pieceId === id ? Object.assign({}, sl, { pieceId: null }) : sl));
      });
    },
    select(id) {
      s.selectedId = id && piece(id) ? id : null;
      emit();
    },
    tilt(id, degrees) {
      const p = piece(id);
      if (!p) return;
      command('tilt', () => clampPiece(Object.assign(piece(id), { rot: p.rot + degrees })));
    },
    setAngle(id, degrees) {
      const p = piece(id);
      if (!p || !isFinite(Number(degrees))) return;
      if (Math.round(Number(degrees)) === p.rot) return;
      command('tilt', () => clampPiece(Object.assign(piece(id), { rot: Number(degrees) })));
    },
    mirror(id) {
      if (!piece(id)) return;
      command('mirror', () => {
        const p = piece(id);
        p.flip = !p.flip;
      });
    },
    layer(id, where) {
      if (!piece(id)) return;
      command(where === 'back' ? 'send to back' : 'bring to front', () => {
        const p = piece(id);
        const others = s.pieces.filter((q) => q.id !== id);
        p.z = where === 'back' ? Math.min(0, ...others.map((q) => q.z | 0)) - 1 : Math.max(0, ...others.map((q) => q.z | 0)) + 1;
      });
    },
    /* arrow keys: a nudge of one per cent of the stage width, ten with Shift (NFR-22) */
    nudge(id, dx, dy) {
      if (!piece(id) || (!dx && !dy)) return;
      command('move', () => clampPiece(Object.assign(piece(id), { x: piece(id).x + dx, y: piece(id).y + dy })));
    },
    tidy() {
      if (!s.pieces.length) return { nothing: true, message: 'Add some pieces first.' };
      command('tidy', () => {
        s.pieces = tidyLayout(s.pieces, infoOf);
      });
      return {};
    },
    /* a gesture (drag, handle, two fingers) changes the piece live and becomes one command when
       the fingers lift (FR-64, FR-65, FR-72) */
    beginGesture(id) {
      const p = piece(id);
      if (!p) return false;
      if (gesture) api.endGesture();
      gesture = { id, from: Object.assign({}, p) };
      return true;
    },
    updateGesture(patch) {
      if (!gesture) return;
      const p = piece(gesture.id);
      if (!p) return;
      Object.assign(p, patch);
      clampPiece(p);
      emit();
    },
    endGesture(label) {
      if (!gesture) return null;
      const g = gesture;
      gesture = null;
      const p = piece(g.id);
      if (!p) return null;
      const to = Object.assign({}, p);
      const changed = ['x', 'y', 'w', 'rot', 'flip'].some((k) => to[k] !== g.from[k]);
      if (!changed) return null;
      /* put the piece back as it was, so the command's record starts from there */
      Object.assign(p, g.from);
      const kind = label || (to.w !== g.from.w && to.rot !== g.from.rot ? 'turn' : to.w !== g.from.w ? 'resize' : to.rot !== g.from.rot ? 'turn' : 'move');
      command(kind, () => Object.assign(piece(g.id), to));
      return kind;
    },
    get gesturing() {
      return !!gesture;
    },
    /* ---------- mix and match (FR-67 to FR-70) ---------- */
    categoriesWithGarments() {
      const set = new Set(wearable().map((g) => g.category));
      return [...set];
    },
    openMixer() {
      if (api.categoriesWithGarments().length < 2) {
        s.mixer = 'few';
        emit();
        return { nothing: true, message: 'Mix and match needs clothes in at least two categories.' };
      }
      const wasEmpty = !s.pieces.length;
      if (wasEmpty) {
        /* filling the empty canvas is a change, so it is a step; on a placed canvas the slots are
           only a view of the pieces and opening them is no step */
        command('mix and match slots', () => {
          let next = initialSlots(get(), wearable(), infoOf);
          for (const sl of next.slots) next = turnSlot(next, sl.id, 1, wearable(), infoOf);
          s.pieces = next.pieces;
          s.slots = next.slots;
        });
      } else {
        const next = initialSlots(get(), wearable(), infoOf);
        s.slots = next.slots;
      }
      s.mixer = true;
      emit();
      return {};
    },
    closeMixer() {
      s.mixer = false;
      emit();
    },
    ringOf(category) {
      return candidates(wearable(), category);
    },
    slotTurn(slotId, dir) {
      const slot = s.slots.find((x) => x.id === slotId);
      if (!slot) return;
      if (api.ringOf(slot.category).length <= 2) return { nothing: true, message: 'Only one of those to choose from.' };
      command('turn of ' + categoryLabel(slot.category).toLowerCase(), () => {
        const next = turnSlot(get(), slotId, dir, wearable(), infoOf);
        s.pieces = next.pieces;
        s.slots = next.slots;
      });
      return {};
    },
    slotAdd(category) {
      const ring = candidates(wearable(), category).filter(Boolean);
      if (ring.length && ring.every((g) => s.pieces.some((p) => p.garmentId === g.id))) return { nothing: true, message: 'Every ' + categoryLabel(category).toLowerCase() + ' you have is already on the canvas.' };
      command('new slot', () => {
        let next = addSlot(get(), category);
        const slot = next.slots[next.slots.length - 1];
        const ring = candidates(wearable(), category);
        /* the first garment of the category not already on the canvas, so a second top layers */
        for (let i = 0; i < ring.length; i++) {
          next = turnSlot(next, slot.id, 1, wearable(), infoOf);
          const sl = next.slots.find((x) => x.id === slot.id);
          const p = sl.pieceId ? next.pieces.find((q) => q.id === sl.pieceId) : null;
          if (!p) break;
          if (next.pieces.filter((q) => q.garmentId === p.garmentId).length === 1) break;
        }
        s.pieces = next.pieces;
        s.slots = next.slots;
      });
    },
    slotRemove(slotId) {
      if (!s.slots.some((x) => x.id === slotId)) return;
      command('slot removed', () => {
        const next = removeSlot(get(), slotId);
        s.pieces = next.pieces;
        s.slots = next.slots;
      });
    },
    shuffle() {
      if (api.categoriesWithGarments().length < 2) return { nothing: true, message: 'Shuffle needs clothes in at least two categories.' };
      const seed = s.seed++;
      command('shuffle', () => {
        const next = shuffle(get(), wearable(), infoOf, seed);
        s.pieces = next.pieces;
        s.slots = next.slots;
      });
      return {};
    },
    /* ---------- undo and redo (FR-72) ---------- */
    undo() {
      if (gesture) api.endGesture();
      if (!stack.canUndo) return false;
      stack.undo();
      after();
      return true;
    },
    redo() {
      if (!stack.canRedo) return false;
      stack.redo();
      after();
      return true;
    },
    /* ---------- the details (FR-73) ---------- */
    setForm(patch) {
      Object.assign(s.form, patch);
      if (patch.name !== undefined) s.nameChosen = true;
      s.dirty = true;
      emit();
    },
    suggestName: () => suggestOutfitName(s.pieces, garmentOf),
    finalize() {
      if (gesture) api.endGesture();
      return { pieces: s.pieces.map((p) => Object.assign({}, p)), form: Object.assign({}, s.form) };
    },
    /* ---------- the draft (FR-49) ---------- */
    toDraft() {
      if (!s.dirty) return null;
      const d = { outfitId: existing ? existing.id : null };
      for (const k of DRAFT_KEYS) d[k] = JSON.parse(JSON.stringify(s[k]));
      return d;
    },
    fromDraft(d) {
      for (const k of DRAFT_KEYS) if (d[k] !== undefined) s[k] = JSON.parse(JSON.stringify(d[k]));
      s.pieces = (s.pieces || []).filter((p) => garmentOf(p.garmentId));
      s.slots = (s.slots || []).filter((sl) => !sl.pieceId || s.pieces.some((p) => p.id === sl.pieceId));
      s.dirty = true;
      emit();
    },
    reset() {
      gesture = null;
      stack.clear();
      s.pieces = [];
      s.slots = [];
      s.selectedId = null;
      s.mixer = false;
      s.labels = { undo: null, redo: null };
      s.steps = 0;
      s.dirty = false;
      emit();
    },
    close() {
      listeners.clear();
    }
  };
  return api;
}
