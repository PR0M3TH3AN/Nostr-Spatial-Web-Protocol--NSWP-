# A world's own menu is a quarter of a second late when a page frames it and says nothing

- **Asked:** 2026-11-24, by the orchestrator, from a measurement BitPortal
  made. Not an ask of the owner's. **A fault that is live.**
- **Who:** the NSWP builder.
- **State:** not built. A short written proposal first, then built in its
  turn: after the press lost while the menu is drawn again and the Godot
  trial's held button, and ahead of the headset menu's design.

## What was measured

BitPortal, 2026-11-24: the Grove at kit 0.86.0, how soon its own menu is up
from its page's start, in one sitting at a load of 13 to 17.

| How the world was opened | Median | Loads |
|---|---|---|
| By itself | 389 ms | 7 |
| Framed by a bare page that says no word of any kind | 634 ms (568 to 747) | 7 |
| Framed by BitPortal's shell answering `{ nswp: "menu", has: false }` at once | 366 ms | 5 |

So a world framed by a page that says nothing draws its own menu about a
quarter of a second later than a world opened by itself.

## Why

A framed world asks the page above whether it has the menu, and waits up to
`MENU_WAIT_MS` (300 ms) for an answer before drawing its own
(`packages/sdk/src/menu-above.ts`, `portAbove`). A page that doesn't speak
the menu's words never answers, so the whole wait is paid: by every visitor
of every world framed by anything that doesn't speak the words. That is the
live portal today, and any site that embeds a world.

BitPortal's shell will answer "hasn't" from its next deploy. That mends the
portal and nothing else.

## To propose, in writing, before any code

1. **Why the world waits at all when the page above has said nothing.** The
   plan has the world's `here` carry `menu: 1` where it speaks the words, and
   a client answer at once. Whether there is anything a world can know, short
   of an answer, that says no answer is coming.
2. **The other way round:** the world brings its own menu up at once, and
   steps it aside if a client then says it has the menu. What a visitor sees
   in the worst case (the world's own menu, for a moment, under a client's),
   how often, and whether that is worse than a quarter of a second for
   everyone.
3. **Whatever is proposed, measured as BitPortal measured it:** the three
   cases above, medians of several loads, at a stated load.

## Where it is written

`docs/plans/the-clients-menu.md` has the wait and its reason (its section on
who has the menu, and `docs/plans/the-clients-menu-cost.md`, "How soon").
The proposal goes into the plan, or stays here, as a docs change.
