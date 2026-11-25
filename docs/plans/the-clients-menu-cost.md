# What the client's menu costs: frame times and bytes

**Status:** a trial's result, for step 1 of `docs/plans/the-clients-menu.md` (its
section 10, "What it costs"). NSWP builder, 2026-11-23. Measured in Chrome 157,
scripted, with `trials/menu-cost.mjs`, on one laptop that was busy with something
else (below). Not measured: a Quest, a phone, Firefox, Safari, or BitPortal's own
shell.

## In short

- **Frames: no difference these runs can see.** With the menu down or up, each
  world drew as many frames with the client drawing the menu as with its own. The
  gaps between the two ways are smaller than the gaps between two visits made the
  same way.
- **Bytes: a reference world fetches 67 KB less,** about 18 KB as a host sends it,
  of 3.3 MB. A world made with another engine fetches the same either way: its
  menu is inside the one engine script.
- **The menu is there sooner:** about a third of a second after the page is asked
  for, where a world's own takes most of a second.
- **Words: four to eight cross upward in a visit, 4 to 9 KB in all,** and none at
  all while nothing changes.
- **The Godot example works in a client's frame,** both ways, unchanged. That was
  not tried before this.

## The question

When the client draws the menu above a framed world, the world draws none and says
what it has in words. Does the world draw its frames slower for it? Does the page
above work hard? And what does a framed world no longer download?

## How it was asked

Three worlds, each in a frame of a page on another site: this checkout's builds of
the Gallery and the Grove, and of the Godot example (the Foundry). Each was visited
two ways, on a freshly opened browser with nothing kept from before:

- **The world draws it:** the page above says nothing. The world waits its 300 ms (100 since 2026-11-25; the times on this page were taken at 300)
  and draws its own menu, as it does today.
- **The client draws it:** the page above is the stand-in client
  (`trials/stand-in-client/`), which draws the menu. The world draws none.

In each visit, with the menu down and then up on its Travel tab (the one tab with
the same rows either way), for six seconds each:

- how many frames the world drew, counted in the world's own page;
- how long each page's main thread was busy, asked of the browser (two sites, so
  two processes, and the world's is its own);
- the words that crossed between the two pages, counted where they landed.

And once in each visit: how soon the menu was there, how soon the world was ready,
what each page held in memory after a collection, and every file the world asked
for.

Each world was visited in the order own, client, client, own, so that a machine
getting busier or quieter falls on both ways alike. The whole set was run four
times: twice at a screen's rate of 60 frames a second, which is what a visitor
sees, and twice with Chrome told to draw as many frames as it can
(`--uncapped`), so that anything left over shows as frames. Each number below is
the middle of four visits, with the lowest and the highest.

**The machine and its load.** A laptop with eight threads (an Intel i5-1135G7) and
its own Iris Xe graphics, which the scripted Chrome was told to draw with
(`--use-angle=gl`). Left alone a scripted Chrome draws without the graphics card,
and the Gallery then manages one or two frames a second, which measures nothing.
BitBrowser was relinking Chromium on the same machine throughout. The load, as the
machine itself gives it (8 would be every thread busy):

| Run | Began (UTC) | Load during it |
|---|---|---|
| At a screen's rate, first | 19:29 | 16 to 30 |
| Uncapped, first | 19:34 | 15 to 19 |
| At a screen's rate, second | 19:38 | 13 to 15 |
| Uncapped, second | 19:43 | 14 to 16 |

So every number here was taken on a machine with about twice as much to do as it
has threads. That makes the spread wide. It does not favour either way, because of
the order of the visits.

## Frames

Frames a second in the world's page.

**At a screen's rate:**

| World | Menu | The world draws it | The client draws it |
|---|---|---|---|
| The Gallery | down | 58 (57 to 60) | 59 (56 to 60) |
| The Gallery | up | 59 (54 to 60) | 57 (53 to 60) |
| The Grove | down | 59 (39 to 60) | 58 (50 to 60) |
| The Grove | up | 55 (45 to 59) | 53 (46 to 60) |
| The Godot example | down | 59 (52 to 60) | 60 (60 to 60) |
| The Godot example | up | 59 (52 to 60) | 59 (58 to 59) |

**Uncapped:**

| World | Menu | The world draws it | The client draws it |
|---|---|---|---|
| The Gallery | down | 299 (221 to 326) | 325 (277 to 345) |
| The Gallery | up | 248 (227 to 282) | 250 (235 to 477) |
| The Grove | down | 286 (273 to 348) | 302 (198 to 316) |
| The Grove | up | 206 (127 to 238) | 196 (178 to 425) |
| The Godot example | down | 77 (55 to 84) | 83 (78 to 86) |
| The Godot example | up | 79 (58 to 84) | 77 (74 to 80) |

In every row the two ways overlap. A menu being up costs frames whoever draws it
(the Gallery and the Grove both lose some uncapped). Who draws it does not show.

## How hard each page works

Milliseconds of main-thread work in each second, from the runs at a screen's rate.

| World | Menu | The world's page, drawing its own | The world's page, the client drawing |
|---|---|---|---|
| The Gallery | down | 190 (161 to 202) | 186 (177 to 211) |
| The Gallery | up | 211 (178 to 251) | 218 (201 to 266) |
| The Grove | down | 153 (150 to 297) | 168 (143 to 177) |
| The Grove | up | 319 (264 to 402) | 284 (259 to 327) |
| The Godot example | down | 680 (599 to 836) | 615 (603 to 639) |
| The Godot example | up | 712 (640 to 867) | 720 (675 to 724) |

The world's page works the same either way, within the spread.

**The page above** was busy 23 to 25 ms in each second when it was a page that says
nothing (that much is the frame itself and this trial's counting), and 27 to 38 ms
when it was the stand-in client: about 10 ms a second more, one hundredth of one
thread, with the menu down or up.

One thing seen and not looked into: the Grove's own page works about twice as hard
with a menu up as with it down, whoever draws the menu.

## How soon

Milliseconds after the page was asked for, at a screen's rate. The menu's time is
by the clock of the page that drew it.

| World | The menu is there: the world's own | The menu is there: the client's | The world is ready: own | The world is ready: client |
|---|---|---|---|---|
| The Gallery | 970 (797 to 997) | 286 (275 to 405) | 2373 (2007 to 3128) | 1779 (1497 to 2196) |
| The Grove | 908 (725 to 1052) | 551 (234 to 749) | 2061 (1605 to 3490) | 2581 (1078 to 3213) |
| The Godot example | 884 (663 to 1237) | 329 (246 to 350) | 6791 (4939 to 12178) | 7509 (6304 to 9959) |

The client's menu is there before the world has said anything, with Home on it.
A world's own waits for the world's page, then 300 ms for a client that might
answer. How soon the world itself is ready doesn't change in a way these runs can
tell from the load.

## Memory

What each page's scripts held after a collection, with the menu still up, in
megabytes, from the runs at a screen's rate.

| World | The world's page, drawing its own | The world's page, the client drawing |
|---|---|---|
| The Gallery | 10.7 (10.5 to 10.7) | 10.4 (10.2 to 10.5) |
| The Grove | 7.4 (7.3 to 7.9) | 7.5 (7.1 to 7.8) |
| The Godot example | 12.8 (12.8 to 12.8) | 12.6 (12.6 to 12.7) |

A world holds a little less, or the same. **The page above held 0.9 MB as a page
that says nothing and 2.9 MB as the stand-in client:** about 2 MB, once, whichever
world is in the frame.

## Bytes

Every file each world asked for, both ways, as the files are on disk.

| World | Drawing its own menu | The client drawing | What it didn't fetch |
|---|---|---|---|
| The Gallery | 3,288,457 | 3,221,371 | `chunks/menu-….js`: 67,086 bytes, 20,284 gzipped, 18,021 as brotli |
| The Grove | 3,409,014 | 3,341,928 | `chunks/menu-….js`: 67,086 bytes, 20,283 gzipped, 17,994 as brotli |
| The Godot example | 44,338,661 | 44,338,661 | Nothing |

- **A reference world leaves out one file, the menu:** 2% of what it fetches,
  18 KB as a host sends it. That is what "the bytes a framed world no longer
  downloads" comes to. It is small because the menu's model, which a world needs
  to describe itself, stays.
- **A world made with another engine leaves out nothing.** The engine script is one
  file with its menu inside (2.6 MB, of the Godot example's 44 MB), and one file is
  the point of it. Splitting it to save 18 KB is not worth a second file.

**What the client carries instead.** The stand-in client's own code is 804 KB, 196 KB
as brotli, but two thirds of that is Three.js, which comes with the kit's Bag (its
turning pictures). A client that takes the kit's menu, both ends of its port, the
switches, Sound and Help, and no Bag, builds to 231 KB: 86 KB gzipped, 76 KB as
brotli. Of that, 101 KB is the list of public suffixes, which the kit uses to show a
site by its own name so that a lookalike stands out, and 114 KB is the kit's own. What BitPortal's shell comes to is
BitPortal's to measure in step 2.

## Words

Counted over a whole visit, from the first moment to the menu standing open on
Travel.

| World | Upward, to the client | Downward, to the world |
|---|---|---|
| The Gallery | 4 or 5 words, 5.8 to 8.7 KB; the biggest 3.0 KB | 3 words, 302 bytes |
| The Grove | 4 or 5 words, 5.8 to 9.0 KB; the biggest 3.2 KB | 3 words, 302 bytes |
| The Godot example | 6 to 8 words, 4.1 to 7.7 KB; the biggest 1.9 KB | 3 words, 302 bytes |

- Upward: `here`, then the world's description three or four times as it comes up,
  and from the Godot example a few words said for a moment. The biggest
  description is a twentieth of the 64 KB a description may be.
- Downward: that the client has the menu (with the visitor's settings), the
  settings, and that the menu came up.
- **While nothing changes, nothing crosses.** In all 24 visits with the client
  drawing, no word went either way during a measure with the menu down. With it
  up, one description went up in five of the Godot example's eight measures, and
  nothing anywhere else. Looked at afterwards, that one is a real change: a row
  that appears when the world gives up waiting for its sign-in address, which
  this trial refuses.
- A world drawing its own menu says one word in the whole visit: `here`.

## What this doesn't say

- **Nothing about a headset.** In a headset the world draws the console itself,
  whoever has the menu on the flat page, so a headset session's frames are not
  changed by any of this. What a Quest's browser does with the flat page before
  "Enter VR" was not measured.
- **Nothing about a phone.** The frame on a phone is step 5.
- **One graphics card, through a scripted Chrome with no screen.** The numbers are
  for comparing the two ways on this machine, not for saying how fast a world is.
- **The stand-in client is not BitPortal's shell.** A shell with more of its own on
  the page will be busier than "about 10 ms a second".
- **Four visits to a cell, on a loaded machine.** A difference of a few frames in a
  hundred either way would not show here. A large one would.
- **Godot's two audio worklets** came from the local sites service, past the
  trial's own serving (a scripted browser lets them through), so they are not in
  the bytes. They are the same two files either way.

## What follows for the design

1. **Nothing in step 1 has to change for speed.** Section 10 of the plan said the
   client's bar and marks are a small layer over the frame, and nothing is sent
   per frame. Both held.
2. **The reason for the client's menu is not bytes.** A world saves 18 KB. What a
   visitor gets is one menu, the same in every world, there before the world is.
3. **For BitPortal, step 2:** the kit's menu without the Bag is about 76 KB as a
   host sends it. The kit's Bag brings Three.js with it, which a shell that draws
   in 3D already has.

## Running it again

    npm run build && npm run build:godot && node trials/menu-cost.mjs

`--only=gallery` for one world, `--once` for each way once, `--uncapped` for as many
frames as the machine can draw, `--software` to draw without the graphics card,
`--out=file.json` to keep the result. The local sites service has to be up, for
Godot's two worklets. A picture of each visit, with the menu up, is left in
`.shots/`.
