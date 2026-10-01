/* aWardrobe screen: Stats. In this milestone only the empty state. */
import { pageHead, empty } from '../components.js';

export const stats = {
  name: 'stats',
  render(root) {
    root.appendChild(pageHead('Stats', 'What you actually wear'));
    root.appendChild(empty('Nothing to count yet', 'Once you have added clothes and logged a few days, this page shows what you really wear. Stats come in a later update.'));
  }
};
