/* aWardrobe domain: the tidy layout of the outfit canvas (architecture section 7, FR-66, FR-71).
   The canvas is 1 wide by 4/3 high; positions and widths are fractions of the width. Pure. */
export const CANVAS_H = 4 / 3;
/* where each category goes: x and y of the top-left corner, the width, and the layer order */
const SPOTS = {
  bottoms: { x: 0.3, y: 0.46, w: 0.4, z: 1 },
  shoes: { x: 0.08, y: 1.1, w: 0.26, z: 2 },
  dresses: { x: 0.29, y: 0.04, w: 0.42, z: 3 },
  tops: { x: 0.28, y: 0.05, w: 0.44, z: 4 },
  outerwear: { x: 0.02, y: 0.1, w: 0.36, z: 5 },
  bags: { x: 0.7, y: 0.6, w: 0.26, z: 6 },
  accessories: { x: 0.72, y: 0.3, w: 0.22, z: 7 },
  jewellery: { x: 0.76, y: 0.06, w: 0.16, z: 8 },
  other: { x: 0.68, y: 0.95, w: 0.26, z: 9 }
};
/* a second piece of the same category sits a little right and down of the first, and above it */
const STEP = { x: 0.05, y: 0.04 };
const ORDER = Object.keys(SPOTS);

const clampInto = (p, aspect) => {
  const h = p.w * (aspect || 1);
  p.x = Math.max(0, Math.min(1 - p.w, p.x));
  p.y = Math.max(0, Math.min(Math.max(0, CANVAS_H - h), p.y));
  return p;
};
const spotFor = (category) => SPOTS[category] || SPOTS.other;
/* a piece's resting place given how many of its category already sit there */
const place = (piece, info, nth, zBase) => {
  const spot = spotFor(info.category);
  const w = spot.w;
  let y = spot.y;
  const h = w * (info.aspect || 1);
  /* shoes and other footers sit on the floor of the canvas, whatever their shape */
  if (info.category === 'shoes') y = CANVAS_H - h - 0.02;
  const out = Object.assign({}, piece, { x: spot.x + nth * STEP.x, y: y + nth * STEP.y, w, z: zBase + spot.z * 10 + nth });
  return clampInto(out, info.aspect);
};

/* Rearranges every piece into the default layout (FR-71). The order in is kept in the array;
   positions depend only on categories, so the same pieces always land in the same places. */
export function tidyLayout(pieces, infoOf) {
  const counts = {};
  const sorted = pieces.slice().sort((a, b) => ORDER.indexOf(spotKey(a, infoOf)) - ORDER.indexOf(spotKey(b, infoOf)) || pieces.indexOf(a) - pieces.indexOf(b));
  const placed = new Map();
  for (const p of sorted) {
    const info = infoOf(p.garmentId) || { category: 'other', aspect: 1 };
    const key = spotKey(p, infoOf);
    const nth = counts[key] || 0;
    counts[key] = nth + 1;
    placed.set(p, place(p, info, nth, 0));
  }
  return pieces.map((p) => placed.get(p));
}
const spotKey = (p, infoOf) => {
  const info = infoOf(p.garmentId);
  return info && SPOTS[info.category] ? info.category : 'other';
};

/* Places new pieces without moving the ones already on the canvas (FR-66): each goes to its
   category's spot, stepped past any of that category already there, and above everything. */
export function placeNew(existing, newPieces, infoOf) {
  const counts = {};
  for (const p of existing) {
    const key = spotKey(p, infoOf);
    counts[key] = (counts[key] || 0) + 1;
  }
  const zTop = existing.reduce((m, p) => Math.max(m, p.z || 0), 0);
  const out = [];
  let k = 1;
  for (const p of newPieces) {
    const info = infoOf(p.garmentId) || { category: 'other', aspect: 1 };
    const key = spotKey(p, infoOf);
    const nth = counts[key] || 0;
    counts[key] = nth + 1;
    const placed = place(p, info, nth, 0);
    placed.z = zTop + k++;
    out.push(placed);
  }
  return out;
}
