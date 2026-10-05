/* aWardrobe ui: the "Gone from closet" sheet (FR-14), shared by the garment page and the edit
   screen: a reason, an optional date, and the save. */
import { h, btn, sheet, segmented, field, toast } from '../components.js';
import { GONE_REASONS } from '../../domain/model.js';

export function askGone(app, garment) {
  return new Promise((resolve) => {
    let reason = 'sold';
    const date = h('input.input#gone-date', { type: 'date', value: app.todayKey() });
    const s = sheet({
      title: 'Gone from closet',
      body: h(
        'div.form',
        h('p.muted', 'It leaves your closet, the outfit builder and the ideas, but stays on the days you wore it, in the outfits you saved, and in your stats.'),
        field('Why', segmented({ name: 'gone-reason', label: 'Reason', value: reason, options: GONE_REASONS.map((r) => ({ value: r.key, label: r.label })), onChange: (v) => (reason = v) })),
        field('When', date, 'Leave it blank if you are not sure.')
      ),
      actions: [
        btn('Cancel', () => s.close(false), { kind: 'ghost' }),
        btn('Mark gone', async () => {
          try {
            await app.garments.markGone(garment.id, reason, date.value || null);
            s.close(true);
            toast('Marked gone from your closet.');
          } catch (e) {
            toast("That couldn't be saved. " + ((e && e.message) || ''));
          }
        }, { kind: 'primary' })
      ],
      onClose: (result) => resolve(result === true)
    });
  });
}
