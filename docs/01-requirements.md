# aWardrobe: Requirements

Phase 1 of 5. Draft 2, 1 October 2026. Draft 1 was approved on 1 October 2026; Draft 2 applies the three amendments agreed with the use cases (FR-14, FR-49 and FR-74, see `02-use-cases.md` section 4). Nothing else changed.

## 0. How to read this

- **FR-n** is a functional requirement: something the app must do. Each one is a single sentence, and each can be checked, either by an automated test or by trying it on the phone.
- **NFR-n** is a non-functional requirement: how well the app must do it (speed, privacy, storage, accessibility, which browsers).
- A **garment** is one piece in the closet: clothing, shoes, a bag, an accessory. A **cut-out** is the garment's photo with the background made see-through. The **editor** is the screen where a cut-out is fixed.
- Technical words are explained in one line the first time they appear, and collected in section 8.
- Section 7 lists the engineering decisions I made on my own. You can overturn any of them.

## 1. What the app is for

aWardrobe is a private, phone-first app for one person. You photograph each garment, the app cuts it out, names its colours and guesses what it is. You put cut-outs together into outfits, see the weather for the days ahead with outfit ideas, log what you wore, and see what you actually wear and what each garment costs per wear. Everything, including the photos, stays on the phone. It is a careful rebuild of the existing Wardrobe app, with the same features done properly and a new look.

## 2. Where these requirements come from

### 2.1 The old app

I read the old app's README, every file in `src/`, the service worker, the test harness and the git history. It has: a closet with search, category chips, sort and filters; a garment page with wears, last worn and cost per wear; an add/edit screen with camera or photo picker, automatic cut-out, a strength slider, and nine tools (Move, Wand, Select, Paint, Eraser, Restore, Rotate, Crop, Dropper) plus Remove skin and undo; colour detection with lighting correction; a type guess from the outline; an outfit builder with drag, resize, tilt, mirror, layers, two-finger twist and pinch, a mix-and-match revolver and shuffle; a calendar with worn and planned days, a ten-day forecast and ideas per day; a Today card; stats; a JSON backup and restore; theme, currency and temperature settings; a welcome screen; offline support. Section 6 maps every old feature to its new requirement.

### 2.2 Your lessons list

Each lesson from your brief maps to specific requirements. Section 9 is the cross-reference.

### 2.3 Your answers to my questions (1 October 2026)

| Question | Your answer | Where it lands |
|---|---|---|
| Drop any old features? | No answer given, so **everything stays**, including the Paint tool, Stats and the Today card. | Section 6 |
| Add new things? | **Gone from closet** (sold, donated, binned). The revolver should **show what you can choose next**. Shuffle and outfits should allow **more than one top**, worn layered. Tilt by angle, mirror, and weather-based ideas on the calendar that you can accept or replace: confirmed. | FR-14 to FR-16, FR-72 to FR-76 |
| Keep the original photo? | **A reduced copy**, so cut-outs can be redone later. | FR-22, NFR-16 |
| Category and type lists? | No choice made, so the **old lists stay**. | FR-62 |
| Extra | A **fresh new UI that will impress you**. | NFR-30, NFR-31 |

Laundry state and several photos per garment were offered and not chosen, so they are out of scope (section 5).

## 3. Functional requirements

### 3.1 The closet

- **FR-1** The Closet shows every garment that is not marked gone, as a card with its cut-out, name and a favourite mark.
- **FR-2** The Closet shows how many garments are listed and, when a search or filter is active, how many there are in total.
- **FR-3** Search matches typed words against a garment's name, brand, type, category, colour names, occasions and notes, ignoring capitals and accents, and every typed word must match somewhere.
- **FR-4** Category chips with counts narrow the Closet to one category, and chips for categories with no garments are hidden.
- **FR-5** The Closet can be sorted by newest first, name, most worn, least worn, and price (high to low).
- **FR-6** Filters narrow the Closet by colour, season, occasion, favourites only, not worn in the last 90 days, and never worn, and the filters combine with each other and with search.
- **FR-7** The number of active filters is shown, and one tap clears them all.
- **FR-8** A separate "Gone from closet" list shows garments marked gone, with their reason and date.
- **FR-9** An empty Closet explains how to add the first garment and offers the camera in one tap.

### 3.2 The garment page

- **FR-10** The garment page shows the cut-out, name, brand, type, size, colours, seasons, occasions, price, date bought and notes.
- **FR-11** The garment page shows how many times it has been worn, when it was last worn, and its cost per wear (price divided by wears, where an unworn garment counts as one wear).
- **FR-12** "Wore it today" logs the garment on today's date with one tap, and "Another day" logs it on a past date or plans it for a future one.
- **FR-13** The garment page lists the outfits it is in, and each one opens that outfit.
- **FR-14** A garment can be marked gone from the closet with a reason (sold, donated, binned, lost, other) and a date, its page then offers "Bring back" in place of the wear buttons, and bringing it back restores it to the Closet.
- **FR-15** A gone garment disappears from the Closet, the outfit builder, the revolver and ideas, but stays on the calendar days it was worn, in the outfits it was saved in (marked gone), and in the stats.
- **FR-16** Cost per wear is still shown for a gone garment, so the stats answer "was it worth it".
- **FR-17** A garment can be marked favourite and unmarked from its page and from the editor.
- **FR-18** Deleting a garment asks for confirmation, then removes it from every outfit and every day and deletes all its pictures.
- **FR-19** The garment page opens the editor to change the photo, the cut-out or the details.

### 3.3 Adding a garment from a photo

- **FR-20** A garment can be added by taking a photo with the camera or choosing one from the phone's photos.
- **FR-21** A photo is shown the right way up whichever way the phone was held when it was taken.
- **FR-22** The app keeps a reduced copy of the original photo (longest side 2000 pixels, JPEG) with every garment, so the cut-out can be redone later without the original.
- **FR-23** The background is removed automatically as soon as a photo is chosen, with no tap needed.
- **FR-24** The automatic cut-out learns what the background looks like from several shades found around the photo's edges, and what the garment looks like from the middle, so folds, shadows and a lighting gradient in the background are removed along with it.
- **FR-25** A strength control from "keep more" to "remove more" re-runs the automatic cut-out at the new setting, and the previous result can be undone.
- **FR-26** When the garment and the background are too alike to separate reliably (a pale shirt on a pale wall), the app says so before you start fixing, and suggests a darker background or the Select brush.
- **FR-27** When the automatic cut-out would remove almost everything or almost nothing, the app keeps the whole photo, says so, and leaves the tools available. *(Amendment, 3 October 2026, from the first phone checks: this applies to the first automatic pass. A strength you choose afterwards always shows its real result, with a warning when it removes almost everything or almost nothing, so moving the control never flips to the whole photo unasked.)*
- **FR-28** A photo that cannot be opened produces a plain-English message naming the likely cause (for example a HEIC file) and what to do about it.
- **FR-29** Every change in the editor is shown as a quick preview, and the slow work of smoothing the edges is done once, when the garment is saved.
- **FR-30** The saved cut-out is trimmed to the garment with a small margin, has soft edges with no rim of background colour, and is saved together with a small thumbnail.
- **FR-31** The app can redo the automatic cut-out from the reduced original of an existing garment, so an old cut-out can be improved after the app's cut-out gets better.

### 3.4 The editor

- **FR-32** The editor opens with the Move tool selected, and Move only pans and zooms, so no tap or drag while Move is selected can change the cut-out.
- **FR-33** The picture can be zoomed between fit-to-screen and 8 times with pinch, buttons and double-tap, and moved with one finger in Move or two fingers in any tool.
- **FR-34** At every zoom level, scroll position, screen size and phone orientation, a tap or brush stroke lands on the exact picture pixel under the finger, including when the picture does not fill its box (the old brush-offset bug must be impossible by design).
- **FR-35** Wand: a tap removes (or, when switched, restores) the connected area of similar colour around the tap, with a slider for how much a tap takes, from the exact colour to similar colours.
- **FR-36** Select: a brush marks an area that snaps to the garment's edges by spreading only over similar colours within the brush's reach, snapping can be turned off, and the marked area can be kept on its own, removed, or cleared.
- **FR-37** Paint: a brush recolours the garment with a colour chosen from a palette or picked from the photo, either keeping the fabric's shading (like dye) or painting solid.
- **FR-38** Eraser and Restore are round brushes that make pixels transparent or bring them back.
- **FR-39** Brushes have at least three sizes, the size is chosen in screen pixels so zooming in gives finer control, and the brush is drawn as a ring under the finger before and during a stroke.
- **FR-40** Rotate turns the photo by any whole number of degrees using 90° buttons, a slider and a typed number, Mirror flips it left to right, and the cut-out follows exactly.
- **FR-41** Crop keeps a rectangle chosen by dragging its corners or moving the box, and can be applied or reset.
- **FR-42** Dropper picks a colour from the photo, corrected for the room's lighting, and either adds it to the garment's colours or sets the Paint colour, depending on where it was opened from.
- **FR-43** Remove skin takes skin-coloured areas (face, arms, hands, legs) out of the cut-out in one tap, and says how much it removed.
- **FR-44** "Cut out again" re-runs the automatic cut-out at the current strength, and "Detect colours again" re-reads the colours from the current cut-out.
- **FR-45** Every editing action, including automatic re-cuts, strength changes, Wand taps, brush strokes, selections, Paint, Crop, Rotate, Mirror and Remove skin, can be undone and redone, at least 20 steps back.
- **FR-46** The Undo and Redo buttons show whether they can be used and name what they will undo or redo (for example "Undo crop").
- **FR-47** Press-and-hold on a "show original" button shows the untouched photo behind the cut-out, so it is obvious what is missing.
- **FR-48** The transparent part of the cut-out is shown as a checkerboard, and can be switched to a plain light or dark background to judge the edges.
- **FR-49** Leaving the cut-out editor or the outfit builder with unsaved changes asks before discarding, and an unsaved draft survives switching tabs, the phone putting the app in the background, and the app being closed and reopened.
- **FR-50** Any garment can be kept as the whole photo instead of a cut-out, by choice.
- **FR-51** A garment photographed on a person can be cropped, selected with the snapping brush and kept on its own, and have skin removed, in any order, and the result can be saved as a normal cut-out.
- **FR-52** The editor works with a mouse and keyboard on a PC as well as with touch on a phone, and every tool can be reached by keyboard.

### 3.5 Colours and type

- **FR-53** After a cut-out, the app detects up to three colours of the garment and names each from a fixed list of plain colour names, each with a swatch.
- **FR-54** Colour detection corrects for the room's lighting by treating the photo's background as a neutral grey reference when the background is near-grey or near-white, so navy under a warm bulb is still called navy.
- **FR-55** Colour detection judges colours by how different they look to the eye (in a perceptual colour space, see glossary), and the lit and shadowed parts of one fabric count as one colour, not two.
- **FR-56** The first colour is the main colour; colours can be reordered, removed, added from a palette, or picked from the photo, and the main colour is what filters and stats use.
- **FR-57** After a cut-out, the app suggests a category and type, says in one line why, and never overrides a category or type you have already chosen.
- **FR-58** The suggested name is "main colour + type" (for example "Navy jumper") until you type your own.

### 3.6 Garment details

- **FR-59** A garment has a name, category, type, brand, size, price, date bought, seasons, occasions, notes and a favourite flag.
- **FR-60** Saving checks that there is a photo and either a name or a type, and that the price (if given) is a number, and explains in plain words what is missing.
- **FR-61** Saving stores the garment's record, cut-out, thumbnail and reduced original as one unit, so a half-saved garment never appears in the Closet.
- **FR-62** Categories and their types are the old app's lists (Tops, Bottoms, Dresses, Outerwear, Shoes, Bags, Accessories, Jewellery, Other, each with its types), and a type that is not on the list can be typed in.

### 3.7 Outfits and the builder

- **FR-63** The Outfits page lists saved outfits newest first, each with its picture, name and favourite mark.
- **FR-64** The builder is a portrait canvas (3 wide by 4 high) on which pieces can be dragged, resized by a corner handle, tilted by degrees using buttons, a slider and a typed number, mirrored, brought to the front or sent to the back, and taken off.
- **FR-65** Two fingers on a piece twist to turn it and pinch to resize it, and the angle shown in the tool bar follows live.
- **FR-66** Pieces are added from the Closet with search and a category filter, several at a time, and new pieces are placed in a tidy default layout (outerwear left, tops over bottoms in the middle, shoes at the foot, bags and accessories to the side) without moving pieces already placed.
- **FR-67** An outfit can contain more than one piece of the same category, for example a shirt and a jumper worn layered.
- **FR-68** Mix and match shows a revolver for each piece slot: the current piece in the middle with the previous and next candidates visible either side, and arrows or a swipe move along the garments of that category.
- **FR-69** A revolver slot can be added for any category, including a second slot of a category already present, and removed, and turning one slot never changes another slot.
- **FR-70** Shuffle fills the canvas with a random but sensible combination: a dress, or a top and bottoms, sometimes a second top as a layer, sometimes outerwear, shoes, and sometimes a bag or an accessory, and shuffling again gives a different combination.
- **FR-71** Tidy layout rearranges all pieces into the default layout in one tap.
- **FR-72** Every builder action (move, resize, tilt, mirror, layer order, add, take off, revolver turn, shuffle, tidy) can be undone and redone.
- **FR-73** An outfit has a name (suggested from its pieces), seasons, occasions and a favourite flag.
- **FR-74** Saving an outfit needs at least one piece, and renders a picture of the canvas that is used in lists, on the calendar and in ideas.
- **FR-75** An outfit can be logged as worn today or on another day, or planned for a day ahead, from its page.
- **FR-76** An outfit's page shows how many times it has been worn and when last.
- **FR-77** Deleting an outfit asks for confirmation, keeps the garments, and days that had the outfit keep its pieces as individual garments.

### 3.8 Calendar, logging and planning

- **FR-78** The Calendar shows a month at a time, Monday first, with today marked, and each day shows a picture of what was worn or planned plus a count when there is more than one thing.
- **FR-79** Tapping a day opens it: the outfits and garments worn or planned, each of which can be opened or removed, and an outfit or garments can be added from there.
- **FR-80** A day up to and including today counts as worn, a later day counts as planned, and wear counts include every day up to today.
- **FR-81** When a planned day has passed, the next time the app opens it asks once whether the plan was worn, and "No" either removes the plan or lets you say what you wore instead; if the question is ignored the plan counts as worn.
- **FR-82** A day can carry a short note (where you went, how it felt).
- **FR-83** The Calendar can jump to today, move month by month, and be opened on a given day from elsewhere in the app, for example from a "See day" link after logging.
- **FR-84** A "This week" view lists the next seven days, each with its forecast and either its plan or an idea, so a week can be planned in one place.
- **FR-85** Days with a forecast show the weather symbol and the day's high temperature on the calendar.

### 3.9 Weather and ideas

- **FR-86** A town is set by typing its name and choosing from the matches, can be removed, and the app says exactly what is sent (the town's map position) and to whom (Open-Meteo).
- **FR-87** With a town set, the app fetches a ten-day forecast (daily high, low, chance of rain, kind of weather, wind) and reuses it for three hours before fetching again.
- **FR-88** The forecast is shown for today and the days ahead in the temperature unit chosen (°C or °F).
- **FR-89** Without a town, or without a connection, ideas go by the season and the app says so, and nothing in the app is blocked or broken by the weather being unavailable.
- **FR-90** The app's home shows today's weather (or the season), the saved outfits that suit it, and one combination put together from the Closet, with "Wear this today", "Another idea" and "Save as outfit".
- **FR-91** For today and each forecast day, the app offers ideas: saved outfits that suit the weather, and a combination composed from the Closet that favours garments not worn lately and avoids anything worn in the last two days unless nothing else fits.
- **FR-92** An idea can be accepted in one tap (logged for today or planned for the day), shuffled for another, saved as an outfit, or replaced by your own outfit or pieces.
- **FR-93** Ideas respect the temperature band (hot, warm, mild, cool, cold), rain and snow (waterproof outerwear in, sandals out), the seasons tagged on garments, favourites, and leave out gone garments.
- **FR-94** Every idea comes with a one-line reason (for example "Cool and wet, 9°C: something warm on top, with a coat that can take it").
- **FR-95** Weather requests only ever go to Open-Meteo's town-search and forecast addresses, and only after a town has been set.

### 3.10 Stats

- **FR-96** Stats shows the number of garments and outfits, the closet's value (sum of prices of garments not gone), and the number of days logged this month.
- **FR-97** Stats shows the most worn garments, the garments not worn in 90 days with a "see all" that opens the Closet filtered, and cost per wear best and worst.
- **FR-98** Stats shows the closet by category and by main colour as bars.
- **FR-99** Stats shows the gone garments as a group (how many, what they cost, their average cost per wear), separate from the closet's value.

### 3.11 Backup, restore and import from the old Wardrobe

- **FR-100** One tap creates a single backup file holding every garment with its cut-out, thumbnail and reduced original, every outfit with its picture, every day, and the settings, with progress shown while it is made.
- **FR-101** A backup can be restored on any device, either added to what is already there (where the same record exists on both sides the newer copy wins) or replacing everything after a confirmation.
- **FR-102** The app imports a backup file from the old Wardrobe app (its "format 1" JSON file with photos inside) and converts it, keeping names, details, colours, cut-outs, thumbnails, outfits with their positions, days, and the town setting.
- **FR-103** If the old Wardrobe's data is reachable in this browser (same site, same browser profile), the app offers to copy it directly without a file, and never changes the old app's data.
- **FR-104** After any restore or import, the app reports how many garments, outfits and days came in and names any records it could not read, instead of failing silently.
- **FR-105** A garment imported from the old app without a reduced original is marked so, and the editor explains that a fresh cut-out needs a new photo.
- **FR-106** The app shows when the last backup was taken and reminds you after 30 days without one.
- **FR-107** The app shows how much storage it is using and roughly how much the browser allows.
- **FR-108** "Delete everything" needs the word DELETE typed, then wipes all of the app's data on the device.

### 3.12 App shell, settings and privacy

- **FR-109** The first open shows a short welcome that explains what the app does and that everything stays on the phone, then asks the browser to keep the data (persistent storage, see glossary).
- **FR-110** The main areas (Closet, Outfits, Calendar, Stats, More) are each reachable with one tap from anywhere, and an Add action offers "add a garment", "new outfit" and "log today".
- **FR-111** Settings offer theme (auto, light, dark), currency symbol (£, €, $) and temperature unit (°C, °F).
- **FR-112** The More page states in plain words that nothing leaves the device except the optional weather request, names Open-Meteo, and shows the app's version.
- **FR-113** Where the browser cannot store data (for example a private window), the app says so at the top of the screen and still works for that session.
- **FR-114** When a new version has been installed, the app tells you and uses it the next time it opens, or straight away on a tap.
- **FR-115** An error on one page shows a plain message with a way back to the Closet, never a blank screen, and the error is recorded so it can be reported.

## 4. Non-functional requirements

### 4.1 Privacy

- **NFR-1** All records, photos and settings are stored only on the device, in the browser's IndexedDB (a database that lives inside the browser), and are never sent anywhere.
- **NFR-2** After installation the app makes no network request except to Open-Meteo's two addresses (town search and forecast), and only once a town is set; this is enforced by a content security policy (a rule the page declares that tells the browser which addresses it may contact) as well as by the code.
- **NFR-3** No code, fonts, icons or analytics are loaded from other sites; everything the app needs is bundled with it.
- **NFR-4** The privacy statement in the app matches what the code can do: a test checks that the allowed addresses in the policy are exactly the two Open-Meteo addresses.

### 4.2 Offline

- **NFR-5** After the first visit, the app opens and works fully without a connection: adding and editing garments, outfits, calendar, stats, backup and restore; only the weather needs the network.
- **NFR-6** The app is installable as a home-screen app on iPhone Safari and Android Chrome, with its own icon and name, and opens without browser chrome.

### 4.3 Performance (measured on a 2020 mid-range phone, such as an iPhone SE 2020 or Pixel 4a, and in headless Edge on the PC for the automated tests)

- **NFR-7** A 12-megapixel photo is loaded, turned the right way up, reduced and automatically cut out in under 2 seconds, and the screen never freezes for more than 100 milliseconds while it happens (the image work runs in a Web Worker, a background thread that runs alongside the screen so taps still respond).
- **NFR-8** A brush stroke segment is drawn within 16 milliseconds (one frame at 60 frames per second), and pan and zoom stay at 60 frames per second.
- **NFR-9** A Wand tap, a strength change or a re-cut shows its result within 500 milliseconds.
- **NFR-10** Saving a garment (final edge smoothing, trim, thumbnail, writing to storage) completes within 1.5 seconds.
- **NFR-11** The app opens to a usable Closet of 300 garments in under 1.5 seconds offline, loading thumbnails as they scroll into view.
- **NFR-12** The outfit builder with eight pieces drags, twists and pinches at 60 frames per second.
- **NFR-13** The whole app stays under 250 MB of memory with a 12-megapixel photo open in the editor and 20 undo steps stored, so iPhone Safari does not reload the page.

### 4.4 Storage

- **NFR-14** A garment uses no more than 1.5 MB on average all-in (cut-out, thumbnail and reduced original), so a 500-garment closet fits in 750 MB.
- **NFR-15** Records (garments, outfits, days, settings) are small and separate from the pictures, so lists and stats never load a picture they do not show.
- **NFR-16** The reduced original is kept at 2000 pixels on the longest side as JPEG, the cut-out at 1200 pixels, and the thumbnail at 360 pixels.
- **NFR-17** When storage use passes 80% of what the browser allows, the app warns and suggests a backup, and a failed write because storage is full produces a plain message and keeps the draft.
- **NFR-18** A backup of 500 garments can be made and restored on the phone without running out of memory (the file is written and read a piece at a time, not as one giant text).

### 4.5 Accessibility

- **NFR-19** Every control has a visible or spoken label, every touch target is at least 44 by 44 pixels, and text contrast meets WCAG AA (4.5 to 1, the standard "readable" level).
- **NFR-20** The app works with the phone's text size set to 200% without clipped or overlapping controls.
- **NFR-21** The app respects the phone's reduced-motion setting and offers light and dark themes.
- **NFR-22** VoiceOver (iPhone) and TalkBack (Android) can reach every control, including the editor tools and the outfit builder's controls, and the currently selected tool is announced.
- **NFR-23** Colour is never the only signal: a selected tool, an active filter or a gone garment is also shown by shape or words.

### 4.6 Browsers and devices

- **NFR-24** First-class: iPhone Safari (iOS 17 or newer) and Android Chrome (current), both as installed home-screen apps and in the browser.
- **NFR-25** Also works in desktop Edge and Chrome (where the automated tests run) and in Safari on iPad and Mac, with layouts that use the wider screen sensibly.
- **NFR-26** Photos from the iPhone camera (which the phone hands over as JPEG) and from the photo library open; a HEIC file that the browser cannot decode gives the message in FR-28.

### 4.7 Reliability and data safety

- **NFR-27** Every save is all-or-nothing: the app never shows a garment without its pictures or an outfit pointing at a garment that does not exist, and pictures with no owner are cleaned up on start.
- **NFR-28** The app never loses an edit silently: a failed save says so and keeps the draft (FR-49).
- **NFR-29** Stored data carries a format version, and the app moves older data forward on open, including data from the old app on import; the backup file format is documented so it can be read without the app.

### 4.8 Look and feel

- **NFR-30** The visual design is new (its own palette, typography, spacing and layout, in light and dark), not a reskin of the old app, and is presented as mockups in Phase 3 for your approval before any screen is built.
- **NFR-31** The app feels finished: no layout jumps while loading, transitions at 60 frames per second, consistent spacing and sizes, and the same control looks and behaves the same everywhere.
- **NFR-32** Everything the app says is plain British English with no jargon; dates are day-first, weeks start on Monday, the default currency is £ and the default temperature unit is °C.

### 4.9 Code, shared site and releases

- **NFR-33** The app is plain HTML, CSS and JavaScript with no build step and no Node, served as static files from GitHub Pages at `https://domphill.github.io/awardrobe/`.
- **NFR-34** Because the site is shared with your other apps, the app only ever touches caches named `awardrobe-*`, a database named `awardrobe`, and browser storage keys starting `awardrobe.`; the one exception is reading (never writing) the old app's `wardrobe` database for FR-103.
- **NFR-35** Every release bumps the service worker's VERSION (the service worker is the small script that keeps a copy of the app for offline use), and the version is shown on the More page.
- **NFR-36** Git commits are authored as `DAP <Domphill@users.noreply.github.com>` with no Co-Authored-By or Claude trailer, and the `dev/` folder (tests and tools) stays out of git.

### 4.10 Testing

- **NFR-37** The pure modules (colour naming, segmentation, geometry and coordinate mapping, suggestions, cost per wear, backup format and migration) have unit tests that run in headless Edge through the PowerShell harness copied from the old app, with pass/fail output.
- **NFR-38** Cut-out quality is measured on a generated test set with known correct masks, using an overlap score (how much the app's mask and the correct mask agree, from 0 to 1): at least 0.95 on a plain sheet, 0.90 on a creased sheet with a shadow, 0.90 on a wooden floor, a warning raised on a pale shirt on a pale wall, and 0.85 for a garment on a person after crop, select and skin removal.
- **NFR-39** Colour naming is measured on generated swatches of every colour name under neutral, warm and cool lighting, and at least 90% get the expected name.
- **NFR-40** Every use case in Phase 2 has an end-to-end test, every test names the FR or UC it covers, and nothing is reported as done without the tests having been run and their output shown.

## 5. Out of scope

These are deliberately not part of aWardrobe. Some could come later; none affects the design now except where noted.

- Accounts, cloud sync, or sharing between devices other than by backup file.
- More than one person's wardrobe on one device.
- Sharing outfits to social media or exporting pictures for others.
- Laundry state ("in the wash") and several photos per garment: offered, not chosen.
- Shopping links, wish lists, price tracking, barcode or label scanning.
- Body measurements, fit advice or virtual try-on.
- Packing lists for trips.
- Notifications or reminders that arrive when the app is closed (the backup reminder in FR-106 shows only when the app is open).
- Decoding HEIC files inside the app (the phone converts them when a photo is picked).
- Any language other than British English.
- Automatic backups to iCloud or Google Drive (the backup is a file you save where you like).
- Replacing the old Wardrobe app: it stays live and untouched until you decide to retire it.

## 6. How the old app's features map to the new requirements

| Old feature | Status | Requirements |
|---|---|---|
| Closet list, search, category chips, sort, filters | Kept | FR-1 to FR-7, FR-9 |
| Garment page: wears, last worn, cost per wear, outfits it is in, wore it today / another day, favourite, delete | Kept | FR-10 to FR-13, FR-17 to FR-19 |
| Camera or photo picker, orientation fix, HEIC message | Kept | FR-20, FR-21, FR-28 |
| Automatic cut-out (background from edges, garment from middle), strength slider, flood-fill fallback, keep whole photo | Kept and improved: pale-on-pale warning, re-cut from original | FR-23 to FR-27, FR-31, FR-50 |
| Move, Wand, Select, Paint, Eraser, Restore, Rotate, Crop, Dropper, Remove skin, Cut out again, Detect colours again | Kept; mapping bug designed out, brush ring, keyboard | FR-32 to FR-44, FR-52 |
| Undo (8 steps, no redo) | Replaced: undo and redo, 20+ steps, named | FR-45, FR-46 |
| Zoom 1× to 4× with buttons | Improved: fit to 8×, pinch, double-tap | FR-33 |
| Draft kept while switching tabs (lost on close) | Improved: survives close | FR-49 |
| Colour detection with lighting correction, shadow merging, 26 names | Kept | FR-53 to FR-56 |
| Type guess from outline | Kept as a requirement; method decided in Phase 3 | FR-57 |
| Details form, categories and types | Kept | FR-59 to FR-62 |
| Outfit list and builder: drag, resize, tilt, mirror, layers, twist and pinch, add pieces, tidy layout | Kept | FR-63 to FR-66, FR-71 |
| Mix and match revolver (one per category) and shuffle | Improved: shows next and previous, slots, layering, shuffle with layers | FR-67 to FR-70 |
| Outfit name, seasons, occasions, favourite, thumbnail, wear it, delete | Kept; builder gains undo and redo | FR-72 to FR-77 |
| Calendar month grid, day sheet, plan or log, notes, forecast on days | Kept | FR-78 to FR-80, FR-82, FR-83, FR-85 |
| (new) Plan confirmation, This week view | New | FR-81, FR-84 |
| Weather: town search, ten-day forecast, three-hour cache, °C/°F, privacy note | Kept | FR-86 to FR-89, FR-95 |
| Today card with ideas, suited outfits, shuffle, save as outfit | Kept | FR-90 |
| Ideas per calendar day, accept or replace | Kept | FR-91 to FR-94 |
| Stats page | Kept, plus gone garments | FR-96 to FR-99 |
| JSON backup and restore (merge or replace) | Replaced by a new file format; old file still imports | FR-100 to FR-102, FR-104, NFR-18 |
| (new) Direct import from the old app, backup reminder, gone-garment import note | New | FR-103, FR-105, FR-106 |
| Storage use, delete everything with typed DELETE | Kept | FR-107, FR-108 |
| Welcome screen, persistent storage request | Kept | FR-109 |
| Tabs and Add menu, More page | Kept; layout free for the new design | FR-110 |
| Theme, currency | Kept | FR-111 |
| Memory-only banner, update toast, per-page error catch | Kept | FR-113 to FR-115 |
| (new) Gone from closet | New | FR-8, FR-14 to FR-16, FR-99 |

Nothing from the old app is dropped.

## 7. Decisions I made (you can overturn any of them)

1. **Stored sizes.** Reduced original at 2000 px, cut-out at 1200 px (up from 1000 px, for sharper outfits on modern screens), thumbnail at 360 px. The exact file formats for the cut-out are chosen in Phase 3 to hit the 1.5 MB per garment budget.
2. **Undo depth** of at least 20 steps, in both the editor and the outfit builder. Phase 3's command design makes deep history cheap.
3. **Brush size in screen pixels**, not picture pixels, so zooming in gives finer control. The old app sized brushes relative to the picture.
4. **Plans count as worn by default** once the day has passed, as in the old app, but the app asks once so you can correct it (FR-81). This keeps the stats honest without nagging.
5. **"This week" view** added (FR-84) because "plan the week with the weather" is one of your use cases and the old app only had the month grid and a day sheet.
6. **New backup file format** rather than the old one-big-JSON format, because a 500-garment backup would be hundreds of megabytes of text that a phone cannot hold in memory at once. The old format still imports (FR-102).
7. **Direct import from the old app** (FR-103) added because both apps live on the same site, so on Android Chrome and in Safari's own tabs the old data is readable without a file. On an iPhone home-screen app the data is walled off per app, so the file route stays the main one.
8. **Backup reminder after 30 days** (FR-106) added as a small safeguard, since all data lives on one device.
9. **Show original on hold** (FR-47) added because judging a cut-out without seeing what was there is guesswork.
10. **Gone reasons** are sold, donated, binned, lost and other, with an optional date.
11. **Shuffle layering**: a second top is added about one time in three when the weather band is cool or cold and the first top is not already warm (exact rules in Phase 3).
12. **The old category and type lists stay** as they are, since you did not choose otherwise. If you want them editable, say so and I will add it.
13. **The Paint tool stays**, because nothing was chosen to drop.
14. **Type recognition method** is left to Phase 3, as you asked. The requirement (FR-57) is the same either way.

## 8. Glossary

- **PWA (progressive web app):** a website that can be added to the home screen and opened like an app, and that works offline.
- **IndexedDB:** a database that lives inside the browser on the device. The app's records and photos are stored in it.
- **Service worker:** a small script the browser keeps that stores a copy of the app's files so it opens without a connection, and fetches new versions when online.
- **Cache:** the service worker's stored copy of the app's files, named so it does not clash with your other apps.
- **Persistent storage:** a promise from the browser not to delete the app's data to free space without asking.
- **Mask:** a map saying, for each pixel of the photo, whether it is garment (kept) or background (made transparent).
- **Cut-out:** the photo with the mask applied, so the background is transparent.
- **Thumbnail:** a small copy of a picture for lists and the calendar.
- **Perceptual colour space (OKLab):** a way of writing colours as numbers where the distance between two colours matches how different they look to a person.
- **Web Worker:** a background thread: code that runs alongside the screen so heavy work does not freeze taps and scrolling.
- **Content security policy:** a rule the page declares telling the browser which addresses it may contact; anything else is blocked by the browser itself.
- **Overlap score (IoU):** how much two masks agree, from 0 (no overlap) to 1 (identical).
- **WCAG AA:** the common standard for readable contrast and accessible controls.
- **Headless Edge:** the Edge browser run without a window, so tests can drive the real app automatically.

## 9. Your lessons, traced to requirements

| Lesson | Requirements |
|---|---|
| Cut-out quality: background modelled from the edges (several shades), garment from the middle, strength control | FR-23 to FR-25, NFR-38 |
| Pale garments on pale backgrounds need a warning or a smarter method | FR-26 |
| Garments on a person: crop, snapping selection brush, skin removal | FR-36, FR-41, FR-43, FR-51 |
| Colour naming: correct for lighting with the background as grey reference, perceptual space, no shadow split | FR-54, FR-55, NFR-39 |
| Editor: accurate touch mapping at every zoom, all tools, brush sizes, undo and redo of everything, safe default tool, fast preview with edge work at save | FR-29, FR-32 to FR-46, NFR-7 to NFR-10 |
| Outfit builder: drag, resize, tilt by degrees, mirror, layer order, two-finger twist and pinch, revolver, shuffle | FR-64 to FR-72 |
| Weather: forecasts on the calendar for the days ahead with ideas per day, accept or replace | FR-84, FR-85, FR-91, FR-92 |
| Type recognition: proper decision in the architecture | FR-57, decision 14 |
| Nothing reported done without tests run and shown | NFR-40 |

## 10. What happens next

When you approve this document (with any changes), Phase 2 writes the use cases: one per goal (add a garment from a photo, fix a cut-out, build an outfit, plan the week with the weather, log what I wore, back up and restore, import from the old app, mark a garment gone, and so on), each with its steps, alternatives, error cases and the FRs it covers, plus a table proving every FR above appears in at least one use case.
