# What a world offers, on its door

- **Asked:** 2026-11-21. The owner: "let's add useful icons that poll the
  world's features like allowing items or save data, achievements all our
  bitportal kinda features. They should be icons that are lit up or dark if
  not supported. And when the user hovers over one it should display in game
  text explaining what that icon means."
- **Who:** BitPortal's session, both halves.
- **State:** briefed

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
