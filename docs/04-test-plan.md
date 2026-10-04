# aWardrobe: Test Plan

Phase 4 of 5. Draft 4, 2 October 2026. Draft 1 was approved on 1 October 2026; Draft 2 added the tests from `05-plan.md` section 12 (U-SEG-11, U-SEG-12, U-MOD-11, U-SRCH-6, C-9, and steps in E-1, E-10 and E-16) and the small harness-level tests for the database, formatting and routing modules that building milestone 1 showed were worth having (section 3.16). Draft 3 records the tests the milestone 2 review added: U-SEG-13 to U-SEG-19, U-EDGE-6, the thumbnail check in U-EDGE-5, the pastel cases in U-COL-5, the reversed strong-bulb case in U-COL-4, and the unit-level part of P-1. Draft 4 records milestone 3: the scenarios for adding, finding and deleting garments live in `dev/e2e-garments.js`, the performance tests in `dev/perf.js`, seeded closets and photo files in `dev/fixtures.js`, and `dev/scenario.ps1` runs one scenario by name; the changes to E-1, E-10, E-17 and P-8 are noted in place. After the first phone checks it adds U-SEG-20 to U-SEG-22 (a garment touching all four edges, the FR-27 amendment, and real photos from `dev/real-photos` run and reported; `dev/try-photo.ps1` shows one such photo at three strengths). Draft 5 (3 October 2026) records milestone 4: the harness tests for the worker's editing document (section 3.17, U-DOC-1 to U-DOC-7), the editor scenarios in `dev/e2e-editor.js` (E-2, E-11), the parts of E-1 that waited for the editor, P-2, P-3 and P-7 in `dev/perf.js`, and `dev/shots-m4.ps1` for the editor's look check; the changes are noted in place. Draft 6 (4 October 2026) records milestone 5: `dev/tests/layout.test.js` and `dev/tests/builder.test.js` (U-BLD-1 to U-BLD-3, section 3.18), the builder scenarios in `dev/e2e-outfits.js` (E-3, E-8), the outfit half of E-17, P-6, `builderSet` in `dev/fixtures.js` and `dev/shots-m5.ps1`; the changes are noted in place.

## 0. How to read this

- Every test has an id and names what it covers: a requirement (FR-n or NFR-n) or a use case (UC-n). Section 9 is the reverse table: every FR with the tests that cover it, generated and checked by a script.
- Five kinds of test:
  - **Unit tests (U-…)** call one pure function with known values and check the answer. They cover the `domain` modules.
  - **End-to-end tests (E-…)** drive the real app in headless Edge, one per use case, following the use case's main flow step by step.
  - **Checks (C-…)** test rules about the code and the site: import directions, the content security policy, the service worker, storage names, console errors, outside requests.
  - **Performance tests (P-…)** measure the budgets on this PC, with PC limits set tighter than the phone's.
  - **Manual checks (M-…)** are a checklist you tick on your phone for what a PC cannot do: the camera, the share sheet, gestures, VoiceOver, real weather, real photos.
- Section 1 says how the tests run and what "run and shown" means (NFR-40). Section 2 describes the generated test images.

## 1. How the tests run

### 1.1 The harness

Everything lives in `dev/`, which stays out of git (NFR-36). It is copied from the old app's pattern and extended:

| File | What it does |
|---|---|
| `dev/cdp.ps1` | Drives headless Edge over the Chrome DevTools Protocol (copied from the old app): open a page, run JavaScript in it, take a screenshot, collect console messages and exceptions, and, new, log every network request. |
| `dev/test.ps1` | The one command. Starts a local web server on the repo folder, then runs the phases in order: checks, unit tests, end-to-end tests, performance tests, offline test. Prints one line per test, a summary, and exits with a non-zero code on any failure. Options: `-Shots <folder>` saves screenshots, `-Soak` adds the long storage test, `-Only <phase>` runs one phase. |
| `dev/unit.html` and `dev/runner.js` | A page that imports the app's modules from the four layer folders (`ui/`, `app/`, `domain/`, `infra/`) and the test files from `dev/tests/`, runs them with a tiny runner (`test(id, name, fn)`, `expect(...)`, async allowed), and exposes the results as JSON for `test.ps1` to read. |
| `dev/tests/*.test.js` | The unit tests, one file per module (section 3). |
| `dev/images.js` | Generates the test images and their expected masks (section 2). Used by the unit tests, the end-to-end tests and the performance tests. Deterministic: the same seed gives the same picture every run. |
| `dev/e2e.js` | The end-to-end checks, one function per use case, run inside the real app page. |
| `dev/perf.js` | The performance measurements. |
| `dev/check-deps.py` | The import-direction check (Python 3, which this PC has). |
| `dev/phone-checklist.md` | A copy of section 7 with tick boxes, for your phone. |

### 1.2 Test hooks in the app

On `localhost` and `127.0.0.1` only, `main.js` attaches `window.aWardrobeTest` with: `seed(data)` to load garments, outfits, days and settings straight into the database; `clear()`; `go(route)`; `now(date)` to freeze "today"; `pickPhoto(file)` to feed a file into the add screen as if chosen; `editor` (stroke, tap, setStrength, undo, redo, tool, viewport) and `builder` (select, gesture, slot, shuffle) handles that call the same functions the pointer events call; `weather.mock(days)` so no test touches the network; `files.capture()` to catch a backup instead of opening the share sheet; `lastError()`. On any other host the object does not exist, so it cannot leak into the live app. The weather mock is the only place tests stand in for the real thing; the real Open-Meteo call is checked on the phone (M-21).

### 1.3 Pass, fail, and what "done" means (NFR-40)

- A test either passes or fails; there is no "skipped" except manual items, which are listed as such.
- `test.ps1` output looks like this, and the whole of it is what gets shown when a milestone is reported done:

```
checks      C-1 ok   import directions (NFR-37)
            C-2 ok   content security policy lists only Open-Meteo (NFR-2, NFR-4)
unit        U-COL-2 ok   names each of the 26 swatches from its own hex (FR-53)
            ...
e2e         E-1 ok   UC-1 add a garment from a photo (12 steps, 3 alternatives, 4 error cases)
            ...
perf        P-1 ok   12 MP photo to preview 612 ms (PC budget 1000 ms; phone budget 2000 ms, NFR-7)
            ...
offline     C-3 ok   reload with the server stopped (NFR-5)
summary     checks 7/7  unit 93/93  e2e 17/17  perf 8/8  offline 1/1  console errors 0  outside requests 0
```

- A milestone in Phase 5 is done only when `test.ps1` passes with no failures and its output is pasted in the report, and the manual items that milestone names are ticked by you on the phone.

## 2. The generated test images

`dev/images.js` draws each image with the canvas at 1600 by 2000 pixels (the size of a reduced original) and, for the performance test, at 3000 by 4000 (12 megapixels). Each comes with its expected mask, drawn from the same shape before any texture is added. Every image has fabric texture (fine noise and a weave pattern) so nothing is a flat colour, and a slight lens vignette. Seeds are fixed, so results are repeatable.

| Image | What it shows | Expected result | Covers |
|---|---|---|---|
| T1 plain sheet | A navy jumper on an off-white sheet with a gentle lighting gradient | overlap at least 0.95 | FR-23, FR-24, NFR-38 |
| T2 creased sheet with shadow | A mid-grey T-shirt on a sheet with three soft crease bands and a cast shadow along one side of the garment, 25% darker | overlap at least 0.90 | FR-24, NFR-38 |
| T3 wooden floor | A white shirt with pale blue stripes on planks of three brown shades with grain lines and dark gaps between planks | overlap at least 0.90 | FR-24, NFR-38 |
| T4 pale on pale | An ivory shirt on a cream wall with a gradient | the low-contrast flag is raised; after one scripted Select stroke and "keep only this", overlap at least 0.80 | FR-26, FR-36, NFR-38 |
| T5 on a person | A burgundy dress on a figure with skin-coloured head, arms and legs, on a plain wall | after crop to the dress, a Select stroke, "keep only this" and Remove skin: overlap at least 0.85 against the dress mask | FR-41, FR-43, FR-51, NFR-38 |
| T6 empty sheet | The sheet of T1 with no garment | no garment found: whole photo kept, said so | FR-27 |
| T7 strong gradient | A charcoal jumper on a sheet lit from one side, from near white to mid grey | overlap at least 0.90 | FR-24 |
| T8 small and off-centre | A sock in one corner of a plain sheet | the flood-fill fallback finds it: overlap at least 0.85 | FR-23, FR-27 |
| T9 dark on dark | Black jeans on a charcoal floor | reported, no threshold (known hard case; the warning may fire) | FR-26 |
| S1 to S78 colour swatches | Each of the 26 colour names drawn as a jumper on a neutral grey sheet, under three lighting casts: neutral, warm (red gain 1.15, blue 0.8) and cool (red 0.85, blue 1.15) | at least 90% named correctly after white balance | FR-53, FR-54, NFR-39 |
| S79 shadowed fabric | One navy fabric with a shadowed half 40% darker | one colour, not two | FR-55 |
| S80 two colours | Navy and light grey stripes, 70/30 | two names, navy first | FR-53, FR-56 |
| K1 to K8 silhouettes | T-shirt, jumper, shirt, jeans, shorts, dress, skirt, trainer | the expected category from the shape rules; the trainer and jeans with high confidence | FR-57 |

Overlap is the IoU from NFR-38: the pixels both masks keep, divided by the pixels either keeps.

## 3. Unit tests

Each line is one test: id, what it checks, and what it covers. Files are named after the module.

### 3.1 Colour (`colour.test.js`: `domain/colour/space.js`, `naming.js`, `palette.js`)

- **U-COL-1** sRGB to OKLab and back returns the same values within 1/255 for 500 random colours. Covers FR-55.
- **U-COL-2** names each of the 26 swatches from its own hex. Covers FR-53.
- **U-COL-3** names boundary samples as expected: navy against black, cream against white, denim against blue, olive against green, burgundy against red, each with four samples a side. Covers FR-53.
- **U-COL-4** white balance: a fabric colour multiplied by the warm and cool casts, with a near-neutral background multiplied the same way, corrects to within 0.03 OKLab distance of the neutral value. A strong bulb (1.15, 1, 0.8 on grey) is left alone: a cast that strong looks like a coloured sheet, the known limit. Covers FR-54.
- **U-COL-5** no correction when the background is coloured (a red sheet) or tinted away from any lamp or sky (a sage wall, a pink wall, a light blue sheet): the gains are all 1. Covers FR-54.
- **U-COL-6** the palette of S80 is two colours with navy first and shares near 70 and 30. Covers FR-53, FR-56.
- **U-COL-7** the palette of S79 is one colour, named navy, from the lit half. Covers FR-55.
- **U-COL-8** the 78 swatch images name correctly at least 90% of the time, and the report lists every miss. Covers NFR-39.
- **U-COL-9** fewer than 20 usable samples returns an empty list without throwing. Covers FR-53.
- **U-COL-10** names in the swatch list match the categories' colour filter options exactly. Covers FR-6.

### 3.2 Segmentation (`segment.test.js`: `domain/image/segment.js`)

- **U-SEG-1** T1 overlap at least 0.95 at strength 50. Covers FR-23, FR-24, NFR-38.
- **U-SEG-2** T2 overlap at least 0.90. Covers FR-24, NFR-38.
- **U-SEG-3** T3 overlap at least 0.90. Covers FR-24, NFR-38.
- **U-SEG-4** T4 sets the low-contrast flag; T1 to T3 do not. Covers FR-26, NFR-38.
- **U-SEG-5** T6 returns "no garment" and the fallback path reports whole-photo. Covers FR-27.
- **U-SEG-6** on T2, coverage at strength 0 is at least coverage at 50, which is at least coverage at 100, and the three differ. Covers FR-25.
- **U-SEG-7** T7 overlap at least 0.90 (several background shades). Covers FR-24.
- **U-SEG-8** T8 uses the flood-fill fallback and reaches overlap at least 0.85. Covers FR-23, FR-27.
- **U-SEG-9** the background model returns between 2 and 6 shades for T2, and the dominant one is near the sheet colour. Covers FR-24.
- **U-SEG-10** T9 is run and its overlap and flag are printed; no threshold. Covers FR-26.
- **U-SEG-11** T1 cropped tight to the jumper, so the garment fills 97% of the frame, gives "whole photo" with the message rather than an empty background model. Covers FR-27.
- **U-SEG-12** the main-thread decode fallback produces the same mask as the worker path on T1, overlap at least 0.99. Covers FR-21, NFR-26.
- **U-SEG-13** T10, a dress whose hem reaches the bottom edge: the main method, overlap at least 0.85. Covers FR-24.
- **U-SEG-14** T11, a pale shirt with a dark print on a pale wall: the low-contrast flag is set even though the print stands out. Covers FR-26.
- **U-SEG-15** T13, a white shirt on a light grey sheet: no flag, overlap at least 0.90. Covers FR-26.
- **U-SEG-16** T12, Breton stripes the colour of the sheet: run and reported, no threshold (a known limit; the Restore brush). Covers FR-26.
- **U-SEG-17** T1 with an orientation tag, as a phone held sideways writes it: both decode paths give a landscape working copy and the neck ends up on the right. Covers FR-21.
- **U-SEG-18** a text file offered as a photo: both paths refuse it with the HEIC message and the worker stays alive. Covers FR-28.
- **U-SEG-19** a worker that never answers: the call fails with "took too long" within its limit, the worker is replaced, and the next call works. Covers NFR-26.
- **U-SEG-23** *(Draft 5, after the phone checks of M4)* T15, fine blue and white pinstripes (6-pixel period) on a white sheet, the shirt from the user's phone: at strength 50 the overlap is at least 0.97 and under 0.2% of the garment's pixels more than 3 pixels inside its own outline are lost; at 0 and 100 the overlap is at least 0.93 and under 1% is lost. Before the fix the shirt vanished (overlap 0.01). Covers FR-24, FR-25, FR-30.
- **U-SEG-20** T14, a striped shirt whose sleeves, collar and hem cross all four edges of a white photo: the main method, overlap at least 0.85, no warning, and the background model keeps at most two shades. Covers FR-24.
- **U-SEG-21** the whole-photo rule applies to the first automatic pass only: T6 at the first pass is a whole photo, the same picture at a chosen strength returns its real, nearly empty mask; T1 at strength 100 stays a cut-out. Covers FR-27.
- **U-SEG-22** every photo in `dev/real-photos` (the user's own, kept out of git) is run and reported with its method, coverage and separation; no threshold. Covers FR-24.
- **P-1 (unit part)** T1 at 12 megapixels: open plus cut-out in the worker under 1,000 ms on the PC, printed for the report; the full P-1, to the first preview frame, comes with milestone 3. Covers NFR-7.

### 3.3 Mask operations (`mask.test.js`: `domain/image/mask.js`, `skin.js`)

- **U-MASK-1** painting a disc of radius r sets about πr² pixels, none outside the bounding square, and clips at the edges. Covers FR-38.
- **U-MASK-2** flood fill by colour: tolerance 0 takes only the exact colour; tolerance 40 crosses a 10% shade step; it never crosses a hard edge. Covers FR-35.
- **U-MASK-3** connected pieces: three separate blobs are labelled 0, 1, 2 with the right sizes; specks under the limit are dropped except the largest; enclosed holes under the limit are filled; holes touching the border are not. Covers FR-24.
- **U-MASK-4** majority smoothing removes a one-pixel notch and keeps a straight edge. Covers FR-24.
- **U-MASK-5** run-length encoding round-trips a 1200 by 1600 mask and is under 100 KB for a smooth shape. Covers FR-45.
- **U-MASK-6** bounding box and coverage of known shapes. Covers FR-27, FR-30.
- **U-MASK-7** snapping select grows from a brush disc across similar colours and stops at the garment's edge; with snapping off it is the plain disc. Covers FR-36.
- **U-MASK-8** skin detection removes the skin tones of T5 (at least 90% of skin pixels) and keeps at least 98% of the burgundy dress; it says how many it removed. Covers FR-43.

### 3.4 Final edges (`edges.test.js`: `domain/image/edges.js`)

- **U-EDGE-1** eroding by one pixel removes exactly the outer ring. Covers FR-30.
- **U-EDGE-2** after feathering, partly transparent pixels lie within 3 px of the edge, and the interior is fully opaque. Covers FR-30.
- **U-EDGE-3** after decontamination, the soft edge and four pixels beyond it are within 0.05 OKLab of the garment colour, not the background. Covers FR-30.
- **U-EDGE-4** trimming leaves a margin of 3% of the garment's size on each side, clamped at the picture edge. Covers FR-30.
- **U-EDGE-5** the whole save pipeline on T1 produces a JPEG under 500 KB and an alpha PNG under 100 KB at 1200 px, and a thumbnail pair under 60 KB; under 2% of the thumbnail's soft-edge pixels are more than 0.08 OKLab from the garment colour. Covers NFR-14, NFR-16, FR-30.
- **U-EDGE-6** the final cut-out of T1 is trimmed to the jumper with a margin, keeps its alpha, and under 2% of its soft-edge pixels carry sheet colour. Covers FR-30.

### 3.5 Raster (`raster.test.js`: `domain/image/raster.js`)

- **U-RAS-1** rotating by 90° four times is the identity; rotating by 37° then −37° overlaps the original at least 0.97. Covers FR-40.
- **U-RAS-2** mirroring twice is the identity, and the mask mirrors with the pixels. Covers FR-40.
- **U-RAS-3** cropping copies the right pixels and mask rows, clamps a box that overhangs, and refuses a box under 20 px. Covers FR-41.
- **U-RAS-4** resizing to 2000, 1200 and 360 on the long side keeps the aspect ratio within one pixel. Covers FR-22, NFR-16.

### 3.6 Geometry and the viewport (`geometry.test.js`: `domain/image/geometry.js`)

- **U-GEO-1** after `fit()`, a portrait image in a landscape view is centred, and the image's top-left corner maps to `(tx, ty)`. Covers FR-34.
- **U-GEO-2** `toScreen(toImage(p))` returns `p` within 0.001 for 1,000 random viewport states, including letterboxed ones. Covers FR-34.
- **U-GEO-3** after `zoomAt(2, cx, cy)`, the image point that was under `(cx, cy)` is still under it. Covers FR-33, FR-34.
- **U-GEO-4** `panBy` never leaves less than a quarter of the image on screen. Covers FR-33.
- **U-GEO-5** the mapping is identical at device pixel ratios 1, 2 and 3 while `canvasTransform()` scales by the ratio. Covers FR-34.
- **U-GEO-6** scale is clamped between fit and 8 times fit. Covers FR-33.
- **U-GEO-7** two-finger gesture maths: fingers rotated by 30° about each other give a 30° change; fingers twice as far apart give a width ratio of 2. Covers FR-65.
- **U-GEO-8** a brush of 28 screen pixels is 28 divided by the scale in image pixels. Covers FR-39.
- **U-GEO-9** a rectangle in piece coordinates transforms with position, width, rotation and flip exactly as the builder's CSS transform does (same numbers in, same corners out). Covers FR-64, FR-74.

### 3.7 Commands (`commands.test.js`: `domain/commands.js`)

- **U-CMD-1** apply three commands, undo two, redo one: the document and the stack are in the expected states. Covers FR-45.
- **U-CMD-2** `labels()` returns "Undo crop" and "Redo brush stroke" from the commands' labels, and nothing when the stack is empty. Covers FR-46.
- **U-CMD-3** with 2 MB undo records, the stack keeps at least 20 steps before the 40 MB budget drops the oldest. Covers FR-45.
- **U-CMD-4** a new command after an undo clears the redo stack. Covers FR-45.
- **U-CMD-5** a stroke extended by 200 points is one command, undone in one step. Covers FR-45.
- **U-CMD-6** the builder's JSON commands (move, resize, tilt, mirror, layer, add, take off, slot turn, shuffle, tidy) each undo to the previous values. Covers FR-72.

### 3.8 Model (`model.test.js`: `domain/model.js`)

- **U-MOD-1** wear counts include days up to and including today and exclude later days. Covers FR-11, FR-80.
- **U-MOD-2** last worn is the latest counted day. Covers FR-11.
- **U-MOD-3** cost per wear is price divided by wears, with unworn counting as one, and null without a price. Covers FR-11, FR-97.
- **U-MOD-4** the closet's value excludes gone garments; the gone group counts them with their cost per wear. Covers FR-16, FR-96, FR-99.
- **U-MOD-5** validation: a garment needs a name or a type and a numeric price; the messages are the plain-English ones. Covers FR-60.
- **U-MOD-6** new ids carry the right prefix and records carry `v: 1`. Covers NFR-29.
- **U-MOD-7** an outfit may hold two pieces of the same category. Covers FR-67.
- **U-MOD-8** a day logged for a future date is `planned`; for today or earlier it is not; the passed-plan query returns planned days before today that were not asked. Covers FR-80, FR-81.
- **U-MOD-9** the category and type lists are the old app's, and a typed type is accepted. Covers FR-62.
- **U-MOD-10** marking gone and bringing back set and clear `status` and `gone` without touching anything else. Covers FR-14.
- **U-MOD-11** with a clock that crosses midnight, a wear logged after midnight lands on the new day, and a plan made at 23:59 for "tomorrow" is today's plan at 00:00 and not a wear until that day ends. Covers FR-80, FR-81.

### 3.9 Search, filter and sort (`search.test.js`: `domain/search.js`)

- **U-SRCH-1** searching matches name, brand, type, category, colour names, occasions and notes; every word must match; "cafe" matches "Café"; capitals are ignored. Covers FR-3.
- **U-SRCH-2** the category chip narrows to one category, and the chip counts match. Covers FR-4.
- **U-SRCH-3** the five sorts order a known set correctly. Covers FR-5.
- **U-SRCH-4** colour, season, occasion, favourites, not-worn-in-90-days and never-worn combine as AND, and the active filter count is right. Covers FR-6, FR-7.
- **U-SRCH-5** gone garments are absent from the closet list and present in the gone list with reason and date. Covers FR-1, FR-8.
- **U-SRCH-6** names with emoji, combining accents and 60 characters search and sort without error, and "cafe" still matches a decomposed "Café". Covers FR-3.

### 3.10 Suggestions (`suggest.test.js`: `domain/suggest.js`)

- **U-SUG-1** temperature bands from highs and lows: 24/14 is hot, 19/10 warm, 13/6 mild, 8/2 cool, 3/−2 cold. Covers FR-93.
- **U-SUG-2** sandals are excluded on a wet day; a coat is excluded on a hot day; a raincoat scores higher than a blazer when wet. Covers FR-93.
- **U-SUG-3** a garment worn yesterday is not chosen when another fits, and is chosen when it is the only one that fits. Covers FR-91.
- **U-SUG-4** a composed idea is a dress or a top with bottoms, has outerwear when the band is cool or cold or the day is wet, and has shoes when there are any. Covers FR-91.
- **U-SUG-5** on a cool day with two tops, at least one of 20 seeds adds a layer, and none does on a hot day. Covers FR-91.
- **U-SUG-6** the same day and seed give the same idea; the next seed gives a different one when the closet allows. Covers FR-92.
- **U-SUG-7** the reason line for 9 °C and rain is "Cool and wet, 9°C: something warm on top, with a coat that can take it." Covers FR-94.
- **U-SUG-8** gone garments never appear in an idea. Covers FR-15, FR-93.
- **U-SUG-9** saved outfits score higher with outerwear on a cold day and lower when worn in the last two days. Covers FR-91.
- **U-SUG-10** without a forecast, the season's band is used and the context says so. Covers FR-89.

### 3.11 Layout (`layout.test.js`: `domain/layout.js`)

- **U-LAY-1** the tidy layout puts outerwear left, tops above bottoms in the middle, shoes at the foot, and bags and accessories to the right, all inside the canvas. Covers FR-66, FR-71.
- **U-LAY-2** adding to an existing layout leaves placed pieces where they were. Covers FR-66.
- **U-LAY-3** a second top is offset from the first and drawn above it. Covers FR-67, FR-70.

### 3.12 Shape and type guess (`shape.test.js`: `domain/image/shape.js`)

- **U-SHP-1** the twelve features are in their expected ranges, and mirror images give the same features. Covers FR-57.
- **U-SHP-2** the rules give the expected category for K1 to K8, with jeans and trainer at high confidence and the reason text filled in. Covers FR-57.
- **U-SHP-3** with five known jumpers in the examples, a new jumper silhouette is guessed "like your other jumpers"; with no examples the rules answer. Covers FR-57.
- **U-SHP-4** an ambiguous blob gives low confidence. Covers FR-57.

### 3.13 Backup format (`backup-format.test.js`: `domain/backup-format.js`)

- **U-BAK-1** writing three entries (text, binary, empty) and reading them back gives the same bytes and names. Covers FR-100, FR-101.
- **U-BAK-2** CRC-32 of "123456789" is CBF43926. Covers FR-100.
- **U-BAK-3** a file that is not a zip is rejected with the plain message. Covers FR-104.
- **U-BAK-4** a zip with one entry truncated reports that entry and still reads the others. Covers FR-104.
- **U-BAK-5** the manifest and records are validated: a missing `app` or wrong `format` is rejected; unknown extra fields are ignored. Covers NFR-29.
- **U-BAK-6** writing 500 entries from 1 MB blob parts finishes under 2 seconds and the result's size is the sum of the parts plus headers, showing no copying. Covers NFR-18.

### 3.14 Migration (`migrate.test.js`: `domain/migrate.js`)

- **U-MIG-1** an old item maps to a garment: every field carried, colours reordered to `{name, hex}`, status active, origin `wardrobe-import`, `pictures.original` null, method `wardrobe-1`. Covers FR-102, FR-105.
- **U-MIG-2** an old picture with no transparent pixels gives `cutout.kind` photo; one with transparency gives cutout. Covers FR-102.
- **U-MIG-3** old outfit items map to pieces with the garment id and position, size, angle and flip. Covers FR-102.
- **U-MIG-4** old days map with `items` renamed and `planned` true only for days after the frozen today. Covers FR-102.
- **U-MIG-5** old prefs map to settings including the town. Covers FR-102.
- **U-MIG-6** mapping the same old file twice gives the same ids, so a merge does not duplicate. Covers FR-101.
- **U-MIG-7** JSON that is not an old backup is rejected with the plain message. Covers FR-104.
- **U-MIG-8** the data-version chain upgrades a version-0 record to the current version and leaves a current one alone. Covers NFR-29.

### 3.15 PNG writer (`png.test.js`: `domain/image/png.js`)

- **U-PNG-1** a greyscale PNG written by the app decodes in the browser to the same bytes. Covers FR-30, NFR-14.
- **U-PNG-2** the alpha of T1 at 1200 px is under 100 KB. Covers NFR-14.

### 3.16 Database, formatting and routing (`db.test.js`, `format.test.js`, `router.test.js`: `infra/db.js`, `app/records.js`, `app/prefs.js`, `ui/format.js`, `ui/router.js`)

- **U-DB-1** a record put into a test database is read back equal, listed, and deleted. Covers NFR-27.
- **U-DB-2** a transaction across two stores that fails on the second write leaves neither write behind. Covers NFR-27.
- **U-DB-3** records load into memory at open, and a put updates the memory copy only after the database write completes. Covers NFR-11, NFR-27.
- **U-DB-4** settings merge: setting one key leaves the others, and the defaults apply when nothing is stored. Covers FR-111.
- **U-FMT-1** dates format as "Thursday 1 October", "1 Oct", "Today", "Yesterday" and the weekday for the last week, in British English. Covers NFR-32.
- **U-FMT-2** money formats with the chosen symbol and two decimals only when needed; temperatures round and carry the unit. Covers FR-111, NFR-32.
- **U-FMT-3** plurals: "1 piece", "2 pieces", "1 outfit", "3 outfits". Covers NFR-32.
- **U-RT-1** routes parse and build both ways for every screen, and an unknown route falls back to the Closet. Covers FR-110, FR-115.

### 3.17 The editing document (`editor.test.js`: `infra/image-document.js` through the worker)

*(Draft 5.)* These run the real worker from the harness page and check the document that milestone 4 added; each opens a small picture with a known mask.

- **U-DOC-1** an eraser stroke changes only the pixels inside its reported box (padded by the brush radius plus one), `brushMore` extends the same command, and one undo reverses the whole stroke. Covers FR-38, FR-45, NFR-8.
- **U-DOC-2** a wand tap removes the connected area of similar colour, a tap on nothing answers `nothing` with a message and adds no step, and undo brings the area back. Covers FR-35, FR-46.
- **U-DOC-3** select strokes grow a selection that snaps to the garment; keep only, remove and clear are steps that empty the selection; with nothing selected they are refused with a message. Covers FR-36.
- **U-DOC-4** paint recolours kept pixels only, solid or keeping the shading, and undo restores the exact previous bytes. Covers FR-37.
- **U-DOC-5** rotate (90 degrees and 23 degrees), mirror and crop change pixels, mask and size together, and undo brings back the exact previous picture, mask and size. Covers FR-40, FR-41.
- **U-DOC-6** remove skin, a strength change and cut out again are steps with undo; remove skin reports when there is none. Covers FR-25, FR-43, FR-44.
- **U-DOC-7** twenty strokes undo and redo in order within the budget (20 undos and 20 redos under 500 ms on the PC) and the document reports the bytes its records hold. Covers FR-45, NFR-13.
- **U-DOC-8** *(after the review)* a stroke wholly outside the picture is refused without harm and adds no step; a stroke that starts outside and comes in erases inside as one step; paint and select refuse the margin the same way; an undo in the middle of a stroke ends it, so later points are refused and change nothing. Covers FR-34, FR-38, FR-45.
- **U-DOC-9** *(after the review)* a paint stroke's record is at least seven bytes a pixel; the byte count settles after the first undo and does not grow over undo and redo cycles, for paint and for mask commands; a strength step undone brings its warnings back with its mask. Covers NFR-13, FR-27, FR-45.

### 3.18 The builder's core (`builder.test.js`: `domain/builder.js`)

*(Draft 6.)* The pure part of mix and match, which the plan left to the scenarios; three small tests pin the rules down before any screen.

- **U-BLD-1** the ring of a slot is its category newest first with 'none' at the end and gone garments left out; turning a slot moves one step and keeps the piece's place, width, angle and flip; 'none' takes the piece off and the step after it brings the newest back, placed afresh, with the other pieces untouched; an empty canvas opens with tops, bottoms and shoes slots, a placed canvas with one slot a piece. Covers FR-15, FR-68, FR-69.
- **U-BLD-2** forty seeded shuffles are all sensible (a dress alone, or a top and bottoms; shoes always; never a gone garment; no garment twice; a slot per piece), give more than twenty different combinations with a dress and a second top among them, and the same seed gives the same state byte for byte. Covers FR-15, FR-70, FR-72.
- **U-BLD-3** the suggested name joins the pieces' names in category order, up to three and then '+ n more'. Covers FR-73.
- **U-BLD-4** *(after the review)* the saved picture draws a turned, mirrored piece exactly where the stage puts it: the opaque box of `renderOutfitCanvas` matches `pieceCorners` at 900 px within 2.5 px and a mark in the picture's top-left lands at the corner the transform says. Covers FR-74.

## 4. Checks

- **C-1** `dev/check-deps.py` reads every import in `main.js` and the four layer folders and fails if `domain` imports anything outside `domain`, `ui` imports `infra`, `infra` imports `app` or `ui`, or anything but `main.js` imports `ui`. Covers NFR-37 and architecture section 1.
- **C-2** the content security policy in `index.html` allows connections only to `'self'` and the two Open-Meteo addresses, and a `fetch` to `https://example.com` from the app page is blocked by the browser. Covers NFR-2, NFR-4, FR-95.
- **C-3** the service worker: after the first load, every cache name starts with `awardrobe-`; a cache named `other-app-v1` created by the test survives activation; with the server stopped the app reloads and the Closet works. Covers NFR-5, NFR-34, NFR-35.
- **C-4** after the whole run, every localStorage key starts with `awardrobe.`, and the only databases are `awardrobe` and the `wardrobe` seeded for E-7. Covers NFR-34.
- **C-5** the version on the More page equals `VERSION` in `sw.js`, and the privacy statement names Open-Meteo. Covers FR-112, NFR-35.
- **C-6** no console error or uncaught exception occurred during the run. Covers NFR-40, FR-115.
- **C-7** no network request went to any host other than the local server and (when mocked) none at all; the request log is printed. Covers NFR-1, NFR-3.
- **C-8** every string the app shows comes from British English spellings in a word list check (colour, favourite, organise) and no interface text contains jargon from a short banned list (IndexedDB, blob, worker, mask). Covers NFR-32.
- **C-9** on every screen, every button, input and tool has an accessible name in the browser's accessibility tree, and every touch target is at least 44 by 44 pixels. Covers NFR-19, NFR-22.

## 5. End-to-end tests

One per use case, in the order of `02-use-cases.md`. Each follows the main flow and then the alternatives and error cases that a PC can exercise; the rest are listed under manual. Before each test the database is cleared and seeded as stated. "Today" is frozen to Thursday 1 October 2026 unless the test says otherwise.

- **E-1 UC-1 Add a garment from a photo.** Seed: empty. Steps: open Add, choose "Add a garment"; feed T1 through `pickPhoto`; check the busy state appears and the page stays responsive (a timer callback runs within 100 ms during the cut-out); check the preview is on the checkerboard with Move selected; check the three colours include Navy first; check the guess says tops and jumper with a reason; set the name blank and the price "abc" and save: expect the two messages (E4); fix them, save: expect the garment page with 0 wears, and the record with three pictures, `cutout.kind` cutout, strength 50. Alternatives: A1 (empty closet offer), A2 (strength to 20 and 80, undo both), A3 (whole photo), A4 (change category clears type and keeps a chosen type over the guess), A5 (typed type), A6 (reorder, remove, add from palette, dropper), A7 (different photo repeats steps), A8 (navigate away and back: draft offered). Errors: E1 (a text file as a photo gives the HEIC message), E2 (T6 gives whole photo), E3 (T4 gives the warning), E5 (storage failure injected through the test hook keeps the draft). Extra steps: "odd photos" (a screenshot PNG with transparency, a 4:1 panorama, a 200 px image, a square photo and a tag-rotated photo each load, orient and either cut out or keep the whole photo with the message, never a blank stage) and "reload during save" (the hook aborts the save transaction after the pictures are queued; on reload there is no new garment and the draft is offered). Manual: camera (E6). Covers UC-1: FR-1, FR-9, FR-10, FR-20 to FR-30, FR-32, FR-42, FR-45, FR-48 to FR-51, FR-53 to FR-62, FR-110. *(Draft 4, milestone 3:)* the guess check reads "a top" with a reason rather than "tops and jumper", because the outline rules cannot tell a jumper from a T-shirt (the neighbour vote does, once the closet holds jumpers); extra steps: an edit that keeps its pictures and comes back to the page once, a 60-character name on the garment page, whole-photo colours read from the middle of the picture, colours read again for a second photo even after the form was touched, the picker reset so the same photo can be chosen twice, an add draft surviving an edit of another garment, the failed save writing the draft itself, and the interrupted save offering the draft after a reload. The Dropper part of A6 and A8's editor state wait for M4. *(Draft 5:)* the Dropper adding a colour to the garment's colours is checked in E-2, where the tools are; A8 now sets the strength to 30, erases a patch, chooses the Wand and checks all three come back with the draft: 70 checks. *(After the review:)* leaving straight after the stroke, before the two-second timer, must write a draft that still has the photo and the mask (69 checks in the full run's count). *(New-photos setting:)* with `autoCutout` off a new photo opens kept whole with the box ticked and the Eraser still enabled; unticking the box reveals the automatic cut-out made in the background; with the setting back on a new photo is cut out.
- **E-2 UC-2 Fix a cut-out.** Seed: empty; open the editor with T2 (background left near a sleeve by lowering the strength to 15). Steps: zoom to 3× about a point and check the point is fixed; Wand tap on the leftover area at the mapped image coordinate and check the mask lost that region; Undo, lower the tap slider, tap again; Restore stroke over an erased patch at 3× zoom and check every stroke point landed within one pixel of the intended image pixel (the mapping test in the live editor); hold "show original" and check the view draws without alpha; Undo and Redo with the labels "Undo brush stroke" and "Redo brush stroke"; "Detect colours again"; save and check the final cut-out's edge: no pixel in the 3 px rim has the sheet colour. Alternatives: A1, A2 (select stroke on T4 with snapping on and off, keep only, remove, clear), A3 (T5: crop, select, keep only, remove skin, overlap at least 0.85), A4 (rotate by 90°, slider to 23°, typed −45°, mirror; the mask follows), A5 (crop apply and reset), A6 (paint keep-shading and solid, dropper for the brush), A7 (eraser), A8 (cut out again), A9 (plain backgrounds), A10 (whole photo), A11 (keyboard: tool shortcuts and Ctrl+Z), A12 (viewport resized to landscape mid-edit, mapping still exact), A14 (leave: discard prompt), A15 (redo from the reduced original on a saved garment). Errors: E1, E2, E3, E4, E5. Covers UC-2: FR-25, FR-26, FR-29 to FR-52. *(Draft 5, as built in `dev/e2e-editor.js`:)* 55 checks. The leftover to practise on is found from the truth mask of T2 (a kept pixel that the truth says is background, with a clear neighbourhood of the same); taps and strokes go through the stage's own pointer handlers as synthetic pointer events, so the test exercises the same mapping as a finger; the tolerance step checks a smaller tolerance takes the same or less; the Restore stroke at 3 times checks every point landed within a pixel and that the stroke's point count equals the points sent; "Colours again" is the FR-44 button; the saved edge is checked over all soft pixels; A3's overlap is measured against T5's truth after crop, keep only and remove skin; A4's typed turn is checked by the step count; A12 resizes the stage box to 240 px and strokes again; A11 sends the letters and Ctrl+Z; E5 checks Undo and Redo are disabled with nothing to do. A15 lives in E-11 (A2), where the saved garment is. *(After the review:)* 61 checks; the Wand at the default tolerance must leave the garment (overlap with the truth over 0.8 after the tap); the drawn pixel under a Restore point is read from the view (see-through after the Eraser, solid after Restore); a stroke wholly in the margin changes nothing and one that comes in from the margin erases inside; the photo tools are crashed through the test hook and the next tap works after the restart message; "Remove skin" is awaited by its label and must say how much it removed. *(After the phone checks:)* 62 checks; a pointer tap on the Undo button with the Eraser active, at 3 times zoom with the button over the picture, must undo the stroke and not a dot under the finger. *(Second phone check:)* 67 checks; two fast taps on Undo with Paint active undo two strokes and leave the zoom alone; two quick dabs with Paint active do not zoom while a double tap with Move does; with nothing to undo the button is dimmed (`aria-disabled`), not disabled, and two fast taps on it say "Nothing to undo" without zooming or painting. *(Hold to see original on the stage:)* 73 checks; the button must sit inside the stage, and a pointer down on it shows the original while a pointer up restores the cut-out with no stroke made under the finger. *(Twist to rotate:)* 71 checks; two synthetic fingers turning about the stage centre by 31 degrees set the Rotate slider to 31 within 2 and leave the zoom alone; twisting back close to level snaps to 0; a twist of 88 degrees snaps to 90, and leaving the tool swaps the picture's width and height exactly.
- **E-3 UC-3 Build an outfit.** Seed: eight garments from the generated set across five categories. Steps: Outfits, New outfit; add three pieces and check the tidy layout; drag a piece by 40 px and check its fraction changed accordingly; resize by the handle; select and tilt by buttons, slider and typed 12°, mirror, bring to front, send to back, take off; a two-pointer gesture (two synthetic pointers rotated by 30° and spread by 1.5×) changes angle and width as computed by U-GEO-7; add a second top; undo and redo the last move; name, seasons, occasions, favourite; save: check the picture exists with alpha, the list shows it first, the garment page lists it. Alternatives: A1, A3 (edit and re-save), A4 (from an idea), A5, A6 (gone garment marked on the canvas and absent from Add pieces), A9 (draft survives navigation). Errors: E1 (save with no pieces), E2 (empty closet), E4 (a broken picture injected). Manual: real two-finger gestures. Covers UC-3: FR-13, FR-15, FR-49, FR-63 to FR-67, FR-71 to FR-77, FR-92, FR-110. *(Draft 6, as built in `dev/e2e-outfits.js`:)* 43 checks on `builderSet('build')`, eight garments across five categories with real small cut-outs; drags, the handle and the two-finger gesture go through the stage's own pointer handlers as synthetic pointer events; the drag is checked as a fraction of the stage width, the gesture against the 30 degrees and 1.5 times sent; the saved picture is checked for kind, alpha and the 3 by 4 shape; A7 (wore it today) is included, since the outfit page logs it; A4 (from an idea) waits for M7; A6 marks two garments gone through the records and checks the canvas mark and the Add pieces list; E4 deletes a picture record and reopens the app first so the picture cache cannot hide it; the leave prompt is checked by the builder closing rather than by which screen follows, because Back returns to whatever came before. *(After the review:)* 55 checks; the '+' menu opens the builder; Undo and Redo sit above the pieces; a 30 px drag of the handle widens by 30 px worth on a plain and on a mirrored piece; lifting one of two fingers ends the gesture as one step and the other finger drags nothing; a two-pixel wobble is no step; an arrow key nudges one per cent as a step; the name keeps its capital; the picture is trimmed and a thumb stored; re-saving replaces both and deletes the old ones; an untouched saved outfit leaves no draft.
- **E-4 UC-4 Plan the week with the weather.** Seed: twelve garments with seasons, two saved outfits, a town, and a mocked ten-day forecast with Thursday wet. Steps: Calendar, This week; check seven rows with symbol, high and low; plan Monday's idea; another idea for Tuesday differs; choose own for Wednesday (an outfit); check Thursday's idea has waterproof outerwear and no sandals; month view shows pictures and symbols; advance "today" to Tuesday and reopen: the question about Monday appears once. Alternatives: A1 (no town: season text), A2 (offline flag with a cached forecast under three hours, then older), A3 (day eleven has no weather), A4, A5 (gone garment never suggested), A6, A7 (remove a plan), A8 (°F). Errors: E1 (mock returns an error: message, season fallback, other screens fine), E2 (a closet that suits nothing). Covers UC-4: FR-15, FR-78 to FR-81, FR-84, FR-85, FR-87 to FR-89, FR-91 to FR-94.
- **E-5 UC-5 Log what I wore.** Seed: three garments, one outfit. Steps: "Wore it today" on a garment; toast with "See day" opens the calendar on today; the garment shows 1 wear and last worn today; the outfit's "Wore it today" and its wears. Alternatives: A1 (a past date counts, a future date is planned), A2 (from a calendar day: add an outfit and pieces), A3 (note saved), A4 (remove), A5 (planned day passed: Yes keeps, No then Remove removes, No then "I wore something else" opens the day; ignored once is not asked again and counts), A6 (count badge), A7 (jump to today, move months), A8 (gone garment page shows Bring back, past days keep it). Errors: E1 (storage failure), E2 (bad date refused). Covers UC-5: FR-11, FR-12, FR-14, FR-15, FR-75, FR-76, FR-78 to FR-83, FR-90, FR-110.
- **E-6 UC-6 Back up and restore.** Seed: ten garments, two outfits, five days, a town. Steps: More, Make a backup, capture the file; check it is a zip with the manifest, records and 30 picture files, and "Last backup: today"; clear the database; restore the file into the empty app: counts reported, every record and picture back, the town back; add one more garment, change one, then restore again with "Add to mine": the changed one keeps the newer copy, nothing doubles; restore with "Replace everything" after confirmation: exactly the file's contents. Alternatives: A1, A2 (last backup 31 days ago shows the reminder), A3 (storage figure shown; a mocked estimate at 85% shows the warning), A5 (200 garments at full picture size round-trip on the PC; the 500 case is the soak test), A6. Errors: E1 (a text file), E2 (a zip with one broken picture: the rest come in and the report names it), E3 (quota failure injected: nothing half-written), E4 (cancelled save leaves the date alone). Covers UC-6: FR-100, FR-101, FR-102, FR-104, FR-106, FR-107.
- **E-7 UC-7 Move over from the old Wardrobe.** Seed: a generated old-format backup file with six items (two without transparency), two outfits, four days (one in the future) and prefs; and a seeded `wardrobe` IndexedDB database with the same content. Steps: restore the old file: recognised, converted, counts right, pictures split into colour and alpha, `origin` set, `pictures.original` null, the editor's "redo the cut-out" explains and offers a new photo; import again: no duplicates. Alternatives: A1 (the direct offer appears on the home and under More; copying reads the old database and leaves it byte-for-byte unchanged, checked by reading it back), A2, A3 (with the old database removed the offer does not appear). Errors: E1 (an image that will not decode skips that garment and names it), E2 (a damaged file). Covers UC-7: FR-61, FR-101 to FR-105.
- **E-8 UC-8 Mix and match.** Seed: nine garments: four tops, three bottoms, two shoes, one gone top. Steps: in the builder open Mix and match: three slots; each shows previous and next; turn the tops slot: the piece changes, position kept, other slots unchanged; add a second tops slot: layered; shuffle twice: different sensible combinations, both without the gone garment; undo returns the earlier one; close and save. Alternatives: A1 (remove a slot), A2 (none), A3 (a dress is chosen within 40 seeded shuffles when dresses exist), A4. Errors: E1 (a category with one garment: arrows disabled), E2 (one category only: explanation). Covers UC-8: FR-15, FR-66 to FR-70, FR-72. *(Draft 6, as built:)* 15 checks on `builderSet('mix')` (four tops, three bottoms, two shoes, one dress, one gone top); an empty canvas opens the mixer with each slot already holding the newest garment; the previous of the newest is 'none', one of the candidates; the slot label counts the wearable garments ('Grey hoodie, 1 of 4'); the 'none' step is taken on a slot that has more than one candidate, because after forty shuffles the first slot may be the single dress; E2 reseeds the closet with tops only. *(After the review:)* 17 checks; after a turn the piece's node must carry the new garment and a drawn canvas; the turn's label is 'Undo turn of tops'; adding a slot for a category whose every garment is on the canvas says so and adds no row.
- **E-9 UC-9 Decide what to wear today.** Seed: the E-4 closet, a town, a mocked forecast of 14/8 and dry. Steps: home shows the symbol, 14°, the reason line "Mild and dry, 14°C: a top and a light layer."; suited outfits listed; an idea without anything worn in the last two days; "Wear this today" logs it. Alternatives: A1 (another idea differs), A2 (save as outfit opens the builder filled), A3 (a suited outfit opens and logs), A4 (no town: season), A5, A6 (wet mock: waterproof in, sandals out). Errors: E1 (mock error: message, season, ideas still there), E2 (nothing suits). Covers UC-9: FR-75, FR-89 to FR-94.
- **E-10 UC-10 Find a garment.** Seed: 300 generated garments with varied names, brands, colours, seasons and occasions, including "Café shirt" and ten gone. Steps: cards and the count "290 pieces"; search "navy": the right subset and "n of 290"; a category chip; sort least worn; filters season and not-worn-90-days with the badge "(2)"; open a card; favourite; back keeps the state; Clear. Alternatives: A1 (gone list with reasons), A2 (empty closet after clear), A3, A4 (opens under the PC budget, see P-5), A5 ("cafe"). Extra step: a garment with a 60-character name shows as a card that wraps without clipping. Errors: E1 (nothing matches). Covers UC-10: FR-1 to FR-11, FR-13, FR-17, FR-19. *(Draft 4:)* also checks that focus stays on a tapped chip, cards keep their button role, the picture carries the garment's name, last worn reads as the format module says, the gone list has its own address (`#/closet/gone`) and the Closet tab leaves it, and thumbnails far out of view release their canvas and are drawn again when scrolled back to.
- **E-11 UC-11 Change a garment.** Seed: two garments, one imported without an original. Steps: Edit; change price, seasons, notes, colours; save; check the page and that wears and days are untouched. Alternatives: A1 (new photo T3 replaces the pictures and re-detects), A2 (redo the cut-out from the reduced original with a different strength), A3 (imported: explanation and offer), A4, A5, A6, A7, A8 (draft and discard prompt). Errors: E1, E2. Covers UC-11: FR-14, FR-17 to FR-24, FR-31, FR-49, FR-50, FR-53 to FR-57, FR-59 to FR-61, FR-105. *(Draft 5:)* 14 checks in `dev/e2e-editor.js`; the editor shows the stored cut-out as a still picture (FR-19); A2 checks the redone cut-out is saved at the new strength and the original picture record keeps its id, not a copy; A3 checks the imported garment's note and that no redo button is offered; E2 injects a failed write and checks the garment is unchanged. *(After the review:)* 15 checks; a turn left pending in the Rotate tool is applied before the save. *(After the phone checks:)* 19 checks; A2 makes an Eraser fix before saving and checks the record carries the cut-out's box and working size; A2b taps "Edit the cut-out" on the saved garment and checks the picture opens with the saved strength, no steps, and the Eraser fix in place, then saves and checks the original is kept and a new cut-out written.
- **E-12 UC-12 Mark a garment gone.** Seed: four garments, one outfit containing one of them, two days wearing it. Steps: mark gone as sold on a date; absent from Closet, Add pieces, the revolver and ideas; present on the days and marked gone in the outfit; its page shows wears, cost per wear and Bring back; stats show the gone group. Alternatives: A1 (bring back), A2 (from the editor). Errors: E1. Covers UC-12: FR-8, FR-14 to FR-16, FR-99.
- **E-13 UC-13 Stats.** Seed: twenty garments with prices, forty days, two gone. Steps: the four numbers; most worn top five in order; not worn in 90 days and "See all" opens the Closet filtered and sorted; cost per wear best and worst with unworn as one; bars by category and main colour; the gone group apart from the closet's value. Alternatives: A1 (no prices), A2 (empty). Covers UC-13: FR-5, FR-6, FR-11, FR-16, FR-96 to FR-99.
- **E-14 UC-14 Set up the weather.** Seed: empty; mock the town search and forecast. Steps: search "Leeds", pick the match, see the confirmation and the privacy line naming Open-Meteo and the position; the forecast is requested once and cached with a three-hour key; the home and calendar show it in °C. Alternatives: A1 (°F everywhere), A2 (stop using: town and cache gone, no request made afterwards), A3 (change town refetches), A4 (C-2 covers the policy). Errors: E1 (no match), E2 (offline flag), E3 (service error). Manual: the real service (M-21). Covers UC-14: FR-85 to FR-90, FR-95, FR-111, FR-112.
- **E-15 UC-15 Install and first open.** Seed: nothing; a fresh browser profile. Steps: the welcome; "Open my wardrobe" asks for persistent storage (the call is observed) and shows the empty Closet; the five areas and the Add actions are one tap away; the service worker installs; reload with the server stopped works (C-3). Alternatives: A1 (bump VERSION in a copy of `sw.js`, reload: the notice appears and Reload uses it), A2 (second open skips the welcome), A3 (a screen made to throw shows the message with "Go to Closet" and the error is in the log on More), A4 (desktop width renders without horizontal scroll), A5 (old data present: the offer appears). Errors: E1 (storage blocked through the hook: banner, app works). Manual: home screen install, flight mode (M-1 to M-4). Covers UC-15: FR-9, FR-103, FR-109, FR-110, FR-113 to FR-115.
- **E-16 UC-16 Settings, storage, delete everything.** Seed: three garments. Steps: theme, currency and unit change at once and persist across reload; the privacy statement and version; the storage figure; the last backup line; Delete everything with the wrong word does nothing; with DELETE wipes every store and shows the empty Closet. Alternatives: A2 (auto theme follows the emulated dark setting). Extra step: "second tab": a second page on the same site changes a setting; the first page shows the change when it regains focus, and neither page's data is corrupted. Covers UC-16: FR-106 to FR-108, FR-111, FR-112.
- **E-17 UC-17 Delete a garment or an outfit.** Seed: three garments, one outfit with two of them, two days. Steps: delete a garment after the confirmation: gone from the outfit and the days, its three pictures gone, no orphan left; delete the outfit after the confirmation: garments stay, the days now list its pieces, its picture gone. Alternatives: A1 (cancel changes nothing), A2. Errors: E1 (a failure injected mid-transaction leaves everything as before). Covers UC-17: FR-14, FR-18, FR-77. *(Draft 4:)* the failure is injected twice, once before the transaction starts and once after its writes were queued; the outfit half waits for M5. *(Draft 6:)* 19 checks; the outfit half deletes the seeded outfit after a cancel, and checks the garments stay, the day that wore it now lists its remaining piece on its own, and the Outfits list no longer shows it. *(After the review:)* 22 checks; a second seeded outfit made of the deleted garment alone must be deleted with it, the first must get a fresh picture without it, the confirmation names the rule, and deleting an outfit removes its picture records.

## 6. Performance tests

Run on this PC in headless Edge after the end-to-end tests, each three times with the median reported. PC budgets are half the phone budgets, because the PC is at least twice as fast as a 2020 phone; the phone budgets themselves are checked by hand in section 7.

| Id | Measures | PC budget | Phone budget | Covers |
|---|---|---|---|---|
| P-1 | T1 at 12 megapixels from `pickPhoto` to the first preview frame; and the longest main-thread task during it | 1,000 ms; no task over 50 ms | 2,000 ms; 100 ms | NFR-7 |
| P-2 | a 500-point Restore stroke: time from each pointer event to the frame that shows it, worst case *(Draft 5: measured as two numbers, the main-thread time of each pointer event's handler, budget 8 ms, and the time from a frame's batch of points leaving for the photo tools to the draw that shows it, budget 16 ms; the stroke is sent four points a frame at 2 times zoom; after the review a 200-point Select stroke with snapping is timed the same way; its figure is the 95th-percentile batch, median of three runs, with the worst batches reported beside it, because one collector pause in two hundred batches is a dropped frame rather than a laggy brush and the worst alone swung between 7 and 22 ms on the same code)* | 8 ms | 16 ms | NFR-8 |
| P-3 | a Wand tap, a strength change and "Cut out again" on T2 | 250 ms each | 500 ms | NFR-9 |
| P-4 | "Add to closet" to the garment page | 750 ms | 1,500 ms | NFR-10 |
| P-5 | opening the Closet with 300 garments to the first painted cards | 750 ms | 1,500 ms | NFR-11 |
| P-6 | frame time during a scripted twist and pinch of a piece with 8 pieces on the canvas *(Draft 6: two numbers, median of three runs: the main-thread time of each pair of pointer events, budget 8 ms, and the 95th-percentile gap between frames while the fingers move, budget 20 ms, with the worst gaps reported; the gesture is sixty frames of two synthetic fingers turning 45 degrees and spreading, and the piece must end turned and grown)* | 8 ms | 16 ms | NFR-12 |
| P-7 | `performance.memory.usedJSHeapSize` at its peak during E-2 with 20 undo steps *(Draft 5: a 12 MP photo, 18 eraser strokes and two turns, then five undos and five redos; the figure is the page's heap, which the browser reports, while the undo records live in the worker whose own stack is capped at 40 MB; after the review the mix includes three paint strokes and the records' bytes are reported and must stay under 40 MB; the harness browser exposes the collector, and the figure judged against 150 MB is the heap held after a collection with the photo open and the 20 steps stored, the raw peak before one being reported against the 250 MB hard limit, because in the full run P-7 comes last in a page still holding the litter of 239 earlier checks; P-3 checks the timed Wand tap changed the cut-out)* | 150 MB | 250 MB (manual, M-24) | NFR-13 |
| P-8 | the stored size of a garment: each of T1, T2, T3 and T5 saved through the real pipeline, and their average; the 300-garment seed is reported apart *(Draft 4: it was averaged in, which let small test pictures hide a real garment over budget)* | 1.5 MB each and on average | 1.5 MB | NFR-14 |
| P-9 (soak, `-Soak` only) | a backup of 500 full-size generated garments and its restore, with peak heap | completes; heap under 300 MB | manual, M-19 | NFR-18 |

A failed budget fails the run; the numbers are printed either way so trends are visible.

## 7. Manual checks on the phone

A copy of this list with tick boxes is kept in `dev/phone-checklist.md`. Each milestone in Phase 5 says which of these it needs. Do the iPhone list first; the Android list is the same items, marked (A) where the step differs.

**Install and offline (UC-15)**
- [ ] M-1 Open the address in Safari, see the welcome, tap "Open my wardrobe". FR-109
- [ ] M-2 Share, Add to Home Screen; the icon and name are right; it opens full screen. NFR-6
- [ ] M-3 Flight mode on; open from the icon; the Closet opens and a garment can be added. NFR-5
- [ ] M-4 After a release, the "new version" notice appears when online and Reload uses it. FR-114

**Adding from real photos (UC-1)**
- [ ] M-5 Take a photo with the camera of a garment on a plain sheet; the cut-out is clean without fixing, colours and type are right. FR-20, FR-23, FR-53, FR-57
- [ ] M-6 Choose a photo from the library taken in portrait and one in landscape; both appear the right way up. FR-21
- [ ] M-7 A garment on a wooden floor; a garment with a strong shadow; a pale shirt on a pale wall (the warning appears). FR-24, FR-26
- [ ] M-8 A photo of someone wearing the garment: crop, select, keep only, remove skin, save. FR-51
- [ ] M-9 A 12-megapixel photo is on screen as a cut-out within 2 seconds and the screen never freezes (a tap on Cancel during the cut-out responds at once). NFR-7
- [ ] M-10 Leave the app mid-edit, open other apps for ten minutes, come back: the draft is offered. FR-49

**The editor (UC-2)**
- [ ] M-11 Pinch to zoom in to 8×, two-finger pan, double-tap; a Restore stroke lands exactly under the finger at every zoom, including after turning the phone sideways. FR-33, FR-34
- [ ] M-12 Brush ring shows under the finger; three sizes feel right at 1× and 8×. FR-39
- [ ] M-13 Wand, Select with snapping, Paint with keep shading, Eraser, Rotate by slider and typed degrees, Crop, Dropper, Remove skin, Hold to see original. FR-35 to FR-43, FR-47
- [ ] M-14 Twenty quick strokes then Undo twenty times then Redo; no lag, no wrong step. FR-45, FR-46, NFR-8
- [ ] M-15 Turn the phone to landscape and back; nothing is lost and touches stay accurate. FR-34

**Outfits (UC-3, UC-8)**
- [ ] M-16 Two fingers twist and pinch a piece; the angle box follows; the save picture matches the canvas. FR-65, FR-74
- [ ] M-17 The revolver swipes smoothly and shows the next and previous pieces; a second top layers. FR-67 to FR-69
- [ ] M-18 Eight pieces drag without stutter. NFR-12

**Backup and the old app (UC-6, UC-7)**
- [ ] M-19 Make a backup with your real closet; save it to Files; restore it on the other phone (or after Delete everything); everything is back including the town. FR-100, FR-101, NFR-18
- [ ] M-20 Import the old Wardrobe's backup file; your clothes appear with their cut-outs; try the direct copy where the offer appears. FR-102, FR-103, FR-105

**Weather (UC-4, UC-9, UC-14)**
- [ ] M-21 Set your real town; the forecast appears on the home and This week; the privacy line is right; flight mode shows the "from earlier" note. FR-86 to FR-89

**Logging and planning (UC-4, UC-5)**
- [ ] M-22 Plan Monday from This week; after Monday has passed, the question appears once; answer No and log what you wore. FR-81

**Accessibility (NFR-19 to NFR-23)**
- [ ] M-23 VoiceOver: every control is read out with a sensible name; the selected tool is announced; the tab bar and sheets are navigable. NFR-19, NFR-22
- [ ] M-24 Text size at the largest accessibility setting: nothing clipped or overlapping on the six mockup screens. NFR-20
- [ ] M-25 Reduce Motion on: no animation beyond fades; dark mode follows the phone. NFR-21
- [ ] M-26 Colour-blind check with the phone's filters: the selected tool, active filters and gone garments are still obvious. NFR-23

**Storage and memory (NFR-13, NFR-14, NFR-17)**
- [ ] M-27 After importing your real closet, More shows the storage figure; divide by the garment count: at most 1.5 MB each. NFR-14
- [ ] M-28 With a 12-megapixel photo open and twenty undo steps, Safari does not reload the page (Web Inspector memory under 250 MB on the Mac if available; otherwise no reload is the check). NFR-13
- [ ] M-29 Fill storage with a large video in Files until the phone warns; the app's warning appears above 80% and a save that fails keeps the draft. NFR-17

**Android (Chrome)**
- [ ] M-30 Repeat M-1 to M-4 with "Install app"; the direct copy from the old app appears if the old app was used in Chrome; TalkBack for M-23. NFR-6, NFR-24, FR-103

## 8. What is not tested, and why

- Real network failures mid-request (the mock returns errors instead); the only real network call is checked in M-21.
- Browsers outside NFR-24 and NFR-25.
- The share sheet and Files app themselves (M-19 covers the flow).
- iOS storage eviction policies (persistent storage is requested and the request observed; the policy is Apple's).

## 9. Every requirement and the tests that cover it

Generated from the "Covers" lines above and from the use-case traceability in `02-use-cases.md` (E-n covers everything UC-n covers). A script checks that every FR appears.

| FR | Tests |
|---|---|
| FR-1 | U-SRCH-5, E-1, E-10 |
| FR-2 | E-10 |
| FR-3 | U-SRCH-1, U-SRCH-6, E-10 |
| FR-4 | U-SRCH-2, E-10 |
| FR-5 | U-SRCH-3, E-10, E-13 |
| FR-6 | U-COL-10, U-SRCH-4, E-10, E-13 |
| FR-7 | U-SRCH-4, E-10 |
| FR-8 | U-SRCH-5, E-10, E-12 |
| FR-9 | E-1, E-10, E-15 |
| FR-10 | E-1, E-10 |
| FR-11 | U-MOD-1, U-MOD-2, U-MOD-3, E-5, E-10, E-13 |
| FR-12 | E-5 |
| FR-13 | E-3, E-10 |
| FR-14 | U-MOD-10, E-5, E-11, E-12, E-17 |
| FR-15 | U-SUG-8, E-3, E-4, E-5, E-8, E-12 |
| FR-16 | U-MOD-4, E-12, E-13 |
| FR-17 | E-10, E-11 |
| FR-18 | E-11, E-17 |
| FR-19 | E-10, E-11 |
| FR-20 | E-1, E-11, M-5 |
| FR-21 | U-SEG-12, U-SEG-17, E-1, E-11, M-6 |
| FR-22 | U-RAS-4, E-1, E-11 |
| FR-23 | U-SEG-1, U-SEG-8, E-1, E-11, M-5, T1, T8 |
| FR-24 | U-SEG-1, U-SEG-2, U-SEG-3, U-SEG-7, U-SEG-9, U-SEG-13, U-SEG-20, U-SEG-22, U-MASK-3, U-MASK-4, E-1, E-11, M-7, T1, T2, T3, T7, T10, T14 |
| FR-25 | U-SEG-6, E-1, E-2 |
| FR-26 | U-SEG-4, U-SEG-10, U-SEG-14, U-SEG-15, U-SEG-16, E-1, E-2, M-7, T4, T9, T11, T12, T13 |
| FR-27 | U-SEG-5, U-SEG-8, U-SEG-11, U-SEG-21, U-MASK-6, E-1, T6, T8 |
| FR-28 | U-SEG-18, E-1 |
| FR-29 | E-1, E-2 |
| FR-30 | U-MASK-6, U-EDGE-1, U-EDGE-2, U-EDGE-3, U-EDGE-4, U-EDGE-5, U-EDGE-6, U-PNG-1, E-1, E-2 |
| FR-31 | E-2, E-11 |
| FR-32 | E-1, E-2 |
| FR-33 | U-GEO-3, U-GEO-4, U-GEO-6, E-2, M-11 |
| FR-34 | U-GEO-1, U-GEO-2, U-GEO-3, U-GEO-5, E-2, M-11, M-15 |
| FR-35 | U-MASK-2, E-2, M-13 |
| FR-36 | U-MASK-7, E-2, M-13, T4 |
| FR-37 | E-2, M-13 |
| FR-38 | U-MASK-1, E-2, M-13 |
| FR-39 | U-GEO-8, E-2, M-12, M-13 |
| FR-40 | U-RAS-1, U-RAS-2, E-2, M-13 |
| FR-41 | U-RAS-3, E-2, M-13, T5 |
| FR-42 | E-1, E-2, M-13 |
| FR-43 | U-MASK-8, E-2, M-13, T5 |
| FR-44 | E-2 |
| FR-45 | U-MASK-5, U-CMD-1, U-CMD-3, U-CMD-4, U-CMD-5, E-1, E-2, M-14 |
| FR-46 | U-CMD-2, E-2, M-14 |
| FR-47 | E-2, M-13 |
| FR-48 | E-1, E-2 |
| FR-49 | E-1, E-2, E-3, E-11, M-10 |
| FR-50 | E-1, E-2, E-11 |
| FR-51 | E-1, E-2, M-8, T5 |
| FR-52 | E-2 |
| FR-53 | U-COL-2, U-COL-3, U-COL-6, U-COL-9, E-1, E-11, M-5, S1 to S78, S80 |
| FR-54 | U-COL-4, U-COL-5, E-1, E-11, S1 to S78 |
| FR-55 | U-COL-1, U-COL-7, E-1, E-11, S79 |
| FR-56 | U-COL-6, E-1, E-11, S80 |
| FR-57 | U-SHP-1, U-SHP-2, U-SHP-3, U-SHP-4, E-1, E-11, M-5, K1 to K8 |
| FR-58 | E-1 |
| FR-59 | E-1, E-11 |
| FR-60 | U-MOD-5, E-1, E-11 |
| FR-61 | E-1, E-7, E-11 |
| FR-62 | U-MOD-9, E-1 |
| FR-63 | E-3 |
| FR-64 | U-GEO-9, E-3 |
| FR-65 | U-GEO-7, E-3, M-16 |
| FR-66 | U-LAY-1, U-LAY-2, E-3, E-8 |
| FR-67 | U-MOD-7, U-LAY-3, E-3, E-8, M-17 |
| FR-68 | E-8, M-17 |
| FR-69 | E-8, M-17 |
| FR-70 | U-LAY-3, E-8 |
| FR-71 | U-LAY-1, E-3 |
| FR-72 | U-CMD-6, E-3, E-8 |
| FR-73 | E-3 |
| FR-74 | U-GEO-9, E-3, M-16 |
| FR-75 | E-3, E-5, E-9 |
| FR-76 | E-3, E-5 |
| FR-77 | E-3, E-17 |
| FR-78 | E-4, E-5 |
| FR-79 | E-4, E-5 |
| FR-80 | U-MOD-1, U-MOD-8, U-MOD-11, E-4, E-5 |
| FR-81 | U-MOD-8, U-MOD-11, E-4, E-5, M-22 |
| FR-82 | E-5 |
| FR-83 | E-5 |
| FR-84 | E-4 |
| FR-85 | E-4, E-14 |
| FR-86 | E-14, M-21 |
| FR-87 | E-4, E-14, M-21 |
| FR-88 | E-4, E-14, M-21 |
| FR-89 | U-SUG-10, E-4, E-9, E-14, M-21 |
| FR-90 | E-5, E-9, E-14 |
| FR-91 | U-SUG-3, U-SUG-4, U-SUG-5, U-SUG-9, E-4, E-9 |
| FR-92 | U-SUG-6, E-3, E-4, E-9 |
| FR-93 | U-SUG-1, U-SUG-2, U-SUG-8, E-4, E-9 |
| FR-94 | U-SUG-7, E-4, E-9 |
| FR-95 | C-2, E-14 |
| FR-96 | U-MOD-4, E-13 |
| FR-97 | U-MOD-3, E-13 |
| FR-98 | E-13 |
| FR-99 | U-MOD-4, E-12, E-13 |
| FR-100 | U-BAK-1, U-BAK-2, E-6, M-19 |
| FR-101 | U-BAK-1, U-MIG-6, E-6, E-7, M-19 |
| FR-102 | U-MIG-1, U-MIG-2, U-MIG-3, U-MIG-4, U-MIG-5, E-6, E-7, M-20 |
| FR-103 | E-7, E-15, M-20, M-30 |
| FR-104 | U-BAK-3, U-BAK-4, U-MIG-7, E-6, E-7 |
| FR-105 | U-MIG-1, E-7, E-11, M-20 |
| FR-106 | E-6, E-16 |
| FR-107 | E-6, E-16 |
| FR-108 | E-16 |
| FR-109 | E-15, M-1 |
| FR-110 | U-RT-1, E-1, E-3, E-5, E-15 |
| FR-111 | U-DB-4, U-FMT-2, E-14, E-16 |
| FR-112 | C-5, E-14, E-16 |
| FR-113 | E-15 |
| FR-114 | E-15, M-4 |
| FR-115 | U-RT-1, C-6, E-15 |

## 10. What happens next

When you approve this document, Phase 5 writes the implementation plan: small milestones in order, each shippable and tested, each naming the tests above that must pass and the manual items you tick. Then, with your go-ahead, milestone 1 is built.
