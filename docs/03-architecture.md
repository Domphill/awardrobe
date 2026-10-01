# aWardrobe: Architecture and Design

Phase 3 of 5. Draft 1, written 1 October 2026, waiting for your approval. Builds on `01-requirements.md` (Draft 2) and `02-use-cases.md`.

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
| `ui/screens/home.js` | Today's weather, the reason line, suited outfits, the idea with its three buttons (FR-90). |
| `ui/screens/closet.js` | Cards, count, search, category chips, sort, filters, the gone list (FR-1 to FR-9). |
| `ui/screens/garment.js` | The garment page (FR-10 to FR-19). |
| `ui/screens/garment-edit.js` | The add/edit screen: photo box, the editor, the details form (FR-20, FR-59 to FR-62). |
| `ui/screens/editor/stage.js` | The editor's drawing: view canvas, work canvas, overlay, checkerboard; turns pointer events into image coordinates using the one mapping function; zoom and pan gestures (FR-32 to FR-34). |
| `ui/screens/editor/tools.js` | The tool palette and each tool's option panel: strength tape, brush sizes, wand slider, rotate controls, crop handles, paint colour (FR-35 to FR-48). |
| `ui/screens/outfits.js` | The outfits list (FR-63). |
| `ui/screens/builder/stage.js` | The outfit canvas: pieces as elements with transforms, one-finger drag and resize, two-finger twist and pinch, selection (FR-64, FR-65). |
| `ui/screens/builder/mixer.js` | Mix and match: the revolver per slot with previous and next visible, add and remove slots, shuffle (FR-68 to FR-70). |
| `ui/screens/calendar.js` | Month grid, day sheet, the "This week" view, the passed-plan question (FR-78 to FR-85). |
| `ui/screens/stats.js` | Stats (FR-96 to FR-99). |
| `ui/screens/more.js` | Backup, restore, import, weather, appearance, storage, about, delete everything (FR-100 to FR-112). |
| `ui/screens/welcome.js` | First open (FR-109). |
| `ui/tokens.css`, `ui/base.css`, `ui/components.css`, `ui/screens.css` | The design system: tokens (colours, type, spacing, radii, motion), base styles, components, screens. Light and dark. |

### 2.2 app/

| File | Responsibility |
|---|---|
| `app/records.js` | Keeps every garment, outfit and day record in memory after boot, writes changes through the database, and announces changes so screens refresh. |
| `app/garments.js` | Add, change, delete, mark gone, bring back; turns an editor session's result into a saved garment with its three pictures in one transaction (FR-61); redo from the reduced original (FR-31). |
| `app/outfits.js` | Save with the rendered picture, delete with the day rule (FR-74, FR-77). |
| `app/days.js` | Log and plan; the wear map (wears and last worn per garment and outfit); the passed-plan question (FR-80, FR-81). |
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
- `drafts` holds at most two records: the editor draft and the builder draft (FR-49). The editor draft keeps the working photo as JPEG, the mask as PNG, the form fields, the strength and the tool state; it is written at most once every two seconds while editing and removed on save or discard.

### 3.6 Database layout

Database `awardrobe`, version 1, with stores `garments`, `outfits`, `days`, `pictures`, `meta`, `drafts`, each keyed by `id` (meta by `key`). No secondary indexes: the record stores are small and are read whole at boot (300 garments are about 200 KB of JSON); only pictures are read on demand. `dataVersion` in meta, not the IndexedDB version number, drives migrations, so a future layout change is a normal code path with tests (NFR-29).

## 4. Storage scheme

- **Writes are all-or-nothing** (NFR-27). Each use case that touches several stores runs as one IndexedDB transaction: saving a garment writes its record and its three pictures together; deleting a garment removes its record, its pictures, and its entries in every outfit and day together; saving an outfit writes the record and its picture together. If any part fails the browser rolls the whole transaction back.
- **Records in memory.** `app/records.js` loads garments, outfits and days at boot and keeps them in maps. Reads are instant; writes go to the database first and update the maps when the transaction completes. Screens subscribe to changes.
- **Pictures on demand.** `app/pictures.js` loads a picture's blobs, decodes them, composites colour with alpha, and caches the result as an ImageBitmap (a decoded picture the browser can draw fast). Two caches: thumbnails (up to 80, about 60 MB) and full cut-outs (up to 12, about 90 MB). Cards draw into a small canvas when they scroll into view (NFR-11).
- **Orphans.** At boot, in idle time, pictures referenced by no garment, outfit or draft are deleted (NFR-27). An import in progress is marked in meta so its half-done pictures are not swept.
- **Storage limits** (NFR-17). Before saving a garment, importing or restoring, the app reads `navigator.storage.estimate()`; above 80% it warns; a quota error during a transaction surfaces as a storage error with the draft kept.
- **Persistent storage** (FR-109). After the welcome, `navigator.storage.persist()` is requested so the browser does not clear the data under pressure. Installed home-screen apps get it without a prompt.
- **Browser storage keys.** Only `awardrobe.theme` in localStorage (so the theme applies before the database opens). Everything else is in the database. Nothing else in localStorage, so the other apps on the site are untouched (NFR-34).
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
2. **Background model.** Pixels in a border band (6% of the shorter side) are grouped by k-means (a method that finds the k most representative colours) with k = 6, then groups closer than 0.03 are merged. This gives several background shades, so folds, shadows and a lighting gradient all count as background (FR-24).
3. **Garment model.** Pixels in the middle 22% to 78% box that are further than 0.11 from every background shade are grouped with k = 5. Too few such pixels (under 0.4% of the image) means no garment was found: fall back to the border flood fill (the old method), and if that also fails the coverage check, keep the whole photo (FR-27).
4. **Confidence.** For each garment shade, its distance to the nearest background shade; the share-weighted median of those distances is the separation. Separation under 0.08, or more than a quarter of middle pixels being ambiguous (nearly the same distance to both models), sets `lowContrast`, which the UI shows as the pale-on-pale warning before any fixing starts (FR-26).
5. **Classification** at full working resolution: a pixel is garment when its distance to the nearest garment shade is less than `lean × ` its distance to the nearest background shade. `lean` comes from the strength (FR-25): 1.7 at "keep more" (0), 1.0 in the middle (50), 0.55 at "remove more" (100), varying smoothly.
6. **Tidy.** Majority smoothing twice (each pixel goes with most of its neighbours), drop kept specks smaller than 0.3% of the image unless they are the largest piece, fill enclosed holes smaller than 4% of the image, drop garment pieces smaller than 1% that are separate from the main piece.
7. **Output.** The mask (one byte per pixel, 0 or 255), coverage, `lowContrast`, the dominant background colour in sRGB (for white balance), and the method name `seg-2` recorded on the garment.

Cost on a 2020 phone: analysis about 25 ms, classification 60 to 120 ms (1.9 million pixels against 11 shades), tidy 80 to 120 ms. With decoding and reducing, a 12-megapixel photo is on screen as a cut-out in 0.6 to 1.2 s, inside the 2 s budget (NFR-7).

### 5.3 Colours (step 6)

`domain/colour/palette.js`, as the old app's method with the rules made explicit (FR-53 to FR-56):

- Samples pixels that are fully inside the mask (at least 3 px from its edge), at most 9,000 of them.
- White balance: if the dominant background colour is near neutral (chroma under 0.06 and lightness over 0.45), each channel is scaled so that colour becomes grey, with gains clamped to 0.7 to 1.45 (FR-54). A coloured background (a red sheet) gives no correction.
- Groups with k-means in OKLab (k from 2 to 6 by sample count), then merges groups that are the same fabric in different light: same hue within 20°, chroma within 0.06, any lightness (FR-55). Neutral groups merge when their lightness differs by less than 0.22.
- Each group's swatch is the average of its lighter half, so the chip shows the fabric, not its shadow. Groups under 7% of samples are dropped after the first. Up to three, main colour first.
- Names come from `naming.js`, which looks up lightness, chroma and hue against the 26-name table from the old app; the thresholds are tuned by the colour test set (NFR-39).

### 5.4 Type guess (step 7)

See section 10 for the decision. `shape.js` computes twelve numbers from the mask (height to width ratio, leg split share, top solidity, shoulder to waist ratio, bottom flare, left-right symmetry, solidity, hole share, widest row position, narrowest row position, top width, bottom width) and gives a rule-based guess with a reason. `app/garments.js` then compares the twelve numbers with those stored on your other garments and, when at least three close neighbours agree, prefers their answer ("like your other jeans"). The guess never overwrites a chosen category or type (FR-57).

### 5.5 The final cut-out (step 9)

`domain/image/edges.js` runs once, at save (FR-29, FR-30):

1. Erode the mask by one pixel: the outermost ring of kept pixels is always a blend with the background, so it goes.
2. Feather: the alpha is the eroded mask blurred by about 1.5 px, so edges are soft but not fuzzy.
3. Decontaminate the rim: for pixels that are partly transparent and for a 3 px band outside them, the colour is replaced by the nearest fully-opaque garment colour (four passes of copying from opaque neighbours). This removes the halo of background colour and, because the invisible surround now matches the garment, stops JPEG compression from bleeding dark or background colour into the edge.
4. Trim to the alpha's bounding box with a 3% margin.
5. Encode: colour as JPEG quality 0.86, alpha as 8-bit greyscale PNG (section 5.6).
6. Thumbnail: the trimmed result reduced to 360 px long side, encoded the same way.

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

A stroke is one command from finger down to finger up, however many points it has, so one Undo removes the whole stroke. Points arrive in the worker once per animation frame and the reply is the box that changed. The stack keeps up to 50 commands and 40 MB; the oldest records drop first when the budget is reached, which still leaves at least 20 steps in the worst case (20 × 2 MB). Undo and Redo buttons show "Undo crop", "Redo brush stroke" from the labels.

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

Snapping in Select (FR-36): a select stroke grows from the brush disc only across kept pixels within 2.5 × the brush radius whose colour is within the wand tolerance of the colour under the finger, so the selection stops at the garment's edge.

### 6.5 Drafts (FR-49)

`app/drafts.js` saves the editor document (photo as JPEG, mask as PNG, selection dropped, form fields, strength, tool) at most every two seconds after a change and on `visibilitychange` (the phone sending the app to the background), and removes it on save or discard. On opening the add screen, an existing draft is offered: "Carry on with the jumper you were cutting out?" The builder draft is the pieces, slots and form fields as JSON.

## 7. The outfit builder

- **Pieces** are elements inside a stage with a fixed 3:4 ratio; position and width are fractions of the stage width, so the same outfit renders the same on any screen and in the saved picture. Each piece's CSS transform is `translate(x, y) rotate(rot) scaleX(flip ? -1 : 1)`; the picture inside is the garment's composited cut-out drawn into a canvas.
- **Gestures** (FR-64, FR-65). Pointer capture per piece. One pointer: drag moves, drag on the corner handle resizes. Two pointers on a piece: `geometry.gestureTransform(start, now)` gives the change in angle and distance since the two fingers landed, applied to the piece's rotation and width live; the angle box in the tool bar updates on every frame. Resizing clamps width to 12% to 100% of the stage; a piece can be pushed half off the edge but no further.
- **Commands** (FR-72). Add pieces, Take off, Transform (one per gesture: from and to values), Layer (front or back), Tidy, Slot turn, Slot add, Slot remove, Shuffle (records the chosen garments so Redo gives the same result). Undo records are the previous values as JSON.
- **Slots and the revolver** (FR-67 to FR-69). A slot is `{ id, category, pieceId }`. The mixer shows one row per slot: the previous and next candidates at either side of the current one, dimmed and smaller; a swipe or arrow is a Slot turn that replaces the piece with the next garment in that category (newest first, with "none" at the end of the ring), keeping the position, width and angle. "Add a slot" asks for a category and adds a slot even if one exists, which is how two tops are layered. Gone garments are not candidates (FR-15).
- **Shuffle** (FR-70). With a seeded random number generator (so Redo repeats it): a dress 30% of the time when there are dresses, otherwise a top and bottoms; a second top as a layer 33% of the time when there are at least two tops; outerwear 50%; shoes when there are any; a bag 35%; an accessory 35%; jewellery 25%. The pieces are laid out by `domain/layout.js`, with a layered top offset a little and above the first.
- **Tidy layout** (FR-66, FR-71). Outerwear left, tops over bottoms in the middle, dresses in the middle, shoes at the foot, bags and accessories in a right-hand column; pieces already on the canvas keep their place when new ones are added.
- **The picture** (FR-74). `app/pictures.js` draws the pieces in z order onto a 900 × 1200 canvas using the composited bitmaps and the same transform maths, trims it with a 3% margin, and stores it as JPEG colour plus PNG alpha, so outfit cards have a transparent background in both themes.

## 8. Ideas and weather

- **Context** (`app/ideas.js`): for a day, the forecast if there is one (band from `0.7 × high + 0.3 × low`: hot ≥ 23 °C, warm ≥ 17, mild ≥ 11, cool ≥ 5, else cold; rain when the chance is 45% or more or the weather kind is rain or snow), otherwise the season with its usual band.
- **Fit score** (`domain/suggest.js`): per garment, from its type and the words in its name and notes against keyword lists (warm, heavy, hot-only, layer, rain-good, rain-bad), its seasons, favourite, and how recently it was worn: worn in the last two days scores so low it is only chosen when nothing else fits (FR-91); not worn for 30 days scores up. Gone garments are excluded before scoring (FR-93).
- **Saved outfits** are scored by the average fit of their pieces with a bonus for outerwear when the day needs it and the outfit's seasons.
- **Compose**: dress or top plus bottoms, outerwear when the band is cool or cold or it is wet, shoes, a scarf or hat when cold, sunglasses or a cap when hot and clear, and a second top as a layer when cool or cold and the first top is not already warm (decision 11 in the requirements). The choice is deterministic for a given day and seed, so the home does not change each time it redraws; "Another idea" uses the next seed (FR-92).
- **Reason line** (FR-94) from the band, wet or dry and the temperature.
- **Weather** (`app/weather.js`): town search and forecast through `infra/net.js`, which only accepts the two Open-Meteo addresses and times out after 8 s. The forecast is kept in meta with a key of day plus position and a time; it is reused for three hours, and when offline it is reused at any age with a "from earlier" note (FR-87, FR-89).

## 9. Backup, restore and migration

### 9.1 The backup file (FR-100, NFR-18)

A zip file, `awardrobe-backup-YYYY-MM-DD.zip`, written with the "store" method (no compression, since JPEG and PNG are already compressed), containing:

```
manifest.json      { "app": "awardrobe", "format": 2, "exported": "…", "dataVersion": 1, "counts": { "garments": 184, "outfits": 23, "days": 310, "pictures": 575 } }
records.json       { "garments": [...], "outfits": [...], "days": [...], "prefs": {...}, "pictures": [{ "id", "kind", "width", "height", "colour": "pictures/p_….jpg", "alpha": "pictures/p_….png" }] }
pictures/p_….jpg   the colour layer of each picture
pictures/p_….png   the alpha layer, where there is one
```

`domain/backup-format.js` writes it without ever holding the whole file in memory: the zip's headers are small buffers and each picture's stored blob is referenced as it is, so the result is a Blob made of parts, which the browser streams to the share sheet. Checksums (CRC-32, which zip requires) are computed in the worker by reading each blob in 1 MB slices. Reading works the same way backwards: the directory at the end of the file is read first, then each entry is a slice of the file, so a 500-garment backup restores a picture at a time. Limits: under 4 GB and under 65,535 entries, which is 20 times more than NFR-14's 500 garments. The format is documented in this section so another program could read it (NFR-29).

Restore (FR-101): "Add to mine" keeps the record whose `updated` is later when both sides have the same id; "Replace everything" clears all stores first. Each garment is written with its pictures in its own transaction, so an interrupted restore leaves whole garments, not halves, and the report counts what came in (FR-104).

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

### 9.3 Direct copy from the old app (FR-103)

`infra/old-wardrobe.js` asks `indexedDB.databases()` whether a database named `wardrobe` exists in this browser profile, opens it without a version (so it is never upgraded), reads `items`, `outfits`, `days`, `images` and `meta` with read-only transactions, and closes it. The same mapping as 9.2 runs on the records, with the image blobs taken straight from the old store. The old database is never written to. On an iPhone, a home-screen web app has its own storage, so the database is only visible when both apps have been used in Safari itself; the offer appears only when the database is found.

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
- The worker reports errors with the command that caused them; if the worker itself dies, `worker-client` starts a new one and the editor reloads the document from the draft, telling you "The editor restarted; your last change may be lost". This should never happen; it is the safety net.
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
- **Accessibility built in** (NFR-19 to NFR-23): 44 px targets, labels on every control, focus rings in Tape on Ink, the tool bar as a radio group that announces the selected tool, text sizes in rem so the phone's text size scales them.

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
