/* aWardrobe ui: which screen is open, from the address hash (#/garment/g_…), and how to move. */

export const SCREENS = ['closet', 'garment', 'edit', 'outfits', 'outfit', 'calendar', 'week', 'stats', 'more', 'welcome'];

export function parseRoute(hash) {
  const m = /^#\/([a-z]+)(?:\/([^/?#]*))?/.exec(hash || '');
  if (!m || !SCREENS.includes(m[1])) return { name: 'closet', arg: null };
  let arg = null;
  if (m[2]) {
    try {
      arg = decodeURIComponent(m[2]);
    } catch (e) {
      arg = m[2];
    }
  }
  return { name: m[1], arg };
}

export function buildHash(name, arg) {
  return '#/' + name + (arg ? '/' + encodeURIComponent(arg) : '');
}

/* The live router: keeps `current`, remembers how deep we are so Back can go back inside the
   app, and calls `onChange(route, { nav })` whenever the screen should render. */
export function createRouter(onChange) {
  const router = {
    current: parseRoute(location.hash),
    depth: 0,
    start() {
      window.addEventListener('hashchange', () => {
        router.current = parseRoute(location.hash);
        onChange(router.current, { nav: true });
      });
      router.current = parseRoute(location.hash);
      onChange(router.current, { nav: true });
    },
    go(name, arg, opts) {
      const hash = buildHash(name, arg);
      if (opts && opts.replace) {
        const same = location.hash === hash;
        history.replaceState(null, '', location.pathname + location.search + hash);
        if (same) {
          router.current = parseRoute(hash);
          onChange(router.current, { nav: true });
        } else {
          router.current = parseRoute(hash);
          onChange(router.current, { nav: true });
        }
        return;
      }
      if (location.hash === hash) {
        onChange(router.current, { nav: true });
        return;
      }
      router.depth++;
      location.hash = hash;
    },
    back(fallback) {
      if (router.depth > 0) {
        router.depth--;
        history.back();
      } else router.go(fallback || 'closet', null, { replace: true });
    },
    refresh() {
      onChange(router.current, { nav: false });
    }
  };
  return router;
}
