# A least distance between two doors

- **Asked:** 2026-11-21. The owner: "for doors. Let's make sure there is a
  minimum distance separation between each door."
- **Who:** BitPortal's session, both halves.
- **State:** merged, both halves (the kit: NSWP pull requests 234 and 239, kit 0.71.0; BitPortal's room: BitPortal pull request 159). Not live: it goes out with the next release of the sites.

## The kit's half

One number for how far apart two doors must be at the least, beside the
doorway's own sizes (`packages/sdk/src/gate-size.ts`: `PORTAL_WIDTH`,
`DOOR_REACH`), and a helper that lays a row of doors out by it or says that
two are too close. The reference worlds and the template keep to it; the
number is in what other engines take from the kit (`engine-menu.ts`, `kit()`)
so a world made in another engine has the same one.

It follows from what a door already is: two doors must never be so close
that their frames, signs and marks run into each other. (This file first
gave reach as a reason too. It can't be one: see "As built".)

**As built.** `DOOR_SPACING` is 2.5 m between two doors' middles: a door's
own width and a clear metre of wall. Proposed by the builder and agreed by
the orchestrator on 2026-11-21; changing it is one line. The helper (`doorRow`,
`doorArcStep`, `doorsOnArc`, `doorsTooClose`) is numbers only, with no
renderer. Reach is not what the number is measured by: `DOOR_REACH` is
3.05 m, so two doors' reaches overlap at anything under 6.1 m, in every
reference world too; which door a press takes is settled by what is pointed
at. The reference worlds' nearest pair is 3.4 m (the Gallery), so none had to
move; BitPortal's room stood its doors 1.81 m apart. Not done here: the
template's own scene, which is in its own repository and gets the number
when the kit is next copied into it.

## The client's half

**Decided by the orchestrator, 2026-11-21, and told to the owner so they can
overturn it:** BitPortal's room grows from a radius of 8 m to 10 m, and a
wall still shows a dozen. At 2.5 m a dozen no longer fit a wall of the room
as it was; the other way was to keep the room and show eight, which takes
four saved doors off each full wall. No saved door leaves its wall or its
place.

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
