/* aWardrobe ui: the app's icons as inline SVG (24 by 24, drawn with strokes). */
const PATHS = {
  hanger: 'M12 4a2 2 0 0 1 2 2c0 1.5-2 2-2 3.5V11 M12 11 3 16.5a1 1 0 0 0 .5 1.9h17a1 1 0 0 0 .5-1.9L12 11Z',
  layers: 'm12 3 9 5-9 5-9-5 9-5Z M3 13l9 5 9-5',
  plus: 'M12 5v14M5 12h14',
  calendar: 'M3 5h18v16H3z M3 10h18M8 3v4M16 3v4',
  stats: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  more: 'M12 12h.01M5 12h.01M19 12h.01',
  back: 'm14 6-6 6 6 6',
  chev: 'm10 6 6 6-6 6',
  x: 'M6 6l12 12M18 6 6 18',
  check: 'm5 12 4.5 4.5L19 7',
  star: 'm12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1L3.2 9.4l6.1-.8L12 3Z',
  edit: 'M4 20h4l10-10-4-4L4 16v4Z m9-13 4 4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4z M12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  image: 'M4 5h16v14H4z m0 10 5-5 4 4 3-3 4 4',
  search: 'M11 17.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z m9 2.5-4.3-4.3',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
  shuffle: 'M3 7h3.5c2 0 3.5 1 4.5 2.5M3 17h3.5c2 0 3.5-1 4.5-2.5M14 7h4l3 3-3 3M14 17h4l3-3',
  undo: 'M8 7H4v4 M4 11c2-3.5 5-5 8.5-5a7 7 0 1 1-6.9 8.5',
  redo: 'M16 7h4v4 M20 11c-2-3.5-5-5-8.5-5a7 7 0 1 0 6.9 8.5',
  cloud: 'M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 11.5 3.3 3.3 0 0 0 7 18Z',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  download: 'M12 3v12 m-5-5 5 5 5-5 M4 21h16',
  upload: 'M12 15V3 m-5 5 5-5 5 5 M4 21h16',
  pin: 'M12 21s7-6.5 7-11.5a7 7 0 1 0-14 0C5 14.5 12 21 12 21Z M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 11v5M12 8h.01',
  alert: 'M12 3 2 20h20L12 3Z M12 10v4M12 17h.01',
  refresh: 'M20 12a8 8 0 1 1-3-6.2 M20 4v5h-5',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  eye: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'
};

const NS = 'http://www.w3.org/2000/svg';

export function icon(name, cls) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('icon');
  if (cls) svg.classList.add(cls);
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', PATHS[name] || PATHS.info);
  if (name === 'star-on') {
    path.setAttribute('d', PATHS.star);
    path.setAttribute('fill', 'currentColor');
  }
  svg.appendChild(path);
  return svg;
}

/* The app's mark: a hanger on a tape-yellow disc. */
export function logo(size) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('logo');
  if (size) {
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
  }
  const disc = document.createElementNS(NS, 'circle');
  disc.setAttribute('cx', '24');
  disc.setAttribute('cy', '24');
  disc.setAttribute('r', '24');
  disc.setAttribute('fill', '#F3C94A');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', 'M24 14a3 3 0 0 1 3 3c0 2.2-3 3-3 5.2V24 M24 24 10.5 32.2a1.5 1.5 0 0 0 .8 2.8h25.4a1.5 1.5 0 0 0 .8-2.8L24 24Z');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#16213A');
  path.setAttribute('stroke-width', '2.6');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(disc);
  svg.appendChild(path);
  return svg;
}
