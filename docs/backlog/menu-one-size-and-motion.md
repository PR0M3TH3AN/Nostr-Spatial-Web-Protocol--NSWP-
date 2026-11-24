# The menu keeps one size on every tab, and comes in with some motion

- **Asked:** 2026-11-24. The owner: "oh another thing that is annoying about
  the bitportal menu in all modes. The menus size should be the same across
  all tabs. So the tabs always stay at eye level or where ever they are at
  in the largest view currently. I like the spacing it currently has on the
  larger tabs). And it would be nice if menu elements kinda animated in a
  bit rather than poped in really fast. And it would be cool if the menu
  animated open and closed as well. Some sort of digital wireframe that
  filled in with its content."
- **Who:** the NSWP builder (the kit's menu, `packages/sdk/src/ui/hud.ts`,
  which is the menu a world draws and the one BitPortal's shell draws; then
  the headset's). BitPortal follows by vendoring.
- **State:** **the first of the three, one size, is built in the kit,
  2026-11-24; not live.** The other two (motion) are not designed, and come
  last in the builder's queue, with a film for the owner before they go
  live.

## And, once it was live: the sheet must not cover the row at the top (2026-11-24)

One size went live in kit 0.88.0 the same day, and the owner sent a
picture he had marked (kept in the sessions' notes folder,
`menu/owner-sheet-covers-the-top-2026-11-24.webp`): "can we make sure the
menu on flat screens dont cover the items at the top? Like the full
screen or login badge or the world info or menu button."

In a wide, short window the sheet, now as tall as its largest tab on
every tab, reaches up over the row at the top: its strip of tabs lies
across "Full screen", its left end over the world's card, its corner
beside the Menu button. Before one size a short tab left that row alone.

Wanted: the sheet never lies over anything in the top row (the world's
card, the mark for who you are signed in as, "Full screen", the Menu
button, and whatever else sits there). Its top stops below the lowest of
them, measured from where they are and not from a share of the window. One
size holds: the largest tab's size, or as tall as that room allows, and a
longer tab scrolls inside. A check that fails today, at short windows
too. In the builder's queue right after the Bag's pictures asked for too
soon, for the same kit version.

## Three things

### 1. One size, on every tab

Today the sheet is as tall as the tab that is open, so going from a long
tab to a short one moves the tab strip and everything else. Wanted: the
sheet is the size it has on its largest tab, on every tab, so the strip
stays where it is ("at eye level"). The spacing of the larger tabs is
liked and stays. A short tab has room left over; it is not stretched to
fill it.

"In all modes": on a desk, at a phone's width, and in a headset.

**As built (2026-11-24):**

- **The sheet is the height it has on its largest tab, on every tab.**
  Found, not guessed: every tab the visitor has, a world's own among them,
  is laid out at the sheet's own width and measured. The tab that is up is
  measured where it is; each other one in a box nobody sees, with nothing
  painted or fetched for it, and again only when what it holds, the width
  or the size of text has changed.
- **Never taller than the screen allows.** A tab longer than that scrolls
  inside the sheet, as before. At a phone's width that is every tab's size:
  the Gallery's longest tabs are longer than the sheet may be.
- **A short tab is not stretched.** Its rows are their own height, and the
  room left over is above the strip of said lines and the foot.
- **A world adds a tab while the menu is up:** if it is larger than any
  before, the sheet grows to it once, then, and the strip moves up that
  once. While the menu is up the sheet only grows; a tab that goes or
  shrinks doesn't make it smaller until the menu next comes up, or the
  window changes width.
- **A said line's strip:** one line of it is part of every tab's size.
  Longer words take their extra lines from the room left over, and then
  from the foot of the rows' own scrolling area. The sheet is held its
  size, as it was before for a tab with long words.
- **The window changes size with the menu up:** the size held is let go at
  once, and found again when the window has been still for a moment.
- **In a headset** the console is one picture on one panel, and was
  already one size on every section. A check now holds it there.
- **The same in a world's own menu and in a client's:** it is the one menu.
- **Tried,** `trials/menu-rows.mjs`: at a desk's width and a phone's, on
  every one of the Gallery's 14 tabs the sheet, its strip of tabs and its
  foot are in the same place, to the pixel (780 by 435, and 370 by 532).
  `trials/xr-console.mjs`: 14 sections, one picture size, one panel.
- **What it costs, timed 2026-11-24** (the Gallery's 14 tabs, in the page's
  own clock, the middle of three loads): laying out the tabs that aren't up
  is the whole of it, and as first built it fell on the moment the menu
  first comes up. With a graphics card that was 18 ms against 13 before one
  size. With the processor slowed six times it was 80 ms against 23, which
  is too much. **So the tabs are measured ahead,** in the page's idle
  moments while the menu is down, a tab at a time; by the time the menu is
  first brought up their sizes are kept. With that, slowed six times: 20 ms
  at a desk's width and 23 at a phone's, which is what it was before one
  size. A change of tab and coming up again never cost more than a few ms.
- **Not tried:** BitPortal's own menu, which has other tabs; a real phone;
  a headset.

### 2. What is in the menu comes in, and doesn't pop

Rows and the like arrive with a short motion when a tab is chosen, in
place of appearing at once.

### 3. The menu opens and closes with motion

Its outline first, as fine lines, then filled in with what it holds; and
the reverse to close.

## What the design must hold to (the orchestrator)

- **Nothing a visitor can press moves while it comes in.** A row is where
  it will be from the first frame, and can be pressed from the first
  frame. Motion is in how it is seen (fading in, lines drawing), never in
  where it is. Twice this month a row that moved under a press lost the
  press (the said lines, and the press lost when the menu was drawn
  again); the trials for those must still pass, with motion on.
- **Short.** Opening is never a wait: the menu can be used before the
  motion ends, and the whole of it is a fraction of a second.
- **Off for whoever asks for less motion** (the browser's own setting, and
  ours): then everything appears at once, as today. In a headset, nothing
  that grows towards the face or sweeps across the view.
- **The largest tab is found, not guessed:** a world's own tabs and the
  visitor's count, at the width in use, and a tab longer than the screen
  still scrolls inside the sheet. Say what happens when a world adds a tab
  after the menu is up, and where a said line's strip takes its room.
- **In a headset the menu is a picture made again when it changes:** say
  what motion costs there in frames, on the Quest, before choosing it.
- **The same in a world's own menu and in BitPortal's:** it is one menu.

## To settle with the pull request

- The names of any new setting, given by the orchestrator (rule 11).
- How long each motion is, shown to the owner as a short film or in a
  build he can try, before it goes live.
- A trial that fails if the tab strip moves between any two tabs, at a
  desk's width and a phone's.

## Must not

- Delay a press, or lose one.
- Animate for a visitor who asked for less motion.
