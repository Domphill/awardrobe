/* aWardrobe ui: the building blocks every screen uses. h() makes elements; the rest are the
   app's buttons, chips, sheets, toasts and empty states. No image maths, no storage here. */
import { icon } from './icons.js';

/* h('div.card#main', { onclick, aria-label }, child, [children], 'text') */
export function h(selector, attrs, ...children) {
  if (attrs instanceof Node || typeof attrs === 'string' || Array.isArray(attrs) || attrs === null || attrs === undefined) {
    if (attrs !== null && attrs !== undefined) children.unshift(attrs);
    attrs = {};
  }
  const m = /^([a-z0-9-]+)?((?:\.[\w-]+)*)(?:#([\w-]+))?$/i.exec(selector) || [];
  const el = document.createElement(m[1] || 'div');
  if (m[2]) for (const c of m[2].split('.').filter(Boolean)) el.classList.add(c);
  if (m[3]) el.id = m[3];
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') for (const c of String(v).split(/\s+/).filter(Boolean)) el.classList.add(c);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'selected' || k === 'readOnly' || k === 'tabIndex') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, ...children);
  return el;
}
export function append(el, ...children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, ...c);
    else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/* ---------- buttons ---------- */
export function btn(label, onClick, opts) {
  opts = opts || {};
  const el = h('button', { type: 'button', class: 'btn' + (opts.kind ? ' ' + opts.kind : '') + (opts.small ? ' small' : '') + (opts.block ? ' block' : ''), id: opts.id, disabled: !!opts.disabled, 'aria-label': opts.ariaLabel, onclick: onClick });
  if (opts.icon) el.appendChild(icon(opts.icon));
  el.appendChild(h('span', label));
  return el;
}
export function iconBtn(name, label, onClick, opts) {
  opts = opts || {};
  return h('button', { type: 'button', class: 'icon-btn' + (opts.cls ? ' ' + opts.cls : ''), id: opts.id, 'aria-label': label, title: label, 'aria-pressed': opts.pressed === undefined ? null : String(!!opts.pressed), onclick: onClick }, icon(name));
}
/* A row of choices where one is selected: <div data-pref="theme"><button value="dark" aria-pressed> */
export function segmented({ name, value, options, onChange, label }) {
  const el = h('div.segmented', { role: 'group', 'aria-label': label || name, dataset: { pref: name } });
  for (const o of options) {
    const b = h('button', { type: 'button', value: o.value, 'aria-pressed': String(o.value === value), onclick: () => {
      for (const x of el.children) x.setAttribute('aria-pressed', String(x === b));
      onChange(o.value);
    } }, o.label);
    el.appendChild(b);
  }
  return el;
}
/* A labelled control. An input gets a real <label>; a group of buttons gets a heading it points
   at, so tapping the heading does nothing and each button keeps its own name (NFR-22). */
let fieldSeq = 0;
export function field(label, control, hint) {
  const isInput = control && /^(INPUT|TEXTAREA|SELECT)$/.test(control.tagName);
  if (isInput) return h('label.field', h('span.label', label), control, hint ? h('span.hint', hint) : null);
  const id = 'field-' + ++fieldSeq;
  if (control && control.setAttribute) control.setAttribute('aria-labelledby', id);
  return h('div.field', h('span.label', { id }, label), control, hint ? h('span.hint', hint) : null);
}
export const sectionHead = (title, right) => h('div.section-head', h('h2', title), right || null);
export const card = (...kids) => h('div.card', ...kids);
export const pageHead = (title, sub, right) => h('div.page-head', h('div', h('h1.title', title), sub ? h('p.sub', sub) : null), right || null);
export const empty = (title, body, ...actions) => h('div.empty', h('h2', title), body ? h('p', body) : null, actions.length ? h('div.actions', ...actions) : null);

/* ---------- sheets, confirmations, toasts, busy ---------- */
const layer = () => document.getElementById('layer');
let openSheets = 0;
const setInert = () => {
  const main = document.getElementById('main');
  const nav = document.querySelector('nav.tabs');
  const top = document.querySelector('header.topbar');
  for (const el of [main, nav, top]) if (el) el.inert = openSheets > 0;
};
/* A sheet from the bottom of the screen, as a dialog: focus moves in, Escape closes it, the page
   behind is inert, and focus returns to where it was (NFR-22). */
export function sheet({ title, body, actions, onClose, wide, opener }) {
  opener = opener || document.activeElement;
  const wrap = h('div.sheet-wrap', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Sheet' });
  let closed = false;
  const api = {
    el: wrap,
    close(result) {
      if (closed) return;
      closed = true;
      wrap.remove();
      openSheets = Math.max(0, openSheets - 1);
      setInert();
      if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
      if (onClose) onClose(result);
    }
  };
  const closeBtn = iconBtn('x', 'Close', () => api.close(null));
  const panel = h('div.sheet' + (wide ? '.wide' : ''), h('div.sheet-head', h('h2', title || ''), closeBtn), h('div.sheet-body', body), actions && actions.length ? h('div.sheet-actions', ...actions) : null);
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      api.close(null);
    }
  });
  wrap.appendChild(h('div.sheet-backdrop', { onclick: () => api.close(null) }));
  wrap.appendChild(panel);
  layer().appendChild(wrap);
  openSheets++;
  setInert();
  const bodyEl = panel.querySelector('.sheet-body');
  const focus = bodyEl.querySelector('[data-autofocus]') || bodyEl.querySelector('input, select, textarea, button, [tabindex]:not([tabindex="-1"])') || panel.querySelector('.sheet-actions button.primary, .sheet-actions button') || closeBtn;
  setTimeout(() => focus.focus({ preventScroll: true }), 30);
  return api;
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && openSheets > 0 && !(e.target && e.target.closest && e.target.closest('.sheet-wrap'))) {
    const wraps = document.querySelectorAll('.sheet-wrap');
    const last = wraps[wraps.length - 1];
    if (last) last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: false, cancelable: true }));
  }
});
/* A yes-or-no sheet; with `typed`, the word must be typed before the button works (FR-108). */
export function confirmSheet({ title, body, confirm, cancel, danger, typed }) {
  return new Promise((resolve) => {
    let input = null;
    const ok = btn(confirm || 'OK', () => s.close(true), { kind: danger ? 'danger' : 'primary', disabled: !!typed });
    if (typed) {
      input = h('input.input#confirm-typed', { type: 'text', autocomplete: 'off', autocapitalize: 'characters', 'aria-label': 'Type ' + typed + ' to confirm', oninput: () => (ok.disabled = input.value.trim() !== typed) });
    }
    const s = sheet({
      title,
      body: h('div.form', typeof body === 'string' ? h('p', body) : body, typed ? field('Type ' + typed + ' to confirm', input) : null),
      actions: [btn(cancel || 'Cancel', () => s.close(false), { kind: 'ghost' }), ok],
      onClose: (r) => resolve(!!r)
    });
  });
}
export function toast(message, opts) {
  opts = opts || {};
  const host = document.getElementById('toasts');
  if (!host) return;
  const el = h('div.toast', h('span', message), opts.action ? btn(opts.action.label, () => {
    el.remove();
    opts.action.run();
  }, { small: true, kind: 'ghost' }) : null);
  host.appendChild(el);
  setTimeout(() => el.remove(), opts.ms || 4000);
  return el;
}
export function busy(message) {
  const label = h('p', message || 'Working…');
  const el = h('div.busy-wrap', { role: 'status', 'aria-live': 'polite' }, h('div.busy', h('div.spinner'), label));
  layer().appendChild(el);
  return { close: () => el.remove(), text: (t) => (label.textContent = t) };
}

/* ---------- chips, selects, pictures, keyed lists ---------- */
export function chip(label, opts) {
  opts = opts || {};
  return h('button.chip', { type: 'button', 'aria-pressed': opts.pressed === undefined ? null : String(!!opts.pressed), dataset: opts.data, onclick: opts.onClick }, h('span', label), opts.count !== undefined ? h('span.chip-count', String(opts.count)) : null);
}
export function selectEl(options, value, onChange, attrs) {
  const el = h('select.input', Object.assign({ onchange: () => onChange(el.value) }, attrs || {}));
  for (const o of options) el.appendChild(h('option', { value: o.value, selected: o.value === value }, o.label));
  return el;
}
/* several chips that can each be on or off: seasons, occasions */
export function toggleChips({ name, values, selected, onChange, label }) {
  const el = h('div.toggle-chips', { role: 'group', 'aria-label': label || name, dataset: { field: name } });
  const set = new Set(selected || []);
  for (const v of values) {
    const b = h('button.chip', { type: 'button', dataset: { value: v }, 'aria-pressed': String(set.has(v)), onclick: () => {
      if (set.has(v)) set.delete(v);
      else set.add(v);
      b.setAttribute('aria-pressed', String(set.has(v)));
      onChange(values.filter((x) => set.has(x)));
    } }, v);
    el.appendChild(b);
  }
  return el;
}
/* A picture drawn into a canvas when it scrolls into view. `load()` resolves to anything
   drawImage accepts (the pictures cache gives a canvas). Marks data-drawn when done. */
let lazyObserver = null;
const lazyJobs = new WeakMap();
function observer() {
  if (lazyObserver) return lazyObserver;
  lazyObserver = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const job = lazyJobs.get(e.target);
        lazyObserver.unobserve(e.target);
        lazyJobs.delete(e.target);
        if (job) job();
      }
    },
    { rootMargin: '240px' }
  );
  return lazyObserver;
}
export function pic(load, opts) {
  opts = opts || {};
  const c = h('canvas.thumb', { width: String(opts.w || 300), height: String(opts.h || 360), role: 'img', 'aria-label': opts.alt || '' });
  const draw = async () => {
    try {
      const img = await load();
      if (!img) return;
      let W = c.width;
      let H = c.height;
      if (opts.natural) {
        const k = Math.min(1, 1200 / Math.max(img.width, img.height));
        W = Math.max(1, Math.round(img.width * k));
        H = Math.max(1, Math.round(img.height * k));
        c.width = W;
        c.height = H;
      }
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, W, H);
      const k = Math.min(W / img.width, H / img.height);
      const w = img.width * k;
      const hh = img.height * k;
      ctx.drawImage(img, (W - w) / 2, (H - hh) / 2, w, hh);
      c.dataset.drawn = '1';
    } catch (e) {
      c.dataset.failed = '1';
    }
  };
  if (opts.eager || typeof IntersectionObserver !== 'function') draw();
  else {
    lazyJobs.set(c, draw);
    observer().observe(c);
  }
  return c;
}
/* Keeps a container's children in step with a list by key, reusing the elements that are
   already there, so pictures stay drawn and nothing flickers. */
export function patchList(container, items, keyOf, make) {
  const existing = new Map();
  for (const el of Array.from(container.children)) existing.set(el.dataset.key, el);
  const keep = new Set();
  let cursor = container.firstChild;
  for (const item of items) {
    const key = String(keyOf(item));
    keep.add(key);
    let el = existing.get(key);
    if (!el) {
      el = make(item);
      el.dataset.key = key;
    }
    if (el === cursor) cursor = cursor.nextSibling;
    else container.insertBefore(el, cursor);
  }
  for (const [key, el] of existing) if (!keep.has(key)) el.remove();
}
