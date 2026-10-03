/* aWardrobe ui: the editor's tool bar and each tool's options (architecture 6.4; FR-35 to
   FR-48, FR-52). The bar is a radio group; the options panel changes with the tool; the action
   buttons run the one-tap commands. Everything calls the session and the stage, never the
   worker directly. */
import { h, btn, iconBtn, segmented, sheet, toast } from '../../components.js';
import { icon } from '../../icons.js';
import { SWATCHES } from '../../../domain/colour/naming.js';
import { BRUSH_SIZES } from '../../../domain/image/geometry.js';

export const TOOLS = [
  ['move', 'Move', 'm'],
  ['wand', 'Wand', 'w'],
  ['select', 'Select', 's'],
  ['paint', 'Paint', 'p'],
  ['eraser', 'Eraser', 'e'],
  ['restore', 'Restore', 'r'],
  ['rotate', 'Rotate', 't'],
  ['crop', 'Crop', 'c'],
  ['dropper', 'Dropper', 'd']
];
const TOOL_HELP = {
  move: 'Drag to move about, pinch or double-tap to zoom.',
  wand: 'Tap an area to remove it (or bring it back). The slider says how much a tap takes.',
  select: 'Brush over an area; it snaps to the garment. Then keep only that, or remove it.',
  paint: 'Brush a colour onto the garment, keeping its shading or painting solid.',
  eraser: 'Brush away anything that should not be there.',
  restore: 'Brush back anything that was cut away.',
  rotate: 'Turn the photo; the cut-out turns with it.',
  crop: 'Drag the corners or the box, then apply.',
  dropper: 'Tap the photo to pick a colour, for the garment or for the brush.'
};

export function createTools({ session, stage, run }) {
  const st = () => session.state;
  const bar = h('div.tools', { role: 'radiogroup', 'aria-label': 'Tools' });
  const buttons = {};
  for (const [key, label] of TOOLS) {
    buttons[key] = h('button.tool', { type: 'button', role: 'radio', dataset: { tool: key }, 'aria-checked': 'false', onclick: () => api.setTool(key) }, icon(key), h('span', label));
    bar.appendChild(buttons[key]);
  }
  const options = h('div.tool-options#tool-options');
  const help = h('p.fineprint#tool-help');

  /* ---------- pieces of the options panel ---------- */
  const brushSizes = () =>
    h('div.brush-size', { role: 'group', 'aria-label': 'Brush size' }, h('span.muted', 'Brush'), ...Object.keys(BRUSH_SIZES).map((size) => h('button', { type: 'button', dataset: { size }, 'aria-label': size + ' brush', 'aria-pressed': String(st().options.size === size), onclick: () => api.setOption('size', size) }, h('span.dot.dot-' + size))));
  const toleranceSlider = (id, label) => {
    const input = h('input.slider', { type: 'range', id, min: '0', max: '90', step: '1', value: String(st().options.tolerance), 'aria-label': label });
    const value = h('b', String(st().options.tolerance));
    input.addEventListener('input', () => (value.textContent = input.value));
    input.addEventListener('change', () => api.setOption('tolerance', Number(input.value)));
    return h('div.slider-row', h('span.muted', label + ' '), value, input);
  };
  const paintSwatch = () => {
    const sw = h('button#paint-colour', { type: 'button', 'aria-label': 'Paint colour ' + st().paintColour, onclick: () => pickPalette((hex) => session.setPaintColour(hex)) }, h('span.swatch-dot', { style: { background: st().paintColour } }), h('span', 'Colour'));
    return sw;
  };
  const pickPalette = (onPick) => {
    const s = sheet({
      title: 'Choose a colour',
      body: h('div.swatch-grid', Object.entries(SWATCHES).map(([name, hex]) => h('button.swatch', { type: 'button', dataset: { name }, onclick: () => {
        s.close();
        onPick(hex, name);
      } }, h('span.swatch-dot', { style: { background: hex } }), h('span', name))))
    });
  };
  const rotatePanel = () => {
    const o = st().options;
    const angle = h('input.slider#rotate-angle', { type: 'range', min: '-180', max: '180', step: '1', value: String(o.angle || 0), 'aria-label': 'Turn by degrees' });
    const typed = h('input.input#rotate-degrees', { type: 'number', min: '-180', max: '180', step: '1', value: String(o.angle || 0), 'aria-label': 'Degrees' });
    const setAngle = (v) => {
      v = Math.max(-180, Math.min(180, Math.round(Number(v) || 0)));
      session.setOption('angle', v);
      angle.value = String(v);
      typed.value = String(v);
      stage.rotatePreview(v);
    };
    angle.addEventListener('input', () => setAngle(angle.value));
    typed.addEventListener('change', () => setAngle(typed.value));
    return h(
      'div.form',
      h('div.actions', btn('Turn left', () => run('rotate', -90), { icon: 'undo', small: true }), btn('Turn right', () => run('rotate', 90), { icon: 'redo', small: true }), btn('Mirror', () => run('mirror'), { small: true })),
      h('div.slider-row', h('span.muted', 'Any angle'), angle, typed, h('span.muted', '°')),
      h('div.actions', btn('Done', () => api.setTool('move'), { kind: 'primary', small: true }), h('span.fineprint', 'The turn is applied when you leave the tool.'))
    );
  };
  const build = () => {
    const tool = st().tool;
    const o = st().options;
    options.replaceChildren();
    help.textContent = TOOL_HELP[tool] || '';
    if (tool === 'wand') {
      options.appendChild(h('div.form', segmented({ name: 'wand-mode', label: 'Wand', value: o.wandMode, options: [{ value: 'remove', label: 'Remove' }, { value: 'restore', label: 'Bring back' }], onChange: (v) => api.setOption('wandMode', v) }), toleranceSlider('wand-tolerance', 'How much a tap takes')));
    } else if (tool === 'select') {
      const snap = h('input#select-snap', { type: 'checkbox', checked: !!o.snap, onchange: () => api.setOption('snap', snap.checked) });
      options.appendChild(h('div.form', brushSizes(), h('label.check', snap, h('span', 'Snap to the garment')), toleranceSlider('select-tolerance', 'Snapping reach'), h('div.actions', btn('Keep only this', () => run('selectApply', 'keep'), { kind: 'primary', small: true }), btn('Remove this', () => run('selectApply', 'remove'), { small: true }), btn('Clear', () => run('selectApply', 'clear'), { kind: 'ghost', small: true }))));
    } else if (tool === 'paint') {
      options.appendChild(h('div.form', h('div.actions', brushSizes(), paintSwatch()), segmented({ name: 'paint-mode', label: 'Paint', value: o.paintMode, options: [{ value: 'dye', label: 'Keep shading' }, { value: 'solid', label: 'Solid' }], onChange: (v) => api.setOption('paintMode', v) })));
    } else if (tool === 'eraser' || tool === 'restore') {
      options.appendChild(brushSizes());
    } else if (tool === 'rotate') {
      options.appendChild(rotatePanel());
    } else if (tool === 'crop') {
      options.appendChild(h('div.actions', btn('Apply crop', () => run('crop'), { kind: 'primary', small: true }), btn('Reset', () => stage.resetCropBox(), { kind: 'ghost', small: true })));
    } else if (tool === 'dropper') {
      options.appendChild(segmented({ name: 'dropper-target', label: 'Dropper picks for', value: o.dropperTarget, options: [{ value: 'garment', label: 'Garment colours' }, { value: 'paint', label: 'Paint colour' }], onChange: (v) => api.setOption('dropperTarget', v) }));
    } else {
      options.appendChild(h('div.actions', btn('Zoom in', () => stage.zoomBy(1.5), { small: true, id: 'zoom-in', ariaLabel: 'Zoom in' }), btn('Zoom out', () => stage.zoomBy(1 / 1.5), { small: true, id: 'zoom-out', ariaLabel: 'Zoom out' }), btn('Fit', () => stage.setZoom(1), { small: true, kind: 'ghost', id: 'zoom-fit' })));
    }
    for (const [key] of TOOLS) buttons[key].setAttribute('aria-checked', String(key === tool));
  };

  const api = {
    bar,
    options,
    help,
    get tool() {
      return st().tool;
    },
    setTool(tool) {
      const was = st().tool;
      if (was === 'rotate' && tool !== 'rotate' && st().options.angle) {
        const deg = st().options.angle;
        session.setOption('angle', 0);
        stage.rotatePreview(0);
        run('rotate', deg);
      }
      session.setTool(tool);
      stage.setTool(tool);
      build();
      if (buttons[tool]) buttons[tool].focus({ preventScroll: true });
    },
    setOption(key, value) {
      if (key === 'colour') {
        session.setPaintColour(value);
        build();
        return;
      }
      session.setOption(key, value);
      if (key === 'angle') stage.rotatePreview(value);
      build();
    },
    refresh: build,
    /* keyboard: tool letters, Ctrl+Z and Ctrl+Shift+Z or Ctrl+Y (FR-52) */
    key(e) {
      const target = e.target;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) && !(e.ctrlKey || e.metaKey)) return false;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        run(e.shiftKey ? 'redo' : 'undo');
        return true;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        run('redo');
        return true;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      const hit = TOOLS.find(([, , k]) => k === e.key.toLowerCase());
      if (!hit) return false;
      api.setTool(hit[0]);
      return true;
    },
    disable(on) {
      for (const b of Object.values(buttons)) b.disabled = !!on && b.dataset.tool !== 'move';
    },
    pickPalette
  };
  build();
  void iconBtn;
  void toast;
  return api;
}
