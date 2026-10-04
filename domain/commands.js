/* aWardrobe domain: the command stack behind undo and redo (FR-45, FR-46, FR-72; architecture
   6.3). A command is { label, bytes, run(), undo(), redo()?, extend()?, release()? }: run does it,
   undo reverses it, redo repeats it (run again when absent), extend adds to a stroke still in
   progress, release frees an undo record that the budget drops. The stack keeps up to 50 commands
   and 40 MB of records, never fewer than 20 steps while the records fit in memory at all. Pure. */

export const COMMAND_LIMIT = 50;
export const BYTE_BUDGET = 40 * 1024 * 1024;
export const MIN_STEPS = 20;

export function createStack() {
  const done = [];
  const undone = [];
  const release = (cmd) => {
    if (typeof cmd.release === 'function') cmd.release();
  };
  const trim = () => {
    while (done.length > COMMAND_LIMIT || (api.bytes > BYTE_BUDGET && done.length > MIN_STEPS)) release(done.shift());
  };
  const api = {
    get length() {
      return done.length;
    },
    get bytes() {
      return done.reduce((s, c) => s + (c.bytes || 0), 0) + undone.reduce((s, c) => s + (c.bytes || 0), 0);
    },
    get canUndo() {
      return done.length > 0;
    },
    get canRedo() {
      return undone.length > 0;
    },
    get latest() {
      return done.length ? done[done.length - 1] : null;
    },
    apply(cmd) {
      cmd.run();
      for (const c of undone) release(c);
      undone.length = 0;
      done.push(cmd);
      trim();
      return cmd;
    },
    /* a stroke grows while the finger is down: more points, one command, one undo step */
    extend(cmd, more) {
      if (api.latest !== cmd) throw new Error('Only the latest command can be extended.');
      cmd.extend(more);
      trim();
      return cmd;
    },
    undo() {
      const cmd = done.pop();
      if (!cmd) return false;
      cmd.undo();
      undone.push(cmd);
      return true;
    },
    redo() {
      const cmd = undone.pop();
      if (!cmd) return false;
      if (typeof cmd.redo === 'function') cmd.redo();
      else cmd.run();
      done.push(cmd);
      return true;
    },
    /* "Undo crop", "Redo brush stroke" (FR-46) */
    labels() {
      return { undo: done.length ? 'Undo ' + done[done.length - 1].label : null, redo: undone.length ? 'Redo ' + undone[undone.length - 1].label : null };
    },
    clear() {
      for (const c of done) release(c);
      for (const c of undone) release(c);
      done.length = 0;
      undone.length = 0;
    }
  };
  return api;
}

/* A command for a small JSON state (the outfit builder, FR-72): `get()` gives the state object,
   `set(next)` replaces it, `change()` makes the change. The records are the state before and
   after, so undo and redo land exactly on them. */
export function jsonCommand(label, get, set, change) {
  const before = JSON.stringify(get());
  let after = null;
  return {
    label,
    bytes: before.length * 2,
    run() {
      if (after === null) {
        change();
        after = JSON.stringify(get());
        this.bytes = (before.length + after.length) * 2;
      } else set(JSON.parse(after));
    },
    undo() {
      set(JSON.parse(before));
    },
    redo() {
      set(JSON.parse(after));
    }
  };
}
