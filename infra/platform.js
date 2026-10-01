/* aWardrobe infra: what this browser and device can do. */
export const env = {
  ios: /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  standalone: window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true,
  local: location.hostname === 'localhost' || location.hostname === '127.0.0.1',
  secure: location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1',
  serviceWorker: 'serviceWorker' in navigator,
  broadcast: typeof BroadcastChannel === 'function'
};
