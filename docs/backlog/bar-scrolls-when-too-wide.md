# The bar along the bottom scrolls, with arrows, when it is too wide

- **Asked:** 2026-11-21. The owner: "if the menu bar across the bottom
  grows beyond whatever screen its being seen on it should have similer
  side scrolling and arrows as the tabs in the menu at the edge of the
  screen to allow users to move them left or right so they can be clicked."
- **Who:** the NSWP builder (the kit, `ui/hud.ts`), for every world.
- **State:** building. Built on the NSWP builder's branch `bar-scrolls`, not merged

When the bar is wider than the screen it scrolls sideways like the menu's
tab row, with the same arrows at its edges, shown only when there is more
that way. Nothing changes when it fits. Fire and Reload still lead the bar
while an item is in hand. The arrows never cover a button or take its tap.
