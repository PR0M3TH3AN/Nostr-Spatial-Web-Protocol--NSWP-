# What changed

Newest first. Version numbers are the spec's. Section numbers (§) are `spec.md`'s.

## Next

- **A space bar held down no longer holds the menu still** (SDK `ui/hud.ts`; the engine script; `trials/menu-rows.mjs`). Found by the space bar's check, which the entry below had built and not tried.
  - **What was wrong:** a key that is held down is told to the page again and again, and each telling began the press anew. So with a row holding the keys and the space bar held, the menu was never drawn again until the bar came up, however long that was. "It is never held still for long" (below) was untrue for a held key.
  - **Now only the bar's going down begins a press.** Held for longer than a press is (1.2 seconds), it is not waited for, as a mouse button is not. One line.
  - **A press with the space bar is otherwise as the entry below says, and is now tried** (101 checks, 92 before), with a real keyboard: a row is given the keys, the bar goes down, the menu is told something changed, and the bar comes up. The press is heard, and once, whether another row's words changed or its own; what changed is not drawn while the bar is down, is drawn as soon as it is up, and once; a bar put down once and never let up is not waited for; nor is one held as a keyboard holds a key, which is the check that failed before this (the menu still not drawn again after nine seconds and 186 tellings; 1.4 seconds now, after 29). Both are timed by the page's own clock from when it hears the bar go down, since a page drawn slowly hears a key late. With the menu not listening for the space bar at all, six of the nine new checks fail.
  - **Not tried:** a real keyboard under a real hand. The held key is this script's keyboard putting down a key that is already down, which the browser tells the page as a held key's repeat.
- **A press in the menu is no longer lost when the menu is drawn again while it is being made** (SDK `ui/hud.ts`; the engine script; `trials/menu-rows.mjs`). A fault as old as the menu, found from a press that came to nothing in a trial. A press is the pointer going down on a thing and coming up on the same thing. Drawing the menu again makes every row, tab and key anew, so a drawing between the two took the thing from under the pointer, and the browser delivered no press at all: nothing happened, and nothing said so.
  - **When it happened:** whenever anything the menu shows changed during a press. A recording's counter, a picture arriving in the Bag, a world saying what it is to its client, a row's words changing. A person's press lasts long enough for that; a scripted one hardly ever, which is why no trial met it until a page was drawing slowly.
  - **Now the menu is not drawn again while something in it is being pressed,** and is drawn as soon as the press is over, once, with whatever changed meanwhile. The same for a key pressed with the space bar.
  - **It is never held still for long.** A press is over when the pointer comes up anywhere, is cancelled (a finger that began to scroll), or the page loses the keys or goes out of sight. A thing held for longer than a press is (1.2 seconds) is not waited for at all: a finger resting, a pointer that left the page with its button down.
  - **A bar being moved along is waited for too, for up to eight seconds.** Drawn again under the pointer, a bar (a song's place) was let go of by the browser and stayed where it had got to. Its own movement was never the menu's drawing, so nothing of it is held up.
  - **Tried** in `trials/menu-rows.mjs` (92 checks, 79 before), with a real mouse: the mouse goes down on a row, the menu is told something changed, and the mouse comes up. The press is heard, whether another row's words changed or its own; what changed is not drawn during the press, is drawn as soon as it is over, and once; held down for good, the menu is drawn again after 1.4 to 1.5 seconds; it is let go at once at a cancelled press and at the page losing the keys; a bar moved along while the menu is told something changed goes where it is put, and what changed is drawn when it is let go. On the menu as it was, both presses are lost, the change is drawn under the press, and the bar is let go of.
  - **The rows trial now draws with the graphics card,** as the client's-menu trial does, says what in fact drew it, and takes `--software` to draw without. Its checks of places wait two frames after everything has ended, and for the Room tab's late row: drawn faster, it was reading the sheet before the tab strip had settled and before that row had come.

## 0.87.0

- **A line said with the menu up has a strip of the sheet's own, never lies over anything that can be pressed, and is shown whole however long it is** (SDK `ui/hud.ts`, `ui/model.ts`; the engine script; `packages/sdk/test/say-stays.test.ts`, new; `trials/menu-rows.mjs`, `trials/menu-client.mjs`). Decided by the orchestrator, before the kit version that would otherwise have shipped a line lying over the bottom of the sheet's rows. Lying there, a press on it reached a row the visitor couldn't see (Leave, Sign out, a row that saves); made to take the press itself, it took a visitor's first press on whatever row they wanted next, and at the moment its four seconds ended the press fell through.
  - **The rule: a said line never lies over anything that can be pressed.** Not a row, not a tab, not the foot's own buttons.
  - **The strip is between the rows and the foot, always there while the menu is up, one line high when nothing is said or what is said fits.** Nothing in the sheet moves as a line comes or goes. One line shows at a time, the newest. With the menu down, lines are at the lower left as before, up to three, taking no press.
  - **Words too long for one line are shown whole, on up to four.** What a visitor most needs to read is often long: that others in the room can see they are recording, that their whole screen may show, that pressing Buy again charges nothing. A strip of one line showed about 120 letters of such a line at a desk's width and about 55 at a phone's. Now the strip grows for it and the sheet is kept the size it was, so the room comes from the bottom of the rows' own scrolling area: no row moves, nothing that can be pressed is under the words, and the last rows are out of sight while they show. The longest line the kit can say (155 letters with a host's name in it, found from the code) takes two lines at a desk's width and four at a phone's.
  - **A row keeps its own height whatever room the list is given** (`grid-auto-rows: max-content`). Given less, a row with small words under it was squeezed by seven pixels and every row below it moved up.
  - **Longer words stay longer** (`sayStays`, `SAY_STAYS`, in `ui/model.ts`, **proposed**). Every line stayed 4.2 seconds, whatever its length. Now a line of sixty letters or fewer stays that long, and a longer one 70 ms more for each letter past sixty, up to ten seconds: the recording notice 6.1 s, the kit's longest ten.
  - **A press on a line puts it away.** Where long words have grown over the place a row was a moment ago, that row is out of sight and is not what is pressed.
  - **Tried by where things are, not by pressing** (`trials/menu-rows.mjs`, 79 checks, 30 before): at a desk's width and a phone's, with one, two and three lines said, the line's box meets no row, no tab and no button, and every row, tab and button is where it was with the strip blank. Each of the three long lines named above, and the kit's longest, is shown whole with no ellipsis; what is on top at thirty-five places across it is the line itself; no row has moved and the sheet is the size it was. At a phone's width a press at a place that was a row's, now out of sight, doesn't press the row.
  - **`trials/menu-client.mjs`** (171 checks, 168 before) presses a row once, through one helper for every visit, and fails by name if a said line is ever found over what it went to press. In its `launch` visit the world's page now says for itself, on its console, that the word from the press above reached it and that it had not been pressed; the trial reads nothing from that page until then. It used to read it straight after the press, a scripted reading counts there as a press, and on a busy machine the reading got in first: the world went straight into a session, and the check that no session starts from the press above failed by the trial's own hand.

- **A line said with the menu up no longer moves the rows under the pointer** (SDK `ui/hud.ts`; the engine script; `trials/menu-rows.mjs`, `trials/menu-client.mjs`). A fault of the change before last, which put said lines inside the menu's sheet: a line took room of its own there, so every row in the sheet went up by the line's height as it came (51 pixels) and came down again four seconds later as it went. A visitor pressing the same row twice ("Take a picture", then again) pressed something else the second time, or nothing.
  - **Now a line lies over the sheet, just above its foot, and takes no room.** Nothing in the sheet moves as it comes or goes, and the sheet doesn't grow. It is solid, so that what it lies on doesn't show through, and it takes no press: a press where a line lies goes to what is under it, which is where it was.
  - **Found by the orchestrator's run of the client's-menu trial,** where a second press on "Take a picture" did nothing and two checks then failed with times that weren't times. A probe measured the row at 386, then 335 with a line up, then 386.
  - **`trials/menu-rows.mjs`** (30 checks, 28 before) reads every row's place before a line, with it up and after it has gone, and wants them the same; that fails on the menu as it was. Its check that nothing lay over a line is now that the line takes no press and what is under it is the sheet's own.
  - **`trials/menu-client.mjs`** (168 checks, 166 before): the press on "Take a picture" for the lengthened drawing is a check of its own by name, and where it isn't made the two checks that depend on it say "not looked at" with its name. A mark never made says "never marked", never a number. And that visit's press is now made only once the row is what the mouse would land on, as the music visit's are; a fixed wait of four and a half seconds before it is gone.

- **The console in a headset in a Godot world: the kit draws it, the add-on shows it and lights the row pointed at** (SDK `console-drawing.ts`, `engine-console.ts`, both new; `console.ts`, `engine.ts`, `engine-hands.ts`, `engine-menu.ts`; the engine script, **version 19**; the Godot add-on's `nswp_visitor.gd` and `nswp.gd`, the example's `main.gd`; `trials/godot-console.mjs` and `trials/xr-console.mjs`, new; `trials/godot-leave-vr.mjs`; `docs/other-engines.md`, `docs/plans/godot-headset-controls.md`). Until now a visitor in a headset in a Godot world could move but had no console: the menu button left the session to reach the page's menu. Not tried in a headset.
  - **The console is drawn once.** Its 2D drawing is moved, word for word, out of the file that puts it on a Three.js panel into `console-drawing.ts`, which has no Three.js in it. A Three.js world's panel and the engine script both draw with it. `console.ts` gives the same things from outside as before.
  - **`NSWP.console(input)` and `NSWP.consolePixels()`, new, and why the version is 19.** The first says what the console is, where it floats, and each row that can be pressed with its rectangle; it takes `open`, and a `press` by a row's id. The second gives the picture, 1024 by 640 as its pixels, to be taken only when `stamp` has changed. A new event, `console`, says the kit brought it up itself. Seated mode takes the next number, 20.
  - **Pointing never changes the picture.** For an engine it is drawn plain. With each row the kit gives how to light it (`lit`: a fill, an edge and its width, four corners, in the console's own units), and the engine draws that box over the row's own rectangle. So the pixels cross only at a press, a tab or a page: in the trial, once to bring it up, never in a sweep over every row and back, and once for each press that changes it. A row the kit gives no light for (the tab that is up) is not lit. The same list of rows says what is lit and what a press lands on.
  - **In the Godot add-on's visitor:** B or Y brings the console up about a metre in front of them and puts it away, it stays where it opened, a hand pointed at it lights the row and that hand's trigger presses it, a hand pointing at it points at nothing behind it, and walking off puts it away. The button no longer leaves the session: the way out is a row of the console, as in every world. A world made with the add-on gets it by updating the add-on.
  - **The one-time question, casual or intense, is asked in a Godot world now,** in the console, the first time they are in a headset. It is asked only once an engine shows it draws the console: a world whose engine draws none would have asked where nobody could answer.
  - **The Quest's own number, for the owner to read out:** opened with `#pixels` on the end of its address, the example brings the real console's picture across twenty times and says in its menu how long it took, and again whenever the menu is opened. On the laptop: 5.9 ms, 25 at most. An ordinary visit measures nothing.
  - **Tried on a flat page with made-up hands, not in a headset** (`trials/godot-console.mjs`, 23 checks): no scripted browser can be in a headset in a Godot world. And the Three.js worlds' own console, whose drawing moved, in a made-up headset (`trials/xr-console.mjs`, 8 checks). Not shown: a real controller's menu button, how the panel reads in a headset, the question itself (asked only in a session), and how a tab change feels on a Quest. The owner's steps are in the plan.
  - Not in this: the console on a raised wrist, and what is in a visitor's hand.

- **What it costs to bring the console's picture into a Godot world, measured before the console in a headset there is built** (`trials/godot-pixels.mjs`, new; the Godot example's `main.gd`; `docs/plans/godot-headset-controls.md`). No change to the kit, the add-on or the engine script.
  - **About 4 to 6 ms a change, on a laptop,** for the console's own 1024 by 640 as its pixels (2.6 MB). Three quarters of it is the page reading its own canvas back; the crossing to Godot is 0.3 ms. Packed as a PNG it is thirty times smaller and six times slower. Not a Quest's number: nothing was measured on a headset.
  - **The example has a hook for it,** inert unless a test asks (`window.nswpMeasurePixels`), beside the one for made-up hands.
  - **The plan has the figures and the question they leave:** the kit's console draws itself again whenever the row pointed at changes, so who lights that row decides how often the pixels cross.

- **The client's-menu trial draws with the graphics card, names every press on the world's own page, and asks the two faults of the Camera directly** (`trials/menu-client.mjs`, `trials/README.md`). No fault in the kit. Two checks in the `music` visit had failed in three of the orchestrator's full runs, and passed when run alone.
  - **Where the time went, and the press that was never made.** The world's own page is a world drawing itself, and without a graphics card it draws about two frames a second, with everything else on the page waiting behind each frame. The scripting tool's own click waits for several frames first, so each of four presses took 6 to 12 seconds; past its limit of 15 the press was never made, and the trial said nothing of it. Two checks later it read as a row that wasn't there.
  - **Chrome now draws with the graphics card,** as `menu-cost.mjs` does: all six visits in 111 seconds at a load of 17 to 22. The trial asks the browser what in fact drew the pages, says it at the top of the run and in the result, and says plainly, without failing, if the card was asked for and the machine gave none. `--software` draws without it, in about three and a half minutes: the stand-in for a slow device, and wanted beside the ordinary run before a kit version is cut.
  - **Every press on the world's own page is a check of its own, by name** ("the press on "Add music from this device" was made"), made with the trial's own mouse press once the thing has stopped moving and is what the mouse would land on. The first that isn't so stops the rest, which say "not tried" with its name.
  - **The Camera's two faults are asked directly,** so that neither needs a slow page to be seen. New: while a picture's file is being made, the world's draws are counted, to the screen and elsewhere. On the Camera of 0.86.0, drawn with the card: none to the screen and 31,563 into the picture, and the `making` word 61 ms after the drawing was done; both checks fail there by name.
  - **Four weaknesses of the trial's own, found by drawing without the card on a busy machine,** each of which read as a fault it wasn't. In `main`, a press sent while the sheet was still sliding up landed outside it and closed the menu; the press now waits until the thing is still, and waits for a thing that is gone for a moment while the menu is drawn again. Words were typed 300 ms after the frame was given the keys, before the world's slow page had put them in its box; the trial now asks the box, as a check of its own. In `bag`, a press was made again after six seconds with nothing to show for it, and choosing a thing un-chooses it when pressed twice; it now waits twenty-five.
  - 166 checks, 158 before.

- **Words said for a moment can be read with the menu up** (SDK `ui/hud.ts`; the engine script; `trials/menu-rows.mjs`). A fault: a line said for a moment ("Copied.", "A picture from The Gallery was saved to this device.") stands at the lower left, and on any screen narrower than about 1500 pixels the menu's sheet lay over half of it or more. Most such lines answer a press in the menu, so they were said where they couldn't be read.
  - **While the menu is up the lines are in its sheet, above its foot,** under the tab's rows and its note. With the menu down they are at the lower left as before. A line still up as the menu comes or goes moves with it, and goes when its four seconds are over.
  - **A line that is moved is simply there: only a newly said line comes in.** Put into the page again, a line would slide and fade in a second time, and words a visitor was already reading would flicker. (Found by the orchestrator, whose run saw a moved line eight pixels to the left, still on the first frame of coming in again.)
  - The same in a world's own menu and in a client's above a world: it is the one menu.
  - **Tried** in `trials/menu-rows.mjs` (28 checks, 16 before): with the menu up the line is inside the sheet, above its foot and below its rows, with nothing over it, at a desk's width and a phone's; with the menu down it is at the lower left; a line still up as the menu goes, or comes, is moved with nothing running on it; and it goes after its moment. The trial waits for a line's own animations to end before it reads a place, never a fixed time, and says by name if they don't end. Not tried: a headset, whose console is drawn another way and is not changed; a screen reader.

- **The live trial reads BitPortal's kept panel as closed** (`trials/live.mjs`, `trials/README.md`). Not a fault in any site. After the deploy of 0.86.0 the trial exited 1 on three checks, "closed, and the menu is back".
  - **Why:** BitPortal's shell now keeps BitLogin's panel between openings, so that the next one is up at once. Closed, its box stays, marked `data-kept`. The trial counted any box as an open panel, never saw it close, pressed outside to close it, and that press put the menu away (as a press outside has done since 0.85.0). So the menu it then looked for was gone.
  - **Now a kept box is a closed panel,** and the trial checks what a kept box must be: unseen, and taking no press, read from what the browser says of it and from what is on top at its middle. It also counts how often the panel's own Close didn't close it and a press outside had to; that was never, in this run.
  - **Run against the live sites, read-only** (nobody signs in, every WebSocket refused): exit 0, every check as wanted, at a desk's size and a phone's. The room's panel, a world's and "Your files" were each "kept, unseen, taking no press" once closed.

- **A world's word that it is making a picture now reaches the client before the picture is drawn** (SDK `camera.ts`, `client-frame.ts`, `menu-above.ts`; the engine script; `packages/sdk/test/camera-picture.test.ts`; `trials/menu-client.mjs`; NSWP-02). A fault in 0.86.0's wait for a slow device's picture, found by the orchestrator when a check on a busy machine saw nothing said five seconds after the press.
  - **The word was said first and sent last.** The Camera said `making` and went straight on to draw. A page's word to the page above leaves only when the script that said it has finished, and drawing a picture (a full-size render and reading it back) is one long piece of script. So the client heard only once the drawing was done. On a slow device that is the opposite of "at once": nothing for as long as the drawing takes.
  - **Now the Camera lets the word go before it draws:** where a press above is waiting, it says the word, gives the page a turn, and then draws. Where nobody above is waiting (a world's own menu, a headset) it draws at once, as before.
  - **Measured, with the drawing made to take three seconds more:** the word reached the client 4.9 s after the press, after the drawing ended at 4.5 s; now 29 ms after the press, with the drawing done at 4.7 s. The visitor is now told while it is still being drawn.
  - **`making()` in `client-frame.ts` now answers whether the word was said,** and `sent()`, new there, is the turn after which it has gone (**both proposed**). A world of someone else's making that calls `making()` should do the same before anything long.
  - **Tests:** the Camera says, then lets go, then draws, for a picture and a selfie, and draws at once where nobody is waiting; two of the three fail on the kit as it was. In `trials/menu-client.mjs` the `file` visit times the word against the drawing's end by the clock the two pages share (158 checks in all, 156 before). The check that asked for the visitor to be told within six seconds by the wall clock now asks for it within the ten; how soon the word goes is the new check's, which a busy machine can't fail.

- **Taking a picture no longer holds the world while its file is made; and the client's-menu trial is six visits that can be run alone** (SDK `camera.ts`; `packages/sdk/test/camera-picture.test.ts`, new; `trials/menu-client.mjs`, `trials/README.md`). The trial had come to take 16 minutes on a busy machine. Nearly all of it was one wait, and the wait was a fault in the kit.
  - **A fault: while a picture's file was being made, every frame the world drew went into the picture, and none to the screen.** `takePicture` set the picture's own target on the renderer, hid what a picture hides, turned the headset's drawing off, and put all three back only once the JPEG was made. Making it is the slow part, seconds on a slow device, and the world's own loop goes on meanwhile. So the view stood still for as long as the file took, and for a selfie the visitor's own figure stood in the world for as long. Now the scene is drawn and read back in one go and the renderer is as it was before anything is waited for; a selfie's figure is gone again before the file is made.
  - **What it cost, measured.** In the trial's Chrome, which draws without a graphics card, a picture whose file took twelve seconds left the world's page answering nothing for 13 minutes afterwards (800 s before one read of it came back; 0.2 s now), and an ordinary picture left it so for 5 s. Why it outlasted the making by so much there was not looked into. Nothing was measured on a real device.
  - **A test that fails on the kit as it was:** with a file that is slow to make, the renderer's target, the hidden things and the headset's drawing are as they were while it is being made, a frame drawn then goes to the screen with everything in it, and a selfie's figure is out of the scene. Two of its five fail before this change.
  - **The trial is six visits:** `main`, `launch`, `bag`, `question`, `music`, `file`. `node trials/menu-client.mjs` still runs them all, now in about three minutes on the same busy machine (66, 16, 9, 23, 57 and 28 seconds; the last was 763). `node trials/menu-client.mjs music file` runs only those, `--list` names them with what each takes, and `--times` says how long each check waited, which is how the fault above was found. Each visit's beginning and end are said as it goes, so a log that simply ends shows where it was cut.
  - **A run stopped from outside says it was stopped, and reports no failed check for it.** Stopped by a time limit, its last visit used to end "FAILED: 1, the visit ran to its end", which read as the kit failing. It now says STOPPED, which visits ran to their end with their counts, which didn't, and the command that runs those alone. Its exit code is the signal's (143), or 3 for a browser that went away; 1 is only ever a failed check. Tried three ways: a time limit, the whole process group ended at once, and the browser alone killed.
  - No check was added to the trial or taken out of it: 156, as before.

## 0.86.0

- **A world's music steps back for the visitor's own; a slow device's picture is waited for; the Bag's item store comes from `nswp-sdk/bag`** (core `menu.ts`; SDK `ui/port-below.ts`, `menu-above.ts`, `client-frame.ts`, `sound.ts`, `camera.ts`, `bag-entry.ts`, `engine-menu.ts`; the engine script; `sites/shared/world.ts`; `trials/stand-in-client/main.ts`, `trials/menu-client.mjs`; NSWP-02; `vectors/menu-words.json`). Three things for a client that draws the menu above a world. The version of the menu's words stays 1: a world or a client that knows neither new word leaves it unread, and everything is as it was.
  - **A new word down, `{ nswp: "menu", playing: true }` (and `false`).** A visitor's own music plays in their client's page, so that it doesn't stop at a door, and the world under it went on playing its own at full volume. The client now says when theirs starts and stops, and the world steps its own music back to a tenth meanwhile, as it already did for a song played in its own page. It carries nothing else: not what is playing, nor where it is from. Said at each change, and once after the client says it has the menu if something is already playing. A world brings its music up again at `false`, when the client no longer has the menu, and when its end of the port is put away. The hum, and music shared by people nearby, are left alone. Said upward by a world, it is not read (a vector).
  - **In the kit:** `MenuBelowOptions.playing` (the client says whether theirs is playing; read whenever the controls change), `MenuAboveOptions.playing` (the world is told a change) and `Sounds.stepBack(on)`. The reference worlds and the engine script wire the two together, so a world made with either gets it by updating. `Sounds.steppedBack` says whether it is, for tests (**proposed**).
  - **A fault: on a slow device, "Take a picture" in a client's menu could save nothing and say nothing.** A client takes something to save only within ten seconds of the press, and a busy machine took over eight to make one picture. **A new word up, `{ nswp: "menu", making: "<the row's id>" }` (proposed, with `MENU_MAKING_MS`, 60 000):** the world says at once that it has begun making what the press asked for. The client then holds that one press open for sixty seconds, counted from the press; says "<the world> is making it. It will be saved when it is ready." if it hasn't come in a second and a half (most pictures have, and then only the saving is said); and if nothing has come by the end, "Nothing came from <the world> to save. Press again to try once more."
  - **A world still can't put a file on the device unasked, or hold a press open.** The word is taken only for the press that is waiting, for that row, within the first ten seconds, before anything has come for it, and once; said again it changes nothing, and the sixty seconds are counted from the press, not from the word. A press that never hears it keeps the ten seconds. The kit's Camera says it as a picture or a selfie is begun and as a clip is stopped, and not for "Record a clip", which saves nothing until it is stopped (`making()` in `client-frame.ts`, **proposed**).
  - **`nswp-sdk/bag` hands on `createItemStore`,** with `ItemStore` and `ItemStoreOptions`. The Bag's controls need something that looks an item up, and the kit's own store, which draws nothing, could be had only from an entry that loads the renderer. Found by BitPortal building its Bag on 0.85.0.
  - **The stand-in client's Bag now has a real store, and nothing about any item built in.** It is given only an item's address; the store asks a stand-in relay (the trial answers for it) and checks the description as really signed. So the entry is shown to be enough by itself: the stand-in client now imports `nswp-sdk/menu`, `nswp-sdk/bag` and `nswp-sdk/ui` and nothing else, and the check that nothing it reaches names the renderer still holds.
  - **Tried** in `trials/menu-client.mjs`: the world is told once that their music is playing and steps back, comes up again at a pause and steps back again at play, and the next world through a door is told once as it comes up; a picture whose file takes twelve seconds to make is said to be being made, is not given up on at ten seconds, and is saved when it comes. **Not tried:** the music by ear, a device that is slow in fact, and nothing coming at all in a browser (unit tests only).

- **Moving in a headset in a Godot world, the same as in every world** (SDK `engine-hands.ts`, `comfort-controls.ts`, both new; `input.ts`, `actions.ts`, `engine-menu.ts`; the engine script, **version 18**; the Godot add-on's `nswp_visitor.gd` and `nswp.gd`; `trials/godot-hands.mjs`, new; `docs/plans/godot-headset-controls.md`). The owner's ask of 2026-11-23: in a Godot world a visitor in a headset could look round and nothing moved them.
  - **`NSWP.hands(input)`, new, and why the version is 18.** An engine reads its controllers and hands them over each frame; the kit answers with what they mean, by the visitor's own settings: turn by so much, walk so far, which hand is choosing where to step and which let go, the menu button, how much to darken the edge, whether to fade. It is the kit's own `Locomotion` that answers, so a world made with another engine decides nothing and can't drift: a test feeds both the same frames and compares.
  - **`NSWP.kit()` gains three numbers for a headset:** `fadeSeconds` (0.12, each way), `stepReach` (5 metres) and `backStep` (1 metre). A Three.js world's fade now reads the same number.
  - **An engine world's menu has the same rows in Moving as every world's:** casual or intense in a headset, the turn, which hand moves them, narrowing, the fade. They were made inside the Three.js hands, which draw; they are moved word for word into `comfort-controls.ts`, which doesn't, and both keep them there. A Three.js world is as it was.
  - **In the Godot add-on's visitor:** the two hands are read each frame; a notch turn is made about the head; a stick held forward shows a ring on the floor where that hand points, and letting go steps there with the fade; a stick pulled back steps back; the intense way walks and turns smoothly, with the edge darkened while walking for someone who chose that. A step lands only on something they could stand on, with room for a body and nothing between, no further than a step reaches, and no sooner than the last has been paid for. A walk goes through Godot's own `move_and_slide`, so a world's walls and floors say where a visitor may stand and nothing new is declared. A hand pointed at a door within reach lights it, and the trigger goes through.
  - **Tried on a flat page with made-up hands, not in a headset** (`trials/godot-hands.mjs`, 26 checks). No scripted browser can be in a headset in a Godot world, so the example is told where each stick is, where the hand is and the way it points; from there on it is the same code. It can't show a real controller's names for its stick and buttons, which way a real stick reads as forward (one number, `STICK_FORWARD`), the fade, or the hands drawn. The plan has the owner's steps for a Quest.
  - Not in this: the console in a headset there (the menu button still leaves the session to reach the page's), and what is in a visitor's hand.

## 0.85.0

- **The keys stay with the world when a client's menu closes; a press outside the menu closes it; a client's own page may describe every tab** (SDK `ui/hud.ts`, `menu-above.ts`; the engine script; `trials/menu-client.mjs`, `trials/menu-rows.mjs`; NSWP-02, NSWP-11). Three things BitPortal's real shell turned up on kit 0.84.0. The engine script is rebuilt; its version is not changed.
  - **A fault: closing a client's sheet stranded the world's keys.** Brought up from the menu's own mark, the menu gave the keys to the world's frame as it closed (the client's port does that) and then took them back to its mark two milliseconds later. W, A, S, D were dead until a press on the view. Now, where whoever is told the menu went has given the keys away, the menu leaves them there. A world's own menu closes as before.
  - **The trial was passing wrongly, and now isn't.** It brought the menu up by script, with the frame holding the keys, so they went back to the frame. It now brings it up by a press on the mark, closes it three ways (Escape, its Close, its mark), looks a moment later and presses a key. With the fix taken out all three fail, with the keys at the menu.
  - **A press outside the sheet closes the menu, and is nothing else,** in a world's own page and in a client's above one. It is not a step, a shot or a door: no part of the press reaches the view. Before, in a client's page that press went to the frame, the menu stayed up, and the world heard keys with it up.
  - **`portAbove` takes `own`,** for a page of its client's own origin (a client's own room, in its own frame), which fills the visitor's tabs itself: it then describes those too, and its own rows under Travel. It only changes what a page says. The client's end takes the visitor's tabs by the frame's origin exactly, so a page of any other origin gains nothing by setting it, and a test checks that. Still not said by any page, because the client's page makes them itself from the same kit and they would be there twice: the switches that change a setting, Display's own rows, and the one-time questions on moving.

- **A way out of a headset in a Godot world** (the Godot add-on's `nswp_visitor.gd`; `trials/godot-leave-vr.mjs`, new; `docs/plans/godot-headset-controls.md`). A fault that is live in The Foundry: in a headset a visitor there can't move, can't open the console and can't go home, so the only way out was to take the headset off. This is the stopgap; moving and the console follow.
  - **The menu button leaves the session:** B on the right hand, Y on the left, the button every world's console comes up on (the kit's `Intent.menu`). The page's menu comes up with Home on it, and says "You left VR. Home is in this menu."
  - The visitor node now has two hands (`XRController3D`), which it had none of. They are not drawn yet, and nothing else is read from them.
  - A world made with the add-on gets it by updating the add-on. The engine script is not changed, and nor is its version.
  - **Not shown working, and said so:** a made-up headset can't start a session in Godot, which needs WebXR Layers that the emulator (iwer 2.8.0) doesn't have. The trial shows the example still comes up, is offered "Enter VR" and asks the headset for a session, then says what it could not show. A test checks the script's own text: two hands, Godot's name for that button, and what the press does. The button itself is the owner's to press on a Quest; the steps are in the plan.

- **A client's page can run the Bag, and draw the menu, without loading the renderer** (SDK `bag-entry.ts`, `hold.ts`, `file-store.ts`, `bag-pictures.ts`, all new; `bagging.ts`, `play.ts`, `library.ts`, `sound.ts`, `menu.ts`, `three.ts`; `trials/stand-in-client/main.ts`). Found by BitPortal building its shell on kit 0.84.0. The engine script is rebuilt; its version is not changed.
  - **A new entry, `nswp-sdk/bag`:** `createBag`, `addBagControls`, `mayHold`, `scriptAllowed` (and `allowScript`, `itemIn`), with no Three.js anywhere it reaches. Before, the Bag's parts could be had only from `nswp-sdk/three`. It is 177 KB, 62 KB as brotli, of which 101 KB is the list of public suffixes the kit shows a site's name by.
  - `mayHold`, `scriptAllowed` and `allowScript` are moved word for word out of `play.ts`, which draws, into `hold.ts`, which doesn't. `play.ts` and `nswp-sdk/three` hand them on as before.
  - **The Bag's own code no longer loads the renderer.** Drawing a thing from its model needs one, so that is now done by `addBagControls` as `nswp-sdk/three` hands it on (`bag-pictures.ts`): a world gets each thing drawn as itself exactly as before. From `nswp-sdk/bag` the things are shown by their first letters unless the page passes `previews` of its own.
  - **`nswp-sdk/menu` named the renderer** through one small function: `sound.ts` took `fileStore` from `library.ts`, which draws. A page that loads the kit's files as they are loaded all of Three.js to keep a song. `fileStore` is moved word for word into `file-store.ts`; `library.ts` hands it on as before. The menu entry is 232 KB, 76 KB as brotli.
  - **`nswp-sdk/menu` hands on what a client's page needs beside the menu:** `arriveWith`, `currentSettings`, `changeSettings` (to keep a headset's report across a reload of its page), and `watchEscape`, `fullscreenAction` (to hold Escape while its page fills the screen).
  - **The stand-in client loads the kit only by its entries,** never by a path into it. It reached four things by path, which is how a real client came to find they could be had from no entry. It is now 267 KB (87 KB as brotli) where it was 804 KB with the renderer in it.
  - **A test keeps it so** (`packages/sdk/test/entries.test.ts`): for `nswp-sdk`, `/ui`, `/menu`, `/menu-above`, `/bag` and the stand-in client, no file reached imports Three.js, used or not. It checks that it can see one, too: `nswp-sdk/three` does.

## 0.84.0


- **Playback controls for a visitor's own music** (SDK `sound.ts`, `sound-store.ts`, `ui/hud.ts`, `ui/model.ts`, `ui/icons.ts`, `console.ts`, `menu-above.ts`, `visitor-switches.ts`; the engine script; `trials/menu-client.mjs`; `docs/backlog/own-music-everywhere.md`, the owner's ask of 2026-11-23). The names are proposed, for the orchestrator to give. The engine script's version is not changed.
  - The jukebox could play, pause and go to the next song. It now also goes to the song before, moves within a song, and says how far in it is and how long the song is.
  - **In Sound, the menu's own rows,** the same in a client's page and in a world's own menu: what is playing with a bar to move along and the time ("1:23 of 3:45"), "Previous song", play and pause, "Next song", "Back 15 seconds" and "Forward 15 seconds", then adding, taking out, and the songs.
  - **Proposed, each one row:** "Shuffle", "Repeat" (all your songs, this song, off; it starts as all, which is how it always went), and "Play and pause on your bar", which puts a key on the bar with the song's name under it.
  - **A new kind of row, a bar that is moved along (`slider`).** Where it is and its words are asked for as it is drawn and twice a second while it is in sight, so a song is seen to run without the menu being drawn again. It is the menu's own: no word of the menu's port carries one, and a world's row of this kind is not described to a client. A headset's console draws no bar, and has the two buttons.
  - **A world never names a visitor's songs to its client.** A world whose own site held songs of the visitor's would have described a row for each, by name, to a client above it. Now nothing of their music is in what a world describes: every row whose id begins `juke-` or `song-` is the visitor's own (`visitorsOwnRow`).
  - Tried in the stand-in client with two songs (`trials/menu-client.mjs`): the time runs on the same bar, a press along the bar goes to that place, back and forward move 15 seconds, previous restarts the song or goes to the one before, next, shuffle and repeat do as they say, the key on the bar pauses and plays, the world is told none of it, and the world's own menu has the same rows.
  - Not checked: by ear, a headset, a phone, a song longer than a minute.

## 0.84.0

- **A file handed down and a picture handed up: the last of step 1 of the client's menu** (core `menu.ts`; SDK `ui/port-below.ts`, `menu-above.ts`, `ui/hud.ts`, `save-file.ts` (new), `camera.ts`, `panels.ts`, `room-controls.ts`, `client-frame.ts`; the engine script; `trials/menu-client.mjs`; NSWP-02, "A file going down, and something to save going up"). The words were given by the orchestrator on 2026-11-23. The version of the menu's words stays 1, and the engine script's version is not changed.
  - A press on the client's menu is no press in the world's page, and a browser shows its chooser of files, and may keep its save, for the page that was pressed. So the client's page does the browser's part and the result is handed across. Each stays one press.
  - **A row of the kind `file`.** A world describes it with the kinds it takes (`accept`: `image`, `video`, and no others, ever). Whoever draws the menu opens the browser's chooser at the press and gives the row the file. Where that is a client, the file goes down with the press, `{ nswp: "menu", press, file }`, as the file it is and to the one world that described the row; under the row the client says "The file you choose goes to" that world. 64 MB at most, one file, never with typed text, its own name up to 255 characters and no path. A file of another kind is refused and the client says why. The world checks again: only for a row that takes one, only a kind it asked for. Only in Panels and a world's own tabs, never on the bar.
  - **A row of the kind `save`.** Its press may end in something to save. A world whose client has the menu hands it up, `{ nswp: "menu", save, id }`, and the client's page saves it: only as the answer to a press it sent on such a row, for that row, within ten seconds, up to 12 to a press, 64 MB, one of five types of picture and clip. The name is the client's own (the world's name, the date and time). The client says what it saved and from which world, so a save is never silent; a client that keeps files somewhere of its own takes it there (`onSave`).
  - **In the kit:** Panels' "Hang a picture or video from this device" is a `file` row, and the Camera's rows are `save` rows. `saveFile` goes up to a client where one has the menu and a press is waiting for it; a clip that runs to its end with no press to answer is kept, and "Save" offers it, as after a headset session. In a world's own menu both work as before, from its own page.
  - **Sharing the screen in a frame that doesn't allow it** (decided: the frame is never allowed `display-capture`, and the client sharing and handing the picture down goes with step 3). "Share your screen" was offered there and answered only "Nothing was shared." Now it is not offered, and two lines say why and that it works at the world's own address. Where a browser doesn't say whether the frame allows it, the row stays and a refusal says what may be why.
  - Tried in the stand-in client over this checkout's Gallery (`trials/menu-client.mjs`): the chooser is opened by the client's page, a text file is refused and never reaches the world, a picture goes down under its own name and the world hangs it; "Take a picture" in the client's menu is saved once, by the client's page, under the client's name for it, and the world's page saves nothing.
  - The same trial's check that pressing the sign-in row asks the client now runs every time: it used to run only where the world's sign-in address had already been waited on, which depended on the machine.
  - Not checked: a person at the browser's chooser, where a person's browser puts the save, a clip, a headset, a phone. They are on the owner's list in the plan.

- **Four tests that could fail by chance now can't, and one of them was asking real relays** (`packages/sdk/src/relay-book.ts`; tests in `bridge`, `core` and `sdk`). Found from two failed gate runs on 2026-11-23.
  - **The relay backup, when sending, is now both or neither.** `sendWell` and `publishBacked` first ask relay monitors where else to go. A caller that handed in its own way to send and no way to ask (a test) had that question go to three real relays, and waited on them. Now the backup is used for sending only where both were handed in, or neither and the page is a browser. Nothing changes in a browser. A new test lists every socket opened and finds none; with the old rule it lists the three.
  - **Three tests looked for a short word of letters in sealed text,** which is letters and digits at random, so the word turns up by chance: "stty" in what the Bridge's relay holds (this failed a run), "main" in a save, "Arcade" in a wrapped message. Each now looks for something with a character sealed text never has, and the Bridge's test checks that of everything it looks for.
  - Every absence check in the tests was read (60), and every test's time (none but the Bridge's and the release script's takes a second).

- **Four more presses, tried: the client can choose a file and hand it down, and save a picture handed up; sharing the screen can't work in a client's frame today** (`trials/presses-handed-over.mjs`, new; `trials/menu-client.mjs`; `docs/plans/the-clients-menu-handed-over.md`, new). No kit code is changed, and no word is added: two are proposed.
  - **Choosing a file.** A framed world can't open the browser's chooser from a press on the client's menu. The client's page can, and the file it hands down in words arrives as the file it is: 64 MB in 3 ms or less, read whole by the world.
  - **Saving a picture.** The world hands the picture up and the client's page saves it, under a name of the client's own, even seven seconds after the press.
  - **The visitor's own music** is the client's already. In the stand-in client a press on its own row opens the chooser, the file is kept and played by the client's page, neither world is told, and it is still playing when the next world comes into the frame (`trials/menu-client.mjs`, 99 checks).
  - **Sharing the screen.** In a frame given what BitPortal's shell gives a world, Chrome refuses it whatever is pressed, in the world's own page too: the frame is not allowed `display-capture`. So "Share your screen" is offered there today and fails, saying only "Nothing was shared." Allowed it, Chrome's chooser came up with nothing pressed at all, and it names the client: "Choose what to share with" the client's site. The other way round works: the client's page shares, and hands the picture down over a connection between the two pages.
  - **Proposed, not given:** a row of the kind `file` and a press that carries the file (64 MB, pictures and video, the line "The file you choose goes to" the world); a row of the kind `save` and a word that carries the picture up (64 MB, five kinds, only as the answer to a press, the name the client's own). The screen is a question for the orchestrator, with three ways laid out.
  - A screen chooser is part of no page, so that part was asked of a Chrome with a window on a screen nobody looks at, started without the scripting tool's test switches, and the screen was photographed.

- **What the client's menu costs, measured: nothing in frames, and 18 KB fewer for a reference world** (`trials/menu-cost.mjs`, new; `docs/plans/the-clients-menu-cost.md`, new). Step 1 of the client's menu owed frame times and bytes.
  - The Gallery, the Grove and the Godot example, each in a frame of a page that says nothing (the world draws its own menu) and of the stand-in client (the client draws it), with the menu down and up. Four runs, two at a screen's 60 frames a second and two with Chrome drawing as many as it can, each world visited own, client, client, own.
  - **Frames:** every world drew as many with the client drawing the menu as with its own. The two ways overlap in every row. The page above was busy about 10 ms a second more as the stand-in client.
  - **Bytes:** a reference world doesn't fetch its menu, 67 KB on disk and 18 KB as a host sends it, of 3.3 MB. A world made with another engine fetches the same either way: the engine script is one file.
  - **Words:** four to eight upward in a visit, 4 to 9 KB in all, the biggest 3.2 KB of the 64 KB a description may be. None while nothing changes.
  - **The menu is there** about a third of a second after the page is asked for, where a world's own takes most of a second.
  - **The Godot example in a client's frame** was not tried before this. It comes up both ways, unchanged.
  - Taken on one laptop with a Chromium build running beside it (a load of 13 to 30 on eight threads), in a scripted Chrome drawing with the laptop's own graphics card. It says nothing about a headset, where the world draws the console itself, or a phone.

- **What a visitor changes in a headset is theirs afterwards, and in the next world** (SDK `menu-above.ts`, `ui/port-below.ts`; the engine script; `trials/menu-client.mjs`; NSWP-02, "What a world may say back"). Nothing a visitor can see changes yet: no real client has the menu.
  - Inside a headset only the world can draw the console, so it is there that a visitor changes how they move and turn, the volumes, the size of text. Where the world's client has the menu on the flat screen, the client holds their settings, and until now it never heard of a change made in the headset: the next world got the old value.
  - **A world whose client has the menu now says such a change upward while its headset session runs,** limited by name to comfort and layout (the core's `MENU_REPORTED`). Only a change: not what they had as the session began, and not what the client itself said down. Worlds on the engine script do the same, by the same code.
  - **The client's end takes a report as the visitor's own settings** (`changeSettings`, in its page) unless the client keeps them somewhere of its own (`onReported`), and only while the world says its session is running. They are then said to the next world with the rest.
  - A report can never turn a privacy switch on, say what is held, or fill the screen: those are dropped by name as it is read, as before.
  - Tried in the stand-in client with a made-up headset (`trials/menu-client.mjs`, 91 checks): the fade changed in the headset is the client's afterwards; a forged report with "load from anywhere", something held and a filled screen in it leaves all three as they were; and the next world's first word from the client carries the change.

- **"How you move at a desk", asked once by whoever draws the console** (SDK `visitor-switches.ts`: `askDeskMoving`; `fps.ts`: `mayAsk`; `sites/shared/world.ts`; `menu-above.ts`; NSWP-11, "Asked once"; the owner's ask of 2026-11-21, kept where a client has the menu). Nothing a visitor can see changes: a world that draws its own menu asks as before.
  - Where a client draws the menu above a world, a first-time visitor at a desk was asked by nobody: the world's question had no menu to be shown in, and the client didn't ask. They were casual until they found the switch.
  - **`askDeskMoving(controls)`** is the question in a form a client's page runs: the same tab, rows and words a world asks with ("Casual: click to walk, drag to look", "Intense: the mouse looks, keys walk"). The answer is kept on the client's own site as the visitor's travelling setting and said to every world as it arrives, so it is asked once and never again, in this world or the next. Put away without an answer, it is casual.
  - **A world whose client has the menu doesn't ask** (`createFps`'s `mayAsk`), and its own question's tab is never in what it describes. In a headset the world draws the console, so the headset's question stays the world's.
  - Tried in the stand-in client (`trials/menu-client.mjs`, 87 checks): a first-time visitor is asked by the client and not by the world; answered intense, the world moves them so; not asked again after the client's page is loaded again, nor in the next world, which moves them the intense way from the start. The check that the world doesn't ask was seen to fail without the change.

- **Moving is a tab both fill, the client's part first** (core `MENU_VISITOR_TABS`, `MENU_WORLD_TABS`; SDK `visitor-switches.ts`: `deskMovingSwitch`, `VISITOR_SWITCHES`; `vectors/menu-words.json`; NSWP-02; the orchestrator, 2026-11-23). Nothing a visitor can see changes: where a world draws its own menu, Moving is as it was.
  - Before this, a world could say nothing in Moving, so a client's menu had no "Jump": the only way to jump on a touch screen. And the switch for how a visitor moves at a desk was drawn only by a world, so a client's menu couldn't change it.
  - **The client's own switches come first:** how they move at a desk (casual or intense: `deskMovingSwitch`, the same row and words a world draws) and how fast they look round. The world in the frame takes the change at once and moves them that way. In a headset, how they move and turn, which hand, the narrowing and the fade are theirs too, and a world leaves all of those out of what it describes.
  - **The world's part is what it does for them:** "Jump", below the client's own, under the world's name. Nothing typed goes to a world from Moving.
  - A vector for a world filling Moving, with a `field` row there left out.
  - Tried in the stand-in client (`trials/menu-client.mjs`): switched to intense in the client's menu, the world moves them the intense way at once.
- The plan no longer says the engine script's version goes up for the client's menu: nothing an engine can see changed (the orchestrator, 2026-11-23).

- **A world made with another engine steps its menu aside too; and one piece of code keeps to who draws the menu** (SDK `packages/sdk/src/menu-keeper.ts`: `keepMenu`; `engine-menu.ts`; the engine script and the Godot add-on's copy; `sites/shared/world.ts`; `trials/menu-above-engine.mjs`; NSWP-02). Nothing a visitor can see changes yet: no real client has the menu.
  - **The engine script speaks the menu's words.** A world on it, or on the Godot add-on, says so in its `here`. Where its client has the menu it draws none, from the first moment, and says upward what the engine added: its name, its tabs, its own words for Help (`menu()`'s `help`, where that is at most 400 characters), whether it can start a headset session, whether the place has a hum. Presses, the menu coming and going, the visitor's settings and the summons work as in a Three.js world. With no answer in 300 ms it draws its own menu, as before.
  - **`keepMenu(controls, above, mount)`** is the rule of who draws the menu, in one place: the world's own where nobody above has it; none, but for the chat's pane, where its client has; the other when the answer changes; and asked again each time the world's own menu arrives. The reference worlds and the engine script both use it, where the reference worlds had their own copy. It has unit tests for each case.
  - A setting changed in the client's menu for how a visitor moves at a desk is now taken by an engine world too, and the engine is told.
  - The menu's own sounds are not made twice in an engine world whose client has the menu.
  - Tried: `trials/menu-above-engine.mjs` (17 checks), a bare page with only the engine script, in a frame. `trials/console-first.mjs` still passes: the script's own menu is up from the first moment where no client is above.
- The client's own row for a sign-in address that didn't answer says "Press to try again." (the orchestrator's words, 2026-11-23).

- **You and the Bag in a client's menu: the kit's half** (core `MENU_SIGN_IN`, `MenuState.signIn`, the word `sign: "out"`; SDK `ui/port-below.ts`: `signInRows`, `below.signOut`, `below.hold`; `menu-above.ts`; `sites/shared/world.ts`; `vectors/menu-words.json`; NSWP-02; the orchestrator, 2026-11-23). Nothing a visitor can see changes yet: no real client has the menu.
  - **You stays the client's alone.** A world never puts a row there. It says where its own way of signing in stands as one of four facts (`state.signIn`: `none`, `ready`, `asking`, `unanswered`) beside `state.named`, and the menu words its own rows from them (`signInRows`).
  - **Signing out of a world is one word,** client to world: `{ nswp: "menu", sign: "out" }`. It carries nothing and can only take away. The reference worlds lock what signs for the visitor there, without asking. There is no word for signing in: a client opens its sign-in address's panel itself.
  - **Taking something up in a client's Bag** (`below.hold`): the client says what the visitor took up, with the mark of its own logic only where they let that logic run, and waits for the world to say it is in hand. What is in hand is no longer said with the visitor's other settings: the client knows it only from the world.
  - **A thing that does things of its own is asked about by whoever draws the Bag.** In a client's page that is the kit's own rule, run there (`mayHold`): the first press says so, the second is the visitor's yes, and the world is told which script they let run.
  - **The kit's own Bag runs in a page that isn't a world.** Tried in the stand-in client (`trials/menu-client.mjs`, 74 checks, twice): a made-up visitor whose bag holds the dart blaster takes it up in the client's Bag, is asked about its logic there, and it is in hand in the framed world; put away there, it is out of hand.
  - For that trial only, a reference world on this machine takes a made-up visitor's bag from the page (`__nswpTrial.has`), as it already takes a made-up gate. Nowhere else.
  - Three vectors for the sign-out word, and the sign-in fact in the state's examples.

- **A world takes what is in the visitor's hand from their client, at once** (SDK `packages/sdk/src/bagging.ts`; `docs/plans/the-clients-menu.md`, step 1). Nothing a visitor can see changes yet: no real client has the menu.
  - Where a client draws the menu, the Bag is the client's own tab. When the visitor takes something up or puts it away there, the client says so with their settings (`holding`), and the world acts on it there and then.
  - It is held to the rule a link's word is held to, and no further: taken in hand only if it is in their own bag as they signed it, where the place lets things be carried, and its own logic runs unasked only if it is the very script named. Putting away is always done. What was in hand is put away first.
  - Not yet: a client that has a Bag to say it from. The stand-in client has no sign-in, so no bag.
- The client's own help ends "This menu is the same in every world. Home always takes you home, whatever a world does." (the orchestrator's words, 2026-11-23).

- **Sound and Help are tabs both fill, the client's part first; and a world's part of any tab is under the world's name** (core `MENU_VISITOR_TABS`, `MENU_WORLD_TABS`, `MenuState.hum`; SDK `ui/port-below.ts`, `ui/hud.ts`, `menu-above.ts`, `sound.ts`, `ui/help.ts`; `vectors/menu-words.json`; NSWP-02; the orchestrator, 2026-11-23). Nothing a visitor can see changes: where a world draws its own menu, Sound and Help are as they were.
  - **Sound.** In a client's menu the volumes, "All sound", the switch for a place's hum and the visitor's own music are the client's, and the music is played by the client's page. A world adds what is its own: "Playing here", and the way on to its next piece. The world says whether the place has a hum (`state.hum`), and the client shows its switch only where it does.
  - **Help.** The client's own words on how to move come first (`helpWords`). What a world says of itself is a note after them, under the world's name, of at most 400 characters (`portAbove`'s `help`). The reference worlds say their one sentence on what the place is for.
  - **Under the world's name.** In every tab both fill, the client's own rows come first and the world's stand below a line with the world's name. A world's note is never drawn as the menu's own: it is kept apart (`UiSectionView.said`) and shown after, with the world's name before it. A row carries whose it is (`UiItemView.from`).
  - Nothing typed goes to a world from Sound or Help: a `field` row there is left out, as before.
  - **One sound for one press.** The client's page makes the menu's own sounds (a press, the menu coming and going, words for a moment). A world whose client has the menu doesn't make them too (`addSoundControls`' `quiet`).
  - Two vectors: a world filling Sound and Help, with a `field` row in each left out; and a Help note over the limit left out.
  - Tried in the stand-in client (`trials/menu-client.mjs`, 65 checks).

- **"Enter VR", then "Launch"; and a world says the state of what only it can run** (SDK `packages/sdk/src/three.ts`, `ui/headset.ts`, `menu-above.ts`; `sites/shared/world.ts`; `sites/airlock`; `trials/menu-client.mjs`; NSWP-02; the owner, 2026-11-23: two presses, each with its own name).
  - **A visitor sees one change today:** the large button shown to someone who left a headset to come to a world now says **"Launch"**, not "Enter VR", and the Airlock's line about it says so. The row in the menu still says "Enter VR".
  - **Pressed in a menu drawn above the world,** "Enter VR" is not a press in the world's page, and a browser starts a headset session only at one that is. The world then shows that same screen across its view: "Launch", "Press anywhere, with anything, to start VR." A press there starts the session. The world asks the browser whether the press was its own (`navigator.userActivation`), and also takes the browser's refusal for want of one as the same thing.
  - As the screen comes up the client's menu is asked to go, which gives the world's frame the keys, so that any key is the press.
  - **The world's `state`:** whether there is a room, whether the visitor is joined, their microphone and how many are here; whether this world has their name; what is in their hand; and its rule for items. With the headset's, said before.
  - A world whose client has the menu now looks again at what it says on a slow tick, as its own menu does, and says it only if it differs. Before, a headset session starting changed no row's words in a way the controls were told of, so the page above wasn't told.
  - Tried in the stand-in client with a made-up headset in the world's page (`trials/menu-client.mjs`, 56 checks): "Enter VR" on the client's bar starts no session and brings "Launch" up; a press on the world's view starts it; the world says so upward.
  - Not tried: a real headset. Worlds on the engine script show "Launch" to an arriving visitor too (it is the same screen), and are otherwise unchanged.

- **A world's pictures go up to the client's menu as bitmaps** (SDK `packages/sdk/src/menu-above.ts`, `ui/port-below.ts`, `ui/hud.ts`; `trials/menu-client.mjs`; NSWP-02, "Pictures"). Nothing a visitor can see changes yet: no real client has the menu.
  - A world whose client has the menu sends each picture alone, by the `picture` word: a tile's by its row's id, and the picture at the head of a tab (someone's face, in People) by `card:` and the tab's id. Never in the description, which is text and is said again at every change.
  - They are made only while the menu is up, afresh each time it comes up, at most 256 pixels a side. Someone's picture is fetched by the world, as today, and crosses as a bitmap: the page above is never given an address.
  - The client keeps each by id until the world stops describing the thing it is of, and takes none for something the world hasn't described. The menu draws a card's face from a bitmap (`UiCard.face`), and draws again when a picture is a new one.
  - Tried in the stand-in client (`trials/menu-client.mjs`, 50 checks): a tile's picture crosses at 256 pixels and is drawn by the client. Also tried there, as owed: "Load people's files from anywhere" pressed through the client is on in the world, stays on when the client says its settings again, and is never in any word the client says.
  - A row's id can never be taken for a card's picture: a row whose id begins `card:` is left out as a description is read (core `MENU_CARD_PICTURE`, `cleanMenuWorld`; a case in `vectors/menu-words.json`).
  - Not built: a picture fed as the world runs (a camera's view). Nothing in the kit has one in a tab a world fills.

- **One menu, never two: a client that answers while the world's own menu is on its way** (`sites/shared/world.ts`; `trials/menu-above.mjs`). A fault in the reference worlds' wiring, found by a trial on a busy machine. No visitor met it: no real client says it has the menu yet.
  - A framed world that hears nothing from its client in 300 ms fetches its own menu, which is a file of its own. If the client's answer came while that file was on its way, the world drew its menu when the file arrived, though the client now had one: two menus.
  - Who has the menu is now asked again each time the world's own menu's file arrives, and a menu that arrives for a world whose client has one is put away before it is seen.
  - The trial has the case: a client that answers 600 ms after `here` while the menu's file is held back for two seconds. Seen to fail without the fix, and to pass with it.

- **Nothing above a world can turn "Load people's files from anywhere" on** (core `cleanMenuSettings`, `MenuSettings`; SDK `file-hosts.ts`, `ui/port-below.ts`; `vectors/menu-words.json`; NSWP-02; the orchestrator, 2026-11-23). No change for a visitor: no client has said it yet.
  - The switch is for the one place the visitor is in, and that place keeps it. Where a client draws the menu the row is still the world's, pressed through the client, so a client has no need to say it.
  - `filesAnywhere: true` in a client's settings is now dropped, as a link's always was. `false` is still taken, as from a link. Two examples in the vectors say so.
  - A client never says it down, on or off (`portBelow`): a client that said "off" with everything else would have turned it off in every world it showed.
  - This undoes one line of the entry for the world's end below, which let a client turn it on for the world the visitor was in.

- **The chat's pane says whose it is** (`packages/sdk/src/ui/hud.ts`; the orchestrator, 2026-11-23). Where a world keeps the chat's pane because its client has the menu, the pane has the world's name at its head. It is in the world's colour and the client's menu in the visitor's, so the colour and the name tell the two apart. Nothing changes where a world draws its own menu.
- **A trial routes every WebSocket too, and lists what was asked for** (`trials/README.md`, under Rules): a route for requests doesn't see the relays a world opens.

- **The rows that change a setting the visitor carries are the client's own, where a client has the menu** (SDK `packages/sdk/src/visitor-switches.ts`: `picturesSwitch`, `modelsSwitch`, `chatSwitch`, `VISITOR_SWITCHES`; `models-switch.ts`; `menu-above.ts`; from `nswp-sdk/menu`, with `addDeskControls`; NSWP-02; the orchestrator, 2026-11-23). Nothing a visitor can see changes: where a world draws its own menu the rows are where they were, with the same words.
  - "Profile pictures", "Show people's own models" (People), "Written chat" (Room) and "Field of view" (View) each change a setting the client now holds and says to every world. A world whose client has the menu leaves them out of what it describes, and the client draws them itself inside those tabs. A world that changed one itself would have left the client, and so the next world, with the old value. The first two guard the visitor's privacy.
  - The three switches are rows a client can add without carrying anything that draws a world: the models switch moved out of `look-models.ts` into `models-switch.ts`, and `look-models.ts` hands it on under the names it had.
  - "Load people's files from anywhere" stays the world's row. It is for the one place the visitor is in, and that place keeps it.
  - Tried in the stand-in client (`trials/menu-client.mjs`, 41 checks): pictures turned off in the client's menu are off in the world at once.

- **A world that steps its menu aside keeps the chat's pane** (`packages/sdk/src/ui/hud.ts`: `mountMenu(port, { only: "chat" })`; `sites/shared/world.ts`; `trials/menu-client.mjs`; `docs/plans/the-clients-menu.md`, section 15, "The chat's pane, for steps 1 to 3"). Nothing a visitor can see changes yet: no real client has the menu.
  - Until a client runs the room's chat, messages and posts itself (step 3), a world whose client has the menu draws that one pane in its own frame, and nothing else of a menu: no bar, no mark, no sheet, and no key but the chat's own. It is in the world's colour; the client's menu is in the visitor's.
  - The reference worlds fetch the menu's file for it only once there is something to write to (a room joined, or a visitor signed in). A world with neither still never fetches it.
  - It is opened from the row the world describes ("Chat"). As it comes up the client's menu is asked to go, which gives the frame the keys, and the box to write in takes them.
  - The menu now puts the keys in the chat's box when its page is given them with the chat open and nothing holding them. A page in a frame can't take the keys for itself.
- `trials/menu-above.mjs`, `menu-rows.mjs` and `menu-client.mjs` answer every relay socket themselves, and list which were asked for. None was: the Gallery opens no relay for a guest.

- **The client has the menu: the client's end, and both ends tried together** (SDK `nswp-sdk/menu`: `portBelow`, `mergeView`; `packages/sdk/src/ui/port-below.ts`; the menu's `pressKey`; `trials/stand-in-client/`, `trials/menu-client.mjs`; NSWP-02, "The client has the menu"). Still nothing a visitor can see: no real client uses it yet. BitPortal's shell is step 2.
  - **`portBelow(frame, { controls, home })`** is what a client mounts the menu on: its own controls (the visitor's own tabs, the way home) with the tabs a framed world describes laid in among them. `mountMenu(below.port)` draws it, the same menu a world draws for itself.
  - It answers a world's `here` at once, to that world's origin only, with the visitor's settings; reads everything a world says with the core's reader before the menu sees any of it; and drops a description at the load of the next page.
  - A tab every place has keeps the menu's own name and icon, the client's rows first. A world's own tab stands last and carries the world's name. The bar is the client's keys, then the world's. The look is the visitor's: a world's colour doesn't tint the menu.
  - A press on a world's row goes down as a word, by the world's own id; a row typed into carries what was typed, at the press; a row that copies is copied by the client's page. With the menu down, the frame is given the keys again after every press, so the world goes on hearing them.
  - The keys a world forwards act on the menu (`pressKey`). As the menu comes up the world is told and the client has the keys; as it goes, the frame has them.
  - **Home as a guarantee:** `below.leave()` asks the world, and takes the visitor home itself after a second if the frame hasn't loaded another page, saying what was in hand was left behind.
  - A client draws no menu over a page that doesn't say it speaks the words.
  - Tried in a real Chrome with a real mouse and keyboard (`trials/menu-client.mjs`, 28 checks): a stand-in client over this checkout's Gallery.

- **The menu draws a row you type into, and a row that copies** (`packages/sdk/src/ui/hud.ts`, `ui/model.ts`; `following.ts`, `front-room.ts`; `trials/menu-rows.mjs`; `docs/plans/the-clients-menu.md`, step 1; NSWP-02, "Two kinds of row the client does itself").
  - **A row of the kind `field`** is a box and a button with the row's words. What is typed is given to the row only at the press, the box is never filled in by the menu or the browser, it takes 500 characters, and under it the menu says where what is typed goes. What is half typed stays while the menu is drawn again, and is gone at the press or when the menu is put away.
  - **A row of the kind `copy`** copies its text at the press, in the page that draws the menu, and says so.
  - **"Someone whose key I copied" (Who comes in) and "Follow the key I copied" (Following) are now rows typed into:** "Add someone by key (npub1…)" and "Follow by key (npub1…)". The key is pasted or typed into the box. Both now work in a world shown in its client's frame, where a browser never lets a world read what was copied. In a headset, where the console draws them as buttons, they do as before.
  - Still reading what was copied, and still not working in a frame: the Bag's "Put in the item I copied". It becomes the client's own row with the client's end of the menu.
  - `trials/owners-screen.mjs` types the key into the row.
- **A card's proven mark is taken only from the client's own pages** (core `cleanMenuWorld`; `vectors/menu-words.json`; NSWP-02; the orchestrator, 2026-11-23). A client that drew that mark, in its own style, on a world's say-so would be vouching for what it hasn't checked. So in a framed world nobody in People carries it until the client draws People from passes it checks itself (step 3). A world's own words in a card's `tag` are kept.

- **The client has the menu, second part: a framed world steps its menu aside for a client that has it** (SDK `nswp-sdk/menu-above`: `portAbove`; `packages/sdk/src/menu-above.ts`, `client-frame.ts`, `settings.ts`; `sites/shared/world.ts`; `trials/menu-above.mjs`; NSWP-02, "The client has the menu"). Nothing a visitor can see changes yet: no client says it has the menu, BitPortal's shell included.
  - **The world's end of the menu's port.** `portAbove(controls, { state, home })` asks the page above whether it has the menu. If it does, the world draws none: it says what it is upward (its name, how much room it gives the console, the tabs that are its to fill) whenever that changes and no oftener than eight times a second, and takes back presses on what it described, what was typed into a `field` row, the visitor's settings, and that the menu came up or went. Nothing of the visitor's own tabs is said upward, and not the way home.
  - **The reference worlds use it.** In a frame whose page has the menu they draw no menu and never fetch its file. With no answer in 300 ms of their `here` they draw their own, as before; an answer that comes later still stands, and their own is put away. Not yet: worlds on the engine script and the Godot add-on, which draw their own menu in a frame as before and don't say they speak the words.
  - **A world says it speaks the words in its one `here`** (`menu: 1`), which is now said once the files loaded with the page have all run, not as the first of them loads. Loading `nswp-sdk/menu-above` with the page is what says so, so it is imported plainly, never with `await import()`.
  - **The visitor's few keys go upward by name** while the world has the keyboard: the summons (which the world never hears), Escape, the menu's key and the digits. Never any other key. A world that has taken every key forwards only the summons and Escape.
  - **A setting changed in the client's menu is taken at once** by each part of the kit that holds one (`changeSettings`; `reportSettings` takes a third argument, how a part takes its share): volumes, the size of text, motion, the wrist, pins, how they move at a desk and in a headset, how fast they look and how wide they see, and the switches for items, pictures, people's own models and chat. "Load people's files from anywhere" is turned on this way and no other: by the visitor's own client, for the world they are in. It still never goes on through a door.
  - **Two kinds of row in the kit's own model** (`UiAction.kind`): `copy`, with its text in `copy`, and `field`, whose `act` is given what was typed (`controls.run(id, typed)`). Nothing in the kit is of either kind yet, and the kit's own menu doesn't draw them differently yet: that is the next piece, with the client's end.
  - Tried in a real Chrome against this checkout's Gallery, in a frame of a page on another site (`trials/menu-above.mjs`, 19 checks): a client that answers, one that never does, and one that answers late.

- **The client has the menu, first part: the words, their limits and the reading of them** (core `packages/core/src/menu.ts`; `vectors/menu-words.json`; NSWP-02, "The client has the menu"; NSWP-11, "Who draws it"; `docs/plans/the-clients-menu.md`, step 1). Nothing a visitor can see changes: no world and no client speaks the words yet.
  - What each side may say: a client's `has`, `settings`, `press` (with `field`, what was typed), `open` and `go`; a world's `world` (its description), `key`, `say`, `settings` (reported back from a headset) and `picture`.
  - `cleanMenuWorld` is what a client keeps of a world's description: its name, how much room it gives the console, the state of the things only it can run, and the tabs it may fill, held to `MENU_LIMITS`. A world never fills the visitor's own tabs; it may add two of its own; a row typed into (`field`) stands only in "Who comes in" and a world's own tabs; a `copy` row carries its text. What is over a limit, unknown or not the world's to say is left out, never cut to fit.
  - `readMenuWordDown` and `readMenuWordUp` read a word for a world and for a client. A word with anything in it that only the other side says is not read.
  - `reportedSettings`: what a client takes from a world's report, comfort and layout by name. Nothing that guards the visitor's privacy, says who they are or what they hold.
  - `MENU_LIMITS` gains `copy` (2000), `field` (500), `title` (80) and `note` (400). `MENU_WAIT_MS` (300) and `LEAVE_MS` (1000) are the two waits.
- **The vector check looked at only the first half of its own expectations** (`scripts/generate-vectors.ts`). Its one check for disagreement stood partway up the file, so everything written below it (an owner's list being written, people's own models, listings, BitGate's lists) could disagree with the core and still be written and pass. The check is now the last thing before writing. Nothing below it disagreed; the menu's first example that did is how it was found.
- **A row that reads what you copied says why when it can't, in a world shown inside another page** (`packages/sdk/src/client-frame.ts`, `bagging.ts`, `front-room.ts`, `following.ts`; the engine script; `docs/plans/the-clients-menu-presses.md`).
  - "Put in the item I copied", "Someone whose key I copied" and following someone by a copied key can't work in a world shown in a client's frame: the page above doesn't let a framed world read what was copied, whatever is pressed or allowed. They used to say "allow this site to read what you copy", which there is a switch that doesn't exist. They now say the world is shown inside another page, and to open it by its own address.
  - Nothing changes in a world opened by its own address.
  - This is a known fault for a framed world and not a fix for it. The frame is never allowed to read the clipboard; the fix is the client's own menu, where the visitor pastes into a row of their client's (`docs/plans/the-clients-menu.md`, section 8).
- **The press trial, second part: windows, and a pointer the world holds** (`trials/presses-from-above.mjs`; `docs/plans/the-clients-menu-presses.md`). No feature.
  - A framed world can't open a window from a press on the page above it. Tried in a second Chrome with its window blocker on, since the scripted one starts with it off.
  - A world that holds the pointer lets it go when told the menu is up, and Chrome lets it take the pointer again as the menu goes, with no new press.
  - Not tried, because a scripted browser can't: Escape with the pointer held, and where a press goes while it is held. Both need a person's keyboard and mouse.
- **How a trial about presses is written** (`trials/README.md`, under Rules; `docs/fleet.md`, "What a bigger fleet taught us"): a scripted call into a page counts there as the visitor's own press, so such a trial runs nothing inside the page it asks about.
- **The menu takes a world's port, and nothing else** (`nswp-sdk/menu`: `mountMenu`, `WorldPort`, `portHere`; `docs/plans/the-clients-menu.md`, step 0; names from the orchestrator). The first step towards the menu being the client's. Nothing a visitor can see changes.
  - The flat-screen menu used to be handed a world's controls whole. It is now handed a port: what to draw as data, a press back by its id, and a few signals. `portHere(controls)` is the one carrier so far, the world's own controls, direct; the next step adds words from a page above.
  - `mountHud(controls)` still works and is `mountMenu(portHere(controls))`.
  - In the reference worlds the menu is a file of the build's own (56 KB, minified, in the Gallery), fetched by the world as it starts, so that a world whose client draws the menu need never fetch it. For that the world takes `createControls` from `nswp-sdk/three`, which now exports it; `nswp-sdk/ui` carries the menu with it.
  - The engine script uses the port too. It stays one file.
  - Not yet through the port: the headset's in-world console, which still reads the controls.
  - Tried: the menu's pictures before and after are the same on a phone's width, and within 2 levels of 255 at a desk's; the fullscreen, bar, item, loading, engine-console and owner's-screen trials pass on the new build.
- `trials/bar-scrolls.mjs` was out of date since kit 0.79.0, which put a held item's presses under the thumb on a touch screen: it no longer expects Fire and Reload on a phone's bar.
- **The local sites are served at this machine's own network address, never a VPN's** (`scripts/lan-address.mjs`: `lanAddress`, `anyAddress`, `waitForLanAddress`; `scripts/serve-local.mjs`; `trials/lib.mjs`; the orchestrator, 2026-11-23). At boot the first address the machine listed was Tailscale's, and the sites redirected to an address the certificate doesn't cover.
  - The address is chosen: a private one (192.168, then 10, then 172.16), never a network's only address (a VPN's /32), never on an interface that is a VPN's, a container's or a virtual machine's by its name.
  - `serve-local.mjs --lan` waits up to 30 seconds at start for one (`LAN_WAIT_MS`), then falls back to what it did before and says so. `LOCAL_HOST` says the address outright, as it already did for the trials.
  - The trials' `HOST` is picked the same way.

- **People's own models: the rule for who is drawn, tested; and a limit on look notes in a room** (SDK `chooseLooks`, `worldDrawsModels`, the `WorldLooks` type, `AVATAR_EVERY_MS`; NSWP-06). No change to what a visitor sees.
  - Who is drawn as their own model is now one function, which presence draws by: nobody in a world that names no format or dresses everyone itself, only the formats a world draws, nobody for a viewer who turned models off, not a person they chose to see simple, and at most 8 at once, the nearest. It has tests for each.
  - `trials/own-models-two.mjs` takes `MODE=none` and `MODE=own`: in a world that draws no models, a named visitor's note isn't sent, nothing is fetched and no row offers models.
  - A room takes a new `avatar` note from one member no oftener than every 3 seconds, and checks a note's signature once, not at every redraw. Before, a member could have everyone in a room check signatures as fast as they could send.

- **`npm run release:prepare`: everything of a release up to the deploy** (`scripts/release-prepare.mjs`; `packages/core/test/release-prepare.test.ts`; names from the orchestrator; `docs/backlog/one-command-release.md`). It never deploys: `release:all -- --go` stays a separate command, on the owner's word.
  - It makes the version pull request (the number under `## Next`, `KIT_VERSION`, the build, the engine script), runs the full gate and merges it. It then builds NSWP's main folder at that merge, vendors the kit into BitPortal and the world template (each gated, each merged the same way), fast-forwards the two main folders the deploy reads, and ends on what `release:all` would deploy.
  - Every step is tested by its exit code, and nothing runs after one that failed. A pull request is merged only at the commit that was gated (`--match-head-commit`), and read back merged.
  - A main folder that isn't on `main` and clean stops it before anything is touched. It works in worktrees of its own.
  - `--dry-run` cuts, builds and gates the version, and only prints the rest.
- **A look of your own, step 2: the kit draws people's own models** (SDK `createLookModels`, `lookBudget`, `ownLookNote`, `showsModels()` / `setShowsModels()`, `arrival.avatar()`, `Member.model`, `JoinOptions.avatar`, `PresenceOptions.looks` / `.avatar` / `.lookModels`, `Presence.showSimple` / `isSimple` / `drawsModels` / `lookInfo()`; core `withoutRequired`, `glbJson`, `lookFacing`; the room message `avatar`; console rows `people-models` and `person-simple`; the setting `models`; NSWP-05, -06, -11). A model stands and turns as a whole for now: walking it is the next step. No world here turns models on yet.
  - In a room, a member who came by name hands the others their signed look note (`avatar:`), at most `LOOK_NOTE_LIMIT`. A receiver believes it only once their pass names the key that signed it. The note is the one the arrival named (`avatar`, read from relays by `ownLookNote`); going plain sends none.
  - A model is fetched by its hash from the viewer's own file hosts (`fetchByHash`), read by `readGlb` against `LOOK_BUDGET` or the world's lower `avatar` limits, and only then handed to Three.js, with VRM's required extensions taken off its list (`withoutRequired`). Off-list, refused or unreadable, the person is drawn as their simple look.
  - It is fitted to its wearer's height (held within the world's `avatar.height`), feet on their floor (1.6 m below their eyes), facing -z (a VRM 0.x is turned the other way, `lookFacing`). Each wearer gets their own copy; the file is fetched once.
  - The kit draws the wearer's mark on a small plate over the model, and their name and picture over its head.
  - A model's materials are drawn without metal, in their own colour and picture: a world has nothing for a metal to mirror, so glTF's default (all metal) would be drawn black.
  - `trials/own-models-two.mjs` is the two-visitor trial: Ada by name with a tiny VRM made in code, Ben a guest, in the Grove as built.
  - At most `LOOK_MODELS_AT_ONCE` are drawn, the nearest first, chosen twice a second.
  - A world draws them where its `looks` (its manifest's `avatar`) names the format and doesn't say `dress: "own"`. A reference world can say it in its config (`avatar`), or on a local address a trial can (`__nswpTrial.looks`).
  - "Show people's own models" (`people-models`, under People, on by default, travels as `models`), and on a person's card "Show as simple look" (`person-simple`), for this visitor alone.

- **A look of your own, first step: the model tier written, and its reader** (core `LOOK_BUDGET`, `LOOK_HEIGHT`, `LOOK_MODELS_AT_ONCE`, `LOOK_NOTE_LIMIT`, `LOOK_FORMATS`, `readLookModel(note)`, `lookHeight(asked, world?)`, `ModelBudget`, `GlbCount.joints` and `.morphs`; manifest `avatar.height` and `avatar.dress`; NSWP-05, "A model of your own"; names from the orchestrator). Nothing draws a model yet: that is the kit's next step.
  - The owner decided, 2026-11-22: heights 0.85 m to 2.55 m, which a world may narrow; VRM and plain GLB; never scripts in a look; a plain warning the first time someone publishes a look; no spring bones in this first round (`docs/plans/own-models.md`, section 6).
  - A look note's `model` tag names the file by its hash (`vrm` or `glb`, https only), with `height` and an optional `thumb` with its hash. `readLookModel` reads them; a note without a model is a simple look.
  - `readGlb` now counts joints (each once) and the most morph targets on any one mesh, and takes a `ModelBudget`. Items are unchanged: their budget sets no limit on either, and still allows no required extension. A look's budget is lower than an item's (1 MB, 12,000 triangles, 24 meshes, 8 materials, 1024 px, 128 joints, 64 morphs) and lets through VRM's own required extensions, never spring bones.
  - `lookHeight` holds a height within the kit's limits and a world's `avatar.height`. A world's limits only narrow the kit's.
  - The manifest reads `avatar.height` (`[least, most]`) and `avatar.dress` (`"own"`), with a warning for anything else. The schema has both.
  - Vectors: `vectors/looks.json` gains `budget`, `heightLimits`, `models` and `heights`.

## 0.83.0

- **Someone else's files are fetched only from file hosts the viewer already uses** (core `FILE_HOSTS`, `FILE_HOST_LIST_KIND`, `cleanFileHost`, `fileAt`, `onFileHost`, `parseFileHostList`; kit `fileHosts()`, `learnFileHosts`, `fetchByHash(sha256, hint)`, `keptElsewhere`, `filesAnywhere()` / `setFilesAnywhere()`; the console row `files-anywhere`; the setting `filesAnywhere`; NSWP-17, "Where a file is fetched from"; names from the orchestrator). Before this, an item's files were fetched from whatever address its maker wrote, so anyone could hold an item in a room and learn the address of everyone there.
  - A file host is an https prefix where a file is at `<prefix><sha256><ext>`, the extension taken from the hint. A Blossom server is one, at its root.
  - The viewer's list is the file hosts their own sign-in address keeps their files on (their kind 10063 list, read by the key they arrived as), then `FILE_HOSTS`, which is `https://grove.bitblocks.network/items/`, where the starter items already are. A guest has only `FILE_HOSTS`.
  - Each host on the list is asked for the hash. The item's own address is used only where it is inside one of those hosts, or where the visitor turned on "Load people's files from anywhere" (off by default). Only off travels: an arriving `filesAnywhere: true` is dropped as the settings are read and never kept, since any world can write a link. On is the visitor's own press, in each place. The bytes are hash-checked as before.
  - Every file of an item goes through it: models, sounds, scripts, things sent out, in every engine. An item kept elsewhere is drawn as its marker, and its Bag card says so and what would fetch it.
  - `createItemStore` and `createItems` take `viewer`, whose own list is used. Left out, the visitor it arrived as.
- **Items in your bag show a bag in their corner; offered ones are greyed** (the console's Bag section; a tile's `mark` and `faint`; the owner, 2026-11-22: "The items that are in your bag in the menu need a bag icon in there corner. If it's not in the bag the it should be grayed out"; `docs/backlog/bag-icon-on-items.md`).
  - In the HUD and the headset console, an item in the visitor's bag, the one in their hand included, shows the console's own bag icon in its tile's corner.
  - An item only offered here is drawn greyed, with a dashed edge. It is still pressable and takeable, since grey means not theirs yet, never unavailable. Its words say "offered here, not in your bag" for a screen reader.
  - Taking one, or putting one out of the bag, changes its tile at once, with the menu still open.
  - Any tile can use the two fields: `mark` (an icon in the corner) and `faint` (greyed, still pressable).
  - Engine worlds have it through the engine script's console.
  - Pictured before and after (`trials/bag-marks.mjs`, the kit's own Bag code with a stand-in bag), at a desk's width and a phone's, and in the near-white "Paper" accent. The console has no light theme.
- **`npm run release:all`'s exit code, checked** (`packages/core/test/release-all.test.ts`; the orchestrator, 2026-11-22). A refusal with `--go` seemed to exit 0. In fact the script exits 1 whenever it refuses, whenever a step fails, and whenever a site doesn't come up on the kit. The 0 was the `| tail` it was piped through answering, not the script; checked by running the refusal both directly and through a pipe. The new test runs the script with `--go` where it can deploy nothing and reach nothing: a stand-in `vercel` that always fails, so it always refuses; a `git` whose `fetch` fails; and a `fetch` that fails. It asserts "Nothing was deployed" and exit 1, and it fails if the refusal exits 0 (tried). The script's header now says how to read its exit code through a pipe.
- **A fade for the jumps the kit makes, in a headset** (`Comfort.fade`, the travelling setting `fade`, `xrInput.jump`, the Moving switch `move-fade`; `docs/plans/seated-mode.md`, 3.4; `docs/backlog/headset-casual-and-intense.md`, "A fade for jumps the kit makes"; names from the orchestrator).
  - For someone moving the casual way, every jump the kit makes for them is a short fade to black, the jump, and back, about 120 ms each way: a headset step, a step back with the stick, and stepping aside on arrival. Nothing is seen to move. Intense keeps the instant cut.
  - The fade is on in casual and off in intense. It can be changed in Moving ("The view fades when you step"), and it travels beside `turn`, `hand` and `narrow` (NSWP-11; the arrival schema and vectors).
  - A world's own jumps (a respawn, a teleporter) get the same fade through `xrInput.jump(fn)`.
  - It is one dark sheet on the camera, drawn last, with no extra pass. The jump is made only once the view is wholly dark, and a second jump during the fade is made in the dark too.
  - Turning a notch stays an instant turn. A door needs none, since the next world's session starts fresh.
  - Engine worlds come later, with the plan's section 4.
  - Tried in the made-up headset by `trials/fade-steps.mjs`: casual made the step at full dark, and the view came back; intense and the fade switched off both cut, never dark.
## 0.82.0

- **The owner's screen: "Who comes in"** (the console section `guests`; core `changeOwnerList` and `isOwnerListAsked`; `signer.guests`; `gate.changeList`; NSWP-10, "The owner's screen"; names from the orchestrator). In the console of a keeper signed in here, and nobody else's, a world's lists can be changed from inside the world.
  - The section says "Anyone can read this list", with how many people are invited and kept out, as read.
  - It offers the people on either list, the people here now, the people the keeper follows, and someone whose key they copied, never the keeper themselves. For each: "Let in" or "Take off the list", in a world by invitation, and "Block" or "Unblock".
  - Each press is one change, asked of the sign-in address with BitLogin's `guests` request, on its own page every time; no standing permission is asked for or granted. What comes back is taken only if it is exactly that list with that one change, by that keeper (the signer client and the gate both check). It is then sent to relays and acted on at once, so someone just let in is let in.
  - With no list found, a second press is needed to start one, and nothing is changed while relays haven't answered and nothing is remembered.
  - In a headset the rows say to take it off, as buying does.
  - The gate gains `keeper`, the signed-in keeper's key or null, and `guests`, who the guest list itself names; the screen needed both.
  - `addGateControls` takes `here` and `follows`. The reference worlds and the engine menu pass them, so engine worlds have the screen too.
  - The writing vectors are now made by the core's `changeOwnerList`. NSWP-10 says a writer may add a `client` tag, which readers ignore and the kit's own writers don't add.
## 0.81.0

- **Places to arrive, so nobody arrives inside someone** (NSWP-01 "Places to arrive"; the owner, 2026-11-21: "We need designated spawn locations in each world with a minimum number set so that the game can always find a clear area to spawn if someone else is there."). Each entry point is a set of places: at least four (`ENTRY_PLACES_LEAST`), eight for a world with rooms (`ENTRY_PLACES_ROOMS`), a metre apart (`ENTRY_CLEAR`), its own spot first, so every door and link naming it still lands there (`entry-places.ts`: `entryPlaces`, `pickEntryPlace`, `checkEntryPlaces`). Arriving takes the first place nobody in the joined room is within a metre of, never where nobody may stand, else the one with the most room. A visitor who joins and finds themselves inside someone is moved to a clear place by presence's new `arrival`: once, soon after joining, never later, never while stepping or turning, only the one arriving, and in a headset the same instant cut a step is. A world that doesn't say its places gets today's step round its spot (`spawnOffset`, now deprecated). An entry point written as one spot works with a ring 1.3 m round it; a world's check warns of it, and fails a set given but too small or too tight. Every reference world has eight places per entry point, and their build checks them. Other engines: `NSWP.entryPlace`, a frame's `nudge` (with `view.moving`), and `entryPlacesLeast`, `entryPlacesRooms`, `entryClear` in `NSWP.kit()`; in Godot an `nswp_entry` marker's `Node3D` children are its places, and `Nswp.place(visitor, least)` picks among them. So that only the one arriving is moved, the hello a member sends on joining now says so (`"first":true`, NSWP-06; `buildHello(..., { first })`; a client that doesn't know it ignores it), and a room marks who joined after this visitor (`Member.joinedAfterYou`). With `arrival` given, the old step apart by session key (which could move someone already standing) stands aside. "Arrive anywhere in this area" is left out of this round.
- **A merge left half done fails the gate** (`packages/core/test/no-conflict-markers.test.ts`; the orchestrator, 2026-11-22: twice a merged changelog still had conflict markers and the gate passed). No text file git keeps may have a line that opens a conflict (seven `<`), closes one (seven `>`), or the line of seven `=` between them (only between them: Markdown underlines a heading with `=`).
- **The console from the first moment, in a world made with another engine** (the engine script; NSWP-09; the orchestrator's go, 2026-11-22). While the engine is still arriving, which can be minutes for Godot's forty megabytes, the visitor already has their console over the crossing's room. It holds Home (or their doors, at home), the world's address, and a line saying the world is still loading, and the key left of 1, or two fingers held still, brings it up as everywhere. Before, there was nothing to press until the world asked for its menu. `NSWP.menu()` now fills that same console in with the world's name, colour, controls and its own Home; it never makes a second. A world that opens its doors without asking for the menu draws its own, so the early console goes as the doors open and never sits over the world's own menu. A page with no room (`data-crossing="off"`) has none. The early Home works before the engine is listening, since the script goes itself. It also works when the engine script is in the page's head, where there is no body yet to put the console in: it waits for one (found by trying it in the Godot example).
- The loading line steps out of the way while the menu is up, where it sat over the sheet's foot, and comes back when the menu is put away.

## 0.80.0

- **"You're in, still loading"** (`controls.setLoading`, `view.loading`; the engine script's `loading(fraction, words)` and `loaded()`; Godot `Nswp.loading`; docs/backlog/game-worlds-kit-gaps.md, gap e, with names from the orchestrator). A world that takes a while to be playable can let the visitor in as soon as there is something to see, then say what it is still loading. A slim line above the bar, and in the headset console's header, shows the world's words ("Loading the arena") and how far along it is, with a line that fills. Where it can't say how far, a short light runs along the line instead. The visitor's menu, the way home and everything else work throughout. The words are plain text, one line, at most 80 characters, shown as text and never as HTML. Only the words are read out to a screen reader, not every percent. In the engine script, `loading()` still fills the crossing room's line while its doors are shut, exactly as before, and goes to the menu's line only once the visitor is in, so a page that never sends a last `loading(1)` isn't left with a stuck line. `loaded()`, or `loading(1)`, ends it. Godot has `Nswp.loading(fraction, words)`; `loading(1.0)` ends it there, since `loaded` is already Godot's signal for `load()`. The engine script's `view()` carries `loading`. Engine `VERSION` 17. Tried in a scripted Chrome by `trials/loading-line.mjs`: the Grove at a desk and a phone's width, and the Godot example.
- **How big a world says it is, for the Airlock** (core `worldDownload`, `DOWNLOAD_WARN_MB` = 50; NSWP-02, "What an Airlock does"). It reads the manifest's `budgets.initial_download_mb`, which was already parsed, and gives the words to show before the visitor crosses: "The world says about 45 MB to download". It is worded as the world's own claim, since nothing checks it. Above 50 MB (spec §10.1) it is `heavy`, and the words add "a lot on a phone's data". Where the manifest says nothing, it gives null and nothing is said. Showing it in the Airlock is BitPortal's.
- A test that no function in the Godot add-on shares a name with one of its signals. Godot then won't load the add-on's script at all, and the world doesn't start. The loading trial found this when a `func loaded()` stood beside the signal `loaded`.

## 0.79.1

- **Fixed: the gate couldn't catch a stale engine script** (`scripts/gate.mjs`; found 2026-11-22, when the bar's arrows reached the kit without the rebuilt `engines/nswp-engine.js` and the gate still passed). The gate ran `build:engine` just before `engine:check`, so the check compared what the gate had just written with itself. Now `build:engine` is not a gate step. `engine:check` builds the script, the Godot add-on's copy, the doorway's frame and the sounds into a folder of its own, and compares them with what is committed, before anything writes `engines/`. A stale committed script, or a stale add-on copy, fails the gate (tried with each). The gate is six steps.
- **The thumb buttons are styled on a site with strict rules** (`thumb-presses.ts`). Their styles were an inline `<style>`, which a strict content security policy refuses (BitPortal's `style-src 'self'`): there the sight and Fire and Reload were drawn as small unstyled text in a corner, and Fire couldn't be pressed. They now use a constructed stylesheet, as the controls do (`hud.ts`), with the `<style>` only as a fallback where a browser has no constructed stylesheets.
- **How to write a world owner's list, in vectors** (`vectors/owner-list-writing.json`; NSWP-10, "Writing one, from one change"; asked by the orchestrator for BitLogin's guest list, 2026-11-22). Eight cases, each a change on the list a writer has: a first list from none; allow; unallow; block; unblocking the last person, which still writes an empty list; a writer whose clock is behind the list it changes, so the new one is dated a second after it; a world `d` with colons in it; and the 500-name limit, refused. Each gives the exact event (tags in order, `d`, content empty), that event signed, and what `readOwnerList` reads back. The kit's own writer, `ownerListTemplate`, now puts the `p` tags in order of their keys, as a reader gives them back, so every writer makes the same note. It made them in the order given before. A writer that doesn't sort fails the `block` case.

## 0.79.0

- **A list copy with two `d` tags is passed over, now in the vectors** (`vectors/lists.json`, `choosing`: `two_d_tags_are_passed_over`; found by the BitGate session, 2026-11-22). `resolveList` already required exactly one `d`, but no vector told that apart from a reader that takes the first. Now one does: a newer, signed copy whose first `d` is the list's, with a second `d` after it, is passed over, and the older copy stands. The case fails if the reader takes the first `d`.
- **Looking up and down, and a held item's presses, on a phone and at a casual desk** (the owner, 2026-11-22: option B, "B, as recommended"). A drag now looks all ways: sideways it turns the visitor, as before, and up or down it tilts the view, within about sixty degrees (`TILT_LIMIT`), coming back level as they walk (`LEVEL_RATE`; `createDragLook`, `dragTurn`, `levelled` in `stroll.ts`). On a touch screen, while something that does something is in hand: a sight in the middle of the view, its first press as a large round button by the right thumb and its second as a smaller one (`thumb-presses.ts`; "Buttons by your left thumb" in the Bag tab moves them), the first sending along the sight. A tap on the view is then a walk, as with nothing in hand: `tap` refuses a touch, so a walk never fires. At a desk nothing changes but the tilt: a click fires where it is made, R reloads, and the bar keeps the 1 and 2 keys. Nothing is added with nothing in hand; the intense way of moving and the headset are untouched. Other engines get the thumb buttons through the same `addItemControls`, and the tilt's numbers through `NSWP.kit()` (`tiltLimit`, `levelRate`), which the Godot addon now follows. `addItemControls` also looks again a few times a second at what is held, so the bar keeps up without a world calling `refresh`.
- **The bar along the bottom slides, with arrows, when it is too wide** (the owner, 2026-11-21: "if the menu bar across the bottom grows beyond whatever screen its being seen on it should have similer side scrolling and arrows as the tabs in the menu"; `docs/backlog/bar-scrolls-when-too-wide.md`). On a phone with tabs pinned to the bar it was already wider than the screen and slid by touch, but nothing said so: a key was simply cut off at the edge. Now an arrow stands at each end, the same ‹ and › as the menu's tab row. A tap on one slides the bar along, and a mouse's wheel over it does too. An arrow with nothing more on its side is left out of sight. The arrows stand beside the keys, never over them, so neither covers a key or takes a tap meant for one. While the bar is too wide both their places are kept, so the keys don't jump sideways as one comes or goes. When the bar fits (a desk), nothing has changed. Fire and Reload still lead the bar, and taking an item up brings the bar back to its start, so they are in sight even if the visitor had slid it along. The bar's keys are now rebuilt only when something on them changes, not for any change in the menu, which had stopped a slide part way. Tried in a scripted Chrome by `trials/bar-scrolls.mjs`: the Grove at 320 and 390 wide (touch) and 1280, with four tabs pinned and the dart blaster in hand. Not tried there: a swipe along the bar. That browser's synthetic swipes move neither the bar nor the menu's tab row, which has always slid by touch.

## 0.78.1

- **A list of worlds dated in the future is left out** (NSWP-08, "Following one"; `resolveList`, `LIST_LIMITS.ahead`; found by the BitGate session, 2026-11-21). Of the copies relays give for a list's coordinate, one dated more than 600 seconds ahead of the reader's clock is dropped before choosing and named in `futureDated`, so a copy signed with a clock a year fast can't stand over every honest newer one. Exactly 600 seconds ahead is still read. The newest of the rest is the list, a tie to the smallest id. The same rule BitGate's lists keep. `vectors/lists.json` has a new `choosing` section: 600 seconds ahead read, 601 left out, a future copy beside a current one leaving the current standing, another key, a bad signature and a tie.
- **The headset console never draws one thing over another** (`console.ts`). A section with a card, buttons and many lines (a door's details: its card, Travel here, Back to every door, and thirteen lines of what it offers) had its buttons drawn over its lines, their words far too big, because the buttons' height went below nothing once the lines took the room. Now buttons have a height of their own, the lines stay the console's usual size, and what doesn't fit goes on another page, shown by a "Page 1 of 4" button beside the others (`pageLines`): a page more, never a smaller sentence. A section's note gets a fourth line before any of it is cut, and a single word longer than its button is cut rather than run past the edge.
- **Room for many sections down the console's side** (`tabLayout`). Past nine, the sections go into two columns, each tab still big enough to aim at and every one a single select away; before, eighteen in one column left each tab shorter than its icon, so the icons touched.

## 0.78.0

- **A Full screen button, and Escape in fullscreen is the menu first** (`fullscreenButton`, `escapeDoes`, `watchEscape`; the owner, 2026-11-21: "a little fullscreen button ... at the top center", and "Escape once should not exit full screen. It should pull up the menu. Escape again from the menu should exit full screen"). On a desk, while the screen isn't filled, a small "Full screen" button sits at the top centre. It is never on a touch screen or in a headset, and it goes once the screen is filled. Pressing it fills the screen and keeps that as what the visitor prefers, as the menu's control does. In fullscreen the kit holds Escape for every visitor, casual or intense, through the browser's Keyboard Lock: the first Escape brings up the menu (and gives back the pointer, moving the intense way), and Escape again with the menu open leaves fullscreen, the menu staying up. Leaving that way changes nothing about what they prefer, as the browser's own Escape doesn't. **The honest limit:** only Chromium browsers (Chrome, Brave, Edge) let a page hold Escape. In Firefox and Safari the first Escape still leaves fullscreen, as the browser insists, and the menu comes up then. In Chromium, holding Escape down for a couple of seconds always leaves, whatever the page does, so nobody is ever kept in. The menu's fullscreen control and the button have a new icon, `full` (four corners); it was the text-size icon. Holding Escape moved out of `fps.ts`, which held it only moving the intense way, into `ui/fullscreen.ts`. Tried in a scripted Chrome by `trials/fullscreen-escape.mjs`, casual and intense.
- **A jump sounds like two footsteps** (`sounds.jumped()`, `JUMP_STEPS`; the owner, 2026-11-21: "play two of our random footstep sounds back to back and slightly louder"). Two of the kit's own footsteps, each its own random shape as footsteps are, 0.09 seconds apart, each at 1.35 times a step's level (about 2.6 dB louder; the loudest is 0.61 beside any other cue, so footsteps stay the quietest sound). A world's own step sound is used where it named one, and silencing steps silences jumps. Landing is unchanged. No sound file is added. Other engines: `NSWP.jumped()`, and Godot's visitor calls `Nswp.jumped()` (it played one step); the engine script's `VERSION` is 16.

## 0.77.0

- **A world by invitation** (NSWP-01 "A world by invitation", NSWP-10 "A world's own lists", NSWP-06 "A world's own rules"). The manifest's `by_invitation` (only exactly `true`) and the owner's allow list in BitGate's shape: the gate opens only for a signed-in key the owner invited, or a keeper; someone signed out is asked to sign in; someone not invited is told so and offered nothing. Blocked beats invited. A list that isn't found, doesn't read or wasn't answered lets nobody in but a keeper. Its rooms show only invited people. Not private: only a sealed world is.
- **The eighth thing a door shows: "By invitation"** (`DOOR_OFFERS`), beside "Paid" at the foot, lit only where the announcement says `["by-invitation"]`, on the owner's word ("Yes, add it"). The tag takes no value; one after it is ignored with a warning. An envelope drawing (`invite`). `NSWP.offers` gives it to other engines.

## 0.76.0

- **How you move, asked once, and kept** (the owner, 2026-11-21: "the first time they enter VR ... ask if they prefer casual or intense mode. And then it should save that setting", and "something similer should happen the first time someone enters the game in 2D desktop mode ... Mobile is always casual"; `docs/backlog/headset-casual-and-intense.md`). A new travelling setting, `headset`: `casual` or `intense` (NSWP-11, core `cleanSettings`, the arrival schema, two vectors). The first time a visitor is in a headset with nothing said or kept, `createXrInput` asks on the console ("Casual: point to step, turn in notches" / "Intense: walk and turn smoothly with the sticks"); the first time at a desk with a mouse, `createFps` asks on the screen ("Casual: click to walk, drag to look" / "Intense: the mouse looks, keys walk"). Put away unanswered is casual. Each answer is then said through every door (the desk now keeps casual as `"0"`, not as nothing), and nothing is said until there is an answer. A touch screen is never asked and never offered intense. The headset switch reads "How you move: casual / intense". The console opens on a section when asked (`show:<section>`, as the flat menu already did), and two long buttons are one column there. A scripted browser isn't asked unless the page's address says `?ask=moving`.

## 0.75.0

- **Fixed: Home stranded a visitor holding an item whose logic was running** (`wayWithoutDestination`). The way home read at most 400 characters of settings while a world may send 900 (`SETTINGS_LINK_LIMIT`); holding the dart blaster with its script running made them 435, so the Airlock took the way home for a mistake and showed its own page with no way out. Found live by the owner, 2026-11-21.
- **A world owner can keep someone out** (NSWP-10, "A world's own lists"; NSWP-06, "A world's own rules"). The owner's block list is a signed note in BitGate's shape (kind 30078, `d` `nswp:governance:user-deny:v1:37300:<key>:<d>`), read in core (`readOwnerList`, `resolveOwnerList`) and held to BitGate's own 55 examples, copied unchanged into `vectors/governance-lists.json`. It counts only when signed by the world's own manifest's `keepers`. Someone on it is stopped at the gate ("The owner of this world has asked you not to come in"), blocked beating a receipt, and let go from every room that keeps the rule the moment their pass checks out. A keeper is never kept out. A list that can't be read stops nobody, and is asked for again soon. Anyone can read the list, by the owner's decision.
- **Two words in a world's manifest** (NSWP-01): `keepers` (one to four keys) and `named_only` (only exactly `true`: the world's rooms show only people whose pass checks out, and a guest is told to sign in before joining). Core `accessFor` gives both; `KEEPERS_MOST`.
- **Rooms take a world's rules from the page's gate** (`pageRules`; `RoomSession.setOwnerBlocked`, `namedOnly`; `presence.rulesChanged`), so a Three.js world and a world made in another engine get them with nothing to wire.
- `nswp sign-world-list <block|allow> <world> [people…] --key-file <f>` signs an owner's whole list. Publishing it is `nswp publish`, and for a real world its owner's word.
- A world's gate setting in the reference worlds is `gate` (was `paid`), on where `world.json` names `access`, `keepers` or `named_only`. The Foundry's switch is `NEEDS_GATE` (was `PAID`). No reference world says any of them.
- `trials/owner-lists.mjs`: three visitors on the stand-in relay.
- The manifest's schema no longer refuses an `access` that isn't a list, which the core takes with a warning (schemas never refuse what the core accepts).

## 0.74.1

- **One place to start** (`docs/start.md`; `docs/backlog/landing-02-get-started.md`): for someone, or some agent, who has never seen any of this: what a world is, the three ways in, the template step by step with every command run, how a world is announced (and that `--yes` is public and permanent) and checked, and where each next thing is written. A test keeps its links real and its publishing step out of the commands to copy. BitPortal shows it on a page of its own.

## 0.74.0

- **A paid world's gate in any engine** (`NSWP.gate()`, the `gate` event; in Godot `Nswp.gate()`, `gate_changed`, `gate_open()`, `gate_press()`; `docs/other-engines.md`, "A paid world's gate"). The same gate as a Three.js world's, from the kit's own script: it asks what the visitor holds, shows what is for sale, and puts `gate-buy` in the kit's menu. The engine draws the gate and stops the visitor at it. The engine script's `VERSION` is 15.
- **The Foundry can have a gate, and has none.** Its example draws a gate across the way and calls `Nswp.gate(false)`; the build stops if `PAID` in its code and its `world.json` disagree. `trials/front-room-godot.mjs` walks it against the selling service's sandbox.
- **Fixed: a gate begun before the visitor's sign-in address was named didn't notice it for five minutes** (`front-room.ts`). A world made in another engine starts its gate in that order, and a web world built on the kit has the same code, so either could have kept a visitor who held a pass at the gate for minutes. It now looks again every few seconds, ten times, and listens to the signer from the moment there is one.
- `trials/front-room-lib.mjs`: what the two front-room trials share.
- **A door's details in the menu, with "Travel here"** (SDK `addDoorControls`, `MenuDoor`, `vouchedWords`; `docs/backlog/doors-03-details-and-travel.md`). The owner, 2026-11-21: "in the menus doors need a details section like the items with this same info and a travel here button." A door is chosen from the list as an item is: its card says its name, its address in full and, where the page checked, whether its site vouches for it (in the Airlock's words); under it, what its world offers, the same twelve lines in the same words as the tiles beside the door; and one button, "Travel here", which calls the page's own way through the door, so it goes through the visitor's Airlock and every check a door does. The reference worlds' Travel tab uses it.
- **A line in the menu: something to read, not to press** (`kind: "line"` in `ui/model.ts`, drawn by `ui/hud.ts` and `console.ts`). An icon, a whole sentence and whether it is so. It never answers a press (`run` refuses it), is never focused as a button, never goes on the hotbar, and the headset console draws every sentence whole, wrapped, smaller rather than cut. General: not only for doors.

## 0.73.0

The front room: the first thing in the kit that asks a visitor to buy. No world of ours is paid.

- **A world says it is paid by naming what it is entered by** (NSWP-01, "A paid world"): `access`, the coordinates of its listings, in its announcement (`["a", "30078:<key>:<name>", "", "access"]`, one for each) and in its own manifest, inside the world's entry. A world that names none is free, exactly as before. A listing counts only where its seller is the world's own key; any other is left out with a warning. `World.access` is now a list (it was one coordinate of any kind, which nothing read); core `accessFor`, `cleanAccess`.
- **A listing can be read and shown** (NSWP-10, "A listing"; core `readListing`, `termWords`, `priceWords`; `vectors/listings.json`): its name, its price, and how long it lasts from `nswp:term`. Refused, with the first reason: signed by someone other than the seller in its coordinate, a signature that doesn't hold, not for sale, a price or a term that doesn't read, a service whose receipts the kit doesn't believe, under 500 sats, or a price divided by shares (which are still not in force).
- **The gate** (NSWP-10, "The front room"; SDK `createPaidGate`, `worldGate`, `addGateControls`), the `soft` kind only. A world puts it where it likes, and everything before it is free. It asks `signer.have` as the world loads and opens, saying nothing, on a receipt `readReceipt` believes: for one of the world's own listings, the visitor's own, not run out. Otherwise it shows what is for sale and one control, `gate-buy`, that calls `signer.buy` at their press. It fails closed and says why. Signed out, the control offers sign-in first. In a headset it says to step out.
- **A pass for a time closes the gate at its end:** a notice, two minutes, then the front room, with no page loaded again. (The owner's decision, 2 in the plan.)
- **A receipt taken back shuts the gate.** The service that signed it is asked every five minutes at most; out of reach, a receipt found good within the last day stays good (the owner's decision, 9). A paid world that draws no items is served with rules that let it reach that service by name.

- **A listing's name is one line, and a carriage return ends a line** (`cleanListing`). It let one through where the selling service refuses it. That function is the one place the rule for a listing's coordinate is written, and a test fails if the pattern is written again.
- **For a reader of the core:** `World.access` is a list of listings where it was one coordinate, and `WorldInput.access` takes either. `paidWorldReaches` says what a paid world's page may reach for the taken-back question (the issuer's address, by name), and nothing for a free one.
- **A door says "paid" only where a listing is named** (`worldOffers`). `access` is a list now, and an empty list, or one with nothing in it that is a listing, is a free world: its door says nothing of paying.
- **The Gallery can have a gate, and has none.** `paid` in a reference world's settings says where one would stand; it is made only where the world's own `world.json` names listings, and none does. A test fails if any world here is made paid. `__nswpTest.gate()` says how a gate stands, for a script, and can open nothing. `trials/front-room.mjs` walks one against the selling service's sandbox, with a stand-in for the sign-in address.

## 0.72.0

- **A door shows what its world offers: seven small tiles by its frame,** lit for what the world's announcement says and dim for what it doesn't say (`createDoorOffers`; `createPortalGate` takes `offers`). A headset, people, voice, items, saves, scores and achievements, paid to go in. Asked for by the owner on 2026-11-21: "useful icons that poll the world's features ... lit up or dark if not supported. And when the user hovers over one it should display in game text explaining what that icon means."
- **Pointed at, a tile says what it means, in the game:** in the card over the buttons on a flat screen, and in front of the door in a headset. A dim one reads "It doesn't say ...": the announcement is silent, which is not the same as the world not doing it.
- **A door never asks its destination.** A reference world's door is told what its neighbour offers by the build, from that neighbour's own settings, and the build stops if the two disagree, as it does for a door's kind of place. A world that holds its destinations' announcements may read them with `worldOffers`.
- **For other engines:** `NSWP.offers(world)` hands out the same list and drawings. The Godot doorway doesn't draw them yet.
- The reference worlds' doors light what their neighbours' settings say as soon as this is released. Their announcements on relays say less until they are signed and published again, which is the owner's word.

## 0.71.1

- **A world can say four more things about itself in its announcement:** `saves`, `scores`, `achievements` and `tips`, beside the capabilities it could already name (NSWP-01, "What a world offers"). Each is a claim, like the rest, and a client that doesn't know one ignores it.
- **`worldOffers(world)`** in the core reads an announcement into twelve plain lines: seven a door will show (a headset, people, voice, items, saves, scores and achievements, paid to go in) and five more for a door's details. A line is on only for what the announcement says in so many words; what it doesn't say reads "It doesn't say …", never "it doesn't". Nothing is drawn with it yet: the icons on a door are the next change. Asked for by the owner on 2026-11-21.
- The reference worlds' own settings now say what they really offer (voice, looks, items; and for the Arcade saves, scores and achievements). Their announcements on relays are unchanged until they are signed and published again, which is the owner's word.

## 0.71.0

- **A least distance between two doors: 2.5 metres between their middles** (`DOOR_SPACING`, beside the doorway's own sizes). Asked for by the owner on 2026-11-21: "Let's make sure there is a minimum distance separation between each door." It is what keeps two doors' frames, signs and marks from running into each other; which door a press takes is still settled by what is pointed at. `doorRow`, `doorArcStep` and `doorsOnArc` lay doors out by it, and `doorsTooClose` says which two are not. The same number is given to other engines (`doorSpacing` in `kit()`, and in the Godot addon). Every reference world already kept to it; nothing a visitor sees has moved yet. BitPortal's room, which stood its doors 1.8 metres apart, follows in its own change.
- **A Bridge test no longer depends on how busy the machine is.** It counted on six requests landing inside one second.

## 0.70.2

- **A browser that takes a door itself is handed what the visitor carries** (`window.nswp.navigate(dest, carried)`). It was handed the destination and nothing else, so a visitor crossing in such a browser would have arrived without their settings, their room, or word that they were in a headset. Found by the session building BitBrowser, before any browser existed to show it.
- **The browser's plan (`browser/spec.md`) says what a browser never contains:** no wallet, payment, receipt or share code; no signer and no key; no address with special powers; nothing that reads or shows whether something is paid for. Decided by the owner on 2026-11-21. The kit declares no identity on the bridge and looks for none.

## 0.70.1

- **Four shares at most, where it said six** (`SHARE_LIMITS.most`), the seller's among them. Asked for by BitUnlock's session before anyone built to six: each share is a payment fetched from that person's own lightning address, any one of them being down stops the whole sale, and what can go astray in a payment cut short grows with every one. Still written down and not in force.
- **Two right plans for one listing and one client** (NSWP-10, "Shares"). The selling service pays only someone who has told it, signed by their own key, where to be paid; where it can't pay the client named, that share is the seller's. Whoever checks a plan against a listing takes either answer and nothing else.

## 0.70.0

Shares: written down, tried, and not in force.

- **How a price is divided between several people** (NSWP-10, "Shares"; core `readShares`, `splitPrice`). A seller writes one `nswp:share` on a listing for each person: who (a key, or `client` for whichever client brought the buyer), how many parts in ten thousand, and a word for what it is for. Each other person is paid their parts, rounded down; the seller is paid what is left, and the selling service's charge comes out of the seller's part only. Six at most, no payment under 10 sats, smallest paid first and the seller last.
- **Nothing pays a share.** A listing is still paid to its seller whole. The owner asked for this to be built and tried and left switched off. `vectors/shares.json` holds the examples the selling service, the sign-in address and the kit are each checked against before anything is switched on.
- **The reference worlds' test hooks hand over the page's own signer** (`__nswpTest.signer()`), so a test can ask for a purchase before any control does.

## 0.69.1

- **A listing's name may be as long as BitUnlock allows** (256 characters, not beginning with a colon; it was 200). A listing with a longer name would have sold there and had its receipt refused here. Found by BitUnlock's own session reading the kit's check, which it otherwise confirmed field for field.

## 0.69.0

Tips, and the first of buying.

- **A tip, from a person's card.** Select someone who came by name, "Send … a tip", and one of three amounts (21, 100, 500 sats). The world says who and how much and nothing more (`signer.tip`): the visitor's sign-in address finds that person's lightning address in their own profile, shows the name with the address beside it, and pays at their press. Nothing is owned afterwards and nobody takes a share.
- **"Tip this world",** in Travel, where the world's own `/.well-known/nswp.json` names an address for tips (`tip`, a new field; `world.json` gains `tip`). The sign-in address reads the address from that file at the world's own address. No reference world names one yet.
- **`signer.buy(listing)` and `signer.have(listing)`** (NSWP-10, "Tips, buying, and receipts"). The sign-in address runs the purchase and keeps the receipt; a world never signs as the buyer. What comes back is checked here whatever else checked it.
- **`readReceipt`** in the core: one check of a selling service's receipt, the same for every world. Signed by a service on the kit's list (BitUnlock, by the key in its own signed policy; the list is frozen, and not a world's to add to), in the form the kit knows, for the listing asked about, the visitor's own, not run out.
- **"Your purchases, at …"** in the You tab, where the visitor's client can show the sign-in address's panel (`mode: "library"`).
- Nothing in the kit sells anything yet, and nothing treats a bare payment as a purchase.

## 0.68.0

- **"Your files, at …" in the You tab,** where the visitor's client can show the sign-in address's panel (`filesAction`): their own file browser, opened over the world (`mode: "files"`). The world sees none of it: a world is handed a file only when the visitor picks one for it. Hidden where there is no panel.
- A panel can also be asked for at the visitor's wallet (`mode: "wallet"`). Nothing in the menu asks for it yet: their account page leads there.

## 0.67.0

A world can offer a file to be saved, and ask to be handed one.

- **`signer.saveFile({ name, type, bytes, private })`** offers the visitor a file to keep among their own files, which their sign-in address keeps on servers they chose. They are shown where it would go and it is saved only at their press there (NSWP-10, "Asking the person": `file-save`, `file-saved`). Private, sealed so only they can read it, unless the world says otherwise.
- **`signer.pickFile()`** asks them to hand this world one of their files: they browse their own, choose, and say yes (`file-pick`, `file`).
- **A world gets two dialogs and nothing else.** It can't list their files, can't save without a press, and reads back what it saved only by asking.
- **What crosses is tidied on the way** (`files.ts` in the core): a name with no path and nothing unseen in it, a type that is only a media type, bytes up to 25 MB, and an address passed on only for a public file and only when the hash in it is those bytes' own.
- Nothing in the reference worlds saves or asks for a file yet.

## 0.66.0

Deleting your own post, from inside a world.

- **Each of your posts in "My public feed" has a Delete.** A deletion is a careful kind, so the world's signer signs none on a world's word: it is put to you at your sign-in address (`signer.propose`, the first use of "Asking the person"), which shows what it is, in its panel where your client has one. On your yes the world checks what came back, sends it to the relays your posts go to, and takes the post out of the list. On your no nothing is sent and the post stays.
- **It says what a deletion is worth.** "Deleted: 3 relays were asked to drop it. A copy kept somewhere else may remain." And where you write, "it can't be taken back" is now "deleting it later only asks relays to drop it: copies may remain".
- `FeedOptions.remove`, `UiFeed.remove`, `FeedView.removable`, and `RoomNotes.propose` for a client's own room. With no `propose` there is no Delete.
- Not in a headset: the page that asks you can't be seen from in one, and the post says so.

## 0.65.0

A world can ask to be paid.

- **`signer.pay(invoice)`** asks the visitor to pay a Lightning invoice the world made, on their sign-in address's own page, like `propose` and `wallet` (NSWP-10, "Asking the person": `pay`, `paid`). The sign-in address shows the amount and pays at the visitor's press; the world learns that it was paid and nothing about their wallet.
- **A payment's proof is checked.** `paid` may carry a preimage; the kit says whether it really is this invoice's (`proven`). New in the core: `cleanInvoice`, `invoicePaymentHash`, `provesPayment` (`invoice.ts`), which read a BOLT 11 invoice only as far as its payment hash, and are tested against the specification's own examples.
- Nothing in the reference worlds asks for a payment yet.

## 0.64.0

Asking the person: careful kinds and a wallet, put to the visitor on their sign-in address's own page.

- **`signer.propose(note)`** puts a profile (kind 0), a deletion (5) or a relay list (10002) to the visitor themselves. The signer signs none of these on a world's word and still doesn't: it answers `asking`, the world has the sign-in address's page shown (its panel in a client that has one, its window otherwise), and the note is signed only at the visitor's press there. What comes back is checked: signed by who is signed in here, exactly what was put to them, marked for this world.
- **`signer.wallet()`** asks for a wallet connection for this world the same way, and resolves with a Nostr Wallet Connect address or null.
- New words in NSWP-10 ("Asking the person"): `propose`, `wallet`, `asking`. `PROPOSE_KINDS` is a closed list, and who someone follows is not on it.
- Nothing in the reference worlds uses either yet. BitLogin's half is built and not yet live; a signer that doesn't know these says nothing, and both resolve null after a few seconds.

## 0.63.1

- **"Your account, at …" in the You tab,** where the visitor's client can show the sign-in address's panel (`accountAction`). It asks the client for the panel at the account's own pages (`mode: "account"`): other accounts, the lock, the password, recovery. Hidden where there is no panel: a world shows none of that itself.
- **The words about signing in are true either way.** "In a window of its own" is no longer said where it may be a panel: "Signing in is done by bitlogin.network, which asks you itself: this world never sees a password."

## 0.63.0

Signing in without a window, in a client that keeps the screen.

- **A world in its client's frame asks the client for the sign-in address's panel** (`client-frame.ts`, `signer.unlock()`). A window opening gives up a filled screen, so signing in threw a visitor out of fullscreen at every new world. Where the client says it can show the sign-in address's own panel over the world (`signIn` in its answer about the screen), and that is this world's own signer's address, the world asks for it at the visitor's press (`{ nswp: "sign-in", mode, menu }`) and opens no window. Everything that used to open the window goes this way: the Sign in row, a post, "this world needs your say" for following and messages.
- **`signer.panel`** says whether `unlock()` will show a panel rather than a window, so the words are right ("bitlogin.network is asking, here").
- **The menu steps aside for the panel and comes back** (`ui/hud.ts`). It says where it is, so the client can draw the panel in its place, closes while the panel is up, and opens again at the same tab when the panel goes.
- **The window is the fallback, as before:** outside a frame, in a client with no panel, for a signer at another address, and for the rest of a page once a panel failed to come up (said in the world: "Press that again, and a window opens instead").
- The world never frames the panel and never sees into it: whether the visitor said yes is asked of its own signer, as it always was (NSWP-10, "The window, and a panel in its place").

## 0.62.0

A world in its client's frame asks the client for the screen.

- **The Fullscreen control works in a world shown inside a client** (`client-frame.ts`). A world in a frame can't fill the screen itself, and in 0.61.0 its control simply wasn't there. It now asks the page above it, at the visitor's press, and that page says back whether the screen is filled: so the same control, the same words and the same preference decide, in a frame as anywhere. A visitor who prefers a filled screen has it at their first press, as before.
- **A world says it came up** (`{ nswp: "here" }`), as it loads. A client that shows worlds in a frame can then go to one the ordinary way if it doesn't come up there, and knows where to come back to.
- Outside a frame none of this does anything: a world opened as a page of its own is exactly as it was.

## 0.61.0

A trial of a filled screen that stays filled from world to world.

- **A reference world may be framed by the client it sends its visitors through,** and by nobody else (`frame-ancestors 'self' <the client>`; it was `'self'`). That is what lets a client keep one page on the screen and show each world inside it, so a filled screen is not given up at every door (protocol/02-doors.md, "A client that keeps the screen"). BitPortal tries it at `/shell/`. A trial, for the reference worlds: nothing else about a crossing changes, and a world opened the ordinary way is as it was.
- **An item's locked box starts in a world that is shown in such a frame** (`itemBoxCsp(client)`). A page says who may be above it all the way up, and the box named only its own world: inside a client's frame it would have been refused, and items would have been shapes there. A world that lets its client frame it serves the box letting that one client be above it too. What the box may reach is unchanged: nothing.
- **A browser made for this is asked to take a door before a headset session is ended** (`window.nswp.navigate` in `portal.go`). The session was ended first, which took from such a browser the managing of it.
- **The Foundry's room may use a microphone.** Its page still said nobody's could be used there, from before a world made with Godot had rooms.
- The local server names local copies beside real addresses in what a page may hand on to the sites it frames, as it does in a page's content rules.

## 0.60.0

What is in your hand goes with you, and a blaster with more to it.

- **What a visitor holds goes through a door with them.** It is one of the settings that travel (`holding`): the item, the colours they chose, and the hash of its script if it was running. Since a link can be written by anyone, the thing is taken in hand on arriving only if it is in the visitor's own signed bag, and its logic runs unasked only if it is the very script the link names. Put away by their own hand, it stays away. A site also keeps what its visitor last held there (`nswp:holding`), so it is in their hand when they come back.
- **A thing's card holds what there is to do with it.** In the Bag tab, taking it in hand or putting it away, what it does, its colours and its details sit beside its picture, where the card was empty (`UiCard.acts`). On a narrow screen they go under it.
- **A pose stays** (`isPose`): an animation whose name begins `pose` leaves the thing as it ended, until another pose is played. Anything else is a moment, played over the pose. In a world made with Godot too.
- **A little spread:** `item.send(name, { spread })` throws what is sent out off its aim by up to that many radians, at random. Worked out once and told to the room as where it went, so everyone sees the same flight.
- **The other mouse button aims and stays aimed:** pressed again, the sight comes down. It used to have to be held.
- **What is in the hand sways with the visitor's steps,** a little, in pace with their footsteps. It moves no shot: where a thing is aimed is worked out from the view. Not while aiming along it, in a headset, or with motion off (`presence.heldBob`, for another engine to add).
- **The dart blaster:** its darts go nearly three times as far (as fast as the kit lets anything be sent), no two quite the same way, and its magazine holds the five it fires: each shot takes the top one and pushes the rest up a place, and a reload fills it. Its model and script are new, so it is signed again; the old files are kept for the bags that name them.
- An item's script may ask for eight animations a second, where it was four: a shot and a reload together are three.
- Settings on a link may be 900 characters, where they were 400: what is held is an address and a hash.

## 0.59.2

- **A page that finds it has been updated asks for itself afresh before it loads again** (`reloadAfresh`). A plain reload keeps the headers a browser first had with a page whose HTML hasn't changed, its content rules among them; asking for the page outright replaces that copy, so the page that then loads is under the rules its site sends today. With the mark every page now carries (0.59.1), a change to a site's rules reaches returning visitors either way.
- **Catching a lantern in the Arcade is heard:** the kit's own sound for taking hold of something. A reference world's scene can play one of the kit's sounds for a moment of its own (`kit.sound`), at the visitor's own volume.

## 0.59.1

Items that load every time, and a menu the arrow keys go along.

- **Returning visitors were kept under a world's old content rules, and so couldn't fetch items.** A host says "not modified" for a page whose HTML hasn't changed, and a browser then goes on using the headers it first kept with that page. 0.58.0 let every world fetch what visitors carry by changing a header and nothing else: so anyone who had been to a world before went on being refused, however often they reloaded, while a browser that had never been there was fine. Seen on the live sites in the owner's own browser. Every page a build writes is now marked with the kit and with everything it is served with (`stampPage`), so a page changes whenever its rules do. This release's pages differ from the last, which puts right everyone caught by it.
- **Nothing that failed to load is remembered as gone.** A model, sound or script that didn't come was kept as missing for the rest of the visit: a plain frame in the hand, a letter in the bag. It is asked for again a few seconds later, and a picture that can then be drawn is. A file that came and failed its check is still refused for good. A fetch is no longer waited on for ever.
- **The Bag tab follows what is in the hand.** After Put away it went on offering Put away, and said "You are holding nothing" at each press. It now changes with what is held, however that changed.
- **Taking something in hand says so while it happens,** and holds are done one at a time, in the order asked: a second press made while the first was still fetching could leave the tab and the hand disagreeing.
- **Left and right go along the menu's tabs,** from anywhere in the menu that has no use of its own for them. Home and End go to the first and last. The Tab key stops once on the strip, at the tab that is up.
- **The wheel slides the tabs from anywhere on the strip,** the arrows at its ends included.

## 0.59.0

A world must have the picture its doors show, and a world made with Godot can take one.

- **A world's 360° picture is required** (decided by the owner): a `pano` for a place that can be stood in, or a `flat` for a place that is only a web page. `nswp sign-world` won't sign an announcement without it (`doorPictureOwed`), and the reference worlds won't build without one. A reader still refuses nobody: a world made before this, or a site that never announced itself, is drawn with the placeholder as before.
- **A world made with another engine can take its picture.** From its page, `await NSWP.capturePreview(2048)`. The engine takes six square views from where a visitor arrives and the kit paints them into one picture (`NSWP.previewViews`, `NSWP.previewFaces`). The Godot addon does its part by itself, leaving out other people and whatever anyone carries (`Nswp.NOT_IN_PREVIEW_GROUP`, `preview_taking`).
- **One painting for every picture.** What turned six views into a panorama was inside `capturePanorama`; it is now `paintPanorama` (`panorama.ts`), used by a Three.js world's capture and by another engine's alike.
- **The Foundry has its picture,** so a door to it shows the place. Its announcement names it and has to be signed and published again.
- `npm run previews -- --only <name>` takes only the named worlds' pictures and leaves every other hash as it is.

## 0.58.0

Items in every world, and one press anywhere to go back into a headset.

- **A world has items unless it turns them off.** A world that says nothing about items now lets them work (`allowed`), where it used to have none: decided by the owner. A world turns them off by saying `"items": "none"`, which its announcement now carries as an `items` tag. A rule nobody knows is still read as `none`, never as allowed. So every reference world, the template and a world made with Godot draw what visitors hold with nothing added to them.
- **What that changes for a world's page:** a world that draws items fetches their files from wherever their makers keep them, so its page may reach any `https` address (each file is checked against its hash before it is used), and it serves the locked box an item's logic runs in. That was so for the Grove and the Foundry, and is now so for every world that hasn't said `none`.
- **A door says only what isn't ordinary.** "Items are part of play here", as before; "No items here" for a place that turned them off; nothing for a place that only allows them. It used to say "Items work here".
- **A presence with no item store has no items** (`createPresence` without `items`): its rule reads `none` whatever is said or left unsaid, since nothing could be drawn. So a place built without one, like BitPortal's home, is as it was.
- **A world that can't draw items should say so.** One built from the kit's parts without an item store, or a Godot world without `NswpItems`, draws nothing carried whatever its announcement says. `"items": "none"` keeps its doors honest.
- **After a door, a press anywhere takes a visitor back into VR.** A browser ends a headset session when the page changes and starts one only on a press, and none hands a session from one site to the next: that can't be changed from a page. What was asked was to aim a controller at one button on the browser's flat panel. Now the whole page is the button: a press anywhere on it, with a controller, a hand, a finger or any key. "Look around on this screen" is the one other thing there. (`ui/headset.ts`)
- **The same in a world made with Godot,** which only said where the control was.
- **A headset browser's own Enter VR control is given the world to start,** where it has one (`offerSession`): so there is a way in that is in the same place in every world.
- **A browser that does carry a session over is heard from the moment the page loads.** The kit listened only once the world was built, which is after a browser says it.
- The press that goes back into a headset is not also taken to fill the screen: a browser gives one press to one thing.

Not tried in a headset: none of the above. It was built against what browsers document and what the Quest's is reported to do.

## 0.57.1

- **A thing whose model can't be fetched has no picture in the bag,** and is shown by its first letter and its name. It was shown as a bare wire frame of its size, which is what a world draws in a model's place and is no picture of anything.

## 0.57.0

A better bag, and a larger menu.

- **A bag shows the things in it:** each item drawn from its own model, side by side (`kind: "tile"` in the controls model; `item-preview.ts`). Nobody makes a thumbnail, and what is shown is what would be in the hand, in the holder's colours. The page draws them, so the bag is the same in a world made with Three.js and in one made with Godot.
- **The thing chosen is at the head of the tab, large and turning, with Hold straight under it.** Before, choosing a thing put its Hold button third in a list under two rows of housekeeping, and on a phone that was out of sight: it looked as though choosing did nothing. Housekeeping (the switch, Look again, putting one in) is last now. The tab opens on whatever is in hand.
- **Where a thing can't be held, the tab says so where the button would be, and why:** "Can't be held here: The Gallery doesn't have items". Before, there was no button and no reason.
- **An item with logic of its own says so on the button:** the second press, which lets it run, reads "Let it run, and hold…". The words that explain it used to be only in a line at the side that a phone's menu covered.
- **The menu is larger at a desk:** 780 wide where there is room, up to three quarters of the height, with rows two abreast. On a phone it is a little taller.
- Rows are drawn in the order they are added, and swatches or tiles that come together are one strip or grid where they were put.
- **A tap's aim belongs to the press, not to a moment.** 0.56.0 timed it on the clock, a second and a half; with the page under more load that still ran out, and the thing went to the middle of the view. Now the next thing the item sends out takes the aim, and the next press of any kind replaces it.
- The engine script is larger again (about 2.3 MB before the server squeezes it): it carries a renderer for the bag's pictures.

## 0.56.0

Items between people, in a world made with another engine. And two faults found on the way, fixed for every world.

- **In a Godot world's room, items work between people:** what someone holds is seen in their hand, in their colours; what it sends out is seen by everyone and lands in the same place for each; a hit counts, with the mark for whoever sent it, health for whoever it reached, and a bar over their head for the others; one person's items can be muted. The engine's items now go through the same presence a Three.js world's do (`engine-presence.ts`), so none of this is new code: it is the code that was there.
- **A dart sent from close by reached its target twice.** A thing is said to a room twice, 90 milliseconds apart, because the channel doesn't try again. One sent from under about two metres had arrived and gone before the second saying, which then counted as a new thing: two hits, and two of someone's health, for one dart. In every world since 0.53.0. Each thing is now remembered by its sender and number for as long as a second saying could come.
- **On a device drawing few frames a second, a tap sent its thing to the middle of the view** and not where it was pressed. How long a tap's aim lasts was counted in frames while the item's own logic answers from its locked box in real time. It is counted on the clock now.
- **An engine is given a long frame's flight as the curve it was** (`via` in a thing's `test`): the places it passed, a few hundredths of a second apart. Tested as one straight line, a thing landed a third of a metre from where the others saw it land, on a device drawing five frames a second.
- `NSWP.itemsInfo()`, for tests.

## 0.55.0

Other people, in a world made with another engine.

- **A world made with Godot has a room** (`NswpPeople` in the addon; `NSWP.people`, `figure` and `board` in the engine script; [docs/other-engines.md](docs/other-engines.md), "Other people"). Join from the bar, and whoever else is there is seen and heard: the kit's own figure for each, their name, what they write over their head and in chat, their voice from where they stand, the list of people and a card for each, muting and blocking. Two people who arrive in the same spot step apart.
- **None of it is written twice.** The code that keeps track of people in a Three.js world now also says what it is drawing (`drawn()` on a presence), and runs unchanged for an engine on a scene with nothing in it to draw. The engine is handed each figure as shapes and each flat thing (a name, a picture, written words) as a picture, and draws them.
- **One call a frame for everything** (`NSWP.frame`, now in `engine-world.ts`): items and people each add their share. In Godot any number of nodes may ask in a frame, and the page is asked once.
- **The kit's metal for Godot can thin out** (`opacity` in `gate/alloy.gdshader`), so someone standing very close never fills the view.
- `three.ts` is three files: people (`presence.ts`), the room's part of the menu (`room-controls.ts`, which asks a presence and never a renderer), and the rest. Everything it exported, it still exports.
- Not in Godot yet: what other people hold and send out, a screen someone shares, and any of this in a headset.

## 0.54.1

One sign-in, however you came.

- **A world opened by its own address now offers the same sign-in as one reached through a door** (`configure({ defaultSigner })`; `signer` in `NSWP.start`; `nswp/signer` in a Godot project). Until now the row "Sign in, at bitlogin.network" was there only for someone who had come through a client's door in that same tab. Anyone who opened a world from a bookmark, a shared link or a phone's home screen got the older row instead, "You are a guest here. Sign in", which took them by the crossing's room to their client's sign-in page, asked them to open the sign-in window there, and brought them back still a guest in the world, to be asked again. That was found on the live sites, in every world, on 2026-11-20, after the owner couldn't sign in on a phone.
- The reference worlds and the Foundry name BitLogin's. A visitor a client brought still signs in where that client says, and a client that names no signer keeps its own way.
- A world opened directly no longer loads a signer page from beside its Airlock that isn't there (it was a 404 at the reference client).

## 0.54.0

Items in a world made with another engine, and one item for every world.

- **Items work in a world made with Godot** (`NswpItems` in the addon; `NSWP.items`, `frame`, `model`, `itemTap`, `itemUse` and `itemSecond` in the engine script; [docs/other-engines.md](docs/other-engines.md)). The Bag tab, taking something in hand, its locked box, the blaster's darts with their arc and trail, sticking and letting go, the counter, a holder's colours, a tap or click that fires where it was pressed, and aiming along the sight. Everything that isn't drawing is the same code a Three.js world runs: the engine draws, and says what a dart ran into. A dart sticks to anything with a collision shape.
- **For one visitor by themself, for now.** A world made with Godot has no rooms yet, so nothing reaches anyone there and nobody sees what is held. Hits, health between people and muting come with rooms.
- **One reader for every model** (`readGlb`, `measureGlb` and `MODEL_BUDGET` in core): a model is read, checked and counted before any engine is handed it, and one that names a file outside itself is refused. A material named `tint_<slot>` is a holder's colour as well as `tint:<slot>`, because some tools won't write a colon in a name.
- **`nswp make-item thing.glb --title … --host …`:** describes an item from a model made in any tool. It reads the file as every world will, measures it, finds the colours it leaves to its holder, names it by its hash, and says plainly why a model that wouldn't be drawn wouldn't.
- **Making an item in Godot:** `addons/nswp/nswp_item_model.gd` writes any scene out as the one file an item's model is. Made there, held in a Three.js world, and seen by someone else there in its holder's colour: there is nothing to convert.
- The Foundry says its visitors' items are allowed, and serves the locked box. Its announcement is signed again; not published.
- The engine script is larger (about 1.4 MB before the server squeezes it), since the flight of a dart is the kit's own.

## 0.53.0

How the blaster feels, and how someone is shown.

- **Health, shown the kit's way:** a pill in the look of the kit's other controls and the world's own colour, low in the view, with a block for each of what someone has and the next one filling as it comes back. The edge of the view reddens for a moment when something reaches them. With none left their view breaks up, their figure blinks to the others, and it says "Tagged out" until it is back. Nothing flashes in a headset, or for anyone who asked for stillness.
- **Health comes back one at a time:** after four seconds with nothing reaching them, one each second. With none left, nothing more reaches them for three seconds, then all of it is back. Nobody dies, is moved or made to watch unless a world's rules say so.
- **A tap or a click fires where it was pressed** (`tap` on `addItemControls`; `use(toward)` on play). A press held is still how they walk. So a blaster that reloads on a press when empty is reloaded by a tap.
- **Aiming along a sight** (`aim` in an item's description; `setSighting` on a presence): moving the intense way at a desk, the other mouse button brings the item up to the eye and narrows the view by what the item asks, never below a little under half. The look slows by the same share.
- **The blaster has a real sight:** an upright frame with clear glass and a ring and dot of light, in the dart's colour.
- **What is held sits where a hand would hold it:** sized to about a third of the view, to the right and clear of the bar; smaller and above the bar on a screen taller than it is wide.
- **Darts, hits, health and colours are said twice** in a room, because its channel doesn't try again. A reader takes the first.
- The blaster is signed again. Still never published.

## 0.52.0

The blaster, as it was meant to look, and in your own colours.

- **A new dart blaster:** a rounded toy of cream plastic with a coloured rear, muzzle ring and magazine, a raked grip, a flip-up sight, a chamber that glows, and a clear magazine with darts in it. Still made in code ([`scripts/blaster-model.mjs`](scripts/blaster-model.mjs)): rounded slabs, tubes and marks, shaded as round, with see-through and glowing parts. No picture is painted on it: its stripes and panels are shapes.
- **A holder's own colours** ([NSWP-17](protocol/17-items.md)): an item may leave some of its colours to whoever holds it (`tint` in its description; `tint:<name>` materials in its models). The blaster leaves two: its accent, and its darts with everything on it that glows. Chosen in the Bag tab from a short list; the room is told, and sees the item, its darts and their trails in those colours. Written into the bag at the visitor's own client, so the choice goes to every world. `applyTints`, `cleanTints`, `tintBag`, `bagTints`; `setTints` on a presence.
- **Darts glow, and leave a trail:** a streak of light that follows the arc the dart flew (`trail` on a thing sent out), bright at the dart and fading behind it, in the dart's colour. The kit draws it: an item can't say how wide or how bright.
- The blaster is signed again with its new shapes. It has still never been published.

## 0.51.1

- **The dart blaster has its sounds,** the owner's picks by ear: nine files in [`sites/items/sounds`](sites/items/sounds), with how each was made and its licence beside them. With them it is no longer a draft: it is described with the other starter items and signed.
- **A sound may have more takes than one** (`impact`, `impact-2`): one is played each time, and not the same twice running.
- The held item sits higher on a screen taller than it is wide, clear of the bar.
- **Fixed: putting one scripted item away and taking up another could leave the new one dead,** when the old one's box ended a moment late and was taken for the new one's. Each box now answers only for the item it was made for.
- **Fixed: a busy device could be taken for a hung script.** A script is ended only after three seconds of silence seen twice, with a turn between for its waiting answers to be read.

## 0.51.0

Items that do something: a dart blaster, drafted, and everything it needs.

- **An item's own logic runs in a locked box** ([NSWP-17](protocol/17-items.md)): a page of its own (`item-box.html`, `ITEM_BOX_HTML` in the core) that may reach nothing, framed with no rights but to run script, with the script in a worker that is ended if it stops answering. Only on the device of whoever carries the item. `runInBox`; `itemScripts` on a presence. A visitor is told an item has a script, and who made it, the first time they hold it.
- **What a script may ask for is a closed list,** each with a ceiling: play one of its own sounds, play one of its own animations, send out one of the things it described, show a few words. `cleanAsk`, `ITEM_ASKS`.
- **Things sent out fly on an arc,** the same on every device: straight on and falling, so aimed higher they go further. They stick to any solid mesh of the world, let go after their time, drop and are gone. Nothing of a world has to be an item. `shotAt`, `createPlay`; a world can say what isn't solid and be told what was struck.
- **A person is reached only if their own device says so** (`hit`). Whoever sent it gets a mark and a sound when they do. Nobody can say they were reached by something that never flew.
- **Health, where a world has no rule of its own:** five, back by itself after a rest. A bar for the person and over their head for the others.
- **Mute one person's items,** on their card, in a place that only allows items: none of it reaches you, or is seen or heard. Not offered where items are the game.
- **An item's own sounds** (`sound` tags): fetched and checked like its model, levelled, played from where they happen, quieter and duller with distance, silent beyond 45 m.
- **An item says more of itself:** `sound`, `sends`, `effect`, `does` in its description.
- **The two presses on every device** (`addItemControls`): they lead the bar while the item is in hand (a tap on a phone, keys 1 and 2 at a desk), the mouse button and R at a desk, the trigger of the holding hand in a headset. In a headset the item is in that hand, and a thing leaves the way it points.
- **A dart blaster is drafted** in `sites/items/drafts.json`: its model with a reload animation, its dart and its script. It is signed by nobody: its sounds are the owner's to pick by ear first.
- The held item is placed by the shape of the screen, so it is in view on a tall narrow one.
- **Not built:** the same for a world drawn by another engine (The Foundry); a ceiling of the visitor's own for items; granted items. **Not tested:** any headset.

## 0.50.0

Five things to carry, and somewhere to carry them.

- **Starter items** ([`sites/items`](sites/items)): a brass lantern, an old book, a tin mug, a lantern-tree seedling and a paper pinwheel. Each is made in code by `scripts/make-items.mjs` (boxes and prisms, so the same script gives the same bytes), named by its hash, and described in a note signed by the reference publisher. A test holds what is signed to what is served.
- **The Grove draws what its visitors hold** (`"items": "allowed"`), and keeps the starter items' files at `/items/<sha256>.glb`, served for any world to fetch. Its page may reach any https address for the models other makers keep elsewhere; the other worlds still reach only themselves and relays. The build checks a world's code, its `world.json` and `sites.json` say the same about items.
- **`nswp sign-item`:** sign an item's description, or a list of them.
- **A place that can change a bag may offer a few items** to put in with one press (`offered` on `addBagControls`): a client's starter items. Nothing is offered where the bag can't be changed, so never in a world.
- The Grove's announcement is signed again with `items`. **Neither it nor the items are published until the owner says.**

## 0.49.1

- **"Items: off" goes with a visitor from world to world.** It was kept by each site apart, so someone who turned items off in one world had them back on in the next. It is now one of the settings that travel ([NSWP-11](protocol/11-the-visitors-console.md)): `items`.

## 0.49.0

A bag, and something in your hand.

- **A visitor's bag** ([NSWP-17](protocol/17-items.md), kind 37308): the items they have, by coordinate, in one public note of their own. Changed as a follow list is: from the newest found, one item at a time, nothing when no relay could be reached. `changeBag`, `bagIn`, `newestBag` in the core; `createBag` in the kit.
- **A Bag tab in the menu every world has:** look through it, take one thing in hand, put it away. A world looks through its visitor's bag and can't change it: that is done at their own client, which can put in an item by its copied address.
- **Holding one item,** seen by everyone in the room. A visitor says only the item's coordinate; each person who sees them fetches the description (really signed by its maker) and the model (checked against its hash, then counted) for themselves. `createItems`; `setHolding` on a room and on presence.
- **Where a file is missing, too big, or not what its description promised, a plain marker of the item's size is drawn.**
- **The visitor's switch for all items:** off, nothing of anyone's is fetched, drawn or run for them. `showsItems`, `setShowsItems`.
- **A world that draws items may fetch from any https address,** because a model is wherever its maker keeps it; a world with none reaches only itself and relays, as before. The build checks a world's rule for items against its own announcement.
- No reference world has turned items on. `?items=allowed` tries it on a copy on the maker's own network, and does nothing on a published world.
- The Bag tab offers to hold a thing only where it would be drawn.
- **Not built:** an item's own logic; items reaching other people; muting one person's items; granted items; a world giving an item.

## 0.48.0

Items: the rules, and the first of the building.

- **[NSWP-17](protocol/17-items.md): items,** as the owner decided on 2026-11-20. An item never touches another person's device or account: what it does of its own runs only for the person carrying it. A world has the last word on what anything an item did means. Where a world lets items work, the people in it are part of its game. And a visitor is told before they go in, and may mute items where they are not what the place is for. Most of it is the agreed design, to be built in the order the document gives.
- **Built: an item's description** (kind 37303): what a thing is, signed by its maker, with every file named by its hash. `buildItem`, `parseItem` in the core; `vectors/items.json`.
- **Built: what a world does with items:** an `items` tag in its announcement, `allowed` or `play`; saying nothing is none. `ITEM_RULES`, `cleanItemsRule`, `itemsWords`.
- **Built: the warning on a door.** A door to a place where items are part of play says so on its sign (`setItems`).
- Nothing carried is drawn, held or run anywhere yet.

## 0.47.0

- **Ratings on a world's own doors** ([NSWP-13](protocol/13-ratings.md), "On a world's own doors"): a door's sign can say what the people its visitor follows thought of where it leads, "★ 4.5 from 3". The visitor's own rating always counts; the people they follow do where the visitor has let that world see who they follow. Asked of relays by world; nothing for a guest. `createDoorRatings` in the kit, `setRating` on a door, `tallyMark` in the core. The reference worlds do it, and say it in full when a door is pointed at. Optional.
- Giving a rating is unchanged: at the visitor's own client, never from inside a world.

## 0.46.0

What someone has done, on their card.

- **A person's card says where they stand and what they show** ([NSWP-15](protocol/15-scores.md), [NSWP-16](protocol/16-achievements.md), "On a person's card"): in People and in Following, for a world that keeps score or marks achievements. "Lantern Run: 41.2 s, 2nd of 14 here". It comes from the world's own boards, asked of relays by world: no relay is asked about the person. `worldPersonLines` in the kit; `about` on `addRoomControls`. Optional.
- **A score says what its board is called and how it counts,** so that it can be shown where the world isn't: `["board", id, title]` and `["score", n, "time"]`. The `score` message to the signer may carry `title` and `format`. One that says neither is a plain number, as before. `parseScore` gives `title` and `format`.
- `scores.standingOf(board, pubkey)` and `achievements.heldBy(pubkey)`, from what was last read.
- The reference worlds do it, so the Arcade's cards say both.
- **The relay backup tries up to three rounds of found relays when sending,** where it tried one. A monitor finding a relay open says little about whether it takes a note from a key it doesn't know: probed by the BitLogin session on 2026-11-20, most of the relays monitors listed as open refused one, and some that took a note had dropped it within minutes. The backup remains a last resort and no promise.

## 0.45.0

Achievements, for a world that has them. Optional throughout, and built the way scores are.

- **Something a visitor did that a world marks** ([NSWP-16](protocol/16-achievements.md), kind 37307): kept on their device as they earn it, and shown as theirs, signed by their own key, only when they say to. One note for each person for each achievement of a world, carrying what the world called it. `buildAchievement`, `parseAchievement`, `achievementsIn` in the core; `vectors/achievements.json`.
- **It counts only if it was asked for at the world itself,** by the signer's mark, as a score does. One more message to the signer (`achieve`); the signer writes the note (`achievementForWorld`). `sign` still refuses the kind.
- **In the kit:** `createAchievements` (`earn`, `show`, `holders`) and `addAchievementControls`, an Achievements tab: what the world marks, which of it the visitor has earned, the way to show it, and how many others show each, with the ones they follow counted apart. A hidden achievement isn't named until it is earned.
- **The Arcade has four,** one of them hidden.
- **Not built yet:** BitLogin's signer doesn't answer `achieve`. Achievements granted by a service a reader trusts (NIP-58 badges), and achievements on a person's card.

## 0.44.0

Scores, for a world that keeps them. Optional throughout: a world that names no boards has none of this.

- **A score a visitor made in a world** ([NSWP-15](protocol/15-scores.md), kind 37306): signed by their own key, one for each person on each of a world's boards, replaced when they do better. Posted only when they say to. `buildScore`, `parseScore`, `rankScores`, `scoreWords` in the core; `vectors/scores.json`.
- **It counts on a board only if it was asked for at the world itself:** the visitor's signer marks what it signs with the site that asked, so another site can't post to a world's board. One more message to the signer (`score`); the signer writes the note (`scoreForWorld`). `sign` still refuses the kind.
- **A board lists the people a reader has reason to know first,** then everyone else, a few at most. Every score is a claim, and the kit says so: nothing checks one yet.
- **In the kit:** `createScores` (a visitor's best, kept on the device; `record`, `post`, `standings`) and `addScoreControls`, a Scores tab with the way to post and who else is on the board. Choosing someone on a board shows who they are, in Following.
- **The Arcade keeps a board:** the fastest Lantern Run.
- **Not built yet:** BitLogin's signer doesn't answer `score`, so until it does a best stays on the device. Checked scores, boards on a world's door, and boards across worlds.

## 0.43.1

- **The relay backup never stands in for relays that were never named,** and is not used outside a browser unless the caller hands in what does the asking or sending. A call that names no relays sends nowhere, as it always did. Found the hard way: a unit test of BitPortal's, which sends a rating to an empty list of relays, reached the backup and published a made-up rating to two real relays.

## 0.43.0

A backup for relays.

- **When a person's own relays and the usual ones all fail, relays that monitors have found working are tried** (NIP-66, kind 30166; owner's ask: "so there is always a backup"). Asked for only then, once a day at most, and kept on the device. A relay is taken only where at least two monitors found it open to anyone lately: one monitor is never believed alone, as the NIP asks, and nothing depends on any of them. `readRelayFinding`, `pickDiscovered`, `DISCOVERY_RELAYS` in the core; `foundRelays`, `relayBackup` in the kit.
- **Everywhere the kit sends or asks** (`sendWell`, `askWell`: posts, saves, follow lists, profiles, relay lists) has it behind it. `queryBacked` and `publishBacked`, from `nswp-sdk/ui`, are called as the core's `queryRelays` and `publishEvent` are, for a page that calls relays itself.
- **Never for a private message.** A wrapped message goes where its reader said their messages reach them, and nowhere else.
- **Where a visitor's messages should reach them:** the relays offered now leave out any a monitor found asks a reader to prove who they are, or to pay, and are made up from ones found open. A relay that hands messages only to someone who has proved who they are is no use to a client that doesn't.
- `relayBackup(false)` turns it off for a page.

## 0.42.2

- **A signer may say what it offers** ([NSWP-10](protocol/10-identity.md), "Asking for more"): `offers` in its `state`, the names it has a question for. Where one is missing, a world built with the kit tells its visitor so and opens no window, where it used to open one that said nothing of it. A signer that doesn't say is asked as before. `offers` on the kit's `worldSigner()`.

## 0.42.1

- A visitor's messages are looked for as soon as it is known who is signed in. They waited a minute where the sign-in answered after the page had loaded, which is most of the time.

## 0.42.0

Private messages, in every world and at the visitor's home.

- **A Messages tab in the menu every world has** ([NSWP-14](protocol/14-people-and-messages.md)): the visitor's private messages (NIP-17), people they follow first and requests from anyone else apart. A conversation is on a panel of its own: a third side of the panel that has the room's chat and the public feed on a flat screen, and a panel in the world in a headset. "Write to them, privately" on a person's card and in Following. `addMessagingControls`, `createMessages` in the kit; `controls.letters`.
- **A world may be let send and read its visitor's messages** ([NSWP-10](protocol/10-identity.md), "Asking for more": `messages`). The signer writes, seals and opens each one (`seal`, `unwrap`), and signs where messages reach them (`reach`). A world is never given a key and can't have anything else encrypted or decrypted. `sealMessage`, `isSealAsked`, `isReachAsked`, `cleanRead` in the core; `seal`, `unwrap`, `reach` on the kit's `worldSigner()`.
- **Nobody is written to who hasn't said where messages reach them** (kind 10050), and a visitor says where theirs do before they send their first, from their own press.
- Nothing that was read is kept once the page is closed.
- **Not built:** BitLogin's side for worlds. Not tried: real relays. Many relays ask a reader to prove who they are before handing over wrapped messages, which the kit doesn't do.

## 0.41.0

- **A Following tab in the menu every world has** ([NSWP-14](protocol/14-people-and-messages.md)): who the visitor follows, by name; choose one to see who they are and to unfollow them; follow someone by their key, copied, or typed on a headset's keyboard. The same in a world and at the visitor's home. It shows nothing, and asks no relay anything, until the visitor has let that place see to who they follow. `addFollowingControls`, `createProfiles`, `keyIn` in the kit; `addRoomControls` adds the tab and returns it as `following`.
- **The left and right arrow keys turn** in the reference worlds, the casual way on a flat screen (owner's ask). They stepped to the side, as A and D still do. `KEY_TURN` in the kit. Game controls are as they were.

## 0.40.0

A world can follow someone for its visitor, once they let it.

- **A world is a Nostr client, and may be trusted as one** ([NSWP-10](protocol/10-identity.md), "Asking for more"; owner's decision). A world asks its visitor's signer for more than a note and a reaction, by name from a short closed list. The visitor is shown it in their signer's own window, for that one world. Nothing more is allowed by default. `SIGNER_MORE`, `cleanMore`; `want` and `more` on the kit's `worldSigner()`.
- **Follow and unfollow on a person's card,** in every world built with the kit, for someone who came by name, on a phone, at a desk and in a headset. The first press in a world opens the signer's window; after that it just works there. `worldPeople()`, `createPeople()` in the kit.
- **A world never builds the follow list** ([NSWP-14](protocol/14-people-and-messages.md)). It hands the signer the visitor's newest list and one change (`follow`); the signer makes the change (`followForWorld`), and the kit checks that what comes back is that list with that change and no other (`isFollowAsked`).
- **Nothing is changed when no relay could be reached,** and a first list is written only when relays answered with none and the visitor pressed twice. A list no relay took is kept on the device and sent again.
- A follow list drops the mark a signer put on the last one, so it doesn't carry where its owner last was.
- **Not built:** BitLogin's side of `want` and `follow`. Until then, Follow in a world asks and is never answered. Nor BitPortal's home.

## 0.39.0

People and messages, in the library. Nothing a visitor can see yet.

- **Following and unfollowing** ([NSWP-14](protocol/14-people-and-messages.md); NIP-02, kind 3): `changeFollows` makes a follow list with one person added or taken out, from the newest list that could be found. Everything else in it is kept as it was: other people, the relay and name each was written with, other tags, the content. It signs nothing when no list was found, unless told the person follows nobody yet. `followsIn`, `newestFollows`.
- **Private messages** (NIP-17): `buildMessage`, `sealTemplate`, `wrapSeal` to send one; `readSeal`, `readMessage` to check what a signer opened; `openWrap` for a client that holds a key. A message that says it is from one person and was sealed by another is dropped. `readMessageRelays`, `buildMessageRelays` for where someone's messages reach them (kind 10050). `vectors/people.json`.
- **NSWP adds no kinds for these.** They are done at the visitor's own client. A world's signer refuses a follow list and every part of a message, as before.
- **Not built:** any of it in BitPortal, and what a world's card about a person may offer.

## 0.38.0

- **What is sent goes to relays that are working.** The kit remembers, on the device, how each relay it has used answered, and leans on the ones that have been answering. A person's own relays (NIP-65) are always used, best first; if fewer than three of them are up, the best of the usual relays are added; if nothing takes what was sent, the rest are tried once. `sendWell`, `askWell`, `relaysWell` in the kit; `pickRelays`, `learnRelays`, `relayScore` in the core.
- A visitor's posts and their saves are sent and looked for this way. What is remembered is about relays, never about people, and stays on the device.

## 0.37.0

- **Ratings** ([NSWP-13](protocol/13-ratings.md), kind 37305): one to five stars from one person for one world, with a few words, replaced when they change their mind. `buildRating`, `parseRating`, `tallyRatings`, `tallyWords` in the core; `vectors/ratings.json`.
- **A tally counts only the people a client was told to count:** the visitor, and whoever it gives (the people they follow, the curators whose lists they use). A crowd of keys nobody knows changes nothing. It leaves out a world's own publisher, and any rating a signer marked as asked for by the world it rates.
- A rating is given at the visitor's own client. A world's signer refuses the kind, as it does every kind but a note and a reaction.

## 0.36.0

What kind of place a world is, and what a world keeps for its visitor.

- **A world says what kind of place it is** ([NSWP-01](protocol/01-worlds.md)): a `category` tag in its announcement, one of `game`, `experience`, `social`, `app`, `site`. `CATEGORIES`, `categoryWords()` in the core; `"category"` in a world's `world.json`. A value that isn't on the list is treated as not stated.
- **A door says it:** `createPortalGate(destination, { category })`, and `category` on Godot's `NswpGate`. The sign reads "A game at example.com". The reference worlds' doors do, and the build checks that what a door says of a place is that place's own word.
- **Saves** ([NSWP-12](protocol/12-saves.md), kind 37304): a world keeps text for its visitor with their own account, on their own relays, encrypted so that only they can read it. A world reaches its own saves and nobody else's: it never names where one is kept, the visitor's signer works that out from the world's address. Three more messages to the signer (`save`, `find`, `open`); `saveAddress`, `sealSave`, `openSave` in the core; `vectors/saves.json`.
- **In the kit:** `worldSaves()` (`load`, `save`, `clear`), which keeps a save on the device at once and with the account of a visitor who is signed in. For another engine, `NSWP.save` and `NSWP.load` with `saved` and `loaded` events; in Godot, `Nswp.save()`, `Nswp.load_save()`. The script's `VERSION` is 9.
- **The Arcade keeps its best time as a save.** It was a number on one device.
- **Not built yet:** BitLogin's signer doesn't answer the three messages, so until it does a save stays on the device. Nothing else changes for a world when it does.
- Application data (kind 30078) stays out of a world's reach, as before. `cleanOrigin` moved within the core; it is exported as it was.

## 0.35.0

Always the latest.

- **A world owes its visitors the latest** ([NSWP-09](protocol/09-what-a-world-owes.md)): its page and scripts are served so that a browser asks before using a copy it kept (`Cache-Control: no-cache`, `max-age=0` or `no-store`), and a page that is already open finds out when its world has been updated. Nothing of the visitor's is ever cleared to make an update take.
- **The kit tells a visitor whose page is older than the world.** `addViewControls` and an engine's menu add a control that shows only then: "This place has been updated. Reload for the latest". Someone coming back to the tab with nothing in hand is given the latest at once; someone in a room, in a headset or writing is told and left to choose. `watchFresh`, `freshAction`.
- **`nswp check`** says whether a page is served that way, and warns when it isn't. `servedFresh(cacheControl)` in the core.
- **The reference worlds, BitPortal and the template say `Cache-Control: no-cache` outright** for everything not named by a hash, where they had left it to their host's habit.
- **The Godot example is a public world: The Foundry**, at `foundry.bitblocks.network`. `npm run build:godot` writes its manifest and its site's headers beside the export; the Workshop has a door to it and it has one back, so the trip between a Three.js world and a Godot one can be made both ways. `npm run release:all` deploys ten sites, and won't start without Godot here or while an address its doors lead to has no DNS record. No change to the kit.

## 0.34.0

A world made in another engine is crossed into the way a Three.js world is.

- **The crossing's room, for any engine.** A Godot world showed Godot's own loading screen for as long as its forty megabytes took, and then the world, with no room at either end of the trip. The kit's script for engines now draws the room itself, as the page: the view from inside it, facing its doors. It is up from the page's first moment, before the engine has loaded, wearing the world's name and colour (`<meta name="nswp:title">`, `<meta name="nswp:accent">`). The line of light over its doors fills as the engine arrives (`NSWP.loading`), the doors open when the world asks for its menu (or `NSWP.ready()`), and leaving by a door it comes up and shuts before the page is left. `NSWP.crossing()` and a `crossing` event say where it is.
- **A page for Godot with no Godot loading screen:** `addons/nswp/web/shell.html`, set as the export's Custom HTML Shell, and `nswp-godot.js`, which starts the engine from it. Nothing is run from the page itself.
- **The same sign-in in an engine's menu:** the row that opens the visitor's sign-in address's window, the card at the head of You, and "Signed in as". The engine is told who they are (`NSWP.who()`, a `who` event; `Nswp.who()` and `who_changed` in Godot). `arrival()` names someone only while they are signed in here.
- **The Godot visitor walks a pressed-out path** and faces the way it walks, as a Three.js world's does (0.32.0). `NSWP.kit()` has `pathMost` and `faceRate`.
- The script's `VERSION` is 8. `Nswp.go()` in Godot takes the door's name, for the room's sign; `NswpPortal` passes its own.

## 0.33.0

- **A tab of the menu can be kept on the bar.** Each tab has "Keep this tab on your bar" beside Close. A pinned tab stands on the bar after the place's own keys, with the tab's own picture and name and the next number key; pressing it brings the menu up on that tab, and pressing it again puts the menu away. Four may be pinned. Nothing is pinned until the visitor pins it, and a world never pins for them.
- **What is on their bar goes with them.** `pins` joins the settings that travel ([NSWP-11](protocol/11-the-visitors-console.md), "Settings that travel"): the tabs' names, as short plain words, four at most. A world shows the ones it has a tab for and passes the rest on. If the settings would be too long for a link, the pins are left off first and everything else still travels.
- **In the kit:** `controls.pins`, `controls.setPinned(tab, pinned)`; the view has `pins`, `pinsFull` and `pinned` on each tab; `PINS_MOST`; a `pin` icon. On a narrow screen the bar slides sideways when it is wider than the screen.

## 0.32.1

- **The card about what is pointed at is one column again.** Since the profile card arrived (0.27.0) the two shared a style name, so a door or a thing pointed at had its lines laid out in two squeezed columns, as a picture and a name are. The profile card has a name of its own now.

## 0.32.0

- **A path, pressed out as they walk.** Moving the casual way on a flat screen, a press while already walking started again from the visitor's feet, so the line on the floor was redrawn and the first spot was lost. Now it adds a stretch from where the last press ended. The line is drawn through every spot, with a ring at each turn, and they walk it in order at the same pace. Two presses close together are still a run, straight to that spot with the rest forgotten.
- **They face the way they walk.** While a walk is on, the view turns to look along the stretch being walked, at an easy rate, and settles there. Never in a headset, and not while they are dragging the view themselves.
- **In the kit:** `stroll.tap(x, z)` for a press on the floor, `stroll.reach(x, z)` for the ring under the pointer, `stroll.path`, `stroll.heading`, `stroll.face(yaw, dt)`; `createFloorMarks().update({ path })`; `PATH_MOST`, `FACE_RATE`. `stroll.to()` is as it was, for a walk a page starts itself. A world with boot code of its own changes four lines: see "Marks on the floor" in the kit guide.
- **Pointing at something no longer moves the picture.** `hud.cover()` counted the words about what is pointed at as part of what the controls cover, so a page that moves its view clear of the controls moved it every time the pointer crossed something: in BitPortal's room the view dipped whenever a button on the wall was pointed at. It now counts the controls and nothing that comes and goes.

## 0.31.1

- **Nothing shows through the walls of the crossing's room.** Chosen from close to it, a doorway is inside the room that comes up round the visitor, and its light showed through the walls from inside: its field, its glow, anything a world draws see-through. Solid things were already painted over; see-through ones are drawn later in a frame, and weren't. The room now shuts them out wherever it stands in the view, and through its open doorway the world is as it was.

## 0.31.0

- **"Signed in as", said once, at the top of the view.** When a visitor becomes signed in to a world (on arriving already signed in, or on signing in) a small badge comes up at the top centre with their picture and name, stays a few seconds and goes. Signing out says "Signed out" the same way. It comes into focus where it stands and never slides; with Motion off it simply appears. It can't be pressed and nothing under it is blocked. In a headset, where the page can't be seen, the same words are said the way everything is said there. It reads the card at the head of You, so it is the same in every world and in a client's own room. A guest who never signed in is told nothing.
- **A signer that says nothing is asked again.** A named signer whose frame never loaded stayed silent for good, and the menu could only suggest reloading the page. Now its frame is loaded once more by itself before anyone is told, and the row that says it didn't answer asks again when pressed (`signer.retry()`, `signer.asking`).
- **`npm run release:all`** moves every public site together: the seven reference worlds, the Starter Home and BitPortal. It refuses to start unless all three repositories are on main, clean, and carrying this repo's kit, says what each public site is on, and then deploys all nine or says which it did. Without `--go` it only looks.

## 0.30.3

- **A client's own feed says how a post is marked.** A client that signs in its own room (`notes` in `addRoomControls`) can say which site its sign-in marks each post with (`RoomNotes.marked()`), and the feed then tells the visitor where they write, as it does in a world. BitPortal's sign-in is moving to BitLogin's window, whose signer marks what it signs for an application.
- **The development server names local copies in a site's policy.** Where a site's content policy names a real address this server also serves (BitPortal's names its sign-in address, to embed that address's signer), the local copy's address is named beside it. Nothing else about a policy changes.

## 0.30.2

- **The menu's tabs say when there are more.** A world with many sections has more tabs than fit, and the strip scrolled sideways with no bar and no sign of it. An arrow now stands at whichever end has more, over a fade, and pressing it slides the strip; a mouse's wheel over the strip moves along it; and choosing a section brings its tab into sight.
- **`npm run kits`** lists every site with the kit it was built with, and marks any that differ from this repo's: the public sites, or with `--local` the development server's copies. A world says its kit in its manifest; BitPortal in `/version.json`.

## 0.30.1

- **The reference client sends no pass on arrival.** BitLogin's signer makes passes on its live site now, so BitPortal's Airlock names the visitor's signer and nothing else about them: a world's site learns nothing about a visitor until they sign in there. (The change is BitPortal's; the protocol's text now says so.)
- **A signer has ten seconds to give its first answer** before the menu calls it silent, from seven. BitLogin's checks the visitor's relays before answering when it hasn't for days, which can take five.

## 0.30.0

Nobody outruns a run, whatever they hold or wear.

- **A press on the floor is always a walk on a flat screen.** With Motion off, each tap or click was an instant step of up to six metres, and nothing limited how fast they came. Many phones turn Motion off by themselves, from the device's own setting, so a phone could cross a place far faster than anyone walking: measured in a reference world, about 58 metres a second by tapping, against a run of 4.2. Now it is the same walk on a phone as at a desk, with Motion on or off: 2.4 metres a second, or a run for two taps.
- **A step in a headset is paced.** Moving the casual way in a headset is a step that lands at once, which is right for comfort and was also unlimited: about 7.4 metres a second by pressing fast. Each step is now paid for after it is taken, so the next can't land until a runner would have covered the same ground. A short step is ready again almost at once, the longest in a little over a second, and the ring on the floor is dim while a press would do nothing. A step backwards with a stick is paced too.
- **In the kit:** `TOP_SPEED` (4.2 m a second), `createStepPace()`, `createXrInput({ pace })`; an engine is told `topSpeed`. The reference worlds, and the boot code a world is built from, use them. A world with boot code of its own changes two lines: see "Nobody outruns a run" in the kit guide.
- **What this is not:** a guard against someone who changes their own page. A room has nobody in charge, so the pace is each honest visitor's page keeping to it (NSWP-06).

## 0.29.0

A post goes to the relays its writer says they write to.

- **"Send out a post" follows the visitor's own relay list (NIP-65).** The kit sent every post to its own fixed four relays, whoever wrote it. Now it looks up the writer's newest kind 10002 list when they open their feed or send a post, sends to the relays they write to (six at most), and reads their earlier posts from the same. A list with fewer than two is filled out from the usual relays to four in all; someone with no list gets the usual ones. The feed says which it was: "Sent out, to 2 of your 2 relays", or that the usual ones were used and why. (NIP-65 is a person's own signed relay list. NIP-66, relay monitors, is not used: a list is its owner's say, and what a monitor says is nobody's.)
- **Only an address on the open web is dialled:** `wss`, a real host name, no credentials. Plain `ws`, a bare machine name and a number for a machine are dropped from a list.
- **`noteRelays` now names the usual relays:** where the list is looked for, and the fallback. BitPortal passes the visitor's own settings there, so its home room follows their relay list too.
- **In core:** `readRelayList()`, `writeRelaysFor()`, `cleanRelayUrl()`, `RELAY_LIST_KIND`.

## 0.28.3

- **A sign-in that lasts for this visit only is said so.** A signer may say `remembered: false` in `state`: it will be locked again the next time the world's page is loaded (the visitor left "remember" unticked in its window, or keeps a lock on their sign-in). The menu then says so under You, and that it is chosen in the signer's window, so being asked again is no surprise. `signer.remembered` in the kit. A signer that doesn't say is treated as before.

## 0.28.2

- **A pass is counted apart from notes:** two a minute and ten an hour for one world, beside three notes a minute and twenty an hour. Counted with notes, signing in used one of the minute's three, and a visitor's third post in their first minute was refused with nothing to say why. Decided by the owner on 2026-11-19. The signer enforces it; `SIGN_LIMITS.passBurst` and `passHourly` are the numbers. Nothing in the kit's behaviour changes.

## 0.28.1

- **A signer that gives no pass is asked once.** The kit asked again every ten minutes after a refusal or no answer, and each asking counts against what the signer lets that world have signed. Now it asks again only when the visitor signs in afresh or the page is loaded again. A pass that was held and ran out is still asked for anew. (Asked for by BitLogin's signer, whose refusal means "stay a guest".)

## 0.28.0

The signer can make the pass, a world's signing limit is the pace of a person, and the feed says how a post is marked.

- **A pass from the signer** (NSWP-10). A world asks its visitor's signer for a room pass with a session key and nothing else; the signer writes the site, the expiry and the name, picture and few words itself. So someone who signs in at a world is by name there, whether or not their client vouched for them first, and as the person they signed in as. `sign` still refuses a pass (kind 27300). The kit asks when it holds no pass for the signed-in key, checks what comes back (that key, this site, that session), and joins the room by name. A signer that makes none says nothing and the visitor is a guest who can still post: nothing breaks against BitLogin's live signer, which makes none yet.
- **Limits: three notes a minute and twenty an hour for one world,** from six and sixty. A pass counts as a note. The signer enforces them; these are the numbers a signer is held to.
- **`state` may carry `picture` and `about`** beside `name`, from the visitor's own profile as their sign-in address read it. For the visitor's own card.
- **"My public feed" says how a post is marked:** "Each post is marked as sent from" and the world's address, where the visitor writes. The mark itself is not new: a world's signer has always added it.
- **In the kit:** `signer.pass(session)`, `signer.picture`, `signer.about`; `seekPass()`, `onHereAs(fn)`, `arrival.keepIdentity(pass, sessionKey)`; `byName()` takes and gives `{ pass, sessionKey }` and waits briefly for a signer's pass; `FeedOptions.who` may be a function, `FeedOptions.marked`, `FeedView.lead`.
- **Not yet:** the reference client still sends its own pass on arrival, so a world's site learns a signed-in visitor's key before they sign in there. That stops once BitLogin's signer makes passes on its live site.

## 0.27.0

One sign-in in a world, and a public feed of your own in place of the posting switch.

- **A world no longer says "here as Alice" to someone who hasn't signed in there.** Where the visitor's client names a signer, that is the one sign-in: a pass they arrived with counts once the signer is unlocked for the world, as the same person. Until then they are a guest, to the room and in the menu. Signing in or out leaves the room and joins it again as who they now are. A signer that remembers the world answers as the page loads, and the kit waits for it before joining, so nothing is pressed the second time. (NSWP-10, "One sign-in".)
- **One row under You,** "Sign in, at bitlogin.network" or "Signed in as Alice. Sign out here", under a card with their picture, name and key. The older "Here as Alice. Switch profile, or go as a guest" row is not shown where a signer is named.
- **What this costs:** the first time in each world, one press and one yes in the sign-in window. Before, a signed-in visitor was by name on arrival with nothing asked.
- **"Send out a post" replaces "Post what I write as Nostr notes".** It opens **My public feed**: the visitor's own posts, newest first, with the place to write above them. It is the other side of the panel the room's chat is on, and a panel of its own in a headset. A line said to the room is never posted now, and a post is never said to the room. It needs no room. (NSWP-10, "Posting from a world".)
- **Their earlier posts are read from the relays when they open the feed,** and not before: the one thing a world asks a relay about a person, and it is the visitor's own key. Replies are left out. A post is shown as plain words; nothing in it is fetched or opened.
- **In the kit:** `controls.feed` (`UiFeed`, `FeedView`), `hud.setChatOpen(open, "feed")`, `hud.chatTab`, `controls.signal("toggle:feed")`; `hereAs()`, `byName()`, `signerNamed()`, `youCard()`; `signer.whenAnswered(ms)`; `arrival.identity()` also gives the pass's `picture` and `about`; `RoomNotes` gains `pubkey` and `who`. The row `room-chat-notes` is now `feed`.
- **Not built:** someone who signs in at a world as a key their client sent no pass for can post, and is a guest in a room. Closing that needs the signer to make the pass (NSWP-10, "Proposed, not built").

## 0.26.3

The posting switch is where a visitor looks for it, before they have signed in to sign.

- **"Post what I write as Nostr notes" is in the Room tab whenever there is a signer to post with,** unlocked or not. It was hidden until the visitor had pressed a separate row under You, and someone in a room, by name, with chat on, was given no hint that anything more was needed. Locked, it reads "sign in at bitlogin.network first", and pressing it opens that window. Once they have said yes there, posting is on: it is what they pressed.
- **A signer that didn't answer is said so there too,** and on a development server the message names the copy's address and the one thing that helps: opening it once so the browser accepts its certificate.
- **In the kit:** `RoomNotes` gains `locked`, `unlock`, `host` and `unanswered`; `signer.copy`; `unansweredWords()`.

## 0.26.2

A visitor can post from their own client's room, where they are already signed in.

- **A room may be given its own note signer** (`addRoomControls(..., { notes })`, `RoomNotes`). Left out, it is the page's world signer, as before: what a world has. A visitor's own client, in a room of its own, gives one that uses the sign-in it already holds.
- **Whatever signs a note, it is checked before it is sent:** a real signature, on a note, saying what was written.
- **In BitPortal:** the room in a visitor's home has "Post what I write as Nostr notes" for someone signed in, signed with their BitPortal sign-in, with no window to open. It signs a plain note of the words written and nothing else. It is off at every visit, and isn't offered to a guest or to someone going about as one.

## 0.26.1

One address on a development server, and a menu that says when a signer doesn't answer.

- **The development server has one address for each site** with `--lan --https`: `https` at the machine's address on the network, the same from every device. Plain `http`, `localhost` and `127.0.0.1` are sent on to it. Two addresses for one site were two sites to a browser: signed in at one and not the other, a room at one that a phone at the other never joined, and at plain `http` no signer at all, with nothing to say why.
- **A signer that was named and doesn't answer is said so.** Where a visitor's client named a signer and it can't be loaded (unreachable, or kept out by the browser), the menu's row reads "Signing isn't available: bitlogin.network didn't answer", and pressing it says what that means. Before, the row was simply not there. Where no signer was named, there is still no row.
- **In the kit:** `signer.unanswered`.

## 0.26.0

A visitor's signer is where their client says it is, and BitPortal says BitLogin.

- **[NSWP-03](protocol/03-arrival.md), [NSWP-10](protocol/10-identity.md):** an arrival may name the visitor's signer (`signer`, an `https` address with `signer/` and `connect/` under it). A client that names none keeps its signer beside its Airlock, as in 0.25.0. So the place a password is typed can be one small site that does nothing else, shared by every client and site that uses it.
- **The control says whose window will open:** "Sign in to sign notes, at bitlogin.network". An arrival is something anyone can write, so the address is shown before it is pressed.
- **In the kit:** `arrival.signer()`, `createWorldSigner({ under })`, and in the library `signerAt()`. A signer named outright (`at`) is used as it is; a client's own is followed to its copy on a development server.
- **In BitPortal:** its Airlock names `https://bitlogin.network/` in every arrival (its `INSTANCE.signer`). BitPortal has no signer of its own, and no page of it may be embedded by another site: the first version's two pages were never shipped.
- **In BitLogin** (its own repository, live at `bitlogin.network` since 2026-11-19): the signer, the sign-in window, and remembering a site for thirty days.
- **The development server** serves BitLogin's own site as the copy of `https://bitlogin.network`.
- **Still two sign-ins.** BitPortal itself is signed in to on its own page, with BitLogin's widget, as before: it needs more signed than a world may ask for (passes, a sealed settings note, announcements). Signing from a world is a second sign-in, at BitLogin's site. They become one when BitLogin can give an application its own permissions.
- **Not built:** a headset (no window can open in one), the engine script and the Godot addon, anything but a note and a reaction.
- **Status (2026-11-19):** BitLogin's part is deployed. BitPortal and the worlds are not. On the local server, through BitPortal's Airlock into a world: the arrival named BitLogin, the menu said so, the signer answered from BitLogin's copy, and its window asked for a sign-in on BitLogin's own page. **Not tried:** signing in (automation never does), so a note signed from a world through BitLogin's live site is the owner's to try.

## 0.25.0

Signing from inside a world: a visitor can post a Nostr note as themselves, and the world never holds their key.

- **[NSWP-10](protocol/10-identity.md), "Signing from a world":** a client that offers signing serves a hidden signer and a sign-in window beside its Airlock. A world embeds the signer and asks it. It starts locked in every world. The visitor unlocks it for one world in the client's own window, which shows that world's address as the browser reported it; then the signer signs notes and reactions for that world until its page closes, four hours at most. Everything else is refused, and a refusal never says why.
- **Nothing secret is typed into a world.** A world's page can read whatever is typed on it, so the password stays in the client's window, which the world can't read. Decided by the owner on 2026-11-19, with the rest of [`docs/plans/signing-in-worlds.md`](docs/plans/signing-in-worlds.md).
- **Every note signed for a world says so:** the signer adds `["nswp:world", "<origin>"]`, sets the time itself, and signs at most six a minute and sixty an hour for one world.
- **In every world's menu:** "Sign in to sign notes", under You. In the room's chat, once unlocked: "Post what I write as Nostr notes", off at every visit.
- **In the kit:** `worldSigner()`, `createWorldSigner()`, `signerAction()`; in the library `signClass`, `prepareForWorld`, `signerAddresses`, `createSignGate`, and the two message formats. A world's security policy gains `frame-src 'self' https:`.
- **In BitPortal:** the signer page (`/signer/`) and the window (`/connect/`). The signer is the one page another site may embed; every other page still may not be. The key moves from the window to the signer inside BitLogin's crypto workers, and what arrives can only sign.
- **In BitLogin:** a signer hand-off (`docs/sign-in-window.md`). On a branch of its own: BitLogin's site is deployed when it is merged, so that waits for the owner.
- **The development server** sends each page the headers its build wrote for it, where it sent one set to all.
- **Not built:** a passkey, a browser extension or a phone as the way to unlock; the offer of a passkey after a password sign-in (BitLogin can't add one to an existing account yet); anything asked for every time (a profile, a follow list); payments; signing from a headset; the engine script and the Godot addon.
- **Status (2026-11-19):** not deployed, and BitPortal's part is not merged. Tried in Chrome on the local server, with a world on one site and BitPortal on another, the walls between sites' storage on, a throwaway identity, and stand-ins for every relay: the signer refused while locked; the window showed the world's address and offered Allow; the world could read neither the signer nor the window; a note was signed, marked for the world, and came out of the chat; a profile, a follow list, a private message, a pass and application data were refused; the seventh note in a minute was refused; locking from the menu ended it. **Not tried:** a real BitLogin account (automation never signs in to one), Firefox and Safari with BitPortal's own pages, a phone, a real relay.

## 0.24.0

Profile cards, and a sound when someone writes.

- **[NSWP-10](protocol/10-identity.md), "Who someone is":** choosing a person, from People or by the picture over their head, shows a card about them: their picture, their name, whether they came by name or as a guest, the short form of their key with the whole of it to copy, and what they wrote about themselves. Muting and blocking are beside it. It is the same card in the menu on a desk or a phone and on the console in a headset.
- **A pass may carry `about`:** the start of what the visitor wrote about themselves in their Nostr profile, put there by their own client and signed with the rest. One line of plain text, 280 characters at most, cleaned again by whoever reads it. It is their own words and is drawn as a quotation, never as a fact: anyone can write anything about themselves. A world still never asks a relay about a visitor.
- **A sound when someone writes** (`chat`), made in the browser like the other defaults: two soft low syllables, two octaves under the kit's own notice. It is heard from where the writer stands: quieter and duller the further off, to the side they are on, and never silent. It follows the visitor's effects volume, a world can replace or silence it, and it isn't played while they have written chat off. No sound file was added.
- **In the kit:** `Member.about`, a `card` on any section of the menu (`UiCard`), `presence.whereIs()`, `sounds.play(cue, { distance, pan })`, `heardFrom()`, and in the library `cleanAbout`, `cleanLine`. The signal that opens the chat panel is now `toggle:chat`, since `chat` is a cue.
- **In BitPortal:** a profile's `about` is read with its name and picture, and goes on the pass of someone going by name.
- **Not built:** a web address or a NIP-05 name on a card (a NIP-05 name on a pass would be the holder's own claim; checking one tells the domain who is looking), following or messaging from a card, cards on BitPortal's own pages.

## 0.23.0

Speech bubbles and a chat panel: the people in a room can write to each other.

- **[NSWP-06](protocol/06-rooms.md), "Words":** a new message on a room's channel, `say:<id>:<words>`. It goes straight from one browser to the others, as a pose does: no relay sees it, nothing signs it, and nobody keeps it. A line carries no name: who wrote it is whoever holds the connection it arrived on, shown by the name the room already knows them by. A reader makes it one line of plain text, drops what reorders or hides text, cuts it to 240 characters, and takes no more than five from one member in ten seconds. An older client ignores the message, as it ignores anything it doesn't know.
- **Over their head:** what someone writes is drawn in a bubble over their name (and their picture) for a few seconds, longer for more words.
- **A chat panel, the same in every world.** On a desk it is at the right-hand side of the screen; on a phone, across the bottom. Put away, the newest lines pass by for a few seconds. **Enter or T** opens it to write in, Enter sends, and Enter on an empty line or Escape puts it away. Nothing typed in it walks anybody anywhere. In a headset it is a panel of the visitor's own, pinned beside them, whose one button puts up the keyboard with its Speak key. `Chat` is on the taskbar once a room is joined, with a count of what hasn't been read.
- **Seeing chat is the reader's to turn off** (`room-chat-show`, "Written chat"). It is a setting that travels, `chat`, so off stays off in the next world. Nobody is told.
- **In the kit:** `session.say()` and the `said` event, `controls.chat`, `hud.setChatOpen()`, `controls.setKeys({ chat })`, `createPresence({ bubbles: false })`, `showsChat()`, and in the library `cleanChat`, `buildSay`, `parseSay`, `createChatGate`, `CHAT_LIMITS`.
- **What this is not:** notes on Nostr. Nothing is published or signed with the visitor's key, and nobody outside the room can read it. Writing and reading notes from inside a world needs the visitor's key to sign, which a world is never given, so it waits on in-game signing (`docs/plans/in-game-identity.md`).
- **Not built:** a sound when someone writes (no sound is added without the owner having heard it), links in a line, history for someone who joins late, chat in the engine script and the Godot addon.
- **Status (2026-11-19):** not deployed. On the local server in Chrome, with throwaway identities: two visitors wrote to each other with a real keyboard, each saw the other's line over their head and in the panel, markup arrived as text, the sixth line in ten seconds was refused, chat turned off showed nothing, and leaving forgot every line. A phone-sized window showed the panel across the bottom. In a made-up headset (IWER) the panel opened pinned, the keyboard came up from its button, and what was typed reached the other visitor. **Not tried:** a real phone's on-screen keyboard, a real headset, the Speak key, two people on different networks.

## 0.22.0

Nostr names and pictures, first class.

- **[NSWP-10](protocol/10-identity.md), "Pictures":** a pass may say where the visitor's picture is (`picture`, an `https` address): the one in their Nostr profile, put there by their own client and signed with everything else. A reader shows it over their name as a small round badge. It is a button: choosing it chooses the person and puts what can be done about them in front of the visitor. A guest has none, and a world never asks a relay about its visitors.
- **Seeing pictures is the viewer's to turn off.** A picture is fetched from wherever its owner keeps it, which tells that place the viewer's address, as reading Nostr anywhere does. `pictures` is a setting that travels ([NSWP-11](protocol/11-the-visitors-console.md)), on unless they turned it off, with a switch under People in every world.
- **In the kit:** `Member.picture`, `presence.personAt()` and `pressAt()`, `loadPicture()` (https only, nothing sent with the request, a size limit, redrawn small), `showsPictures()`, and `controls.signal("show:<section>")` to bring the menu up on a section. The reference worlds and the template press a picture like anything else pointed at.
- **In BitPortal:** people are shown by the name they chose on Nostr, never by a string of hex: the visitor themselves on every page, and whoever signed a list or announced a world, with the short form of their key beside the name where which key it is matters. Profiles are kept in the browser and asked for again in the background. The visitor's own picture is on the sign-in page and beside their name. Their own room signs a pass for itself, so people sharing it see each other's names and pictures. Settings has the pictures switch.
- **Fixed in BitPortal:** the Airlock's line saying how a visitor was going read "as a guest" for someone going by name, until they touched the choice.
- **A limit:** a picture shows only if the place that holds it lets a web page read it. Most Nostr picture hosts do. One that doesn't is not shown, and nothing can be done about that from a page.
- **Not built yet:** speech bubbles, a chat panel, profiles beyond a name and a picture. This is the ground they stand on.
- **Status (2026-11-19):** not deployed. On the local server in Chrome, with the Airlock's throwaway test identity and one of a world's own images standing in for a picture: a guest saw the named visitor's name and picture over their figure, pressing the picture chose them and listed mute and block, and the switch turned pictures off. **Not tried:** a real profile picture from a real host, two real people, a headset.

## 0.21.1

A phone or a headset on the same network can sign in and enter VR on a development server.

- **The development server answers https** (`node scripts/serve-local.mjs --lan --https`), on the same ports as http, with a certificate made on that machine and kept outside every repository. From another device, plain `http://192.168…` is not a secure address, so a browser withholds its cryptography, the microphone and a headset session: nobody could sign in there, and BitLogin reported it as "Account not found or credentials incorrect".
- **Local copies may be https.** A page asks for the map of local copies when its host is local, over http or https, and a map may lead to an https copy on a local host. What makes a page local is its host: `localhost`, a loopback address, or a private network address. No real site is at one. Nothing else about the three limits changes ([local-server.md](docs/local-server.md)).
- **Each device warns about the certificate once,** and whoever holds it accepts it after checking the fingerprint the server prints. Passkeys still don't work on such a page: a browser refuses them where it was told to accept a certificate.
- **Status (2026-11-19):** tried on this machine only, in Chrome and Brave with the certificate accepted. **Not tried:** a real phone or headset.

## 0.21.0

Keeping worlds up to date, without a script they all load.

- **[NSWP-01](protocol/01-worlds.md), "Which kit a world was built with":** a manifest may say `kit`, the version of the kit the site was built with. A client may tell a visitor that a world's controls are older than its own, and that is all: it is never a warning, never changes whether a door opens, and never stops a crossing. A world that is behind is not a world that is broken.
- **The kit has a version** (`KIT_VERSION`, the spec's own, kept the same as this file's newest heading by a test). The reference worlds' and the template's builds write it into the manifest; the kit writes it on the page as it reads the arrival; `nswp check` says a site's beside the tool's own; the probe reads which kit is really running; the engine script has `NSWP.KIT`.
- **Updating is one step, and can be none.** The template has `npm run update`, which takes the newest kit and plumbing from the template's own repository and leaves the world's own files alone, and `npm run update -- --check` to ask without changing anything. A scheduled job opens a pull request when a newer kit is out, for the owner to read and merge ([keeping-up.md](docs/keeping-up.md)).
- **In BitPortal:** the Airlock says, under "More about this place", when a world was built with an older kit than BitPortal knows, or doesn't say. It changes nothing else.
- **What was not built, on purpose:** a copy of the kit that every world loads live from one address. Whoever controlled that address would control every world at once, an owner would have no say in what ran on their own site, and one outage would take every world's controls with it. What must always be current (signing in, a look, the Airlock, lists) is in the visitor's client already, so worlds get the newest of it the day the client does.
- **Status (2026-11-19):** not deployed.

## 0.20.0

What a visitor prefers, in every world.

- **[NSWP-11](protocol/11-the-visitors-console.md), "Settings that travel":** a filled screen and the intense way of moving are now standing preferences, not a record of what the visitor last did. `full` means "prefers a filled screen" and a new `intense` means "prefers the intense way at a desk". Every world they enter starts that way. Pressing Escape, or being on a phone for a while, changes nothing: only their own hand on the control does. Before, `full` was whether the screen happened to be filled as they left, so leaving fullscreen for a moment in one world left the next one unfilled.
- **Two new settings for a flat screen:** `look`, how fast the view turns under a mouse or a finger (0.25 to 3 times the world's own), and `fov`, how wide they see at a desk (50 to 110 degrees; left out, each world's own). Both have a control in every world's console (`look-speed` under Moving, `fov` under View), travel with the visitor, and are the same everywhere.
- **In the kit:** `desk.ts` (`lookScale`, `visitorFov`, `watchFov`, `addDeskControls`, `onDeskChange`); `prefersFullscreen()`; `addViewControls` adds the controls and keeps the camera to the visitor's width. **For other engines:** `NSWP.kit()` gives `lookSpeed` and `dragLook` already scaled and `fov`, read again on a `changed` event; the Godot visitor follows them.
- **In BitPortal:** Settings has "In every world": fill the screen, move the intense way at a desk, how fast the view turns, how wide you see. The Airlock starts from what the browser keeps for the visitor, so a door opened from the front page takes their preferences along. With "Keep my settings with my profile" on, they are in that note.
- **Status (2026-11-19):** not deployed. On the local server in Chrome: preferences set once in Settings; two worlds in turn each started the intense way and filled the screen at the first key, the second after fullscreen had been left with the browser's own exit in the first; then fullscreen and intense turned off and the speed and width changed in a world's menu, and the room at home started that way and kept it. The Godot example, arriving with preferences, started the intense way with its speed doubled and its width at 90°, and followed both as they were changed in its menu. **Not tried:** a real mouse by hand (whether "fast" feels right), Firefox, Safari.

## 0.19.0

One coherent "you": signed in everywhere, one look everywhere, and the same menu everywhere.

- **[NSWP-10](protocol/10-identity.md), "Signed in everywhere":** a visitor signs in once, in their own client, and is signed in wherever they go. No world has a sign-in of its own, so there is nothing to sign in to one by one. A client that does this says so where they sign in, with what it gives away, and puts the way out beside it. A pass still never goes to a site that hasn't proved who it is, and never on a link's word.
- **The place a visitor signs in may be somewhere to stand,** reached by the crossing's room like any other place, so nobody is dropped from a world onto a page. In BitPortal it now is: the room's ground and sky, the crossing's room opening as they arrive and closing as they leave, and BitLogin on a panel in front of them.
- **[NSWP-05](protocol/05-looks.md), "Changing a look":** "Change how you look" is in every world's console, under "You". Like signing in, it leaves for the visitor's own client (`who=look`, [NSWP-02](protocol/02-doors.md)) and brings them back wearing it. A world never edits a look and never sends one back: a look a world could write is a mark it could follow a visitor by. In BitPortal the look is changed in the room, from the menu, with the visitor's own figure standing there to show them: the same controls on a phone, at a desk and on a headset's wrist.
- **[NSWP-11](protocol/11-the-visitors-console.md), "What is in it":** one order for every menu and taskbar. The kit orders the things every place has (home, the headset, the room, the microphone, jump), so the first key is the way home in every world whatever order a world's code added things in. Sections have one order too, with Sound and Display in it. The section for how the controls look is now called "Display", since "your look" is how other people see you.
- **What was different and is now the same:** the seven reference worlds had "Home, Join", the template "Home, Doors, Join", and their Travel sections began with different things. The worlds had no Panels section and the template did. Sound came after Help. All of them now have the same things in the same places. A world with no room has no Join, and that is the only kind of difference left.
- **[NSWP-07](protocol/07-homes.md):** a world that can be a home offers the way to their doors to the visitor whose home it is, where every other world offers the way home, not beside it for everyone.
- **In the kit:** `portal.changeLook()`, `figureAction`, `STANDARD_ORDER`, `hud.setOpen(true, section)`, a swatch whose colour follows what it shows, and `leaving` on `addViewControls` may bring the crossing's room up first. **For other engines:** `NSWP.changeLook(state)` and a `figure` event (script version 6); `Nswp.change_look()` in Godot.
- **What this does not do:** draw the sign-in inside a headset session. An immersive session can't show a page, and a password is typed into one. From a headset the sign-in is seen on the headset's flat screen, and the world offers the way back into VR after.
- **Status (2026-11-19):** not deployed. On the local server in Chrome: from a world's menu by its crossing's room to the sign-in place and back; to the room to change a look and back wearing it; with the Airlock's throwaway test identity, by name with nothing chosen, and as a guest once "as a guest" was set; the menus of the room, eight worlds and the Godot example listed side by side. **Not tried:** a real BitLogin sign-in, a headset, a real phone.

## 0.18.0

Signing in from inside a world.

- **[NSWP-10](protocol/10-identity.md), "Signing in from inside a world":** a visitor no longer has to go home to sign in. Every world's console has a control under "You" that says who they are there ("You are a guest here. Sign in", or "Here as Alice. Switch profile, or go as a guest"). Pressing it leaves for the visitor's own client, which asks them on its own page, and brings them back to the same world: by name if they chose that, as a guest if not. A world still never shows a sign-in and never holds a key. The control is a door, and that is all it is.
- **[NSWP-02](protocol/02-doors.md):** a new flag on a door, `who=1`, which a world puts on a door back to itself. It is a request and nothing more: it signs nobody in, sends nobody by name and skips no check. A client with no sign-in ignores it.
- **A world's own door** is the announcement its manifest lists for its address (`doorFor` in the core, `portal.here()` in the kit), so the visitor's client can check it like any other and hand over a pass.
- **In the kit:** `portal.signIn()`, and the control comes with `addViewControls`, so a world built with the kit or the template has it with no code. The console has a standard "You" section, second after Travel. **For other engines:** `NSWP.signIn(state)` and an `identity` event (engine script version 5); `Nswp.sign_in()` in Godot. A world may draw the button anywhere in its own interface: `identity` in [NSWP-11](protocol/11-the-visitors-console.md)'s table.
- **In BitPortal:** the Airlock sends a `who=1` door to the sign-in page, keeping the door for the tab. The page offers "Back to *the world*, by name", with what going by name gives away written under it, and "Go back as a guest". The way back leads only to BitPortal's own Airlock, which checks the door. Asking for a name that can't be given (the site hasn't proved who it is) stops at the Airlock and says so.
- **The sign-in page's profile box** was half the page's width with BitLogin's small text inside it. It now takes the page's width when signed in, and BitLogin's element is scaled as one piece to match the page's text.
- **What this does not do:** put the sign-in inside a world. The page changes to the client's and back. That is deliberate: a sign-in drawn inside a world is what a phishing world would draw, and a visitor's real protection is the address of the page they type into.
- **Status (2026-11-19):** not deployed. On the local server in Chrome: from a world's menu to the sign-in page and back to the same world as a guest; and by name with the Airlock's throwaway test identity, where the world's control then read "Here as Test visitor". A link with `who=1` to a site nobody announced showed the sign-in page and then the Airlock's whole screen. **Not tried:** a real BitLogin sign-in in this flow, a headset, a phone, Godot in a browser (the script and the addon were built, and the Godot example was not re-exported).

## 0.17.5

Settings between devices, and whose business that is.

- **[NSWP-11](protocol/11-the-visitors-console.md), "Settings that travel":** what goes through a door is the settings a visitor has now. Keeping them with the visitor's profile, so that another device starts from them, is the client's business and never a world's. A world never reads such a note: it couldn't open it, and a world asking relays about its visitors would be a way to follow them. The arrival stays the only place a world learns anything about its visitor.
- **In BitPortal:** a signed-in visitor can turn on "Keep my settings with my profile". One note on their relays (NIP-78, kind 30078), sealed with NIP-44 to their own key by BitLogin, fetched behind the browser's own copy, with the newer of each section kept. Where they have been, per-device consents, computers and files never go in it. Off until they turn it on.
- **Status (2026-11-18):** not deployed. Tried with throwaway keys and no relay: unit tests, and in Chrome with a stand-in key and a shelf in the tab's own storage, where a wiped browser got its settings, volumes, way of moving and a saved door back and nothing was sent to a relay. **Not tried:** a real sign-in, two real devices, a real relay.

## 0.17.4

The visitor's things in a world's own interface, and a filled screen back at the first press.

- **[NSWP-11](protocol/11-the-visitors-console.md), "Drawing it yourself":** a world may put any of the visitor's things into an interface of its own, wherever it likes and drawn its own way: the way home on its pause menu, the volumes on its settings screen, a button that brings the whole console up. What makes that safe is that it is the same thing behind the button: it does what the console's does, reads and writes the visitor's own settings, and "home" is the visitor's home, never the world's. The document lists them by the names a world presses them by.
- **For other engines:** `NSWP.view()`, `NSWP.run(id)`, `NSWP.open(on)` and a `changed` event in the engine script; `Nswp.console_view()`, `Nswp.run(id)`, `Nswp.open_console()` and `console_changed` in Godot. In the kit this was already `controls.view()`, `controls.run()` and `hud.setOpen()`.
- **Fullscreen is the first thing looked at on arriving.** It was looked for only once the place was built and the crossing's room had started to open, so the screen filled a moment after the doors did. Now it is looked for as the arrival is read, before anything is built, and taken at the visitor's very first press of any kind: a key, a click, a touch, or a key already held as they walked through the door. If a press isn't one the browser will take, the next is tried. A hint says so if the screen is still waiting.
- **What can't be done:** filling the screen with no press at all. A browser gives up fullscreen whenever the page changes and fills it again only on a press. That is the web's rule and no page gets round it.
- **Status (2026-11-18):** not deployed. In Chrome on the local server, arriving in the Gallery with the screen marked as filled: a key pressed while the crossing's room was still shut filled the screen before its doors opened; leaving fullscreen afterwards held. **Not tried:** a key held across the crossing (a test can't hold one through a page change), Firefox, Safari.

## 0.17.3

An Airlock that is only seen when there is something to see.

- **[NSWP-02](protocol/02-doors.md), "How many actions a crossing takes":** an Airlock goes straight through to a place the visitor knows. Its question is for somewhere new; asked at every door, it teaches people to press Continue without reading. "Knows" is narrow and every part has to hold: the site proves it is who it says, this time as before; the client's host lists it; the visitor has been through the Airlock to it before, with the same publisher; and nothing has changed, is warned about, or is waiting for an answer. If one fails, the whole screen is shown and they are asked.
- **In BitPortal:** on by default, and a switch in Settings ("Go straight through doors to places I've been before"). The first crossing to any world still stops and shows the real address. Later ones show where the visitor is going, with a Stop button, for the second or so the door takes to check, and then go. "Stop here" while it is checking, "Always stop here for this world", and the switch each bring the whole screen back.
- **Status (2026-11-18):** not deployed. On the local server in Chrome: the first crossing asked; the second went through in about a second with nothing pressed; from a room with a microphone on, joined went along and the microphone did not; Stop while checking, "always stop" for the world, the switch turned off, and a publisher that wasn't the one it had been each brought the whole screen back. **Not tried:** a headset, where it matters most.

## 0.17.2

One page for everything a world has to do and everything it may replace, and a probe that tries a world for itself.

- **[docs/integrating.md](docs/integrating.md):** the agreement and the defaults, on one page. Eleven things every world keeps, each with where it is written. Then what the kit gives by default (the menu, the sounds, the music, the doorway, moving, the marks on the floor, the crossing's room, how visitors look, rooms, panels), how to replace each, and the one thing that must stay true when you do. Four ways to build, and a table of everything that goes with a visitor and whether they are asked about it.
- **Signing in is not on either list.** It belongs to the visitor's client and never to a world. In BitPortal it is BitLogin, and a world can't replace it because it isn't in a world. The protocol itself names no sign-in.
- **`scripts/probe-world.mjs`:** tries a world on a phone-sized touch screen, at a desk and with a made-up headset, and says for each whether it loaded and drew, didn't load at all, or couldn't be confirmed. For whoever lists worlds, so that what a world's maker declares isn't the only thing a visitor is told. An Airlock can't do this at the moment of crossing: loading a world is visiting it.
- **In BitPortal:** the Airlock is cut down to where the door leads, what has to be known or answered, and the way through, with the rest under "More about this place", which holds a crossing while it is read. It says, before a visitor goes, when a world failed when tried on their kind of device or its maker says it isn't for it. And the sign-in page is BitLogin drawn in BitPortal's colours, with staying anonymous and switching profile beside it.
- **Proposed in [NSWP-08](protocol/08-lists.md):** carrying what a curator found in the list itself, signed with it.
- **Status (2026-11-18):** not deployed. The probe was run against the live reference worlds and the other sites on BitPortal's list; what it found is in BitPortal's repository. Its "works" means a page loaded and drew under a software renderer, or a session started with a made-up headset; it is not a person trying the world on a real phone or headset.

## 0.17.1

Marks on the floor for a casual walk, and a door that answers only from near it.

- **Where a press would take you.** Moving the casual way on a flat screen, a ring on the floor follows the pointer, on the spot a press would walk to. Once pressed, a dot marks where the visitor is headed and a dotted line runs from their feet to it. They are drawn for that visitor alone: nobody else in the room is told anything about them. A finger has nothing to hover with, so a touch screen has the dot and the line and no ring.
- **A door answers from within ten feet** (`DOOR_REACH`). Nearer than that it lights when pointed at, and a press goes through it. From further off it is not lit, and a press on it is a walk towards it, so a stray click on a door across the room no longer starts a crossing. Walking into a doorway always goes through. The menu still lists every door.
- **Moving the intense way, a doorway is walked into.** F and a click no longer go through a door; they still press panels and buttons.
- **A press reaches six metres, where it reached three** (`TAP_REACH`). Standing up and looking level, the floor nearer than about 2.8 metres is below the bottom of the screen, so at three metres the dot and nearly all of the line could not be seen. It is still a walk at the keys' pace, and it is shown before it is taken.
- **The reference worlds, BitPortal's room, the world template and the Godot addon** all have these.
- **Status (2026-11-18):** not deployed. In Chrome on the local server, in the Gallery: the ring sat where the pointer was and no further than six metres; a click showed the dot and seven dots of line, and the visitor arrived on the dot with the marks gone; moving the intense way there were no marks; on an emulated touch screen, a tap showed the dot and the line and no ring. Five metres from a door it was not lit and a press walked to two metres from it; there it lit, said where it led, and a press went through. Moving the intense way, F and a click on it did nothing and walking in went through. The same in the Godot example. **Not tried:** a headset, a real phone.

## 0.17.0

Settings that travel. A protocol change: one new flag on a link (`set=`) and one new field in the arrival context (`settings`), in [NSWP-11](protocol/11-the-visitors-console.md).

- **The problem.** Each world is a different website, and a website can only remember what a visitor chose on that site. So someone who turned the music down, made the text larger or filled their screen had to do it again in every world.
- **What travels now:** their volumes (all off, effects, music, voices, the room's hum), the size of text and controls, whether things move, their hands in a headset (which wrist, which stick, how far a turn goes, the view narrowed), and whether their screen was filled. A world says them on the link; the visitor's client passes them on; the world they arrive in starts from them in place of what it remembered. They go home too, so what was changed in a world is not forgotten on leaving it.
- **A screen that was filled is filled again** at the visitor's first key or press on arriving. A browser gives up fullscreen whenever the page changes and fills the screen only on a press, so that is as soon as it can be.
- **What never travels this way:** anything that would need asking about. A microphone, who is blocked and hearing other people's music keep their own rules. A world's colours stay the world's.
- **They are preferences.** A forged link has turned a volume down. Nothing is asked, nothing is shown, and a reader keeps what it knows and is in range and ignores the rest.
- **In the kit** (`settings.ts`): each part that holds a setting begins from `arrivedSettings()` and reports what the visitor has now; `arrival.read()` and `portal.go()` do the rest. Nothing for a world to do.
- **Fixed on the way:** on a development server, an arrival longer than 300 characters was not followed to its local copy and went to the real site. A long arrival is the normal case once it carries settings or a pass.
- **Status (2026-11-18):** not deployed. On the local server in Chrome: music off, effects low, larger text, less motion and a filled screen, set in the Gallery; the Grove began with all of them, and filled the screen again at the first key; a volume changed in the Grove was there in BitPortal's room on coming home, with the rest. The Godot example began from settings it arrived with (music off, larger text, the screen filled at the first key) and sent them on through its door. **Not tried:** a headset (its hands travel, untested), Firefox, Safari.

## 0.16.1

Arriving as you left, walking straight through a door, and knowing what is playing.

- **Intense stays intense through a door.** A visitor moving the intense way arrived in the next world with the grabbing-hand pointer of the casual way, and had to click before the mouse would look again. A browser hands a page the pointer only after a press, and they had pressed nothing there yet. Now the mouse looks round at once, by its own movement over the view, with the pointer's picture hidden and the dot in the middle; the pointer itself is taken at their first key or click, with nothing asked. Walking with the keys never needed the click, and now takes the pointer too.
- **Walking into a doorway goes through it.** The crossing's room came up round a visitor however they took a door. It still does for a door chosen from where they stand (a click, a trigger, the menu). A visitor who walks into a doorway is already going through it: nothing is brought up, and they go at once. They arrive standing in the room at the other end either way. In the reference worlds, walking into a doorway on a flat screen now goes through it at all; it only did in a headset.
- **What is playing.** The Sound section names the piece of the place's music that is playing, by its file's name ("Playing here: room-e. Next of 8"), and pressing it goes on to the next. "Music: off" still silences it.
- **Godot's visitor** arrives moving the intense way with nothing to click, the same.
- **Status (2026-11-18):** not deployed. In Chrome on the local server, arriving in the Gallery, BitPortal's room and the Godot example moving the intense way, with nothing pressed: the pointer's picture was hidden, the mouse turned the view (200 pixels, 25 degrees), and the first key took the pointer. In the Gallery, a door chosen brought the room up, and a doorway walked into led to the Airlock with the room never coming up. The Sound section read "Playing here: music. Next of 2" in the Gallery and "room-b. Next of 8" in BitPortal's room, and pressing it went on to the next. **Not tried:** a headset, Firefox, Safari (which may be stricter about taking the pointer on a key).

## 0.16.0

The visitor's console over a world's own interface, and arriving in the form you left in. Both are now part of the protocol: [NSWP-11](protocol/11-the-visitors-console.md).

- **The summons.** A world with an interface of its own could already put the traveller's controls away altogether. A visitor then had no way to bring them back unless the world offered one. Now one gesture on each kind of device is the visitor's in every world, and brings their console up over whatever the world is showing, at any level, whatever the world has done with the keys: the key left of 1 at a desk, two fingers held still on a touch screen, B or Y held in a headset. No world uses it for anything of its own.
- **Coming and going leaves nothing behind.** The console is drawn over everything while it is up. The world is told (`menuOpen`, `menuClose`). When it goes, a hidden console leaves the screen exactly as it was, whatever had the keys has them back (the world's own menu, if that was open), and the world never heard the key.
- **Hidden means hidden, and no longer means out of reach.** So a world that hides the console no longer has to rebuild the visitor's things in menus of its own. The one case where that duty stands is a headset with tracked hands and no controllers, which has no summons for a hidden console yet.
- **The same form on the other side** (`form=touch` or `form=desk` on a door's link, `form` in the arrival context). A visitor on a touch screen arrives laid out for touch, and one at a desk for a mouse and keys. Most devices can only be one, and a world worked that out already; this is for the ones that can be both. A world follows it where the device can and ignores it otherwise. Headset to headset was already carried (`xr=1`, `immersive`). It is not sent on the way home.
- **In the kit:** `mountHud` listens for the summons before the page hears anything (`ui/summon.ts`); `createXrInput` takes `onSummon`; `startingForm()` and `currentForm()` (`form.ts`) say what form a visitor is in, and the kit carries it through a door. The engine script has `NSWP.presence()` and `NSWP.claim()`, and Godot `Nswp.set_presence()` and `Nswp.claim_keys()`.
- **The menu comes up on Travel,** where the way home is, until the visitor picks another section. It was coming up on Look.
- **What this is not:** a layer above a world. A web page can't draw over another site, so the console is still drawn by the world's own page, and a world built some other way keeps this only by choosing to. A client that is there whatever a world does has to be the browser (`browser/spec.md`).
- **Status (2026-11-18):** not deployed. In Chrome on the local server, in the Gallery, BitPortal's room and the Godot example, each having hidden the console and claimed every key, with a menu of its own open and focused: the world's own menu key did nothing to ours; the key left of 1 brought the console up and put it away; the world heard neither press; nothing of ours was on screen before or after; and the world's menu had the keys again. On an emulated touch screen, two fingers held brought it up and put it away, and a pinch did not. A visitor told `touch` at a desk with no touch screen stayed at a desk, and one who used touch left with `form=touch`. **Not tried:** a headset (the held button is tested as arithmetic), a real phone, and a real device that is both touch and desk (that choice is tested as arithmetic too).

## 0.15.6

Footsteps that sound like footsteps, and running and jumping however a visitor moves. Nothing in the protocol changes.

- **Footsteps.** Each was the same recording at the same loudness, a thousand times a visit. Now a step is under half as loud as any other cue, and no two are alike: each is up to a semitone and a half higher or lower, lighter or heavier, softer or brighter, and a touch to the side of the foot that made it. One foot falls a little lower than the other. It is done as each is played (`stepShape` in `sound-store.ts`), so no sound file was added or changed, and a world's own step gets the same.
- **Running, in every way of moving.** It was Shift, moving the intense way at a desk, and nothing else. Now: Shift with the keys moving the casual way too; two clicks or two taps on the floor run there (`createStroll` does this itself); and in a headset, walking smoothly, pressing the moving stick in runs until the stick is let go. One number for all of them (`RUN`).
- **Jumping** (`jump.ts`, `addJump`): the same small jump everywhere. Space at a desk, a Jump control kept at hand where there is no keyboard, and A or X in a headset. It takes the same time at any frame rate, changes nothing about where a visitor may stand, and no step is heard in the air.
- **The reference worlds, BitPortal's room, the world template and the Godot addon** all have both. BitPortal's room and the template now walk at the kit's pace with the keys (they were a little slower).
- **A headset moving the casual way has no run:** it moves a step at a time, so there is nothing to speed up. It has the jump.
- **Status (2026-11-18):** not deployed. On the local server in Chrome, in the Gallery, BitPortal's room, the template and the Godot example: the ten or so steps of a short walk all differed, over about three semitones, at between 0.28 and 0.43 of a cue's level; Shift ran faster than a walk moving both ways; two taps ran and one walked; Space lifted the visitor 0.45 m and put them down, and didn't open the menu. In Godot: 2.4 m/s walking, 4.3 running, and the Jump control at hand on an emulated touch screen. **Not tried:** a headset (the stick and the A button are tested as arithmetic only), a real phone. **Nobody has heard the steps:** the numbers say they differ and are quieter, not that they sound right.

## 0.15.5

Links that lead to the local copies on a development server, and the kit's own menu, sounds, doorway and movement for a world made in Godot. Nothing in the protocol changes.

- **Links on a development server.** A site is built for its real address and stays that way, so what is tried is what gets deployed. While it is served from a developer's machine, the server publishes a map, real address to local copy (`/.well-known/nswp-local.json`), and a page follows it when it sends the browser on: a door in the local Gallery leads to the local Airlock, and on to the local Grove. Once deployed, a page asks for no map and every link is the real address. Nothing is switched. See [docs/local-server.md](docs/local-server.md).
- **Three limits on that** (`packages/core/src/local.ts`): only a page that is itself on a local address over plain http asks for a map; a map can only lead to a local address; and only the last step changes, so what a door says, what an Airlock checks and what an announcement is signed over are still the real address. The Airlock says on its card when it is sending a visitor to a copy.
- **The engine script carries the kit's menu and sounds** (`packages/sdk/src/engine-menu.ts`): the same menu, drawn by the page over an engine's canvas, and the same sounds, at the volumes the visitor set. An engine asks each frame what the visitor chose (`NSWP.events()`), and says how far they walked so their steps are heard. `NSWP.kit()` gives the numbers every world shares.
- **Godot gets the defaults.** `NswpGate` is the standard doorway: its frame is the kit's own model, written out as a mesh by the kit's modelling code, and its metal, its field of light and its glow are the kit's shaders written for Godot. `NswpVisitor` moves the casual way or the intense way at the kit's speeds. `Nswp.menu()` puts the menu and sounds on. Each can be replaced: `NswpPortal` is still a door with nothing drawn.
- **Shared, so they can't drift:** the doorway's size (`gate-size.ts`), the fullscreen control (`ui/fullscreen.ts`), the words on the desk control (`fps.ts`) and how far a drag turns the view (`DRAG_LOOK`) are each in one place that both the Three.js kit and the engine script read. A test fails if the numbers written into the Godot addon stop matching.
- **`npm run engine:check`** now covers the doorway's mesh and the sound files copied into the addon, as well as the script.
- **Status (2026-11-18):** not deployed. On the local server, in Chrome: from the Gallery, a door led through the local Airlock to the local Grove, and the way home to the local BitPortal, on this machine's address and on its network address; the Godot example's door did the same. The Godot example was tried with a mouse and keyboard: the menu, a door lit and described when pointed at, a click on the floor walking exactly the kit's reach, a drag turning the view, the mouse looking round, a run with Shift, and the menu opening when the pointer is taken back. A tap on an emulated touch screen walked the same reach. **Not tried:** a real phone, a real headset, Firefox, Safari, a pass by name on a development server. Nobody has listened to the sounds in Godot. **Not in the Godot addon:** moving in a headset, the crossing's room, the view through a door, other people.

## 0.15.4

The Godot addon has been run, and there is a world made with it to look at. Nothing in the protocol changes.

- **An example world in Godot** (`engines/godot/example/`, with a project file beside it): two entry points, a door to the Gallery, the way home and the way into a headset, in one script. `npm run build:godot` exports it for the web and puts the kit's script beside its page; it needs Godot 4 and its web export templates.
- **The local server** serves it with the other sites, when it has been exported.
- **The addon needed no changes** to run. Its README now says what was run and what wasn't, and that Godot needs the browser's WebXR Layers for a headset session.
- **Status (2026-11-18):** run in Godot 4.7.2, exported for the web, in Chrome on a flat screen: an ordinary link stands the visitor at the main entrance; an arrival naming the balcony stands them there, carries how they move, and is taken out of the address; walking into the door leads to their Airlock with where they are going; the way home leads home. With a made-up headset on the page, Enter VR is offered, and a session that can't start says why. **Not tried:** a session in a real headset (the made-up one lacks what Godot needs), a phone, Firefox or Safari.

## 0.15.3

Worlds in other engines, starting with Godot. Nothing in the protocol changes: it never said how a world is drawn.

- **`engines/nswp-engine.js`:** what makes a website a world, as one script with no rendering in it: how the visitor arrived, a door out, the way home. Text in and text out, since that is what any engine can pass to a page. It runs under the same strict content policy as the reference worlds.
- **A Godot addon** (`engines/godot/addons/nswp/`): an `Nswp` autoload (`arrival`, `place()`, `go()`, `home()`, `doors()`) and an `NswpPortal` node for a door. It ends a headset session before a crossing and carries how the visitor moves.
- **[docs/other-engines.md](docs/other-engines.md)** says what any engine has to do, and what it draws for itself.
- **Not in it:** rooms (other visitors and their voices), and Unity or Unreal.
- **Status (2026-11-18):** the script is built and tried in Chrome on a bare page: an ordinary link, a full arrival read and taken out of the address, a pass for this site giving a name and one for another site giving none, doors refused with a word for why, and `go`, `home` and `doors` each leading to the right Airlock address. **The Godot addon is written and has not been run:** Godot isn't on the machine this was written on.

## 0.15.2

Signs that are the right size wherever you stand, a crossing that nothing pokes into, and a way to try builds on your own machine.

- **Signs.** A sign made to be read from across a room filled the screen of anyone standing next to it: it was a size in the world, and what a reader needs is a size in their view. Two rules now. On a flat screen, what something is goes beside the controls: `controls.setTarget(name, detail)` shows a small card, always the same size, never in front of the thing. In the world, `viewScale(distance, { at })` keeps a sign the same size in the visitor's view, within limits.
- **BitPortal's room** follows both: pointing at a door shows its address, what it is, why it is there and how to go, in a card over the buttons. The sign that hung in front of the door is a headset's only, low on the door and a steady size. The first-visit hint moved the same way.
- **The crossing's room is drawn over everything.** It stands round the visitor wherever they are, which may be half inside a bench or another person. It is now drawn last, on a cleared depth, so nothing shows inside its walls or through them; the visitor's own hands and console are drawn after it; and other people aren't drawn while it stands.
- **A local server** (`node scripts/serve-local.mjs`): the built sites, each on a port of its own, on this machine or the local network with `--lan`. A door still leads to the deployed sites, since each world is built for its real address.
- **Found on the way:** a ranking reason with nothing to say for itself was showing as the bare word "Tastes" in BitPortal ("…ranks it highly and Tastes"). It is left out.
- **Status (2026-11-18):** built, not deployed, and running on the local server. Looked at in a browser: a door's card the same size from the middle of the room and from the doorway, with the view through the door clear; and the crossing's room stood in the middle of the Grove's hearth, with none of its crystals showing inside. The headset's sign was not looked at in a headset.

## 0.15.1

The two ways of moving have one pair of names, at a desk and in a headset: casual and intense.

- **"Game controls (FPS)" is now "Desk controls: casual / intense".** Nothing about them changed but the name.
- **A headset has the same switch:** "Headset controls: casual / intense". Casual is stepping, turning a notch at a time, with the view narrowed while moving, as it was. Intense is one stick walking and the other turning, smoothly, with the whole view. Until now those were four separate settings; they still are, underneath, for fine tuning.
- **Each device keeps its own.** Choosing intense at a desk never makes a headset slide. Smooth movement in a headset makes some people ill, and that choice is made in the headset.
- **The preference that travels is `moving=intense`,** on the link and in the arrival, in place of the `fps` flag 0.15.0 gave it for a few hours. Nothing had shipped with the old name. It applies to the device the visitor arrives on.
- **Status (2026-11-18):** built, not deployed. Tried in Chrome and an emulated headset: both switches, the headset one setting and unsetting smooth walking, smooth turning and the narrowed view; arriving from a headset intense in the headset and casual at the desk, and the other way round.

## 0.15.0

Game controls on a desk, and fullscreen.

- **Two ways to move on a desk.** The one there was stays, and is what a visitor gets: click where you want to stand, drag to look round. The new one is for people who play games: the mouse looks, W A S D walk, Shift runs, F uses what is in the middle of the view (a click does too), and Escape brings up the menu. It is turned on in the menu, under Moving, and kept for the site.
- **Offered where there is a mouse.** Not on a phone, and it stands down in a headset.
- **Escape is the menu** because a browser takes the pointer back on Escape whatever a page wants. Closing the menu goes back to looking, and where the browser won't allow that yet, a click does.
- **Fullscreen,** in the menu under View. In fullscreen, where the browser allows it, one press of Escape is the menu and holding it leaves.
- **It travels** ([NSWP-02](protocol/02-doors.md), [NSWP-03](protocol/03-arrival.md)), so a visitor who chose it in one world has it in the next. A preference only: nothing is asked. (Its name on the wire changed in 0.15.1, before anything shipped.)
- **The kit:** `createFps`, with `lookAfter`, `strideOf` and `heldKey` for anyone building their own. The reference worlds, the template and BitPortal's room use it.
- **Not in it:** jumping and crouching (the kit has neither), moving a panel by its bar while the mouse is looking (bring up the menu first), and changing the keys.
- **Status (2026-11-18):** built, not deployed. Tried in Chrome on one machine, in the Gallery, the template and BitPortal's room: off to begin with; turned on and kept; the first click taking the pointer; the mouse turning the view; W and S walking, Shift running at about one and three-quarter times the pace, and standing still with nothing held; Escape opening the menu with the pointer back, and a click looking again; F going through the door in the middle of the view; arriving with it on when the visitor's client says so; fullscreen on from the menu; and the ordinary way of moving still working when it is off. Not tried by a person with a real mouse, where how fast the view turns is the thing to judge.

## 0.14.2

A second piece of music for every place.

- **Twelve more pieces the owner picked** are in: one for each reference world and for the default (`music-2.ogg`, `music/default-2.ogg`), and four for BitPortal's room. Each place now plays two in turn, and the room eight.
- **They were made with YuE2,** a music model, on the owner's own machine. The agent that made them reported the model's terms for redistributing output as unclear, and they were left out of 0.14.1 for that reason. The owner settled it on 2026-11-18 ("YuE2 is clear for us to use. Ship them"), and the kit's sounds README records that.
- **Two to listen to:** the Observatory's second piece has one sharp sound at about 62 seconds, and the Workshop's has five between 57 and 84 seconds, which may be the plucks it was asked for. Measured, not judged by ear.
- **Status (2026-11-18):** built, not deployed.

## 0.14.1

The sounds are recorded now. The owner chose them by ear.

- **Seventeen cues, a room's hum and a piece of music** come with the kit as files (`packages/sdk/sounds/`), chosen by the owner from candidates made for this project. The cues came from a sound-effect model under the Apache licence and from code; the hum and the music were made in code. That folder's README lists each and where it came from.
- **The ones made in the browser stay** as what plays where the kit's files aren't served or a file can't be played.
- **Several for one cue.** A cue may have several files and one is chosen each time, never the same twice running: drop and hover have two each. A world may do the same.
- **Several pieces of music for a place** play in turn, each fading into the next with the loudness held level. A single piece fades into itself the same way, so a loop has no seam and no dip.
- **The room's hum** is its own layer under the music, with a switch of the visitor's own. A world names its own or says none.
- **Each reference world has its own music** (`sites/<name>/sounds/music.ogg`).
- **Nothing is fetched before a visitor's first touch** but a small list of what there is.
- **Played as it arrives, not held whole in memory:** a minute of music held whole is tens of megabytes.
- **Not included:** twelve more pieces of music the owner also picked, from a model whose terms for redistribution are unclear. They wait on the owner's decision.
- **Status (2026-11-18):** built, not deployed. Measured in Chrome on one machine: in the Grove, the template and BitPortal's room, only the list fetched before a touch, then nineteen cue files, the hum and the place's music; all seventeen cues heard from the files; the hum's switch changing what is heard; and, with two six-second pieces of steady noise as a world's music, three hand-overs in twenty seconds with the loudness staying within about three per cent. Not listened to in the game by anyone yet, and not tried in Safari, where the MP3 forms are what would play.

## 0.14.0

Blocks that travel: someone blocked in one world stays blocked in the next.

- **Why it needed the protocol.** A block is carried out in a visitor's own browser, on one site. Each world is its own site, so a block made in the Gallery meant nothing in the Grove. What goes everywhere a visitor goes is their own client, so the list is the client's.
- **`blocked` on the link** ([NSWP-02](protocol/02-doors.md)): a world reports the people its visitor blocked there during this visit, by identity key.
- **`blocked` in the arrival context** ([NSWP-03](protocol/03-arrival.md)): the visitor's client hands their list to each world they arrive in. The world leaves them unconnected to anyone on it, for that visit, and keeps nothing.
- **A link is something anyone can write,** so a client never adds to the list unseen: it names who, and the visitor says yes. It doesn't hurry past the question. Nobody is taken off the list by a link, ever.
- **Only people who go by name.** A guest is a new key each visit.
- **The cost:** each world arrived in learns the keys on the list. BitPortal says so where the list is kept.
- **BitPortal:** the Airlock shows who a world reported, with a box to tick ("Block this person everywhere you go"), unticked. Settings on the front page lists everyone blocked everywhere, with Unblock, and anyone reported on the way home, still waiting for an answer. People blocked in BitPortal's own room are part of the list already. In a world, the People part of the menu says how many are blocked wherever the visitor goes.
- **Status (2026-11-18):** built, not deployed. Tried in Chrome with the Grove, the Gallery and BitPortal answered from their builds at their real addresses, every relay the test, and throwaway keys: someone who goes by name blocked in the Grove; the link reporting her; the Airlock naming her, unticked, with no countdown; ticked, the two never connected in the Gallery, which kept nothing; not ticked, she was there; a link somebody else wrote adding nobody; a report on the way home waiting, shown in Settings, and forgotten there; and Unblock in Settings emptying the list. Not tried with a real sign-in.

## 0.13.5

Muting, in two parts.

- **A person's voice and their music are muted apart.** Select someone in the People list: "Mute their voice" and "Mute their music" are two switches. Their voice without their music, their music without their voice, neither, or both. Muting someone's voice no longer takes their music with it, as it did for one release.
- **Their music can be muted before they share any,** so it never starts.
- Blocking is unchanged: it ends the connection, so a blocked person's figure, voice, music and screen are all gone for the visitor who blocked them, and nothing of theirs can reach that visitor. Everyone else still sees them: only a room's host could remove someone for all, and rooms have no hosts yet.
- **Unblocking is plain to find.** The People part of the menu says how many people are blocked, in a room or out of one, with "Unblock" beside each name.
- **Status (2026-11-18):** built, not deployed. Tried with three visitors on one machine: a voice muted with the music still heard, the music muted with the voice still heard, and each put back.

## 0.13.4

Music shared with people nearby. Nothing in the protocol's signed formats changes.

- **Sharing.** A visitor playing their own music in a room can offer it to people near them, from the Sound menu.
- **Hearing.** Off until a visitor turns on "Hear music others share". Nobody's music reaches anyone who didn't ask, and nobody's leaves their device unless they offer it.
- **By distance.** It is full beside the person sharing, fades with distance, and is nothing at twelve metres. Past that it isn't asked for and isn't sent.
- **Under voices.** Shared music steps back while anyone is speaking and comes forward after.
- **The nearest two.** One visitor hears at most two people's music at once.
- **One person's music** can be silenced without silencing their voice. Blocking them covers their music too.
- **The sharer is told how many are hearing it.** Stopping, or leaving the room, ends it for everyone.
- **A world can switch it off** in its space (`sharedMusic: false`): a concert, a library. Each visitor's own music still plays for them.
- **On the wire:** a third line to each member, for music, agreed from the start and left empty, like the screen's. `mus:1` says music is offered and `hear:1` asks for it; both repeated while true.
- **What to know:** it goes from one browser to another and never through a server of anyone's. It is still playing music to other people, and what a visitor shares is theirs to answer for. And a microphone hears speakers: with both on, headphones, or the others hear it twice.
- **Status (2026-11-18):** built, not deployed. Measured in Chrome on one machine with three visitors and a stand-in relay: offered and unheard until a listener turned hearing on; then heard, and the sharer told one person was hearing it; a third who never asked sent nothing; a quarter as loud at seven metres; stopped at twenty and the sharer told nobody was hearing it; heard again on coming back; a third as loud under a voice and back up after; one person's music silenced with their voice untouched; and ended for all when the sharer stopped. Not listened to, and not tried across two networks.

## 0.13.3

Sound. Until now a place was silent but for voices. Nothing in the protocol's formats changes.

- **Cues.** A short sound for something that happened: a step, landing a jump, walking into something, a press, the menu, going through a door and coming out, someone joining or leaving, the microphone, a notice, an error. A closed list of seventeen. Each has a default made in the browser from tones and noise, so there is no file to fetch or license.
- **A place's own music.** When a world names none, the kit makes a quiet one from the place's title: held notes that swell and fade, with single notes over them. The same for everyone there, different from place to place.
- **A world's own sounds.** For any cue, a file on the world's own site to play instead, or null for silence; for the music, a file, or null for none. Whatever it doesn't name keeps the default. A file on another site is refused: it would tell that site who is here.
- **How loud is not the world's to say.** A world's cue is brought down to the loudness of the defaults, a cue over three seconds or half a megabyte is refused, and everything goes out through one limiter.
- **The visitor's volumes** are theirs, kept for the site: effects, music, other people's voices, and all sound off. No world sets them.
- **The visitor's own music.** Songs added from their own device, kept in the browser for that site. Only they hear it, and the place's music steps back while it plays.
- **Steps are made from how far a visitor was moved,** not from how their head sways, and nobody sends anybody a sound: what is heard of other people is their voice.
- **Nothing before the first touch.** A browser holds sound back until then.
- **The kit:** `createSounds`, `addSoundControls`, `controls.signal()` and `onSignal()`; `createStroll` says when a wall stopped it. The reference worlds, the world template (a `sounds/` folder and `"sounds"` in `world.json`) and BitPortal's room use them.
- **Not built:** sound placed in space (another person's steps where they are), a sound for grabbing and dropping with a controller, and sharing music with people nearby, which is its own piece.
- **Status (2026-11-18):** built, not deployed. Measured in Chrome on one machine, since nobody was listening: silence before the first touch; every cue heard; a walk of two metres making two steps; the menu heard; the place's music playing; all sound off being silence; volumes and a song kept through a reload; a song added from a file, played and taken out; and, in a copy of the template with sounds of its own, its step and its music used, a silenced cue silent, a five-second file refused in favour of the default, and a loud file brought down. **Not judged:** what any of it sounds like. Whether the defaults are pleasant is for ears.

## 0.13.2

A shared screen in a room (the browser plan's stage A4). Nothing in the protocol's signed formats changes.

- **Share your screen** from the Room controls, where the browser can offer one: a desk or a laptop. A phone or a headset can't share, and can watch.
- **Offered, not shown.** Sharing sends nothing by itself. Everyone in the room is told it is there, and it goes only to members who choose to watch. A room is open to strangers, and a picture nobody asked for is the easiest way to spoil one.
- **Watching** is in the People list, for someone who is sharing. Their screen opens on a panel of the watcher's own, which they move, size, make see-through, pin and put away like any other. Putting it away stops it being sent.
- **The sharer is told how many are watching.** Stopping, leaving the room, or the browser's own "Stop sharing" takes it from everyone at once.
- **On the wire:** the connection to each member has a line for a screen from the start, left empty, so sharing needs no second handshake. `scr:1` says a screen is offered and `watch:1` asks for it; both are repeated while true, as "I am recording" is.
- **What to know:** a room runs in the world's own page, so that world's code can see a shared screen as it can everything else in a room (§9.8). Share one window, and share in worlds you trust.
- **Status (2026-11-18):** built, not deployed. Tried in Chrome on one machine with three visitors, a stand-in relay and a drawn picture in place of a real screen: offered and announced with nothing shown; one visitor choosing to watch and seeing live pictures on a panel; the sharer told "1 person is watching", then 2; a third visitor sent nothing until they asked; a panel put away ending it for that watcher; and stopping taking it down for all. Not tried with a real screen, across two networks, or in a headset, where whether its words can be read is the thing to judge.

## 0.13.1

Rooms: a visitor can stop hearing someone, or stop being in a room with them. Nothing in the protocol's formats changes.

- **Stop hearing someone.** Select a person in the People list, then "Stop hearing". They are still seen, still see and hear the visitor, and aren't told. It lasts while they are here.
- **Block someone** (§9.4, §9.8). The visitor's own browser closes its connection to that person and makes no new one. Nobody is asked, nothing is published, and the others in the room carry on. To the blocked person, the visitor has left.
- **What a block can hold on to.** Someone who came by name showed a pass for a key of their own, so the block is kept, on that site, and holds when they come back. A guest is a new key every visit, so blocking one lasts the visit and the room says so plainly.
- **Letting someone back** is in the same list, and takes effect the next time either side announces itself.
- **One wart, said plainly:** who someone is comes out only once connected, so a blocked named person is connected to for a moment each time they return, and then dropped.
- **Not built:** removal by a host, which needs rooms to have hosts (a room is still named by a string), and carrying a block list from one site to another, which would be a job for the visitor's own client.
- **Status (2026-11-18):** built, not deployed.

## 0.13.0

Smaller things that were in the way: a tap that moved too far, and having to join again in every world.

- **A tap is a walk.** On a phone or a desk, a tap or click on the floor was a jump of up to five metres: the room lurched. It is now a walk at the pace the keys walk, to a spot three metres off at most, and a second tap changes where it is headed. A headset keeps the jump, which is what sits well there, and so does anyone who asked for less motion (a short one). The kit has it as `createStroll`, `reachOf`, `TAP_REACH` and `WALK_SPEED`; the reference worlds, the world template and BitPortal's room use it.
- **Staying joined** ([NSWP-02](protocol/02-doors.md), [NSWP-03](protocol/03-arrival.md)). Someone in a world's open room who goes through a door arrives joined in the next. `joined=1` on the link a world sends them through, and `joined` in the arrival context their client writes.
- **And heard, if they have said so.** `mic=1` beside `joined=1`, and `mic` in the arrival. A link is something anyone can write, so a microphone travels only when the visitor has told their own client that theirs may stay on between worlds: off until then, remembered after. Joined alone is passed on by default, shown on the Airlock, and theirs to untick.
- **What doesn't travel:** a private room (the next world's open room is other people), and a microphone without joined.
- **A refresh keeps them in the room too,** with the microphone as it was. This tab only.
- **Told at once.** Arriving joined, a visitor is told others can see them (and hear them), and Leave is where Join was. Sound from the others starts on their first touch, since a browser holds it back until then.
- **Status (2026-11-18):** built, not deployed. Tried in Chrome on one machine, with the Gallery, the Grove and BitPortal answered from their builds at their real addresses, every relay the test itself, and a microphone the browser made up: a tap, a click and a touch each walking three metres at walking pace; joined carried from the Gallery to the Grove, where someone already there saw them arrive; the microphone left off the first time and carried once the box was ticked, and the choice remembered; unticking "stay" arriving unjoined; a link written by somebody else arriving joined with the microphone off; a private room not travelling; a refresh; and the way home to BitPortal's room, joined. Not tried on a real phone, a real headset, or with a real voice.

## 0.12.0

Who a world is for, and a copy of the client that shows only what its host has listed.

- **`audience`, a tag on a world's announcement** ([NSWP-01](protocol/01-worlds.md)): `kids`, `general` or `adult`, in the maker's own word. An `adult` world also carries `content-warning`, which readers that don't know `audience` already read. A careful reader takes a world as adult when it says so, and also when it carries a warning and names no audience. A world that says nothing is unrated.
- **What a rating can't do.** It keeps honest makers' worlds where they belong and does nothing about a maker who lies. So a client that must not show adult worlds does two things together ([NSWP-08](protocol/08-lists.md)): it shows only worlds on a list signed by a key its host trusts, and it drops from those any that say they are adult.
- **A host's list is an ordinary list.** Kind 30004, signed by the host's key, under a name the client knows. No new kind, and nothing a relay or a world has to do.
- **Hashtags.** `t` tags were already topics. A client may now let a visitor ask for more or less of one, and rank by that on the visitor's own device ([NSWP-08](protocol/08-lists.md)).
- **BitPortal, as hosted at bitblocks.network (§15):** shows a world only when its operator's key has listed it or it is in the starter set, and never a world for adults, in the lobby, the room, saved doors or the Airlock. The operator, signed in, sees what is waiting and lists or unlists a world with their own signature. Someone who hosts their own copy sets their own key and their own answers in one file.
- **The world template** asks for `audience` in `world.json` and announces it.
- **Status (2026-11-18):** built, not deployed. Tried in Chrome with made-up sites, a throwaway key standing in for the operator's, and every relay answered by the test: a visitor shown listed worlds only, and none for adults; a world with a warning and no audience held back the same way; the Airlock refusing to send anyone to an adult world while still showing its address; the operator shown what is waiting, listing one with their own signature, and every visitor then shown it; someone else signed in shown none of that; a hashtag asked for more of moving worlds up and getting a shelf of its own. Not tried with the operator's real sign-in. The seven reference worlds' announcements carry no rating yet: they show as "Not rated by its maker" until they are signed again.

## 0.11.0

A home of your own to start in. Three small additions to the protocol, and one decision in BitPortal's own design changed.

- **The decision that changed (§14.1).** A visitor's start was always BitPortal's own room and never their own site, for three reasons: it costs a crossing before they have chosen anything, its code can observe them, and when it is down there is nowhere to start. The first two don't hold for a world that is theirs and that they chose. The third is answered by keeping BitPortal's room to fall back to. So someone who has built a world may now choose it as their home.
- **`home`, a capability** ([NSWP-01](protocol/01-worlds.md), [NSWP-07](protocol/07-homes.md)): a world says it can be the place its owner starts. It is a promise of one thing: wherever it offers the way home, it offers the way to the visitor's doors.
- **`doors=1`** on an Airlock opened with no destination ([NSWP-02](protocol/02-doors.md)): the way to the visitor's doors, which is the client's own place and never a world. A client with one place for home and doors takes them there either way.
- **`home` in the arrival context** ([NSWP-03](protocol/03-arrival.md)): a visitor's own client saying it has brought them home, so the world can leave the way home out and show the way to their doors.
- **What a client should hold to** before a world may be someone's home (NSWP-07): it is theirs both ways (they announced its address with their key, and its site admits that key), it says it can be one, it is on an encrypted address anyone can reach, they chose it, and the client keeps a start of its own to fall back to.
- **The kit.** `portal.doors()`, `arrival.atHome()`. The way home is now labelled "Go home", since home is no longer always a lobby.
- **Status (2026-11-18):** built, not deployed. Tried in Chrome with two made-up sites and a throwaway key: a world from the template checked and chosen in BitPortal's Settings; a site that only claimed the visitor's key refused; going home with nothing asked; the way to their doors and back; and a home that doesn't answer, no longer admits them, or no longer says it can be a home, each ending in BitPortal's room with a word about why. Not tried with a real sign-in, a real announced world, or a headset.

## 0.10.6

Terminals in a world you are building. Nothing a world implements changes, and no world gains anything unless its owner gives it.

- **The rule was "never in a world", and for every world but your own it still is.** The owner decided on this one exception, behind three locks: the world is named in their home, by their own typing; their Bridge is started naming it (`--world`); and the computer asks before each terminal opens, saying which world.
- **A world grant** (kind 27303): names a Bridge and a world, lasts up to twelve hours, and is good for every connection until then, so a refresh doesn't end the work. A pass, a home's grant and a world grant are each refused as either of the others; the vectors hold every crossing.
- **Going there.** The home hands the grant to that world's address after the `#`, and the world takes it out of its address at once. A world never holds a signer or learns its owner's key.
- **The world template** is brought up to date: panels, the keyboard and library, speaking, see-through and pinned panels, staying put through a refresh, and "A terminal on your computer" for an owner who brought one. Anyone else who visits gets none of the last, and the terminal's code isn't even fetched for them.
- **`--allow-for` is counted for each asker by itself:** the home, and each world.
- **Found by trying it:** a world already open that is handed something in its address loaded nothing and left it there. It now notices, takes it out, and starts again. And thin letters went faint on a see-through panel; the step from gone to there is shorter now, so letters keep their weight.
- **Status (2026-11-18):** built, and BitPortal's side deployed. On the live room, with a throwaway identity and without leaving it: a world named on the sheet (a plain site refused), and what would be handed to it read back and checked: kind 27303, signed by the visitor, eight hours, readable at that world's address and nowhere else, accepted by a Bridge told about the world and refused by one that wasn't. Before that, on one machine with throwaway keys: the whole trip from BitPortal's room to a world built from the template, with a real Bridge told about that one world. The seven worlds and the Starter Home were not redeployed; they gain nothing from this but crisper see-through letters. Not tried on a real headset, or with a real sign-in signing the world grant.

## 0.10.5

Working in a place instead of visiting it: speaking, panels that come along, and a refresh that isn't a reset. Nothing a world implements changes.

- **Speak instead of typing.** A Speak key on the drawn keyboard and a Speak button on the terminal. Where a terminal's Bridge was started with `--voice`, the sound goes to the owner's own computer over the connection the terminal has, Whisper there turns it into words, and it goes nowhere else. Otherwise the browser's own recognition is used where there is one: on the device where the browser can, and after saying so where it would send the sound to its maker.
- **Speaking types, and never presses a key.** Words come back as one line. The Bridge and the page each strip anything else.
- **See-through panels.** A button goes round four looks. Dark parts can fade more than light ones, so a terminal can be letters hanging in the air.
- **Pinned in the view.** A pinned panel comes along. On a flat screen it keeps its place on the screen; in a headset it stays put while the visitor looks about and comes round when they turn or move well away.
- **A refresh is not an arrival.** `createStay` puts a visitor back where they stood, facing the way they faced, and offers the way back into a headset first. The reference worlds and BitPortal's room do it; BitPortal also brings back the terminals that were open, as they hung.
- **Found by trying it:** Whisper, when unsure, tries again and again, hotter: a few words took ten seconds. One pass takes under one.
- **Status (2026-11-18):** built and deployed to BitPortal and the seven worlds. On the live room, with a throwaway identity and every relay answered by the test itself: a terminal panel made see-through and pinned, keeping its place on the screen through a turn and a walk, with its Speak button; and a refresh that put the visitor back where they stood. On the live Workshop, a refresh that kept both place and heading. Before that, on one machine with throwaway keys, in Chrome and an emulated Quest 3, with a microphone the browser made up and a stand-in for the recogniser: every part above, and the real Whisper run once on a made-up sound. **Not tried:** a real voice; a real headset, where how a pinned panel feels and whether see-through letters can be read are the things to judge.

## 0.10.4

The terminal, after its first real use. Nothing a world implements changes, and nothing on the wire.

- **Larger and smaller letters** (A+ and A−, 60 to 160 across), on the panel's foot. The picture stays one size, so larger letters are sharper and the panel keeps its shape; the program is told its new size. The panel's own + and − still change how large the whole panel is.
- **Looking back** (▲ ▼) through what has scrolled away, a press at a time, and **Copy** for what is on the screen.
- **Page up, page down, home and end** on the drawn keyboard's last layer.
- **A few terminals at once.** The Bridge keeps four, each asked about at the computer, each with a place of its own that `--tmux` turns into a lasting terminal. At four, the owner being let in again takes the place of the one quiet longest.
- **Found by trying it:** in a headset the drawn keyboard sat between the hand and the panel's foot, so a press meant for a button typed a letter instead. Up for a terminal, the keyboard now sits lower and nearer, under the panel.
- **A key that only looks like one is refused.** About half of all 64-character hex strings are not public keys at all. `decodeNpub` now says so (`isPublicKey`), so such a key is never kept as a computer or as a Bridge's owner. And a panel shows only words written for the visitor, never what a library said when it failed. Found on the live site, with a made-up key.
- **Status (2026-11-18):** built, and BitPortal's side deployed, the refusal of keys that only look like keys included (checked live: such a link adds nothing and the room says it names no computer, one kept from before is dropped, and a real key is added as before). Tried on one machine with throwaway keys, in Chrome and an emulated Quest 3: each button pressed for real with a mouse and with a controller, two terminals open on one computer at once, and the earlier checks again. On the live room, with a throwaway identity and every relay answered by the test itself: a terminal panel with its five buttons, larger letters chosen and remembered, and a second panel beside the first. Not on a real headset, where whether the foot's buttons are large enough to point at is the first thing to judge.

## 0.10.3

A terminal on your own computer, from a panel in your home. Stage A3 of [`browser/spec.md`](browser/spec.md). Nothing a world implements changes.

- **The Bridge** ([`browser/bridge.md`](browser/bridge.md), `packages/bridge`): a small program a person runs on their own computer. It answers one Nostr key, its owner's. The home and the Bridge find each other with sealed notes through relays, as two visitors in a room do, then talk directly.
- **A grant** (kind 27302): the owner's signed word that one throwaway session key may open a terminal on one Bridge, for five minutes, once. It has its own kind and names a Bridge, never a site, so a pass a world holds opens nothing, and a grant is worth nothing to a world. Schema and vectors beside the others.
- **It asks at the computer.** Before a terminal opens, the Bridge asks on its own screen and shows four digits both ends work out from the grant. No page can answer for the person there. `--allow-for` loosens that, knowingly.
- **Anyone else is refused before anyone is asked:** another key, the Bridge's own key, a pass, a grant for another computer, an old grant, a grant sent twice. A stranger gets one reply, however often they ask.
- **A terminal panel** in the SDK (`nswp-sdk/terminal`, its own entry, so nothing else pays for the emulator). It shows each stage of connecting, with the code. Press it to type: a real keyboard anywhere, and in a headset the kit's drawn keyboard in a new mode with Esc, Tab, Ctrl and the arrows, every key sent as it is pressed.
- **One terminal at a time, and never locked out.** The owner asking again, and being let in, takes the place of a terminal left open by a closed page. A home that goes quiet for a minute is hung up on.
- **Found by trying it:** a reply was not tied to the request it answered, so an answer to an earlier request could be taken for an answer to this one. Every reply now names its request. And the Bridge did not notice a page that had simply gone, which is where the two rules above came from.
- **The Bridge says whether a home can find it** ("Listening on 4 of 4 relays"), tells someone who ran the example as written that they did, and makes nothing on disk until the command it was given is a good one. All three came from the first real run.
- **Status (2026-11-18):** built, and BitPortal's side deployed: the live room offers **Your computers**, a pairing link opened by someone not signed in asks them to sign in and adds nothing, and the terminal's code is fetched only when a terminal is opened. Tried with throwaway keys and a relay on one machine, from BitPortal's room in Chrome: a computer added from its link, the same code on the panel and at the computer, commands typed on a flat screen and on the drawn keyboard in an emulated Quest 3, and a second key refused with nothing opened and nobody asked. Then the real thing, once: on the live site, a real sign-in signed the grant, public relays carried it, the same code showed on the panel and at the computer, a yes was typed there, and Claude Code ran in the panel in the owner's room. The browser and the Bridge were on one computer. **Not tried:** a real headset, a browser on one network and the computer on another, macOS. The Bridge is not on npm.

## 0.10.2

A keyboard and a library, so a headset is no longer the place where a visitor can only move things about.

- **A keyboard drawn in the scene** (`panels.keyboard`). Keys are pressed with a select, so it works on every headset. A real keyboard and a paste type into it too, and nothing behind hears them. Where a headset's browser offers its own keyboard to a page, one key hands over to it.
- **A library** (`panels.library`): the pictures and video of the visitor's own that their browser keeps, on a board to choose from in the headset. A page can't show a device's files; it can show what it was given.
- **The camera** can hand everything it takes to the library (`onCapture`).
- **Found by trying it:** the keyboard comes up where the console's own button sits, and the button was taking the presses. The keyboard is asked first now, and the console steps aside while it is up.
- **Status (2026-11-18):** built and deployed to BitPortal and the seven worlds. On the live BitPortal room, inside an emulated Quest 3: a note typed by pointing and on a real keyboard and hung; a picture taken with the camera and found in the library, chosen from the board and hung; and all of it there on the next visit. Only BitPortal's own site was asked for anything. The headset's own keyboard has been tried nowhere, and none of this on a real headset.

## 0.10.1

Panels. No change to any format: this is the SDK, and the first stage of [`browser/spec.md`](browser/spec.md).

- **`browser/spec.md`**: a plan for a browser of the visitor's own, beside the protocol and not part of it. What only a browser can do, the bridge a page asks through, which engine fits which device, and a staged plan that starts in BitPortal Web.
- **`createPanels`** in the SDK: a note, a picture or a video in a frame a visitor can hang anywhere. Dragged by its bar on a flat screen; taken with a grip or a pinch in a headset; made smaller, larger or put away with a select. Kept in the visitor's browser where the page asks, with files of their own.
- **A panel is never another website.** The kit draws what it shows.
- **Grabbing** gains `pull: false`, for something large that should stay at arm's length instead of coming to the hand.
- **The Workshop** has a panel to try.
- **Status (2026-11-18):** built and deployed. On the live Workshop: its panel dragged by the bar on a flat screen, and in an emulated Quest 3 made larger with a select and taken by the bar with the grip. Not on a real headset, where the first thing to judge is whether a note's text is sharp enough to read. The world template is not wired for panels yet.

## 0.10.0

Crossing from one world to another, with as little asked as a browser allows, and the same room at both ends.

- **A count, and rules to keep it** ([NSWP-02](protocol/02-doors.md), "How many actions a crossing takes"). In a headset a crossing is three actions at most: leave, confirm, go back in. Two to a world the visitor approved before, one where a browser carries the session over. A world leaves at once with no confirmation of its own; an Airlock asks one thing; a world asks for nothing on arrival but the way back into the headset.
- **`xr=1`** on a door's address, and **`immersive`** in the arrival context: the visitor left a headset session to make this trip. The destination uses it to put **Enter VR** first, large and alone, before it has finished loading.
- **The chamber.** A small round room in the SDK (`createCrossing`). Walls rise round a visitor as they leave; they arrive standing in it, and its doors open onto the new world when it is ready. It is scenery and proves nothing, and the rules say so: nothing to press, no claim of verification, never a delay.
- **`sessiongranted`** is listened for. Where a browser gives it, nothing is asked on arrival. Few do, and none has been tried.
- **Status (2026-11-18):** built and deployed to BitPortal, the seven worlds and the Starter Home. One whole crossing was run on the live sites in an emulated Quest 3: from BitPortal's room in a headset session, through a door (one action), the Airlock told `xr=1` and reading large (Continue, the second), to the Grove, where **Enter VR** was first and focused and the chamber's doors waited for it (the third), then opened in the headset; and home again in one action, into the chamber in BitPortal's room, facing the door left through. The two sites were the only hosts asked for anything. **Not tried:** any real headset, and `sessiongranted` on any browser.

## 0.9.1

Hands in a headset. No change to any format: this is the SDK, and three lines in what a world owes.

- **An input layer of our own** (`createXrInput`), on the WebXR standard and nothing else. It reads any tracked controller through the layout WebXR already fixes, so nothing knows a make or a model. Sticks turn and step; a grip or a pinch picks things up, near or from across a room; B or Y opens the console; the hand buzzes where it can.
- **Comfortable unless asked.** Turning and moving are in steps by default. Smooth walking and turning are a visitor's choice under Moving, with a darkened edge to the view, kept in their browser for that site.
- **Drawn here, downloaded from nowhere.** Controllers are one plain model for every make, and tracked hands are their joints. A request for a controller's model would tell its host which headset each visitor owns.
- **What a world owes** ([NSWP-09](protocol/09-what-a-world-owes.md)) gains three lines: sticks, grips and buttons are extras and never the only way; nothing slides unless the visitor asked; no request says what a visitor is holding.
- **Not adopted:** Meta's Immersive Web SDK. Its input manager is good, but it needs three.js swapped for Meta's fork at the root of every world. The door stays open: `actions.ts` is small and separate.
- **The Workshop** has three things to pick up. The headset checklist has a section for all of this.
- **Status (2026-11-18):** built and deployed to the seven worlds, the Starter Home and BitPortal's room. Driven in an emulated Quest 3 only: every row of the table in `docs/controls-kit.md` on a local build, and on the live Workshop, Starter Home and BitPortal room a stick's step, a turn with its buzz, the menu button, a grab that goes home, and the switch to tracked hands. Each page asked its own site for everything. Not on any real headset.

## 0.9.0

Who someone is ([NSWP-10](protocol/10-identity.md)). Until now everyone in a room was a guest, and a name or a mark proved nothing.

- **Passes are built.** At the Airlock, the visitor's own client makes a throwaway session key and signs a pass with their identity key: "at this site, until this time, this key speaks for me". The world gets the pass and the session key; the identity key never leaves the client. This is §9.2 as designed, with one difference: there are no room events yet, so a pass is good in any room at its site.
- **A name is shown only when it is proved.** A pass may carry the name its owner chose, so showing it needs no request to anyone. A guest can't choose the text they are shown by.
- **The mark, honestly.** It is fifteen bits and proves nothing alone. A member whose pass checks out wears their identity key's mark, drawn with a lit frame. A look whose seed is someone's key is not honoured without a pass for that key.
- **In a room** a pass travels member to member as `id:<pass>`, never through a relay, and counts only if it names the session key the member's handshake was signed with.
- **The arrival context** gains `pass` and `sessionKey`, which travel together or not at all.
- **The library:** `buildRoomPass`, `verifyRoomPass`, `cleanName`, `claimsKey`, `encodeNpub`; a schema and twelve vectors. **The SDK:** `arrival.identity()`, and rooms that check passes.
- **What going by name gives away** is written down, for a client to say before the first time: the world and everyone in the room learn the key, with the visitor's IP address, and a pass can't be taken back.
- **Status (2026-11-18):** built and deployed. On the live sites, in headless Chrome: a visitor went from BitPortal's Airlock to the Grove by name, with a throwaway test identity (`?signer=test`), and a guest in the same private room saw them by that name, proven, wearing that key's mark with its frame; the named visitor saw the guest as a guest. The address was scrubbed on arrival and the pass kept for the tab. **Not tried:** a real BitLogin session signing a pass, which needs a person. **Found:** a private room's name (`#room=`) doesn't travel through the Airlock, which keeps a world's address as announced. That is the arrival context's `room` field, still proposed.

## 0.8.3

How worlds are found, beyond one client's own list ([NSWP-08](protocol/08-lists.md)).

- **Lists are a format of their own now,** with a reader and a writer in the library (`parseListEvent`, `buildListEvent`), a schema and test vectors. A reader keeps a list's worlds in order, passes over anything on it that isn't a world, and stops at 200.
- **Following a list.** A list is followed by its coordinate, shared as an `naddr`. A newer copy counts only if the same key signed it. Whose lists a visitor follows stays with them.
- **Worlds nobody has listed.** The rules for a client that shows them: kept apart and labelled, shown when the visitor asks, pictures held, a limit on what one key can take up, and no second claim on an address the visitor already has a door to.
- **Asking to be listed** needs no message: announcing a world is the request. `nswp worlds --verify --not-on <list>` is what a curator reads.
- **The tool** signs lists (`nswp sign-list`) and validates them.
- **Status (2026-11-18):** built and deployed. On the live lobby, in headless Chrome: the find bar, and BitPortal's own list looked up by its address on the public relays. The page contacted its own site and relays and nothing else. Following someone else's list was tried only against a stand-in relay, since nobody else has published one. No world outside this project has announced itself yet, so the shelf of unlisted worlds is empty.

## 0.8.2

No change to the protocol. How it is written down changed.

- **Protocol documents.** `protocol/` holds nine short documents, one per part of the protocol: worlds, doors and the Airlock, arriving, previews, looks, rooms, homes, lists, and what a world owes a visitor. Each says what is implemented and what is only proposed, and points at its schema, its test vectors and its code. They are what an implementer reads. `spec.md` remains the full design, with the reasoning.
- **Written down for the first time:** exactly how a look is generated from a key, and what the members of a room send each other (the handshake, the 88-byte position packet, and the `look:` and `rec:` messages). These existed only in code.
- **Looks have a schema and test vectors** (`schemas/look.schema.json`, `vectors/looks.json`), so a second implementation can check it draws the same figure from the same key.
- **This change log** moved out of the front of the spec.
- **A test** checks that every protocol document states its status and that everything it links to exists.

## 0.8.1

The first of the things people do together, and the first that needs no account.

- **A camera of the visitor's own** in the controls kit: a picture, a selfie, a clip of up to thirty seconds, saved to their device. Nothing is sent anywhere.
- **Recording is said out loud** (§21.3). A member who records a clip tells the others, and each sees a light on the recorder's figure and is told once. It is said over the connection the members already share, and again every two seconds while it is true, so a lost message can't leave the light stuck on or off. An honest client says so; nothing can make a dishonest one.
- **People**: a list of who else is in the room, and a way to point one of them out.
- **What comes next, and where it can live.** Names, profiles, a feed, messages and notifications need a person's key. A world is someone else's website, so those belong in the visitor's own client and reach a world only by a hand-off, the way a door goes through the Airlock. Not designed in detail yet.
- **Status (2026-11-18):** built and deployed. On the live sites, in headless Chrome: a picture, a selfie and a clip taken in the Grove, in BitPortal's room and in the Starter Home; and two visitors in a private room in the Grove, where one recording a clip put "recording" beside their name in the other's People list, told them once, and cleared when it stopped. Not tried in a headset, where a clip can't be recorded at all.

## 0.8.0

Avatars are worked out in detail (§4.2). The earlier sketch had two colours, three heads and five accessories.

- **A look**: three colours and one choice from each of eight closed lists (build, head, face, accessory, body, shoulders, pattern, finish). It is data, never a file.
- **Everyone has one already.** A key generates its own look, the same in every world, with nothing published. Choosing a look overrides parts of the generated one.
- **A mark that isn't a choice.** A five-by-five pattern from the key, on every figure. It follows a person through any change of clothes, and a copied look comes out with the copier's mark.
- **How a look travels**: by key, by the avatar event, inline in the arrival context for a guest, or in a room's hello. And the cost said plainly: a look that is the same everywhere makes its wearer recognisable everywhere, so the Airlock offers going plain.
- **What a world may change**: draw it as it is, re-dress it in its own material and palette, recast it as something of its own, or ignore it. A world that tells visitors apart at all should keep the mark.
- **Built:** the format in `@nswp/core`; a figure in the SDK that draws any look and can be re-dressed; looks carried in the arrival context and between a room's members; and in BitPortal an editor, the visitor's own figure in their room, and the Airlock's choice. **Not built:** publishing a look for someone signed in, proof of a key behind a mark, and an editor usable inside a headset.

## 0.7.9

No change to the protocol. The reference app and its worlds get real addresses and real jobs.

- **Addresses under `bitblocks.network`.** BitPortal is at `portal.bitblocks.network`, and each world at a name of its own (`gallery`, `grove`, `tour`, `arcade`, `observatory`, `workshop`, `library`, `starter`). The worlds send visitors through BitPortal's Airlock by default, as §6.2's example always showed. The old `vercel.app` addresses send visitors on to the new ones.
- **Every world is for something.** The two test worlds became the Gallery (sculptures made in code) and the Grove (somewhere to sit and talk). Five are new: the Tour (five stops for someone's first minute), the Arcade (a small game), the Observatory (a terrace for looking at the sky), the Workshop (every part the worlds are built from, named) and the Library (eight notes on why it is built this way). The Starter Home is the world template, deployed unchanged. Each has two doors to others, and all eight are in BitPortal's room.
- **The worlds share one harness** (`sites/shared/world.ts`): several doors, each showing where it leads; stepping by pointing at the floor; signs; where a visitor may stand. The Gallery and the Grove keep their identities (`d`), so doors saved to them still lead there.
- **A caution kept in mind.** All of these sit under one registrable domain with BitLogin's sign-in page, which browsers treat as the same site. That is acceptable because they are all ours and set no cookies. A world made by anyone else does not belong under `bitblocks.network`.
- **Live.** All nine sites answer at their new addresses, and the old `vercel.app` addresses redirect. The eight worlds' announcements are on six public relays, and `nswp check` reports each as verified for its site. BitPortal's starter list and its four listings, signed again by the curator, are on the same relays. `bitblocks.network` lists BitPortal, marked experimental. On the live sites, on a flat screen: from BitPortal's room through the Airlock (which shows "Verified") into the Tour, through the Tour's door and the Airlock into the Gallery, and Home back to the room, with the arrival context read and scrubbed each time. Not tried: a real headset; BitLogin sign-in at the new address; and doors saved at the old address, which stay there, because a browser keeps them per address.

## 0.7.8

No change to the protocol. The reference places are modelled now, not stacked from boxes (`docs/grid-look.md`).

- **A modelling kit in the SDK.** Shapes are made in code the way a modeller makes them: boxes with bevelled edges and panels pressed in, profiles swept along a path or turned on a lathe. Everything that stays still in a place is one mesh, drawn in one surface shader with no lights. The doorway's frame, walls, furniture, sculptures, trees and a visitor's figure are parts made with it, and a world can use them or make its own.
- **A sky worth looking at.** Another world hangs low in it, ruled with the same grid, with lights on its night side and rings its shadow falls across. Behind it: stars, one faint band of them, and constellations drawn like a map of a network. Every world's sky is arranged differently. The skyline is modelled towers and, far off, great arches.
- **Deployed and published.** BitPortal, both reference worlds and the template demo are deployed in this look. The reference worlds' preview pictures were retaken and their announcements signed again; the new announcements are on six public relays, and `nswp check` reports both as verified. On the live sites, on a flat screen: from BitPortal's room, through the Airlock (which shows World A as verified), into World A with its arrival context read and scrubbed. The template demo's announcement is still unpublished. No real headset has drawn any of this: the pictures come from a software renderer, and frame rate on a headset is unmeasured.

## 0.7.7

- **How a world's own interface and the traveller's controls share a screen** (§21.3, new). There is no layer above a world, so the controls are a short list of things every world agrees to offer, drawn by the world. The world leads; they stay out of its way and are never more than one action off.
- **The controls kit has three levels** to match: full, quiet (one mark in a corner) and hidden. A world can place it, change or switch off its keys, and claim all input during play.

## 0.7.6

No change to the protocol. How the reference places are drawn changed (`docs/grid-look.md`).

- **One look for the reference places:** a dark plane ruled with a grid of light, a skyline of blocks, and furniture built from dark blocks with lit edges. BitPortal's room and site, the reference worlds, and a home drawn by the SDK share it from one copy in the SDK.
- **The reference worlds have arched doorways** (§6.7), like everything else. Their preview pictures were retaken and their announcements signed again.
- **Deployed and published.** BitPortal, both reference worlds and the template demo are deployed in this look. The reference worlds' new announcements are on six public relays, and `nswp check` reports both as verified. On the live sites, in the emulated headset: from BitPortal's room, through the Airlock, into World A, and back to the room from its console. The template demo's announcement is still unpublished. No real headset.

## 0.7.5

- **One controls kit for every world** (§21.2, `docs/controls-kit.md`). A world lists what a visitor can do once. The SDK draws that list as a HUD on a flat screen and as a console in a headset, on the wrist where a hand is tracked. The template, the reference worlds and BitPortal's room all use it, in place of four hand-written sets of buttons.
- **A visitor can change how the controls look**, and each site remembers their choice. Whether a look should follow them between worlds is a new open question (Q32).
- **Deployed** to BitPortal, both reference worlds and the template demo. On the live sites, in the emulated headset: from BitPortal's room, through the Airlock, into World A, where the console's Back to your lobby returned to the room. The wrist gesture and a controller's ray on the console have been tried only in the emulator, driven by a script.

## 0.7.4

- **A world's controls must be reachable in a headset** (§21.2). In an immersive session the page is gone, and its buttons with it. The SDK has a menu that goes in the scene, and the template, the reference worlds and BitPortal's room use it.
- **The way home works in VR, and the reference worlds have one** (§6.3).
- **BitPortal's room works from a chair** (§14.1): Turn around, stepping, and larger buttons clear of the doors.
- **A headset checklist** (`docs/headset-checklist.md`), to run the first time anyone has a headset on. Nothing has been.

## 0.7.3

- **The start room is built** (§14.1), in BitPortal's walk-in page: two walls of doors, the visitor's own ahead and suggested ones behind.
- **Saving a place needs no sign-in** (§8.3, §14.1). A client may keep a visitor's saved places on their device, and BitPortal does. Each saved door keeps its place on the wall for as long as it is saved.
- **The world template was tried by AI assistants** (§19.1, §20 Phase 4c). Three trials. Every rule held, including when the request asked to break one. The gap was that an assistant can't see what it builds, and the template now gives it a way to.
- **The standard portal is an arched doorway** (§6.7): the same shape in BitPortal, in a home and in a world built from the template.

## 0.7.2

- **The world template is built** (§19.1, §20 Phase 4c), in its own `nswp-world-template` repository, with a demo deployed from an unchanged copy.
- **Home layouts are in the library** (§4.5): building and reading kind 37302, with a first built-in catalogue of eight items and two room templates. The SDK draws one.
- **Going home works** (§6.3): `portal.home()` is in the SDK, and BitPortal's Airlock takes a visitor to the lobby when opened with no destination.

## 0.7.1

Design only. None of it is built.

- **Where a visitor starts** (§14.1): BitPortal starts everyone in one room, drawn by BitPortal itself. The visitor's own doors are on the wall they face, and suggestions are on the wall behind them. On a desktop or phone the start is the flat list, in the same order.
- **Going home** (§6.3, §6.6): an Airlock opened with no destination takes the visitor to their client's start place, and the SDK gets `portal.home()`.
- **Saved places stay private** (§4.5, §14.1): guests in a home see only the doors its owner placed in the public layout. Saved places are drawn by the owner's client, for the owner alone.
- **Invitations arrive as portals** (§8.4), at one fixed spot, and only from people the visitor follows.
- Saved doors and a jump list move forward into Phase 3a, because they need only sign-in and bookmarks.

## 0.7

Three additions and one correction. None is built yet.

- **Items** (§10.4): a thing is described once by a signed event from its maker, with a 3D file, a size, simple collision shapes and named animations. A home layout places items by reference, in metres from the home's origin. Items carry data and never code.
- **Items you hold and carry** (§10.5): a maker can grant an item to a person, and that person can carry it into worlds that agree to draw it. Anyone can check who made it and who it was given to. The protocol does not make items scarce or resellable.
- **A world template** (§19.1): a repository to copy, with the protocol's plumbing already done, whose starting scene is a home you host yourself.
- **Correction:** 0.6 said version one of homes has no custom 3D models. Custom models are now allowed as items, under ceilings, when the renderer chooses to draw them (§4.5).
- New phases **4c** (world template), **8b** (items) and **8c** (granted and carried items). Existing phase numbers are unchanged.

## 0.6.1

- **Previews are built** (§5.8, §20 Phase 1b). The library reads and checks them, the SDK captures one and draws one through a portal, both reference worlds have one, and BitPortal shows them in its list and its hall.
- **A portal's view is widened from a distance** (§5.8, "Drawing one"). A true window seen from across a room shows a sliver too narrow to recognise.
- **BitPortal mirrors previews itself** and fetches nothing else while a world is only listed, which is stricter than §5.8 requires.
- **Both Airlocks now say what kind of place a destination is** (§6.7).

## 0.6

Four additions, each with a stated limit. None is built yet.

- **Who owns what** (§3.2): the rule for what belongs in the protocol, and a table of what each party owns.
- **Previews** (§5.8): a world can publish a 360° still of its entry point, so a portal looks into the place it leads to. Previews are fetched by hash, never from the world's own server, and are shown automatically only for worlds the visitor's own choices brought in.
- **What every portal shows** (§6.7): the minimum a door, a portal or the Airlock must display, and how ordinary web pages are handled.
- **Avatars in three tiers** (§4.2): generated, simple and model. The protocol does not define an avatar customization system.
- **Homes** (§4.5, §7.5): a user-owned place described by a signed layout event and drawn by any renderer. Layouts place items from a fixed catalogue; they are not a scene format.
- New phases **1b** (previews) and **8** (chosen avatars and homes). Existing phase numbers are unchanged.

## 0.5.2

- **Phase 2 is started** (§20): BitPortal has a sign-in page using a pinned BitLogin build, and a page for announcing a world. Neither has been tried with a real account yet.
- **BitLogin's build is now pinned by hash** (§21.1). Rebuilding it from source is byte-identical and matches the live site, which settles which of the builds in circulation is the real one. BitLogin's own release-manifest script is merged, and BitPortal's pin points at BitLogin's `main`.

## 0.5.1

- **The walk-in lobby is built** (§20, Phase 1): BitPortal's doors as a hall, usable in a headset, with a shared room. The avatar and voice code moved into the SDK as `nswp-sdk/three` so worlds and BitPortal share it.

## 0.5

- **Phase 1 is built** (§20): BitPortal's read-only lobby and its own Airlock, in a separate `bitportal` repository, deployed at `portal.bitblocks.network` (first at `bitportal.vercel.app`, which now sends visitors on).
- **Rooms that outlive their host** (§9.10): a heartbeat so a dead room stops reading as live, succession so a room survives its host leaving, and a salted fingerprint of the guest list for private rooms. All three are taken from COMBATRIG, where they were worked out in play.
- **Found while building the lobby:** a shelf can't require "verified" without contacting every listed world (§14); a site that hasn't adopted NSWP gets a plain visit with no arrival context (§4.4); the Airlock knows the starter set's worlds without asking a relay (§6.2).

## 0.4.1

- **The rooms spike is built** (§20, Phase 4b): a guests-only, peer-to-peer room with avatars and voice in both reference worlds. Its findings are recorded in §9.4 and §9.8.

## 0.4

**Shared rooms** (§9): how two or more people share a world, without requiring anyone's server.

- A room's traffic travels **peer-to-peer** between participants, or through a **hosted** room server that anyone can run. Identity, access rules, moderation, invitations and the developer's code are the same either way, and a room can be promoted from one to the other while it is running.
- Rooms are described with the existing NIP-53 room event (kind 30312).
- **The room pass** (§9.2) lets a world prove who is in a room without ever holding the user's signer.
- Access can be open, by invitation, by a Nostr list of people, by the host's follows, or by ticket (§9.3).
- New phases: **4b** (peer-to-peer rooms) and **7** (hosted rooms). Existing phase numbers are unchanged.
- Rooms are not built yet. The Phase 0 library, schemas and vectors cover the 0.3.1 formats; room formats get their own fixtures in Phase 4b.

## 0.3.1

- **Phase 0 is built** (§20): `@nswp/core`, the `nswp` CLI, the portal SDK, JSON Schemas, test vectors, and two reference worlds plus an Airlock, deployed for testing.
- **Real kind numbers**: 37300 for worlds and 37301 for avatars (§5.1), replacing the placeholders.
- **Curation uses NIP-51 curation sets (kind 30004)**, which already exist (§5.4).
- **Registrable domains must use the private section of the Public Suffix List** (§6.2). Building the Airlock showed that without it, every `*.vercel.app` site displays as the same domain.
- **Target devices** (§21.2), including Valve's Steam Frame.

## 0.3

0.3 is a review pass over 0.2. It corrects claims that were wrong or couldn't work, checks the BitBlocks sections against the block repositories (as of 2026-11-17), and fills gaps.

**Corrections**

| 0.2 said | Problem | 0.3 |
|---|---|---|
| Headsets sign in by passkey or by scanning a NIP-46 QR with a phone | A phone can't scan a QR shown inside a standalone headset. Passkey PRF support is uneven. BitLogin is password-first today and its NIP-46 sessions don't survive a reload | §13.1: set up on another device, then pair; pairing without a QR is an open design (Q12) |
| The source world "learns nothing about where they went" | The source world triggers the navigation, so it knows which portal was activated | §6.2 states exactly what each party learns |
| Users can choose their own Airlock | A world has no way to know which Airlock a user chose | §6.3: the arrival context carries a return Airlock address |
| Ordinary websites appear as floating windows | A web app can't render other sites inside an immersive session | §2: websites are cards that open in the 2D browser |
| The signed-out lobby uses a seed recipe, and there are no default moderators | Together these leave new users with an unfiltered feed of anyone who owns a domain | §15: a disclosed, replaceable starter set |
| BitFeed recipes can be shared as events | Publishing recipes over Nostr is planned in BitFeed's spec, not shipped | §14: JSON export and import until it ships |
| BitGate may not support origin targets | Confirmed: BitGate targets are user, event and address only | §15 and Q6 |
| World servers "check BitUnlock's signed entitlement" (no detail) | The real format is known | §16 describes the service-signed receipt and how to verify it |
| `["l", "en", "ISO-639-1"]` | NIP-32 requires the matching `L` namespace tag | §5.2 |
| One click crosses a portal | A crossing needs two gestures: one at the Airlock and one to start the next immersive session | §6.5, with a fast path for destinations the user already approved |

**Additions**

- Manifest serving rules (CORS, no redirects), tighter verification, publisher-change warnings and a listing opt-out (§7).
- Lobby network privacy: no contact with world origins until the user shows interest (§5.7).
- Relay strategy (§5.6).
- Airlock hardening: HTTPS-only destinations, registrable-domain display, the fake-Airlock threat (§6.2, §12).
- Entry assertion: fragment scrubbing, the non-repudiation caveat, behaviour for static worlds (§4.4).
- Device performance tier tag and world retirement (§5.3, §5.5).
- An adoption ladder for world creators, starting with zero integration (§19).
- Phase 3 is split so social discovery doesn't wait on BitGate's relicense (§20).
- Operator policy for a hosted instance (§15).
- Prior art to review (Appendix C).

---

# Part I — The Protocol (NSWP)
