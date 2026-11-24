# A world's own menu is a quarter of a second late when a page frames it and says nothing

- **Asked:** 2026-11-24, by the orchestrator, from a measurement BitPortal
  made. Not an ask of the owner's. **A fault that is live.**
- **Who:** the NSWP builder.
- **State:** **built, 2026-11-24: 100 ms, not 300. Not live.** Proposed
  below as 50. The orchestrator gave 100, on BitPortal's timing of its own
  shell that day: with the processor slowed six times a client's "has" took
  26 to 37 ms at the middle and 66 to 197 at the worst, so 50 would lose now
  and then. The table and the reasons are in the plan
  (`docs/plans/the-clients-menu.md`, section 6), with a rule that came of it:
  a client says it has the menu from its first script. Built after the press
  lost while the menu is drawn again (#463), as its own pull request, with
  the three cases as a trial that says the medians.

## What was measured first

BitPortal, 2026-11-24: the Grove at kit 0.86.0, how soon its own menu is up
from its page's start, in one sitting at a load of 13 to 17.

| How the world was opened | Median | Loads |
|---|---|---|
| By itself | 389 ms | 7 |
| Framed by a bare page that says no word of any kind | 634 ms (568 to 747) | 7 |
| Framed by BitPortal's shell answering `{ nswp: "menu", has: false }` at once | 366 ms | 5 |

## Why

A framed world asks the page above whether it has the menu, and waits up to
`MENU_WAIT_MS` (300 ms) for an answer before drawing its own
(`packages/sdk/src/menu-above.ts`, `portAbove`). A page that doesn't speak
the menu's words never answers, so the whole wait is paid: by every visitor
of every world framed by anything that doesn't speak the words. That is the
live portal today, and any site that embeds a world.

**It is the world that is late, not only its menu.** A reference world brings
its menu up before it sets anything else going (`sites/shared/world.ts`), so
the same wait is added to how soon the world can be walked in.

BitPortal's shell will answer "hasn't" from its next deploy. That mends the
portal and nothing else.

## The two questions, answered

### 1. Why the world waits at all when the page above has said nothing

**Because silence is the only sign there is.** A browser gives a framed page
nothing that says whether the page above listens for its words. A client
that speaks them answers; a page that doesn't is silent; and a page that has
not answered yet looks the same as one that never will. So nothing can be
known short of an answer, and the only question is how long the silence has
to last.

**300 ms was a guess,** made before any answer had been timed. Timed now
(below): a client that answers at once is heard by the world **2 ms** after
it hears the world on a quiet machine (6 at most), and **4 ms** on a very
busy one (25 at most). The wait is twelve times the longest answer seen.

### 2. The other way round: the world's own menu at once, stepped aside for a client

Tried, as a wait of nothing. The kit needs no new code for it: a late answer
already puts the world's own menu away, and a menu that arrives for a world
whose client now has one is put away before it is seen (`keepMenu`).

- **On a quiet machine, under a client that answers at once, nothing is
  seen.** The answer comes while the menu's file is still on its way, so the
  menu is made and put away in the same moment: in the page for 0 to 1 ms,
  and no frame drawn with it, in 7 loads of 7.
- **On a busy machine it is seen, though the client answered at once: in 4
  loads of 7 the world's own menu was drawn, and stayed up for 527 to
  689 ms.** A world that doesn't wait is busy starting itself from its first
  moment, and hears nothing from above until it is next free. The answer was
  there in a few milliseconds and waited half a second to be heard. **A wait
  is the only time a world is listening.** That is the finding that decides
  this.
- **Every world under every client fetches its menu and never uses it:**
  75 KB, 20 KB as a host sends it. That file is the one thing a framed world
  no longer downloads (`docs/plans/the-clients-menu-cost.md`, "Bytes").
- **What it buys over a wait of 50 ms: about 60 ms on a quiet machine,**
  which is four frames.

**What a visitor sees in the worst case,** held still for a picture (the
stand-in client made to hear the world six seconds late): the world's own
menu comes up exactly under the client's, in the same places. What shows is
an edge of the world's name plate under the client's, top left, and nothing
else in the Grove; a world with more keys on its bar than the client's would
show the outer ones either side. A press in that moment lands on the
client's menu, which is on top. Then the world's own goes. Pictures, in the
sessions' notes folder: `menu-late-two-menus-1100.png`,
`menu-late-two-menus-390.png`, and the same view a moment after,
`menu-late-one-menu-after-1100.png`, `menu-late-one-menu-after-390.png`.

**How often:** whenever a client's answer is heard later than the wait and
the menu's file together. That happens today at 300 ms, on a development
server (the plan's section 6, "the client answers late"). With no wait it
happened in most loads on a busy machine, whatever the client did.

**Is that worse than a quarter of a second for everyone?** It is not the
choice. A flash that is mostly hidden would be better than a late world for
all, if it were rare; with no wait it is not rare on a slow device, and it
lasts half a second. A short wait gets all but 60 ms of the gain, keeps the
bytes saved, and in these runs showed nothing under a client that answers
at once.

## Proposed

**A framed world waits 50 ms for a client's answer, not 300.** One number,
`MENU_WAIT_MS` in `packages/core/src/menu.ts`. Nothing else in the kit
changes: what happens when an answer comes later than the wait is built, has
unit tests, and is tried in two trials (`trials/menu-above.mjs` and
`trials/menu-above-engine.mjs`: an answer that comes late, and one that
comes while the menu's file is on its way).

- **50 and not 25:** 25 was enough on a quiet machine. On a busy one a world
  gave up before the answer once in 7 loads, and fetched a menu it then put
  away unseen. At 50 none did, in 14 loads.
- **50 and not 100:** 100 still leaves the menu a tenth of a second late for
  everyone, to cover a lateness that was not seen here: the longest an
  at-once answer took to be heard was 25 ms, on a machine with three times
  the work it has threads for.
- **The words don't change,** and their version stays 1. A client needs no
  change: it answers at once, as the plan has it.

### What it risks

- **A client slow to answer shows the flash where today it shows nothing.**
  Today a client has 300 ms; it would have 50. With an answer 150 ms late,
  the world's own menu was up for 124 ms on a quiet machine and 590 ms on a
  busy one; at 300 ms it was never up. What the flash looks like is above.
  **Not known: how long a real client takes on a real phone.** BitPortal's
  shell is the one to say, timed in its own page from hearing `here` to
  answering, before this is built. If that is often over 30 ms, the number
  should be 100.
- **A development server,** where the shell asks the network before it
  answers, shows the flash on most loads and not some. It is said in the
  plan as accepted (point 12 of its section 16); it would be seen oftener.

### With it, when it is built

- A trial that measures this and prints the table below, kept in `trials/`,
  so the next question about how soon the menu is there is one command.
- The plan's section 6 and point 12 of its section 16, the table of numbers
  in its section 13, the cost page's "How soon", and the number's row in
  `docs/fleet.md` once it is given.
- The engine script built again, since the number is inside it. Its VERSION
  stays as it is.

## Looked at, and not proposed

- **Asking sooner.** A world says `here` only once its own script has run:
  120 to 380 ms into its page on this machine, and longer over a real
  network. Asked from the page's first lines, any wait would be over before
  the menu is wanted, and a client would have far longer to answer. It would
  change every world's page, the template, and what `here` tells a client
  (today: this place's script ran). That is a design to weigh, not a mend.
- **Fetching the menu's file while waiting.** It saves the file's own time
  (about 15 ms here) and not the wait, and costs the bytes under every client.
- **Remembering that a page above said nothing last time.** A second visit
  would not wait. The first still would, and a world would be keeping a note
  about the page that frames it.

## The measurement

The Grove's build from main at 3805544 (kit 0.87.0), in a scripted Chrome
drawing with the machine's graphics card, every request and socket answered
by the script. The wait was changed as the built script was served, and
nothing else. Each time is by the world's own page's clock, from that page's
start. Each number is the median of seven loads, with the least and the
most. The cases were visited in turn and the turn reversed each round, so a
machine getting busier or quieter falls on every case alike.

How the world was opened:

- **By itself:** its own address.
- **Silence:** framed by a page that says no word of any kind.
- **A "hasn't":** framed by a page that answers `here` at once with
  `{ nswp: "menu", has: false }`.
- **A "has":** framed by a page that answers at once that it has the menu.
- **A late "has":** the same, answered 150 ms after `here`.

### A machine mostly quiet

Load over the run 0.9 to 22: another session's trial was running for the
first two rounds (9 to 22), then 1 to 12.

**How soon the world's own menu is there, in ms:**

| Wait | By itself | Silence | A "hasn't" |
|---|---|---|---|
| 300 (today) | 178 (123 to 227) | **490** (425 to 715) | 182 (146 to 387) |
| 100 | | 283 (240 to 486) | 182 (134 to 410) |
| **50** | | **216** (189 to 283) | 168 (146 to 244) |
| 25 | | 175 (166 to 188) | 143 (130 to 210) |
| 0 | | 152 (134 to 228) | 165 (140 to 342) |

**How soon the world can be walked in, in ms:**

| Wait | By itself | Silence | A "hasn't" |
|---|---|---|---|
| 300 (today) | 350 (254 to 479) | **663** (576 to 1163) | 339 (271 to 835) |
| 100 | | 437 (390 to 852) | 340 (280 to 766) |
| **50** | | **378** (318 to 520) | 299 (276 to 382) |
| 25 | | 316 (295 to 334) | 286 (274 to 391) |
| 0 | | 300 (279 to 422) | 301 (291 to 612) |

**Under a client that has the menu:**

| Wait | Answered at once: heard in | Fetched its menu | Its own menu drawn | Answered 150 ms late: its own menu up for |
|---|---|---|---|---|
| 300 (today) | 2 ms (1 to 6) | 0 of 7 | 0 of 7 | never up |
| 100 | 1 ms (1 to 2) | 0 of 7 | 0 of 7 | 141 ms (115 to 409) |
| **50** | 2 ms (1 to 5) | 0 of 7 | 0 of 7 | 124 ms (122 to 404) |
| 25 | 1 ms (1 to 2) | 0 of 7 | 0 of 7 | 124 ms (118 to 422) |
| 0 | 2 ms (1 to 15) | **7 of 7** | 0 of 7 (in the page 0 to 1 ms) | 279 ms (132 to 420) |

"Heard in" is from the page above hearing `here` to the world hearing its
answer. Over every wait but nothing, a "has" was heard in 2 ms (1 to 6, 28
loads) and a "hasn't" in 1 ms (1 to 18, 28 loads). The world said `here`
146 ms into its page (117 to 375), and its menu's file took 15 ms (13 to 75)
from being asked for to the menu being there.

### A busy machine

Fourteen busy loops running beside the browser on eight threads. Load over
the run 15 to 29, 25 at the middle: busier than BitPortal's sitting. The row
for 100 is a run of its own under the same loops (load 15 to 25), in which
the world by itself had its menu at 608 (434 to 881) and could be walked in
at 1369 (949 to 1661).

**How soon the world's own menu is there, in ms:**

| Wait | By itself | Silence | A "hasn't" |
|---|---|---|---|
| 300 (today) | 639 (525 to 675) | **940** (791 to 1105) | 734 (572 to 880) |
| 100 | | 723 (532 to 932) | 619 (535 to 944) |
| **50** | | **770** (597 to 792) | 696 (517 to 816) |
| 25 | | 703 (589 to 808) | 559 (433 to 826) |
| 0 | | 647 (470 to 780) | 732 (542 to 1039) |

**How soon the world can be walked in, in ms:**

| Wait | By itself | Silence | A "hasn't" |
|---|---|---|---|
| 300 (today) | 1271 (1206 to 1778) | **1574** (1405 to 1729) | 1373 (1214 to 1680) |
| 100 | | 1367 (1196 to 1513) | 1422 (1253 to 1553) |
| **50** | | **1427** (1319 to 1497) | 1450 (1218 to 1614) |
| 25 | | 1436 (1298 to 1646) | 1250 (1103 to 1561) |
| 0 | | 1332 (1157 to 1563) | 1359 (1115 to 1676) |

A machine this busy spreads each case over 200 ms and more, so a difference
of under 100 ms between two rows says nothing: a "hasn't" is not slower with
no wait than with 25. What the tables do say is the first row against the
rest.

**Under a client that has the menu:**

| Wait | Answered at once: heard in | Fetched its menu | Its own menu drawn | Answered 150 ms late: its own menu up for |
|---|---|---|---|---|
| 300 (today) | 4 ms (2 to 11) | 0 of 7 | 0 of 7 | never up |
| 100 | 4 ms (2 to 9) | 0 of 7 | 0 of 7 | 547 ms (414 to 654) |
| **50** | 5 ms (3 to 25) | 0 of 7 | 0 of 7 | 590 ms (474 to 643) |
| 25 | 4 ms (2 to 8) | 1 of 7 | 0 of 7 (in the page under 1 ms) | 603 ms (530 to 931) |
| 0 | **560 ms** (7 to 750) | **7 of 7** | **4 of 7, up for 527 to 689 ms** | 583 ms (490 to 719) |

With no wait the answer was said as soon as ever; it is the hearing that
took half a second. The world said `here` 596 ms into its page (334 to 816),
and its menu's file took 72 ms (48 to 180).

At 25, the load that fetched its menu heard its answer 4 ms after the page
above heard `here`. So it was most likely the world's `here` that was slow
to arrive: that part is not timed here, and is why 25 is too close.

### What this doesn't show

- **A real phone, a real network, or a real client.** The page above here
  does nothing but answer. BitPortal's shell draws a menu and may be busy as
  a world comes up.
- **Another engine's world.** The engine script says `here` as it loads,
  long before its world is ready, so its wait may be over before its menu is
  wanted. Not measured here.
- The script that measured this is not in the repository yet: it comes with
  the build, as a trial. Until then it is in the sessions' notes folder with
  every load's own numbers (`menu-late/menu-soon.mjs` and three `.json`
  files; `menu-two.mjs` made the pictures).

## Where it is written

`docs/plans/the-clients-menu.md` has the wait and its reason (section 6, and
point 12 of its section 16), and `docs/plans/the-clients-menu-cost.md`, "How soon", has the
first times.
