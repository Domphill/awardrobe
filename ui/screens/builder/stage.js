/* aWardrobe ui: the outfit canvas (architecture section 7, FR-64, FR-65). Pieces are elements
   placed by fractions of the stage width with the CSS transform rotate(rot) scaleX(flip); one
   finger drags, a finger on the corner handle resizes, two fingers on a piece twist and pinch
   with the maths in domain/image/geometry.js. Every gesture is one undo step in the session. */
import { h, clear } from '../../components.js';
import { gestureTransform, pieceBox } from '../../../domain/image/geometry.js';
import { CANVAS_H } from '../../../domain/layout.js';

const TAP_SLOP = 6;

export function createBuilderStage({ session, app, onSelect }) {
  const el = h('div.bstage#build-stage', { role: 'group', 'aria-label': 'The outfit canvas' });
  const nodes = new Map();
  const pointers = new Map();
  let gesture = null;
  let lastAction = Promise.resolve();
  const rect = () => el.getBoundingClientRect();
  const stageW = () => rect().width || 1;
  const infoOf = (id) => session.infoOf(id) || { category: 'other', aspect: 1.2 };

  /* ---------- drawing ---------- */
  const place = (node, p) => {
    const W = 100;
    const box = pieceBox(p, W, infoOf(p.garmentId).aspect);
    node.style.left = box.left + '%';
    node.style.top = (box.top / CANVAS_H / W) * 100 + '%';
    node.style.width = box.width + '%';
    node.style.height = (box.height / CANVAS_H / W) * 100 + '%';
    node.style.zIndex = String(100 + (p.z | 0));
    node.style.transform = 'rotate(' + (p.rot || 0) + 'deg) scaleX(' + (p.flip ? -1 : 1) + ')';
  };
  const makeNode = (p) => {
    const g = session.garmentOf(p.garmentId);
    const canvas = h('canvas', { 'aria-hidden': 'true' });
    const node = h('div.piece', { dataset: { pieceId: p.id, garmentId: p.garmentId }, role: 'button', tabindex: '0', 'aria-label': (g && (g.name || g.type)) || 'A piece' }, canvas, h('span.gone-mark', 'gone'), h('div.handle', { 'aria-hidden': 'true' }));
    node.classList.toggle('gone', !!(g && g.status === 'gone'));
    if (g && g.pictures) {
      app.pictures
        .image(g.pictures.cutout, 'full')
        .then((img) => {
          if (!img || !node.isConnected) return;
          canvas.width = img.width;
          canvas.height = img.height;
          canvas.getContext('2d').drawImage(img, 0, 0);
          canvas.dataset.drawn = '1';
        })
        .catch(() => {});
    }
    return node;
  };
  const render = () => {
    const s = session.state;
    const seen = new Set();
    for (const p of s.pieces) {
      seen.add(p.id);
      let node = nodes.get(p.id);
      if (!node) {
        node = makeNode(p);
        nodes.set(p.id, node);
        el.appendChild(node);
      }
      place(node, p);
      node.classList.toggle('selected', p.id === s.selectedId);
    }
    for (const [id, node] of nodes) {
      if (!seen.has(id)) {
        node.remove();
        nodes.delete(id);
      }
    }
  };

  /* ---------- pointers ---------- */
  const pieceAt = (target) => {
    const node = target && target.closest ? target.closest('.piece') : null;
    return node && el.contains(node) ? node : null;
  };
  const onDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const node = pieceAt(e.target);
    try {
      el.setPointerCapture(e.pointerId);
    } catch (err) {
      /* a synthetic event has no live pointer */
    }
    if (!node) {
      if (!pointers.size) {
        session.select(null);
        if (onSelect) onSelect(null);
      }
      return;
    }
    const id = node.dataset.pieceId;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, id });
    if (pointers.size === 1) {
      if (session.state.selectedId !== id) {
        session.select(id);
        if (onSelect) onSelect(id);
      }
      const onHandle = !!(e.target && e.target.closest && e.target.closest('.handle'));
      const p = session.state.pieces.find((q) => q.id === id);
      if (!p) return;
      session.beginGesture(id);
      gesture = { id, kind: onHandle ? 'resize' : 'move', from: Object.assign({}, p), moved: false };
      return;
    }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      if (a.id !== b.id) return;
      /* two fingers on the same piece: twist and pinch from here, whatever was happening */
      const p = session.state.pieces.find((q) => q.id === id);
      if (!p) return;
      gesture = { id, kind: 'twist', from: Object.assign({}, p), start: [{ x: a.x, y: a.y }, { x: b.x, y: b.y }], moved: true };
      if (!session.gesturing) session.beginGesture(id);
    }
  };
  const onMove = (e) => {
    const pt = pointers.get(e.pointerId);
    if (!pt || !gesture) return;
    pt.x = e.clientX;
    pt.y = e.clientY;
    if (Math.hypot(pt.x - pt.startX, pt.y - pt.startY) > TAP_SLOP) gesture.moved = true;
    const W = stageW();
    if (gesture.kind === 'twist' && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const t = gestureTransform(gesture.start, [{ x: a.x, y: a.y }, { x: b.x, y: b.y }]);
      const from = gesture.from;
      const aspect = infoOf(from.garmentId).aspect;
      const w = from.w * t.scale;
      /* grow about the centre, and carry the fingers' drift */
      const cx = from.x + from.w / 2 + t.dx / W;
      const cy = from.y + (from.w * aspect) / 2 + t.dy / W;
      session.updateGesture({ w, x: cx - w / 2, y: cy - (w * aspect) / 2, rot: from.rot + t.angle });
      return;
    }
    if (gesture.kind === 'move') {
      session.updateGesture({ x: gesture.from.x + (pt.x - pt.startX) / W, y: gesture.from.y + (pt.y - pt.startY) / W });
      return;
    }
    if (gesture.kind === 'resize') {
      /* the corner handle: the width follows the finger's distance from the opposite corner */
      const aspect = infoOf(gesture.from.garmentId).aspect;
      const dw = ((pt.x - pt.startX) + (pt.y - pt.startY) / aspect) / W / 2;
      session.updateGesture({ w: gesture.from.w + dw * 2 });
    }
  };
  const finish = () => {
    if (!gesture) return;
    const g = gesture;
    gesture = null;
    pointers.clear();
    const label = g.kind === 'twist' ? 'turn' : g.kind;
    lastAction = Promise.resolve(session.endGesture(label));
  };
  const onUp = (e) => {
    const pt = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (!gesture) return;
    if (gesture.kind === 'twist') {
      if (pointers.size < 2) finish();
      return;
    }
    void pt;
    finish();
  };
  const onCancel = () => {
    pointers.clear();
    finish();
  };
  const onKey = (e) => {
    const node = pieceAt(e.target);
    if (!node) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      session.select(node.dataset.pieceId);
      if (onSelect) onSelect(node.dataset.pieceId);
    }
  };
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onCancel);
  el.addEventListener('keydown', onKey);

  const api = {
    el,
    render,
    rect,
    pieceRect(id) {
      const node = nodes.get(id);
      return node ? node.getBoundingClientRect() : null;
    },
    /* the test hooks drive the same pointer handlers through synthetic events (NFR-40) */
    async drag(id, dx, dy) {
      const node = nodes.get(id);
      if (!node) return;
      const r = node.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const o = (type, cx, cy) => node.dispatchEvent(new PointerEvent(type, { pointerId: 51, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
      o('pointerdown', x, y);
      o('pointermove', x + dx / 2, y + dy / 2);
      await new Promise((res) => requestAnimationFrame(res));
      o('pointermove', x + dx, y + dy);
      o('pointerup', x + dx, y + dy);
      await lastAction;
    },
    async resize(id, dx, dy) {
      const node = nodes.get(id);
      if (!node) return;
      const handle = node.querySelector('.handle');
      const r = handle.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const o = (type, cx, cy) => handle.dispatchEvent(new PointerEvent(type, { pointerId: 52, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
      o('pointerdown', x, y);
      o('pointermove', x + dx, y + dy);
      await new Promise((res) => requestAnimationFrame(res));
      o('pointerup', x + dx, y + dy);
      await lastAction;
    },
    async gesture(id, start, now) {
      const node = nodes.get(id);
      if (!node) return;
      const o = (type, pid, p) => node.dispatchEvent(new PointerEvent(type, { pointerId: pid, pointerType: 'touch', isPrimary: pid === 53, bubbles: true, cancelable: true, clientX: p.x, clientY: p.y }));
      o('pointerdown', 53, start[0]);
      o('pointerdown', 54, start[1]);
      const steps = 6;
      for (let k = 1; k <= steps; k++) {
        const f = k / steps;
        o('pointermove', 53, { x: start[0].x + (now[0].x - start[0].x) * f, y: start[0].y + (now[0].y - start[0].y) * f });
        o('pointermove', 54, { x: start[1].x + (now[1].x - start[1].x) * f, y: start[1].y + (now[1].y - start[1].y) * f });
        await new Promise((res) => requestAnimationFrame(res));
      }
      o('pointerup', 53, now[0]);
      o('pointerup', 54, now[1]);
      await lastAction;
    },
    tap(id) {
      const node = nodes.get(id);
      if (!node) return;
      const r = node.getBoundingClientRect();
      const o = (type) => node.dispatchEvent(new PointerEvent(type, { pointerId: 55, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
      o('pointerdown');
      o('pointerup');
    },
    destroy() {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      el.removeEventListener('keydown', onKey);
      for (const node of nodes.values()) {
        const c = node.querySelector('canvas');
        if (c) {
          c.width = 0;
          c.height = 0;
        }
      }
      nodes.clear();
      clear(el);
    }
  };
  return api;
}
