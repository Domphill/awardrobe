/* aWardrobe domain: the pure part of the outfit builder and mix and match (architecture
   section 7): the ring of candidates for a slot, turning a slot, the opening slots, shuffle with
   a seed so Redo repeats it, and the suggested name. State is { pieces, slots }; a piece is
   { id, garmentId, x, y, w, z, rot, flip } and a slot { id, category, pieceId }. Pure. */
import { tidyLayout, placeNew } from './layout.js';
import { CATEGORIES, isGone } from './model.js';

let seq = 0;
export const nextId = (prefix) => prefix + '_' + (++seq).toString(36) + Date.now().toString(36).slice(-3);

/* mulberry32: small, fast, deterministic */
export function seededRandom(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* the garments of a category that can be worn, newest first, then "none" (FR-68, FR-15) */
export function candidates(garments, category) {
  const ring = garments.filter((g) => g.category === category && !isGone(g)).sort((a, b) => (b.created || '').localeCompare(a.created || ''));
  ring.push(null);
  return ring;
}
const clone = (state) => ({ pieces: state.pieces.map((p) => Object.assign({}, p)), slots: state.slots.map((s) => Object.assign({}, s)) });

/* one step along a slot's ring, keeping the piece's place; "none" takes the piece off and the
   step after it brings the newest back, placed afresh (FR-68, FR-69) */
export function turnSlot(state, slotId, dir, garments, infoOf) {
  const next = clone(state);
  const slot = next.slots.find((s) => s.id === slotId);
  if (!slot) return next;
  const ring = candidates(garments, slot.category);
  const current = slot.pieceId ? next.pieces.find((p) => p.id === slot.pieceId) : null;
  let at = current ? ring.findIndex((g) => g && g.id === current.garmentId) : ring.length - 1;
  if (at < 0) at = ring.length - 1;
  const to = (at + (dir < 0 ? -1 : 1) + ring.length) % ring.length;
  const chosen = ring[to];
  if (!chosen) {
    next.pieces = next.pieces.filter((p) => p.id !== slot.pieceId);
    slot.pieceId = null;
    return next;
  }
  if (current) {
    current.garmentId = chosen.id;
    return next;
  }
  const placed = placeNew(next.pieces, [{ id: nextId('pc'), garmentId: chosen.id, x: 0, y: 0, w: 0.4, z: 0, rot: 0, flip: false }], infoOf)[0];
  next.pieces.push(placed);
  slot.pieceId = placed.id;
  return next;
}

/* the slots the mixer opens with: tops, bottoms and shoes for an empty canvas (those that have
   garments), otherwise one per piece (FR-68) */
export function initialSlots(state, garments, infoOf) {
  const next = clone(state);
  if (next.pieces.length) {
    next.slots = next.pieces.map((p) => ({ id: nextId('sl'), category: (infoOf(p.garmentId) || {}).category || 'other', pieceId: p.id }));
    return next;
  }
  next.slots = ['tops', 'bottoms', 'shoes'].filter((c) => garments.some((g) => g.category === c && !isGone(g))).map((c) => ({ id: nextId('sl'), category: c, pieceId: null }));
  return next;
}
export function addSlot(state, category) {
  const next = clone(state);
  next.slots.push({ id: nextId('sl'), category, pieceId: null });
  return next;
}
export function removeSlot(state, slotId) {
  const next = clone(state);
  const slot = next.slots.find((s) => s.id === slotId);
  if (slot && slot.pieceId) next.pieces = next.pieces.filter((p) => p.id !== slot.pieceId);
  next.slots = next.slots.filter((s) => s.id !== slotId);
  return next;
}

/* a random but sensible combination (FR-70): a dress 30% of the time when there are dresses,
   otherwise a top and bottoms; a second top as a layer 33% of the time when there are two tops;
   outerwear 50%; shoes whenever there are any; a bag 35%; an accessory 35%; jewellery 25% */
export function shuffle(state, garments, infoOf, seed) {
  const rand = seededRandom(seed);
  /* ids from the seed too, so the same seed gives the same state byte for byte (Redo repeats it) */
  const seededId = (prefix) => prefix + '_' + Math.floor(rand() * 2176782336).toString(36);
  const pool = (c) => garments.filter((g) => g.category === c && !isGone(g));
  const pick = (list, not) => {
    const can = list.filter((g) => !not.has(g.id));
    return can.length ? can[Math.floor(rand() * can.length)] : null;
  };
  const chosen = [];
  const used = new Set();
  const take = (c) => {
    const g = pick(pool(c), used);
    if (g) {
      used.add(g.id);
      chosen.push(g);
    }
    return g;
  };
  const tops = pool('tops');
  const bottoms = pool('bottoms');
  const dresses = pool('dresses');
  const dressDay = dresses.length && (rand() < 0.3 || !tops.length || !bottoms.length);
  if (dressDay) take('dresses');
  else {
    take('tops');
    take('bottoms');
    if (tops.length >= 2 && rand() < 0.33) take('tops');
  }
  if (pool('outerwear').length && rand() < 0.5) take('outerwear');
  take('shoes');
  if (pool('bags').length && rand() < 0.35) take('bags');
  if (pool('accessories').length && rand() < 0.35) take('accessories');
  if (pool('jewellery').length && rand() < 0.25) take('jewellery');
  const pieces = tidyLayout(chosen.map((g) => ({ id: seededId('pc'), garmentId: g.id, x: 0, y: 0, w: 0.4, z: 0, rot: 0, flip: false })), infoOf);
  const slots = pieces.map((p) => ({ id: seededId('sl'), category: (infoOf(p.garmentId) || {}).category || 'other', pieceId: p.id }));
  void state;
  return { pieces, slots };
}

/* "jumper + jeans": the main pieces first, by category order, up to three, then "+ n more" */
const NAME_ORDER = CATEGORIES.map((c) => c.key);
export function suggestOutfitName(pieces, garmentOf) {
  const names = pieces
    .map((p) => garmentOf(p.garmentId))
    .filter(Boolean)
    .sort((a, b) => NAME_ORDER.indexOf(a.category) - NAME_ORDER.indexOf(b.category))
    .map((g) => (g.name || g.type || '').trim())
    .filter(Boolean);
  if (!names.length) return '';
  const shown = names.slice(0, 3).map((n, i) => (i === 0 ? n : n.charAt(0).toLowerCase() + n.slice(1)));
  const first = shown[0].charAt(0).toLowerCase() + shown[0].slice(1);
  const out = [first].concat(shown.slice(1)).join(' + ');
  return names.length > 3 ? out + ' + ' + (names.length - 3) + ' more' : out;
}
