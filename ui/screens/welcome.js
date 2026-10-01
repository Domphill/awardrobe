/* aWardrobe screen: the first open (FR-109). */
import { h, btn, toast } from '../components.js';
import { icon, logo } from '../icons.js';

export const welcome = {
  name: 'welcome',
  render(root, arg, { app, router, shell }) {
    root.appendChild(
      h(
        'div.welcome',
        h('div.welcome-mark', logo(88)),
        h('h1.welcome-title', 'aWardrobe'),
        h('p.welcome-lead', 'Your clothes, photographed and cut out, so you can see everything you own, put outfits together, and notice what you actually wear.'),
        h('ul.welcome-points', [
          ['camera', 'Photograph each piece on a plain background'],
          ['hanger', 'The background is removed for you'],
          ['layers', 'Build outfits by moving the pieces about'],
          ['calendar', 'Log what you wore, and see cost per wear']
        ].map(([ic, t]) => h('li', icon(ic), h('span', t)))),
        h('p.fineprint', 'Everything stays on your phone. Nothing is sent anywhere, apart from an optional weather forecast for your town.'),
        h('div.actions.center', btn('Open my wardrobe', async () => {
          shell.onboardedThisSession = true;
          try {
            await app.prefs.set({ onboarded: true });
          } catch (e) {
            toast("That couldn't be saved, so the welcome may show again next time. " + ((e && e.message) || ''));
          }
          app.storage.persist();
          router.go('closet', null, { replace: true });
        }, { kind: 'primary', id: 'welcome-start' }))
      )
    );
  }
};
