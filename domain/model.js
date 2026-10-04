/* aWardrobe domain: what the records mean. Categories, types, seasons, occasions, ids and
   versions, validation. Pure: no screen, no storage, no network. */

export const RECORD_VERSION = 1;

export const CATEGORIES = [
  { key: 'tops', label: 'Tops', one: 'Top', types: ['T-shirt', 'Shirt', 'Blouse', 'Jumper', 'Hoodie', 'Sweatshirt', 'Cardigan', 'Vest', 'Polo', 'Top'] },
  { key: 'bottoms', label: 'Bottoms', one: 'Bottoms', types: ['Jeans', 'Trousers', 'Shorts', 'Skirt', 'Joggers', 'Leggings', 'Chinos', 'Cargo trousers'] },
  { key: 'dresses', label: 'Dresses', one: 'Dress', types: ['Dress', 'Jumpsuit', 'Playsuit', 'Co-ord'] },
  { key: 'outerwear', label: 'Outerwear', one: 'Outerwear', types: ['Jacket', 'Coat', 'Blazer', 'Gilet', 'Raincoat', 'Puffer', 'Overshirt'] },
  { key: 'shoes', label: 'Shoes', one: 'Shoes', types: ['Trainers', 'Boots', 'Sandals', 'Heels', 'Flats', 'Loafers', 'Slippers', 'Sliders'] },
  { key: 'bags', label: 'Bags', one: 'Bag', types: ['Handbag', 'Backpack', 'Tote', 'Crossbody', 'Clutch', 'Holdall'] },
  { key: 'accessories', label: 'Accessories', one: 'Accessory', types: ['Hat', 'Cap', 'Scarf', 'Belt', 'Sunglasses', 'Gloves', 'Watch', 'Tie'] },
  { key: 'jewellery', label: 'Jewellery', one: 'Jewellery', types: ['Necklace', 'Earrings', 'Ring', 'Bracelet'] },
  { key: 'other', label: 'Other', one: 'Item', types: ['Underwear', 'Socks', 'Swimwear', 'Sportswear', 'Nightwear', 'Other'] }
];
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
export const OCCASIONS = ['Everyday', 'Work', 'Smart', 'Night out', 'Sport', 'Holiday', 'Home'];
export const GONE_REASONS = [
  { key: 'sold', label: 'Sold' },
  { key: 'donated', label: 'Donated' },
  { key: 'binned', label: 'Binned' },
  { key: 'lost', label: 'Lost' },
  { key: 'other', label: 'Other' }
];

export const category = (key) => CATEGORIES.find((c) => c.key === key) || CATEGORIES[CATEGORIES.length - 1];
export const isKnownType = (categoryKey, type) => category(categoryKey).types.includes(type);

/* ---------- ids and records ---------- */
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
export function newId(prefix) {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += ALPHABET[b % 36];
  return prefix + '_' + s;
}
export const nowIso = () => new Date().toISOString();
export function newRecord(prefix, fields) {
  const t = nowIso();
  return Object.assign({ id: newId(prefix), v: RECORD_VERSION, created: t, updated: t }, fields || {});
}
export function touch(rec) {
  rec.updated = nowIso();
  return rec;
}

/* ---------- days ---------- */
const pad2 = (n) => String(n).padStart(2, '0');
export const dayKey = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
export const parseDay = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (date, n) => {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + n);
  return d;
};
/* days from a to b: positive when b is later */
export const dayDiff = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 86400000);
export const todayKey = (now) => dayKey(now || new Date());

/* ---------- validation (FR-60) ---------- */
const blank = (s) => !s || !String(s).trim();
export function validateGarment(g) {
  const problems = [];
  if (!g.pictures || !g.pictures.cutout) problems.push('Add a photo first.');
  if (blank(g.name) && blank(g.type)) problems.push('Give it a name, or choose a type.');
  if (g.price !== null && g.price !== undefined && g.price !== '' && !(typeof g.price === 'number' ? g.price >= 0 : /^\d+(\.\d+)?$/.test(String(g.price).trim()))) problems.push('The price should be a number.');
  return problems;
}

/* An outfit needs at least one piece; two pieces may share a category (a shirt under a jumper),
   but one garment cannot be two pieces (FR-67, FR-74). `garmentOf(id)` looks a garment up. */
export function validateOutfit(o, garmentOf) {
  const problems = [];
  const pieces = (o && o.pieces) || [];
  if (!pieces.length) problems.push('Add at least one piece first.');
  const seen = new Set();
  for (const p of pieces) {
    if (seen.has(p.garmentId)) {
      problems.push('The same garment is on the canvas twice; take one off.');
      break;
    }
    seen.add(p.garmentId);
  }
  void garmentOf;
  return problems;
}

/* ---------- planned days (FR-80, FR-81) ---------- */
/* a day after today is a plan; today and earlier are worn */
export const isPlanned = (dayKey, todayKey) => dayKey > todayKey;
/* the planned days that have passed and were never asked about, oldest first */
export function passedPlans(days, todayKey) {
  return (days || [])
    .filter((d) => d && d.planned && !d.planAsked && d.id < todayKey && ((d.outfits && d.outfits.length) || (d.garments && d.garments.length)))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/* ---------- wears and cost per wear (FR-11, FR-16, FR-80, FR-96, FR-99) ---------- */
export const priceOf = (g) => (g.price === null || g.price === undefined || g.price === '' || isNaN(Number(g.price)) ? null : Number(g.price));
export const isGone = (g) => g.status === 'gone';

/* Which garments were worn on which days: a day counts once it is today or earlier, logged or
   planned (FR-80); a garment counts once per day whether listed on its own or inside an outfit.
   Returns a Map of garment id to { wears, lastWorn }. */
export function wearStats(days, outfits, today) {
  const byOutfit = new Map();
  for (const o of outfits || []) byOutfit.set(o.id, (o.pieces || []).map((p) => p.garmentId));
  const stats = new Map();
  for (const d of days || []) {
    if (!d || !d.id || d.id > today) continue;
    const seen = new Set(d.garments || []);
    for (const oid of d.outfits || []) for (const id of byOutfit.get(oid) || []) seen.add(id);
    for (const id of seen) {
      const s = stats.get(id) || { wears: 0, lastWorn: null };
      s.wears++;
      if (!s.lastWorn || d.id > s.lastWorn) s.lastWorn = d.id;
      stats.set(id, s);
    }
  }
  return stats;
}
export function wearsOf(stats, id) {
  const s = stats && typeof stats.get === 'function' ? stats.get(id) : null;
  return s ? { wears: s.wears, lastWorn: s.lastWorn } : { wears: 0, lastWorn: null };
}
/* price over wears, an unworn garment counting as one wear; null without a price (FR-11) */
export function costPerWear(price, wears) {
  if (price === null || price === undefined || price === '' || isNaN(Number(price))) return null;
  return Number(price) / Math.max(1, wears || 0);
}
export const closetValue = (garments) => garments.filter((g) => !isGone(g)).reduce((sum, g) => sum + (priceOf(g) || 0), 0);
/* the gone garments as a group: how many, what they cost, their average cost per wear (FR-99) */
export function goneGroup(garments, stats) {
  const gone = garments.filter(isGone);
  const each = gone.map((g) => costPerWear(g.price, wearsOf(stats, g.id).wears)).filter((x) => x !== null);
  return { count: gone.length, cost: gone.reduce((sum, g) => sum + (priceOf(g) || 0), 0), averageCostPerWear: each.length ? each.reduce((a, b) => a + b, 0) / each.length : null };
}

/* ---------- gone from the closet (FR-14) ---------- */
export function markGone(g, reason, date) {
  if (!GONE_REASONS.some((r) => r.key === reason)) throw new Error('Unknown gone reason: ' + reason);
  return Object.assign({}, g, { status: 'gone', gone: { reason, date: date || null } });
}
export const bringBack = (g) => Object.assign({}, g, { status: 'active', gone: null });
