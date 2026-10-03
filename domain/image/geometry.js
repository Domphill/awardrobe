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
