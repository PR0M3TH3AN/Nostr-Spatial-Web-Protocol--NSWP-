# The mark everywhere: the menu button, and the app's icon

- **Asked:** 2026-11-24, by the owner, with a picture of the kit's quiet
  corner button (kept in the sessions' notes folder,
  `menu/owner-menu-mark-everywhere-2026-11-24.png`): "can we use this
  menu icon everywhere? With no text? Still have the color changes of
  course. But i love how clean it is." Then: "i think it would make for a
  nice app icon too".
- **Who:** the NSWP builder (the kit's menu button, and one picture of
  the mark the others take); BitPortal (its pages' icons and its own
  menu's button, from the kit's); BitBrowser (its app's icon, when the
  app is next built).
- **State:** built, in two pull requests for kit 0.91.0: the menu's
  button (the mark, no words, the hover hint, the headset's button,
  `markSvg`), then the kit's pictures of it (`packages/sdk/assets/mark/`,
  `scripts/make-mark.mjs`) and each reference site's page icon. No web
  app manifest: how a page installs on a phone is the owner's to say;
  the 192, 512 and maskable pictures are made and kept for when he does.

## What the mark is

The kit's quiet form already has it: one button in a corner, a rounded
glass tile with the world's accent on its edge, and inside it the mark,
an arch filled with the accent fading downward, glowing, standing on a
short light line (`.mark` and `.quiet` in `packages/sdk/src/ui/hud.ts`).
BitPortal's own `favicon.svg` is already an arch on a line, in its own
green, without the tile.

## Wanted

1. **The menu button is the mark, with no words, everywhere the kit
   draws one:** in the full form too, where today it is a pill saying
   "Menu" with an "M". The same tile, the same size, in the same place as
   each form puts it. The world's colours still tint it, and it lights as
   it does today when hovered and while the menu is up. Its name stays
   for those who can't see it ("Menu", read aloud), and a key-board
   user's M still opens it, as now. In a headset, the floating Menu
   button and the wrist take the same mark, as the kit draws there.
2. **One picture of the mark, made once, in the kit,** that every place
   takes: the kit's sites' page icons, BitPortal's icon and its app
   icons (the sizes a phone asks for when a page is kept on its home
   screen), and BitBrowser's app icon on the Quest. In BitPortal's own
   colours where it is BitPortal's icon. No one draws their own copy.

## The orchestrator's first reading (not built)

- The words "Menu" and the M told a first-time visitor what the button
  is and which key opens it. The mark alone is cleaner, as he wants; a
  hint on hover at a desk ("Menu, M") keeps the key findable without
  words on the screen. **Decided by the owner, 2026-11-24: "Yes, hover
  hint".** None on touch or in a headset.
- Nothing about what the menu does changes; covers and the one size are
  measured from the button where it is, so the checks that read where
  the top row is must read it again.

## Must not

- Take away the button's name for a screen reader, or the M key.
- Let a world restyle the mark beyond its colours.
