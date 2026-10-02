/* aWardrobe infra: talks to the image worker. Sends a request, matches the reply by id, moves
   pixel buffers across without copying, gives up on a request that takes too long, and starts a
   fresh worker if the old one dies or stalls (a phone can kill a worker without a word). */

const TIMEOUTS = { open: 20000, segment: 10000, finalize: 15000, finalizePhoto: 15000, default: 10000 };
const MAX_RESTARTS = 3;

export function createImageWorker() {
  let worker = null;
  let nextId = 1;
  const pending = new Map();
  let crashes = 0;
  const failAll = (err) => {
    for (const p of pending.values()) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    pending.clear();
  };
  const drop = (err) => {
    crashes++;
    failAll(err);
    try {
      if (worker) worker.terminate();
    } catch (x) {
      /* already gone */
    }
    worker = null;
  };
  const start = () => {
    worker = new Worker(new URL('./image-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { id, ok, result, error, kind } = e.data || {};
      const p = pending.get(id);
      if (!p) return;
      clearTimeout(p.timer);
      pending.delete(id);
      if (ok) p.resolve(unpack(result));
      else {
        const err = new Error(error || 'The image worker failed.');
        err.name = kind === 'ImageError' ? 'ImageError' : 'WorkerError';
        p.reject(err);
      }
    };
    worker.onerror = (e) => {
      const err = new Error('The image worker stopped: ' + ((e && e.message) || 'unknown error'));
      err.name = 'WorkerError';
      drop(err);
    };
    worker.onmessageerror = () => {
      const err = new Error('The image worker sent something that could not be read.');
      err.name = 'WorkerError';
      drop(err);
    };
  };
  /* pixels come back as a bare array with a size; give callers an ImageData */
  const unpack = (r) => {
    if (r && r.rgba && r.width && r.height && !r.work) r.work = new ImageData(r.rgba, r.width, r.height);
    return r;
  };
  return {
    call(type, payload, transfer, opts) {
      opts = opts || {};
      if (crashes >= MAX_RESTARTS && !worker) {
        const err = new Error('The image worker keeps failing on this device.');
        err.name = 'WorkerError';
        return Promise.reject(err);
      }
      if (!worker) start();
      const id = nextId++;
      const ms = opts.timeoutMs || TIMEOUTS[type] || TIMEOUTS.default;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          if (!pending.has(id)) return;
          pending.delete(id);
          const err = new Error('The image work took too long and was stopped.');
          err.name = 'WorkerError';
          reject(err);
          const rest = new Error('The image worker was restarted after a request took too long.');
          rest.name = 'WorkerError';
          drop(rest);
        }, ms);
        pending.set(id, { resolve, reject, timer });
        try {
          worker.postMessage({ id, type, payload }, transfer || []);
        } catch (e) {
          clearTimeout(timer);
          pending.delete(id);
          reject(e);
        }
      });
    },
    terminate() {
      if (worker) worker.terminate();
      worker = null;
      failAll(new Error('The image worker was closed.'));
    },
    get crashes() {
      return crashes;
    },
    get alive() {
      return !!worker;
    }
  };
}
