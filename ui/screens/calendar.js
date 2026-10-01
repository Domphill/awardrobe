/* aWardrobe screen: Calendar. In this milestone only the empty state. */
import { pageHead, empty } from '../components.js';

export const calendar = {
  name: 'calendar',
  render(root) {
    root.appendChild(pageHead('Calendar'));
    root.appendChild(empty('Nothing logged yet', 'Log what you wore each day, or plan an outfit for a day ahead. The calendar comes in a later update.'));
  }
};
