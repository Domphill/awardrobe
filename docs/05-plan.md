# aWardrobe: Implementation Plan

Phase 5 of 5. Draft 1, written 1 October 2026, approved 1 October 2026; building runs in-session, test-first, with an independent review of each milestone before release. Builds on the approved `01-requirements.md`, `02-use-cases.md`, `03-architecture.md` and `04-test-plan.md`.

## 0. How to read this

- The app is built in nine milestones, in order. Each one ends with something you can install and use, every test from earlier milestones still passing, and the tests it adds passing too. Nothing is reported done without the test output (NFR-40).
- Each milestone names: what you can do when it ships, what gets built (files from `03-architecture.md`), the automated tests that must pass (ids from `04-test-plan.md`), the manual checks you tick on the phone, and what "done" means.
- Every milestone is built test-first: the unit tests are written before the code they test, run once to see them fail, then the code is written until they pass. The end-to-end test for a screen is written alongside that screen.
- Section 10 is the release procedure that every milestone follows. Section 11 lists the risks I will watch for that the test plan did not name, with the tests this plan adds for them. Section 12 is how we work together while building.

## 1. The milestones at a glance

| Milestone | What ships | Automated tests that must pass | Manual checks |
|---|---|---|---|
| M1 Foundation and shell | An installable, offline-capable app with the five areas, welcome, settings, and the test harness | C-1 to C-8, U-MOD-5, U-MOD-6, U-MOD-9, E-15, E-16 | M-1 to M-4, M-25 |
| M2 The image engine | No new screens; the cut-out, colour and shape engine proven on the generated images | U-COL-1 to U-COL-10, U-SEG-1 to U-SEG-10, U-MASK-1 to U-MASK-8, U-EDGE-1 to U-EDGE-5, U-RAS-1 to U-RAS-4, U-PNG-1, U-PNG-2, U-SHP-1 to U-SHP-4 | none |
| M3 Add and see garments | Photograph a garment, get a cut-out with its colours and type, find it in the Closet, see its page | U-SRCH-1 to U-SRCH-5, U-MOD-1 to U-MOD-4, U-MOD-10, E-1, E-10, E-17 (garment part), P-1, P-4, P-5, P-8 | M-5 to M-7, M-9 |
| M4 The editor | Every tool, zoom with exact touch, undo and redo, drafts, redo from the original | U-GEO-1 to U-GEO-6, U-GEO-8, U-CMD-1 to U-CMD-5, E-1 (complete), E-2, E-11, P-2, P-3, P-7 | M-8, M-10 to M-15 |
| M5 Outfits | The builder with gestures, the revolver, shuffle, saved outfits with pictures | U-GEO-7, U-GEO-9, U-CMD-6, U-LAY-1 to U-LAY-3, U-MOD-7, E-3, E-8, E-17 (outfit part), P-6 | M-16 to M-18 |
| M6 Calendar, logging, gone and stats | Log and plan days, the passed-plan question, gone from closet, Stats | U-MOD-8, E-5, E-12, E-13 | M-22 |
| M7 Weather and ideas | A town, the forecast, today's idea, This week, ideas per day | U-SUG-1 to U-SUG-10, E-4, E-9, E-14, C-2 and C-7 re-checked | M-21 |
| M8 Backup, restore and the old app | The backup file, restore, import of the old Wardrobe, direct copy, the reminder and storage warning | U-BAK-1 to U-BAK-6, U-MIG-1 to U-MIG-8, E-6, E-7, P-9 (soak) | M-19, M-20, M-27, M-29 |
| M9 Polish and release 1.0 | Accessibility and performance passes, the README, release 1.0 | the whole suite, three runs in a row, plus the new C-9 | M-23, M-24, M-26, M-28, M-30 |

The full suite runs at every milestone; "tests that must pass" are the ones a milestone adds.

## 2. M1 Foundation and shell

**When it ships you can:** open `https://domphill.github.io/awardrobe/`, see the welcome, add it to your home screen, open it in flight mode, move between Closet, Outfits, Calendar, Stats and More (all empty but honest about it), set the theme, currency and temperature unit, see the privacy statement and version, and delete everything. You cannot add a garment yet.

**Built:**
- `index.html` with the content security policy, `manifest.webmanifest`, `sw.js` (`awardrobe-v1`, precache list, cache-first, update message), `main.js` (boot order from section 11 of the architecture, test hooks on localhost only).
- `ui/tokens.css`, `ui/base.css`, `ui/components.css`, `ui/screens.css` with the Pattern paper tokens from the mockups and the bundled Bricolage Grotesque woff2 files in `fonts/`.
- `ui/shell.js`, `ui/router.js`, `ui/components.js`, `ui/icons.js`, `ui/format.js`, `ui/screens/welcome.js`, `ui/screens/more.js` (settings, privacy, version, storage figure, delete everything; backup and weather cards come later), and empty-state versions of `closet.js`, `outfits.js`, `calendar.js`, `stats.js`.
- `app/records.js`, `app/prefs.js`, `app/boot.js`, `infra/db.js` (all six stores, transactions, estimate, persist), `infra/platform.js`, `domain/model.js` (categories, ids, versions, validation).
- The harness: `dev/cdp.ps1` (with network logging added), `dev/test.ps1`, `dev/unit.html`, `dev/runner.js`, `dev/check-deps.py`, `dev/e2e.js` (E-15, E-16), `dev/phone-checklist.md`.
- The GitHub repo `Domphill/awardrobe` with Pages serving `main`: you create it and turn on Pages, or I do it through the browser extension, as with your other apps.

**Tests that must pass:** C-1 to C-8; U-MOD-5, U-MOD-6, U-MOD-9; E-15, E-16.

**Manual checks:** M-1, M-2, M-3, M-4 (after the second release), M-25.

**Done when:** the suite passes and its output is in the report, the app is live at the address, and you have ticked M-1 to M-3 on the phone.

## 3. M2 The image engine

**When it ships you can:** nothing new on screen. This milestone is the engine that the whole product rests on, proven on the generated test images before any editor exists, so the hardest part is done where it is easiest to measure.

**Built:**
- `domain/colour/space.js`, `naming.js`, `palette.js`.
- `domain/image/mask.js`, `segment.js`, `edges.js`, `skin.js`, `shape.js`, `raster.js`, `png.js`.
- `infra/image-worker.js` and `infra/worker-client.js` (open a photo, segment, finalize, plus the message shape for commands used by M4), `infra/decode.js` (the main-thread fallback).
- `dev/images.js`: the generated image set T1 to T9, S1 to S80, K1 to K8, at 1600 by 2000 and the 12-megapixel T1.
- The unit test files for every module above.

**Tests that must pass:** U-COL-1 to U-COL-10; U-SEG-1 to U-SEG-10; U-MASK-1 to U-MASK-8; U-EDGE-1 to U-EDGE-5; U-RAS-1 to U-RAS-4; U-PNG-1, U-PNG-2; U-SHP-1 to U-SHP-4. The thresholds in NFR-38 and NFR-39 are met on the generated set; the numbers reached are recorded in `03-architecture.md` section 5.2 as Draft 2 if the tuning changed them.

**Manual checks:** none; the engine is exercised on real photos in M3.

**Done when:** the suite passes and the segmentation numbers (overlap per image, colour-naming score) are in the report.

## 4. M3 Add and see garments

**When it ships you can:** add a garment from the camera or the library, watch it cut out automatically with the strength control, see its colours and the type guess with its reason, fill in the details, save it, find it in the Closet by search, category, sort and filters, open its page, make it a favourite, and delete it. The editor tools come in M4; until then a cut-out that needs fixing can be retaken, re-cut at another strength, or kept as the whole photo.

**Built:**
- `ui/screens/garment-edit.js` (photo box, strength control as the tape measure, the details form; the tool palette is a stub that M4 fills), `ui/screens/closet.js` (full), `ui/screens/garment.js`.
- `app/garments.js` (add, change, delete, the one-transaction save), `app/pictures.js` (composite and cache, `pic()` drawing in `ui/components.js`), `app/editor-session.js` (open, strength, finalize; commands in M4), `app/drafts.js` (the form and photo part).
- `domain/search.js`; the wear and cost functions in `domain/model.js`; the shape nearest-neighbour vote in `app/garments.js`.
- `dev/e2e.js`: E-1 (main flow, A1 to A7, E1 to E5), E-10, the garment half of E-17; `dev/perf.js`: P-1, P-4, P-5, P-8.

**Tests that must pass:** U-SRCH-1 to U-SRCH-5; U-MOD-1 to U-MOD-4, U-MOD-10; E-1 (A8 and the editor-dependent parts wait for M4), E-10, E-17 garment part; P-1, P-4, P-5, P-8.

**Manual checks:** M-5, M-6, M-7, M-9.

**Done when:** the suite passes, the perf numbers are in the report, and you have added at least three real garments on the phone and ticked M-5 to M-7 and M-9.

## 5. M4 The editor

**When it ships you can:** fix any cut-out with Move, Wand, Select, Paint, Eraser, Restore, Rotate, Crop and Dropper, zoom to 8× with pinch and double-tap with touches landing exactly, use Remove skin, Cut out again and Detect colours again, undo and redo everything with named steps, hold to see the original, switch the checkerboard, keep the whole photo, pick up a draft after closing the app, and redo an old cut-out from its reduced original.

**Built:**
- `domain/image/geometry.js` (the Viewport), `domain/commands.js`.
- The command side of `infra/image-worker.js` (brush, select, wand, paint, rotate, mirror, crop, skin, strength as commands with undo records and dirty rectangles).
- `ui/screens/editor/stage.js`, `ui/screens/editor/tools.js`; the full `app/editor-session.js` and `app/drafts.js`.
- `dev/e2e.js`: E-2, E-11, the rest of E-1; `dev/perf.js`: P-2, P-3, P-7.

**Tests that must pass:** U-GEO-1 to U-GEO-6, U-GEO-8; U-CMD-1 to U-CMD-5; E-1 complete, E-2, E-11; P-2, P-3, P-7.

**Manual checks:** M-8, M-10, M-11, M-12, M-13, M-14, M-15.

**Done when:** the suite passes, the stroke and memory numbers are in the report, and you have fixed a real cut-out on the phone at 8× zoom and ticked M-10 to M-15.

## 6. M5 Outfits

**When it ships you can:** build outfits from your cut-outs with drag, resize, tilt by degrees, mirror, layers, two-finger twist and pinch, try combinations with the revolver that shows what is next, add a second top as a layer, shuffle, tidy, undo and redo, save with a picture, see the outfits list, and log an outfit as worn (the calendar screen itself is M6, so logging shows in the counts and the outfit page).

**Built:**
- `ui/screens/outfits.js` (full), `ui/screens/builder/stage.js`, `ui/screens/builder/mixer.js`.
- `app/outfits.js`, `app/builder-session.js`, the outfit picture rendering in `app/pictures.js`, the builder draft in `app/drafts.js`.
- `domain/layout.js`; the two-finger maths and piece transform in `domain/image/geometry.js`; the builder commands in `domain/commands.js`; `app/days.js` enough to log an outfit (the full calendar is M6).
- `dev/e2e.js`: E-3, E-8, the outfit half of E-17; `dev/perf.js`: P-6.

**Tests that must pass:** U-GEO-7, U-GEO-9; U-CMD-6; U-LAY-1 to U-LAY-3; U-MOD-7; E-3, E-8, E-17 complete; P-6.

**Manual checks:** M-16, M-17, M-18.

**Done when:** the suite passes and you have built and saved an outfit on the phone with the revolver and ticked M-16 to M-18.

## 7. M6 Calendar, logging, gone and stats

**When it ships you can:** log what you wore from a garment, an outfit or a calendar day, plan days ahead, be asked once about a plan that has passed, add notes, mark a garment gone and bring it back, see the gone list, and see Stats with most worn, not worn in 90 days, cost per wear, category and colour bars, and the gone group.

**Built:**
- `ui/screens/calendar.js` (month grid, day sheet, the passed-plan question; This week comes with the weather in M7), `ui/screens/stats.js`, the gone controls in `garment.js` and `garment-edit.js`, the gone list in `closet.js`.
- `app/days.js` (full), the gone and bring-back functions in `app/garments.js`.
- `dev/e2e.js`: E-5, E-12, E-13.

**Tests that must pass:** U-MOD-8; E-5, E-12, E-13.

**Manual checks:** M-22 (needs a day to pass; tick it when it has).

**Done when:** the suite passes and you have logged a real day and marked something gone on the phone.

## 8. M7 Weather and ideas

**When it ships you can:** set your town, see the forecast on the home and the calendar, get today's idea with its reason and the suited outfits, wear it, shuffle it or save it, plan the week from This week with an idea per day that you can accept, replace or swap for your own, all in °C or °F, and everything still works without a town or offline.

**Built:**
- `ui/screens/home.js`, the This week view and the weather on days in `ui/screens/calendar.js`, the weather card in `ui/screens/more.js`.
- `app/weather.js`, `app/ideas.js`, `infra/net.js` (restricted to the two Open-Meteo addresses, 8 s timeout).
- `domain/suggest.js`.
- `dev/e2e.js`: E-4, E-9, E-14, with the weather mock.

**Tests that must pass:** U-SUG-1 to U-SUG-10; E-4, E-9, E-14; C-2 and C-7 re-checked with the weather code present.

**Manual checks:** M-21.

**Done when:** the suite passes and you have set your real town on the phone and seen a forecast and an idea.

## 9. M8 Backup, restore and the old app

**When it ships you can:** make a backup file, restore it on this or another phone (add or replace), import the old Wardrobe's backup file, copy from the old app directly where the browser allows, see when you last backed up and be reminded after 30 days, and be warned when storage is nearly full. This is the milestone that brings your real closet across.

**Built:**
- `domain/backup-format.js`, `domain/migrate.js`, `infra/files.js`, `infra/old-wardrobe.js`, `app/backup.js`, the backup card and import offers in `ui/screens/more.js` and on the home, the imported-garment note in the editor.
- `dev/e2e.js`: E-6, E-7 with a generated old-format file and a seeded `wardrobe` database; `dev/perf.js`: P-9 behind `-Soak`.

**Tests that must pass:** U-BAK-1 to U-BAK-6; U-MIG-1 to U-MIG-8; E-6, E-7; P-9 run once and its numbers reported.

**Manual checks:** M-19, M-20, M-27, M-29.

**Done when:** the suite and the soak pass, and your real closet is in aWardrobe on your phone with the storage figure recorded.

## 10. M9 Polish and release 1.0

**When it ships you can:** use the finished app; the old Wardrobe can be retired whenever you choose.

**Built:**
- The accessibility pass: names on every control checked with the browser's accessibility tree in the harness (a new check C-9: every button, input and tool has an accessible name; every touch target is at least 44 px), text at 200% on the six mockup screens, reduced motion, colour-blind check.
- The performance pass: every P test run three times with the numbers in the README; any budget missed is fixed before release.
- `README.md` in the plain style of the old app's: what it does, putting it on your phone, where your things are kept, notes for making changes, and the release checklist (section 10 here).
- Version 1.0 in `sw.js` and on the More page.

**Tests that must pass:** the whole suite, three runs in a row, zero failures; C-9.

**Manual checks:** M-23, M-24, M-26, M-28, M-30.

**Done when:** three clean runs are in the report, you have ticked the accessibility items, and 1.0 is live.

## 11. Release procedure (every milestone)

1. Run `dev\test.ps1`. It must pass with no failures; its output goes in the report word for word.
2. Bump `VERSION` in `sw.js` (`awardrobe-v2`, `awardrobe-v3`, and so on) and the version shown on the More page.
3. Commit as `DAP <Domphill@users.noreply.github.com>` with no Co-Authored-By or Claude trailer; `dev/` stays out of git.
4. Push `main`; GitHub Pages publishes it within a minute or two.
5. Open the live address on the PC and check the version on More matches.
6. On the phone, open the app: the "new version" notice appears; reload; tick the milestone's manual checks.
7. Report: what shipped, the test output, the manual items ticked, and anything left out and why.

## 12. Risks I will watch for, and the tests this plan adds

The test plan covers what the requirements say. These are the inputs and situations the requirements do not mention that are most likely to bite, each with a test added to the milestone that owns the code. On approval they go into `04-test-plan.md` as Draft 2.

1. **Odd photos from the library** (M3): a screenshot PNG with transparency, a panorama 4:1, a tiny 200 px image, a square photo, a photo already rotated by its tag the other way. Test E-1 gains step "odd photos": each loads, orients and either cuts out or keeps the whole photo with the message, never a blank stage. Covers FR-21, FR-27, FR-28.
2. **A garment that fills the frame** (M2): the cut-out would keep 97% of the pixels; the engine must keep the whole photo rather than return an empty background model. Test U-SEG-11: a T1 variant cropped tight to the jumper gives whole-photo with the message. Covers FR-27.
3. **Midnight while the app is open** (M6): "today" changes between opening the app and tapping "Wore it today"; the log must go on the day of the tap, and a plan for "tomorrow" made at 23:59 becomes today's plan at 00:00 without turning into a wear until the day ends. Test U-MOD-11: the wear map and planned flag computed with a clock that crosses midnight. Covers FR-80, FR-81.
4. **The phone kills the page mid-save** (M3, M4): the garment transaction must leave nothing half-written and the draft must still be there. Test E-1 gains "reload during save": the test hook aborts the transaction after the pictures are queued; on reload the Closet has no new garment and the draft is offered. Covers FR-49, FR-61, NFR-27.
5. **Names with emoji, accents and very long text** (M3): search, cards and the garment page must not break. Test U-SRCH-6: searching and sorting names with emoji, combining accents and a 60-character name. E-10 gains a 60-character name card that wraps without clipping. Covers FR-3, NFR-19.
6. **A worker that cannot decode** (M2): an older browser without `createImageBitmap` orientation support in workers must take the main-thread fallback and still produce the same cut-out. Test U-SEG-12: the decode fallback path produces the same mask as the worker path on T1 (overlap at least 0.99). Covers FR-21, NFR-26.
7. **Two tabs open** (M1): the app open in a Safari tab and as a home-screen app at once must not corrupt data; the second one to write wins and the first refreshes. Test E-16 gains "second tab": a second page writes a setting; the first shows it after focus. Covers NFR-27.

## 13. How we work while building

- **Test-first, milestone by milestone.** For each milestone I write the unit tests from the test plan first, watch them fail, build the module until they pass, then build the screen with its end-to-end test, then run the whole suite, then release. Small commits as DAP along the way.
- **Where I need you:** creating the GitHub repo and turning on Pages (M1), the manual checks on your phone at the end of each milestone, your real photos in M3, your old Wardrobe backup in M8, and a yes or no at each milestone before the next starts.
- **Two ways to run the building, your choice:**
  - *Me, in this session* (recommended): I build every milestone myself, test-first, with the harness as the gate, and ask for an independent code review of each milestone from a fresh reviewer before I release it. Cheapest and fastest, and the four documents already carry the design, so the reviewer has a specification to check against.
  - *A fresh worker per task with a reviewer each time*: each piece is built by a separate helper that reads only its task, and checked by another before the next starts. More thorough on paper, but much more expensive, and the harness and PowerShell setup on this PC favour one builder who knows it.
- **What I will not do without asking:** drop a test to make a milestone pass, change a requirement, add a feature, or touch the old Wardrobe app.

## 14. What happens next

When you approve this plan and choose how to run the building, I start milestone 1: the foundation and shell, with the test harness, and come back with the test output, the live address and the first items for you to tick on your phone.
