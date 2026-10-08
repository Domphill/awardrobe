/* aWardrobe infra: files in and out (architecture section 9; FR-100, FR-101). A backup is handed
   to the share sheet on an iPhone (Files, Drive, AirDrop…) and saved as a download elsewhere; a
   file to restore comes from the browser's own chooser. Nothing here reads a file whole: callers
   slice it. The tests stand in for both sheets through `useMock`, so none ever opens. */
import { env } from './platform.js';

export function createFiles() {
  let mock = null;
  const download = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    /* the browser streams the file from the blob; the link can go once that has started */
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 120000);
    return 'saved';
  };
  return {
    useMock(m) {
      mock = m || null;
    },
    get mocked() {
      return !!mock;
    },
    /* 'saved'; 'cancelled' when the sheet was dismissed; 'blocked' when the browser wants the
       save to start from a tap of its own (call again from one) */
    async save(blob, name) {
      if (mock) {
        if (mock.save === 'cancel') return 'cancelled';
        if (mock.save === 'block' && !mock.blockedOnce) {
          mock.blockedOnce = true;
          return 'blocked';
        }
        (mock.saved = mock.saved || []).push({ name, blob });
        return 'saved';
      }
      if (env.ios && navigator.canShare && typeof File === 'function') {
        const file = new File([blob], name, { type: blob.type || 'application/zip' });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: name });
            return 'saved';
          } catch (e) {
            if (e && e.name === 'AbortError') return 'cancelled';
            if (e && e.name === 'NotAllowedError') return 'blocked';
            /* anything else: the download below */
          }
        }
      }
      return download(blob, name);
    },
    /* the chosen file, or null when the chooser is dismissed */
    pick(accept) {
      if (mock) return Promise.resolve(typeof mock.pick === 'function' ? mock.pick() : null);
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept || '';
        input.style.display = 'none';
        let done = false;
        const finish = (file) => {
          if (done) return;
          done = true;
          input.remove();
          resolve(file || null);
        };
        input.addEventListener('change', () => finish(input.files && input.files[0]));
        input.addEventListener('cancel', () => finish(null));
        document.body.appendChild(input);
        input.click();
      });
    }
  };
}
