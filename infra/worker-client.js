/* aWardrobe infra: talks to the image worker. Sends a request, matches the reply by id, moves
   pixel buffers across without copying, and starts a fresh worker if the old one dies. */

export function createImageWorker() {
  let worker = null;
  let nextId = 1;
  const pending = new Map();
  let crashes = 0;
  const failAll = (err) => {
    for (const p of pending.values()) p.reject(err);
    pending.clear();
  };
  const start = () => {
    worker = new Worker(new URL('./image-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { id, ok, result, error, kind } = e.data || {};
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (ok) p.resolve(unpack(result));
      else {
        const err = new Error(error || 'The image worker failed.');
        err.name = kind === 'ImageError' ? 'ImageError' : 'WorkerError';
        p.reject(err);
      }
    };
    worker.onerror = (e) => {
      crashes++;
      const err = new Error('The image worker stopped: ' + ((e && e.message) || 'unknown error'));
      err.name = 'WorkerError';
      failAll(err);
      try {
        worker.terminate();
      } catch (x) {
        /* already gone */
      }
      worker = null;
    };
  };
  /* pixels come back as a bare array with a size; give callers an ImageData */
  const unpack = (r) => {
    if (r && r.rgba && r.width && r.height && !r.work) r.work = new ImageData(r.rgba, r.width, r.height);
    return r;
  };
  return {
    call(type, payload, transfer) {
      if (!worker) start();
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        try {
          worker.postMessage({ id, type, payload }, transfer || []);
        } catch (e) {
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
