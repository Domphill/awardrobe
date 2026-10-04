/* aWardrobe screen: the outfit builder (UC-3, UC-8; FR-64 to FR-74, FR-49). The canvas, the
   tool bar for the selected piece, Add pieces, Tidy layout, Mix and match, the details and
   Save. The session owns the state and the undo history; this screen draws and dispatches. */
import { h, btn, iconBtn, field, sheet, confirmSheet, toast, toggleChips, segmented, pic, clear } from '../components.js';
import { CATEGORIES, SEASONS, OCCASIONS, category, isGone } from '../../domain/model.js';
import { matchesQuery } from '../../domain/search.js';
import { createBuilderSession, builderDraftKey, TILT_STEP } from '../../app/builder-session.js';
import { ValidationError } from '../../app/garments.js';
import { createBuilderStage } from './builder/stage.js';
import { createMixer } from './builder/mixer.js';

let live = null;

export const outfitEdit = {
  name: 'build',
  render(root, arg, ctx) {
    const { app, router, shell } = ctx;
    const id = arg && arg !== 'new' ? arg : null;
    const existing = id ? app.records.get('outfits', id) : null;
    if (id && !existing) {
      root.appendChild(h('div.empty', h('h2', 'This outfit is no longer here'), btn('Go to Outfits', () => router.go('outfits', null, { replace: true }), { kind: 'primary' })));
      return;
    }
    const key = id || 'new';
    const inPlace = live && live.key === key && shell.current === 'build';
    if (!inPlace) {
      if (live) live.detach();
      live = createLive(ctx, key, existing);
    }
    live.mount(root);
  }
};

function createLive({ app, router, shell }, key, existing) {
  const session = createBuilderSession(app, { existing });
  const dkey = builderDraftKey(existing ? existing.id : null);
  let root = null;
  let els = {};
  let stage = null;
  let mixer = null;
  let saving = false;
  let offered = false;

  /* ---------- the draft ---------- */
  const draftFields = () => {
    const d = session.toDraft();
    return d ? Promise.resolve(d) : Promise.resolve(null);
  };
  const scheduleDraft = () => app.drafts.schedule(draftFields, dkey);
  const offerDraft = async () => {
    if (offered) return;
    offered = true;
    await app.drafts.flush(dkey);
    const d = await app.drafts.get(dkey);
    if (!d || (d.outfitId || null) !== (existing ? existing.id : null) || !root || !root.isConnected || session.state.dirty) return;
    const what = d.form && d.form.name ? '"' + d.form.name + '"' : existing ? 'this outfit' : 'the outfit you were building';
    const s = sheet({
      title: 'Carry on where you left off?',
      body: h('p.muted', 'You were working on ' + what + '. Carry on with it, or start afresh and let it go.'),
      actions: [
        btn('Start afresh', async () => {
          s.close();
          await app.drafts.clear(dkey);
        }, { kind: 'ghost' }),
        btn('Carry on', () => {
          s.close();
          session.fromDraft(d);
          fillForm();
          update();
        }, { kind: 'primary' })
      ]
    });
  };

  /* ---------- actions ---------- */
  const say = (r) => {
    if (r && r.nothing && r.message) toast(r.message);
    return r;
  };
  const edited = () => {
    scheduleDraft();
    update();
  };
  const selected = () => session.state.selectedId;
  const run = (action, arg) => {
    try {
      let r = null;
      if (action === 'undo') r = session.undo();
      else if (action === 'redo') r = session.redo();
      else if (action === 'tilt') r = session.tilt(selected(), arg);
      else if (action === 'angle') r = session.setAngle(selected(), arg);
      else if (action === 'mirror') r = session.mirror(selected());
      else if (action === 'layer') r = session.layer(selected(), arg);
      else if (action === 'takeOff') r = session.takeOff(selected());
      else if (action === 'tidy') r = say(session.tidy());
      else if (action === 'mix') r = say(session.openMixer());
      else if (action === 'slotTurn') r = say(session.slotTurn(arg.slotId, arg.dir));
      else if (action === 'slotAdd') r = say(session.slotAdd(arg));
      else if (action === 'slotRemove') r = session.slotRemove(arg);
      else if (action === 'shuffle') r = say(session.shuffle());
      else if (action === 'addPieces') r = say(session.addPieces(arg));
      else if (action === 'nudge') r = session.nudge(arg.id, arg.dx, arg.dy);
      edited();
      return r;
    } catch (e) {
      toast((e && e.message) || 'That did not work.');
      update();
      return null;
    }
  };
  const addPiecesSheet = () => {
    const wearable = app.records.list('garments').filter((g) => !isGone(g));
    if (!wearable.length) {
      const s = sheet({
        title: 'Add pieces',
        body: h('p', 'Your closet is empty. Add some clothes first, then build an outfit from them.'),
        actions: [btn('Cancel', () => s.close(), { kind: 'ghost' }), btn('Take a photo', () => {
          s.close();
          router.go('edit', 'new');
        }, { kind: 'primary', icon: 'camera' })]
      });
      return;
    }
    const onCanvas = new Set(session.state.pieces.map((p) => p.garmentId));
    const picked = new Set();
    let query = '';
    let cat = 'all';
    const list = h('div.pick-list');
    const count = h('span', 'Add');
    const addBtn = btn('Add', () => {
      s.close();
      run('addPieces', [...picked]);
    }, { kind: 'primary' });
    addBtn.replaceChild(count, addBtn.lastChild);
    const refresh = () => {
      clear(list);
      const shown = wearable.filter((g) => (cat === 'all' || g.category === cat) && (!query || matchesQuery(g, query))).sort((a, b) => (b.created || '').localeCompare(a.created || ''));
      if (!shown.length) list.appendChild(h('p.muted', 'Nothing matches.'));
      for (const g of shown) {
        const already = onCanvas.has(g.id);
        const item = h(
          'button.pick-item',
          { type: 'button', dataset: { id: g.id }, 'aria-pressed': String(picked.has(g.id)), disabled: already, onclick: () => {
            if (picked.has(g.id)) picked.delete(g.id);
            else picked.add(g.id);
            item.setAttribute('aria-pressed', String(picked.has(g.id)));
            count.textContent = picked.size ? 'Add ' + picked.size : 'Add';
            addBtn.disabled = !picked.size;
          } },
          pic(() => app.pictures.image(g.pictures && g.pictures.thumb, 'thumb'), { w: 72, h: 86, alt: g.name || g.type || '' }),
          h('span.pick-name', (g.name || g.type || 'Garment') + (already ? ' (on the canvas)' : ''))
        );
        list.appendChild(item);
      }
    };
    const cats = CATEGORIES.filter((c) => wearable.some((g) => g.category === c.key));
    const search = h('input.input#pick-search', { type: 'search', placeholder: 'Search', 'aria-label': 'Search your closet', oninput: () => {
      query = search.value;
      refresh();
    } });
    const seg = segmented({ name: 'pick-category', label: 'Category', value: 'all', options: [{ value: 'all', label: 'All' }].concat(cats.map((c) => ({ value: c.key, label: c.label }))), onChange: (v) => {
      cat = v;
      refresh();
    } });
    addBtn.disabled = true;
    const s = sheet({ title: 'Add pieces', wide: true, body: h('div.form', search, seg, list), actions: [btn('Cancel', () => s.close(), { kind: 'ghost' }), addBtn] });
    refresh();
  };

  /* ---------- saving and leaving ---------- */
  const save = async () => {
    if (saving) return;
    const { pieces, form } = session.finalize();
    const problems = app.outfits.validate(form, pieces);
    if (problems.length) {
      showProblems(problems);
      return;
    }
    saving = true;
    showProblems([]);
    update();
    let saved = null;
    try {
      saved = await app.outfits.save({ existing, form, pieces });
    } catch (e) {
      if (e instanceof ValidationError) showProblems(e.problems);
      else {
        scheduleDraft();
        await app.drafts.flush(dkey).catch(() => {});
        toast("That couldn't be saved. " + ((e && e.message) || ''));
      }
    } finally {
      saving = false;
      update();
    }
    if (!saved) return;
    try {
      await app.drafts.clear(dkey);
    } catch (e) {
      /* the outfit is saved; a draft that lingers is offered once */
    }
    drop();
    toast(existing ? 'Saved.' : 'Outfit saved.');
    if (saved.skipped && saved.skipped.length) toast('The picture of ' + saved.skipped.join(' and ') + " couldn't be read, so it was left out of the outfit picture.");
    router.go('outfit', saved.outfit.id, { replace: true });
  };
  const leave = async () => {
    if (session.state.dirty) {
      const ok = await confirmSheet({ title: existing ? 'Discard your changes?' : 'Discard this outfit?', body: 'Your unsaved changes will be lost.', confirm: 'Discard', cancel: 'Keep editing', danger: true });
      if (!ok) return;
    }
    await discard();
    router.back('outfits');
  };
  const discard = async () => {
    await app.drafts.clear(dkey);
    drop();
  };
  const detach = () => {
    const flushing = app.drafts.flush(dkey).catch(() => {});
    drop({ keepSession: true });
    flushing.then(() => session.close());
  };
  const drop = (opts) => {
    if (live === api) live = null;
    if (shell.builder === handle) shell.builder = null;
    if (shell.onLeave === detach) shell.onLeave = null;
    shell.onHide = null;
    app.drafts.onError = null;
    if (stage) stage.destroy();
    if (!(opts && opts.keepSession)) session.close();
  };
  const handle = {
    state: () => JSON.parse(JSON.stringify(session.state)),
    select: (pid) => {
      session.select(pid);
      update();
    },
    drag: (pid, dx, dy) => stage.drag(pid, dx, dy).then(() => edited()),
    resize: (pid, dx, dy) => stage.resize(pid, dx, dy).then(() => edited()),
    gesture: (pid, start, now) => stage.gesture(pid, start, now).then(() => edited()),
    tap: (pid) => stage.tap(pid),
    pieceRect: (pid) => stage.pieceRect(pid),
    stageRect: () => stage.rect(),
    addPieces: (ids) => run('addPieces', ids),
    tidy: () => run('tidy'),
    slotTurn: (slotId, dir) => run('slotTurn', { slotId, dir }),
    slotAdd: (cat) => run('slotAdd', cat),
    slotRemove: (slotId) => run('slotRemove', slotId),
    shuffle: () => run('shuffle'),
    undo: () => run('undo'),
    redo: () => run('redo'),
    discard
  };

  /* ---------- rendering ---------- */
  const mount = (r) => {
    root = r;
    els = {};
    shell.builder = handle;
    shell.onLeave = detach;
    shell.onHide = () => app.drafts.flush(dkey).catch(() => {});
    app.drafts.onError = () => toast("Your draft couldn't be kept. Save soon, or free some space on the phone.");
    els.undo = btn('Undo', () => run('undo'), { icon: 'undo', id: 'build-undo', small: true });
    els.redo = iconBtn('redo', 'Redo', () => run('redo'), { id: 'build-redo' });
    root.appendChild(h('div.page-top', iconBtn('back', 'Back', leave, { id: 'build-back' }), h('h1.title.small#build-title', existing ? existing.name || 'Outfit' : 'New outfit')));
    if (stage) stage.destroy();
    stage = createBuilderStage({ session, app, onSelect: () => update(), onNudge: (id, dx, dy) => run('nudge', { id, dx, dy }) });
    stage.el.appendChild(h('div.stage-tools', els.undo, els.redo));
    root.appendChild(stage.el);
    /* the tool bar for the selected piece (FR-64) */
    els.angle = h('input.input.angle#angle-value', { type: 'number', min: '-180', max: '180', step: '1', 'aria-label': 'Angle in degrees', onchange: () => run('angle', Number(els.angle.value)) });
    els.slider = h('input.slider#angle-slider', { type: 'range', min: '-180', max: '180', step: '1', 'aria-label': 'Angle', oninput: () => (els.angle.value = els.slider.value), onchange: () => run('angle', Number(els.slider.value)) });
    els.tools = h(
      'div.piece-tools',
      h('div.actions', btn('Tilt left', () => run('tilt', -TILT_STEP), { icon: 'undo', small: true, id: 'tilt-left' }), els.angle, btn('Tilt right', () => run('tilt', TILT_STEP), { icon: 'redo', small: true, id: 'tilt-right' }), btn('Mirror', () => run('mirror'), { small: true, id: 'mirror' })),
      h('div.slider-row', h('span.muted', 'Angle'), els.slider),
      h('div.actions', btn('Bring to front', () => run('layer', 'front'), { small: true, id: 'to-front' }), btn('Send to back', () => run('layer', 'back'), { small: true, id: 'to-back' }), btn('Take off', () => run('takeOff'), { small: true, icon: 'trash', id: 'take-off' }))
    );
    root.appendChild(els.tools);
    root.appendChild(h('div.actions', btn('Add pieces', addPiecesSheet, { kind: 'primary', icon: 'plus', id: 'add-pieces', small: true }), btn('Tidy layout', () => run('tidy'), { icon: 'grid', id: 'tidy', small: true }), btn('Mix and match', () => run('mix'), { icon: 'shuffle', id: 'mix', small: true })));
    mixer = createMixer({ session, app, run, router });
    root.appendChild(mixer.el);
    /* the details (FR-73) */
    els.name = h('input.input#o-name', { type: 'text', autocomplete: 'off', oninput: () => session.setForm({ name: els.name.value }) });
    els.favourite = iconBtn('star', 'Favourite', () => {
      session.setForm({ favourite: !session.state.form.favourite });
      els.favourite.setAttribute('aria-pressed', String(session.state.form.favourite));
      scheduleDraft();
    }, { id: 'o-favourite', pressed: session.state.form.favourite });
    els.seasons = toggleChips({ name: 'seasons', label: 'Seasons', values: SEASONS, selected: session.state.form.seasons, onChange: (v) => {
      session.setForm({ seasons: v });
      scheduleDraft();
    } });
    els.occasions = toggleChips({ name: 'occasions', label: 'Occasions', values: OCCASIONS, selected: session.state.form.occasions, onChange: (v) => {
      session.setForm({ occasions: v });
      scheduleDraft();
    } });
    root.appendChild(h('div.form', field('Name', els.name), field('Seasons', els.seasons), field('Occasions', els.occasions), h('div.actions', els.favourite, h('span.muted', 'Favourite'))));
    els.problems = h('div.problems#build-problems', { role: 'alert', hidden: true });
    root.appendChild(els.problems);
    root.appendChild(btn('Save outfit', save, { kind: 'primary', block: true, id: 'build-save' }));
    fillForm();
    update();
    if (!session.state.dirty) offerDraft();
  };
  const fillForm = () => {
    if (!els.name) return;
    const f = session.state.form;
    els.name.value = f.name || '';
    els.favourite.setAttribute('aria-pressed', String(!!f.favourite));
    for (const b of els.seasons.querySelectorAll('button')) b.setAttribute('aria-pressed', String((f.seasons || []).includes(b.dataset.value)));
    for (const b of els.occasions.querySelectorAll('button')) b.setAttribute('aria-pressed', String((f.occasions || []).includes(b.dataset.value)));
  };
  const showProblems = (problems) => {
    clear(els.problems);
    els.problems.hidden = !problems.length;
    if (problems.length) els.problems.appendChild(h('ul', problems.map((p) => h('li', p))));
  };
  const update = () => {
    if (!root || !stage || !stage.el.isConnected) return;
    const s = session.state;
    stage.render();
    mixer.render();
    const p = s.selectedId ? s.pieces.find((q) => q.id === s.selectedId) : null;
    els.tools.classList.toggle('dim', !p);
    for (const b of els.tools.querySelectorAll('button, input')) b.disabled = !p || saving;
    if (p && document.activeElement !== els.angle) els.angle.value = String(p.rot);
    if (p) els.slider.value = String(p.rot);
    els.undo.lastChild.textContent = s.labels.undo || 'Undo';
    els.undo.setAttribute('aria-label', s.labels.undo || 'Undo');
    els.undo.setAttribute('aria-disabled', String(!s.labels.undo || saving));
    els.redo.setAttribute('aria-label', s.labels.redo || 'Redo');
    els.redo.title = s.labels.redo || 'Redo';
    els.redo.setAttribute('aria-disabled', String(!s.labels.redo || saving));
    if (!s.nameChosen && els.name && document.activeElement !== els.name) els.name.value = s.form.name || '';
  };
  session.on(() => update());
  const api = { key, mount, detach, discard, session };
  return api;
}
void category;
