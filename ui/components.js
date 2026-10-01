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
export const field = (label, control, hint) => h('label.field', h('span.label', label), control, hint ? h('span.hint', hint) : null);
export const sectionHead = (title, right) => h('div.section-head', h('h2', title), right || null);
export const card = (...kids) => h('div.card', ...kids);
export const pageHead = (title, sub, right) => h('div.page-head', h('div', h('h1.title', title), sub ? h('p.sub', sub) : null), right || null);
export const empty = (title, body, ...actions) => h('div.empty', h('h2', title), body ? h('p', body) : null, actions.length ? h('div.actions', ...actions) : null);

/* ---------- sheets, confirmations, toasts, busy ---------- */
const layer = () => document.getElementById('layer');
export function sheet({ title, body, actions, onClose, wide }) {
  const wrap = h('div.sheet-wrap', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Sheet' });
  let closed = false;
  const api = {
    el: wrap,
    close(result) {
      if (closed) return;
      closed = true;
      wrap.remove();
      if (onClose) onClose(result);
    }
  };
  const panel = h('div.sheet' + (wide ? '.wide' : ''), h('div.sheet-head', h('h2', title || ''), iconBtn('x', 'Close', () => api.close(null))), h('div.sheet-body', body), actions && actions.length ? h('div.sheet-actions', ...actions) : null);
  wrap.appendChild(h('div.sheet-backdrop', { onclick: () => api.close(null) }));
  wrap.appendChild(panel);
  layer().appendChild(wrap);
  const focus = panel.querySelector('[data-autofocus], input, button.primary, button');
  if (focus) setTimeout(() => focus.focus({ preventScroll: true }), 30);
  return api;
}
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
