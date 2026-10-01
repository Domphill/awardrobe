/* aWardrobe screen: Outfits. In this milestone only the empty state. */
import { pageHead, empty } from '../components.js';

export const outfits = {
  name: 'outfits',
  render(root) {
    root.appendChild(pageHead('Outfits'));
    root.appendChild(empty('No outfits yet', 'Put pieces from your closet together, move them about, and save the combination. Outfits come in a later update.'));
  }
};
