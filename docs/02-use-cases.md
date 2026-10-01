# aWardrobe: Use Cases

Phase 2 of 5. Draft 1, written 1 October 2026, approved 1 October 2026. Builds on `01-requirements.md`; the three amendments in section 4 have been applied there as Draft 2.

## 0. How to read this

- There is one use case per goal you have when you pick up the app. Each has: the goal, who is involved, what must be true before you start, the main flow as numbered steps (what you do, then what the app does), what is true afterwards, alternative flows (other routes to the same goal, labelled A1, A2...), error cases (what the app does when something goes wrong, labelled E1, E2...), and the requirements it covers.
- "You" is the owner of the wardrobe, the only user. "The phone" is the browser or the installed home-screen app. "Open-Meteo" is the weather service.
- Steps are written so a test can follow them one at a time. Phase 4 maps one end-to-end test to each use case.
- Section 3 is the traceability table: every one of FR-1 to FR-115 appears in at least one use case, and each use case's "Covers" line matches the table (checked by a script).
- Section 4 proposes three small amendments to the requirements that writing the use cases exposed. Nothing else in the requirements changes.

## 1. The use cases at a glance

| Use case | Goal | Where it starts |
|---|---|---|
| UC-1 | Add a garment from a photo | Add, "Add a garment" |
| UC-2 | Fix a cut-out | The editor, after a photo is loaded |
| UC-3 | Build an outfit | Outfits, "New outfit" |
| UC-4 | Plan the week with the weather | Calendar, "This week" |
| UC-5 | Log what I wore | A garment or outfit page, the home, or the calendar |
| UC-6 | Back up and restore | More, Backup |
| UC-7 | Move my clothes over from the old Wardrobe | More, Restore, or the offer on first open |
| UC-8 | Try combinations with mix and match | The outfit builder, "Mix and match" |
| UC-9 | Decide what to wear today | The home |
| UC-10 | Find a garment in the closet | Closet |
| UC-11 | Change a garment | A garment page, Edit |
| UC-12 | Mark a garment gone from the closet | A garment page, "Gone from closet" |
| UC-13 | See what I actually wear | Stats |
| UC-14 | Set up the weather for my town | More, Weather |
| UC-15 | Install the app and open it for the first time | The address in Safari or Chrome |
| UC-16 | Change settings, check storage, delete everything | More |
| UC-17 | Delete a garment or an outfit | A garment or outfit page |

## 2. The use cases

### UC-1 Add a garment from a photo

**Goal:** a new garment in the Closet with a clean cut-out, its colours and type filled in, in under a minute for an easy photo.

**Actors:** you; the phone's camera and photo library.

**Preconditions:**
- The app is installed or open (UC-15).
- The garment is laid flat on a plain background that contrasts with it (recommended; the app copes with less).

**Main flow:**
1. You tap Add and choose "Add a garment". (FR-110)
2. You tap "Take a photo" and the phone's camera opens, or "Choose a photo" and the phone's photo library opens. (FR-20)
3. You take or pick the photo. The app loads it, turns it the right way up, and keeps a reduced copy (2000 pixels on the long side) for later. (FR-21, FR-22)
4. The app removes the background automatically, showing "Cutting it out…" while the screen stays responsive, and finishes within two seconds for a 12-megapixel photo. (FR-23, FR-24, NFR-7)
5. The app shows the cut-out on a checkerboard, zoomed to fit, with the Move tool selected so nothing can be changed by accident. (FR-29, FR-32, FR-48)
6. The app lists up to three detected colours as chips, main colour first, corrected for the room's lighting. (FR-53 to FR-56)
7. The app suggests a category and type with a one-line reason ("Looks like trousers, going by the two legs") and shows a suggested name such as "Navy jeans". (FR-57, FR-58)
8. You look at the cut-out. If it needs fixing, you continue in UC-2 and come back here.
9. You fill in or change the details: name, category, type, brand, size, price, date bought, seasons, occasions, notes, favourite. (FR-59, FR-62)
10. You tap "Add to closet". The app checks the details, smooths the edges once, trims the cut-out, makes the thumbnail, stores the record and its three pictures as one unit, and opens the new garment's page. (FR-29, FR-30, FR-60, FR-61, NFR-10)

**Result:** the garment is in the Closet with its cut-out, thumbnail and reduced original, and its page shows no wears yet. (FR-1, FR-10)

**Alternative flows:**
- **A1 First garment ever.** At step 1, the empty Closet offers "Add your first garment" with the camera in one tap. (FR-9)
- **A2 Strength.** At step 8, you drag the strength control towards "keep more" or "remove more"; the app re-cuts, and you can undo back to the previous result. (FR-25, FR-45)
- **A3 Whole photo.** At step 8, you tick "Keep the whole photo instead"; the tools hide and the saved picture is the photo as taken. (FR-50)
- **A4 Change category.** At step 9, picking a different category empties the type, shows that category's types, and updates the suggested name; the app's guess never overwrites a category or type you have chosen. (FR-57, FR-58, FR-62)
- **A5 Own type.** At step 9, you type a type that is not in the list. (FR-62)
- **A6 Colours.** At step 9, you reorder the colours, remove one, add one from the palette, or pick one from the photo with the Dropper. (FR-42, FR-56)
- **A7 Different photo.** At step 8, you tap "Different photo" or "Retake"; the app confirms if you have made edits, then repeats steps 3 to 7.
- **A8 Interrupted.** At any step after 3, you switch tabs, the phone puts the app in the background, or the app closes; when you come back the draft is offered where you left it. (FR-49)
- **A9 On a person.** At step 8, the photo is of someone wearing the garment; you crop, select and remove skin in UC-2. (FR-51)

**Error cases:**
- **E1 Photo cannot be opened** (a HEIC file the browser cannot decode, or a damaged file). At step 3, the app says what is likely wrong and what to do ("Choose JPEG in the camera's format settings"), and stays on the add screen. (FR-28, NFR-26)
- **E2 Nothing or everything.** At step 4, if the cut-out would remove almost everything or almost nothing, the app keeps the whole photo, says so, and leaves the tools available. (FR-27)
- **E3 Pale on pale.** At step 4, if the garment and background are too alike, the app warns before you start fixing and suggests a darker background or the Select brush; you can retake or carry on. (FR-26)
- **E4 Missing details.** At step 10: no photo, or no name and no type, or a price that is not a number. The app names what is missing and stays on the form. (FR-60)
- **E5 Save fails** (storage full or a write error). At step 10, the app says so, keeps the draft, and nothing half-saved appears in the Closet. (FR-61, NFR-17, NFR-28)
- **E6 Camera unavailable.** At step 2, if the camera cannot be used, the phone's own picker opens instead and nothing in the app breaks. (FR-20)

**Covers:** FR-1, FR-9, FR-10, FR-20 to FR-30, FR-32, FR-42, FR-45, FR-48 to FR-51, FR-53 to FR-62, FR-110. Exercises NFR-7, NFR-10, NFR-16, NFR-17, NFR-26, NFR-28.

### UC-2 Fix a cut-out

**Goal:** a cut-out with no leftover background and no missing garment, fixed in a few taps, with every change reversible.

**Actors:** you.

**Preconditions:** the editor is open with a photo loaded (from UC-1 step 5, or from UC-11).

**Main flow** (the common case: a bit of background left and a bit of garment missing):
1. The editor shows the cut-out zoomed to fit, with Move selected. (FR-32)
2. You pinch, double-tap or tap + to zoom in on the problem, and drag to move around. (FR-33)
3. You choose Wand and tap the leftover background; the connected area of similar colour disappears. (FR-35)
4. If the tap took too much or too little, you tap Undo, move the "how much a tap takes" slider, and tap again. (FR-35, FR-45)
5. You choose Restore, pick a brush size, and brush over the missing part; a ring shows the brush under your finger, and the garment comes back exactly where you brushed, at any zoom. (FR-34, FR-38, FR-39)
6. You press and hold "Show original" to compare with the photo, then let go. (FR-47)
7. You tap Undo for a stroke that went wrong and Redo to put it back; the buttons say what they will undo or redo. (FR-45, FR-46)
8. You tap "Detect colours again" if the cut-out changed enough to matter. (FR-44)
9. You return to the details and save (UC-1 step 10); the final edge smoothing happens now, once. (FR-29, FR-30)

**Result:** the saved cut-out matches what you saw in the preview, with soft edges and no rim of background.

**Alternative flows:**
- **A1 Strength first.** At step 3, the leftover background is widespread: you move the strength control instead, and the app re-cuts. (FR-25)
- **A2 Select brush.** At step 3 or 5, you choose Select, brush roughly over the garment, and the selection snaps to its edges; "Keep only this" removes everything else, "Remove this" removes the selection, "Clear" starts again; snapping can be turned off for areas it gets wrong. (FR-36)
- **A3 On a person.** The photo shows someone wearing the garment: you Crop to the garment (FR-41), Select the garment and "Keep only this" (FR-36), tap "Remove skin" (FR-43), then tidy with Eraser or Restore; any order works. (FR-51)
- **A4 Rotate.** You choose Rotate: 90° buttons, the slider, or a typed number of degrees, and Mirror; the cut-out follows. (FR-40)
- **A5 Crop.** You choose Crop, drag the corners or move the box, and Apply or Reset. (FR-41)
- **A6 Paint.** You choose Paint, pick a colour from the palette or from the photo with the Dropper, choose "keep shading" or "solid", and brush over the garment. (FR-37, FR-42)
- **A7 Eraser.** You choose Eraser and brush away anything that should not be there. (FR-38)
- **A8 Start again.** You tap "Cut out again" to re-run the automatic cut-out at the current strength. (FR-44)
- **A9 Background.** You switch the checkerboard to a plain light or dark background to judge the edges. (FR-48)
- **A10 Whole photo.** You tick "Keep the whole photo instead". (FR-50)
- **A11 On the PC.** You do all of the above with a mouse, and switch tools and undo with the keyboard. (FR-52)
- **A12 Phone turned.** You rotate the phone to landscape mid-edit; the picture re-fits and touches still land on the right pixel. (FR-34)
- **A13 Pale warning.** The app warned at load (FR-26); you use Select to mark the garment by hand. (FR-26, FR-36)
- **A14 Leave.** You tap Back with unsaved changes; the app asks whether to keep the draft or discard it. (FR-49)
- **A15 Old cut-out.** The garment was saved earlier or imported; you opened the editor from its page to redo the cut-out from the reduced original (UC-11 A2). (FR-31)

**Error cases:**
- **E1 Nothing there.** At step 3, the Wand tap finds nothing to remove (or restore): the app says so and adds no undo step. (FR-35, FR-46)
- **E2 No skin.** In A3, "Remove skin" finds no skin: the app says so. (FR-43)
- **E3 Nothing selected.** In A2, "Keep only this" with nothing marked: the app asks you to brush over the area first. (FR-36)
- **E4 Crop too small.** In A5, a box smaller than the minimum is not applied, and the app says why. (FR-41)
- **E5 Undo exhausted.** At step 7, Undo and Redo are disabled when there is nothing to undo or redo. (FR-46)
- **E6 Slow device.** At any step, a brush stroke never lags behind the finger, and a re-cut shows progress rather than freezing. (NFR-8, NFR-9)

**Covers:** FR-25, FR-26, FR-29 to FR-52. Exercises NFR-7 to NFR-9, NFR-13.

### UC-3 Build an outfit

**Goal:** a saved outfit made from cut-outs arranged the way you would wear them, with a picture for lists and the calendar.

**Actors:** you.

**Preconditions:** at least one garment not marked gone in the Closet.

**Main flow:**
1. You open Outfits; saved outfits are listed newest first with pictures. You tap "New outfit". (FR-63, FR-110)
2. You tap "Add pieces", search or filter by category, tick several garments and tap Add; they appear in the tidy default layout. (FR-66)
3. You drag a piece to move it and drag its corner handle to resize it. (FR-64)
4. You tap a piece to select it and use the tool bar: tilt left or right, set the angle with the slider or by typing degrees, mirror, bring to front, send to back, take off. (FR-64)
5. You put two fingers on a piece and twist to turn it and pinch to resize it; the angle in the tool bar follows. (FR-65)
6. You add a second top and lay it over the first, as a layer. (FR-67)
7. You tap Undo to take back a move you did not mean, and Redo. (FR-72)
8. You give it a name (or keep the suggested one), seasons, occasions and favourite. (FR-73)
9. You tap "Save outfit". The app renders the canvas as a picture and opens the outfit's page, which shows "not worn yet" and offers "Wore it today" and "Another day". (FR-74 to FR-76)

**Result:** the outfit is in the Outfits list, and each garment's page lists it under "In outfits". (FR-13, FR-63)

**Alternative flows:**
- **A1 Tidy.** At any step, you tap "Tidy layout" and the pieces return to the default layout. (FR-71)
- **A2 Mix and match.** At step 2, you use the revolver and shuffle instead of picking by hand (UC-8). (FR-67)
- **A3 Edit.** At step 1, you open an existing outfit instead; saving replaces its picture. (FR-74)
- **A4 From an idea.** You tapped "Save as outfit" on an idea (UC-9 or UC-4): the builder opens with the pieces already placed and the season set. (FR-92)
- **A5 Favourite.** On the outfit's page you toggle favourite. (FR-73)
- **A6 Gone garment.** A saved outfit contains a garment later marked gone: it shows marked gone on the canvas, and it is not offered under "Add pieces". (FR-15)
- **A7 Wear it.** On the outfit's page you log it (UC-5). (FR-75)
- **A8 Delete.** On the outfit's page you delete it (UC-17). (FR-77)
- **A9 Interrupted.** You switch tabs or the app closes before saving; the builder draft is offered when you come back, and leaving with changes asks first. (FR-49 as amended, section 4)

**Error cases:**
- **E1 Empty.** At step 9, with no pieces on the canvas, the app asks for at least one piece and does not save. (FR-74 as amended, section 4)
- **E2 Empty closet.** At step 2, with no garments, the app says to add clothes first and offers the camera. (FR-66)
- **E3 Save fails.** At step 9, the app says so and keeps the draft. (NFR-28)
- **E4 Broken picture.** At step 9, a garment whose cut-out cannot be read is skipped in the picture and named in a message. (NFR-27)

**Covers:** FR-13, FR-15, FR-49, FR-63 to FR-67, FR-71 to FR-77, FR-92, FR-110. Exercises NFR-12, NFR-27, NFR-28.

### UC-4 Plan the week with the weather

**Goal:** the next seven days each have an outfit planned that suits the forecast, chosen from the app's ideas or your own.

**Actors:** you; Open-Meteo (forecast).

**Preconditions:** a town is set (UC-14); the app has been online within the last three hours or can go online now; the Closet has garments, ideally with seasons tagged.

**Main flow:**
1. You open Calendar and tap "This week". Seven days are listed, each with its weather symbol, high and low in your unit, and either what is already planned or an idea with a one-line reason. (FR-84, FR-85, FR-88, FR-91, FR-94)
2. Monday's idea suits you: you tap "Plan this". It becomes Monday's plan. (FR-92)
3. Tuesday's idea does not: you tap "Another idea" and get a different combination that still suits the weather. (FR-92)
4. For Wednesday you tap "Choose my own" and pick a saved outfit, or pieces from the Closet; that becomes the plan. (FR-79, FR-92)
5. Thursday is forecast wet: its idea includes waterproof outerwear and no sandals. (FR-93)
6. You open the month view: the planned days show their pictures and weather symbols. (FR-78, FR-85)
7. Days pass. The next time the app opens after Monday, it asks once whether Monday's plan was worn (UC-5 A5). (FR-81)

**Result:** the day records hold the plans; wear counts do not change until each day has passed. (FR-80)

**Alternative flows:**
- **A1 No town.** At step 1, without a town the ideas go by the season, and the week view says so with a link to set a town. (FR-89)
- **A2 Offline.** At step 1, offline with a forecast less than three hours old, the kept forecast is used; older than that, the season stands in and the view says so. (FR-87, FR-89)
- **A3 Beyond ten days.** Days without a forecast show no weather and season-based ideas. (FR-87)
- **A4 Recently worn.** An idea avoids garments worn in the last two days unless nothing else fits. (FR-91)
- **A5 Gone.** Gone garments never appear in ideas. (FR-15, FR-93)
- **A6 Save the idea.** You tap "Save as outfit" on an idea and the builder opens with it (UC-3). (FR-92)
- **A7 Change a plan.** You open a planned day and remove or swap what is planned. (FR-79)
- **A8 Change the unit.** You switch °C to °F in settings and the week view follows. (FR-88)

**Error cases:**
- **E1 Weather fails.** At step 1, Open-Meteo does not answer or returns an error: the week view shows a plain message, uses the season, and everything else works. (FR-89)
- **E2 Nothing suits.** A day where nothing in the Closet suits the weather shows a hint to tag seasons or add pieces, instead of an empty idea. (FR-91)

**Covers:** FR-15, FR-78 to FR-81, FR-84, FR-85, FR-87 to FR-89, FR-91 to FR-94.

### UC-5 Log what I wore

**Goal:** an honest record of what was worn on each day, so wear counts, last-worn dates and cost per wear are right.

**Actors:** you.

**Preconditions:** at least one garment or outfit exists.

**Main flow:**
1. You tap "Wore it today" on a garment's page (or on an outfit's page, or "Wear this today" on the home idea, or Add then "Log today"). (FR-12, FR-75, FR-90, FR-110)
2. The app logs it on today's date and shows "Logged today" with a "See day" link. (FR-83)
3. You tap "See day": the calendar opens on today with what was logged. (FR-79, FR-83)
4. The garment's page now shows one more wear and "last worn today"; an outfit's page shows its wears too. (FR-11, FR-76, FR-80)

**Result:** today's day record lists the garment or outfit; counts and cost per wear update everywhere.

**Alternative flows:**
- **A1 Another day.** At step 1, you tap "Another day" and pick a date: a past date counts as worn, a future date as planned. (FR-12, FR-75, FR-80)
- **A2 From the calendar.** You open Calendar, tap a day, and add an outfit or pieces to it. (FR-78, FR-79)
- **A3 Note.** On a day you type a short note. (FR-82)
- **A4 Undo a mistake.** On a day you remove something logged by mistake. (FR-79)
- **A5 Passed plan.** The app opens after a planned day has passed and asks "Did you wear this on Monday?": Yes keeps it as worn; No offers "Remove" or "I wore something else", which opens that day so you can log what you wore; if you ignore the question it is not asked again, and the plan counts as worn. (FR-81)
- **A6 Several things.** You log an outfit and extra pieces on the same day; the calendar cell shows a count. (FR-78)
- **A7 Moving about.** You jump to today and move month by month. (FR-83)
- **A8 Gone garment.** A gone garment's page offers "Bring back" instead of "Wore it today"; past days keep it. (FR-14 as amended, FR-15)

**Error cases:**
- **E1 Save fails.** At step 2, the app says so and nothing is logged. (NFR-28)
- **E2 Bad date.** In A1, an empty or impossible date is refused, and the picker stays open. (FR-12)

**Covers:** FR-11, FR-12, FR-14, FR-15, FR-75, FR-76, FR-78 to FR-83, FR-90, FR-110. Exercises NFR-28.

### UC-6 Back up and restore

**Goal:** a single file that holds the whole wardrobe, and the wardrobe back again on this or another phone.

**Actors:** you; the phone's file saving and picking.

**Preconditions:** for restore, a backup file reachable from the phone (Files on iPhone, Downloads on Android, or a folder on the PC).

**Main flow, backup:**
1. You open More and tap "Make a backup". The app shows progress while it packs the records and every picture. (FR-100)
2. The phone's save or share sheet opens; you save the file (named with today's date) to Files, Drive, or wherever you keep it. (FR-100)
3. More now shows "Last backup: today". (FR-106)

**Main flow, restore:**
4. On the new phone, after the welcome (UC-15), you open More and tap "Restore from a backup", then pick the file. (FR-101)
5. If the Closet is empty, the app restores straight away; otherwise it asks "Add to mine" or "Replace everything" and, for replace, confirms. (FR-101)
6. The app shows progress, then reports how many garments, outfits and days came in and names anything it could not read. (FR-104)
7. The Closet, Outfits, Calendar, Stats and settings (including the town) are as they were. (FR-101)

**Result:** both phones hold the same wardrobe; the backup file can be kept as a safety copy.

**Alternative flows:**
- **A1 Merge.** In step 5 with "Add to mine", a record present on both sides keeps whichever was changed more recently. (FR-101)
- **A2 Reminder.** More than 30 days after the last backup, the app reminds you when opened. (FR-106)
- **A3 Storage.** More shows how much space the app uses and roughly how much the browser allows; above 80% it warns and suggests a backup. (FR-107, NFR-17)
- **A4 Old Wardrobe file.** In step 4 the file is from the old app: UC-7 takes over. (FR-102)
- **A5 Big closet.** 500 garments back up and restore on the phone without running out of memory. (NFR-18)
- **A6 PC.** You do the same in Edge on the PC with the file in a folder.

**Error cases:**
- **E1 Not a backup.** At step 4, the file is not a backup of either app: the app says so and nothing changes. (FR-104)
- **E2 Partly unreadable.** At step 6, some records or pictures cannot be read: the rest come in, and the report names what did not. (FR-104)
- **E3 Out of space.** At step 6, storage runs out: the app says so, and nothing half-written remains. (NFR-17, NFR-27)
- **E4 Cancelled.** At step 2, you cancel the save sheet: "Last backup" does not change. (FR-106)

**Covers:** FR-100, FR-101, FR-102, FR-104, FR-106, FR-107. Exercises NFR-17, NFR-18, NFR-27, NFR-29.

### UC-7 Move my clothes over from the old Wardrobe

**Goal:** every garment, outfit and day from the old Wardrobe app in aWardrobe, without retaking a single photo.

**Actors:** you; the old Wardrobe app.

**Preconditions:** the old app still has your data, and either you can make a backup file in it (More, "Download a backup") or the old app's data is reachable in the same browser.

**Main flow, by file:**
1. In the old Wardrobe you tap More, "Download a backup", and save the JSON file.
2. In aWardrobe you open More, "Restore from a backup", and pick that file. The app recognises the old format. (FR-102)
3. The app converts it: garments with their names, details, colours, cut-outs and thumbnails; outfits with every piece's position, size, angle and mirror; days; and the town setting. (FR-102)
4. Garments from the old app have no reduced original, so they are marked, and the editor will explain that a fresh cut-out needs a new photo. (FR-105)
5. The app reports how many garments, outfits and days came in and names anything it could not read. (FR-104)
6. The Closet shows your clothes.

**Result:** the old data is in aWardrobe; the old app is untouched.

**Alternative flows:**
- **A1 Direct copy.** On an Android phone, or in Safari's own tabs on an iPhone, the old app's data is in the same browser: on first open and under More, the app offers "Copy from the old Wardrobe on this device"; you tap it and steps 3 to 6 happen without a file, reading only. (FR-103)
- **A2 Twice.** You import again later: records already present are kept unless the old copy is newer, so nothing doubles up. (FR-101)
- **A3 Not reachable.** On an iPhone where the old app runs from the home screen, its data is walled off from other apps, so the direct option does not appear and you use the file. (FR-103)
- **A4 Re-cut later.** You want a better cut-out of an imported garment: you take a new photo of it (UC-11 A1). (FR-105)

**Error cases:**
- **E1 Unreadable picture.** At step 3, a photo in the old file cannot be decoded: that garment is skipped and named in the report, because a garment is never saved without its pictures. (FR-61, FR-104)
- **E2 Broken file.** At step 2, the file is damaged: the app says so and nothing changes. (FR-104)
- **E3 Out of space.** As UC-6 E3. (NFR-17, NFR-27)

**Covers:** FR-61, FR-101 to FR-105. Exercises NFR-18, NFR-27, NFR-29, NFR-34.

### UC-8 Try combinations with mix and match

**Goal:** see what goes with what by flicking through your clothes one slot at a time, and see what is coming next.

**Actors:** you.

**Preconditions:** in the builder (UC-3) with garments in at least two categories.

**Main flow:**
1. You tap "Mix and match". A revolver appears for each slot: if the canvas is empty, one slot each for tops, bottoms and shoes (whichever of those have garments); if pieces are already placed, one slot per piece. (FR-68)
2. Each slot shows the current garment in the middle with the previous and next garments of that category visible either side. (FR-68)
3. You swipe the tops slot (or tap its arrow): the next top takes the place of the current one on the canvas, in the same position and size; the other slots do not change. (FR-68, FR-69)
4. You tap "Add a slot", choose Tops, and a second tops slot appears: a jumper now sits over the shirt on the canvas. (FR-67, FR-69)
5. You tap Shuffle: the app fills every slot with a random, sensible combination, sometimes with a layered second top, sometimes outerwear, a bag or an accessory; you tap again for another. (FR-70)
6. You tap Undo to go back to the combination you preferred. (FR-72)
7. You close the mixer, nudge pieces on the canvas, and save (UC-3 steps 8 and 9).

**Result:** an outfit built by trying, not by picking.

**Alternative flows:**
- **A1 Remove a slot.** You remove the second tops slot; its piece leaves the canvas. (FR-69)
- **A2 Empty slot.** You turn a slot to "none" to try the outfit without that category. (FR-68)
- **A3 Dress.** Shuffle sometimes chooses a dress instead of a top and bottoms. (FR-70)
- **A4 Gone.** Gone garments are never in a revolver. (FR-15)

**Error cases:**
- **E1 One garment.** A category with a single garment shows it with nothing either side, and its arrows are disabled. (FR-68)
- **E2 Too few.** With garments in fewer than two categories, the mixer explains and offers to add clothes. (FR-66)

**Covers:** FR-15, FR-66 to FR-70, FR-72.

### UC-9 Decide what to wear today

**Goal:** a quick answer to "what shall I wear" that suits today's weather and favours clothes that have not been out lately.

**Actors:** you; Open-Meteo.

**Preconditions:** garments in the Closet; a town set for the weather (otherwise the season is used).

**Main flow:**
1. You open the app. The home shows today's weather (symbol, high, low, chance of rain) and a one-line reason ("Mild and dry, 14°C: a top and a light layer"). (FR-90, FR-94)
2. Below it, the saved outfits that suit today. (FR-90, FR-91)
3. Then one combination put together from the Closet, favouring garments not worn lately and avoiding anything worn in the last two days. (FR-91, FR-93)
4. You tap "Wear this today": it is logged for today (UC-5). (FR-92)

**Result:** today's wear is logged in one tap.

**Alternative flows:**
- **A1 Another idea.** At step 3, you tap "Another idea" for a different combination. (FR-92)
- **A2 Save it.** You tap "Save as outfit" and the builder opens with the pieces placed (UC-3). (FR-92)
- **A3 A saved outfit.** At step 2, you tap an outfit, see its page, and tap "Wore it today". (FR-75)
- **A4 No town.** At step 1, the home shows the season instead, with a link to set your town. (FR-89)
- **A5 Choose your own.** You ignore the ideas and log something else (UC-5). (FR-92)
- **A6 Rain.** A wet day's idea includes a waterproof layer and no sandals. (FR-93)

**Error cases:**
- **E1 Weather fails.** At step 1, the weather cannot be fetched: the home says so (offline, or the service did not answer), uses the season, and the ideas still appear. (FR-89)
- **E2 Nothing suits.** At step 3, nothing fits the weather: the home says so and suggests tagging seasons or adding pieces. (FR-91)

**Covers:** FR-75, FR-89 to FR-94.

### UC-10 Find a garment in the closet

**Goal:** find one garment, or a set of garments, among hundreds in a few seconds.

**Actors:** you.

**Preconditions:** garments in the Closet.

**Main flow:**
1. You open Closet: cards with cut-outs, names and favourite marks, and the count. (FR-1, FR-2)
2. You type "navy" in search: only garments with navy in the name, brand, type, category, colours, occasions or notes remain, and the count shows "12 of 180". (FR-2, FR-3)
3. You tap the Tops chip: only navy tops remain; chips for empty categories are not shown. (FR-4)
4. You change the sort to "least worn". (FR-5)
5. You open Filters, choose season Winter and "not worn in the last 90 days", and tap Show; the Filters button shows "(2)". (FR-6, FR-7)
6. You tap a card: the garment's page opens with its details, wears, last worn, cost per wear, and the outfits it is in. (FR-10, FR-11, FR-13)
7. You tap the star to make it a favourite. (FR-17)
8. You go back: search, chip, sort and filters are as you left them; you tap "Clear" to remove the filters. (FR-7)

**Result:** you found it, and the Closet is back to showing everything.

**Alternative flows:**
- **A1 Gone list.** You open "Gone from closet" to see garments that have left, with reasons and dates (UC-12). (FR-8)
- **A2 Empty.** With no garments, the Closet explains and offers the camera. (FR-9)
- **A3 Edit.** From the garment's page you tap Edit (UC-11). (FR-19)
- **A4 Big closet.** With 300 garments the Closet opens in under 1.5 seconds and scrolls smoothly, loading thumbnails as they come into view. (NFR-11)
- **A5 Accents.** Searching "cafe" finds "Café". (FR-3)

**Error cases:**
- **E1 Nothing matches.** At step 2 or 5, the Closet says "Nothing matches" and offers to clear the search and filters. (FR-3, FR-7)

**Covers:** FR-1 to FR-11, FR-13, FR-17, FR-19. Exercises NFR-11.

### UC-11 Change a garment

**Goal:** update a garment's details, colours or photo, or redo its cut-out, without losing anything.

**Actors:** you.

**Preconditions:** the garment exists.

**Main flow:**
1. On the garment's page you tap Edit; the editor opens with the current cut-out and details. (FR-19)
2. You change details (price, seasons, notes) and colours (reorder, remove, add from the palette or the photo). (FR-56, FR-59)
3. You tap "Save changes". The app checks the details and stores everything as one unit; the page shows the changes. (FR-60, FR-61)

**Result:** the garment is updated; its wears and days are untouched.

**Alternative flows:**
- **A1 New photo.** At step 2, you tap "New photo" or "Choose a photo": the app loads, cuts out, detects colours and suggests a type as in UC-1 steps 3 to 7, you fix it in UC-2, and the old pictures are replaced on save. (FR-20 to FR-24, FR-53 to FR-57)
- **A2 Redo the cut-out.** At step 2, you tap "Redo the cut-out": the app re-runs the automatic cut-out from the reduced original with today's method, and you fix it in UC-2. (FR-31)
- **A3 Imported garment.** In A2, the garment came from the old app and has no reduced original: the app explains that a fresh cut-out needs a new photo and offers A1. (FR-105)
- **A4 Whole photo.** You tick or untick "Keep the whole photo instead". (FR-50)
- **A5 Favourite.** You toggle favourite here or on the page. (FR-17)
- **A6 Gone.** You mark the garment gone (UC-12). (FR-14)
- **A7 Delete.** You delete it (UC-17). (FR-18)
- **A8 Interrupted.** You leave before saving; the draft is offered when you return, and leaving with changes asks first. (FR-49)

**Error cases:**
- **E1 Missing details.** At step 3, no name and no type, or a price that is not a number: the app says what is wrong. (FR-60)
- **E2 Save fails.** At step 3, the app says so and keeps the draft. (NFR-28)

**Covers:** FR-14, FR-17 to FR-24, FR-31, FR-49, FR-50, FR-53 to FR-57, FR-59 to FR-61, FR-105. Exercises NFR-28.

### UC-12 Mark a garment gone from the closet

**Goal:** a garment you sold, gave away, binned or lost leaves the Closet but keeps its history, so the stats stay true.

**Actors:** you.

**Preconditions:** the garment exists.

**Main flow:**
1. On the garment's page you tap "Gone from closet", choose a reason (sold, donated, binned, lost, other) and optionally a date, and confirm. (FR-14)
2. The garment leaves the Closet, the builder's "Add pieces", the revolver and all ideas. (FR-15)
3. The calendar days it was worn still show it, and saved outfits that include it show it marked gone. (FR-15)
4. Its page still shows wears and cost per wear, now with "Gone: sold, 12 Sep 2026", and offers "Bring back" instead of the wear buttons. (FR-14, FR-16)
5. Stats counts it in the "gone" group, apart from the closet's value. (FR-99)

**Result:** the garment is out of daily use but not out of history.

**Alternative flows:**
- **A1 Bring back.** You open "Gone from closet" in the Closet, tap the garment and "Bring back"; it returns to the Closet. (FR-8, FR-14)
- **A2 From the editor.** You mark it gone from the edit screen instead. (FR-14)

**Error cases:**
- **E1 Save fails.** At step 1, the app says so and the garment stays as it was. (NFR-28)

**Covers:** FR-8, FR-14 to FR-16, FR-99. Exercises NFR-28.

### UC-13 See what I actually wear

**Goal:** see which clothes earn their keep and which do not.

**Actors:** you.

**Preconditions:** garments, and ideally some logged days and prices.

**Main flow:**
1. You open Stats: the number of garments and outfits, the closet's value, and the days logged this month. (FR-96)
2. Most worn, top five, each opening the garment. (FR-97)
3. Not worn in 90 days, with "See all", which opens the Closet filtered to those garments and sorted least worn. (FR-5, FR-6, FR-97)
4. Cost per wear: best value and "yet to earn their keep", with price divided by wears and unworn counting as one wear. (FR-11, FR-97)
5. The closet by category and by main colour, as bars. (FR-98)
6. Gone garments: how many, what they cost, their average cost per wear, apart from the closet's value. (FR-16, FR-99)

**Result:** you know what to wear more, and what to let go.

**Alternative flows:**
- **A1 No prices.** Without any prices, the cost per wear section is replaced by a line explaining how to get it. (FR-97)
- **A2 Empty.** With no garments, Stats explains and offers the camera. (FR-96)

**Error cases:**
- None beyond a page error (UC-15 A3).

**Covers:** FR-5, FR-6, FR-11, FR-16, FR-96 to FR-99.

### UC-14 Set up the weather for my town

**Goal:** forecasts for your town on the calendar and the home, with only the town's position ever leaving the phone.

**Actors:** you; Open-Meteo.

**Preconditions:** online.

**Main flow:**
1. You open More, Weather, and type your town; the app searches and lists the matches with their regions. (FR-86)
2. You choose one. The app saves it, says "Weather set to <town>", and the privacy line says what is sent (the town's map position) and to whom (Open-Meteo). (FR-86, FR-112)
3. The app fetches the ten-day forecast and keeps it for three hours. (FR-87, FR-95)
4. The home and the calendar show the weather for today and the days ahead in your unit. (FR-85, FR-88, FR-90)

**Result:** a town is set; ideas use real weather.

**Alternative flows:**
- **A1 Unit.** You switch °C to °F; every temperature follows. (FR-88, FR-111)
- **A2 Remove.** You tap "Stop using the weather"; the town and the kept forecast are removed, nothing more is sent, and ideas go by the season. (FR-86, FR-89)
- **A3 Change town.** You search again and choose another; the forecast is fetched afresh. (FR-86, FR-87)
- **A4 Only Open-Meteo.** The browser blocks any request to another address, so even a bug cannot send data elsewhere. (FR-95, NFR-2)

**Error cases:**
- **E1 No match.** At step 1, no town by that name: the app suggests trying the nearest bigger town. (FR-86)
- **E2 Offline.** At step 1 or 3, you are offline: the app says so and keeps the last forecast if there is one. (FR-89)
- **E3 Service error.** At step 3, Open-Meteo returns an error: the app shows a plain message and uses the season until the next try. (FR-89)

**Covers:** FR-85 to FR-90, FR-95, FR-111, FR-112. Exercises NFR-1 to NFR-4.

### UC-15 Install the app and open it for the first time

**Goal:** aWardrobe on your home screen, working offline, with your data kept.

**Actors:** you; the phone's browser.

**Preconditions:** the address `https://domphill.github.io/awardrobe/` and a connection for the first visit.

**Main flow:**
1. You open the address in Safari (iPhone) or Chrome (Android). The welcome explains what the app does and that everything stays on the phone. (FR-109)
2. You tap "Open my wardrobe". The app asks the browser to keep its data, and shows the empty Closet with "Add your first garment". (FR-9, FR-109)
3. You add it to the home screen (Safari: Share, then "Add to Home Screen"; Chrome: the menu, then "Install app"). (NFR-6)
4. You open it from its icon: it opens full screen with its own icon and name. (NFR-6)
5. You turn on flight mode and open it again: it opens and works. (NFR-5)
6. You check that Closet, Outfits, Calendar, Stats and More are each one tap away, and that Add offers "Add a garment", "New outfit" and "Log today". (FR-110)

**Result:** the app is installed and usable offline.

**Alternative flows:**
- **A1 Update.** A new version has been published: when online, the app fetches it and tells you; it is used the next time you open the app, or now if you tap "Reload". (FR-114)
- **A2 Already set up.** The welcome is skipped on later opens. (FR-109)
- **A3 Page error.** Something goes wrong on one page: the app shows a plain message with "Go to Closet", records the error, and the rest of the app keeps working. (FR-115)
- **A4 On the PC.** You open it in Edge: it works, with a wider layout. (NFR-25)
- **A5 Old data here.** The old Wardrobe's data is reachable in this browser: the app offers to copy it (UC-7 A1). (FR-103)

**Error cases:**
- **E1 Private window.** The browser cannot store data: a banner says so at the top, and the app works until the window is closed. (FR-113)
- **E2 Site unreachable on the first visit.** The browser shows its own "no connection" page; there is nothing to install yet. (Outside the app; no requirement.)

**Covers:** FR-9, FR-103, FR-109, FR-110, FR-113 to FR-115. Exercises NFR-5, NFR-6, NFR-24, NFR-25, NFR-35.

### UC-16 Change settings, check storage, delete everything

**Goal:** the app set up the way you like, a clear view of what it is using, and a way to wipe it.

**Actors:** you.

**Preconditions:** none.

**Main flow:**
1. You open More. Theme (auto, light, dark), currency (£, €, $) and temperature unit (°C, °F) are there; changing one applies at once. (FR-111)
2. The privacy statement says nothing leaves the device except the optional weather request to Open-Meteo, and the version number is shown. (FR-112)
3. Storage shows how much the app uses and roughly how much the browser allows. (FR-107)
4. Backup shows when the last backup was made. (FR-106)

**Result:** settings saved on the device.

**Alternative flows:**
- **A1 Delete everything.** You tap "Delete everything", type DELETE, and confirm: every garment, picture, outfit, day and setting on the device is removed, and the empty Closet appears. (FR-108)
- **A2 Dark on the phone.** With the theme on auto, the app follows the phone's light or dark setting. (FR-111, NFR-21)

**Error cases:**
- **E1 Wrong word.** In A1, anything other than DELETE leaves everything as it is. (FR-108)

**Covers:** FR-106 to FR-108, FR-111, FR-112. Exercises NFR-21.

### UC-17 Delete a garment or an outfit

**Goal:** remove something for good, with nothing left dangling.

**Actors:** you.

**Preconditions:** the garment or outfit exists.

**Main flow, garment:**
1. On the garment's page you tap "Delete this garment". The app explains that it leaves every outfit and day it is in and that its pictures are deleted, and asks you to confirm. (FR-18)
2. You confirm. The garment, its three pictures, and its entries in outfits and days are removed as one unit, and the Closet opens. (FR-18, NFR-27)

**Main flow, outfit:**
3. On the outfit's page you tap "Delete this outfit". The app explains that the garments stay and that days keep its pieces individually, and asks you to confirm. (FR-77)
4. You confirm. The outfit and its picture are removed, days that had it now list its pieces, and the Outfits list opens. (FR-77)

**Result:** nothing refers to what was deleted.

**Alternative flows:**
- **A1 Cancel.** At step 1 or 3 you cancel; nothing changes. (FR-18, FR-77)
- **A2 Gone instead.** For a garment you no longer own but want in the stats, you mark it gone (UC-12) rather than deleting. (FR-14)

**Error cases:**
- **E1 Fails midway.** The deletion is all-or-nothing: if it fails, the app says so and everything is as before. (NFR-27)

**Covers:** FR-14, FR-18, FR-77. Exercises NFR-27.

## 3. Traceability

### 3.1 Every functional requirement and the use cases that cover it

| FR | Use cases |
|---|---|
| FR-1 | UC-1, UC-10 |
| FR-2 | UC-10 |
| FR-3 | UC-10 |
| FR-4 | UC-10 |
| FR-5 | UC-10, UC-13 |
| FR-6 | UC-10, UC-13 |
| FR-7 | UC-10 |
| FR-8 | UC-10, UC-12 |
| FR-9 | UC-1, UC-10, UC-15 |
| FR-10 | UC-1, UC-10 |
| FR-11 | UC-5, UC-10, UC-13 |
| FR-12 | UC-5 |
| FR-13 | UC-3, UC-10 |
| FR-14 | UC-5, UC-11, UC-12, UC-17 |
| FR-15 | UC-3, UC-4, UC-5, UC-8, UC-12 |
| FR-16 | UC-12, UC-13 |
| FR-17 | UC-10, UC-11 |
| FR-18 | UC-11, UC-17 |
| FR-19 | UC-10, UC-11 |
| FR-20 | UC-1, UC-11 |
| FR-21 | UC-1, UC-11 |
| FR-22 | UC-1, UC-11 |
| FR-23 | UC-1, UC-11 |
| FR-24 | UC-1, UC-11 |
| FR-25 | UC-1, UC-2 |
| FR-26 | UC-1, UC-2 |
| FR-27 | UC-1 |
| FR-28 | UC-1 |
| FR-29 | UC-1, UC-2 |
| FR-30 | UC-1, UC-2 |
| FR-31 | UC-2, UC-11 |
| FR-32 | UC-1, UC-2 |
| FR-33 | UC-2 |
| FR-34 | UC-2 |
| FR-35 | UC-2 |
| FR-36 | UC-2 |
| FR-37 | UC-2 |
| FR-38 | UC-2 |
| FR-39 | UC-2 |
| FR-40 | UC-2 |
| FR-41 | UC-2 |
| FR-42 | UC-1, UC-2 |
| FR-43 | UC-2 |
| FR-44 | UC-2 |
| FR-45 | UC-1, UC-2 |
| FR-46 | UC-2 |
| FR-47 | UC-2 |
| FR-48 | UC-1, UC-2 |
| FR-49 | UC-1, UC-2, UC-3, UC-11 |
| FR-50 | UC-1, UC-2, UC-11 |
| FR-51 | UC-1, UC-2 |
| FR-52 | UC-2 |
| FR-53 | UC-1, UC-11 |
| FR-54 | UC-1, UC-11 |
| FR-55 | UC-1, UC-11 |
| FR-56 | UC-1, UC-11 |
| FR-57 | UC-1, UC-11 |
| FR-58 | UC-1 |
| FR-59 | UC-1, UC-11 |
| FR-60 | UC-1, UC-11 |
| FR-61 | UC-1, UC-7, UC-11 |
| FR-62 | UC-1 |
| FR-63 | UC-3 |
| FR-64 | UC-3 |
| FR-65 | UC-3 |
| FR-66 | UC-3, UC-8 |
| FR-67 | UC-3, UC-8 |
| FR-68 | UC-8 |
| FR-69 | UC-8 |
| FR-70 | UC-8 |
| FR-71 | UC-3 |
| FR-72 | UC-3, UC-8 |
| FR-73 | UC-3 |
| FR-74 | UC-3 |
| FR-75 | UC-3, UC-5, UC-9 |
| FR-76 | UC-3, UC-5 |
| FR-77 | UC-3, UC-17 |
| FR-78 | UC-4, UC-5 |
| FR-79 | UC-4, UC-5 |
| FR-80 | UC-4, UC-5 |
| FR-81 | UC-4, UC-5 |
| FR-82 | UC-5 |
| FR-83 | UC-5 |
| FR-84 | UC-4 |
| FR-85 | UC-4, UC-14 |
| FR-86 | UC-14 |
| FR-87 | UC-4, UC-14 |
| FR-88 | UC-4, UC-14 |
| FR-89 | UC-4, UC-9, UC-14 |
| FR-90 | UC-5, UC-9, UC-14 |
| FR-91 | UC-4, UC-9 |
| FR-92 | UC-3, UC-4, UC-9 |
| FR-93 | UC-4, UC-9 |
| FR-94 | UC-4, UC-9 |
| FR-95 | UC-14 |
| FR-96 | UC-13 |
| FR-97 | UC-13 |
| FR-98 | UC-13 |
| FR-99 | UC-12, UC-13 |
| FR-100 | UC-6 |
| FR-101 | UC-6, UC-7 |
| FR-102 | UC-6, UC-7 |
| FR-103 | UC-7, UC-15 |
| FR-104 | UC-6, UC-7 |
| FR-105 | UC-7, UC-11 |
| FR-106 | UC-6, UC-16 |
| FR-107 | UC-6, UC-16 |
| FR-108 | UC-16 |
| FR-109 | UC-15 |
| FR-110 | UC-1, UC-3, UC-5, UC-15 |
| FR-111 | UC-14, UC-16 |
| FR-112 | UC-14, UC-16 |
| FR-113 | UC-15 |
| FR-114 | UC-15 |
| FR-115 | UC-15 |

Every FR from FR-1 to FR-115 appears above. The "Covers" line of each use case lists exactly the FRs mapped to it in this table.

### 3.2 Non-functional requirements and where they are exercised

Non-functional requirements are about how well the app works rather than what it does, so most are checked by measurements and checklists in Phase 4 rather than by a single use case. This table says which use cases put each one under load.

| NFR | Exercised by |
|---|---|
| NFR-1 to NFR-4 (privacy) | UC-14, UC-15; the policy test in Phase 4 |
| NFR-5, NFR-6 (offline, install) | UC-15 |
| NFR-7 (photo to cut-out in 2 s, no freeze) | UC-1, UC-2 |
| NFR-8, NFR-9 (brush and wand speed) | UC-2 |
| NFR-10 (save in 1.5 s) | UC-1 |
| NFR-11 (300 garments open fast) | UC-10 |
| NFR-12 (builder at 60 fps) | UC-3 |
| NFR-13 (memory) | UC-2 |
| NFR-14 to NFR-16 (storage per garment, sizes) | UC-1, UC-6; measured in Phase 4 |
| NFR-17 (storage warning, full storage) | UC-1, UC-6, UC-7 |
| NFR-18 (big backup without running out of memory) | UC-6, UC-7 |
| NFR-19 to NFR-23 (accessibility) | every use case; the manual checklist in Phase 4 |
| NFR-24 to NFR-26 (browsers, photos) | UC-1, UC-15 |
| NFR-27 (all-or-nothing saves, no orphans) | UC-3, UC-6, UC-7, UC-17 |
| NFR-28 (no silent loss) | UC-1, UC-3, UC-5, UC-11, UC-12 |
| NFR-29 (data versions, documented backup format) | UC-6, UC-7 |
| NFR-30 to NFR-32 (look and feel, plain English) | every use case; mockups in Phase 3 |
| NFR-33 to NFR-36 (plain files, shared site, releases, commits) | UC-15 A1 for updates; the release checklist in Phase 5 |
| NFR-37 to NFR-40 (testing) | Phase 4 |

## 4. Proposed amendments to the requirements

Writing the flows showed three places where the requirements are silent. I propose these changes to `01-requirements.md`; with your approval of this document I will apply them there as "Draft 2" with a change note at the top.

1. **FR-49, extend to the builder.** New wording: "Leaving the cut-out editor or the outfit builder with unsaved changes asks before discarding, and an unsaved draft survives switching tabs, the phone putting the app in the background, and the app being closed and reopened." (Used by UC-3 A9.)
2. **FR-74, at least one piece.** New wording: "Saving an outfit needs at least one piece, and renders a picture of the canvas that is used in lists, on the calendar and in ideas." (Used by UC-3 E1.)
3. **FR-14, the gone garment's page.** New wording: "A garment can be marked gone from the closet with a reason (sold, donated, binned, lost, other) and a date, its page then offers 'Bring back' in place of the wear buttons, and bringing it back restores it to the Closet." (Used by UC-5 A8 and UC-12 step 4.)

## 5. What happens next

When you approve this document, Phase 3 writes the architecture and design: the modules and the direction they may depend on each other, the data model with every record type and an example, the storage scheme and the migration from the old app, the image pipeline as a diagram with what runs in a Web Worker, the editing tools as commands with undo and redo and a single coordinate-mapping function, error handling and performance budgets, the type-recognition decision with its trade-off, and the mockups for the new look.
