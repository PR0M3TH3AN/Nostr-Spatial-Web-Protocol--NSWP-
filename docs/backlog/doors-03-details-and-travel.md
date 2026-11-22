# A door's details in the menus, with "Travel here"

- **Asked:** 2026-11-21. The owner: "Also in the menus doors need a details
  section like the items with this same info and a travel here button."
- **Who:** BitPortal's session, both halves.
- **State:** building. The kit's half is merged as kit 0.74.0 (NSWP pull requests 254 and 258; `addDoorControls`, the menu's `line`; the reference worlds' Travel tab uses it) and vendored into BitPortal and the template. Not yet: BitPortal's and the template's lists; other engines. Not live.
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

**As built** (decided with the orchestrator on 2026-11-21):

- `addDoorControls(controls, { doors, travel, also? })` in the SDK. The list is
  one row per door; choosing a row shows that door's details and takes nobody
  anywhere. Its card: the name, the address in full, and what is known of
  whether its site vouches for it, in the Airlock's own words ("Verified for
  this site", "Listed by …, not verified"), or nothing where the page didn't
  check: a door in a world doesn't ask, the Airlock does on the way.
- Under it, one button, "Travel here", which calls the page's own `travel`:
  the module never navigates. Then whatever else the page offers for a door
  (`also`: BitPortal's Save and Remove), then "Back to every door".
- Then what its world offers, as **lines**: a new kind in the menu's model,
  read and never pressed, the same twelve sentences in the same words as the
  tiles beside the door. A place whose maker has said nothing for themselves
  has no lines, and its card says so.
- The reference worlds' Travel tab uses it, from `sites.json` as the tiles do.

**Not done for other engines:** the engine script's own Travel tab
(`engine-menu.ts`) still lists bare doors; the front-room builder is in the
engine script, and that change waits until it is clear.

**Seen** at the https network address: the Gallery's Travel tab at a desk and
on a phone (choose The Grove, its card, Travel here, the twelve lines lit and
dark; a click on a line does nothing; "Travel here" went to the Airlock); and
the headset console in the made-up headset (all twelve lines whole, wrapped in
two columns; pressing one by its words did nothing). **Not seen:** a real
headset. In the console the lines come out small (about 16 of its 640 rows'
worth of type) because twelve sentences, the card and two buttons share one
page.

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
