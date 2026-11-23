# Four more presses: what the client can do itself and hand over

**Status:** a trial's result. **Its words were given and its question answered on
2026-11-23** (the orchestrator): the two kinds of row are built as proposed here,
with one addition (the client says what it saved, and from which world), and are
in `protocol/02-doors.md`, "A file going down, and something to save going up". On
the screen: C, as its own piece with step 3, and never B; until then A, which is
built. What follows is as it was written before those answers.

**As first written:** a trial's result, with words proposed and one question open. For step 1
of `docs/plans/the-clients-menu.md` (its section 15, "Four more presses"), and the
second half of `docs/plans/the-clients-menu-presses.md`. NSWP builder, 2026-11-23.
Tried in Chrome 157, scripted, with `trials/presses-handed-over.mjs` and a new visit
in `trials/menu-client.mjs`. Not tried: Firefox, Safari, Meta's browser on a Quest, a
phone, or a person's own Chrome (below). **The words in "Proposed" are not given, and
nothing is built on them yet** (rule 11).

## In short

| What | Can the world do it from a press above? | Can the client do it and hand it over? |
|---|---|---|
| Choosing a file | No: the browser's chooser never opens | **Yes.** The file arrives as it is, 64 MB in 3 ms or less |
| Saving a picture | The scripted Chrome let it, pressed or not: a person's Chrome has to say | **Yes.** The world hands the picture up and the client saves it |
| The visitor's own music | Not asked: Sound is the client's tab | **Yes, and tried in the stand-in client:** it plays through a door |
| Sharing the screen | **No, whatever is pressed, in the shell's frame today.** The frame is not allowed it | **Yes,** over a connection between the two pages. A question for the orchestrator |

## The question

A press on the client's menu is a press in the client's page. `the-clients-menu-presses.md`
showed which things a world can't then do. Four more were found while listing the
tabs. The orchestrator's rule for them (2026-11-23): **before settling for a second
press, try whether the client can do the browser's part itself and hand the result
over,** so that it stays one press.

## How it was asked

The same way as the first half: two pages on two different sites, the one in the
frame given exactly what BitPortal's shell gives a world (`allow`). Nothing is run
inside either page. Each page reads what to try from its own address and says what
happened on its console; presses are a mouse at a place on the screen. Whether a
chooser opened and whether a file was saved are seen from outside, by the browser's
own events. A file is given to the chooser from outside, as a person would choose one.

Each thing the frame tries itself is tried three ways, on freshly loaded pages:
**none** (nothing pressed anywhere), **above** (a press on the page above, which tells
the frame in words) and **own** (a press in the frame's own page, the control).

Sharing the screen needed more care, because the browser's chooser is not part of
any page. It was asked of a Chrome with a window, on a screen nobody was looking at
(`xvfb-run`), and the whole screen was photographed.

## Choosing a file

| | Nothing pressed | Pressed above | Pressed in its own page |
|---|---|---|---|
| The frame opens the browser's chooser | never opened | **never opened** | opened |

So "Hang a picture or video from this device" can't work from the client's menu as
it is. The other way round:

| The page above opens the chooser at its own press, and hands the file down | What the frame got |
|---|---|
| A picture | The file itself, with its name, size and kind, 1 to 3 ms after it was sent. The frame drew it |
| 64 MB of nothing | The same, in 1 to 3 ms. The frame read all of it, in 0.2 to 0.9 s |
| The chooser opened and nothing was chosen | Nothing arrived |

A file crosses between two sites as the file it is. It is not copied on the way,
which is why 64 MB takes no longer than 70 bytes.

## Saving a picture

| | Nothing pressed | Pressed above | Pressed in its own page |
|---|---|---|---|
| The frame saves a picture itself | saved | saved | saved |

The scripted Chrome let the frame save with nothing pressed at all. That may be
true of a person's Chrome too, or a scripted one may be more willing. It doesn't
decide anything: handing up works, and it is the way (the orchestrator, 2026-11-23).

| The frame makes the picture and hands it up; the page above saves it | What happened |
|---|---|
| At once | Saved, 5 to 23 ms after the press |
| Seven seconds after the press, when the browser no longer counts the page above as pressed | Saved |
| Twice from one press, seven seconds apart | Both saved |
| With nothing ever pressed anywhere | Saved |

The page above saves under a name of its own. The frame never names the file.

## The visitor's own music

Nothing to ask of the browser: the client's page opens the chooser and plays the
sound, and both are presses in its own page. Tried in the stand-in client over this
checkout's Gallery (`trials/menu-client.mjs`, seven checks):

- a press on the client's own row, "Add music from this device", opens the browser's
  chooser;
- the chosen file is kept by the client's page, and played by it;
- the world is told nothing of it, and keeps none of it;
- the next world comes into the frame, and the same page is still playing the same
  song. That world is told nothing either.

Nobody listened. That is on the owner's list.

## Sharing the screen

**With what the shell allows a frame today:**

| | Nothing pressed | Pressed above | Pressed in its own page |
|---|---|---|---|
| The frame asks to share the screen | refused | refused | **refused** |

Chrome refuses by name: the frame is not allowed `display-capture`. So **in
BitPortal's frame today, "Share your screen" is offered in a room and can't work,**
whoever draws the menu. The world says "Nothing was shared." and not why. A second
press named "Share your screen", which the plan had as the fallback, would be
refused the same.

**With `display-capture` added to what the frame is allowed:**

| | Nothing pressed | Pressed above | Pressed above, handed down by name | Pressed in its own page |
|---|---|---|---|---|
| The frame asks to share the screen | **the browser's chooser came up** | came up | came up | came up |

Two things in that table matter.

- **No press was needed.** The chooser came up with nothing pressed anywhere: the
  frame said the browser had never counted it as pressed. The Chrome asked was
  started without the scripting tool's test switches, to be as near a person's as
  a scripted one gets. The web's own standard asks for a press. This Chrome
  didn't. So whether a press above can be handed down for it
  (`delegate: "display-capture"`, which Chrome accepted) can't be told: there was
  nothing for it to add.
- **The chooser names the client, not the world.** Its heading was "Choose what to
  share with client.test", and under it "The site will be able to see the contents
  of your screen", with three tabs: Chrome Tab, Window, Entire Screen. The world's
  name was nowhere on it, though the world's page had asked and would get the
  picture.

**The other way round: the page above shares the screen, and hands the picture down.**
The frame was allowed only what the shell allows today.

| | What happened |
|---|---|
| The page above asks to share, at its own press | It had the screen (Chrome's made-up one, with a made-up yes at the chooser) |
| It hands the track itself down in words | **Refused:** a track can't cross between pages that way |
| It sends the picture over a connection between the two pages, set up in words | **The frame had the picture** 0.1 to 0.3 s after the offer, never pressed and allowed nothing new |

## What a scripted browser can't show

For the owner's by-hand list in the plan:

- **Whether a frame can save a picture with nothing pressed, in a person's Chrome.**
  It could here. Handing up is the way regardless.
- **Whether a person's Chrome asks before a second save from one press** ("download
  multiple files"). It didn't here.
- **Whether a person's Chrome wants a press before the screen chooser.** It didn't
  here, twice.
- **The music, by ear.**

## What follows for the design

1. **A file goes down from the client's chooser.** One press. Words proposed below.
2. **A picture goes up and the client saves it.** One press. Words proposed below.
3. **Music is the client's own,** and needs nothing new. It is in the kit's Sound
   controls, which a client mounts.
4. **Sharing the screen is a question** (below). Whatever the answer, the row can't
   stay as it is in the shell: it is offered and fails without saying why.

## Proposed: a file going down

Not given. Names in `code` are proposals.

- **A row of a new kind, `file`.** A world describes it with the kinds of file it
  takes, from a list the core fixes: `accept: ["image", "video"]`
  (`MENU_FILE_KINDS`). No world can ask for "any file". Like a row typed into, it
  is taken only in named places: Panels, and a world's own tabs.
- **What the visitor sees.** A button with the world's label, and under it a line
  the client writes, as it does for a row typed into: **"The file you choose goes to
  <the world's title>."** The world's name is also at the head of its part of the tab.
- **At the press** the client's page opens the browser's chooser, offering only
  those kinds. Choosing a file there is the visitor's yes: nothing is said to the
  world until then, and nothing if they choose none.
- **The word,** client to world: `{ nswp: "menu", press: "<the row's id>", file: <the file> }`.
  One file to a press. A press carries a `file` or a `field`, never both.
- **Limits,** checked by the client before anything is sent and again by the world
  as it reads the word:
  - 64 MB at most (`MENU_LIMITS.file`, 67,108,864 bytes: what Panels takes today);
  - its kind must be one the row asked for, by the kind the browser gives the file;
  - its own name goes with it, up to 255 characters (`MENU_LIMITS.fileName`). A
    longer name is left out, not cut, and the file goes without one. Nothing else
    of the device goes: no path, no folder.
- **Over a limit,** nothing is sent, and the client says why in the kit's own
  words: "That file is too large to hand over: 64 MB at most." or "Only pictures
  and video can go here."
- **In a headset** nothing changes: the row is already left out there.

## Proposed: a picture going up

Not given.

- **A row of a new kind, `save`:** "Take a picture", "Take a selfie", "Stop
  recording", "Save 2 pictures". It tells the client that this press may be answered
  with something to save.
- **The word,** world to client: `{ nswp: "menu", save: <the picture or clip>, id: "<the row's id>" }`.
- **The client takes it only as the answer to a press it sent,** on a row of that
  kind, in that world, within ten seconds (`MENU_SAVE_MS`). A world can't put a file
  on the visitor's device unasked. Up to 12 to a press (`MENU_LIMITS.saves`), for
  "Save 12 pictures" after a headset session; more wait for the next press.
- **Limits:** 64 MB at most (`MENU_LIMITS.save`; a 30-second clip is about 23 MB),
  and its kind one of `image/jpeg`, `image/png`, `image/webp`, `video/webm`,
  `video/mp4` (`MENU_SAVE_TYPES`). Anything else is not read.
- **The name is the client's own:** the world's title, the date and time, and an
  ending from the kind. The world never names a file on the visitor's device.
- **The client saves it from its own page** and says so: "Picture saved to this
  device." A client that keeps a visitor's files somewhere of its own (step 4) may
  take it there instead (`onSave`).
- **A clip that ends by itself** at its 30 seconds has no press before it. The world
  keeps it, and its row becomes "Save your clip", as kept pictures do after a
  headset session.

## The question: sharing the screen

For the orchestrator. Three ways, and what each is.

| | A. Not in a client's frame | B. Allow the frame `display-capture` | C. The client shares, and hands the picture down |
|---|---|---|---|
| What changes in the shell | Nothing | One word in the frame's `allow` | Nothing in `allow` |
| Presses | None: the row says why not | One, or none | One on the client's row |
| The browser's chooser says | Not shown | "Choose what to share with <the client>", for a world | "Choose what to share with <the client>", and the client is what gets it |
| A line from the client first | Not needed | **Can't stand in front.** The world asks the browser itself and needs nothing from the client, so the line is there only when the world chooses to go through it | **Stands in front.** The client's page is the only one that can ask |
| A world bringing the chooser up unasked | Can't | **Can, at any moment, with nothing pressed** | Can't |
| Stopping it | Not needed | The world's own row | The client's row, and by itself at a door, since the client holds the screen |
| What it costs to build | Words for the row | Nothing in the kit | A connection between the two pages, set up in words; the kit's room takes the screen from it. The picture is packed once more on the way, and how it looks was not judged |

- **What the visitor is asked, in every case, is the browser's own chooser:** they
  pick a tab, a window or the whole screen each time, and can cancel.
- **What differs is whose name is on it and who can bring it up.** In B the client's
  name is on a question a world is asking, and the world can ask whenever it likes.
- **My recommendation: C,** as its own piece after the file and the picture, with A's
  words on the row until it is built. It is the same rule as the other three presses:
  the client does the browser's part and hands the result over.

## Running it again

    node trials/presses-handed-over.mjs
    xvfb-run -a -s "-screen 0 1280x900x24" node trials/presses-handed-over.mjs --shown

The second photographs the screen chooser into `.shots/`. Without `--shown` the
frame's asking to share says only "no answer". The music is in
`npm run build && node trials/menu-client.mjs`.
