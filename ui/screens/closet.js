/* aWardrobe screen: the Closet. In this milestone only the empty state (FR-9). */
import { h, btn, pageHead, empty } from '../components.js';
import { plural } from '../format.js';

export const closet = {
  name: 'closet',
  render(root, arg, { app, router }) {
    const all = app.records.list('garments').filter((g) => g.status !== 'gone');
    root.appendChild(pageHead('Closet', plural(all.length, 'piece')));
    if (!all.length) {
      root.appendChild(empty('Your closet is empty', 'Photograph each piece against a plain background, like a bed sheet or a wall, and aWardrobe cuts it out for you.', btn('Add your first garment', () => router.go('edit', 'new'), { kind: 'primary', icon: 'camera', id: 'closet-first' })));
      return;
    }
    root.appendChild(h('div.item-grid', all.map((g) => h('div.card-item', h('span', g.name)))));
  }
};
