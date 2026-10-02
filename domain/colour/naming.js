/* aWardrobe domain: a colour's plain name from its lightness, chroma and hue (FR-53). The 26
   names and their swatches are the app's colour vocabulary; the thresholds are tuned by the
   swatch test set (NFR-39). */
import { rgbToLab, lch } from './space.js';

export const SWATCHES = {
  Black: '#1a1a1c',
  Charcoal: '#3c3e42',
  Grey: '#8a8c90',
  'Light grey': '#c8cacd',
  White: '#f5f5f2',
  Cream: '#f3ead4',
  Beige: '#d9c6a6',
  Tan: '#b8916a',
  Brown: '#6e4830',
  Khaki: '#9d9264',
  Olive: '#6c7040',
  Sage: '#9fb08e',
  Green: '#2f8a4a',
  Teal: '#1e8a8a',
  'Light blue': '#9cc3e8',
  Denim: '#4e6c96',
  Blue: '#2e62be',
  Navy: '#1f2b52',
  Lilac: '#bfa4dc',
  Purple: '#6f3fa0',
  Pink: '#eea0bf',
  Burgundy: '#78202f',
  Red: '#c8302c',
  Orange: '#e97a2a',
  Mustard: '#c9a02a',
  Yellow: '#f0d24a'
};
export const COLOUR_NAMES = Object.keys(SWATCHES);
export const hexOfName = (name) => SWATCHES[name] || '#999999';

const inHue = (h, a, b) => (a <= b ? h >= a && h < b : h >= a || h < b);

export function nameColour(rgb) {
  const { L, C, h } = lch(rgbToLab(rgb[0], rgb[1], rgb[2]));
  const warm = inHue(h, 40, 125);
  /* whites photograph as light greys in shade, so anything very light counts as white */
  if (C < 0.016) return L > 0.88 ? 'White' : L > 0.72 ? 'Light grey' : L > 0.47 ? 'Grey' : L > 0.32 ? 'Charcoal' : 'Black';
  if (C < 0.045) {
    if (L < 0.32) return inHue(h, 228, 292) && C >= 0.025 ? 'Navy' : 'Black';
    if (L > 0.93) return warm && C >= 0.025 ? 'Cream' : 'White';
    if (L > 0.88) return warm ? 'Cream' : 'White';
    if (L > 0.75) return warm ? 'Beige' : 'Light grey';
    if (L > 0.5) return warm ? 'Khaki' : 'Grey';
    return warm ? 'Brown' : 'Charcoal';
  }
  if (inHue(h, 345, 40)) {
    if (L > 0.72) return 'Pink';
    if (C < 0.08 && L > 0.58) return 'Pink';
    if (L < 0.42) return 'Burgundy';
    return 'Red';
  }
  if (inHue(h, 40, 75)) {
    if (L < 0.45) return 'Brown';
    if (C < 0.09) return L > 0.75 ? 'Beige' : L > 0.55 ? 'Tan' : 'Brown';
    if (L > 0.82 && C < 0.13) return 'Beige';
    return 'Orange';
  }
  if (inHue(h, 75, 125)) {
    if (L < 0.45) return C < 0.07 ? 'Brown' : 'Olive';
    if (L < 0.6 && C < 0.1) return 'Olive';
    if (C < 0.075) return L > 0.86 ? 'Cream' : L > 0.74 ? 'Beige' : 'Khaki';
    return L < 0.78 ? 'Mustard' : 'Yellow';
  }
  if (inHue(h, 125, 185)) {
    if (C < 0.06) return L > 0.5 ? 'Sage' : 'Olive';
    if (L < 0.42 && h < 150) return 'Olive';
    return 'Green';
  }
  if (inHue(h, 185, 228)) return L > 0.75 && C < 0.09 ? 'Light blue' : 'Teal';
  if (inHue(h, 228, 292)) {
    if (L > 0.74) return 'Light blue';
    if (L < 0.4) return 'Navy';
    if (C < 0.095 && L < 0.68) return 'Denim';
    return 'Blue';
  }
  if (L > 0.74) return 'Lilac';
  if (h >= 330 && L > 0.55) return 'Pink';
  return 'Purple';
}
