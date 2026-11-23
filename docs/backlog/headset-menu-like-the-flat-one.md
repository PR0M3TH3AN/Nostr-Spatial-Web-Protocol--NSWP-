# In a headset, the same menu as on a flat screen: larger, floating, with the bar below

- **Asked:** 2026-11-23. The owner: "for VR can we use the exact same menu
  design as flat screen just larger and floating in front of the user with
  the app bar floating below it? I like how the VR mode has that floating
  Menu button there when its closed. So when its open we should see all
  these same options as flat view. large menu on top and the bar below with
  the pined items maybe slightly angled towards the player. And it would be
  cool if hovering over a button or tab or app icon could kinda pop it out
  slightly so it looks 3D."
- **Who:** the NSWP builder (the kit's headset console,
  `packages/sdk/src/console.ts`, and the same for the Godot add-on). Not
  briefed.
- **State:** asked. For the builder after `godot-headset-controls`, as a
  design with pictures first.

## What is true today

In a headset the kit draws its own console (`console.ts`): one panel of
light with the sections down the side and their buttons beside them, either
on the wrist or floating from a small arched Menu button. It shows the same
controls as the flat menu, in a different layout: no tab strip, no bar of
pinned things, no cards as the flat sheet has them.

## What is wanted

- **Closed:** the floating Menu button stays as it is. The owner likes it.
- **Open:** the flat screen's menu, the same design and the same options:
  the tab strip, the sheet with its rows, tiles and cards, in the visitor's
  own order, with their pinned tabs. Larger, floating in front of them.
- **The bar below it:** the bar of pinned things floats under the sheet,
  tilted a little towards the visitor.
- **Hovering:** a button, a tab or a thing on the bar under the pointer
  comes forward a little, so it reads as an object and not a picture.

## For the design to settle

- **One menu, drawn twice.** A headset can't show a web page's own
  elements, so the flat menu has to be drawn again for a headset from the
  same description (`ui/model.ts`), by one layout that both follow, or the
  two will drift apart as they have. Say how they are kept the same, and
  how a new row kind reaches both.
- How big and how far, so text is read comfortably on a Quest 3S, and where
  it floats: fixed in the room where it was opened, or following the head
  slowly. The bar's tilt.
- What "comes forward" is: how far, how fast, with no flicker when the ray
  shakes, and still for someone who turned movement down
  (`motion: reduced`).
- The wrist: whether the wrist console stays as a second way in, and what
  it shows.
- What can't be shown in a headset and says so (the sign-in address's
  pages: Wallet, Files), and a typed row (`field`).
- Tracked hands with no controllers: pressing by pinch, and what hovering is.
- The Godot add-on drawing the same thing from the same description.
- With the client's menu: in a headset the world's part still draws it, from
  the same code and the visitor's settings (the plan's section 8), so this
  is the kit's fallback menu's headset drawing and the client's alike.

## Done looks like

To be written with the design: pictures of the open menu and the bar from
the made-up headset beside the flat menu, for the owner before it is
merged; then the owner's Quest 3S: open, change tab, press a row, press a
pinned thing on the bar, see each come forward under the pointer, close.

## Must not

- Lose the floating Menu button, or the summons from a controller.
- Put anything in the headset's menu that the flat one doesn't have, or the
  other way round.
