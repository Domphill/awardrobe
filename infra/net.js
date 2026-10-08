/* aWardrobe infra: the one door to the network (FR-95, NFR-1 to NFR-4). Only Open-Meteo's two
   addresses are ever requested, over https, with a time limit; anything else is refused before
   a request is made. The browser's content security policy says the same thing a second time. */
export const ALLOWED = ['https://api.open-meteo.com', 'https://geocoding-api.open-meteo.com'];
export const TIMEOUT_MS = 8000;

export class NetworkError extends Error {
  constructor(message, kind) {
    super(message);
    this.name = 'NetworkError';
    this.kind = kind || 'network';
  }
}

export function allowedUrl(url) {
  try {
    const u = new URL(String(url));
    return u.protocol === 'https:' && ALLOWED.includes(u.origin);
  } catch (e) {
    return false;
  }
}

export function createNet(opts) {
  opts = opts || {};
  const fetchImpl = opts.fetchImpl || ((url, o) => fetch(url, o));
  const timeout = opts.timeout || TIMEOUT_MS;
  return {
    async getJson(url) {
      if (!allowedUrl(url)) throw new NetworkError('That address is not allowed.', 'notAllowed');
      if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new NetworkError("You're offline.", 'offline');
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout);
      let res;
      try {
        res = await fetchImpl(url, { signal: ctrl.signal, cache: 'no-store', mode: 'cors', credentials: 'omit' });
      } catch (e) {
        if (ctrl.signal.aborted) throw new NetworkError('The weather service took too long to answer.', 'timeout');
        throw new NetworkError("The weather service couldn't be reached.", 'offline');
      } finally {
        clearTimeout(timer);
      }
      if (!res || !res.ok) throw new NetworkError('The weather service did not answer' + (res && res.status ? ' (' + res.status + ')' : '') + '.', 'service');
      try {
        return await res.json();
      } catch (e) {
        throw new NetworkError('The weather service sent something unexpected.', 'service');
      }
    }
  };
}
