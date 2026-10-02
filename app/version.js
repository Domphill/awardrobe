/* aWardrobe: the release version. Must match VERSION in sw.js; bumped on every release (NFR-35). */
export const VERSION = 'awardrobe-v2';
export const versionNumber = () => Number(/-v(\d+)$/.exec(VERSION)[1]);
