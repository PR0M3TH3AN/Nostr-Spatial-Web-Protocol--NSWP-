# What a world offers, on its door

- **Asked:** 2026-11-21. The owner: "let's add useful icons that poll the
  world's features like allowing items or save data, achievements all our
  bitportal kinda features. They should be icons that are lit up or dark if
  not supported. And when the user hovers over one it should display in game
  text explaining what that icon means."
- **Who:** BitPortal's session, both halves.
- **State:** live (kit 0.73.0, deployed 2026-11-21, with the nine worlds' announcements signed again and published the same day on the owner's word). Seen on portal.bitblocks.network: the Gallery's voice tile reads "You can talk with people here." Not yet: the Godot doorway drawing the tiles, and a look in a real headset.

## What is already there

A world's announcement already says what it can do, in `capability` tags
(NSWP-01; `packages/core/src/world.ts`, `CAPABILITIES`): today `webxr`,
`rooms`, `multiplayer`, `voice`, `spatial-portals`, `avatars`, `items`,
`entry-assertion`, `payments`, `home`. A client has a world's announcement
before a visitor ever looks at its door, so nothing has to be asked of the
world's site: looking at a door contacts no site, and that rule stands.

What is not there: saves, scores and achievements are not on that list, and
whether a world takes tips or is paid is said elsewhere (its manifest). So
the first stage is a short report, before any code: for each thing the owner
would call "our BitPortal kind of feature", where a client can learn it
today without contacting the world, and what would have to be added to the
announcement for the rest. Adding to that list changes the protocol, and a
world says the new things only once its announcement is signed and published
again, which is the owner's word each time.

## Decided (the orchestrator, 2026-11-21, on the builder's report)

- **Lit only for what the announcement says in so many words.** Nothing by a
  default, by a guess from another capability, or because every kit world
  has it. Items are lit only where the `items` tag says `allowed` or `play`:
  a world with no tag still allows them, and its door doesn't say so.
- **Four capabilities added:** `saves`, `scores`, `achievements`, `tips`.
  Nothing new for buying: `payments` and the `a … access` tag say it.
- **Seven on a door, in this order:** in a headset; people; voice; items;
  saves; scores and achievements as one; paid to enter (lit only when the
  announcement names an `access` listing). Tips, doors onward, looks, going
  by name and home are for a door's details (doors-03).
- **The reference worlds' own files say everything they do** (voice, looks,
  items; the Arcade its saves, scores and achievements), so that what is
  published on the owner's word is true. Signing and publishing them again
  is the owner's word, asked once, after the kit's half is merged. Until
  then the live doors show mostly dark icons, which is honest.
- `items` came out of the capability row of `protocol/01-worlds.md`: it was
  never on the library's list. A test now holds that row to the list.

**One thing built differently from the brief's example, and why.** The
brief gave "Nothing is saved here" as the words for a dark icon. A dark
icon means the announcement doesn't say, not that the world doesn't: the
Arcade keeps saves today and its announcement on relays won't say so until
it is published again. So every dark line reads "It doesn't say …", and the
only flat "no" is `items` `none`, which a world does say.

**Not done in stage 1, and not checked by the builder:** the Starter Home's
file (`sites/template-demo/world.json`, the template's) and the Foundry's
(`engines/godot/world.json`) are as they were. What those two really offer
should be said by whoever knows them.

## Stage 2, as built

- **One piece for every door** (`packages/sdk/src/door-offers.ts`,
  `createDoorOffers`): a column of seven square tiles beside the doorway's
  left jamb, top to bottom in the list's order, each the kit's line drawing
  for that thing. Lit is the door's own colour; dark is a dim outline. The
  kit's doorway (`createPortalGate`) stands it beside itself; a client that
  draws doors its own way adds the same piece. The column is clear of the
  frame and inside half of `DOOR_SPACING`, so two doors' columns never meet.
- **Pointed at, never pressed.** On a flat screen what a tile means goes in
  the card over the controls ("Saves: The Grove", then its sentence); in a
  headset the piece shows the same words in front of the door.
- **A door in a world is told what its destination offers by its own
  site**, as it is told its category: `sites.json` carries each place's
  `modes`, `capabilities` and `items`, word for word from that place's own
  `world.json`, and the build refuses to go on if the two differ. A door
  never asks the place it leads to.
- **Other engines** get the same list with the drawings: `NSWP.offers(world)`.
- **The Starter Home's and the Foundry's files** now say what they do too
  (voice and looks; the Foundry also its room).

**Seen** (built from the branch, served on this machine): the Gallery at a
desk from where a visitor arrives and from a few steps off, a lit tile and
a dark one pointed at with the card filled for each, and on a phone-sized
touch screen. **Not seen:** the words in front of a door in a headset (the
made-up headset entered VR and pointed, and from where a visitor arrives
the door is too far off to read a picture of it); the Godot world, whose
own gate doesn't draw the tiles yet; a real headset.

**To be said before a release:** after a deploy, a reference world's doors
would light what its neighbours' own files say, while BitPortal's room
reads the announcements on relays, which say less until they are published
again. The same door would be lit in one place and dark in the other. The
deploy and the publish want to be one step, or the room's half held until
then.

## The kit's half

- The list, in one place: each thing a world may offer, its icon, its few
  words ("Items work here", "Your progress is saved here") and its words when
  it is not offered. Read from an announcement by one function.
- The icons drawn by the kit's own doorway, lit for what is offered and dark
  for what is not, the same on every door in every world and in BitPortal's
  room. In another engine, the same list from the engine script.
- What an icon means, said in the game: on a flat screen in the card over the
  buttons when a door's icon is pointed at (never on a sign hung in front of
  the door: that rule stands); in a headset, by the door, when it is pointed
  at.

## The client's half

BitPortal's room uses the kit's doorway and the kit's list for its own
doors. Nothing of this is drawn by BitPortal's own code.

## Done looks like

Tests for the reading and for the words. Seen on a door of each kind (a
world that offers everything, one that offers nothing, one with no
announcement) at a desk, on a phone and in the made-up headset, in the room
and in a world. Readable at the size a door is seen from across a room, in
every look the kit has.

## Must not

Contact a world's site to draw its door. Say a world offers something it
hasn't said it does. Add a setting for this. Crowd a small screen: if the
icons don't fit a door seen from far off, they are shown nearer, not
shrunk until they can't be read.
