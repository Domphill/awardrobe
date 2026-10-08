# aWardrobe

Your clothes, photographed and cut out, so you can see everything you own, put outfits together, plan what to wear with the weather, and notice what you actually wear.

Open it at **<https://domphill.github.io/awardrobe/>**. There is no account and nothing to install: it runs in your browser, and everything you add stays on your own device.

## Putting it on your phone

- **iPhone or iPad:** open the link in Safari, tap *Share*, then *Add to Home Screen*. This also stops Safari from clearing the app's saved data if you don't open it for a while.
- **Android:** open the link in Chrome, tap the menu (three dots), then *Add to Home screen* or *Install app*.
- When a new version is out, the app says so at the top the next time it is opened with a connection; tap *Reload* to take it.

## What it does

- **Closet:** photograph each piece against a plain background and the background is cut out for you. The colours are read from the photo (the lighting is corrected using the background, so navy doesn't become black under a warm bulb) and the type is guessed from the outline and from the clothes you have already named. Each garment has a category, type, colours, brand, size, price, when it was bought, seasons and occasions. Search, sort and filter the lot; mark a garment gone (sold, donated, binned, lost) and bring it back if you were wrong.
- **The editor:** fix a cut-out with tools that work like a paint program. *Move* (drag, pinch, or Zoom in, Zoom out and Fit), *Wand* (tap to remove, or restore, similar colours), *Select* (a brush that snaps to the garment's edges, then keep only that or remove it), *Paint* (colour the garment; *Keep shading* works like dye), *Eraser*, *Restore*, *Rotate* (with Mirror), *Crop* and a *Dropper* for colours. *Remove skin* takes arms, legs and faces out in one go; *Cut out again* starts over at a different strength; *Keep the whole photo instead* keeps the photo as it is and still lets the tools work on it. Undo covers everything, and an edit you leave half-done is kept as a draft.
- **Outfits:** put cut-outs together on a canvas; move, resize, tilt and mirror them, bring them forward or back, and save the combination with its own picture. *Tidy layout* arranges the pieces sensibly. **Mix and match** flicks through each kind of piece like a flip book, or shuffles a whole outfit, so you can try combinations quickly.
- **Calendar:** log what you wore each day, or plan an outfit for a day ahead; a plan that has passed is counted as worn once you confirm it (or close the question without answering). **This week** shows the next seven days with the forecast, an idea for each, the saved outfits that suit it and a tap to plan it.
- **Today:** the top of the Closet shows today's weather in your town with a one-line reason, the outfits that suit it, and an idea from your closet. Add your town under **More, Weather**; without one it goes by the season. Ideas favour pieces you haven't worn lately, and you can wear the idea, ask for another, or save it as an outfit.
- **Stats:** most worn, not worn in 90 days, cost per wear, what you spent, what has gone, and the closet by category and colour.
- **Backup:** one file with everything in it, including the photos, to move to another phone or keep safe. Restore it adding to what is there or replacing everything; the app reminds you after 30 days without a backup.
- **More:** your town for the weather; the theme (auto, light or dark), the currency and the temperature unit; whether a new photo is cut out automatically or kept as it is; the storage figure; a list of anything that has gone wrong, to copy into a message; and "Delete everything", which needs the word DELETE typed. The first open shows a short welcome and asks the browser to keep the app's data.
- **Moving from the old Wardrobe:** restore the old app's backup file and your clothes come over with their cut-outs, outfits, calendar and town. Where the old app's data is on the same device, the app offers to copy it directly; the old app is only read and is never changed.

## Tips for good cut-outs

- Lay the garment flat on a plain, contrasting background: a bed sheet, a wall, a wooden floor. Even light and no hard shadows across it.
- If some background is left, use the Wand or the Eraser on it. If part of the garment has gone, use Restore. Hold *see original* to compare.
- The cut-out learns what the background looks like from the edges of the photo (several shades, so folds, shadows and a lighting gradient all count as background) and what the garment looks like from the middle, then sorts every pixel between the two; the strength slider decides how strict it is.
- For a photo of someone wearing the garment: crop to it, then *Remove skin*, or select the garment and keep only that.
- A white shirt on a white sheet won't work well: use a darker background for pale clothes. The app warns when the contrast is low.
- A photo that is just an outfit, a screenshot, or a photo of something on a patterned background is kept whole rather than cut out badly; tick *Keep the whole photo instead* for anything you want kept as it is.

## Where your things are kept

Everything, including the photos, is stored by the browser (or the home-screen app) on the device you are using. Nothing is sent to a server; the app has no account. The only permission it ever asks for is the camera, the first time you take a photo from inside it. The one exception is optional: if you add a town for the weather, that town's map position is sent to Open-Meteo, a free weather service, to fetch the forecast, and nothing else. Each device keeps its own wardrobe: use **More, Make a backup** and **Restore from a backup** to move it. Clearing the browser's site data, or deleting the home-screen app, erases it. The app works without a connection once it has been opened once.

## Accessibility

Every control has a name a screen reader can say, and the selected tool in the editor is announced. Touch targets are at least 44 by 44 pixels. Text follows the phone's text size, and the app checks itself at 200%. The phone's reduced-motion setting is respected, light and dark themes follow the phone or your choice, and colour is never the only signal: a selected tool is filled in, active filters are counted in words, and gone garments are listed apart with the reason.

## Notes for making changes

- The app is plain HTML, CSS and JavaScript with no build step: `index.html`, `main.js` (the start-up and the test hooks), `sw.js` (the offline copy), and four folders. `ui/` is what you see and touch (screens, components, the editor and builder stages, the stylesheets); `app/` is the use cases (garments, outfits, days, the editor and builder sessions, the weather, ideas, backup, settings, boot); `domain/` is pure logic (the records, search, colour naming, the image maths, layout, suggestions, stats, the backup format and migration), with no screen, storage or network; `infra/` is the browser's edges (the database, the image worker and pipeline, files, the network, the old Wardrobe's database).
- The import rule: `ui` may use `app` and `domain`; `app` may use `domain` and `infra`; `domain` uses only `domain`; `infra` uses `infra` and `domain`; only `main.js` touches everything. `python dev\check-deps.py` checks it.
- The design, requirements, use cases, architecture, test plan and build plan are in `docs/`; the backup file format is described in `docs/03-architecture.md` section 9, so it can be read without the app (it is a plain zip of the records and the pictures).
- Tests run in headless Edge through PowerShell: `.\dev\test.ps1` runs everything (unit tests, every use case end to end, the performance budgets, the accessibility walk, the desktop width, the update notice and offline), `.\dev\scenario.ps1 -Name E-1` runs one scenario, `.\dev\unit-only.ps1 -Only U-SEG` runs some unit tests, and `.\dev\shots-*.ps1` take screenshots. Nothing is finished until the suite is green. The `dev/` folder stays out of git.
- After changing any file, bump `VERSION` in `sw.js` and `app/version.js` (the build number) or phones keep using the old copy; `RELEASE` is the name shown on the More page.
- The font is Bricolage Grotesque (SIL Open Font License), served from `fonts/`.

## Releasing a version

1. Run `.\dev\test.ps1` and keep its output; it must pass with no failures.
2. Bump `VERSION` in `sw.js` and `app/version.js` (and `RELEASE` when the name changes).
3. Commit as `DAP <Domphill@users.noreply.github.com>` with no other author lines; `dev/` stays out of git.
4. Push `main`; GitHub Pages publishes it within a minute or two.
5. Open the live address on the PC and check that the version on More matches.
6. On the phone, open the app: the new-version notice appears; reload; run the manual checks for what changed.
7. Note what shipped, the test output, the manual items ticked, and anything left out and why.

## Performance on the PC

The budgets the automated tests hold the app to, with the numbers from three runs in a row on the PC the suite runs on (headless Edge, a phone-sized window). Phones are slower; the budgets were set for a 2020 phone and the PC numbers are the ceiling the suite enforces.

| Test | What is measured | Budget | Run 1 | Run 2 | Run 3 |
|---|---|---|---|---|---|
| P-1 | 12 MP photo from pickPhoto to the first preview frame | 1000 ms (NFR-7) | 208 ms (208, 217, 180) | 182 ms (182, 218, 169) | 177 ms (177, 214, 172) |
| P-1 | longest main-thread task during it | 50 ms (NFR-7) | 0 ms | 0 ms | 0 ms |
| P-4 | "Add to closet" to the garment page | 750 ms (NFR-10) | 212 ms (168, 213, 212) | 172 ms (167, 237, 172) | 208 ms (178, 208, 223) |
| P-5 | opening the Closet with 300 garments to the first painted cards | 750 ms (NFR-11) | 53 ms (50, 62, 53) | 62 ms (52, 62, 62) | 51 ms (51, 62, 51) |
| P-2 | 500-point Restore stroke, worst pointer event handler time | 8 ms (NFR-8) | 0.50 ms (0.50, 0.40, 0.50) | 0.50 ms (0.60, 0.50, 0.50) | 0.50 ms (0.50, 0.40, 0.50) |
| P-2 | worst time from a frame's batch leaving to the draw that shows it | 16 ms, one frame (NFR-8) | 3 ms (2, 3, 3) | 3 ms (3, 2, 3) | 3 ms (3, 3, 3) |
| P-2 | a 200-point Select stroke with snapping, batch-to-draw at the 95th percentile | 16 ms (NFR-8) | 2 ms (2, 2, 2), worst batches 20, 14, 24 ms, over 199 batches | 2 ms (2, 2, 2), worst batches 16, 9, 14 ms, over 199 batches | 2 ms (2, 2, 2), worst batches 18, 10, 17 ms, over 199 batches |
| P-3 | Wand tap on T2 | 250 ms (NFR-9) | 16 ms (16, 15, 16) | 13 ms (13, 13, 15) | 14 ms (13, 14, 15) |
| P-3 | strength change on T2 | 250 ms (NFR-9) | 130 ms (130, 137, 110) | 109 ms (107, 187, 109) | 125 ms (125, 135, 113) |
| P-3 | "Cut out again" on T2 | 250 ms (NFR-9) | 129 ms (135, 129, 127) | 133 ms (132, 168, 133) | 127 ms (178, 127, 126) |
| P-7 | page heap with a 12 MP photo open and 20 undo steps (the undo records live in the photo tools) | 150 MB held, 250 MB peak (NFR-13) | 30 MB held after a collection, 99 MB at the peak before one | 35 MB held after a collection, 99 MB at the peak before one | 145 MB held after a collection, 181 MB at the peak before one |
| P-8 | stored size of a real garment (cut-out, thumbnail and reduced original), average over four real photos | 1.5 MB each (NFR-14) | 221 KB (T1 149 KB, T2 204 KB, T3 384 KB, T5 149 KB) | 221 KB (T1 149 KB, T2 204 KB, T3 384 KB, T5 149 KB) | 221 KB (T1 149 KB, T2 204 KB, T3 384 KB, T5 149 KB) |
| P-6 | twist and pinch with eight pieces, worst pointer handler time | 8 ms (NFR-12) | 1.30 ms (1.30, 1.30, 1.40) | 1.20 ms (1.30, 1.20, 1.20) | 1.20 ms (1.30, 1.00, 1.20) |
| P-6 | gap between frames while the fingers moved, 95th percentile | 20 ms, one frame with a little slack (NFR-12) | 7 ms (7, 7, 7), worst 17, 11, 11 ms | 7 ms (7, 7, 7), worst 14, 14, 13 ms | 7 ms (8, 7, 7), worst 11, 10, 14 ms |

P-9, the soak (500 garments backed up and restored, run on request with `-Soak`), completed on the PC in 1.4 s and 4.4 s with the page's heap peaking at 12 MB and 39 MB against a 300 MB budget.
