# Places to arrive, enough of them that nobody arrives inside someone

- **Asked:** 2026-11-21. The owner: "We need designated spawn locations
  in each world with a minimum number set so that the game can always
  find a clear area to spawn if someone else is there."
- **Who:** not briefed. The kit (and the template and other engines).
- **State:** merged 2026-11-22: the kit's half in kit 0.81.0 (NSWP 316, 318), the template (129) and BitPortal's room (194); not live. Not tried in a headset, on a phone, or with two visitors in Godot. A fade for the step aside comes with the casual fade (`docs/plans/seated-mode.md`).

## What exists today

- A world names **entry points** in its manifest (`entry_points`, NSWP-01)
  and in its own code (`entryPoints` in the reference worlds: a position
  and a facing). A door or a link may name one (`entry`, NSWP-03).
  Arriving with none named, a visitor lands at `main-entrance`.
- So that two people don't land on one spot, the kit steps each arrival
  aside from that point: `spawnOffset` in `packages/core/src/room.ts`
  puts them on a circle 1.3 m round it, at an angle taken from their key.
  That is a guess, not a check. Two people whose keys give nearly the same
  angle land on each other; the circle may run into a wall or off a
  ledge; and nothing looks at whether the spot is taken.

## What is asked, in the orchestrator's words

- Each entry point is **a set of places** to arrive, not one: at least a
  number the kit sets (the orchestrator's proposal: four at least, eight
  for a world that says it is for rooms), each with a facing, each where
  a visitor may stand.
- Arriving, the kit picks the first place of the set that nobody in the
  room is standing on or near (within the least distance between two
  people, say 1 m), and stays out of anywhere the world says a visitor
  may not stand. If all are taken, it takes the one with the most room
  around it, never on top of someone.
- The check uses what this visitor's kit can see: the people in the
  room it has joined. A guest who hasn't joined sees nobody and may land
  where a joined person stands; that is harmless (they can't see each
  other), and the moment they join, the kit moves them aside if they are
  inside someone.
- The kit's check of a world (`npm run check` in the template, the build
  for the reference worlds) fails when an entry point has fewer places
  than the least number, or a place is inside something.

## The kit's half

All of it: the manifest's and the code's shape for a set of places, the
pick, the check, the same in the engine script and Godot. BitPortal's
room uses it for its own arrival. A door that names an entry point keeps
working.

## Open, for the owner

- The least number: four for every world, eight for a world for rooms?
  **Decided:** four, and eight for a world with `rooms` or `multiplayer`;
  places at least 1 m apart; the ring for a single spot 1.3 m out. A
  single spot is a warning in a world's check; a set given but too small
  is an error.
- Should a world be able to say "arrive anywhere in this area" (a region
  the kit picks a clear spot in) instead of listing places? **Left out of
  this round** (the orchestrator, 2026-11-22): places cover the ask.

## Must not

- Put an arriving visitor inside another person, a wall or off a ledge.
- Break a door or link that names an entry point today.
- Raise how far a visitor can walk or reach to make room (the owner's
  numbers stand).
