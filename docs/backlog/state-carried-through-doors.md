# State carried through a door: ammo in the clip, health, what is in hand

- **Asked:** 2026-11-25, by the owner: "Lets think about some way of doing
  things like carriying cached data from one site to another. For
  instance, ammo remaining in the clip or in the users inventory. If i
  have three shots left in the dart gun or if my health is at 3 of 6 bars,
  the site should hand that info off to the next site somehow. Is there a
  way to do that? Like a current state handoff that would work better and
  faster than the nostr sync option?"
- **Who:** a design first (the NSWP builder, answered by the orchestrator);
  then the kit, BitPortal's shell, the items' box.
- **State:** asked.

## What exists to build on

The kit already carries a visitor's settings through a door, instantly and
with no relay: each part says what it has when the visitor leaves
(`portal.go()`, `portal.home()`), and the next world reads what they
arrived with (`arrival.read()`, `arriveWith`) and begins from it
(`packages/sdk/src/settings.ts`). Settings are only ever preferences.
Saves (`worldSaves`) are one world's own, kept on the device and on the
person's relays: durable, slower, and per world.

## The orchestrator's first reading (for the design to settle)

Carry it the same way as settings, at the door, in memory: no relay, as
fast as the door itself. Nostr stays the durable copy behind it (for a new
device, a reload, a crash).

1. **State that belongs to an item travels with the item in hand.** Three
   darts left is the dart blaster's, not the world's: when the visitor
   leaves holding it, the item's own sealed box hands its small state to
   the kit, and the next world's box for the same item takes it up. Any
   world that lets items run gets it; a world where items don't run keeps
   it untouched for the next.
2. **State that belongs to a game is shared only by worlds that say they
   are the same game.** Health 3 of 6 means something only where the rules
   agree on what health is. Worlds declare a game they belong to; state
   carries between worlds of the same game, and nowhere else.
3. **Small, plain, bounded:** a few hundred bytes of plain values per item
   or game, checked by the kit, never code.
4. **Not trusted for anything that matters.** A visitor's own page hands
   it over, so a visitor can change it. Fine for play; anything that must
   be fair (a score, a prize, a scarce item) is signed by the world that
   gave it, or checked by a service.
5. **Through the client where there is one** (the portal, which our worlds
   now open in); by the door's own hand-off where there isn't.

## Must not

- Carry anything a world could use to tell where a visitor was before,
  beyond what they carry on purpose.
- Let a world write into another item's or another game's state.
