# In a headset, the flat screen's menu: a design, with pictures

**State:** a design, second version, 2026-11-25, with pictures. **The
owner, having seen them: "Yes, build it",** the design as it stands, chat
panel included. Being built, in the pull requests below.

**What the owner has already settled (2026-11-24):**
- **The size:** "B I think." The sheet is 1.0 m wide.
- **The hands:** "we need to make sure that the menu is not drawn above
  the hands in VR."
- **The wrist:** "Yes, narrow layout on the wrist with no bar."

**What changed on 2026-11-25:**
- **How it is drawn.** The owner said "anything waiting on me to test, ship
  it to live", and later: "the menus in VR should look the same or better
  than the flat screens. VR is not an additional feature. It is the entire
  point." So the orchestrator asked for the way that works in every
  browser, whatever the Quest says: the headset draws the menu itself, from
  the same description the flat menu is made from (`ui/model.ts`), every
  tab.
- **Quest check 1 is no longer needed for this.** The first version showed
  the flat menu itself as a picture made by the browser, and waited on that
  check. That way is set aside (below, "The way set aside").
- **BitLogin's screens in VR.** The VR way (`docs/backlog/everything-in-vr.md`)
  is drawn here too.

**The ask** is in `docs/backlog/headset-menu-like-the-flat-one.md`, in the
owner's words: the exact same menu as on a flat screen, larger, floating in
front, the bar below it tilted a little to the player, and whatever is
pointed at coming forward.

**The pictures are of a sketch.** The sketch is a plain script outside the
kit (`menu-draw.js`, in the notes folder). It draws the menu from what the
kit's own menu says it holds, at the flat menu's own measures. In the
headset pictures it is hung in the Gallery's scene, in a made-up Quest 3.
Nothing on it can be pressed. The pictures show how it looks and where it
is, not how it feels in a headset. How it feels is for the owner's Quest
3S, once it is built behind a flag.

## The pictures

They are in the sessions' notes folder, `headset-menu-2026-11-25/`. The
first ones to look at:

| Picture | What it is |
|---|---|
| `side-gallery-<tab>.png`, one for each tab, and `side-gallery-bar.png` | **Every tab, twice.** Left, the flat menu as the browser draws it today. Right, the headset's drawing, made from the same `controls.view()`. Same words, same rows, same order, same columns |
| `vr-1-sound.png` | In the headset: the Sound tab, 1.0 m wide, where today's console opens, with the bar under it leaning back. "Effects" is pointed at and has come forward |
| `vr-2-people-card.png` | People, with a person's card. The People key on the bar is pointed at |
| `vr-3-bag-tiles.png` | The Bag's things as tiles, one pointed at |
| `vr-4-display-swatches.png` | Display, with its colours. A tab in the strip is pointed at |
| `vr-5-wallet.png` to `vr-9-confirm.png` | **The VR way:** BitLogin's wallet, receiving, Files, purchases, and its careful question, drawn with the menu's own rows inside the You tab |
| `vr-10-wrist-narrow.png` | The narrow layout, one column, at the wrist's size (0.36 m wide), hung a little to the left and near. It isn't on a raised wrist: the made-up headset's hands don't move in these pictures |
| `vr-<n>-sharp.png` | The middle of each at about 20 pixels to a degree, which is what a Quest 3S shows. **Judge the size of words from these** |
| `vr-0-today-console.png` | Today's console, for comparison |

**Rows marked "stand-in"** are added to the Gallery's own menu, so that
both sides draw them. They are things a guest alone in an empty room never
sees: a person's card, things in the bag, a song's bar, lines in
Following, a row to type in under Messages, a row that copies under You.
Every word on them, and on the VR way's screens, is made up. Where
BitLogin has its own phrasing, the VR way's screens use it.

## What is proposed

### Closed

**Nothing changes.** The floating Menu button stays as it is, and so does
the summons from a controller.

### Open: the flat menu's sheet, drawn by the headset

- **The flat menu's sheet, as it is at a desk:**
  - the tab strip, with every tab the place has, in the visitor's own order,
    and arrows at its ends where there are more;
  - the rows, in two columns;
  - cards, tiles, colours, lines, typed rows and a song's bar;
  - the tab's note;
  - the foot, with "Keep this tab on your bar" and Close.
- **The same measures as at a desk.** The flat sheet is 780 of a page's
  pixels wide. The headset's is 1.0 m, so one of those pixels is 1.28 mm.
- **One size on every tab,** as at a desk: the tallest tab's, so that the
  sheet doesn't jump as tabs change. A longer tab's rows scroll inside it.
- **1.05 m away,** where today's console opens. Its middle is a little
  below the eyes. It stays where it opened, and closes once the visitor
  has walked 2.6 m from it, as today's does.
- **The glass is darker than on a flat screen.** At a desk the sheet blurs
  the world behind it. In a headset that blur would be drawn for both eyes
  every frame, so the sheet is dark glass instead.
- **The bar floats under it,** 5 cm below, leaning back 28 degrees to face
  the eyes. On it are the place's own keys, then the tabs the visitor
  keeps on it, as at a desk.

**How big the words are:** the flat menu's 13 px, at 1.28 mm each, is 16.7
mm. At 1.05 m that is 0.91 degrees, about 18 of a Quest 3S's pixels.
**The visitor's own text size (Display) makes them larger,** as on a flat
screen. Reading a row without leaning in is the first thing for the
owner's Quest to say.

### Every tab, and every kind of row

Each kind of row is drawn by one small function, in the flat menu and in
the headset's drawing alike (as `ui/model.ts` already asks). This is how
each one works in a headset.

| Kind | At a desk | In a headset |
|---|---|---|
| A button (`button`, `save`) | A row with its icon, words, On or Off, and its key | **The same.** A press is a select. A picture saved from Camera is downloaded as at a desk; whether the Quest's browser lets a download start from a select is for its check |
| A colour (`swatch`) | Arched swatches in a strip | **The same** |
| A thing (`tile`) | Tiles, side by side, with pictures | **The same,** with the same pictures |
| A line to read (`line`) | Its icon and its whole sentence, lit or dim | **The same.** Never pressed |
| A row that copies (`copy`) | Copies at the press | **The same.** Whether a select counts as a press for copying is for the Quest's check. If it doesn't, the row says so and shows what it would have copied |
| A row to type in (`field`) | A box, and its button | **The same box and button.** Pressing the box brings up the kit's own keyboard in VR (`keyboard.ts`), and the words go into the box |
| A song's bar (`slider`) | A bar to drag | **The same bar.** Held and moved along with the pointer. Today's console leaves it out |
| A row that takes a file (`file`) | The browser's file chooser | **For a visitor who chose the VR way, their BitLogin Files, in VR.** Otherwise it goes out of VR for a moment (`outOfVr`, reason `"file"`). No browser lets a page pick a file from the headset's own storage inside immersive VR: the same kind of limit as going from site to site. Picking a device file inside VR is on BitBrowser's list |
| A card about a person, or about a thing | At the head of the tab | **The same** |
| The said line in the sheet | A strip above the foot | **The same strip** |
| The world's own part, under its name (`from`) | Its name over its rows | **The same** |

**Chat, posts and letters** (`ui/chat.ts`, `ui/feed.ts`, `ui/letters.ts`):
at a desk these are a panel on the right of the screen. Today's console
doesn't draw them at all. **In a headset they are a second panel, to the
right of the sheet and turned a little towards the visitor,** drawn by the
same drawing, with the kit's keyboard to write. That is new in a headset,
and it is what the owner's "every tab and function" asks for.

### The VR way: BitLogin's screens in a headset

The owner, 2026-11-25: "the menus in VR should look the same or better
than the flat screens", with a choice for the visitor between 2D (safer,
the default) and VR (riskier). These screens are only for a visitor who
chose VR on BitLogin's own page.

**They are made of the menu's own rows,** inside the You tab, under
BitLogin's name, so they look like the rest of the menu by how they are
made:

| Screen | Made of |
|---|---|
| **Wallet** (`walletState`) | A card with the balance, large. Then Receive, Send, "Make a token to give" and "Take a token you were given", and the history as lines |
| **Receive** (`walletReceive` → `invoice`) | A card with the invoice as a code to scan, "Waiting for the payment.", Copy invoice, and Back to the wallet. The amount is typed on the kit's keyboard |
| **Files** (`filesList` → `files`) | A row for each file. Opening one (`fileOpen` → `file`) shows it in a panel in the world. Saving (`fileSave` → `file-saved`) |
| **Purchases** | The receipts as lines: what, from whom, and whether it is theirs to keep |
| **BitLogin asks** (`confirm`) | A card under "BitLogin asks", with BitLogin's own words and amounts (what, sats, fee, to whom). Below it, "Don't pay" and the press that pays. **That press can't be made until 0.9 s after the card comes up,** shown by its edge filling. The kit sends `confirmed` {id, yes} at least 0.9 s later and within 60 s |

The screens are BitLogin's words in the kit's drawing. What the visitor
was told when they chose VR still holds: a world they let in could show
them anything here.

### Hands are never under the menu

**The owner, 2026-11-24:** "B I think. But we need to make sure that the
menu is not drawn above the hands in VR."

- **Done for today's console** on 2026-11-24: the hands are drawn last,
  over it (`drawnLast`, input.ts; `trials/hands-over-menu.mjs`). The new
  menu keeps that order: the sheet, the bar, a thing come forward, the
  chat's panel, the wrist and the Menu button are all drawn before the
  hands.
- **That holds wherever the hand is,** nearer than the menu or reached past
  it. Nothing of the menu is ever drawn over a hand or a controller.
- **The trial's check is widened** to the new menu: each hand at nine
  places over the sheet, three over the bar, one over the chat's panel,
  and one reached past the sheet.

### Pointed at

- **The thing under the pointer comes forward 3.5 cm** and is lit round its
  edge: a row, a tab, a key on the bar. It takes 120 ms, eased. It is a
  piece of the same picture, lifted off the sheet. Where it was, the sheet
  shows an empty slot, faintly edged, so its words aren't seen twice.
- **It doesn't flicker when the ray shakes.** A thing that has come forward
  stays forward until the ray is a centimetre clear of it.
- **For someone who turned movement down** (`motion: reduced`), nothing
  moves: it is only lit.
- **A long tab scrolls** with the thumbstick, up and down, while the
  pointer is on the sheet, or by holding and dragging. **The tab strip
  scrolls** the same way, left and right, or by pointing at its arrows.

### On the wrist

**The owner, 2026-11-24:** "Yes, narrow layout on the wrist with no bar."

**The same drawing at the narrow width:** 480 of a page's pixels and one
column, as a phone has it, 0.36 m wide (the width of today's wrist
console). The same tabs and rows. No bar. Picture 10.

### Hands with no controllers

A pinch is a press, as today. What is pointed at is where the hand's ray
meets the menu, and it comes forward the same way.

## How the two are kept the same

This is the part that has to hold for ever. Today's console drifted from
the flat menu because it is a second drawing with its own layout.

1. **One table of measures, read by both.** Every size, gap, corner and
   colour of the sheet and the bar goes in one table in the kit (given:
   `SHEET_LOOK`, in `ui/sheet-look.ts`). The flat menu's styles are written
   from it, as they already are from `MARK` for the mark. The headset's
   drawing reads the same table. A measure changed for one is changed for
   both.
2. **One drawing for every headset menu.** It replaces today's console
   drawing (given: `createMenuDrawing` in `menu-drawing.ts`, in place of
   `createConsoleDrawing`). The Three.js console, the engine script and the
   Godot add-on all show its picture, as they show today's.
3. **A new kind of row can't be left out of either.** Each renderer chooses
   its drawing by a `switch` on the row's kind, with no default. A kind
   added to `ui/model.ts` fails the type check until both draw it. Today a
   kind the console doesn't know is dropped, and nothing says so
   (`slider`, for one).
4. **A check that compares the two, tab by tab.** A trial (given:
   `trials/headset-menu-same.mjs`) opens every tab of three worlds, with
   the stand-in rows. For each one it holds the flat menu's boxes, as the
   browser lays them out, against the drawing's places. It needs the same
   rows, in the same order, in the same column, each within 2 px. **One
   difference fails it.** It is run before every merge that touches
   either menu, as the menu trials are now. A test in the gate holds the
   drawing's layout of a fixed view to known numbers, so the gate catches
   a change too.
5. **Pictures beside each other,** like `side-gallery-*.png` here, go to the
   owner with every pull request that changes how either menu looks.

## The way set aside

The first version (2026-11-24) proposed showing the flat menu itself, as a
picture the browser makes of its elements. That would be one menu and no
second drawing. It is set aside because:
- it rests on the Quest's own browser allowing that, which is not known
  (Quest check 1);
- it needed a fallback for browsers that refuse it (Safari), which would be
  today's console, a second drawing anyway;
- it loses things a mend has to put back: where a list is scrolled,
  pictures on canvases, the sheet's arrival.

Drawing from the description works in every browser, and the check above
keeps the two the same.

## Another engine

**A world made with another engine is handed the same picture,** as it is
handed today's console (`NSWP.consolePixels`), with where each thing is
beside it. The picture is larger than today's:
- today: 1024 by 640;
- proposed: 1248 by about 670, at 1.6 of the picture's pixels to each of
  the flat menu's, which is still more than a Quest 3S shows of it.

It is handed over only when it changes, never for a thing coming forward.
To be measured with the build, against the Godot example's numbers
(`docs/plans/godot-headset-controls.md`).

## With the client's menu

In a headset only the world's page can draw. So the world's part draws
this, from the same code and the visitor's own settings (the client's-menu
plan, section 8). It is one design whether the menu on a flat screen is
the world's own or the client's.

## The build, in order

The owner said "Yes, build it" on 2026-11-25. Each step is a pull request,
one at a time, each from main.

1. **This design.**
2. **`SHEET_LOOK` and `createMenuDrawing`.** The flat menu's styles are
   written from `SHEET_LOOK`, and nothing is seen to change: its style
   text is the same, character for character. The drawing covers every
   kind of row, the card, the said strip, the foot and the bar. With it
   come the exhaustive switch on kinds of row, the gate's layout test, and
   `trials/headset-menu-same.mjs`. Not yet shown in a headset.
3. **The headset shows it,** behind `?menu=sheet`, in two pull requests. The first: the sheet and the bar
   in a headset, pointing, pressing, scrolling, coming forward, the wrist's narrow layout, and the hands
   check widened (`trials/hands-over-menu.mjs --sheet`), merged in PR 616. The second: typed rows, the
   song's bar, file rows and the chat panel. All together, this step brings:
   - pointing, pressing, scrolling, and coming forward (still for
     `motion: reduced`);
   - typed rows on the kit's keyboard, the song's bar, copying and saving;
   - file rows (BitLogin Files in VR for the VR way, else `outOfVr`
     `"file"`);
   - the chat, posts and letters panel, and the wrist;
   - the hands drawn last, with `trials/hands-over-menu.mjs` widened to
     the new menu.
4. **The engine script and the Godot add-on.**
5. **On by default,** and `console-drawing.ts` taken out. **This doesn't
   wait for the owner's Quest** (the orchestrator, on the owner's standing
   "anything waiting on me to test, ship it to live"): it goes on once
   steps 2 to 4 pass their trials in the made-up headset. The owner's Quest
   check follows on the live site.
6. **The VR way's screens,** drawn to BitLogin's message names, and off
   until BitLogin's half is released.

The earlier order, kept for what each step holds:

1. **`SHEET_LOOK`, with the flat menu's styles written from it.** Nothing
   is seen to change: pictures of every tab before and after must match.
2. **The drawing** (`menu-drawing.ts`), every kind of row, the card, the
   strip, the foot and the bar. With it, the gate's layout test and
   `trials/headset-menu-same.mjs`. Not yet shown in a headset.
3. **The headset shows it,** behind an address flag (given:
   `?menu=sheet`), in the Gallery. Today's console stays the default. This
   step brings pointing, pressing, scrolling, coming forward, still for
   `motion: reduced`, and the widened hands check. **Then the owner's
   Quest 3S,** on the local copy.
4. **Typed rows, the song's bar, copying, saving and files** in a headset;
   and the chat, posts and letters panel.
5. **The wrist,** and hands with no controllers.
6. **The engine script and the Godot add-on.**
7. **The default,** once the owner has used it in the headset. Today's
   console drawing (`console-drawing.ts`) is then taken out.
8. **The VR way's screens,** once BitLogin's half is released.

## Done looks like

- Pictures from the made-up headset beside the flat menu, for the owner,
  before each merge that changes what is seen.
- `trials/headset-menu-same.mjs`: every tab of three worlds, the same
  rows in the same places, with no difference.
- **On the owner's Quest 3S:**
  - open; read a row without leaning in; change tab; scroll a long tab;
  - press a row; press a pinned thing on the bar; see each come forward
    under the pointer;
  - type into a row; move a song along; close;
  - the same on the wrist.
- **Hands, on the owner's Quest 3S,** since a made-up headset can't settle
  it. With the menu open, hold each hand up in front of it:
  - at the left edge, the middle and the right edge;
  - near the face and at arm's length, and over the bar;
  - then reach past the sheet.

  Do it with controllers, and again with bare hands. **Each time the whole
  hand or controller is seen, and the menu covers none of it.**
- A check in the made-up headset that every tab and every row the flat
  menu has is in the headset's, in the same order, and nothing else.

## Must not

- Lose the floating Menu button, or the summons from a controller.
- Put anything in the headset's menu that the flat one doesn't have, or the
  other way round.
- **Draw any part of the menu over a hand or a controller.**
- Let either menu change how it looks without the other: the table and the
  trial above.

## Not checked

- **Any headset.** Every picture here is from a made-up one, with one eye
  and no lenses. The distance, the bar's lean, how far a thing comes
  forward, and the size (though the owner chose it from pictures) are all
  to be looked at in the Quest.
- **How long the drawing takes on a headset's own processor,** and the
  cost of handing the picture to the graphics card each time it changes.
- **Whether a select in the Quest's browser counts as a press** for copying,
  saving and choosing a file. It is the same question as Quest check 11
  (Sign In using Phone).
- The sketch's measures were read by hand from the flat menu's styles, so
  they are a few pixels out in the side-by-side pictures. The build reads
  them from the one table, and the trial holds them to 2 px, so that goes.
  As the pictures stand:
  - the sketch's sheet is 410 px tall to the flat one's 419 on every tab;
  - rows sit 2 to 6 px higher;
  - a faint tile keeps its colour where the flat one turns it grey.
- **The VR way's pages are taller than the menu's own tabs** (the
  wallet's card, the code to scan). In the pictures the sheet is 0.59 m
  tall on the menu's tabs and 0.66 m on BitLogin's question. In the build
  the one size covers them too, so the sheet doesn't grow when the wallet
  opens. A longer page scrolls instead.

## For the owner

1. **The look:** compare the side-by-side pictures and the headset
   pictures. Is this "the same or better"? What would make it better?
2. **The chat, posts and letters panel** to the right of the sheet in a
   headset: yes? (Today a headset has none.)

## Answered by the orchestrator, 2026-11-25

1. **The names are given:** `SHEET_LOOK` (`ui/sheet-look.ts`),
   `createMenuDrawing` (`menu-drawing.ts`, replacing `createConsoleDrawing`),
   `trials/headset-menu-same.mjs`, and the flag `?menu=sheet`.
2. **A row that takes a file:** BitLogin Files in VR for whoever chose the
   VR way; otherwise `outOfVr` with a seventh reason, `"file"` (given). See
   the table above.
3. **Quest check 1 is struck,** since nothing waits on it now.
