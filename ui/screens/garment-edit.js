/* aWardrobe screen: add or edit a garment, with the editor (FR-19 to FR-62). The stage with the
   one coordinate mapping, the tool bar and its options, the strength tape, whole photo, colours,
   the type guess and the details form; drafts per garment; redo from the reduced original. */
import { h, btn, iconBtn, field, sheet, confirmSheet, toast, toggleChips, segmented, clear } from '../components.js';
import { icon } from '../icons.js';
import { CATEGORIES, SEASONS, OCCASIONS, category } from '../../domain/model.js';
import { SWATCHES, nameColour } from '../../domain/colour/naming.js';
import { createSession, rgbToHex } from '../../app/editor-session.js';
import { draftKey } from '../../app/drafts.js';
import { suggestName, ValidationError } from '../../app/garments.js';
import { createStage } from './editor/stage.js';
import { createTools } from './editor/tools.js';
import { askGone } from './gone.js';

const WARN_PALE = 'This garment and its background look alike (pale on pale), so the cut-out may be rough. A darker background helps, or brush over the garment with Select and keep only that.';
const WARN_WHOLE = 'The whole photo was kept, because the cut-out would have removed almost everything or almost nothing. You can try another strength or keep it as it is.';
const WARN_EMPTY = 'At this strength almost everything is removed. Move the strength towards keep more, or tick keep the whole photo.';
const WARN_FULL = 'At this strength almost nothing is removed. Move the strength towards remove more.';
const MAX_COLOURS = 3;
const NO_ARTICLE = ['Bottoms', 'Shoes', 'Outerwear', 'Jewellery'];
const withArticle = (one) => (NO_ARTICLE.includes(one) ? one.toLowerCase() : (/^[aeiou]/i.test(one) ? 'an ' : 'a ') + one.toLowerCase());
const guessLine = (g) => {
  const kind = withArticle(category(g.category).one) + ' (' + g.type + ')';
  if (g.votes) return 'Looks like ' + kind + ', ' + g.why + ' (' + g.votes + ' of ' + g.of + ' similar garments agree).';
  return 'Looks like ' + kind + ', going by ' + g.why + '.';
};
const STROKE_MODES = { eraser: 'erase', restore: 'restore', select: 'select' };

const emptyForm = () => ({ name: '', category: 'tops', type: '', brand: '', size: '', price: '', bought: '', seasons: [], occasions: [], notes: '', favourite: false, colours: [] });
const formOf = (g) => ({ name: g.name || '', category: g.category || 'other', type: g.type || '', brand: g.brand || '', size: g.size || '', price: g.price === null || g.price === undefined ? '' : String(g.price), bought: g.bought || '', seasons: (g.seasons || []).slice(), occasions: (g.occasions || []).slice(), notes: g.notes || '', favourite: !!g.favourite, colours: (g.colours || []).map((c) => ({ name: c.name, hex: c.hex })) });

/* the live editing state, kept across re-renders of this screen; dropped on save or discard */
let live = null;

export const garmentEdit = {
  name: 'edit',
  render(root, arg, ctx) {
    const { app, router, shell } = ctx;
    const id = arg && arg !== 'new' ? arg : null;
    const existing = id ? app.records.get('garments', id) : null;
    if (id && !existing) {
      root.appendChild(h('div.empty', h('h2', 'This garment is no longer here'), btn('Go to Closet', () => router.go('closet', null, { replace: true }), { kind: 'primary' })));
      return;
    }
    const key = id || 'new';
    const inPlace = live && live.key === key && shell.current === 'edit';
    if (!inPlace) {
      if (live) live.detach();
      live = createLive(ctx, key, existing);
    }
    live.mount(root);
  }
};

function createLive({ app, router, shell }, key, existing) {
  const session = createSession(app);
  const form = existing ? formOf(existing) : emptyForm();
  const chosen = { category: !!existing, type: !!existing, name: !!(existing && existing.name), colours: !!(existing && existing.colours && existing.colours.length) };
  const dkey = draftKey(existing ? existing.id : null);
  let root = null;
  let els = {};
  let stage = null;
  let tools = null;
  let saving = false;
  let touched = false;
  let offered = false;
  let keyHooked = false;
  let bgChoice = 'checker';

  /* ---------- the draft ---------- */
  const draftFields = async () => {
    const pic = await session.toDraft(app.drafts);
    if (!pic && !touched) return null;
    return Object.assign({ garmentId: existing ? existing.id : null, form: JSON.parse(JSON.stringify(form)), chosen: Object.assign({}, chosen) }, pic || {});
  };
  const scheduleDraft = () => app.drafts.schedule(draftFields, dkey);
  const offerDraft = async () => {
    if (offered) return;
    offered = true;
    await app.drafts.flush(dkey);
    const d = await app.drafts.get(dkey);
    if (!d || (d.garmentId || null) !== (existing ? existing.id : null) || !root || !root.isConnected || session.state.work || session.state.status !== 'empty') return;
    const what = d.form && d.form.name ? '"' + d.form.name + '"' : existing ? 'this garment' : 'the garment you were adding';
    const s = sheet({
      title: 'Carry on where you left off?',
      body: h('p.muted', 'You were working on ' + what + '. Carry on with it, or start afresh and let it go.'),
      actions: [
        btn('Start afresh', async () => {
          s.close();
          await app.drafts.clear(dkey);
        }, { kind: 'ghost' }),
        btn('Carry on', async () => {
          s.close();
          try {
            Object.assign(form, d.form || {});
            Object.assign(chosen, d.chosen || {});
            if (d.photo) {
              await session.fromDraft(d);
              stage.setStatic(null);
            }
            touched = true;
            fillForm();
            tools.setTool(session.state.tool || 'move');
            update();
          } catch (e) {
            toast("The draft couldn't be opened. " + ((e && e.message) || ''));
          }
        }, { kind: 'primary' })
      ]
    });
  };

  /* ---------- the photo ---------- */
  const busyNow = () => session.state.status === 'opening' || session.state.status === 'cutting' || !!session.state.busy || saving;
  const open = async (file) => {
    if (!file || busyNow()) return;
    stage.setStatic(null);
    try {
      /* the setting on the More page: a new photo kept whole, the cut-out made in the background
         for the day the box is unticked (FR-50) */
      await session.open(file, app.prefs.get().autoCutout === false ? { seed: { wholePhoto: true } } : {});
    } catch (e) {
      update();
      return;
    }
    tools.setTool('move');
    applyGuess();
    scheduleDraft();
    update();
  };
  const onPick = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    open(file);
  };
  const applyGuess = () => {
    const g = session.state.guess;
    if (g) {
      if (!chosen.category) {
        form.category = g.category;
        if (!chosen.type) form.type = g.type;
      } else if (!chosen.type && g.category === form.category) form.type = g.type;
    }
    if (!chosen.colours) form.colours = session.state.colours.slice(0, MAX_COLOURS);
    suggest();
    fillForm();
  };
  const suggest = () => {
    if (chosen.name) return;
    form.name = suggestName(form.colours, form.type);
    if (els.name) els.name.value = form.name;
  };
  const differentPhoto = async () => {
    if (busyNow()) return;
    if (session.state.dirty) {
      const ok = await confirmSheet({ title: 'Start again with a different photo?', body: 'The cut-out you have changed will be dropped. Your details stay.', confirm: 'Different photo', cancel: 'Cancel' });
      if (!ok) return;
    }
    chosen.colours = false;
    session.reset();
    stage.setStatic(null);
    tools.setTool('move');
    update();
  };
  /* the reduced original of a saved garment opened in the editor (FR-31): either carrying on with
     the saved cut-out (its alpha put back in place, strength and brush fixes kept) or redoing the
     automatic cut-out afresh */
  const openOriginal = async (carryOn) => {
    if (!existing || !existing.pictures || !existing.pictures.original || busyNow()) return;
    const rec = await app.pictures.record(existing.pictures.original);
    if (!rec) {
      toast('The reduced original of this garment could not be found.');
      return;
    }
    let seed = null;
    if (carryOn && existing.cutout) {
      if (existing.cutout.kind === 'photo') seed = { wholePhoto: true, strength: existing.cutout.strength };
      else {
        const cut = await app.pictures.record(existing.pictures.cutout);
        seed = cut && cut.alpha ? { alpha: cut.alpha, box: existing.cutout.box, work: existing.cutout.work, strength: existing.cutout.strength } : null;
      }
    }
    stage.setStatic(null);
    let opened = null;
    try {
      opened = await session.openFromPicture(rec, seed ? { seed } : {});
    } catch (e) {
      update();
      return;
    }
    tools.setTool('move');
    if (carryOn && !(opened && opened.seeded)) toast('The cut-out was made again from the original at its saved strength; the brush fixes from before could not be placed.');
    if (!carryOn || !(opened && opened.seeded)) {
      chosen.colours = false;
      applyGuess();
    }
    scheduleDraft();
    update();
  };
  const redoFromOriginal = () => openOriginal(false);
  const editCutout = () => openOriginal(true);

  /* ---------- the tools ---------- */
  const say = (r) => {
    if (r && r.nothing && r.message) toast(r.message);
    return r;
  };
  const edited = () => {
    touched = true;
    scheduleDraft();
    update();
  };
  const run = async (action, arg) => {
    if (!session.state.work) return null;
    try {
      return await perform(action, arg);
    } catch (e) {
      toast((e && e.message) || 'That did not work.');
      update();
      return null;
    }
  };
  const perform = async (action, arg) => {
    let r = null;
    if (action === 'undo') r = await session.undo();
    else if (action === 'redo') r = await session.redo();
    else if (action === 'rotate') r = say(await session.rotate(arg));
    else if (action === 'mirror') r = say(await session.mirror());
    else if (action === 'crop') {
      r = say(await session.crop(stage.getCropBox()));
      if (r && !r.nothing) {
        stage.resetCropBox();
        tools.setTool('move');
      }
    } else if (action === 'selectApply') r = say(await session.selectApply(arg));
    else if (action === 'skin') {
      r = say(await session.skin());
      if (r && !r.nothing) toast('Removed skin from about ' + Math.max(1, Math.round((r.removedShare || 0) * 100)) + '% of the cut-out.');
    } else if (action === 'cutAgain') r = say(await session.cutAgain());
    else if (action === 'wandTap') r = say(await session.wand(arg.x, arg.y));
    else if (action === 'whole') r = say(await session.setWholePhoto(arg));
    if (r && !r.nothing) edited();
    else update();
    return r;
  };
  const handlers = {
    strokeBegin(points, radius) {
      const tool = session.state.tool;
      const mode = tool === 'paint' ? session.state.options.paintMode : STROKE_MODES[tool];
      if (!mode) return null;
      return session.beginStroke(mode, points, radius).then(
        (r) => {
          if (r && r.nothing && r.message) toast(r.message);
          return r;
        },
        (e) => toast((e && e.message) || 'That stroke did not work.')
      );
    },
    /* a two-finger twist in the Rotate tool: the angle lands in the tool's own controls and is
       applied when the tool is left, like the slider */
    rotateTo: (deg) => tools.setOption('angle', deg),
    strokeMove: (points) => session.strokeMore(points).catch((e) => toast((e && e.message) || 'That stroke did not work.')),
    strokeEnd: () =>
      session.endStroke().then(
        (r) => {
          edited();
          return r;
        },
        (e) => {
          toast((e && e.message) || 'That stroke did not work.');
          update();
        }
      ),
    async tap(p) {
      const st = session.state;
      if (!st.work || p.x < 0 || p.y < 0 || p.x >= st.width || p.y >= st.height) return null;
      if (st.tool === 'wand') return busyNow() ? null : run('wandTap', p);
      if (st.tool === 'dropper') return dropper(p);
      return null;
    }
  };
  /* the Dropper (FR-42): a colour from the photo for the garment's colours or the paint brush */
  const dropper = (p) => {
    const rgb = session.colourAt(p.x, p.y);
    if (!rgb) return null;
    const hex = rgbToHex(rgb);
    if (session.state.options.dropperTarget === 'paint') {
      session.setPaintColour(hex);
      tools.refresh();
      toast('Paint colour set to ' + nameColour(rgb).toLowerCase() + '.');
    } else {
      if (form.colours.length >= MAX_COLOURS) form.colours.pop();
      form.colours.push({ name: nameColour(rgb), hex });
      chosen.colours = true;
      suggest();
      edited();
      toast('Added ' + nameColour(rgb) + ' to the colours.');
    }
    return hex;
  };

  /* ---------- saving and leaving ---------- */
  const save = async () => {
    if (saving || busyNow()) return;
    const hasPhoto = !!session.state.work || !!(existing && existing.pictures && existing.pictures.cutout);
    const problems = app.garments.validate(form, hasPhoto);
    if (problems.length) {
      showProblems(problems);
      return;
    }
    saving = true;
    showProblems([]);
    setBusy('Saving…');
    let saved = null;
    try {
      if (session.state.tool === 'rotate') await tools.setTool('move');
      const result = session.state.work ? await session.finalize() : null;
      saved = await app.garments.save({ existing, form, result });
    } catch (e) {
      if (e instanceof ValidationError) showProblems(e.problems);
      else {
        app.drafts.schedule(draftFields, dkey);
        await app.drafts.flush(dkey);
        toast("That couldn't be saved. " + ((e && e.message) || ''));
      }
    } finally {
      saving = false;
      setBusy(null);
    }
    if (!saved) return;
    try {
      await app.drafts.clear(dkey);
    } catch (e) {
      /* the garment is saved; a draft that lingers is offered once and can be started afresh */
    }
    drop();
    toast(existing ? 'Saved.' : 'Added to your closet.');
    if (saved.warning) toast(saved.warning);
    if (existing && router.depth > 0) router.back();
    else router.go('garment', saved.garment.id, { replace: true });
  };
  const leave = async () => {
    if (session.state.work || touched) {
      const ok = await confirmSheet({ title: existing ? 'Discard your changes?' : 'Discard this garment?', body: 'Your unsaved changes will be lost.', confirm: 'Discard', cancel: 'Keep editing', danger: true });
      if (!ok) return;
    }
    await discard();
    router.back('closet');
  };
  const discard = async () => {
    await app.drafts.clear(dkey);
    drop();
  };
  const detach = () => {
    /* the draft is built from the session, so the session is closed only once it is written */
    const flushing = app.drafts.flush(dkey).catch(() => {});
    drop({ keepSession: true });
    flushing.then(() => session.close());
  };
  const onKey = (e) => {
    if (document.querySelector('.sheet-wrap')) return;
    if (tools && tools.key(e)) e.preventDefault();
  };
  const drop = (opts) => {
    if (live === api) live = null;
    app.drafts.onError = null;
    if (shell.pickPhoto === pickPhoto) shell.pickPhoto = null;
    if (shell.editor === editorHandle) shell.editor = null;
    if (shell.onLeave === detach) shell.onLeave = null;
    shell.onHide = null;
    if (keyHooked) {
      document.removeEventListener('keydown', onKey);
      keyHooked = false;
    }
    if (stage) stage.destroy();
    if (!(opts && opts.keepSession)) session.close();
  };
  const pickPhoto = (file) => open(file);
  const editorHandle = {
    state: () => Object.assign({}, session.state, { zoom: stage ? stage.viewport.zoomLevel : 1, showingOriginal: stage ? stage.state.showingOriginal : false }),
    viewport: () => stage.viewport,
    stageRect: () => stage.rect(),
    zoom: (level, cx, cy) => stage.setZoom(level, cx, cy),
    tool: (name) => tools.setTool(name),
    tap: (ix, iy) => stage.simulateTap(ix, iy),
    stroke: (points) => stage.simulateStroke(points),
    lastPoints: () => stage.lastPoints,
    strokeLatencies: () => stage.takeLatencies(),
    option: (k, v) => tools.setOption(k, v),
    cropBox: (box) => (box ? stage.setCropBox(box) : stage.getCropBox()),
    pressOriginal: (on) => stage.showOriginal(on),
    openFromOriginal: redoFromOriginal,
    editCutout,
    crashTools: () => session.crashTools(),
    setStrength: async (v) => {
      say(await session.setStrength(v));
      edited();
    },
    undo: () => run('undo'),
    redo: () => run('redo'),
    discard
  };

  /* ---------- rendering ---------- */
  const mount = (r) => {
    root = r;
    els = {};
    shell.pickPhoto = pickPhoto;
    shell.editor = editorHandle;
    shell.onLeave = detach;
    shell.onHide = () => app.drafts.flush(dkey).catch(() => {});
    app.drafts.onError = () => toast("Your draft couldn't be kept. Save soon, or free some space on the phone.");
    if (!keyHooked) {
      document.addEventListener('keydown', onKey);
      keyHooked = true;
    }
    const title = existing ? 'Edit garment' : 'Add a garment';
    root.appendChild(h('div.page-top', iconBtn('back', 'Back', leave, { id: 'edit-back' }), h('h1.title.small#edit-title', title)));
    /* the stage */
    if (stage) stage.destroy();
    stage = createStage({ session, handlers });
    tools = createTools({ session, stage, run });
    /* never disabled: a tap on a disabled button is handed to the stage underneath, where two
       quick taps zoomed and a brush left a dot (found on the phone); a tap with nothing to do says so */
    els.undo = btn('Undo', () => (session.undoLabel && !busyNow() ? run('undo') : toast(busyNow() ? 'One moment, the photo is still being worked on.' : 'Nothing to undo.')), { icon: 'undo', id: 'edit-undo', small: true });
    els.redo = iconBtn('redo', 'Redo', () => (session.redoLabel && !busyNow() ? run('redo') : toast(busyNow() ? 'One moment, the photo is still being worked on.' : 'Nothing to redo.')), { id: 'edit-redo' });
    els.fileCamera = h('input#file-camera', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true, onchange: onPick });
    els.fileLibrary = h('input#file-library', { type: 'file', accept: 'image/*', hidden: true, onchange: onPick });
    els.take = btn('Take a photo', () => els.fileCamera.click(), { kind: 'primary', icon: 'camera', id: 'photo-take' });
    els.choose = btn('Choose a photo', () => els.fileLibrary.click(), { icon: 'image', id: 'photo-choose' });
    const hasOriginal = !!(existing && existing.pictures && existing.pictures.original);
    els.editCutout = hasOriginal ? btn('Edit the cut-out', editCutout, { kind: 'primary', icon: 'edit', id: 'edit-cutout' }) : null;
    if (hasOriginal) {
      els.take = btn('Take a photo', () => els.fileCamera.click(), { icon: 'camera', id: 'photo-take', small: true });
      els.choose = btn('Choose a photo', () => els.fileLibrary.click(), { icon: 'image', id: 'photo-choose', small: true });
    }
    els.stageEmpty = h(
      'div.stage-empty',
      icon('camera'),
      h('p', existing ? (hasOriginal ? 'Carry on with this cut-out, or replace the photo.' : 'Take or choose a new photo to replace this one, or keep it as it is.') : 'Lay the garment flat on a plain background, like a bed sheet or a wall, and photograph it from above.'),
      els.editCutout ? h('div.actions.center', els.editCutout) : null,
      h('div.actions.center', els.take, els.choose)
    );
    els.busy = h('div.stage-busy', { role: 'status', 'aria-live': 'polite', hidden: true }, h('div.spinner'), h('span'));
    /* on the picture itself, so a phone shows the button and the picture at once (FR-47) */
    els.showOriginal = btn('Hold to see original', () => {}, { icon: 'eye', id: 'show-original', small: true });
    els.stage = stage.el;
    els.stage.append(els.stageEmpty, h('div.stage-tools', els.undo, els.redo), h('div.stage-hold', els.showOriginal), els.busy, els.fileCamera, els.fileLibrary);
    root.appendChild(els.stage);
    els.warning = h('div.warning#edit-warning', { role: 'status', hidden: true });
    root.appendChild(els.warning);
    if (existing && existing.pictures && !existing.pictures.original) root.appendChild(h('p.fineprint#edit-original-note', 'This garment came over without its original photo, so a fresh cut-out needs a new photo.'));
    /* the strength tape */
    els.strength = h('input.tape#strength', { type: 'range', min: '0', max: '100', step: '1', value: String(session.state.strength), 'aria-label': 'Cut-out strength, from keep more to remove more', oninput: () => (els.strengthValue.textContent = els.strength.value), onchange: () => editorHandle.setStrength(els.strength.value) });
    els.strengthValue = h('b', String(session.state.strength));
    root.appendChild(h('div.tape-wrap', h('div.tape-labels', h('span', 'Keep more'), h('span', 'Cut-out strength ', els.strengthValue), h('span', 'Remove more')), h('div.tape-scale', { 'aria-hidden': 'true' }, ['0', '25', '50', '75', '100'].map((n) => h('span', n))), els.strength));
    /* the tools */
    root.appendChild(tools.bar);
    root.appendChild(tools.help);
    root.appendChild(tools.options);
    const hold = (on) => () => stage.showOriginal(on);
    els.showOriginal.addEventListener('pointerdown', hold(true));
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) els.showOriginal.addEventListener(ev, hold(false));
    els.showOriginal.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        stage.showOriginal(true);
      }
    });
    els.showOriginal.addEventListener('keyup', hold(false));
    els.bg = segmented({ name: 'stage-bg', label: 'Background', value: bgChoice, options: [{ value: 'checker', label: 'Checks' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }], onChange: (v) => {
      bgChoice = v;
      update();
    } });
    root.appendChild(h('div.edit-row', btn('Remove skin', () => run('skin'), { small: true, id: 'remove-skin' }), btn('Cut out again', () => run('cutAgain'), { small: true, id: 'cut-again' }), btn('Colours again', async () => {
      if (busyNow()) return;
      await session.redetect();
      chosen.colours = false;
      form.colours = session.state.colours.slice(0, MAX_COLOURS);
      suggest();
      update();
    }, { icon: 'refresh', id: 'colours-again', small: true }), els.bg));
    els.whole = h('input#whole-photo', { type: 'checkbox', onchange: () => run('whole', els.whole.checked) });
    els.different = btn(existing ? 'New photo' : 'Different photo', differentPhoto, { icon: 'image', id: 'photo-different', small: true });
    els.redoOriginal = existing && existing.pictures && existing.pictures.original ? btn('Redo the cut-out', redoFromOriginal, { icon: 'refresh', id: 'redo-original', small: true }) : null;
    els.gone = existing && existing.status !== 'gone' ? btn('Gone from closet', async () => {
      if (busyNow()) return;
      if (session.state.work || touched) {
        const sure = await confirmSheet({ title: 'Discard your changes?', body: 'Your unsaved changes will be lost. Save them first if you want to keep them.', confirm: 'Discard', cancel: 'Keep editing', danger: true });
        if (!sure) return;
      }
      const ok = await askGone(app, existing);
      if (!ok) return;
      await discard();
      router.back('closet');
    }, { icon: 'upload', id: 'edit-gone', small: true }) : null;
    els.actions = h('div.edit-actions', h('label.check', els.whole, h('span', 'Keep the whole photo instead')), els.different, els.redoOriginal, els.gone);
    root.appendChild(els.actions);
    /* colours and the guess */
    els.colours = h('div.colour-chips#edit-colours');
    root.appendChild(field('Colours, main colour first', h('div.form', els.colours, h('div.actions', btn('Add a colour', addColour, { small: true, icon: 'plus', id: 'colour-add' })))));
    els.guess = h('p.guess#guess', { hidden: true });
    root.appendChild(els.guess);
    buildForm();
    els.problems = h('div.problems#problems', { role: 'alert', hidden: true });
    root.appendChild(els.problems);
    root.appendChild(btn(existing ? 'Save changes' : 'Add to closet', save, { kind: 'primary', block: true, id: 'edit-save' }));
    stage.layout();
    update();
    if (!session.state.work) {
      if (existing) drawExisting();
      offerDraft();
    }
  };

  const buildForm = () => {
    const onInput = (k, el) => () => {
      form[k] = el.value;
      touched = true;
      scheduleDraft();
    };
    els.name = h('input.input#f-name', { type: 'text', value: form.name, autocomplete: 'off', oninput: () => {
      form.name = els.name.value;
      chosen.name = true;
      touched = true;
      scheduleDraft();
    } });
    els.category = h('select.input#f-category', { onchange: () => {
      form.category = els.category.value;
      chosen.category = true;
      form.type = '';
      chosen.type = false;
      els.type.value = '';
      fillTypes();
      suggest();
      touched = true;
      scheduleDraft();
    } }, CATEGORIES.map((c) => h('option', { value: c.key, selected: c.key === form.category }, c.label)));
    els.types = h('datalist#types');
    els.type = h('input.input#f-type', { type: 'text', list: 'types', value: form.type, autocomplete: 'off', oninput: () => {
      form.type = els.type.value;
      chosen.type = els.type.value.trim() !== '';
      suggest();
      touched = true;
      scheduleDraft();
    } });
    els.brand = h('input.input#f-brand', { type: 'text', value: form.brand, autocomplete: 'off' });
    els.brand.addEventListener('input', onInput('brand', els.brand));
    els.size = h('input.input#f-size', { type: 'text', value: form.size, autocomplete: 'off' });
    els.size.addEventListener('input', onInput('size', els.size));
    els.price = h('input.input#f-price', { type: 'text', inputmode: 'decimal', value: form.price, autocomplete: 'off' });
    els.price.addEventListener('input', onInput('price', els.price));
    els.bought = h('input.input#f-bought', { type: 'date', value: form.bought });
    els.bought.addEventListener('input', onInput('bought', els.bought));
    els.bought.addEventListener('change', onInput('bought', els.bought));
    els.notes = h('textarea.input#f-notes', { rows: '3', value: form.notes });
    els.notes.addEventListener('input', onInput('notes', els.notes));
    els.favourite = iconBtn('star', 'Favourite', () => {
      form.favourite = !form.favourite;
      els.favourite.setAttribute('aria-pressed', String(form.favourite));
      touched = true;
      scheduleDraft();
    }, { id: 'f-favourite', pressed: form.favourite });
    const prefs = app.prefs.get();
    root.appendChild(
      h(
        'div.form',
        h('div.form-grid', h('div.wide', field('Name', els.name)), field('Category', els.category), h('div', field('Type', els.type, 'Pick one, or type your own'), els.types), field('Brand', els.brand), field('Size', els.size), field('Price (' + prefs.currency + ')', els.price), field('Date bought', els.bought)),
        field('Seasons', toggleChips({ name: 'seasons', label: 'Seasons', values: SEASONS, selected: form.seasons, onChange: (v) => {
          form.seasons = v;
          touched = true;
          scheduleDraft();
        } })),
        field('Occasions', toggleChips({ name: 'occasions', label: 'Occasions', values: OCCASIONS, selected: form.occasions, onChange: (v) => {
          form.occasions = v;
          touched = true;
          scheduleDraft();
        } })),
        field('Notes', els.notes),
        h('div.actions', els.favourite, h('span.muted', 'Favourite'))
      )
    );
    fillTypes();
  };
  const fillTypes = () => {
    clear(els.types);
    for (const t of category(form.category).types) els.types.appendChild(h('option', { value: t }));
  };
  const fillForm = () => {
    if (!els.name) return;
    els.name.value = form.name;
    els.category.value = form.category;
    els.type.value = form.type;
    els.brand.value = form.brand;
    els.size.value = form.size;
    els.price.value = form.price;
    els.bought.value = form.bought;
    els.notes.value = form.notes;
    els.favourite.setAttribute('aria-pressed', String(!!form.favourite));
    for (const b of root.querySelectorAll('[data-field="seasons"] button')) b.setAttribute('aria-pressed', String(form.seasons.includes(b.dataset.value)));
    for (const b of root.querySelectorAll('[data-field="occasions"] button')) b.setAttribute('aria-pressed', String(form.occasions.includes(b.dataset.value)));
    fillTypes();
  };
  const showProblems = (problems) => {
    clear(els.problems);
    els.problems.hidden = !problems.length;
    if (problems.length) els.problems.appendChild(h('ul', problems.map((p) => h('li', p))));
  };
  const setBusy = (text) => {
    if (!els.busy) return;
    els.busy.hidden = !text;
    els.busy.lastChild.textContent = text || '';
  };
  const addColour = () => {
    tools.pickPalette((hex, name) => {
      if (form.colours.length >= MAX_COLOURS) {
        toast('Up to three colours. Remove one first.');
        return;
      }
      form.colours.push({ name, hex });
      chosen.colours = true;
      touched = true;
      suggest();
      scheduleDraft();
      renderColours();
    });
  };
  const renderColours = () => {
    clear(els.colours);
    if (!form.colours.length) els.colours.appendChild(h('span.muted', session.state.work ? 'No colours found. Add one.' : 'The colours are read from the photo.'));
    form.colours.forEach((c, i) => {
      els.colours.appendChild(
        h(
          'span.colour-chip',
          { dataset: { index: String(i) } },
          h('span.swatch-dot', { style: { background: c.hex } }),
          h('span.colour-name', c.name),
          i > 0
            ? iconBtn('pin', 'Make ' + c.name + ' the main colour', () => {
                form.colours.splice(i, 1);
                form.colours.unshift(c);
                chosen.colours = true;
                touched = true;
                suggest();
                scheduleDraft();
                renderColours();
              }, { cls: 'chip-main' })
            : null,
          iconBtn('x', 'Remove ' + c.name, () => {
            form.colours.splice(i, 1);
            chosen.colours = true;
            touched = true;
            suggest();
            scheduleDraft();
            renderColours();
          }, { cls: 'chip-remove' })
        )
      );
    });
  };
  const drawExisting = async () => {
    if (!existing || !existing.pictures) return;
    try {
      const img = await app.pictures.image(existing.pictures.cutout, 'full');
      if (!img || session.state.work || !stage.el.isConnected) return;
      stage.setStatic(img);
      update();
    } catch (e) {
      /* the picture stays blank; the buttons still work */
    }
  };
  const update = () => {
    if (!root || !els.stage || !els.stage.isConnected) return;
    const st = session.state;
    const has = !!st.work;
    const busy = busyNow();
    const showingStatic = !has && !!stage.state.staticImage;
    stage.setBackground(has && st.wholePhoto ? 'plain' : showingStatic && existing && existing.cutout && existing.cutout.kind === 'photo' ? 'plain' : bgChoice);
    stage.draw();
    els.stageEmpty.hidden = has;
    els.stageEmpty.classList.toggle('over', showingStatic);
    setBusy(st.busy || (saving ? 'Saving…' : null));
    const warnings = [];
    if (st.error) warnings.push(st.error);
    if (has && st.lowContrast) warnings.push(WARN_PALE);
    if (has && st.autoWhole) warnings.push(WARN_WHOLE);
    if (has && !st.autoWhole && !st.wholePhoto && st.extreme === 'empty') warnings.push(WARN_EMPTY);
    if (has && !st.autoWhole && !st.wholePhoto && st.extreme === 'full') warnings.push(WARN_FULL);
    els.warning.hidden = !warnings.length;
    els.warning.textContent = warnings.join(' ');
    els.strength.value = String(st.strength);
    els.strengthValue.textContent = String(st.strength);
    els.strength.disabled = !has || busy || st.choice === true;
    els.undo.lastChild.textContent = session.undoLabel || 'Undo';
    els.undo.setAttribute('aria-label', session.undoLabel || 'Undo');
    els.undo.setAttribute('aria-disabled', String(busy || !session.undoLabel));
    els.redo.setAttribute('aria-label', session.redoLabel || 'Redo');
    els.redo.title = session.redoLabel || 'Redo';
    els.redo.setAttribute('aria-disabled', String(busy || !session.redoLabel));
    els.whole.checked = !!st.wholePhoto;
    els.whole.disabled = !has || busy;
    els.take.disabled = busy;
    els.choose.disabled = busy;
    els.different.disabled = busy;
    if (els.redoOriginal) els.redoOriginal.disabled = busy;
    if (els.editCutout) els.editCutout.disabled = busy;
    for (const b of root.querySelectorAll('#remove-skin, #cut-again, #colours-again, #show-original')) b.disabled = busy || !has;
    tools.disable(!has);
    els.actions.hidden = !has && !existing;
    const g = st.guess;
    els.guess.hidden = !g;
    if (g) els.guess.textContent = guessLine(g);
    renderColours();
  };
  session.on(() => update());

  const api = { key, mount, detach, discard, session };
  return api;
}
