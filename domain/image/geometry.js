/* aWardrobe domain: the Viewport, the one place that maps a touch to an image pixel and back
   (FR-33, FR-34, architecture 6.2). scale is screen CSS pixels per image pixel; tx, ty is where
   the image's top-left corner sits in the view, in CSS pixels. Drawing uses the same three numbers
   through canvasTransform(), so what is drawn at a point is what a touch at that point hits.
   Pure: no DOM. */

export const MAX_ZOOM = 8;
export const FIT_MARGIN = 0.03;
export const MIN_VISIBLE = 0.25;
export const BRUSH_SIZES = { small: 14, medium: 28, large: 56 };

export function createViewport({ imageW, imageH, viewW, viewH, dpr }) {
  const v = {
    imageW,
    imageH,
    viewW,
    viewH,
    dpr: dpr || 1,
    scale: 1,
    fitScale: 1,
    tx: 0,
    ty: 0,
    get zoomLevel() {
      return v.scale / v.fitScale;
    },
    /* the whole image inside the view with a small margin, centred: letterboxing is only tx, ty */
    fit() {
      v.fitScale = Math.min((v.viewW * (1 - 2 * FIT_MARGIN)) / v.imageW, (v.viewH * (1 - 2 * FIT_MARGIN)) / v.imageH);
      v.scale = v.fitScale;
      v.tx = (v.viewW - v.imageW * v.scale) / 2;
      v.ty = (v.viewH - v.imageH * v.scale) / 2;
      return v;
    },
    /* the box changed (the phone turned): fit again */
    setView(w, h) {
      v.viewW = w;
      v.viewH = h;
      return v.fit();
    },
    setImage(w, h) {
      v.imageW = w;
      v.imageH = h;
      return v.fit();
    },
    toImage(clientX, clientY, viewRect) {
      const left = viewRect ? viewRect.left : 0;
      const top = viewRect ? viewRect.top : 0;
      return { x: (clientX - left - v.tx) / v.scale, y: (clientY - top - v.ty) / v.scale };
    },
    toScreen(ix, iy, viewRect) {
      const left = viewRect ? viewRect.left : 0;
      const top = viewRect ? viewRect.top : 0;
      return { x: ix * v.scale + v.tx + left, y: iy * v.scale + v.ty + top };
    },
    /* change the scale and keep the image point under the finger where it is */
    zoomAt(factor, clientX, clientY, viewRect) {
      return v.setScale(v.scale * factor, clientX, clientY, viewRect);
    },
    setZoom(level, clientX, clientY, viewRect) {
      return v.setScale(v.fitScale * level, clientX, clientY, viewRect);
    },
    setScale(scale, clientX, clientY, viewRect) {
      const next = Math.min(v.fitScale * MAX_ZOOM, Math.max(v.fitScale, scale));
      const left = viewRect ? viewRect.left : 0;
      const top = viewRect ? viewRect.top : 0;
      const cx = clientX === undefined ? left + v.viewW / 2 : clientX;
      const cy = clientY === undefined ? top + v.viewH / 2 : clientY;
      const p = v.toImage(cx, cy, viewRect);
      v.scale = next;
      v.tx = cx - left - p.x * v.scale;
      v.ty = cy - top - p.y * v.scale;
      return v.clampPan();
    },
    panBy(dx, dy) {
      v.tx += dx;
      v.ty += dy;
      return v.clampPan();
    },
    /* at least a quarter of the image stays on screen; a picture smaller than the view stays centred */
    clampPan() {
      const w = v.imageW * v.scale;
      const h = v.imageH * v.scale;
      if (w <= v.viewW) v.tx = (v.viewW - w) / 2;
      else v.tx = Math.min(v.viewW - w * MIN_VISIBLE, Math.max(w * MIN_VISIBLE - w, v.tx));
      if (h <= v.viewH) v.ty = (v.viewH - h) / 2;
      else v.ty = Math.min(v.viewH - h * MIN_VISIBLE, Math.max(h * MIN_VISIBLE - h, v.ty));
      return v;
    },
    /* for ctx.setTransform on a canvas whose backing store is the box times the device pixel ratio */
    canvasTransform() {
      return [v.scale * v.dpr, 0, 0, v.scale * v.dpr, v.tx * v.dpr, v.ty * v.dpr];
    },
    /* a brush is chosen in screen pixels (FR-39): zooming in makes it finer on the picture */
    brushImagePx(screenPx) {
      return screenPx / v.scale;
    }
  };
  return v;
}

/* ---------- the outfit builder (architecture section 7) ---------- */
const pt = (p) => (Array.isArray(p) ? { x: p[0], y: p[1] } : p);
/* What two fingers did since they landed: the turn in degrees (clockwise positive, the short way
   round), the spread as a ratio, and how far their midpoint moved (FR-65). */
export function gestureTransform(start, now) {
  const [a0, b0] = start.map(pt);
  const [a1, b1] = now.map(pt);
  const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y) || 1;
  const d1 = Math.hypot(b1.x - a1.x, b1.y - a1.y) || 1;
  let angle = ((Math.atan2(b1.y - a1.y, b1.x - a1.x) - Math.atan2(b0.y - a0.y, b0.x - a0.x)) * 180) / Math.PI;
  angle = ((angle + 540) % 360) - 180;
  return { angle, scale: d1 / d0, dx: (a1.x + b1.x - a0.x - b0.x) / 2, dy: (a1.y + b1.y - a0.y - b0.y) / 2 };
}
/* A piece's box on a stage `stageW` pixels wide, before any turn: position and width are
   fractions of the stage width, the height follows the picture's own shape. */
export function pieceBox(piece, stageW, aspect) {
  const width = piece.w * stageW;
  const height = width * (aspect || 1);
  const left = piece.x * stageW;
  const top = piece.y * stageW;
  return { left, top, width, height, cx: left + width / 2, cy: top + height / 2 };
}
/* The four corners (top-left, top-right, bottom-right, bottom-left) after the builder's CSS
   transform `rotate(rot) scaleX(flip ? -1 : 1)` about the centre: the mirror first, then the
   turn, clockwise on screen (FR-64, FR-74). The saved picture is drawn with the same numbers. */
export function pieceCorners(piece, stageW, aspect) {
  const b = pieceBox(piece, stageW, aspect);
  const r = ((piece.rot || 0) * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const sx = piece.flip ? -1 : 1;
  const hw = b.width / 2;
  const hh = b.height / 2;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([dx, dy]) => {
    const mx = dx * sx;
    return [b.cx + mx * cos - dy * sin, b.cy + mx * sin + dy * cos];
  });
}
