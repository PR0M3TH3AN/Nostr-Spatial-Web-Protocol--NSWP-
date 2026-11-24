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
- **State:** asked. In the builder's queue after the kit's halves of the
  three mends that hold BitPortal's menu from going live. Not designed.

## Three things

### 1. One size, on every tab

Today the sheet is as tall as the tab that is open, so going from a long
tab to a short one moves the tab strip and everything else. Wanted: the
sheet is the size it has on its largest tab, on every tab, so the strip
stays where it is ("at eye level"). The spacing of the larger tabs is
liked and stays. A short tab has room left over; it is not stretched to
fill it.

"In all modes": on a desk, at a phone's width, and in a headset.

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
