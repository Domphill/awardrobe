/* aWardrobe ui: the frame around every screen. Tab bar, top bar, theme, the Add sheet, the
   update notice, the memory-only banner, and the catch that turns a crash on one screen into a
   plain message with a way back (FR-115). */
import { h, clear, btn, iconBtn, sheet, toast } from './components.js';
import { icon, logo } from './icons.js';

const TABS = [
  { name: 'closet', label: 'Closet', icon: 'hanger', also: ['garment', 'edit'] },
  { name: 'outfits', label: 'Outfits', icon: 'layers', also: ['outfit'] },
  { name: 'add', label: 'Add', icon: 'plus', add: true },
  { name: 'calendar', label: 'Calendar', icon: 'calendar', also: ['week'] },
  { name: 'stats', label: 'Stats', icon: 'stats', also: [] },
  { name: 'more', label: 'More', icon: 'more', also: [], cls: 'tab-more' }
];

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');
  try {
    localStorage.setItem('awardrobe.theme', theme || 'system');
  } catch (e) {
    /* storage may be blocked */
  }
}
export function clearTheme() {
  document.documentElement.removeAttribute('data-theme');
  try {
    localStorage.removeItem('awardrobe.theme');
  } catch (e) {
    /* storage may be blocked */
  }
}
export function savedTheme() {
  try {
    return localStorage.getItem('awardrobe.theme') || 'system';
  } catch (e) {
    return 'system';
  }
}

export function createShell({ mount, app, router, screens }) {
  clear(mount);
  const main = h('main#main', { tabindex: '-1' });
  const tabs = h('nav.tabs', { 'aria-label': 'Main' });
  const notices = h('div#notices');
  const topbar = h('header.topbar', h('button.brand', { type: 'button', 'aria-label': 'aWardrobe home', onclick: () => router.go('closet') }, logo(28), h('span.brand-name', 'aWardrobe')), iconBtn('more', 'More', () => router.go('more'), { id: 'more-btn', cls: 'topbar-btn' }));
  const frame = h('div.shell', topbar, notices, main, tabs);
  mount.appendChild(frame);
  mount.appendChild(h('div#layer'));
  mount.appendChild(h('div#toasts', { 'aria-live': 'polite' }));

  const shell = { el: frame, main, current: null, onboardedThisSession: false, throwOnce: null, throwAlways: null, errored: false, renders: 0, pickPhoto: null, editor: null, onLeave: null, onHide: null };

  for (const t of TABS) {
    if (t.add) {
      tabs.appendChild(h('button.tab.tab-add', { type: 'button', 'aria-label': 'Add', onclick: (e) => shell.openAdd(e.currentTarget) }, h('span.plus', icon('plus')), h('span.tab-label', 'Add')));
    } else {
      tabs.appendChild(h('button.tab' + (t.cls ? '.' + t.cls : ''), { type: 'button', dataset: { tab: t.name }, onclick: () => router.go(t.name) }, icon(t.icon), h('span.tab-label', t.label), h('span.tab-mark', { 'aria-hidden': 'true' })));
    }
  }
  const markTab = (name) => {
    for (const b of tabs.querySelectorAll('[data-tab]')) {
      const t = TABS.find((x) => x.name === b.dataset.tab);
      if (b.dataset.tab === name || (t && t.also.includes(name))) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
  };

  shell.openAdd = (opener) => {
    const item = (ic, title, sub, go) =>
      h('button.menu-item', { type: 'button', onclick: () => {
        s.close();
        go();
      } }, icon(ic), h('span.menu-text', h('span.menu-title', title), h('span.menu-sub', sub)), icon('chev'));
    const s = sheet({
      title: 'Add',
      opener,
      body: h('div.menu', item('camera', 'Add a garment', 'Photograph a piece and cut out the background', () => router.go('edit', 'new')), item('layers', 'New outfit', 'Put pieces together and save the combination', () => router.go('outfit', 'new')), item('calendar', 'Log today', 'What you are wearing today', () => router.go('calendar', 'today')))
    });
  };

  shell.showUpdateNotice = (onReload) => {
    if (document.getElementById('update-notice')) return;
    notices.appendChild(h('div.notice#update-notice', { role: 'status' }, h('span', 'A new version of aWardrobe is ready.'), btn('Reload', () => (onReload ? onReload() : location.reload()), { small: true, kind: 'primary' })));
  };
  shell.showBanner = (text) => {
    notices.appendChild(h('div.banner.banner-warn', { role: 'alert' }, text));
  };

  shell.render = (route, opts) => {
    opts = opts || {};
    shell.renders++;
    let name = route.name;
    const prefs = app.prefs.get();
    if (!prefs.onboarded && !shell.onboardedThisSession) name = 'welcome';
    else if (name === 'welcome') name = 'closet';
    let screen = screens[name];
    if (!screen) {
      if (name !== 'closet') toast('That part of the app is not built yet.');
      name = 'closet';
      screen = screens.closet;
    }
    const y = window.scrollY;
    /* a screen with unfinished work gets a word before another screen replaces it */
    if (shell.current && shell.current !== name && typeof shell.onLeave === 'function') {
      const leaving = shell.onLeave;
      shell.onLeave = null;
      try {
        leaving(name);
      } catch (e) {
        console.error(e);
      }
    }
    clear(main);
    frame.classList.toggle('bare', name === 'welcome');
    const box = h('div.screen.screen-' + name);
    main.appendChild(box);
    shell.errored = false;
    try {
      if (shell.throwOnce === name || shell.throwAlways === name) {
        shell.throwOnce = null;
        const induced = new Error('A test asked the ' + name + ' screen to fail.');
        induced.testInduced = true;
        throw induced;
      }
      screen.render(box, route.arg, { app, router, shell });
    } catch (e) {
      shell.errored = true;
      if (!(e && e.testInduced)) console.error(e);
      app.errors.record({ screen: name, message: String((e && e.message) || e), stack: String((e && e.stack) || '').split('\n').slice(0, 4).join('\n') });
      clear(box);
      box.appendChild(h('div.page-error', { role: 'alert' }, h('h2', 'Something went wrong on this page.'), h('p', String((e && e.message) || e)), h('div.actions', btn('Go to Closet', () => router.go('closet', null, { replace: true }), { kind: 'primary' }), btn('Reload', () => location.reload(), { kind: 'ghost' }))));
    }
    shell.current = name;
    markTab(name);
    if (opts.nav) window.scrollTo(0, 0);
    else window.scrollTo(0, y);
  };
  shell.refresh = () => {
    if (shell.errored) return;
    shell.render(router.current, { nav: false });
  };

  return shell;
}
