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

/* ---------- validation (FR-60) ---------- */
const blank = (s) => !s || !String(s).trim();
export function validateGarment(g) {
  const problems = [];
  if (!g.pictures || !g.pictures.cutout) problems.push('Add a photo first.');
  if (blank(g.name) && blank(g.type)) problems.push('Give it a name, or choose a type.');
  if (g.price !== null && g.price !== undefined && g.price !== '' && !(typeof g.price === 'number' ? g.price >= 0 : /^\d+(\.\d+)?$/.test(String(g.price).trim()))) problems.push('The price should be a number.');
  return problems;
}
