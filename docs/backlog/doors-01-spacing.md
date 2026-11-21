# A least distance between two doors

- **Asked:** 2026-11-21. The owner: "for doors. Let's make sure there is a
  minimum distance separation between each door."
- **Who:** BitPortal's session, both halves.
- **State:** briefed

## The kit's half

One number for how far apart two doors must be at the least, beside the
doorway's own sizes (`packages/sdk/src/gate-size.ts`: `PORTAL_WIDTH`,
`DOOR_REACH`), and a helper that lays a row of doors out by it or says that
two are too close. The reference worlds and the template keep to it; the
number is in what other engines take from the kit (`engine-menu.ts`, `kit()`)
so a world made in another engine has the same one.

It follows from what a door already is: two doors must never be so close
that their reach overlaps so a visitor can't tell which one a press takes,
or that their frames, signs and marks run into each other.

## The client's half

BitPortal's room lays its doors out by the kit's number and no other. Where
there are more doors than a wall holds at that spacing, the rest go to the
list in the room, as now; a door is never squeezed in.

## Done looks like

A test in the kit that the helper never places two doors closer than the
number, and that every reference world's doors keep to it. In BitPortal, a
test that the room's layout does. Seen in the room and in one world at a
desk, on a phone and in the made-up headset.

## Must not

Change `DOOR_REACH`, `TAP_REACH` or a doorway's size. Move a door a visitor
has saved to a different wall without saying so.
