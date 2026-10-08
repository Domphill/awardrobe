/* aWardrobe: the release. VERSION must match sw.js and is bumped on every release (NFR-35); RELEASE
   is the name people see: "Version 1.0 (build 16)" on the More page. */
export const VERSION = 'awardrobe-v16';
export const RELEASE = '1.0';
export const versionNumber = () => Number(/-v(\d+)$/.exec(VERSION)[1]);
export const versionText = () => RELEASE + ' (build ' + versionNumber() + ')';
