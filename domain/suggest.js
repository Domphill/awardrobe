/* aWardrobe domain: ideas (FR-89 to FR-94). Temperature bands, the day's context from a forecast
   or the season, how well a garment fits a day, how well a saved outfit does, composing one idea
   from the closet, and the one-line reason. Pure: no screen, no storage, no network. */
import { isGone, dayDiff } from './model.js';
import { seededRandom } from './builder.js';

export const BANDS = ['hot', 'warm', 'mild', 'cool', 'cold'];
export const SEASON_BAND = { Spring: 'mild', Summer: 'warm', Autumn: 'cool', Winter: 'cold' };
const WET_KINDS = ['drizzle', 'rain', 'showers', 'snow', 'thunder'];
const BAND_WORD = { hot: 'Hot', warm: 'Warm', mild: 'Mild', cool: 'Cool', cold: 'Cold' };
/* [dry, wet] advice per band */
const ADVICE = {
  hot: ['something light and cool.', 'something light, with a layer for the rain.'],
  warm: ['a light top, no layer needed.', 'a light top, with something for the showers.'],
  mild: ['a top and a light layer.', 'a light layer that can take a shower.'],
  cool: ['something warm on top, with a jacket.', 'something warm on top, with a coat that can take it.'],
  cold: ['layers and a proper coat.', 'layers, a proper coat and shoes that keep the wet out.']
};
/* a morning colder than this wants a jacket even on a warm day */
export const CHILLY_LOW = 8;

/* ---------- the day ---------- */

/* judged by the day's high: that is the temperature you dress for (the test plan's examples,
   24/14 hot and 13/6 mild, are judged this way); a cold morning is handled by `needsOuter` */
export function bandOf(high) {
  const t = Number(high);
  if (t >= 23) return 'hot';
  if (t >= 17) return 'warm';
  if (t >= 11) return 'mild';
  if (t >= 5) return 'cool';
  return 'cold';
}
export const isWet = (rainChance, kind) => Number(rainChance) >= 45 || WET_KINDS.includes(kind);
/* meteorological seasons; the southern hemisphere is six months round */
export function seasonOf(dayKey, southern) {
  let m = Number(String(dayKey).slice(5, 7));
  if (southern) m = ((m + 5) % 12) + 1;
  if (m >= 3 && m <= 5) return 'Spring';
  if (m >= 6 && m <= 8) return 'Summer';
  if (m >= 9 && m <= 11) return 'Autumn';
  return 'Winter';
}
/* the context of a day: from its forecast when there is one, else the season's usual band */
export function contextFor({ dayKey, forecast, southern }) {
  const season = seasonOf(dayKey, !!southern);
  if (forecast && forecast.high !== null && forecast.high !== undefined && isFinite(Number(forecast.high))) {
    const low = forecast.low === null || forecast.low === undefined || !isFinite(Number(forecast.low)) ? null : Number(forecast.low);
    return { band: bandOf(forecast.high), wet: isWet(forecast.rain, forecast.kind), temp: Number(forecast.high), low, rain: Number(forecast.rain) || 0, kind: forecast.kind || 'cloudy', season, source: 'forecast' };
  }
  return { band: SEASON_BAND[season], wet: false, temp: null, low: null, rain: null, kind: null, season, source: 'season' };
}
/* outerwear is wanted when it is cool, cold or wet, or the morning is chilly on a warm or mild day */
export const needsOuter = (ctx) => ctx.band === 'cool' || ctx.band === 'cold' || !!ctx.wet || (ctx.band !== 'hot' && ctx.low !== null && ctx.low !== undefined && Number(ctx.low) < CHILLY_LOW);

/* ---------- what a garment is like ---------- */

const TYPES = {
  warm: ['Jumper', 'Hoodie', 'Sweatshirt', 'Cardigan', 'Coat', 'Puffer', 'Boots', 'Scarf', 'Gloves', 'Hat'],
  heavy: ['Coat', 'Puffer'],
  hotOnly: ['Shorts', 'Sandals', 'Sliders', 'Vest', 'Swimwear', 'Playsuit'],
  layer: ['Cardigan', 'Overshirt', 'Jumper', 'Hoodie', 'Sweatshirt', 'Gilet'],
  rainGood: ['Raincoat', 'Boots', 'Puffer'],
  rainBad: ['Sandals', 'Sliders', 'Slippers', 'Heels'],
  coldExtra: ['Scarf', 'Hat', 'Gloves'],
  sunExtra: ['Sunglasses', 'Cap']
};
/* whole words (or phrases) in the name and notes */
const WORDS = {
  warm: ['wool', 'woollen', 'fleece', 'knit', 'knitted', 'thermal', 'thick', 'warm', 'winter', 'fur', 'furry', 'quilted', 'padded', 'lined', 'cashmere', 'merino'],
  heavy: ['parka', 'heavy', 'puffer', 'down jacket', 'down coat', 'down gilet', 'down-filled', 'goose down', 'overcoat'],
  hotOnly: ['linen', 'sandal', 'sandals', 'flip-flop', 'flip-flops', 'flip flops', 'strappy', 'sleeveless', 'bikini'],
  layer: ['layer', 'layering', 'cardigan', 'overshirt'],
  rainGood: ['waterproof', 'rain', 'raincoat', 'rainproof', 'mac', 'shell', 'wellies', 'wellington', 'wellingtons', 'gore-tex', 'goretex'],
  rainBad: ['suede', 'canvas', 'sandal', 'sandals', 'flip-flop', 'flip-flops', 'flip flops', 'espadrille', 'espadrilles']
};
const escapeRx = (w) => w.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
const RX = {};
for (const k of Object.keys(WORDS)) RX[k] = new RegExp('\\b(' + WORDS[k].map(escapeRx).join('|') + ')\\b', 'i');
export const isLike = (g, key) => (TYPES[key] || []).includes(g.type) || (RX[key] ? RX[key].test((g.name || '') + ' ' + (g.notes || '')) : false);

/* how well a garment fits the day: a number, or null when it is out (FR-91, FR-93).
   `info` is { today, lastWorn } or { today, lastWornOf(id) }. */
export function fitScore(g, ctx, info) {
  if (!g || isGone(g)) return null;
  const warm = isLike(g, 'warm');
  const heavy = isLike(g, 'heavy');
  const hotOnly = isLike(g, 'hotOnly');
  let s = 1;
  if (ctx.wet) {
    if (isLike(g, 'rainBad')) return null;
    if (isLike(g, 'rainGood')) s += 2;
  }
  switch (ctx.band) {
    case 'hot':
      if (heavy || (warm && g.category === 'outerwear')) return null;
      if (warm) s -= 3;
      if (hotOnly) s += 0.8;
      break;
    case 'warm':
      if (heavy) return null;
      if (warm) s -= 1.5;
      if (hotOnly) s += 0.4;
      break;
    case 'mild':
      if (hotOnly) s -= 1;
      if (heavy) s -= 1;
      break;
    case 'cool':
      if (hotOnly) return null;
      if (warm) s += 1;
      if (heavy) s += 0.3;
      break;
    default:
      if (hotOnly) return null;
      if (warm) s += 1.5;
      if (heavy) s += 1;
  }
  if (g.seasons && g.seasons.length) s += g.seasons.includes(ctx.season) ? 0.8 : -0.8;
  if (g.favourite) s += 0.3;
  const last = info && info.lastWorn !== undefined ? info.lastWorn : info && info.lastWornOf ? info.lastWornOf(g.id) : null;
  if (last && info && info.today) {
    const d = dayDiff(last, info.today);
    if (d >= 0 && d <= 2) s -= 10;
    else if (d >= 30) s += 0.5;
  } else if (!last) s += 0.5;
  return s;
}

/* ---------- saved outfits ---------- */

const SUITED_MIN = 0.75;
/* an outfit has to answer the day, not just avoid being ruled out: cold wants outerwear, cool
   wants outerwear or something warm, wet wants outerwear or something that takes the rain */
export function answersTheDay(pieces, ctx) {
  const outer = pieces.some((g) => g.category === 'outerwear');
  if (ctx.band === 'cold') return outer;
  if (ctx.band === 'cool' && !outer && !pieces.some((g) => isLike(g, 'warm'))) return false;
  if (ctx.wet && !outer && !pieces.some((g) => isLike(g, 'rainGood'))) return false;
  return true;
}
/* the saved outfits that suit the day, best first (FR-90, FR-91) */
export function suitedOutfits(outfits, garments, ctx, info, n) {
  const byId = new Map((garments || []).map((g) => [g.id, g]));
  const lastWornOf = (info && info.lastWornOf) || (() => null);
  const out = [];
  for (const o of outfits || []) {
    const pieces = (o.pieces || []).map((p) => byId.get(p.garmentId)).filter(Boolean);
    if (!pieces.length || !answersTheDay(pieces, ctx)) continue;
    let sum = 0;
    let bad = false;
    for (const g of pieces) {
      const s = fitScore(g, ctx, { today: info && info.today, lastWorn: lastWornOf(g.id) });
      if (s === null) {
        bad = true;
        break;
      }
      sum += s;
    }
    if (bad) continue;
    let score = sum / pieces.length;
    if (needsOuter(ctx) && pieces.some((g) => g.category === 'outerwear')) score += 0.7;
    if (o.seasons && o.seasons.length) score += o.seasons.includes(ctx.season) ? 0.5 : -0.5;
    const last = lastWornOf(o.id);
    if (last && info && info.today) {
      const d = dayDiff(last, info.today);
      if (d >= 0 && d <= 2) score -= 3;
    }
    if (score >= SUITED_MIN) out.push({ outfit: o, score });
  }
  out.sort((a, b) => b.score - a.score || (a.outfit.name || '').localeCompare(b.outfit.name || ''));
  return out.slice(0, n || 4);
}

/* ---------- one idea from the closet ---------- */

/* a seed from a string (FNV-1a), so a day, or a day and a garment, always gives the same number */
export function hashOf(str) {
  let h = 2166136261;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0 || 1;
}
export const daySeed = (dayKey) => hashOf(dayKey);
/* each garment's jitter comes from the seed and its own id, so the order the closet is listed in,
   or a garment coming or going, never changes the others' chances */
const jitterOf = (seed, id) => seededRandom(((Number(seed) >>> 0) ^ hashOf(id)) >>> 0)();

/* a dress, or a top with bottoms (with a light top under a layer on a cool or cold day, about
   half the time); outerwear when the day wants it; shoes; a scarf, hat or gloves when cold;
   sunglasses or a cap when hot and dry. Deterministic for a day and seed (FR-91 to FR-93).
   `info` is { today, lastWornOf(id), seed }. Returns null when nothing can be put together. */
export function compose(garments, ctx, info) {
  info = info || {};
  const seed = Number(info.seed) || 1;
  const rnd = seededRandom(seed);
  const lastWornOf = info.lastWornOf || (() => null);
  const pool = {};
  for (const g of garments || []) {
    const s = fitScore(g, ctx, { today: info.today, lastWorn: lastWornOf(g.id) });
    if (s === null) continue;
    (pool[g.category] = pool[g.category] || []).push({ g, s: s + jitterOf(seed, g.id) });
  }
  const best = (list, exclude) => {
    const l = (list || []).filter((x) => !exclude || !exclude.has(x.g.id));
    if (!l.length) return null;
    l.sort((a, b) => b.s - a.s || a.g.id.localeCompare(b.g.id));
    return l[0].g;
  };
  const pieces = [];
  const used = new Set();
  const take = (g) => {
    if (!g) return false;
    pieces.push(g);
    used.add(g.id);
    return true;
  };
  const canDress = !!(pool.dresses && pool.dresses.length);
  const canTopBottoms = !!(pool.tops && pool.tops.length && pool.bottoms && pool.bottoms.length);
  if (!canDress && !canTopBottoms) return null;
  /* the two draws happen in a fixed order, whatever the closet, so the seed means the same thing */
  const dressDraw = rnd();
  const layerDraw = rnd();
  const useDress = canDress && (!canTopBottoms || dressDraw < 0.35);
  let layered = false;
  const coolish = ctx.band === 'cool' || ctx.band === 'cold';
  if (useDress) take(best(pool.dresses));
  else {
    const light = pool.tops.filter((x) => !isLike(x.g, 'layer') && !isLike(x.g, 'warm'));
    const layers = pool.tops.filter((x) => isLike(x.g, 'layer'));
    if (coolish && light.length && layers.length && layerDraw < 0.5) {
      take(best(light));
      take(best(layers, used));
      layered = true;
    } else take(best(pool.tops));
    take(best(pool.bottoms));
  }
  if (needsOuter(ctx)) take(best(pool.outerwear));
  take(best(pool.shoes));
  if (ctx.band === 'cold') take(best((pool.accessories || []).filter((x) => TYPES.coldExtra.includes(x.g.type))));
  if (ctx.band === 'hot' && !ctx.wet) take(best((pool.accessories || []).filter((x) => TYPES.sunExtra.includes(x.g.type))));
  return { pieces, layered };
}

/* ---------- the reason line (FR-94) ---------- */

const fmtTemp = (c, unit) => (unit === 'F' ? Math.round((c * 9) / 5 + 32) + '°F' : Math.round(c) + '°C');
export function reasonLine(ctx, unit) {
  const advice = ADVICE[ctx.band][ctx.wet ? 1 : 0];
  if (ctx.source !== 'forecast' || ctx.temp === null) {
    return 'No forecast, so going by the season: ' + ctx.season.toLowerCase() + ' is usually ' + ctx.band + '. ' + advice.charAt(0).toUpperCase() + advice.slice(1);
  }
  return BAND_WORD[ctx.band] + ' and ' + (ctx.wet ? 'wet' : 'dry') + ', ' + fmtTemp(ctx.temp, unit) + ': ' + advice;
}
