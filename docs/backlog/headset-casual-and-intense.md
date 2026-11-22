# Casual and intense in a headset: pointing to step, or smooth walking

- **Asked:** 2026-11-21. The owner: "in bitportals VR mode, we need an
  "casual" and an "intense" mode. Where in casual its click to move and in
  intense its smooth locomotion. (i like smooth loco in VR)"
- **Who:** BitPortal (to check its room shows it and say what the owner
  will see); the kit has it.
- **State:** asked (it is built; the owner may not have found it, or it
  may not work on the Quest: to find out)

## What is already built

The kit has exactly this (`createXrInput`, `packages/sdk/src/input.ts`,
since well before today), and BitPortal's room uses it:

- In a headset, the menu's **Moving** section has one switch, "Headset
  controls: casual" or "Headset controls: intense".
- **Casual:** point at the floor and press to step there; turn a notch at
  a time. The default.
- **Intense:** one stick walks and the other turns, smoothly, with the
  whole view. Under it, walking, turning and which hand moves can each be
  changed separately.
- The choice is kept for that device and carried through doors, so
  choosing intense once keeps it in every world.

Casual stays the default for everyone (a standing rule: smooth movement
makes some people unwell, so nobody gets it unasked). The owner's own
preference is kept by choosing intense once.

## What to find out

- Whether the owner has seen the switch on the Quest, and if it worked:
  the menu in a headset opens from the small button low in front of you,
  or above the wrist.
- If it is hard to find, that is the thing to fix (the switch first in
  the Moving section, or offered once on entering a headset session).

## Done looks like

The owner, on the Quest, switches to intense in BitPortal's room, walks
smoothly, goes through a door, and is still moving smoothly in the world
on the other side.
