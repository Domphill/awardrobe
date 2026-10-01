/* aWardrobe: offline support. The app's files are stored when this worker installs, so the app
   opens without a connection. Bump VERSION on every release, or phones keep the old copy.
   Records and photos never pass through here: they live in the browser's own database.
   Only caches named awardrobe-* are touched, because other apps share this site. */
const VERSION = 'awardrobe-v1';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'main.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-512-maskable.png',
  'icons/apple-touch-icon.png',
  'fonts/fonts.css',
  'fonts/bricolage-grotesque-latin.woff2',
  'fonts/bricolage-grotesque-latin-ext.woff2',
  'ui/tokens.css',
  'ui/base.css',
  'ui/components.css',
  'ui/screens.css',
  'ui/components.js',
  'ui/icons.js',
  'ui/format.js',
  'ui/router.js',
  'ui/shell.js',
  'ui/screens/welcome.js',
  'ui/screens/closet.js',
  'ui/screens/outfits.js',
  'ui/screens/calendar.js',
  'ui/screens/stats.js',
  'ui/screens/more.js',
  'app/boot.js',
  'app/records.js',
  'app/prefs.js',
  'app/version.js',
  'domain/model.js',
  'infra/db.js',
  'infra/platform.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('awardrobe-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(new URL('./', self.location.href).pathname)) return;
  e.respondWith(
    caches.open(VERSION).then((cache) =>
      cache.match(req, { ignoreSearch: true }).then((hit) => {
        if (hit) return hit;
        return fetch(req)
          .then((res) => {
            if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
            return res;
          })
          .catch((err) => {
            if (req.mode === 'navigate') return cache.match('./').then((page) => page || Promise.reject(err));
            throw err;
          });
      })
    )
  );
});
