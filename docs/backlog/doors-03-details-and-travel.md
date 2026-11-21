# A door's details in the menus, with "Travel here"

- **Asked:** 2026-11-21. The owner: "Also in the menus doors need a details
  section like the items with this same info and a travel here button."
- **Who:** BitPortal's session, both halves.
- **State:** building (2026-11-21: the shape is agreed; no pull request yet)
- **Needs:** [doors-02](doors-02-what-a-world-offers.md), for "this same
  info".

## The kit's half

In the kit's menu, a door is chosen as an item is: choosing it shows its
details (its name and address, whether its site vouches for it, what its
world offers, by the same list and the same words as on the door itself)
and one button, "Travel here". The same in every world's own doors (the
Travel tab) and wherever a client lists doors.

"Travel here" is taking the door: it goes through the visitor's Airlock and
every check a door goes through. It is never a way round one.

## The client's half

BitPortal's lists of doors (the list in the room, "Your doors", "Every
door") use the kit's details and the kit's button. Saving and removing a
door stay where they are.

## The shape agreed (2026-11-21, the orchestrator's answer as design)

- A new kit module, `door-controls.ts`: `addDoorControls(controls, {
  section, doors, travel(door), also?(door) })`. Each door is a row;
  choosing one shows its card (name, address in full, whether its site
  vouches for it or who listed it, in the Airlock's own words) with one
  action inside it, "Travel here". `travel` is the caller's own way
  through the visitor's Airlock; the module never navigates.
- One new kind of row in the menu's model, `kind: "line"`: read, never
  pressed, with an icon, its words, and on or off. The twelve lines of
  `worldOffers` are listed under the card as lines, with the tiles' own
  drawings and words. It is never focusable as a button, a screen reader
  reads the same sentence a tile's card gives, the headset console draws
  the whole sentence, and it is general, not a thing only doors use.
- The files are the BitPortal session's until its pull request merges:
  `packages/sdk/src/ui/model.ts`, `hud.ts`, `console.ts`, and the Travel
  section of `sites/shared/world.ts`.

## Done looks like

Tests in the kit for the details and for the button taking the same path as
a door. Seen in a world's Travel tab and in BitPortal's room, at a desk, on
a phone and in the made-up headset.

## Must not

Send a visitor anywhere without the Airlock. Show a flat page or open a
window. Add a second way of listing doors.
