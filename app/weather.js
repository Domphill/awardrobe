/* aWardrobe app: the weather (FR-86 to FR-89, FR-95). Town search and the ten-day forecast from
   Open-Meteo through infra/net; the forecast is kept in meta under a key of the town's position
   and reused for three hours; when a fresh one cannot be fetched, the kept one is used up to a
   day old with a "from earlier" note, and after that the season stands in. Nothing is requested
   until a town has been set. One fetch runs at a time; a result for a town that is no longer
   set is dropped. Listeners hear when a fetch ends, well or badly, so screens can follow.
   The tests replace the two calls with a mock; nothing else changes. */
import { createNet, NetworkError } from '../infra/net.js';

const SEARCH_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
export const FRESH_MS = 3 * 3600 * 1000;
export const TOO_OLD_MS = 24 * 3600 * 1000;
export const FORECAST_DAYS = 10;

/* WMO weather codes to the handful of kinds the app knows */
export function kindOfCode(code) {
  const c = Number(code);
  if (c === 0) return 'clear';
  if (c === 1 || c === 2) return 'partly';
  if (c === 3) return 'cloudy';
  if (c === 45 || c === 48) return 'fog';
  if (c >= 51 && c <= 57) return 'drizzle';
  if (c >= 61 && c <= 67) return 'rain';
  if (c >= 71 && c <= 77) return 'snow';
  if (c >= 80 && c <= 82) return 'showers';
  if (c === 85 || c === 86) return 'snow';
  if (c >= 95) return 'thunder';
  return 'cloudy';
}

/* what Open-Meteo sends, checked before it is trusted: a day without a high is dropped,
   a payload without the arrays is a plain service error */
export function parseDaily(raw) {
  const d = raw && raw.daily;
  if (!d || !Array.isArray(d.time) || !Array.isArray(d.temperature_2m_max) || !Array.isArray(d.temperature_2m_min)) throw new NetworkError('The weather service sent something unexpected.', 'service');
  const num = (arr, i, fallback) => (Array.isArray(arr) && arr[i] !== null && arr[i] !== undefined && isFinite(Number(arr[i])) ? Number(arr[i]) : fallback);
  const days = [];
  for (let i = 0; i < d.time.length; i++) {
    const high = num(d.temperature_2m_max, i, null);
    if (high === null || typeof d.time[i] !== 'string') continue;
    days.push({ day: d.time[i], high, low: num(d.temperature_2m_min, i, high), rain: num(d.precipitation_probability_max, i, 0), kind: kindOfCode(num(d.weather_code, i, 3)), wind: num(d.wind_speed_10m_max, i, 0) });
  }
  return days;
}

export const positionKey = (place) => Number(place.latitude).toFixed(2) + ',' + Number(place.longitude).toFixed(2);

export function createWeather(app, net) {
  net = net || createNet();
  const records = app.records;
  let mock = null;
  let inflight = null;
  let inflightKey = null;
  let lastError = null;
  let memory = null;
  const requests = [];
  const listeners = new Set();
  const emit = () => {
    for (const fn of listeners) {
      try {
        fn();
      } catch (e) {
        /* a listener's fault is its own */
      }
    }
  };
  const regionOf = (r) => [r.admin1, r.country].filter(Boolean).join(', ');

  const mockOrNet = async (kind, url, mocked) => {
    requests.push({ kind, url });
    if (!mock) return net.getJson(url);
    if (mock.offline) throw new NetworkError("You're offline.", 'offline');
    if (mock.error) throw new NetworkError('The weather service did not answer (' + mock.error + ').', 'service');
    if (typeof mock.delay === 'number') await new Promise((r) => setTimeout(r, mock.delay));
    return mocked();
  };
  const fetchSearch = async (name) => {
    const url = SEARCH_URL + '?name=' + encodeURIComponent(name) + '&count=6&language=en&format=json';
    const raw = await mockOrNet('search', url, () => ({ results: (typeof mock.search === 'function' ? mock.search(name) : mock.search || []).map((x) => ({ name: x.name, admin1: x.region ? x.region.split(',')[0].trim() : '', country: x.region ? x.region.split(',').slice(1).join(',').trim() : '', latitude: x.latitude, longitude: x.longitude })) }));
    return (raw && Array.isArray(raw.results) ? raw.results : []).filter((r) => r && r.name && isFinite(Number(r.latitude)) && isFinite(Number(r.longitude))).map((r) => ({ name: String(r.name), region: regionOf(r), latitude: Number(r.latitude), longitude: Number(r.longitude) }));
  };
  const fetchForecast = async (place) => {
    /* the position to two places: a kilometre or so, all a forecast needs (FR-86, FR-95) */
    const url = FORECAST_URL + '?latitude=' + Number(place.latitude).toFixed(2) + '&longitude=' + Number(place.longitude).toFixed(2) + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=auto&forecast_days=' + FORECAST_DAYS;
    const raw = await mockOrNet('forecast', url, () => ({ mockDays: typeof mock.forecast === 'function' ? mock.forecast(place) : mock.forecast || [] }));
    if (raw && raw.mockDays) return raw.mockDays.map((d) => ({ day: d.day, high: d.high, low: d.low, rain: d.rain || 0, kind: d.kind || 'cloudy', wind: d.wind || 0 }));
    return parseDaily(raw);
  };
  const samePlace = (key) => {
    const p = app.prefs.get().place;
    return !!p && positionKey(p) === key;
  };

  const api = {
    requests,
    /* the tests' stand-in: { search, forecast, offline, error, delay } */
    useMock: (spec) => (mock = spec || null),
    get mocked() {
      return !!mock;
    },
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    search: (name) => fetchSearch(String(name || '').trim()),
    place: () => app.prefs.get().place || null,
    /* the kept forecast: the stored one, or this session's when storing it failed */
    cached() {
      const c = records.meta('weather', null);
      if (memory && (!c || c.key !== memory.key || Date.parse(c.at) < Date.parse(memory.at))) return memory;
      return c;
    },
    /* sets the town and forgets the old forecast; the new one is fetched behind and listeners
       hear when it lands (FR-86) */
    async setPlace(place) {
      await app.prefs.set({ place: { name: String(place.name), region: place.region || '', latitude: Number(place.latitude), longitude: Number(place.longitude) } });
      memory = null;
      lastError = null;
      await records.setMeta('weather', null);
      api.refresh({ force: true }).catch(() => {});
    },
    /* "Stop using the weather": the town and the kept forecast go, nothing more is sent (FR-86) */
    async clearPlace() {
      await app.prefs.set({ place: null });
      memory = null;
      lastError = null;
      await records.setMeta('weather', null);
      emit();
    },
    /* the forecast: the kept one while it is under three hours old, else a fresh one (FR-87).
       A fetch already running for the same town is shared; for another town, or when forced,
       a fresh one follows once it has settled, so a quick change of town never loses out. */
    refresh(opts) {
      opts = opts || {};
      const place = api.place();
      if (!place) return Promise.resolve(null);
      const key = positionKey(place);
      const c = api.cached();
      const age = c && c.key === key && c.at ? app.now().getTime() - Date.parse(c.at) : Infinity;
      if (!opts.force && age >= 0 && age < FRESH_MS) return Promise.resolve(c);
      if (inflight) {
        if (inflightKey === key && !opts.force) return inflight;
        return inflight.catch(() => null).then(() => api.refresh(opts));
      }
      inflightKey = key;
      inflight = (async () => {
        try {
          const days = await fetchForecast(place);
          if (!samePlace(key)) return null;
          const rec = { key, at: app.now().toISOString(), days };
          memory = rec;
          try {
            await records.setMeta('weather', rec);
          } catch (e) {
            /* kept in memory for this session; the next fetch tries the store again */
          }
          lastError = null;
          return rec;
        } catch (e) {
          if (samePlace(key)) lastError = e;
          throw e;
        } finally {
          inflight = null;
          inflightKey = null;
          emit();
        }
      })();
      return inflight;
    },
    /* what the screens show: the town, the usable days, where they came from, and any error */
    state() {
      const place = api.place();
      const c = place ? api.cached() : null;
      const key = place ? positionKey(place) : null;
      const age = c && c.key === key && c.at ? app.now().getTime() - Date.parse(c.at) : Infinity;
      const usable = !!(c && c.key === key && age < TOO_OLD_MS && Array.isArray(c.days));
      return {
        place,
        days: usable ? c.days : [],
        at: usable ? c.at : null,
        from: !place ? 'none' : usable ? (age < FRESH_MS ? 'fresh' : 'earlier') : 'none',
        error: lastError ? lastError.message : null,
        errorKind: lastError ? lastError.kind : null,
        tooOld: !!(place && c && c.key === key && !usable),
        fetching: !!inflight
      };
    },
    dayForecast(dayKey) {
      return api.state().days.find((d) => d.day === dayKey) || null;
    }
  };
  return api;
}
