/* aWardrobe ui: dates, money, temperatures and plurals, in British English. */
import { parseDay, dayDiff } from '../domain/model.js';

const fmt = (opts) => new Intl.DateTimeFormat('en-GB', opts);
const F = {
  long: fmt({ weekday: 'long', day: 'numeric', month: 'long' }),
  longYear: fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  short: fmt({ day: 'numeric', month: 'short' }),
  shortYear: fmt({ day: 'numeric', month: 'short', year: 'numeric' }),
  weekday: fmt({ weekday: 'long' }),
  weekdayShort: fmt({ weekday: 'short' }),
  monthYear: fmt({ month: 'long', year: 'numeric' })
};
export const fmtLong = (d) => F.long.format(d);
export const fmtLongYear = (d) => F.longYear.format(d);
export const fmtShort = (d) => F.short.format(d);
export const fmtShortYear = (d) => F.shortYear.format(d);
export const fmtWeekday = (d) => F.weekday.format(d);
export const fmtWeekdayShort = (d) => F.weekdayShort.format(d);
export const fmtMonthYear = (d) => F.monthYear.format(d);

/* "Today", "Yesterday", a weekday within six days either way, else the date. */
export function relativeDay(key, todayKey) {
  const diff = dayDiff(todayKey, key);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  const d = parseDay(key);
  if (diff >= -6 && diff <= 6) return fmtWeekday(d);
  return d.getFullYear() === parseDay(todayKey).getFullYear() ? fmtShort(d) : fmtShortYear(d);
}

export function money(n, symbol = '£') {
  if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '';
  const x = Number(n);
  const whole = Math.abs(x - Math.round(x)) < 0.005;
  const s = whole ? Math.round(x).toLocaleString('en-GB') : x.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return symbol + s;
}

export function temperature(celsius, unit = 'C') {
  if (celsius === null || celsius === undefined || isNaN(Number(celsius))) return '';
  const c = Number(celsius);
  return unit === 'F' ? Math.round((c * 9) / 5 + 32) + '°F' : Math.round(c) + '°C';
}

export const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');
/* a number of bytes in words a person reads: 1.4 MB, 12 MB, 2.1 GB, 850 KB */
export const bytesText = (n) => (n >= 1e9 ? (n / 1e9).toFixed(1) + ' GB' : n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + ' MB' : Math.round(n / 1e3) + ' KB');
