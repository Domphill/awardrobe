/* aWardrobe: boot. The order is fail-soft: theme, shell, database (memory-only if it fails),
   records, the screen, the service worker, then idle work. Test hooks exist only on localhost. */
import { createApp } from './app/boot.js';
import { createRouter } from './ui/router.js';
import { createShell, applyTheme, savedTheme } from './ui/shell.js';
import { welcome } from './ui/screens/welcome.js';
import { closet } from './ui/screens/closet.js';
import { outfits } from './ui/screens/outfits.js';
import { calendar } from './ui/screens/calendar.js';
import { stats } from './ui/screens/stats.js';
import { more } from './ui/screens/more.js';
import { env } from './infra/platform.js';
import { persist } from './infra/db.js';

const SCREENS = { welcome, closet, outfits, calendar, stats, more };
const mount = document.getElementById('app');
let state = null;
let channel = null;

async function boot(opts) {
  opts = opts || {};
  applyTheme(savedTheme());
  const app = await createApp({ forceNoStorage: !!opts.nostorage });
  if (opts.onboarded) await app.prefs.set({ onboarded: true });
  applyTheme(app.prefs.get().theme);
  const router = createRouter((route, o) => shell.render(route, o));
  const shell = createShell({ mount, app, router, screens: SCREENS });
  if (app.memoryOnly) shell.showBanner('This browser won’t let aWardrobe save anything, so your things will be lost when you close it. Try Safari or Chrome, not a private window.');
  app.records.on(() => {
    if (shell.current && shell.current !== 'welcome') shell.refresh();
  });
  if (env.broadcast) {
    channel = new BroadcastChannel('awardrobe');
    channel.onmessage = async (e) => {
      if (e.data && e.data.type === 'changed') {
        await app.records.load();
        applyTheme(app.prefs.get().theme);
        shell.refresh();
      }
    };
    app.records.on((change) => {
      if (change.kind !== 'wipe') channel.postMessage({ type: 'changed', store: change.store });
    });
  }
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && state && state.app === app) {
      await app.records.load();
      applyTheme(app.prefs.get().theme);
      shell.refresh();
    }
  });
  state = { app, router, shell };
  router.start();
  registerWorker(shell);
  return state;
}

function registerWorker(shell) {
  if (!env.serviceWorker || !env.secure) return;
  const hadWorker = !!navigator.serviceWorker.controller;
  navigator.serviceWorker
    .register('sw.js')
    .then((reg) => {
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) shell.showUpdateNotice();
        });
      });
    })
    .catch((e) => console.warn('aWardrobe: offline support unavailable', e));
  if (hadWorker) navigator.serviceWorker.addEventListener('controllerchange', () => shell.showUpdateNotice());
}

async function teardown() {
  if (!state) return;
  if (channel) {
    channel.close();
    channel = null;
  }
  state.app.close();
  state = null;
}

/* ---------- test hooks, localhost only ---------- */
if (env.local) {
  const persistCalls = { n: 0 };
  const realPersist = navigator.storage && navigator.storage.persist ? navigator.storage.persist.bind(navigator.storage) : null;
  if (navigator.storage) {
    navigator.storage.persist = async () => {
      persistCalls.n++;
      return realPersist ? realPersist() : false;
    };
  }
  const T = (window.aWardrobeTest = {
    ready: false,
    get persistCalls() {
      return persistCalls.n;
    },
    get records() {
      return state && state.app.records;
    },
    get prefs() {
      return state && state.app.prefs;
    },
    get router() {
      return state && state.router;
    },
    get shell() {
      return state && state.shell;
    },
    go: (name, arg) => state.router.go(name, arg, { replace: true }),
    simulateUpdate: () => state.shell.showUpdateNotice(),
    throwOn: (name) => (state.shell.throwOnce = name),
    async reboot(opts) {
      opts = opts || {};
      T.ready = false;
      if (opts.wipe && state) {
        await state.app.records.wipe();
        try {
          localStorage.removeItem('awardrobe.theme');
        } catch (e) {
          /* ignore */
        }
      }
      await teardown();
      history.replaceState(null, '', location.pathname + location.search + '#/closet');
      await boot(opts);
      T.ready = true;
    },
    async seed(data) {
      const r = state.app.records;
      const stores = Object.keys(data);
      await r.tx(stores, (ops) => {
        for (const s of stores) for (const rec of data[s]) ops.put(s, rec);
      });
    }
  });
  boot().then(() => (T.ready = true));
} else {
  boot();
}
