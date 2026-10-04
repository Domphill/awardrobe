/* aWardrobe ui: mix and match (architecture section 7, FR-67 to FR-70). One row per slot with
   the current garment in the middle and the previous and next visible either side; arrows or a
   swipe turn the slot; slots can be added and removed; Shuffle fills every slot. */
import { h, btn, iconBtn, pic, sheet, clear } from '../../components.js';
import { category, CATEGORIES } from '../../../domain/model.js';

const SWIPE = 32;

export function createMixer({ session, app, run, router }) {
  const el = h('div.mixer#mixer', { hidden: true });
  const thumb = (g, size) => (g && g.pictures ? pic(() => app.pictures.image(g.pictures.thumb, 'thumb'), { w: size, h: Math.round(size * 1.2), alt: g.name || g.type || '', eager: true }) : h('span.muted', 'none'));
  const render = () => {
    clear(el);
    const s = session.state;
    el.hidden = !s.mixer;
    if (!s.mixer) return;
    if (s.mixer === 'few') {
      el.appendChild(h('div.card', h('p', 'Mix and match needs clothes in at least two categories, like tops and bottoms. Add some more clothes first.'), h('div.actions', btn('Add a garment', () => router.go('edit', 'new'), { kind: 'primary', icon: 'camera' }), btn('Close', () => session.closeMixer(), { kind: 'ghost' }))));
      return;
    }
    const rows = h('div.slots');
    for (const slot of s.slots) {
      const ring = session.ringOf(slot.category);
      const piece = slot.pieceId ? s.pieces.find((p) => p.id === slot.pieceId) : null;
      const at = piece ? ring.findIndex((g) => g && g.id === piece.garmentId) : ring.length - 1;
      const prev = ring[(at - 1 + ring.length) % ring.length];
      const next = ring[(at + 1) % ring.length];
      const current = at >= 0 && at < ring.length - 1 ? ring[at] : null;
      const only = ring.length <= 2;
      const label = current ? (current.name || current.type) + ', ' + (at + 1) + ' of ' + (ring.length - 1) : 'none';
      const row = h(
        'div.slot',
        { dataset: { slotId: slot.id } },
        h(
          'div.slot-row',
          h('button.slot-prev', { type: 'button', 'aria-label': 'Previous ' + category(slot.category).label.toLowerCase(), disabled: only, onclick: () => run('slotTurn', { slotId: slot.id, dir: -1 }) }, only ? null : thumb(prev, 44)),
          h('div.slot-current', thumb(current, 72)),
          h('button.slot-next', { type: 'button', 'aria-label': 'Next ' + category(slot.category).label.toLowerCase(), disabled: only, onclick: () => run('slotTurn', { slotId: slot.id, dir: 1 }) }, only ? null : thumb(next, 44))
        ),
        h('div.slot-foot', h('b.slot-title', category(slot.category).label), h('span.slot-label', label), iconBtn('x', 'Remove slot', () => run('slotRemove', slot.id), { cls: 'slot-remove' }))
      );
      /* a swipe on the row turns the slot too */
      let startX = null;
      row.addEventListener('pointerdown', (e) => {
        if (e.target.closest && e.target.closest('button')) return;
        startX = e.clientX;
      });
      row.addEventListener('pointerup', (e) => {
        if (startX === null || only) return;
        const dx = e.clientX - startX;
        startX = null;
        if (Math.abs(dx) >= SWIPE) run('slotTurn', { slotId: slot.id, dir: dx < 0 ? 1 : -1 });
      });
      rows.appendChild(row);
    }
    el.appendChild(rows);
    el.appendChild(h('div.actions', btn('Add a slot', addSlot, { icon: 'plus', id: 'slot-add', small: true }), btn('Shuffle', () => run('shuffle'), { icon: 'shuffle', id: 'shuffle', small: true }), btn('Close', () => session.closeMixer(), { kind: 'ghost', id: 'mix-close', small: true })));
  };
  const addSlot = () => {
    const cats = CATEGORIES.filter((c) => session.wearable().some((g) => g.category === c.key));
    const s = sheet({
      title: 'Add a slot for…',
      body: h('div.actions.wrap', cats.map((c) => btn(c.label, () => {
        s.close();
        run('slotAdd', c.key);
      }, { small: true }))),
      actions: [btn('Cancel', () => s.close(), { kind: 'ghost' })]
    });
  };
  return { el, render };
}
