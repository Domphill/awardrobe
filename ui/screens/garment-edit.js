/* aWardrobe screen: add or edit a garment (FR-20 to FR-32, FR-45, FR-46, FR-48 to FR-50,
   FR-53 to FR-62). The photo box with the preview, the strength tape, whole photo, the colours,
   the type guess and the details form. The editing tools arrive with the next milestone; the
   tool bar is their place, with Move selected. */
import { h, btn, iconBtn, field, sheet, confirmSheet, toast, chip, toggleChips, clear } from '../components.js';
import { icon } from '../icons.js';
import { CATEGORIES, SEASONS, OCCASIONS, category } from '../../domain/model.js';
import { SWATCHES } from '../../domain/colour/naming.js';
import { createSession } from '../../app/editor-session.js';
import { suggestName, ValidationError } from '../../app/garments.js';

const TOOLS = [['move', 'Move'], ['wand', 'Wand'], ['select', 'Select'], ['paint', 'Paint'], ['eraser', 'Eraser'], ['restore', 'Restore'], ['rotate', 'Rotate'], ['crop', 'Crop'], ['dropper', 'Dropper']];
const WARN_PALE = 'This garment and its background look alike (pale on pale), so the cut-out may be rough. A darker background helps, or use the Select brush when the editing tools arrive.';
const WARN_WHOLE = 'The whole photo was kept, because the cut-out would have removed almost everything or almost nothing. You can try another strength or keep it as it is.';
const MAX_COLOURS = 3;
const lowerType = (t) => (/^[A-Z][a-z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t);

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
  const chosen = { category: !!existing, type: !!existing, name: !!(existing && existing.name) };
  let root = null;
  let els = {};
  let saving = false;
  let touched = false;
  let offered = false;

  /* ---------- the draft ---------- */
  const draftFields = async () => {
    const pic = await session.toDraft(app.drafts);
    if (!pic && !touched) return null;
    return Object.assign({ garmentId: existing ? existing.id : null, form: JSON.parse(JSON.stringify(form)), chosen: Object.assign({}, chosen) }, pic || {});
  };
  const scheduleDraft = () => app.drafts.schedule(draftFields);
  const offerDraft = async () => {
    if (offered) return;
    offered = true;
    await app.drafts.flush();
    const d = await app.drafts.get();
    if (!d || (d.garmentId || null) !== (existing ? existing.id : null) || !root || !root.isConnected) return;
    const what = d.form && d.form.name ? '"' + d.form.name + '"' : 'the garment you were adding';
    const s = sheet({
      title: 'Carry on where you left off?',
      body: h('p.muted', 'You were working on ' + what + '. Carry on with it, or start afresh and let it go.'),
      actions: [
        btn('Start afresh', async () => {
          s.close();
          await app.drafts.clear();
        }, { kind: 'ghost' }),
        btn('Carry on', async () => {
          s.close();
          try {
            Object.assign(form, d.form || {});
            Object.assign(chosen, d.chosen || {});
            if (d.photo) await session.fromDraft(d);
            touched = true;
            fillForm();
            update();
          } catch (e) {
            toast("The draft couldn't be opened. " + ((e && e.message) || ''));
          }
        }, { kind: 'primary' })
      ]
    });
  };

  /* ---------- the photo ---------- */
  const open = async (file) => {
    if (!file) return;
    try {
      await session.open(file);
    } catch (e) {
      update();
      return;
    }
    applyGuess();
    scheduleDraft();
    update();
  };
  const applyGuess = () => {
    const g = session.state.guess;
    if (g) {
      if (!chosen.category) {
        form.category = g.category;
        if (!chosen.type) form.type = g.type;
      } else if (!chosen.type && g.category === form.category) form.type = g.type;
    }
    if (!form.colours.length || !touched) form.colours = session.state.colours.slice(0, MAX_COLOURS);
    suggest();
    fillForm();
  };
  const suggest = () => {
    if (chosen.name) return;
    form.name = suggestName(form.colours, form.type);
    if (els.name) els.name.value = form.name;
  };
  const differentPhoto = async () => {
    if (session.state.dirty) {
      const ok = await confirmSheet({ title: 'Start again with a different photo?', body: 'The cut-out you have changed will be dropped. Your details stay.', confirm: 'Different photo', cancel: 'Cancel' });
      if (!ok) return;
    }
    session.reset();
    update();
  };

  /* ---------- saving and leaving ---------- */
  const save = async () => {
    if (saving) return;
    const hasPhoto = !!session.state.work || !!(existing && existing.pictures && existing.pictures.cutout && !session.state.work);
    const problems = app.garments.validate(form, hasPhoto);
    if (problems.length) {
      showProblems(problems);
      return;
    }
    saving = true;
    showProblems([]);
    setBusy('Saving…');
    try {
      const result = session.state.work ? await session.finalize() : null;
      const { garment, warning } = await app.garments.save({ existing, form, result });
      await app.drafts.clear();
      drop();
      toast(existing ? 'Saved.' : 'Added to your closet.');
      if (warning) toast(warning);
      router.go('garment', garment.id, { replace: true });
    } catch (e) {
      if (e instanceof ValidationError) showProblems(e.problems);
      else {
        /* the draft goes to disk first, so the message is true when it shows */
        app.drafts.schedule(draftFields);
        await app.drafts.flush();
        toast("That couldn't be saved. " + ((e && e.message) || ''));
      }
    } finally {
      saving = false;
      setBusy(null);
    }
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
    await app.drafts.clear();
    drop();
  };
  /* the screen is left for another: keep the draft, let the live state go */
  const detach = () => {
    app.drafts.flush().catch(() => {});
    drop();
  };
  const drop = () => {
    if (live === api) live = null;
    if (shell.pickPhoto === pickPhoto) shell.pickPhoto = null;
    if (shell.editor === editorHandle) shell.editor = null;
    if (shell.onLeave === detach) shell.onLeave = null;
    shell.onHide = null;
  };
  const pickPhoto = (file) => open(file);
  const editorHandle = {
    state: () => session.state,
    setStrength: async (v) => {
      await session.setStrength(v);
      touched = true;
      scheduleDraft();
      update();
    },
    undo: async () => {
      session.undo();
      update();
    },
    redo: async () => {
      session.redo();
      update();
    },
    discard
  };

  /* ---------- rendering ---------- */
  const mount = (r) => {
    root = r;
    els = {};
    shell.pickPhoto = pickPhoto;
    shell.editor = editorHandle;
    shell.onLeave = detach;
    shell.onHide = () => app.drafts.flush().catch(() => {});
    const title = existing ? 'Edit garment' : 'Add a garment';
    els.undo = btn('Undo strength', editorHandle.undo, { kind: 'ghost', icon: 'undo', id: 'edit-undo', small: true });
    els.redo = iconBtn('redo', 'Redo strength', editorHandle.redo, { id: 'edit-redo' });
    root.appendChild(h('div.page-top', iconBtn('back', 'Back', leave, { id: 'edit-back' }), h('h1.title.small#edit-title', title), h('div.actions', els.undo, els.redo)));
    /* the stage */
    els.canvas = h('canvas#stage-canvas', { 'aria-hidden': 'true' });
    els.fileCamera = h('input#file-camera', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true, onchange: (e) => open(e.target.files && e.target.files[0]) });
    els.fileLibrary = h('input#file-library', { type: 'file', accept: 'image/*', hidden: true, onchange: (e) => open(e.target.files && e.target.files[0]) });
    els.stageEmpty = h('div.stage-empty', icon('camera'), h('p', existing ? 'Take or choose a new photo to replace this one, or keep it as it is.' : 'Lay the garment flat on a plain background, like a bed sheet or a wall, and photograph it from above.'), h('div.actions.center', btn('Take a photo', () => els.fileCamera.click(), { kind: 'primary', icon: 'camera', id: 'photo-take' }), btn('Choose a photo', () => els.fileLibrary.click(), { icon: 'image', id: 'photo-choose' })));
    els.busy = h('div.stage-busy', { role: 'status', 'aria-live': 'polite', hidden: true }, h('div.spinner'), h('span'));
    els.stage = h('div.stage#stage', els.canvas, els.stageEmpty, els.busy, els.fileCamera, els.fileLibrary);
    root.appendChild(els.stage);
    els.warning = h('div.warning#edit-warning', { role: 'status', hidden: true });
    root.appendChild(els.warning);
    /* the strength tape */
    els.strength = h('input.tape#strength', { type: 'range', min: '0', max: '100', step: '1', value: String(session.state.strength), 'aria-label': 'Cut-out strength, from keep more to remove more', oninput: () => (els.strengthValue.textContent = els.strength.value), onchange: () => editorHandle.setStrength(els.strength.value) });
    els.strengthValue = h('b', String(session.state.strength));
    root.appendChild(h('div.tape-wrap', h('div.tape-labels', h('span', 'Keep more'), h('span', 'Cut-out strength ', els.strengthValue), h('span', 'Remove more')), els.strength));
    /* the tools */
    els.tools = h('div.tools', { role: 'radiogroup', 'aria-label': 'Tools' }, TOOLS.map(([k, label]) => h('button.tool', { type: 'button', role: 'radio', dataset: { tool: k }, 'aria-checked': String(k === 'move'), disabled: k !== 'move', title: k === 'move' ? 'Move: look around the picture' : label + ' arrives with the editing tools update' }, icon(k), h('span', label))));
    root.appendChild(els.tools);
    root.appendChild(h('p.fineprint', 'Move only looks. Wand, Select, Paint and the other tools arrive with the next update; until then you can change the strength, take a different photo, or keep the whole photo.'));
    els.whole = h('input#whole-photo', { type: 'checkbox', onchange: () => {
      session.setWholePhoto(els.whole.checked);
      touched = true;
      scheduleDraft();
      update();
    } });
    root.appendChild(h('label.check', els.whole, h('span', 'Keep the whole photo instead')));
    els.actions = h('div.edit-actions', btn(existing ? 'New photo' : 'Different photo', differentPhoto, { icon: 'image', id: 'photo-different' }), btn('Colours again', async () => {
      await session.redetect();
      form.colours = session.state.colours.slice(0, MAX_COLOURS);
      suggest();
      update();
    }, { icon: 'refresh', id: 'colours-again' }));
    root.appendChild(els.actions);
    /* colours and the guess */
    els.colours = h('div.colour-chips#edit-colours');
    root.appendChild(field('Colours, main colour first', h('div.form', els.colours, h('div.actions', btn('Add a colour', addColour, { small: true, icon: 'plus', id: 'colour-add' })))));
    els.guess = h('p.guess#guess', { hidden: true });
    root.appendChild(els.guess);
    /* the form */
    buildForm();
    els.problems = h('div.problems#problems', { role: 'alert', hidden: true });
    root.appendChild(els.problems);
    root.appendChild(btn(existing ? 'Save changes' : 'Add to closet', save, { kind: 'primary', block: true, id: 'edit-save' }));
    update();
    if (!existing) offerDraft();
    else if (!session.state.work) drawExisting();
  };

  const buildForm = () => {
    const onInput = (k, el) => () => {
      form[k] = el.value;
      touched = true;
      scheduleDraft();
    };
    els.name = h('input.input#f-name', { type: 'text', value: form.name, autocomplete: 'off', oninput: () => {
      form.name = els.name.value;
      /* any edit of the name, even clearing it, means the suggestion stops (FR-58) */
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
        h('div.form-grid', h('div.wide', field('Name', els.name)), field('Category', els.category), field('Type', h('div', els.type, els.types), 'Pick one, or type your own'), field('Brand', els.brand), field('Size', els.size), field('Price (' + prefs.currency + ')', els.price), field('Date bought', els.bought)),
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
    const s = sheet({
      title: 'Add a colour',
      body: h('div.swatch-grid', Object.entries(SWATCHES).map(([name, hex]) => h('button.swatch', { type: 'button', dataset: { name }, onclick: () => {
        s.close();
        if (form.colours.length >= MAX_COLOURS) {
          toast('Up to three colours. Remove one first.');
          return;
        }
        form.colours.push({ name, hex });
        touched = true;
        suggest();
        scheduleDraft();
        renderColours();
      } }, h('span.swatch-dot', { style: { background: hex } }), h('span', name))))
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
                touched = true;
                suggest();
                scheduleDraft();
                renderColours();
              }, { cls: 'chip-main' })
            : null,
          iconBtn('x', 'Remove ' + c.name, () => {
            form.colours.splice(i, 1);
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
      if (!img || session.state.work || !els.canvas.isConnected) return;
      paint(img);
      els.stage.classList.toggle('checker', !existing.cutout || existing.cutout.kind !== 'photo');
      els.stageEmpty.classList.add('over');
    } catch (e) {
      /* the picture stays blank; the buttons still work */
    }
  };
  const paint = (img) => {
    const box = els.stage.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(box.width * dpr));
    const H = Math.max(1, Math.round(box.height * dpr));
    if (els.canvas.width !== W || els.canvas.height !== H) {
      els.canvas.width = W;
      els.canvas.height = H;
    }
    const ctx = els.canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    if (!img) {
      delete els.canvas.dataset.ready;
      return;
    }
    const k = Math.min(W / img.width, H / img.height) * 0.96;
    const w = img.width * k;
    const hh = img.height * k;
    ctx.drawImage(img, (W - w) / 2, (H - hh) / 2, w, hh);
    els.canvas.dataset.ready = '1';
  };
  const update = () => {
    if (!root || !els.stage) return;
    const st = session.state;
    const has = !!st.work;
    paint(has ? session.preview() : null);
    els.stage.classList.toggle('checker', has && !st.wholePhoto);
    els.stageEmpty.hidden = has;
    if (!has && existing) drawExisting();
    setBusy(st.busy);
    const warnings = [];
    if (st.error) warnings.push(st.error);
    if (has && st.lowContrast) warnings.push(WARN_PALE);
    if (has && st.autoWhole) warnings.push(WARN_WHOLE);
    els.warning.hidden = !warnings.length;
    els.warning.textContent = warnings.join(' ');
    els.strength.value = String(st.strength);
    els.strengthValue.textContent = String(st.strength);
    els.strength.disabled = !has || st.status !== 'ready' || st.choice === true;
    els.undo.disabled = !session.undoLabel;
    els.redo.disabled = !session.redoLabel;
    els.whole.checked = !!st.wholePhoto;
    els.whole.disabled = !has;
    for (const b of els.tools.querySelectorAll('.tool')) if (b.dataset.tool !== 'move') b.disabled = true;
    els.actions.hidden = !has && !existing;
    const g = st.guess;
    els.guess.hidden = !g;
    if (g) els.guess.textContent = 'Looks like ' + category(g.category).label.toLowerCase() + ', ' + lowerType(g.type) + ': ' + g.why + '.' + (g.votes ? ' (' + g.votes + ' of ' + g.of + ' similar garments agree.)' : '');
    renderColours();
  };
  session.on(() => update());

  const api = { key, mount, detach, discard, session };
  return api;
}
