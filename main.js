/* aWardrobe: boot. The order is fail-soft: theme, a loading screen, the database (memory-only if
   it fails or stalls), records, the shell and screen, the service worker. Test hooks exist only
   on localhost. */
import { createApp } from './app/boot.js';
import { createRouter } from './ui/router.js';
import { createShell, applyTheme, clearTheme, savedTheme } from './ui/shell.js';
import { h, clear, toast } from './ui/components.js';
import { logo } from './ui/icons.js';
import { welcome } from './ui/screens/welcome.js';
import { closet } from './ui/screens/closet.js';
import { garment } from './ui/screens/garment.js';
import { garmentEdit } from './ui/screens/garment-edit.js';
import { outfits } from './ui/screens/outfits.js';
import { outfit } from './ui/screens/outfit.js';
import { outfitEdit } from './ui/screens/outfit-edit.js';
import { calendar, week, askPassedPlans } from './ui/screens/calendar.js';
import { refreshTodayCard } from './ui/screens/home.js';
import { stats } from './ui/screens/stats.js';
import { more } from './ui/screens/more.js';
import { env } from './infra/platform.js';

const SCREENS = { welcome, closet, garment, edit: garmentEdit, outfits, outfit, build: outfitEdit, calendar, week, stats, more };
const mount = document.getElementById('app');
let state = null;
let weatherMock = null;
let channel = null;
let wantReload = false;
let lastReport = 0;
let controllerHooked = false;

function showLoading() {
  clear(mount);
  mount.appendChild(h('div.loading', logo(64), h('p', 'Opening your wardrobe…')));
}

async function boot(opts) {
  opts = opts || {};
  applyTheme(savedTheme());
  showLoading();
  const app = await createApp({ forceNoStorage: !!opts.nostorage, breakLoad: !!opts.breakLoad, hangOpen: !!opts.hangOpen, openTimeout: opts.openTimeout });
  if (opts.onboarded) await app.prefs.set({ onboarded: true });
  if (weatherMock) app.weather.useMock(weatherMock);
  applyTheme(app.prefs.get().theme);
  const router = createRouter((route, o) => shell.render(route, o));
  const shell = createShell({ mount, app, router, screens: SCREENS });
  if (app.memoryOnly) shell.showBanner('This browser won’t let aWardrobe save anything, so your things will be lost when you close it. Try Safari or Chrome, not a private window.');
  app.records.on((change) => {
    if (change.store === 'meta' && (change.id === 'errors' || change.id === 'weather')) return;
    if (shell.errored) return;
    if (shell.current && shell.current !== 'welcome') shell.refresh();
  });
  const refreshFromStorage = async (wiped) => {
    if (!state || state.app !== app) return;
    try {
      await app.records.load();
    } catch (e) {
      return;
    }
    if (wiped) shell.onboardedThisSession = false;
    applyTheme(app.prefs.get().theme);
    shell.refresh();
  };
  if (env.broadcast) {
    channel = new BroadcastChannel('awardrobe');
    channel.onmessage = (e) => {
      if (e.data && e.data.type === 'changed') refreshFromStorage(e.data.kind === 'wipe');
    };
    app.records.on((change) => {
      if (channel) channel.postMessage({ type: 'changed', store: change.store, kind: change.kind });
    });
  }
  /* a forecast landing (or failing) redraws only the screens that show it, and the Today card
     in place, so a search being typed is never thrown away under the user's hands */
  app.weather.on(() => {
    if (!state || state.app !== app || shell.errored) return;
    const cur = shell.current;
    if (cur === 'closet') refreshTodayCard({ app, router });
    else if (cur === 'calendar' || cur === 'week') shell.refresh();
    else if (cur === 'more' && !document.getElementById('town-search')) shell.refresh();
  });
  state = { app, router, shell };
  router.start();
  askPlans();
  refreshWeather();
  registerWorker(shell);
  return state;
}

/* the forecast is fetched after boot and whenever the app comes back, if a town is set and the kept one is over three hours old (FR-87) */
function refreshWeather() {
  const st = state;
  if (!st || !st.app.prefs.get().onboarded) return;
  st.app.weather.refresh().catch(() => {});
}

/* a planned day that has gone by is asked about once, after boot and whenever the app comes back (FR-81) */
function askPlans() {
  const st = state;
  if (!st || !st.app.prefs.get().onboarded) return;
  setTimeout(() => {
    if (state !== st || st.shell.errored) return;
    askPassedPlans(st.app, st.router).catch(() => {});
  }, 250);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && state && typeof state.shell.onHide === 'function') state.shell.onHide();
  if (document.visibilityState === 'visible' && state) {
    const { app, shell } = state;
    app.records
      .load()
      .then(() => {
        if (!state || state.app !== app) return;
        applyTheme(app.prefs.get().theme);
        shell.refresh();
        askPlans();
        refreshWeather();
      })
      .catch(() => {});
  }
});

function registerWorker(shell) {
  if (!env.serviceWorker || !env.secure) return;
  navigator.serviceWorker
    .register('sw.js')
    .then((reg) => {
      const offer = () =>
        shell.showUpdateNotice(() => {
          wantReload = true;
          if (reg.waiting) reg.waiting.postMessage({ type: 'skip-waiting' });
          else location.reload();
        });
      if (reg.waiting && navigator.serviceWorker.controller) offer();
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) offer();
        });
      });
    })
    .catch((e) => console.warn('aWardrobe: offline support unavailable', e));
  if (!controllerHooked) {
    controllerHooked = true;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (wantReload) location.reload();
    });
  }
}

/* Anything that escapes a handler is recorded and shown once, never a silent failure. */
function report(message) {
  if (state) state.app.errors.record({ screen: state.shell.current || 'app', message: String(message) });
  const now = Date.now();
  if (now - lastReport > 3000) {
    lastReport = now;
    toast('Something went wrong. If it keeps happening, see Report a problem under More.');
  }
}
window.addEventListener('error', (e) => report(e.message || (e.error && e.error.message) || 'error'));
window.addEventListener('unhandledrejection', (e) => report((e.reason && e.reason.message) || e.reason || 'error'));

async function teardown() {
  if (!state) return;
  if (channel) {
    channel.close();
    channel = null;
  }
  state.router.stop();
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
    get errors() {
      return state && state.app.errors;
    },
    get router() {
      return state && state.router;
    },
    get shell() {
      return state && state.shell;
    },
    get renderCount() {
      return state ? state.shell.renders : 0;
    },
    go: (name, arg) => state.router.go(name, arg, { replace: true }),
    simulateUpdate: () => state.shell.showUpdateNotice(() => location.reload()),
    throwOn: (name) => (state.shell.throwOnce = name),
    throwAlways: (name) => (state.shell.throwAlways = name),
    failNextWrite: () => (state.app.records.failNext = true),
    abortNextTx: () => (state.app.records.abortNextTx = true),
    now: (iso) => state.app.setNow(iso ? new Date(iso) : null),
    /* the weather stand-in: nothing in the tests touches the network */
    weather: {
      mock(spec) {
        weatherMock = spec || null;
        if (state) state.app.weather.useMock(weatherMock);
      },
      requests: () => (state ? state.app.weather.requests.slice() : []),
      refresh: (opts) => state.app.weather.refresh(opts),
      setPlace: (p) => state.app.weather.setPlace(p),
      clearPlace: () => state.app.weather.clearPlace(),
      state: () => state.app.weather.state()
    },
    pickPhoto: (file) => (state.shell.pickPhoto ? state.shell.pickPhoto(file) : Promise.reject(new Error('the add screen is not open'))),
    get editor() {
      return state && state.shell.editor;
    },
    get builder() {
      return state && state.shell.builder;
    },
    async reboot(opts) {
      opts = opts || {};
      T.ready = false;
      if (opts.wipe && state) {
        await state.app.records.wipe();
        clearTheme();
      }
      /* a frozen test clock survives a plain reboot, as the phone's clock would; a wipe starts afresh */
      const keepNow = !opts.wipe && state && state.app.frozenNow ? state.app.frozenNow() : null;
      await teardown();
      history.replaceState(null, '', location.pathname + location.search + '#/closet');
      await boot(opts);
      if (keepNow) state.app.setNow(keepNow);
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
