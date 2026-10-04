/* aWardrobe screen: the Outfits list (FR-63): saved outfits newest first with their pictures,
   names and favourite marks, and the way into the builder. */
import { h, btn, pic, empty, pageHead } from '../components.js';
import { icon } from '../icons.js';
import { plural } from '../format.js';

export const outfits = {
  name: 'outfits',
  render(root, arg, { app, router }) {
    const list = app.records.list('outfits').slice().sort((a, b) => (b.created || '').localeCompare(a.created || ''));
    const newBtn = btn('New outfit', () => router.go('build', 'new'), { kind: 'primary', icon: 'plus', id: 'outfits-new', small: true });
    root.appendChild(pageHead('Outfits', list.length ? plural(list.length, 'outfit') : '', list.length ? newBtn : null));
    if (!list.length) {
      root.appendChild(empty('No outfits yet', 'Put pieces from your closet together, move them about, and save the combination.', newBtn));
      return;
    }
    root.appendChild(
      h(
        'div.item-grid',
        list.map((o) =>
          h(
            'button.card-item.outfit-card',
            { type: 'button', dataset: { id: o.id }, onclick: () => router.go('outfit', o.id) },
            pic(() => app.pictures.image(o.picture, 'thumb'), { alt: o.name || 'Outfit', w: 300, h: 400 }),
            h('span.card-name', o.name || 'Outfit'),
            o.favourite ? h('span.fav-mark', { 'aria-hidden': 'true' }, icon('star')) : null
          )
        )
      )
    );
  }
};
