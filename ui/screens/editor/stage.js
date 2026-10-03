/* aWardrobe ui: the editor's stage (architecture 6.1, 6.2). A view canvas exactly the size of its
   box, an overlay for the brush ring, the selection tint and the crop box, and one Viewport that
   maps every touch to an image pixel and draws with the same three numbers. Zoom and pan never
   scroll anything. Pointer events become strokes (once per frame), taps, pans and pinches. */
import { h } from '../../components.js';
import { createViewport, BRUSH_SIZES } from '../../../domain/image/geometry.js';

const BRUSH_TOOLS = ['select', 'paint', 'eraser', 'restore'];
const TAP_TOOLS = ['wand', 'dropper'];
const DOUBLE_TAP_MS = 320;
const TAP_SLOP = 8;
const HANDLE_PX = 22;
const DOUBLE_TAP_ZOOM = 3;

export function createStage({ session, handlers }) {
  const view = h('canvas#stage-view', { 'aria-hidden': 'true' });
  const overlay = h('canvas#stage-overlay', { 'aria-hidden': 'true' });
  const ring = h('div#brush-ring', { hidden: true, 'aria-hidden': 'true' });
  const badge = h('span#zoom-level', '1×');
  const el = h('div.stage.checker#stage', view, overlay, ring, badge);
  const viewport = createViewport({ imageW: 1, imageH: 1, viewW: 1, viewH: 1, dpr: Math.min(3, window.devicePixelRatio || 1) });
  const st = { tool: 'move', background: 'checker', showingOriginal: false, rotateDeg: 0, cropBox: null, staticImage: null, lastPoints: [], lastDrawAt: 0, imageW: 0, imageH: 0 };
  const pointers = new Map();
  let gesture = null;
  let lastTap = null;
  let frame = null;
  let pendingPoints = [];
  let strokeActive = false;
  let strokePromise = null;
  let lastAction = Promise.resolve();

  /* ---------- geometry ---------- */
  const rect = () => view.getBoundingClientRect();
  const toImage = (clientX, clientY) => viewport.toImage(clientX, clientY, rect());
  const imageSize = () => {
    const src = st.staticImage || (session.state.work ? { width: session.state.width, height: session.state.height } : null);
    return src ? { width: src.width, height: src.height } : null;
  };
  const layout = () => {
    const r = rect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(r.width * dpr));
    const H = Math.max(1, Math.round(r.height * dpr));
    for (const c of [view, overlay]) {
      if (c.width !== W || c.height !== H) {
        c.width = W;
        c.height = H;
      }
    }
    viewport.dpr = dpr;
    const size = imageSize();
    const sizeChanged = size && (size.width !== st.imageW || size.height !== st.imageH);
    if (size && (sizeChanged || viewport.viewW !== r.width || viewport.viewH !== r.height)) {
      st.imageW = size.width;
      st.imageH = size.height;
      viewport.imageW = size.width;
      viewport.imageH = size.height;
      viewport.setView(r.width, r.height);
      if (sizeChanged) st.cropBox = null;
    }
    draw();
  };
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => layout()) : null;
  if (observer) observer.observe(el);

  /* ---------- drawing ---------- */
  const draw = () => {
    const ctx = view.getContext('2d');
    const W = view.width;
    const H = view.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const size = imageSize();
    const src = st.staticImage || (st.showingOriginal ? session.original() : session.preview());
    if (!size || !src) {
      delete view.dataset.ready;
      drawOverlay();
      return;
    }
    if (size.width !== st.imageW || size.height !== st.imageH) {
      layout();
      return;
    }
    /* zoomed past one image pixel a screen pixel, the pixels are drawn crisp so the user sees
       what the brush will touch; shrunk, the picture is smoothed */
    ctx.imageSmoothingEnabled = viewport.scale <= 1;
    ctx.imageSmoothingQuality = 'high';
    const t = viewport.canvasTransform();
    ctx.setTransform(t[0], t[1], t[2], t[3], t[4], t[5]);
    if (st.rotateDeg) {
      ctx.translate(size.width / 2, size.height / 2);
      ctx.rotate((st.rotateDeg * Math.PI) / 180);
      ctx.translate(-size.width / 2, -size.height / 2);
    }
    ctx.drawImage(src, 0, 0);
    view.dataset.ready = '1';
    st.lastDrawAt = performance.now();
    badge.textContent = (Math.round(viewport.zoomLevel * 10) / 10).toString().replace(/\.0$/, '') + '×';
    drawOverlay();
  };
  const drawOverlay = () => {
    const ctx = overlay.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    const size = imageSize();
    if (!size) return;
    const t = viewport.canvasTransform();
    const layer = !st.staticImage && !st.showingOriginal ? session.selectionLayer() : null;
    if (layer) {
      ctx.setTransform(t[0], t[1], t[2], t[3], t[4], t[5]);
      ctx.drawImage(layer, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    if (st.tool === 'crop' && st.cropBox) {
      const dpr = viewport.dpr;
      const b = st.cropBox;
      const p0 = viewport.toScreen(b.x0, b.y0);
      const p1 = viewport.toScreen(b.x1, b.y1);
      ctx.fillStyle = 'rgba(10, 14, 30, 0.45)';
      ctx.fillRect(0, 0, overlay.width, overlay.height);
      ctx.clearRect(p0.x * dpr, p0.y * dpr, (p1.x - p0.x) * dpr, (p1.y - p0.y) * dpr);
      ctx.strokeStyle = '#f3c94a';
      ctx.lineWidth = 2 * dpr;
      ctx.strokeRect(p0.x * dpr, p0.y * dpr, (p1.x - p0.x) * dpr, (p1.y - p0.y) * dpr);
      ctx.fillStyle = '#f3c94a';
      for (const [hx, hy] of handlePoints(p0, p1)) ctx.fillRect((hx - 7) * dpr, (hy - 7) * dpr, 14 * dpr, 14 * dpr);
    }
  };
  const handlePoints = (p0, p1) => {
    const mx = (p0.x + p1.x) / 2;
    const my = (p0.y + p1.y) / 2;
    return [[p0.x, p0.y], [mx, p0.y], [p1.x, p0.y], [p1.x, my], [p1.x, p1.y], [mx, p1.y], [p0.x, p1.y], [p0.x, my]];
  };
  const showRing = (clientX, clientY) => {
    if (!BRUSH_TOOLS.includes(st.tool) || !imageSize()) {
      ring.hidden = true;
      return;
    }
    const r = rect();
    const size = BRUSH_SIZES[session.state.options.size] || BRUSH_SIZES.medium;
    ring.hidden = false;
    ring.style.width = size + 'px';
    ring.style.height = size + 'px';
    ring.style.left = clientX - r.left + 'px';
    ring.style.top = clientY - r.top + 'px';
  };
  const brushRadiusImage = () => viewport.brushImagePx(BRUSH_SIZES[session.state.options.size] || BRUSH_SIZES.medium) / 2;

  /* ---------- strokes, once per frame ---------- */
  /* how long each batch of points took from its frame to the draw that shows it (P-2) */
  const latencies = [];
  const flushPoints = () => {
    frame = null;
    if (!strokeActive || !pendingPoints.length) return;
    const pts = pendingPoints;
    pendingPoints = [];
    st.lastPoints.push(...pts);
    const t0 = performance.now();
    Promise.resolve(handlers.strokeMove(pts)).then(() => {
      if (latencies.length < 10000) latencies.push(performance.now() - t0);
    });
  };
  let lastQueued = null;
  const queuePoint = (p) => {
    lastQueued = p;
    pendingPoints.push(p);
    if (!frame) frame = requestAnimationFrame(flushPoints);
  };
  const beginStroke = (p) => {
    strokeActive = true;
    lastQueued = p;
    st.lastPoints = [p];
    strokePromise = Promise.resolve(handlers.strokeBegin([p], brushRadiusImage()));
  };
  const endStroke = () => {
    if (!strokeActive) return Promise.resolve();
    if (frame) {
      cancelAnimationFrame(frame);
      flushPoints();
    }
    strokeActive = false;
    const p = (strokePromise || Promise.resolve()).then(() => handlers.strokeEnd());
    lastAction = p;
    return p;
  };

  /* ---------- pointers ---------- */
  const onDown = (e) => {
    if (!imageSize()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    /* the Undo and Redo buttons and the empty-stage buttons sit on the stage: a finger on them is
       not a stroke (found on the phone: Undo with the Eraser active undid its own dot) */
    if (e.target && e.target !== el && e.target !== view && e.target !== overlay && e.target.closest && e.target.closest('button, .stage-tools, .stage-empty, input, label')) return;
    try {
      el.setPointerCapture(e.pointerId);
    } catch (err) {
      /* a synthetic event has no live pointer to capture */
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false });
    if (pointers.size === 2) {
      /* a second finger: whatever was happening becomes a pinch */
      if (strokeActive) endStroke();
      const [a, b] = [...pointers.values()];
      gesture = { kind: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      return;
    }
    if (pointers.size > 2) return;
    const img = toImage(e.clientX, e.clientY);
    const now = performance.now();
    const isDouble = lastTap && now - lastTap.at < DOUBLE_TAP_MS && Math.hypot(lastTap.x - e.clientX, lastTap.y - e.clientY) < 24;
    if (isDouble) {
      lastTap = null;
      gesture = { kind: 'doubletap' };
      const level = viewport.zoomLevel > 1.05 ? 1 : DOUBLE_TAP_ZOOM;
      viewport.setZoom(level, e.clientX, e.clientY, rect());
      draw();
      return;
    }
    if (st.tool === 'crop' && st.cropBox) {
      const hit = hitCrop(e.clientX, e.clientY);
      if (hit) {
        gesture = { kind: 'crop', handle: hit, start: img, box: Object.assign({}, st.cropBox) };
        return;
      }
    }
    if (BRUSH_TOOLS.includes(st.tool) && !st.staticImage && !session.state.busy) {
      gesture = { kind: 'stroke' };
      showRing(e.clientX, e.clientY);
      beginStroke(img);
      return;
    }
    gesture = { kind: TAP_TOOLS.includes(st.tool) ? 'tap' : 'pan', last: { x: e.clientX, y: e.clientY } };
  };
  const onMove = (e) => {
    const p = pointers.get(e.pointerId);
    if (BRUSH_TOOLS.includes(st.tool)) showRing(e.clientX, e.clientY);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (Math.hypot(p.x - p.startX, p.y - p.startY) > TAP_SLOP) p.moved = true;
    if (!gesture) return;
    if (gesture.kind === 'pinch' && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (gesture.dist > 0) viewport.zoomAt(dist / gesture.dist, mid.x, mid.y, rect());
      viewport.panBy(mid.x - gesture.mid.x, mid.y - gesture.mid.y);
      gesture.dist = dist;
      gesture.mid = mid;
      draw();
      return;
    }
    if (gesture.kind === 'pan' || (gesture.kind === 'tap' && p.moved)) {
      if (gesture.kind === 'tap') gesture.kind = 'pan';
      viewport.panBy(e.clientX - gesture.last.x, e.clientY - gesture.last.y);
      gesture.last = { x: e.clientX, y: e.clientY };
      draw();
      return;
    }
    if (gesture.kind === 'stroke') {
      queuePoint(toImage(e.clientX, e.clientY));
      return;
    }
    if (gesture.kind === 'crop') {
      dragCrop(gesture, toImage(e.clientX, e.clientY));
      drawOverlay();
    }
  };
  const onUp = (e) => {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (!gesture) return;
    if (gesture.kind === 'pinch') {
      if (pointers.size < 2) gesture = null;
      return;
    }
    const g = gesture;
    gesture = null;
    if (g.kind === 'doubletap') return;
    if (g.kind === 'stroke') {
      if (p) {
        /* the lift point counts unless it is where the last point already was */
        const img = toImage(e.clientX, e.clientY);
        if (!lastQueued || Math.hypot(img.x - lastQueued.x, img.y - lastQueued.y) > 0.01) queuePoint(img);
      }
      endStroke();
      return;
    }
    if (g.kind === 'tap' && p && !p.moved) {
      lastTap = { at: performance.now(), x: e.clientX, y: e.clientY };
      lastAction = Promise.resolve(handlers.tap(toImage(e.clientX, e.clientY)));
      return;
    }
    if (g.kind === 'pan' && p && !p.moved) lastTap = { at: performance.now(), x: e.clientX, y: e.clientY };
  };
  const onCancel = (e) => {
    pointers.delete(e.pointerId);
    if (gesture && gesture.kind === 'stroke') endStroke();
    gesture = null;
  };
  const onWheel = (e) => {
    if (!imageSize()) return;
    e.preventDefault();
    viewport.zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY, rect());
    draw();
  };
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onCancel);
  el.addEventListener('pointerleave', () => {
    if (!gesture) ring.hidden = true;
  });
  el.addEventListener('wheel', onWheel, { passive: false });

  /* ---------- the crop box ---------- */
  const hitCrop = (clientX, clientY) => {
    const b = st.cropBox;
    const r = rect();
    const p0 = viewport.toScreen(b.x0, b.y0, r);
    const p1 = viewport.toScreen(b.x1, b.y1, r);
    const hs = handlePoints(p0, p1);
    for (let i = 0; i < hs.length; i++) if (Math.abs(hs[i][0] - clientX) <= HANDLE_PX && Math.abs(hs[i][1] - clientY) <= HANDLE_PX) return i;
    if (clientX > p0.x && clientX < p1.x && clientY > p0.y && clientY < p1.y) return 'move';
    return null;
  };
  const dragCrop = (g, img) => {
    const dx = img.x - g.start.x;
    const dy = img.y - g.start.y;
    const b = Object.assign({}, g.box);
    const size = imageSize();
    if (g.handle === 'move') {
      const w = b.x1 - b.x0;
      const hh = b.y1 - b.y0;
      b.x0 = Math.max(0, Math.min(size.width - w, b.x0 + dx));
      b.y0 = Math.max(0, Math.min(size.height - hh, b.y0 + dy));
      b.x1 = b.x0 + w;
      b.y1 = b.y0 + hh;
    } else {
      const left = [0, 6, 7].includes(g.handle);
      const right = [2, 3, 4].includes(g.handle);
      const top = [0, 1, 2].includes(g.handle);
      const bottom = [4, 5, 6].includes(g.handle);
      if (left) b.x0 = Math.max(0, Math.min(b.x1 - 20, b.x0 + dx));
      if (right) b.x1 = Math.min(size.width, Math.max(b.x0 + 20, b.x1 + dx));
      if (top) b.y0 = Math.max(0, Math.min(b.y1 - 20, b.y0 + dy));
      if (bottom) b.y1 = Math.min(size.height, Math.max(b.y0 + 20, b.y1 + dy));
    }
    st.cropBox = { x0: Math.round(b.x0), y0: Math.round(b.y0), x1: Math.round(b.x1), y1: Math.round(b.y1) };
  };

  /* ---------- the public face ---------- */
  const api = {
    el,
    view,
    viewport,
    state: st,
    rect,
    layout,
    draw,
    redraw: draw,
    setTool(tool) {
      st.tool = tool;
      if (tool === 'crop' && !st.cropBox) api.resetCropBox();
      if (tool !== 'rotate') st.rotateDeg = 0;
      ring.hidden = true;
      el.dataset.tool = tool;
      draw();
    },
    setBackground(kind) {
      st.background = kind;
      el.classList.toggle('checker', kind === 'checker');
      el.classList.toggle('bg-light', kind === 'light');
      el.classList.toggle('bg-dark', kind === 'dark');
    },
    setStatic(img) {
      st.staticImage = img || null;
      layout();
    },
    showOriginal(on) {
      st.showingOriginal = !!on;
      draw();
    },
    rotatePreview(deg) {
      st.rotateDeg = deg || 0;
      draw();
    },
    setZoom(level, clientX, clientY) {
      viewport.setZoom(level, clientX, clientY, rect());
      draw();
    },
    zoomBy(factor) {
      const r = rect();
      viewport.zoomAt(factor, r.left + r.width / 2, r.top + r.height / 2, r);
      draw();
    },
    getCropBox: () => (st.cropBox ? Object.assign({}, st.cropBox) : null),
    setCropBox(box) {
      st.cropBox = box ? { x0: Math.round(box.x0), y0: Math.round(box.y0), x1: Math.round(box.x1), y1: Math.round(box.y1) } : null;
      drawOverlay();
    },
    resetCropBox() {
      const size = imageSize();
      st.cropBox = size ? { x0: 0, y0: 0, x1: size.width, y1: size.height } : null;
      drawOverlay();
    },
    get lastPoints() {
      return st.lastPoints.slice();
    },
    takeLatencies() {
      return latencies.splice(0, latencies.length);
    },
    get lastAction() {
      return lastAction;
    },
    /* the test hooks drive the same pointer handlers through synthetic events (NFR-40) */
    async simulateTap(ix, iy) {
      const p = viewport.toScreen(ix, iy, rect());
      const opts = { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: p.x, clientY: p.y, bubbles: true, cancelable: true };
      el.dispatchEvent(new PointerEvent('pointerdown', opts));
      el.dispatchEvent(new PointerEvent('pointerup', opts));
      await lastAction;
      lastTap = null;
    },
    async simulateStroke(points) {
      const r = rect();
      const at = (ix, iy) => viewport.toScreen(ix, iy, r);
      const first = at(points[0].x, points[0].y);
      const base = { pointerId: 2, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true };
      el.dispatchEvent(new PointerEvent('pointerdown', Object.assign({}, base, { clientX: first.x, clientY: first.y })));
      for (const pt of points.slice(1)) {
        const sp = at(pt.x, pt.y);
        el.dispatchEvent(new PointerEvent('pointermove', Object.assign({}, base, { clientX: sp.x, clientY: sp.y })));
        await new Promise((res) => requestAnimationFrame(res));
      }
      const last = at(points[points.length - 1].x, points[points.length - 1].y);
      el.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, base, { clientX: last.x, clientY: last.y })));
      await lastAction;
      lastTap = null;
    },
    destroy() {
      if (observer) observer.disconnect();
      view.width = 0;
      overlay.width = 0;
    }
  };
  el.dataset.tool = 'move';
  return api;
}
