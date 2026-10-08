# aWardrobe: Architecture and Design

Phase 3 of 5. Draft 1, written 1 October 2026, approved 1 October 2026 together with the "Pattern paper" design direction in the mockups. Builds on `01-requirements.md` (Draft 2) and `02-use-cases.md`. Draft 5 (3 October 2026) records milestone 4, the editor as built, in notes marked *(Draft 5:)* in sections 6.1 to 6.5. Draft 6 (4 October 2026) records milestone 5, the outfit builder as built, in notes marked *(Draft 6:)* in sections 2, 3.5 and 7. Draft 7 (5 October 2026) records milestone 6, the calendar, wear logging, gone and Stats as built, in notes marked *(Draft 7:)* in sections 2 and 3.3. Draft 8 (6 October 2026) records milestone 7, the weather and ideas as built, in notes marked *(Draft 8:)* in sections 2 and 8.

## 0. How to read this

- This document says how the app is built: which parts there are, what each part is allowed to talk to, how data is stored, how a photo becomes a cut-out, how editing and undo work, how errors are handled, and what speed and size the design is built to hit. It names the requirement (FR-n, NFR-n) each decision serves.
- The mockups for the new look are a separate page, `docs/mockups/aWardrobe-mockups.html`, with screenshots alongside it: `directions.png` (the three directions), `screen-closet.png`, `screen-garment.png`, `screen-editor.png`, `screen-builder.png`, `screen-week.png`, `screen-stats.png`, and `screen-closet-dark.png` and `screen-editor-dark.png` for dark mode. Section 14 summarises the design direction; the mockups show it.
- Technical words get a one-line explanation the first time they appear, and section 17 collects them.
- Section 15 lists the alternatives I considered and rejected, and section 16 the decisions you can overturn.

## 1. The shape of the app

aWardrobe is a single web page that behaves like an app. It is made of plain JavaScript files loaded as modules (files that say what they import, so the browser loads them in order with no build step). There are four layers, and code may only call downwards:

- **ui**: what you see and touch. Screens, components, the editor's drawing. Contains no image maths and never talks to storage directly.
- **app**: the use cases. "Add a garment", "save an outfit", "log a day", "make a backup". Holds the editor and builder sessions (their state and their undo history) and talks to the worker.
- **domain**: pure logic. Colour naming, segmentation, geometry, suggestions, cost per wear, the backup file format, migration. No screen, no storage, no network. Every function here can be tested by calling it with plain values.
- **infra**: the outside world. The database, the Web Worker (a background thread), the network call to Open-Meteo, saving and picking files, decoding photos.

```
            ┌───────────────┐
            │      ui/      │   screens and components: DOM and canvas drawing only
            └───────┬───────┘
                    │ calls
                    ▼
            ┌───────────────┐
            │     app/      │   use cases, editor and builder sessions, drafts, pictures cache
            └───┬───────┬───┘
     uses pure  │       │ uses
     functions  ▼       ▼
     ┌─────────────┐  ┌─────────────┐
     │   domain/   │◄─│   infra/    │   database, worker, network, files, photo decoding
     └─────────────┘  └─────────────┘
     pure maths and rules: no DOM, no storage, no network
```

The rules, which a test enforces by reading every file's import lines (NFR-37):

1. `domain` imports nothing outside `domain`. So image maths cannot touch storage.
2. `ui` imports `app` and `domain`, never `infra`. So the UI cannot contain image maths that reaches the database, and cannot call the network.
3. `app` imports `domain` and `infra`.
4. `infra` may import `domain` only because the worker file is in `infra` and runs the `domain/image` code. It never imports `app` or `ui`.
5. Nothing imports `ui` except `main.js`.

## 2. Modules

One file, one responsibility. File names are final unless Phase 5 finds a reason to split one.

### 2.1 ui/

| File | Responsibility |
|---|---|
| `ui/shell.js` | The frame around every screen: tab bar, top bar, theme, toasts, bottom sheets, the per-screen error catch (FR-115), the "new version" notice (FR-114), the memory-only banner (FR-113). |
| `ui/router.js` | Which screen is open and with what argument, from the address hash (`#/garment/g_…`); back behaviour; "See day" links (FR-83). |
| `ui/components.js` | The building blocks: `h()` to make elements, buttons, chips, fields, pickers, sheets, confirmations, the busy indicator, `pic()` for lazily drawn pictures, a keyed list patcher so lists update without flicker. |
| `ui/icons.js` | The app's icons as inline SVG. |
| `ui/format.js` | Dates, money, temperatures and plurals in British English (NFR-32). |
| `ui/screens/home.js` | Today's weather, the reason line, suited outfits, the idea with its three buttons (FR-90). *(Draft 8:)* a card the Closet renders at its top, plus the weather icon and thumbnail helpers the calendar shares. |
| `ui/screens/closet.js` | Cards, count, search, category chips, sort, filters, the gone list at `#/closet/gone` (FR-1 to FR-9). |
| `ui/screens/garment.js` | The garment page (FR-10 to FR-19). |
| `ui/screens/garment-edit.js` | The add/edit screen: photo box, the editor, the details form (FR-20, FR-59 to FR-62). |
| `ui/screens/editor/stage.js` | The editor's drawing: view canvas, work canvas, overlay, checkerboard; turns pointer events into image coordinates using the one mapping function; zoom and pan gestures (FR-32 to FR-34). |
| `ui/screens/editor/tools.js` | The tool palette and each tool's option panel: strength tape, brush sizes, wand slider, rotate controls, crop handles, paint colour (FR-35 to FR-48). |
| `ui/screens/outfits.js` | The outfits list (FR-63). |
| `ui/screens/builder/stage.js` | The outfit canvas: pieces as elements with transforms, one-finger drag and resize, two-finger twist and pinch, selection (FR-64, FR-65). |
| `ui/screens/builder/mixer.js` | Mix and match: the revolver per slot with previous and next visible, add and remove slots, shuffle (FR-68 to FR-70). |
| `ui/screens/calendar.js` | Month grid, day sheet, the "This week" view, the passed-plan question (FR-78 to FR-85). |
| `ui/screens/stats.js` | Stats (FR-96 to FR-99). |
| `domain/stats.js` | *(Draft 7)* The Stats page's maths, pure: the four numbers, most worn, not worn in 90 days, cost per wear best and worst (unworn as one wear), the closet by category and by main colour (FR-96 to FR-98). |
| `ui/screens/gone.js` | *(Draft 7)* The "Gone from closet" sheet (reason, date), shared by the garment page and the edit screen (FR-14). |
| `ui/screens/more.js` | Backup, restore, import, weather, appearance, storage, about, delete everything (FR-100 to FR-112). |
| `ui/screens/welcome.js` | First open (FR-109). |
| `ui/tokens.css`, `ui/base.css`, `ui/components.css`, `ui/screens.css` | The design system: tokens (colours, type, spacing, radii, motion), base styles, components, screens. Light and dark. |

### 2.2 app/

| File | Responsibility |
|---|---|
| `app/records.js` | Keeps every garment, outfit and day record in memory after boot, writes changes through the database, and announces changes so screens refresh. |
| `app/garments.js` | Add, change, delete, mark gone, bring back; turns an editor session's result into a saved garment with its three pictures in one transaction (FR-61); redo from the reduced original (FR-31). |
| `app/outfits.js` | Save with the rendered picture, delete with the day rule (FR-74, FR-77). |
| `app/days.js` | Log and plan; the wear map (wears and last worn per garment and outfit); the passed-plan question (FR-80, FR-81). *(Draft 7:)* log, remove, note, an outfit's wears, the days of a month, and the passed-plan answers (asked, confirmed, dropped); the garment wear map stays in `app/garments.js` (`stats()` over `wearStats`). |
| `app/ideas.js` | Builds the day's context from the forecast or the season and asks `domain/suggest` for ideas; "another idea" with a fresh seed (FR-89 to FR-94). |
| `app/weather.js` | Town search, forecast fetch, the three-hour cache, offline behaviour (FR-86 to FR-89, FR-95). |
| `app/editor-session.js` | The editor's state: opens a photo in the worker, sends commands, receives previews, tracks undo and redo labels, keeps the draft (FR-45, FR-46, FR-49). |
| `app/builder-session.js` | The builder's state: pieces, slots, commands with undo and redo, shuffle, tidy, draft (FR-67 to FR-72, FR-49). |
| `app/pictures.js` | Turns stored pictures (colour plus alpha) into drawable bitmaps, with a size-limited cache, and renders outfit pictures. |
| `app/backup.js` | Make a backup, restore, import the old format, direct copy from the old app, the reminder (FR-100 to FR-106). |
| `app/drafts.js` | Saves and restores the editor and builder drafts (FR-49). |
| `app/prefs.js` | Settings (FR-111) and the small flags (onboarded, last backup, plan questions asked). |
| `app/boot.js` | Start-up order, orphan sweep, old-app detection, storage check, errors log. |

### 2.3 domain/

| File | Responsibility |
|---|---|
| `domain/model.js` | Categories, types, seasons, occasions, colour names; record validation; wear counts and cost per wear; ids and versions. |
| `domain/search.js` | Search, filter and sort of garments (FR-3 to FR-7). |
| `domain/suggest.js` | Temperature bands, fit scoring, outfit scoring, composing an idea, the reason line, seeded randomness (FR-91 to FR-94). |
| `domain/layout.js` | The tidy default layout for the builder (FR-66, FR-71). |
| `domain/builder.js` | *(Draft 6)* The pure part of mix and match: the ring of candidates for a slot, turning a slot, the opening slots, shuffle from a seed, the suggested outfit name (FR-67 to FR-70, FR-73). |
| `domain/colour/space.js` | sRGB to linear to OKLab and back; OKLCh (lightness, chroma, hue). |
| `domain/colour/naming.js` | A colour's name from its lightness, chroma and hue; the swatch list (FR-53). |
| `domain/colour/palette.js` | The garment's colours: white balance from the background, grouping in OKLab, merging shadow and highlight of one fabric, choosing the lit swatch (FR-54 to FR-56). |
| `domain/image/geometry.js` | The viewport: the one function that maps a touch to an image pixel and back; zoom about a point; pan limits; two-finger gesture maths; rectangle maths (FR-34, FR-65). |
| `domain/image/mask.js` | Mask operations: paint a disc, flood fill by colour, connected pieces, drop specks, fill holes, smooth, bounding box, coverage, run-length encoding. |
| `domain/image/segment.js` | The automatic cut-out: background and garment models, classification with strength, tidy, the low-contrast check (FR-23 to FR-27). |
| `domain/image/edges.js` | The final cut-out: erode, feather, decontaminate the rim, trim (FR-30). |
| `domain/image/skin.js` | Skin detection (FR-43). |
| `domain/image/shape.js` | Shape features of a mask and the type guess (FR-57). |
| `domain/image/raster.js` | Resize, rotate by any angle, crop and mirror of pixel buffers and masks (FR-40, FR-41). |
| `domain/image/png.js` | A small PNG writer for 8-bit greyscale alpha masks (section 5.6). |
| `domain/backup-format.js` | The backup file: a zip written and read a piece at a time; the manifest (FR-100, NFR-18). |
| `domain/migrate.js` | Old Wardrobe records to new records; data-version upgrades (FR-102, NFR-29). |
| `domain/commands.js` | The command stack: apply, undo, redo, labels, the byte budget (FR-45, FR-46, FR-72). |

### 2.4 infra/

| File | Responsibility |
|---|---|
| `infra/db.js` | IndexedDB: open and upgrade, transactions across several stores, get and put, the pictures store, storage estimate, persistent storage. |
| `infra/worker-client.js` | Sends messages to the image worker and matches replies; transfers pixel buffers without copying; restarts a crashed worker. |
| `infra/image-worker.js` | The worker itself: decodes photos, runs `domain/image` and `domain/colour`, owns the editing document, encodes pictures. |
| `infra/decode.js` | Fallback photo decoding on the main thread for browsers whose workers cannot decode. |
| `infra/net.js` | `fetch` with a timeout, restricted to the two Open-Meteo addresses. |
| `infra/files.js` | Save a file through the share or download sheet; pick a file; read a file in slices. |
| `infra/platform.js` | What this browser can do: worker decoding, OffscreenCanvas, CompressionStream, persistent storage, standalone mode, iOS. |
| `infra/old-wardrobe.js` | Opens the old app's `wardrobe` database read-only, if it exists (FR-103). |

Also at the root: `index.html`, `manifest.webmanifest`, `sw.js` (the service worker), `main.js` (boot), `fonts/` and `icons/`.

## 3. Data model

Records are plain objects stored in IndexedDB (the browser's database). Every record has an `id`, a `v` (its format version, starting at 1) and ISO timestamps `created` and `updated`. Ids are random strings with a type prefix so a mistake is obvious: `g_` garment, `o_` outfit, `p_` picture; days use the date itself.

### 3.1 Garment

| Field | Type | Meaning |
|---|---|---|
| `id` | string `g_…` | |
| `v` | 1 | record version |
| `created`, `updated` | ISO date-time | |
| `name` | string | |
| `category` | one of the category keys | `tops`, `bottoms`, `dresses`, `outerwear`, `shoes`, `bags`, `accessories`, `jewellery`, `other` |
| `type` | string | from the category's list, or typed in |
| `brand`, `size`, `notes` | string | may be empty |
| `price` | number or null | |
| `bought` | `YYYY-MM-DD` or null | |
| `seasons` | array of `Spring` `Summer` `Autumn` `Winter` | |
| `occasions` | array of strings | from the fixed list |
| `colours` | array of `{ name, hex }` | first is the main colour; at most 3 |
| `favourite` | boolean | |
| `status` | `active` or `gone` | |
| `gone` | `{ reason, date }` or null | reason: `sold` `donated` `binned` `lost` `other`; date `YYYY-MM-DD` or null |
| `pictures` | `{ cutout, thumb, original }` | picture ids; `original` null for garments from the old app |
| `cutout` | `{ kind, width, height, strength, method }` | kind `cutout` or `photo` (whole photo kept); method names the cut-out version, e.g. `seg-2` |
| `shape` | array of 12 numbers or null | the mask's shape features, for the type guess |
| `origin` | `app` or `wardrobe-import` | |

Example:

```json
{
  "id": "g_7f3k9q2mzt", "v": 1,
  "created": "2026-10-03T09:12:40.120Z", "updated": "2026-10-03T09:12:40.120Z",
  "name": "Navy jumper", "category": "tops", "type": "Jumper", "brand": "Uniqlo", "size": "M",
  "price": 34.9, "bought": "2025-11-02", "seasons": ["Autumn", "Winter"], "occasions": ["Everyday", "Work"],
  "colours": [{ "name": "Navy", "hex": "#223055" }, { "name": "Light grey", "hex": "#c6c8cc" }],
  "notes": "", "favourite": true, "status": "active", "gone": null,
  "pictures": { "cutout": "p_a1b2c3d4e5", "thumb": "p_f6g7h8i9j0", "original": "p_k1l2m3n4o5" },
  "cutout": { "kind": "cutout", "width": 1180, "height": 1600, "strength": 50, "method": "seg-2" },
  "shape": [1.36, 0.02, 0.91, 1.31, 1.02, 0.94, 0.71, 0, 0.18, 0.22, 0.47, 0.52],
  "origin": "app"
}
```

### 3.2 Outfit

| Field | Type | Meaning |
|---|---|---|
| `id` | `o_…` | |
| `name`, `seasons`, `occasions`, `favourite` | as garment | |
| `pieces` | array of `{ garmentId, x, y, w, z, rot, flip }` | position and width as fractions of the canvas width (canvas is 1 wide by 4/3 high), `z` the layer order, `rot` degrees −180 to 180, `flip` boolean; the same garment may appear in several pieces only if it is a different garment, so two tops means two garments |
| `picture` | picture id | the rendered canvas |

Example:

```json
{
  "id": "o_2mz8pq4ktv", "v": 1, "created": "…", "updated": "…",
  "name": "Navy jumper + jeans", "seasons": ["Autumn"], "occasions": ["Everyday"], "favourite": false,
  "pieces": [
    { "garmentId": "g_7f3k9q2mzt", "x": 0.22, "y": 0.03, "w": 0.46, "z": 2, "rot": -4, "flip": false },
    { "garmentId": "g_9hd2x1v7pw", "x": 0.24, "y": 0.44, "w": 0.42, "z": 1, "rot": 0, "flip": false },
    { "garmentId": "g_3c7lmw5qzb", "x": 0.08, "y": 0.78, "w": 0.30, "z": 3, "rot": 12, "flip": true }
  ],
  "picture": "p_q9w8e7r6t5"
}
```

### 3.3 Day

| Field | Type | Meaning |
|---|---|---|
| `id` | `YYYY-MM-DD` | the day |
| `outfits` | array of outfit ids | worn or planned |
| `garments` | array of garment ids | worn or planned on their own |
| `note` | string | up to 200 characters |
| `planned` | boolean | true when the entries were added while the day was still ahead and the day has not been confirmed |
| `planAsked` | boolean | the "did you wear it" question has been shown |

Example: `{ "id": "2026-10-06", "v": 1, "updated": "…", "outfits": ["o_2mz8pq4ktv"], "garments": [], "note": "", "planned": true, "planAsked": false }`

*(Draft 7, as built:)* logging goes through `app.days.log({ outfitId | garmentId, day })`; the day defaults to today, must be a real `YYYY-MM-DD` ('Choose a date first.' otherwise), and `planned` is set from `isPlanned(day, today)` (a day after today) on every write, so adding to a passed day never leaves it planned. A garment's wears count the days up to today that list it or an outfit holding it (`wearStats`); a planned day counts once it has passed, even unanswered, which is what UC-5 A5 asks. The calendar screen (`ui/screens/calendar.js`) keeps the shown month in module state so a record change (every write re-renders the current screen through `shell.refresh()`) keeps the month; the day sheet is opened by its day key (`#/calendar/2026-10-02`, or `today` from the '+' menu's 'Log today' and the toast's 'See day') once per arrival, not again on each re-render, and refills itself after its own changes; Monday is first (`(getDay() + 6) % 7` blanks); a cell shows the first picture it can find (an outfit's thumb, else a garment's) and a count when there is more than one; a planned day has a dashed border. The passed-plan question is `askPassedPlans(app, router)`, exported from the calendar screen and called by `main.js` 250 ms after boot and when the app comes back to the foreground, only when onboarded and no sheet is open; it takes the oldest due day, writes `planAsked` before showing anything (so closing the sheet, or the app, counts the plan as worn and it is never asked again), and after Yes or No asks about the next due day. 'No' offers 'Keep it', 'Remove' (the entries come off the day) and 'I wore something else' (the entries come off and the calendar opens on that day). 'Gone from closet' is a sheet (`ui/screens/gone.js`) with the reason as a segmented row and an optional date, defaulting to today; a gone garment's page swaps the wear buttons for 'Bring back' and says 'Gone from your closet (sold, 2 Oct 2026)'. Stats (`ui/screens/stats.js`) is a plain render over `domain/stats.js` and `goneGroup`: the four numbers, most worn (top five, worn at least once, bars scaled to the top), not worn in 90 days (never worn first, then the longest ago; the first five with 'See all' opening the Closet at `#/closet/notworn`, which sets the not-worn filter and the least-worn sort once per arrival), cost per wear best three and worst three over priced garments with the unworn marked 'yet to earn its keep', bars by category and by main colour, and the gone group's count, cost and average cost per wear with 'See them'. With no garments it explains and offers the camera. The test clock (`setNow`) now survives a plain reboot of the test hook, as the phone's clock would, and a wipe starts it afresh.

*(Draft 7, after the milestone 6 review:)* the shell now tells a screen whether a render is an arrival (`nav: true`, from the router) or a refresh (`nav: false`, after a record change or a return to the foreground), and the calendar and the Closet honour their route argument on arrival only: a write made while looking at another month keeps that month, a closed day sheet stays closed, and 'See all' on Stats resets the Closet's view every time it is tapped. Tapping an outfit or a garment on a day closes the sheet before opening its page. Several pieces added to a day go through `days.logMany`, one record and one write, so a failure saves none of them. The passed-plan question is guarded by an in-flight flag as well as the open-sheet check, so two triggers at once (the timer after an answer and a return to the foreground) ask once; closing either of its sheets without choosing confirms the plan as worn in the record (`planned: false`), so the grid and the day sheet stop calling it a plan; the second sheet offers 'Remove' and 'I wore something else' only and says that closing it keeps the plan counted as worn. Day and question titles carry the year when the day is not in the current year. The grid is a `group`, not an ARIA `grid`. A failed 'Another day' keeps the picker open with the chosen date. 'Gone from closet' on the edit screen asks 'Discard your changes?' first when the form or the photo has unsaved edits. Cost per wear's worst list leaves out garments already shown as best, so a closet with fewer than six priced garments never shows the same garment twice; equal colour counts are listed in name order.

Wear counting (FR-80): a day counts once it is today or earlier, whether it was logged or planned; the question in FR-81 only lets you correct it.

### 3.4 Picture

Every picture is a colour image plus, when the picture has transparency, a separate alpha mask (the see-through map). This is the storage trick that keeps a garment under 1.5 MB (NFR-14); section 5.6 explains why.

| Field | Type | Meaning |
|---|---|---|
| `id` | `p_…` | |
| `kind` | `cutout` `thumb` `original` `outfit` | |
| `colour` | Blob, `image/jpeg` | the colour layer |
| `alpha` | Blob, `image/png`, or null | 8-bit greyscale: 255 opaque, 0 transparent; null for `original` and for whole-photo garments |
| `width`, `height` | integers | |
| `bytes` | integer | colour plus alpha, for the storage figure |

### 3.5 Meta and drafts

- `meta` holds small named values: `prefs` (theme, currency, temperature unit, town), `onboarded`, `lastBackup` (ISO), `dataVersion` (the store layout version, 1), `weather` (the cached forecast with its key and time), `errors` (the last 20 errors with time, screen and message, FR-115), `import` (an import in progress, so an interrupted one can be tidied up).
- `drafts` holds at most two records: the editor draft and the builder draft (FR-49). *(Draft 6:)* the builder draft is keyed like the editor's, `builder` for a new outfit and `builder:<id>` for an edit; it holds the pieces, the slots, the form, whether the name was typed and whether the mixer was open, as JSON, and is written when the screen is left, when the app goes to the background and when a save fails. The editor draft keeps the working photo as JPEG, the mask as PNG, the form fields, the strength and the tool state; it is written at most once every two seconds while editing and removed on save or discard.

### 3.6 Database layout

Database `awardrobe`, version 1, with stores `garments`, `outfits`, `days`, `pictures`, `meta`, `drafts`, each keyed by `id` (meta by `key`). No secondary indexes: the record stores are small and are read whole at boot (300 garments are about 200 KB of JSON); only pictures are read on demand. `dataVersion` in meta, not the IndexedDB version number, drives migrations, so a future layout change is a normal code path with tests (NFR-29).

## 4. Storage scheme

- **Writes are all-or-nothing** (NFR-27). Each use case that touches several stores runs as one IndexedDB transaction: saving a garment writes its record and its three pictures together; deleting a garment removes its record, its pictures, and its entries in every outfit and day together; saving an outfit writes the record and its picture together. If any part fails the browser rolls the whole transaction back.
- **Records in memory.** `app/records.js` loads garments, outfits and days at boot and keeps them in maps. Reads are instant; writes go to the database first and update the maps when the transaction completes. Screens subscribe to changes.
- **Pictures on demand.** `app/pictures.js` loads a picture's blobs, decodes them, composites colour with alpha, and caches the result as an ImageBitmap (a decoded picture the browser can draw fast). Two caches: thumbnails (up to 80, about 60 MB) and full cut-outs (up to 4, about 30 MB; *Draft 4: 12 was more than a phone needs, the page shows one at a time*). Cards draw into a small canvas when they scroll into view (NFR-11) and give the canvas back when they scroll far out of view, drawing again from the cache on the way back (NFR-13).
- **Orphans.** At boot, in idle time, pictures referenced by no garment, outfit or draft are deleted (NFR-27). An import in progress is marked in meta so its half-done pictures are not swept. *(Draft 9, as built in milestone 8:)* `sweepOrphans` in `app/boot.js`, three seconds after boot, skipped in a memory-only session and while the `import` marker is set; a draft's `originalId` counts as a reference.
- **Storage limits** (NFR-17). Before saving a garment, importing or restoring, the app reads `navigator.storage.estimate()`; above 80% it warns; a quota error during a transaction surfaces as a storage error with the draft kept.
- **Persistent storage** (FR-109). After the welcome, `navigator.storage.persist()` is requested so the browser does not clear the data under pressure. Installed home-screen apps get it without a prompt.
- **Browser storage keys.** Only `awardrobe.theme` in localStorage (so the theme applies before the database opens). Everything else is in the database. Nothing else in localStorage, so the other apps on the site are untouched (NFR-34).
- **The data-version chain** (NFR-29). *(Draft 9, as built:)* `upgradeStored` in `app/boot.js` runs after the records load: when any garment, outfit or day is below the current version it is brought forward by `domain/migrate.js` and written, with `dataVersion` in `meta`, in one transaction; when every record is current nothing is written, so an empty database stays empty. A backup made by an older version is brought forward the same way as it is restored.
- **Service worker caches** are named `awardrobe-v<N>`, where N is the release's VERSION; activation deletes every `awardrobe-*` cache except the current one and never touches other names (NFR-34, NFR-35).

## 5. The image pipeline

```
 camera or photo library
         │ File (any size, any orientation)
         ▼
┌──────────────────────────────── Web Worker: a background thread ─────────────────────────────────┐
│ 1 decode and orient    2 reduce ──┬──► reduced original, 2000 px ──► JPEG ───────────────────────┼──► store
│                                   └──► working copy, 1200 px, RGBA pixels                        │
│                                              │                                                   │
│ 3 analyse: background model from the edges, garment model from the middle (in OKLab)             │
│ 4 classify every pixel with the strength ──► 5 tidy: specks, holes, smooth ──► MASK + confidence  │
│                                                               │                                   │
│ 6 colours: white balance from the background, group, merge shadows ──► up to 3 names             │
│ 7 shape features from the mask ──► type guess with a reason                                       │
│                                                               │                                   │
│ 8 EDIT LOOP: the UI sends commands (brush, wand, select, paint, rotate, crop, strength, skin);    │
│   the worker changes the document, keeps undo records, sends back dirty rectangles for preview    │
│                                                               │                                   │
│ 9 at save: erode, feather, decontaminate the rim ──► trim ──► JPEG colour + PNG alpha             │
│                                                      └──► thumbnail 360 px: JPEG + PNG alpha      │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
         │ blobs and fields
         ▼
 main thread: app/garments.js writes the garment record and its 3 pictures in ONE transaction ──► IndexedDB
```

Everything inside the box runs in the worker, so the screen never freezes (NFR-7). The main thread only draws previews and handles touches.

### 5.1 Decode and orient (steps 1 and 2)

The worker calls `createImageBitmap(file, { imageOrientation: "from-image" })`, which decodes the photo and turns it the right way up from its orientation tag (FR-21), draws it into an OffscreenCanvas (a canvas that lives in the worker) at two sizes, and reads back the pixels. Browsers that cannot do this in a worker (`infra/platform.js` checks once with a tiny test image) decode on the main thread through an `<img>` element instead, which costs about 200 ms of freeze on a 12-megapixel photo on old devices; current iPhone Safari and Android Chrome take the worker path. A photo that will not decode at all raises an `ImageError` with the HEIC hint (FR-28).

Sizes (NFR-16): reduced original 2000 px long side as JPEG quality 0.82 (about 0.5 to 0.7 MB); working copy 1200 px long side as raw RGBA (about 7.7 MB in memory, never stored as such).

### 5.2 The automatic cut-out (steps 3 to 5)

The method is the old app's idea done properly, with a confidence measure. All colour work is in OKLab, the colour space where distances match what the eye sees.

1. **Analysis copy.** A 320 px copy of the working image is converted to OKLab.
2. **Background model.** Pixels in a border band (6% of the shorter side) are grouped by k-means (a method that finds the k most representative colours) with k = 6, then groups closer than 0.03 are merged. This gives several background shades, so folds, shadows and a lighting gradient all count as background (FR-24). *(Draft 3, after the milestone 2 review:)* a shade with under 1% of the band's pixels is the mixed rim where something meets the sheet and is dropped; a shade found on one edge only (80% or more of its band pixels on one side) that also fills at least 10% of the middle box is the garment reaching the edge of the photo (a hem on the bottom edge) and is dropped too. *(Draft 4, from the first real photo, a shirt whose sleeves, collar and hem all crossed the frame:)* whatever fills a corner of the picture is background for certain, so a shade that fills none of the four corner boxes (10% of the shorter side each) and is not within 0.1 of one that does is dropped as well; otherwise such a garment teaches its own colours to the background model and the cut-out collapses to its brightest patches.
3. **Garment model.** Pixels in the middle 22% to 78% box that are further than 0.11 from every background shade are grouped with k = 5. Too few such pixels (under 0.4% of the image) means no garment was found: fall back to the border flood fill (the old method), and if that also fails the coverage check, keep the whole photo (FR-27). *(Draft 3:)* these distances count lightness at 0.6 so shading stays with its fabric, but a middle pixel lighter than every background shade by more than 0.12 L counts as clearly different whatever the weighted distance says, because a shadow never lightens (a white shirt on a light grey sheet).
4. **Confidence.** For each garment shade, its distance to the nearest background shade; the share-weighted median of those distances is the separation. Separation under 0.08 sets `lowContrast`, which the UI shows as the pale-on-pale warning before any fixing starts (FR-26). *(Draft 3:)* the separation counts lightness in full when the garment shade is the lighter of the two and at 0.6 when it is the darker; the flag is also set when the finer sampling tier was needed, and when the faint middle pixels (0.035 to 0.11 from every background shade, lightness in full) outnumber the clear ones, which is a pale shirt whose dark print alone stands out. Draft 2's "quarter of pixels ambiguous" rule was not built; this replaced it.
5. **Classification** as a soft score at 640 px on the long side, then brought up to the working size smoothly: a pixel is garment when its distance to the nearest garment shade is less than `lean × ` its distance to the nearest background shade. `lean` comes from the strength (FR-25): 1.7 at "keep more" (0), 1.0 in the middle (50), 0.55 at "remove more" (100), varying smoothly. *(Draft 2, after building:)* the background shades are joined by two darker copies of each (lightness × 0.85 and × 0.72, chroma eased towards grey) that carry a penalty of 0.05, so a cast shadow next to the garment counts as background while a garment that happens to be the colour of a shadow still wins when the garment model knows that colour. The garment sample is taken in two tiers: pixels further than 0.11 from every background shade, and if too few, further than 0.035, in which case the low-contrast flag is set as well.
6. **Tidy.** Majority smoothing twice (each pixel goes with most of its neighbours), drop kept specks smaller than 0.3% of the image unless they are the largest piece, fill enclosed holes smaller than 4% of the image. *(Draft 3: the final drop of separate pieces under 1% is gone, so a ring or an earring survives.)*
7. **Output.** The mask (one byte per pixel, 0 or 255), coverage, `lowContrast`, the dominant background colour in sRGB (for white balance), and the method name `seg-2` recorded on the garment. *(Draft 5, from the second real photo, a blue and white pinstripe shirt on white:)* the tidy-up closes gaps narrower than 6 pixels (a grow by 3 then a shrink by 3, square window, done with linear distance scans) before the smoothing and the speck drop, so a stripe or seam the colour of the sheet is joined to its neighbours instead of being whittled away by the majority smoothing, and the outline no longer gets a notch wherever a white stripe meets the white background (the bites the user saw after saving). Kept pixels are never lost by the closing; a garment's own concave corners are far wider than 6 pixels. Judging every pixel at the working size instead of the 640-pixel copy was tried and gains only 0.004 overlap for about 90 ms more per cut-out, so it stays off (`CLASSIFY_FULL`). Wide stripes the colour of the sheet that reach the outline (T12, 36 pixels) remain a known limit for the Restore brush. The whole-photo rule (FR-27) applies when under 0.2% *(Draft 3; was 0.5%)* or over 97% of the pixels would be kept. *(Draft 4:)* only on the first automatic pass; a strength the user chose returns its real mask marked `extreme` (empty or full) and the screen says so, per the FR-27 amendment.

Cost measured on this PC in headless Edge (Draft 2): the whole cut-out of a 960 by 1200 working copy in 70 to 105 ms; a 12-megapixel photo decoded and reduced in 91 ms and cut out in 130 ms. The 2020 phone budget (NFR-7, 2 s) leaves a margin of roughly four times. Overlap on the generated set: plain sheet 0.995, creased sheet with shadow 0.979, wooden floor 0.994, strong gradient 0.995, small sock by flood fill 1.000; the pale shirt on the pale wall is flagged; the empty sheet, the all-fabric crop and the black jeans on the charcoal floor come out as "whole photo" (the last is the known hard case: with lightness weighted down so shadows stay with the background, a dark garment on a dark floor does not stand out, and the editor's tools are the answer).

### 5.3 Colours (step 6)

`domain/colour/palette.js`, as the old app's method with the rules made explicit (FR-53 to FR-56):

- Samples pixels that are fully inside the mask (at least 3 px from its edge), at most 9,000 of them.
- White balance: if the dominant background colour is near neutral (chroma under 0.06, lightness over 0.45) and its tint lies where lamps and sky put it (hue 55° to 115° for a warm bulb, 235° to 295° for a cool window; any hue when chroma is under 0.012), each channel is scaled so that colour becomes grey, with gains clamped to 0.5 to 2.0 (FR-54). A coloured background gives no correction: a red sheet, a sage or pink wall, a light blue sheet. *(Draft 2 widened the old app's chroma 0.06 to 0.08 for a 3000 K bulb; Draft 3 found that corrected pastel walls and misnamed the garment on them, so the gate is back at 0.06 with the hue rule, and a cast strong enough to look like a coloured sheet is left alone. That is the known limit; a lighting-correction switch in the garment editor is noted for milestone 3.)*
- Groups with k-means in OKLab (k from 2 to 6 by sample count), then merges groups that are the same fabric in different light: same hue within 20°, chroma within 0.06, any lightness (FR-55). Neutral groups merge when their lightness differs by less than 0.22.
- Each group's swatch is the average of its lighter half, so the chip shows the fabric, not its shadow. Groups under 7% of samples are dropped after the first. Up to three, main colour first.
- Names come from `naming.js`, which looks up lightness, chroma and hue against the 26-name table from the old app; the thresholds are tuned by the colour test set (NFR-39).
- *(Draft 4:)* when the whole photo is kept there is no mask, so the samples come from the middle 22% to 78% box of the picture, where the garment is, not from the sheet round it.

### 5.4 Type guess (step 7)

See section 10 for the decision. `shape.js` computes twelve numbers from the mask (height to width ratio, leg split share, top solidity, shoulder to waist ratio, bottom flare, left-right symmetry, solidity, hole share, widest row position, narrowest row position, top width, bottom width) and gives a rule-based guess with a reason. `app/garments.js` then compares the twelve numbers with those stored on your other garments and, when at least three close neighbours agree, prefers their answer ("like your other jeans"). The guess never overwrites a chosen category or type (FR-57).

### 5.5 The final cut-out (step 9)

`domain/image/edges.js` runs once, at save (FR-29, FR-30):

1. Erode the mask by one pixel: the outermost ring of kept pixels is always a blend with the background, so it goes.
2. Feather: the alpha is the eroded mask blurred by about 1.5 px, so edges are soft but not fuzzy.
3. Decontaminate the rim: for pixels that are partly transparent and for a 4 px band outside them, the colour is replaced by the average of the already-coloured neighbours, all eight of them, working outwards one ring per pass for eight passes *(Draft 3; the soft edge is four pixels wide, two inside the eroded outline and two outside, so Draft 2's four passes stopped inside it)*. This removes the halo of background colour and, because the invisible surround now matches the garment, stops JPEG compression from bleeding dark or background colour into the edge.
4. Trim to the alpha's bounding box with a 3% margin.
5. Encode: colour as JPEG quality 0.86, alpha as 8-bit greyscale PNG (section 5.6).
6. Thumbnail: the trimmed result reduced to 360 px long side, encoded the same way, with each shrunk pixel's colour averaged by alpha weight *(Draft 3)* so the soft edge keeps the garment's colour rather than its surround's.

Cost: about 150 to 300 ms in the worker, inside the 1.5 s save budget (NFR-10).

### 5.6 Why colour and alpha are stored separately

A photographic cut-out saved as one PNG with transparency is huge: at 1200 px it is 3 to 5 MB, because PNG cannot compress photo texture. Browsers cannot write WebP with transparency on iPhone. So each picture is a JPEG for the colour (about 300 to 450 KB at 1200 px) plus a greyscale PNG for the alpha (about 40 to 80 KB, since masks are mostly solid runs). A garment all-in is then about 1.0 to 1.3 MB with its reduced original, inside NFR-14. The cost is one compositing step when a picture is drawn, which `app/pictures.js` does once and caches. The greyscale PNG is written by `domain/image/png.js`, 80 lines using the browser's built-in deflate (`CompressionStream`), because a canvas can only write colour PNGs; browsers decode greyscale PNGs natively, so reading needs nothing special. Where `CompressionStream` is missing (no supported browser, but checked anyway) the alpha is written as a colour PNG, three times bigger, and everything still works.

## 6. The editor

### 6.1 The document lives in the worker

The worker owns the editing document: the working pixels, the mask, the selection, and the undo history. The UI never holds the only copy of anything. It sends commands and receives previews. This is what keeps brush strokes under 16 ms (NFR-8) without copying a 7.7 MB image back and forth: a stroke message is a few numbers, and the reply is only the rectangle that changed.

```
  pointer events ──► ui/screens/editor/stage.js ──► app/editor-session.js ──► worker-client ──► image-worker
       ▲                       │ draws stroke on overlay at once            (commands, points)        │
       │                       ▼                                                                      ▼
   screen ◄── view canvas ◄── work canvas (RGBA with alpha applied) ◄── dirty rectangle (pixels) ◄── document
```

Main-thread state is a preview: `rgba` (the working photo), `alpha` (the current mask), `selection`, plus a work canvas that holds the two composited. When a dirty rectangle arrives, the UI recomputes that rectangle in the work canvas and redraws the view. The overlay canvas shows the brush ring, the stroke path while the finger is down, the selection tint and the crop box.

*(Draft 5, as built:)* the main-thread copies are `work` (ImageData), `mask` and `sel` in `app/editor-session.js`; the preview canvas and the selection tint are recomposited only inside the rectangles the worker reports. A reply is either a rectangle (`rect` plus the bytes of whichever of mask, pixels and selection changed) or a full picture (after undo, redo, rotate, crop, strength, keep only and the like), and every reply carries the labels, the step count, coverage, strength and the selection flag, so the screen never asks twice. The worker runs the document's requests through a serial queue, so a stroke's points can never overtake its start. Points that arrive before the document has answered a stroke's start are held back and sent after it (the first build dropped them). The Select stroke's rectangle is padded by the snap reach, not the brush radius, so the selection that grew past the brush reaches the screen copy. The lift point of a stroke is dropped when it is where the last point already was, so a stroke's point count is what the finger sent. *(Draft 5, after the milestone 4 review:)* a stroke joins the history the first time one of its discs changes a pixel, so a finger that starts in the letterbox margin and comes in erases inside and a stroke wholly in the margin is no step; discs that miss the picture are skipped rather than clamped (the first build threw on them and left every brush dead). A batch of points that arrives after an undo, a tap or a button ended the stroke is refused by the document (`ended`) and the session drops the stroke; the session ends any live stroke before it sends an undo, a redo or another command. If the photo tools die mid-edit (a crash or a step that took too long), the session opens the document again from its preview copies, so the picture and the cut-out as last drawn are kept, the undo history is lost, and the screen says "The photo tools restarted; your last change may be lost" (section 11). Taps outside the picture do nothing; a mouse stroke needs the main button.

### 6.2 One coordinate mapping (FR-34)

All drawing and all touch handling go through one object, `Viewport` in `domain/image/geometry.js`:

```
Viewport { imageW, imageH, viewW, viewH, dpr, scale, tx, ty }
  scale: screen CSS pixels per image pixel;  tx, ty: where the image's top-left sits in the view, in CSS pixels
  fit()                       scale so the whole image fits with a 3% margin, centred (so letterboxing is just tx, ty)
  toImage(clientX, clientY, viewRect)   ((clientX - viewRect.left) - tx) / scale, same for y
  toScreen(ix, iy)            the inverse
  zoomAt(factor, clientX, clientY)      changes scale, then moves tx, ty so the image point under the finger stays put
  panBy(dx, dy)               moves tx, ty, clamped so at least a quarter of the image stays on screen
  canvasTransform()           [scale·dpr, 0, 0, scale·dpr, tx·dpr, ty·dpr] for ctx.setTransform
```

Rules that design the old offset bug out:
- The view canvas is always exactly the size of its box (CSS size = box, backing store = box × device pixel ratio). It never has CSS transforms, margins inside a scrolling parent, or a size different from its box. Letterboxing is only ever `tx, ty`.
- Zoom and pan never scroll anything; they only change `scale, tx, ty`. The stage has `touch-action: none`.
- `toImage` and `canvasTransform` use the same three numbers, so what is drawn at a point is what a touch at that point hits.
- Unit tests (Phase 4): round trips at random states; the top-left corner maps to `(tx, ty)` when letterboxed; a point stays fixed under `zoomAt`; the mapping ignores the device pixel ratio while drawing uses it; a landscape rotation of the phone re-fits and the tests still hold.

Zoom runs from fit to 8 × fit with pinch, buttons and double-tap (FR-33). Brush sizes are in screen pixels (small 14, medium 28, large 56), converted to image pixels by dividing by `scale` at stroke time (FR-39), and the ring is drawn on the overlay at the screen size.

### 6.3 Commands, undo and redo (FR-45, FR-46, FR-72)

Every change is a command with a label. The worker applies it and keeps a small record that can reverse it. `domain/commands.js` holds the stack: `apply(cmd)`, `undo()`, `redo()`, `labels()`, and a byte budget.

| Command | What it changes | Undo record | Typical size |
|---|---|---|---|
| Brush stroke (Eraser, Restore) | mask inside the stroke's box | the previous mask bytes in that box | 50 KB to 1 MB |
| Select stroke | selection inside the box | previous selection bytes in the box | same |
| Select apply (keep only, remove) | mask everywhere | run-length copy of the previous mask | 20 to 100 KB |
| Wand tap | mask in one connected region | run-length copy of the changed pixels | under 100 KB |
| Strength change, Cut out again | whole mask | run-length copy of the previous mask | 20 to 100 KB |
| Remove skin | mask | run-length copy | under 100 KB |
| Paint stroke | pixels inside the box | previous pixels in the box; as JPEG quality 0.95 if the box is over a quarter of the image | up to 2 MB |
| Rotate, Mirror, Crop | pixels, mask and size | the previous pixels as JPEG quality 0.92, the previous mask run-length, the previous size | about 0.5 MB |

A stroke is one command from finger down to finger up, however many points it has, so one Undo removes the whole stroke. Points arrive in the worker once per animation frame and the reply is the box that changed. The stack keeps up to 50 commands and 40 MB; the oldest records drop first when the budget is reached, which still leaves at least 20 steps in the worst case (20 × 2 MB). Undo and Redo buttons show "Undo crop", "Redo brush stroke" from the labels. *(Draft 5, as built:)* the records are: mask commands (strokes, wand, keep only, remove, clear, strength, cut out again, remove skin) as run-length copies of the mask before and after, the after copy taken when the step is first undone; paint strokes as the list of touched pixels with their previous colours (undo restores them exactly, no JPEG); rotate and crop as the previous pixels compressed losslessly with the browser's deflate (about 2 MB for a 960 by 1200 picture) plus the previous mask, selection and size; mirror as its own inverse with no record. The stack keeps 50 commands and 40 MB with at least 20 steps. The records live in the worker, so the page's heap stayed at 74 MB with a 12 MP photo open and 20 steps (P-7). *(After the review:)* a record's after-copy is taken once, on the first undo, so undo and redo cycles no longer grow the byte count; a paint stroke keeps its touched pixels in typed arrays counted at seven bytes a pixel and paints each pixel once per stroke; a strength step restores its warnings (the extreme and pale-on-pale marks) with its mask. Ruling: rotate and crop keep the lossless record (about 2 MB each for a 1200 px working picture, up to 40 MB for twenty turns, inside NFR-13's 250 MB for the whole app) rather than the JPEG the table assumed, because a turn undone must give back the exact pixels; P-7 now reports the records' bytes beside the page heap.

Rotate (FR-40) is live while the Rotate tool is open: the view draws the preview rotated with a canvas transform, which costs nothing, and the Rotate command (with the final angle) is applied once when the tool is left or another tool chosen. Resampling happens once, from the current pixels, so repeated nudges of the slider do not soften the picture.

Crop (FR-41) is a box on the overlay; "Apply" sends one Crop command. Mirror is one command.

The Select tool's selection is a buffer in the document; select strokes are commands (so they undo), and "Keep only this" or "Remove this" is a further command that clears the selection.

The strength control (FR-25) re-runs the segmentation (step 5.2) as a command; the previous mask is the undo record, so edits made before the change come back with Undo.

The "Show original" button (FR-47) is not a command: while held, the view draws the photo without the alpha.

### 6.4 Tools to commands

| Tool | Gesture | Command(s) | Options panel |
|---|---|---|---|
| Move (default, FR-32) | one finger pans, two fingers pinch | none | zoom buttons |
| Wand (FR-35) | tap | Wand tap | remove or restore; how much a tap takes (0 to 90, where 0 is the exact colour) |
| Select (FR-36) | brush | Select stroke; then Keep only, Remove, Clear | brush size; snap on or off; the three buttons |
| Paint (FR-37) | brush | Paint stroke | colour from palette or dropper; keep shading or solid; brush size |
| Eraser, Restore (FR-38) | brush | Brush stroke | brush size |
| Rotate (FR-40) | slider, typed, 90° buttons, mirror | Rotate on leaving; Mirror | angle controls |
| Crop (FR-41) | drag corners or box | Crop on Apply | Apply, Reset |
| Dropper (FR-42) | tap | none (reads a colour) | which it is for: garment colours or paint |
| Remove skin (FR-43), Cut out again, Detect colours again (FR-44) | buttons | Remove skin; Strength change; none | |

Snapping in Select (FR-36): a select stroke grows from the brush disc only across kept pixels within 2.5 × the brush radius whose colour is within the wand tolerance of the colour under the finger, so the selection stops at the garment's edge. *(After the review:)* the tolerance scale is 4 + 2 × the slider value in weighted colour distance (the middle, 30, reaches about twenty levels a channel); the first scale, 6 + 3.6 × the value, let a Wand tap at the default take a grey tee with the sheet. A select stroke reuses one visited-marker array for all its discs instead of allocating one per disc. "Remove skin" says about what share of the cut-out it removed.

*(Draft 5, as built:)* the tool bar is a grid that wraps into rows of equal cells on a phone, so all nine tools stay in view; the letters M, W, S, P, E, R, T, C and D choose tools from a keyboard and Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y undo and redo (FR-52), never while typing in a field. On an existing garment the stage shows the stored cut-out as a still picture with the tools dimmed until a photo is open; "Redo the cut-out" opens the stored reduced original in the editor and the save keeps that original picture record (the save receives `original: { keepId }` instead of a new blob), while a garment that came over without an original says a fresh cut-out needs a new photo (FR-31, FR-105). "Hold to see original" works with a finger, a mouse or the space bar, and sits on the stage itself (bottom left corner), because on a phone a button below the tape and the tools is only reachable once the picture has scrolled away (found on an iPhone 16 Pro). *(Draft 5, after the first phone checks of M4:)* editing a saved garment offers "Edit the cut-out" on the picture itself: the reduced original opens in the editor with the saved cut-out put back in place, so brush fixes, strength and all carry on. For that the save records where the cut-out sat in the working picture (`cutout.box`, inclusive, in working pixels) and the working size (`cutout.work`); on opening, the saved alpha is drawn into a fresh mask at the box scaled by today's working size over the saved one (the same original decodes a pixel or two differently on occasion), and a different shape (the picture was turned or cropped before the save) or a garment saved before the box was recorded falls back to the automatic cut-out at the saved strength with a message. A whole photo kept carries on as a whole photo. "Redo the cut-out" (the automatic cut-out afresh) stays in the row below. The stage ignores pointer events that start on its own buttons (Undo, Redo, the empty-stage buttons): the first phone check found that tapping Undo with the Eraser active left a dot under the finger, which the undo then removed instead of the stroke. The second phone check found Undo sometimes not answering and two fast taps on it zooming in: a disabled button hands its taps to whatever is underneath, and the stage took two quick taps as a double tap. So Undo and Redo are never disabled, only dimmed (`aria-disabled`), and a tap with nothing to do answers "Nothing to undo"; a double tap zooms with the Move tool only (with a brush two quick taps are two dabs); every button has `touch-action: manipulation`, so the browser's own double-tap zoom never fires on one. *(Draft 5, at the user's request after the phone checks:)* in the Rotate tool two fingers also twist the photo: the angle between the fingers turns the live preview, snapping to level and to right angles within 4 degrees, and when the fingers lift the angle lands in the tool's slider and number and is applied on leaving the tool, exactly as a slider turn is. Pinch and pan keep working during the twist. The twist is confined to the Rotate tool so a pinch to zoom with another tool can never turn the photo by accident. *(Also at the user's request:)* the More page has a setting, "Cut out the garment automatically" (`prefs.autoCutout`, on by default); with it off a new photo opens kept whole (the whole-photo choice set, FR-50) while the automatic cut-out is still made in the background, so unticking "Keep the whole photo instead" reveals it and every tool works as usual. Note on "Edit the cut-out": it puts back the cut-out exactly as saved, bites and all, by design; a garment whose cut-out should be remade after an engine fix wants "Redo the cut-out" or a fresh add.

### 6.5 Drafts (FR-49)

`app/drafts.js` saves the editor document (photo as JPEG, mask as PNG, selection dropped, form fields, strength, tool) at most every two seconds after a change and on `visibilitychange` (the phone sending the app to the background), and removes it on save or discard. On opening the add screen, an existing draft is offered: "Carry on with the jumper you were cutting out?" The builder draft is the pieces, slots and form fields as JSON. *(Draft 4:)* in milestone 3 the draft is kept for a new garment only, written when the screen is left, when the app goes to the background and when a save fails, and the photo is encoded once per photo rather than on every write; a draft for editing an existing garment comes with the editor milestone, keyed by the garment, so an edit can never overwrite an add in progress. *(Draft 5:)* drafts are now keyed, `editor` for a new garment and `editor:<id>` for an edit, and the draft holds the photo, the mask, the strength, the whole-photo choice, the tool, its options and the paint colour, so carrying on restores the editor as it was; the undo history is not kept, the restored document starts at step zero (ruling: the records can reach 40 MB, far more than a draft should write every two seconds). *(After the review:)* leaving the screen builds the draft before the session is closed (the first build closed it first, so a tab tap within two seconds of an edit wrote a draft without its photo); the draft re-encodes the photo only when the pixels' revision changed and the mask only when the mask's did, not on every step; a draft write that fails is reported once on screen.

## 7. The outfit builder

- **Pieces** are elements inside a stage with a fixed 3:4 ratio; position and width are fractions of the stage width, so the same outfit renders the same on any screen and in the saved picture. Each piece's CSS transform is `translate(x, y) rotate(rot) scaleX(flip ? -1 : 1)`; the picture inside is the garment's composited cut-out drawn into a canvas.
- **Gestures** (FR-64, FR-65). Pointer capture per piece. One pointer: drag moves, drag on the corner handle resizes. Two pointers on a piece: `geometry.gestureTransform(start, now)` gives the change in angle and distance since the two fingers landed, applied to the piece's rotation and width live; the angle box in the tool bar updates on every frame. Resizing clamps width to 12% to 100% of the stage; a piece can be pushed half off the edge but no further.
- **Commands** (FR-72). Add pieces, Take off, Transform (one per gesture: from and to values), Layer (front or back), Tidy, Slot turn, Slot add, Slot remove, Shuffle (records the chosen garments so Redo gives the same result). Undo records are the previous values as JSON.
- **Slots and the revolver** (FR-67 to FR-69). A slot is `{ id, category, pieceId }`. The mixer shows one row per slot: the previous and next candidates at either side of the current one, dimmed and smaller; a swipe or arrow is a Slot turn that replaces the piece with the next garment in that category (newest first, with "none" at the end of the ring), keeping the position, width and angle. "Add a slot" asks for a category and adds a slot even if one exists, which is how two tops are layered. Gone garments are not candidates (FR-15).
- **Shuffle** (FR-70). With a seeded random number generator (so Redo repeats it): a dress 30% of the time when there are dresses, otherwise a top and bottoms; a second top as a layer 33% of the time when there are at least two tops; outerwear 50%; shoes when there are any; a bag 35%; an accessory 35%; jewellery 25%. The pieces are laid out by `domain/layout.js`, with a layered top offset a little and above the first.

*(Draft 6, as built:)* the builder screen is `ui/screens/outfit-edit.js` at `#/build/new` or `#/build/<outfit id>`, the outfit page `ui/screens/outfit.js` at `#/outfit/<id>`. A piece on the stage is a `div.piece` holding a canvas of the garment's full cut-out, placed by `left`, `top`, `width` and `height` as percentages of the stage (the stage is 3 by 4, so `top` and `height` divide by 4/3) and the transform `rotate(rot) scaleX(flip ? -1 : 1)`; the saved picture is drawn on a 900 by 1200 canvas with `pieceBox` from the same numbers, which is what U-GEO-9 pins down. The stage is its own stacking context (`isolation: isolate`) so the pieces' layer order never rises above a sheet. One finger drags; a finger on the selected piece's corner handle resizes about the opposite corner; two fingers on the same piece twist and pinch about the centre, carrying the fingers' drift, with `gestureTransform` from the two landing points; each gesture is one command from the piece's values before to after (`jsonCommand`: the state as JSON before and after, so undo and redo land exactly). Undo and Redo sit on the stage, like the editor's, and the stage ignores pointers that start on them. The tilt buttons move by 5 degrees; the number box and the slider set the angle; a piece may be pushed half off the edge and no further; width is clamped to 12% to 100%. Pieces hold a working `id` in the session only; the saved record keeps `garmentId, x, y, w, z, rot, flip` rounded to four places. Add pieces is a sheet with search (the closet's own matching), a category row and a tick list; garments already on the canvas are shown but cannot be ticked twice; gone garments are not listed, and a saved piece whose garment is gone is dimmed with a 'gone' mark. Mix and match: opening it on an empty canvas fills a tops, a bottoms and a shoes slot with the newest garment of each (so every slot shows something at once, as UC-8 step 2 asks), on a placed canvas one slot per piece in the closet's category order; a slot's ring is the category newest first with 'none' last, so the previous of the newest is 'none'; turning keeps the piece's place; 'Add a slot' places the first garment of the category not already on the canvas; a slot with a single garment has its arrows disabled; a swipe of 32 pixels on a row turns it too; with garments in fewer than two categories the mixer explains and offers to add clothes. Shuffle's seed starts random and counts up, each shuffle a command whose record is the whole state, so Undo and Redo repeat it exactly; ids inside a shuffle come from the seed too. The suggested name is the pieces' names in category order, first letter lowered after the first, up to three and then '+ n more', and stops being suggested once the name is typed. Saving renders the picture with `renderOutfitCanvas`, skips a garment whose picture cannot be read and names it in a message, and writes the outfit and its picture in one transaction, deleting the old picture in the same write. The outfit page counts wears from the days up to today that list the outfit (`app/days.js`, enough of the days module to log worn today or another day; a day ahead is planned). Deleting an outfit gives each day that wore it the pieces that still exist as garments, in the same transaction. The test hook `window.aWardrobeTest.builder` drives the stage's own pointer handlers with synthetic pointer events (drag, resize, two-finger gesture, tap) and calls the session for the rest.

*(Draft 6, after the milestone 5 review:)* a revolver turn keeps the piece but changes its garment, so the stage remakes that piece's node (the first build kept showing the old garment). Undo and Redo on the canvas sit above every piece (`z-index` 10000 inside the stage's own stacking context). The corner handle takes the finger's movement into the piece's own frame, turned back by the piece's angle and mirrored when the piece is, and the width follows whichever of x or y asks for more, so the handle stays under the finger on a turned or mirrored piece. A gesture owns its pointers: a second finger on another piece or the background is ignored, any finger of a two-finger gesture lifting ends it, and the finger still down starts nothing; a tap with a wobble under 6 px is put back and records no step. The two-finger pinch clamps the width before placing the piece about the fingers, so the piece stays centred at the limits. Arrow keys nudge the selected piece by one per cent (ten with Shift), one step a key. Each piece's canvas is drawn no wider than 600 px. Opening the mixer on a placed canvas is no step (the slots are a view of the pieces); on an empty canvas it is, named 'mix and match slots'; the other labels are plain ('turn of tops', 'bring to front', 'send to back', 'new slot', 'slot removed'). 'Add a slot' for a category whose every garment is already on the canvas says so instead of adding a dead row. The suggested name keeps its first capital ('White tee + navy jumper'). A saved outfit opened and left untouched writes no draft. Saving writes two pictures: the trimmed canvas (3% margin) and a 300 px thumb for lists, both replaced on re-save and deleted with the outfit (the first build cached the whole 900 by 1200 picture per card). Deleting a garment repaints every outfit it was in without it and deletes an outfit left with no pieces, in the same transaction, and the confirmation says so. The '+' menu's 'New outfit' opens the builder. Rulings: a category with a single garment keeps its arrows disabled (UC-8 E1) rather than turning to 'none' (A2); a record change from elsewhere still remounts the builder, since it is rare (a reload from the background, another tab) and the stage's canvases are now small; a missing `cutout` size falls back to 1.2 for the stage while the saved picture uses the real image, noted for the import milestone where such records can appear.
- **Tidy layout** (FR-66, FR-71). Outerwear left, tops over bottoms in the middle, dresses in the middle, shoes at the foot, bags and accessories in a right-hand column; pieces already on the canvas keep their place when new ones are added.
- **The picture** (FR-74). `app/pictures.js` draws the pieces in z order onto a 900 × 1200 canvas using the composited bitmaps and the same transform maths, trims it with a 3% margin, and stores it as JPEG colour plus PNG alpha, so outfit cards have a transparent background in both themes.

## 8. Ideas and weather

- **Context** (`app/ideas.js`): for a day, the forecast if there is one (band from `0.7 × high + 0.3 × low`: hot ≥ 23 °C, warm ≥ 17, mild ≥ 11, cool ≥ 5, else cold; rain when the chance is 45% or more or the weather kind is rain or snow), otherwise the season with its usual band.
- **Fit score** (`domain/suggest.js`): per garment, from its type and the words in its name and notes against keyword lists (warm, heavy, hot-only, layer, rain-good, rain-bad), its seasons, favourite, and how recently it was worn: worn in the last two days scores so low it is only chosen when nothing else fits (FR-91); not worn for 30 days scores up. Gone garments are excluded before scoring (FR-93).
- **Saved outfits** are scored by the average fit of their pieces with a bonus for outerwear when the day needs it and the outfit's seasons.
- **Compose**: dress or top plus bottoms, outerwear when the band is cool or cold or it is wet, shoes, a scarf or hat when cold, sunglasses or a cap when hot and clear, and a second top as a layer when cool or cold and the first top is not already warm (decision 11 in the requirements). The choice is deterministic for a given day and seed, so the home does not change each time it redraws; "Another idea" uses the next seed (FR-92).
- **Reason line** (FR-94) from the band, wet or dry and the temperature.
- **Weather** (`app/weather.js`): town search and forecast through `infra/net.js`, which only accepts the two Open-Meteo addresses and times out after 8 s. The forecast is kept in meta with a key of day plus position and a time; it is reused for three hours, and when offline it is reused at any age with a "from earlier" note (FR-87, FR-89).

*(Draft 8, as built:)* the band is judged by the day's high alone with the thresholds above (hot 23, warm 17, mild 11, cool 5), not by the 0.7/0.3 blend: the test plan's approved examples (24/14 hot, 13/6 mild) are judged by the high, and the high is what you dress for. Wet is a 45% chance or a kind of drizzle, rain, showers, snow or thunder. The season is meteorological (March to May spring, and so on), six months round when the town is south of the equator, and stands in with its usual band (spring mild, summer warm, autumn cool, winter cold) when there is no usable forecast. The fit score starts at 1 and moves by the keyword lists (types and words in the name and notes): on a wet day rain-bad pieces are out and rain-good ones gain 2; on a hot day heavy outerwear is out and warm pieces lose 3; warm days drop heavy pieces; cool and cold days drop hot-only pieces (shorts, sandals, vests) and reward warm ones; a garment's seasons add 0.8 or take it away; favourites add 0.3; worn in the last two days takes 10, so it is chosen only when nothing else fits; never worn, or not for 30 days, adds 0.5. "Worn" includes planned days, so Monday's plan keeps its pieces out of Tuesday's idea. A saved outfit is the mean of its pieces, plus 0.7 for outerwear when the day calls for it, plus or minus 0.5 for its seasons, minus 3 when worn in the last two days, and suits the day at 0.75 or more; the home lists up to four. Composing adds a seeded jitter under 1 to each score, so near-equal pieces take turns across seeds: a dress about one time in three when both routes are open, else the best top and bottoms; on a cool or cold day, about half the time, a light top (not a layer type, not warm) under a layer (cardigan, jumper, hoodie, sweatshirt, overshirt, gilet); outerwear when cool, cold or wet; shoes; a scarf, hat or gloves when cold; sunglasses or a cap when hot and dry. The seed is a hash of the day plus the number of times "Another idea" has been tapped for it this session, kept in `app/ideas.js`; "another" moves the seed on until the set of pieces differs (twelve tries at most), so the home never changes under the user's feet and the button always does something when the closet allows. The reason line is "<Band> and <wet|dry>, <high in the chosen unit>: <advice>" from a table of ten lines, and without a forecast "No forecast, so going by the season: autumn is usually cool. …". The weather module keeps `meta.weather` as `{ key: 'lat,lon' to two places, at, days[{ day, high, low, rain, kind, wind }] }`; `refresh()` returns the kept forecast while it is under three hours old, otherwise fetches, and one fetch is in flight at a time; a failed fetch leaves the kept one in use up to a day old, shown as "from earlier" (with "you're offline" when that was the cause), and after a day the season stands in and the note says why. Open-Meteo's daily codes become the kinds clear, partly, cloudy, fog, drizzle, rain, showers, snow and thunder. The home is the Closet's top (decision 10): `ui/screens/home.js` exports `todayCard`, which the Closet renders first (a fault in it is logged and the Closet goes on without it). Once something is logged for today, the card shows what was logged with "See day" instead of another idea. "Save as outfit" hands the pieces over through `app.builderSeed`, which the builder consumes when it opens for a new outfit, letting any old draft go. "This week" is the `week` screen (`#/week`), seven rows from today, each with the forecast's symbol, high and low, and either the plan (or what was worn today) or the idea with "Plan this" ("Wear this" on today), "Another" and "Choose my own", which opens the day sheet, now shared by the month and the week (`openDaySheet`). The month shows each forecast day's symbol and high in the cell's corner. The weather card on More searches Open-Meteo's town list (six matches, with region and country), says exactly what is sent, and offers "Change town" and "Stop using the weather" (the town and the kept forecast go). `infra/net.js` is the only `fetch`: https only, the two Open-Meteo origins only, eight seconds, `no-store`, no credentials; the tests replace the two calls through `window.aWardrobeTest.weather.mock`, which the app applies on every boot, so no test touches the network and C-7 stays at zero outside requests. The forecast is refreshed after boot and whenever the app comes back to the foreground, only when onboarded and a town is set.

*(Draft 8, the editor follow-up released with milestone 7:)* "Keep the whole photo instead" is now a command in the editing document rather than a flag the preview and the save ignored: ticking it fills the cut-out mask with every pixel kept (`whole`, labelled "keep the whole photo" for Undo), so the Eraser, Wand, Select, Restore and Paint work on the whole photo like any other; unticking is "back to the cut-out", which puts back the cut-out as it was when the box was ticked (hand fixes included), or cuts out afresh at the strength when the photo was opened whole or has since been turned, mirrored or cropped. The document carries `whole` as a flag that every command's undo record restores, so Undo of the tick, or of a strength run (which leaves whole-photo mode), keeps the box honest. The preview always draws the mask; the save decides by it: a mask with every pixel kept saves as a plain photo without an alpha, anything else as a cut-out. A saved whole photo opened with "Edit the cut-out" comes up whole, box ticked, tools ready. 

*(Draft 8, after the milestone 7 review:)* a change of town, or "Stop using the weather", while a forecast is in flight: the fetch is keyed by the town's position, a result for a town that is no longer set is dropped, and a caller wanting another town (or a forced refresh) gets a fresh fetch after the running one has settled, so a quick change of mind never leaves the new town without its forecast. The weather module has listeners (`on`) fired when a fetch ends, well or badly; `main.js` listens and redraws only what shows the forecast: the Today card in place on the Closet (the search keeps its text and focus), the calendar and the week whole, and More only when its search form is not open; the generic record listener ignores `meta/weather`, so a forecast landing never rebuilds a screen under the user's hands. "Another idea" also redraws in place (the card, or the one week row) and keeps the focus on the button, and says so when the closet allows no other combination. `setPlace` resolves once the town is written; the forecast follows behind and the listeners carry it. A forecast that fetched but could not be stored is kept in memory for the session. The band is still judged by the high, but a warm or mild day whose low is under 8 °C wants outerwear (a jacket, never a heavy coat on a warm day), which answers the 17/5 spring morning. Keyword matching is on whole words with the patterns compiled once ("machine wash" is no longer a mac, "buttons down the front" no longer a down coat). A saved outfit has to answer the day to be suited: a cold day wants outerwear, a cool day outerwear or something warm, a wet day outerwear or something that takes the rain. The jitter that lets near-equal pieces take turns comes from the seed and the garment's own id, so the order the closet is listed in, or a garment coming or going, never changes the others' chances. The week offers each day's suited outfits as well (up to three; one tap plans one), which FR-91 asks for. "Save as outfit" with a draft waiting in the builder asks first ("Carry on" keeps the draft, "Start afresh with this idea" the idea), as NFR-28 requires. What Open-Meteo sends is checked before it is trusted (`parseDaily`: missing arrays are a plain service error, a day without a high is dropped); the position goes to two decimal places and the privacy line says what the search sends. The error log keeps a fault reported again and again once. An empty closet still shows the weather or the season above its empty state. Copy: "low 8°" rather than "tonight", the chance of rain when it is 20% or more, and "from earlier" with the time. Accessibility: the week's forecast is an image with a label, the date button's name starts with its visible text, the search status is a live region, and the card's headings are second level.

## 9. Backup, restore and migration

### 9.1 The backup file (FR-100, NFR-18)

A zip file, `awardrobe-backup-YYYY-MM-DD.zip`, written with the "store" method (no compression, since JPEG and PNG are already compressed), containing:

```
manifest.json      { "app": "awardrobe", "format": 2, "exported": "…", "dataVersion": 1, "counts": { "garments": 184, "outfits": 23, "days": 310, "pictures": 575 } }
records.json       { "garments": [...], "outfits": [...], "days": [...], "prefs": {...}, "pictures": [{ "id", "kind", "width", "height", "bytes", "colour": "pictures/p_….jpg", "alpha": "pictures/p_….png" }] }
pictures/p_….jpg   the colour layer of each picture
pictures/p_….png   the alpha layer, where there is one
```

`domain/backup-format.js` writes it without ever holding the whole file in memory: the zip's headers are small buffers and each picture's stored blob is referenced as it is, so the result is a Blob made of parts, which the browser streams to the share sheet. Checksums (CRC-32, which zip requires) are computed in the worker by reading each blob in 1 MB slices. Reading works the same way backwards: the directory at the end of the file is read first, then each entry is a slice of the file, so a 500-garment backup restores a picture at a time. Limits: under 4 GB and under 65,535 entries, which is 20 times more than NFR-14's 500 garments. The format is documented in this section so another program could read it (NFR-29).

Restore (FR-101): "Add to mine" keeps the record whose `updated` is later when both sides have the same id; "Replace everything" clears all stores first. Each garment is written with its pictures in its own transaction, so an interrupted restore leaves whole garments, not halves, and the report counts what came in (FR-104).

*(Draft 9, as built in milestone 8:)* `domain/backup-format.js` lays the zip out exactly as above (store method, UTF-8 names, a local header before each entry, the directory and end record after them); `zipParts` returns the parts and `writeZip` wraps them in a Blob, so a picture is never read while packing. The checksums come from the image worker's `crc32` handler, which reads each blob in 1 MB slices (U-BAK-6 lays out 500 entries of 1 MB in a few milliseconds). Reading prefers the directory at the end and, when it is missing or broken, walks the local headers from the start, so a file cut short still gives up every whole entry and names the one that is cut; a byte changed in an entry fails its checksum and the entry is named; an entry packed with deflate by another tool is read through the browser's `DecompressionStream` where it has one. The manifest and records are validated (`validateManifest`, `validateRecords`): a wrong app or format is refused in plain words, a newer format says to update the app, unknown fields are ignored, records without an id are dropped and named. `app/backup.js` makes, saves, inspects and restores: a restore reads each garment's pictures from the file, has the worker check their checksums, and writes the record with its pictures in one transaction, so a damaged or missing picture skips that garment and names it, and a failed write stops the restore with the report saying how far it got (E-6 E3 injects the failure at the fourth write through the `failWriteNumber` hook). "Add to mine" keeps the copy whose `updated` is later, the one here when equal; "Replace everything" clears the four stores first, after a confirmation that says so. The settings come across whole when replacing or when the app held nothing; otherwise only the town, and only when none is set here. The reminder (`backupDue`) is due 30 days after the last backup or, with no backup ever, 30 days after the first garment went in, never with an empty closet; it is a dismissable notice at the top once per open and a line on the backup card. The share sheet on an iPhone must start from a tap: when packing took long enough for that tap to lapse, `infra/files.js` reports `blocked` and a "Your backup is ready" sheet asks for one more tap (Save); elsewhere the file is a download. The file is named `awardrobe-backup-YYYY-MM-DD.zip`.

*(Draft 9, after the milestone 8 review:)* "Replace everything" no longer clears the stores first: the file is brought in as an add in which the file's copy always wins, and only then is whatever the file does not hold removed, in one transaction with the pictures nothing points at any more, so a failure part-way (the storage full, the app closed) loses nothing; a record the file holds but could not be read keeps its copy here. A marker (`import` in `meta`) is written when a restore starts and removed when it ends, and an open that finds it still there shows a notice: the restore did not finish, restore the file again with Add to mine. A file that is cut short (no directory, or an entry that runs past the end) is said to be, and Replace everything is not offered for it. Before starting, the file's size is set against what the browser reports free and, when short, a sheet says so and asks whether to carry on. An outfit whose garment did not come in is drawn again without it and the report says so; one with no piece left is skipped and named; a day drops what did not come in and goes when nothing and no note is left, so nothing ever points at a record that is not there (NFR-27). A garment's reduced original is a bonus on restore: without it the garment still comes in. A failure of the photo tools themselves stops the restore (and is reported as such) rather than naming every remaining garment. Every restored record passes `sanitizeRecord` (domain/migrate.js), which checks each field's type and drops or coerces what is wrong, so a hand-edited or damaged file cannot leave a record the screens choke on. Change announcements are held back during a restore (`records.quiet`) and made once at the end, so the open screen redraws once rather than once per garment, and another tab reloads once. The last-backup line goes by the phone's own date. A backup leaves a picture it could not find out of its records too (the reference becomes null) rather than pointing at a file that is not there. The old database counts as found only when it holds something. The worker's checksum handler shares `crcOfBlob` with the domain; `pictureKind` lives with the other pixel rules in `domain/image/mask.js`; the data version is written on first open; the orphan sweep of section 4 is built.

### 9.2 Importing the old Wardrobe (FR-102 to FR-105)

The old file is JSON: `{ app: "wardrobe", format: 1, exported, prefs, items[], outfits[], days[], images[{ id, data: "data:image/png;base64,…" }] }`. `domain/migrate.js` maps it:

| Old | New |
|---|---|
| `items[]` | `garments[]`: `name`, `category`, `type`, `brand`, `size`, `price`, `bought`, `seasons`, `occasions`, `notes`, `favourite` carry over; `colours[{hex,name}]` become `{name, hex}`; `status` becomes `active` (the old app never used `archived`); `origin` is `wardrobe-import`; `pictures.original` is null (FR-105); `cutout.kind` is `photo` when the old picture has no transparent pixels, else `cutout`; `cutout.method` is `wardrobe-1`; `shape` is computed from the alpha. |
| `items[].image`, `.thumb` | the PNG is decoded in the worker, its colour and alpha split, the rim decontaminated (section 5.5 step 3), and both re-encoded as JPEG plus greyscale PNG. |
| `outfits[]` | `outfits[]`: `items[{id,x,y,w,z,rot,flip}]` become `pieces` with `garmentId`; `thumb` is converted like a picture. |
| `days[]` | `days[]`: `items` becomes `garments`; `planned` is true when the day is after today; `planAsked` false. |
| `prefs` | `prefs`: `place`, `tempUnit`, `currency`, `theme` carry over. |

Old ids are kept (prefixed: `g_` plus the old id) so importing twice does not double anything (FR-101 merge rule). Each garment is converted and written in its own transaction with progress shown; a picture that will not decode skips that garment and names it in the report (FR-104). A very large old file is parsed as one JSON string, which the old app itself produced on the same phone, so it fits; the direct route below avoids the file entirely.

*(Draft 9, as built:)* `domain/migrate.js` maps as the table says, with the same ids every time (`g_` and `o_` plus the old id; the two pictures `p_<image>` and `p_<image>t` from the one old image), so importing twice doubles nothing. Items without an id or a photo, outfits with nothing in them and days whose date cannot be read are named in the report. The old canvas measured `y` as a fraction of the width too (its `top` is `y / aspect` of a height that is `aspect` times the width), so pieces carry across one to one; the old `place` has `lat` and `lon`. The pictures are converted by the worker's `convertOld` handler (`convertOldPicture` in `infra/image-pipeline.js`): decoded, fitted to the 1200-pixel working size, the alpha split off, the kind judged by `pictureKind` (any pixel under 250 makes it a cut-out, so a JPEG kept whole stays a photo), the rim decontaminated as a fresh cut-out's is, then JPEG plus greyscale PNG, a 360-pixel thumbnail with its alpha, and the shape numbers from the alpha for the type guess. An outfit's picture is not taken from the old thumbnail but drawn afresh by `app.outfits.repaint` from the converted pieces, and an outfit keeps the pieces that came over, going only when none did; a day drops references to things that did not come over. The old file's pictures are data URLs decoded with `atob` (the page's policy allows no fetch of a `data:` URL); a photo that will not decode skips its garment and names it (UC-7 E1).

### 9.3 Direct copy from the old app (FR-103)

`infra/old-wardrobe.js` asks `indexedDB.databases()` whether a database named `wardrobe` exists in this browser profile, opens it without a version (so it is never upgraded), reads `items`, `outfits`, `days`, `images` and `meta` with read-only transactions, and closes it. The same mapping as 9.2 runs on the records, with the image blobs taken straight from the old store. The old database is never written to. On an iPhone, a home-screen web app has its own storage, so the database is only visible when both apps have been used in Safari itself; the offer appears only when the database is found.

*(Draft 9, as built:)* `findOldWardrobe` uses `indexedDB.databases()` where the browser has it and otherwise opens the database in a way that abandons the request if it would be created, so a device without the old app gains nothing (NFR-34, E-7 A3); `readOldWardrobe` reads the five stores in one read-only transaction and closes. The check runs at boot before the first screen; the offer is a card on the home until the copy is done or waved away (`oldCopied` and `oldOfferDismissed` in `meta`) and a button on the backup card for as long as the database is found. E-7 A1 reads the old database back after the copy and compares it, record for record and blob for blob.

## 10. Type recognition: the decision

The question from your brief: a proper on-device model, or shape heuristics?

| | A. Shape rules (the old way, tidied) | B. On-device neural model | C. Shape rules plus your own closet |
|---|---|---|---|
| What it is | Twelve numbers measured from the mask's outline (legs, shoulders, flare, aspect, holes) and a set of rules | A small image-classification model (for example a MobileNet trained on clothing photos) run in the browser with a runtime such as ONNX Runtime Web or TensorFlow.js | A, plus comparing the twelve numbers with those of garments you have already typed, nearest neighbours vote |
| Download size | 0 | 8 to 15 MB for the runtime (WebAssembly) plus 2 to 10 MB for the model, bundled with the app; the rest of the app is under 1 MB | 0 |
| Speed on a 2020 phone | under 5 ms | 100 to 400 ms per photo, plus a 1 to 3 s first load | under 5 ms |
| Accuracy on flat-lay photos | roughly 70 to 80% for the coarse category (top, bottoms, dress, shoes); weak on sub-types (shirt versus jumper) and on bags | potentially 90%+ for sub-types, but only with a model trained on clothing photos like yours; no trustworthy pre-trained clothing model is available to bundle, and training one needs a dataset and a machine-learning toolchain this project does not have (no Node, no Python packages) | starts at A's level and improves with every garment you add, because it matches against your clothes photographed your way; sub-types improve too ("like your other jumpers") |
| Fits the constraints | yes | strains them: a large binary with no build step, a runtime that must be vendored and kept up to date, and a model nobody can retrain here | yes |
| Explains itself | "going by the two legs" | no | "going by the two legs" or "like your other jeans" |

**Decision: C.** The rules give a reason you can see, the neighbour vote makes the guess personal and better over time, and nothing is downloaded. The guess sits behind one function, `guessType(features, examples)`, and `garment.shape` is stored on every garment, so a model could be swapped in later without touching the UI or the data. I am not recommending B now because its size is ten times the app, its speed is on the edge of the budget, and above all there is no clothing model to bundle that I could verify works on home photos.

## 11. Error handling

Four kinds of error, each with one place it is handled and one plain message:

| Kind | Raised by | What the user sees | What the app does |
|---|---|---|---|
| `UserError` (expected: a missing name, nothing selected, crop too small) | app and domain | the message itself, inline or as a toast | nothing to recover |
| `ImageError` (a photo that will not decode) | worker, decode | "That photo couldn't be opened. If it is a HEIC photo, choose JPEG in the camera's format settings" (FR-28) | stays on the add screen |
| `StorageError` (quota, blocked, unavailable) | infra/db | "There isn't enough space to save this. Free some space or take a backup first" / the memory-only banner (FR-113) | keeps the draft; nothing half-written (NFR-27, NFR-28) |
| `NetworkError` (Open-Meteo down, offline, timeout) | infra/net | "No forecast right now: ideas go by the season" (FR-89) | uses the cached forecast or the season; retries on the next open |

Rules:
- `app` functions throw typed errors; screens catch at the action (a button handler) and show the message. Unknown errors become "Something went wrong" with a Reload option, are written to `meta.errors` (time, screen, message, first lines of the stack, last 20), and show on the More page under "Report a problem" so you can copy them to me (FR-115).
- The shell wraps each screen's render, so a crash in one screen shows the page-level message with "Go to Closet" and never a blank screen (FR-115).
- The worker reports errors with the command that caused them; if the worker itself dies, `worker-client` starts a new one and the editor reloads the document from the draft, telling you "The editor restarted; your last change may be lost". This should never happen; it is the safety net. *(Draft 3:)* every worker call also has a time limit (open 20 s, cut-out 10 s, save 15 s, anything else 10 s); when it runs out the caller gets "took too long", the worker is replaced, and after three replacements the client answers "keeps failing" so the app can fall back to the main thread.
- Every write transaction has an `onabort`; an abort is a `StorageError`.
- Boot order is fail-soft: theme, shell, then database (failure means memory-only mode), then records, then the screen, then the service worker (failure means no offline, with a console note), then idle work.

## 12. Performance budgets and how the design meets them

| Budget | Where | How it is met | How it is measured (Phase 4) |
|---|---|---|---|
| 12 MP photo to cut-out on screen under 2 s, no freeze over 100 ms (NFR-7) | UC-1 | decode, reduce and segment in the worker; analysis at 320 px; classification with typed arrays | a timer round the open-to-preview path in the test harness with a generated 12 MP photo; a long-task observer on the main thread |
| Brush stroke segment under 16 ms (NFR-8) | UC-2 | points sent once per frame; the worker paints a disc per point; only the changed box comes back; the overlay shows the stroke instantly | time from pointer event to view redraw for a 500-point stroke |
| Pan and zoom at 60 fps (NFR-8) | UC-2 | one `drawImage` of the work canvas with a transform; no per-pixel work during gestures | frame times during a scripted pinch |
| Wand, strength, re-cut under 500 ms (NFR-9) | UC-2 | flood fill with a visited array; segmentation as 5.2 | timers in the worker |
| Save under 1.5 s (NFR-10) | UC-1 | edges at working resolution; two encodes; one transaction | timer from "Add to closet" to the garment page |
| Closet of 300 opens under 1.5 s (NFR-11) | UC-10 | records read whole at boot (about 200 KB); thumbnails drawn only when visible; cached bitmaps | timer from navigation to first paint with 300 generated garments |
| Builder at 60 fps with 8 pieces (NFR-12) | UC-3 | CSS transforms on elements; gesture maths only | frame times during a scripted twist |
| Under 250 MB of memory in the editor (NFR-13) | UC-2 | one working copy (7.7 MB) in the worker plus one preview copy; the undo budget of 40 MB; the reduced original is encoded at once and dropped | `performance.memory` where available; Safari's Web Inspector on the phone for the manual check |
| 1.5 MB per garment (NFR-14) | storage | JPEG colour plus greyscale alpha; sizes in NFR-16 | the average over the generated test set and your real closet after import |

## 13. Privacy and security mechanics

- **Content security policy** (NFR-2, NFR-4): `index.html` carries a `<meta http-equiv="Content-Security-Policy">` with `default-src 'self'; connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com; img-src 'self' blob: data:; worker-src 'self'; script-src 'self'; style-src 'self'; base-uri 'self'; form-action 'none'`. The browser then refuses any other connection, whatever the code does. A test reads the policy and checks the list. Consequence for implementation: styles are set through element properties, never through `style="…"` strings, and there are no inline scripts.
- **Service worker scope** is `./` under `/awardrobe/`, so it never serves or caches the other apps' addresses. Open-Meteo responses are never cached by the worker; the app keeps its own three-hour copy.
- **No third-party code** (NFR-3): fonts are woff2 files in `fonts/`; icons are inline SVG; no analytics.
- The privacy statement on the More page is generated from the same list of allowed addresses, so it cannot drift from the policy (FR-112).

## 14. The new look

The design is in the mockups (`docs/mockups/aWardrobe-mockups.html`, screenshots alongside). The direction, in words:

- **Pattern paper.** The world of the app is the dressmaker's table: pattern-cutting paper with its faint dot grid, blue ink lines, a tape measure. The editor and the outfit canvas are a "stage" of dotted paper on which cut-outs sit with a soft shadow, so a cut-out looks like a real garment laid out, not a sticker on a web page.
- **One family of type.** Bricolage Grotesque throughout: its large display cut for screen titles and the big numbers, its text cut for everything else. One family keeps the app calm; the display cut gives it a face. No serif, so it does not look like the old app or like the default "editorial" page.
- **Colours.** Paper `#F4F4F1`, Ink `#16213A` (a deep blue-black, the ink), Graphite `#4F5566` for secondary text, Rule `#D8DAD3` for lines, and one accent, Tape `#F3C94A`, the yellow of a tape measure, used for the thing you are acting on: the selected tool, the strength tape, a planned day, the primary button. Text on Tape is always Ink (contrast 9:1). Dark mode turns the paper into ink: surfaces `#121827` and `#1B2235`, text `#F4F4F1`, muted `#9AA3B5`, lines `#2C3448`, Tape unchanged.
- **The signature element** is the strength control: drawn as a tape measure with ticks, from "keep more" to "remove more". Everything else is quiet.
- **Structure.** Screen titles are large and left-aligned with the count in plain words under them ("184 pieces"). Garment cards have no boxes: the cut-out, then the name. The tab bar is five items with Add in the middle as a Tape circle. Sheets slide up for pickers and confirmations. Motion only answers an action (a sheet opening, an idea replaced, a piece snapping into the tidy layout) and respects reduced motion.
- **Accessibility built in** (NFR-19 to NFR-23): 44 px targets, labels on every control, focus rings in Tape on Ink, the tool bar as a radio group that announces the selected tool, text sizes in rem so the phone's text size scales them. *(Draft 10, as built in milestone 9:)* every text size in the three stylesheets is in rem (the same look at 16 px); `html { font: -apple-system-body }` makes the root size follow the iPhone's text size setting, so everything scales with it; a probe one rem wide watched by a ResizeObserver marks `html[data-text="large"]` at 150% and up, under which the tab bar shows icons alone (the labels stay for screen readers), the editor's tool grid takes wider cells and a page title may wrap; the month grid's badge and day number are capped by the cell's width with container-query units (the week carries the forecast at full size). C-9 checks names and 44 px targets through the browser's accessibility tree on every screen and sheet; C-11 checks the six mockup screens at 200%. The version on More reads "Version 1.0 (build 16)": `RELEASE` is the name, `VERSION` the build that names the offline copy. Also found in this pass: twenty-one uses of two colour tokens that never existed (`--line`, `--card`), now `--rule` and `--raise`; and the calendar's today marker sharing a class name with the Today card's rules. *(Draft 10, after the milestone 9 review:)* the Dynamic Type keyword is scoped to iOS and iPadOS (`@supports (-webkit-touch-callout: none)`), because on a Mac it would shrink the app to 13 pt; on an iPhone at the default setting the root is 17 px, so everything is about 6% larger than the 16 px mockups, a decision recorded rather than a bug. Two levels of large text: `large` from 150% (wider cells, a wrapping title, every form field on its own row) and `xl` from 175% (the tab bar's labels give way to the icons on a phone, never in the desktop sidebar); the tab labels grow only a little (`min(0.6875rem, 3vw)`). Buttons wrap their labels and never exceed their row; the date field no longer keeps a content-based width; the segmented controls, the strength labels and the garment page's last row wrap; the tool grid takes two columns at xl; the weekday names are capped by the screen width. At large text the month cells drop their aspect ratio and grow with what is in them. Contrast: today's number is ink, a danger button's text is paper, a toast's action is underlined in the toast's own colour, placeholders are graphite, the selected tool has an ink edge, dimmed tools are at 80%. The calendar says "today" in the cell's label; the builder's selected piece carries `aria-pressed`. C-11 now measures against the layout width (the emulated phone's `innerWidth` grows with an overflow), checks vertical clipping too, and runs a second pass at 331%, the iPhone's largest accessibility size, on the six screens; the C-9 walk reports a state it cannot reach and carries on.

Tokens live in `ui/tokens.css`; the mockups use the same values, so the build copies rather than reinterprets them.

## 15. Trade-offs considered and rejected

1. **One PNG with transparency per picture** (as the old app). Simplest to display, but 3 to 5 MB per cut-out at 1200 px; the budget needs colour and alpha stored separately (5.6).
2. **Keeping the full camera original.** 3 to 5 MB each; you chose the reduced copy in Phase 1.
3. **Editing on the main thread with the worker only for the first cut-out.** Simpler messaging, but every heavy tool (wand, skin, re-cut, rotate) would freeze the screen for 50 to 500 ms, and the "one source of truth" would be lost. The worker owns the document (6.1).
4. **SharedArrayBuffer** to share the mask between threads with no copying. Needs security headers that GitHub Pages cannot set. Dirty rectangles achieve the same effect.
5. **Snapshots for every undo step.** Easiest to write, but 10 MB per step for geometry commands would blow the memory budget after four steps. Compact undo records with a byte budget (6.3).
6. **A framework (React, Vue, Svelte).** All need a build step or a large runtime; plain modules with a small `h()` and a keyed list patcher are enough for this app and keep the no-build rule.
7. **A neural model for type recognition.** Section 10.
8. **The old JSON backup format.** One giant text with pictures inside; a 500-garment closet would be a 700 MB string that a phone cannot hold. The zip of blobs streams (9.1), and the old format still imports.
9. **Secondary indexes in IndexedDB.** Not worth it below a few thousand records; everything is in memory after boot.
10. **A separate "Today" tab.** The home with today's idea is the Closet's top; a sixth tab would push the others off a narrow screen.
11. **Mermaid diagrams in these documents.** They render on GitHub but not in every viewer; the plain diagrams here render everywhere.

## 16. Decisions you can overturn

*(Draft 8:)* the temperature thresholds (hot 23, warm 17, mild 11, cool 5, judged by the day's high) and the chilly-morning rule (outerwear when the low is under 8) are numbers you can move once you have lived with the ideas for a while; so are the keyword lists in `domain/suggest.js`, which are deliberately short and British.

*(Draft 9:)* the backup reminder's 30 days and the rule that a never-backed-up closet is reminded 30 days after its first garment; the settings rule on "Add to mine" (only the town, and only when none is set); and "Replace everything" asking a plain confirmation rather than a typed word, since the file about to be restored is itself a safety copy.

1. Brush sizes small, medium and large are 14, 28 and 56 screen pixels.
2. The undo budget is 50 commands and 40 MB; the draft is written at most every two seconds.
3. Thumbnail caches of 80 and full-size caches of 12 bitmaps.
4. JPEG quality 0.86 for cut-outs, 0.82 for reduced originals, 0.80 for thumbnails.
5. The strength's `lean` curve (1.7, 1.0, 0.55) and the segmentation thresholds in 5.2; the test set in Phase 4 will tune them and the numbers will be updated here.
6. Shuffle probabilities in section 7.
7. The temperature bands and the two-day and 30-day wear rules in section 8 (as the old app).
8. The design direction in section 14: paper and ink with a tape-measure yellow. The mockups show it; say what you would change.

## 17. Glossary additions

- **Module:** a JavaScript file that lists what it imports; the browser loads them in order with no build step.
- **Worker (Web Worker):** a background thread; code that runs alongside the screen so heavy work does not freeze taps.
- **OffscreenCanvas:** a canvas that lives in a worker, used to decode, resize and encode pictures there.
- **ImageBitmap:** a decoded picture the browser can draw fast; the pictures cache holds these.
- **Transaction:** a group of database writes that either all happen or none do.
- **k-means:** a method that finds the k most representative colours in a set of pixels.
- **OKLab, OKLCh:** a colour space where distances match what the eye sees; OKLCh is the same colour as lightness, chroma (colourfulness) and hue.
- **Dirty rectangle:** the box around the pixels a command changed; only that box is sent back and redrawn.
- **Run-length encoding:** storing "255 × 3,000 then 0 × 1,200" instead of each byte; masks shrink 20 to 100 times.
- **CRC-32:** the checksum zip files require for each entry.
- **Content security policy:** a rule the page declares telling the browser which addresses it may contact.
- **Device pixel ratio:** how many screen pixels make one CSS pixel (3 on most iPhones).

## 18. What happens next

When you approve this document and the mockups (with any changes), Phase 4 writes the test plan: unit tests for the pure modules, the generated test images with expected masks and coverage, one end-to-end scenario per use case, the manual phone checklist, and the performance measurements, every test naming the FR or UC it covers.
