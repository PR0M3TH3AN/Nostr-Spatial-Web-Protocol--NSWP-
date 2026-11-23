# A Godot world has no way to move in a headset

- **Asked:** 2026-11-23. The owner: "I think Godot is missing VR controls
  like we have in the other worlds."
- **Who:** the NSWP builder (the Godot add-on, `engines/godot/addons/nswp`,
  and the engine script where it carries the settings). Not briefed.
- **State:** briefed (the orchestrator, 2026-11-23). The approach is written:
  `docs/plans/godot-headset-controls.md`. **The stopgap is merged**
  (f74cb9a, NSWP 419): a controller's menu button, B or Y, leaves VR, with the
  page's menu and Home. It has not been seen working in a headset: a made-up one
  can't start a session in Godot, so it is the owner's to press on the Quest.
  Not live. **Moving is built** (the NSWP builder, 2026-11-23): tried on a flat
  page with made-up hands, not in a headset. **Next:** the console. The owner is right: confirmed in the code and already
  noted in `docs/plans/seated-mode.md` ("The Godot visitor
  (`nswp_visitor.gd`) has no controller movement in a headset at all: it
  shows the view and nothing moves it"). Next for the builder once the
  client's menu's step 1 is done, while BitPortal's session does step 2.

## What is true today

In a Three.js world made with the kit, a visitor in a headset can point at
the floor and step there (casual, with the short fade), step back and turn
in notches with the sticks, walk smoothly with the sticks (intense), open
the console from a controller, and press things with a pointer. The choice
of casual or intense is asked once and travels with them.

In a Godot world (The Foundry, and anything built with the add-on) a visitor
can enter a headset session and look around, and that is all. The add-on's
visitor node moves at a desk and on a touch screen, not in a headset.

## What is wanted

The same controls in a headset in a Godot world as in every other world, so
that a visitor doesn't have to learn a world's engine:

- casual: point and step, a step back, notch turns, with the fade for each
  jump (the kit's `fade` setting);
- intense: smooth walking and turning with the sticks, narrowed if they
  chose that (`narrow`);
- the same hand for each thing (`hand`), the same turn (`turn`), read from
  the visitor's travelling settings as the engine script already has them;
- the console summoned from a controller, and its rows pressed with a
  pointer;
- places a visitor may not stand kept to (a world says where its floor is);
- arriving in a headset: "Launch" at the door, as in every world.

## The kit's half and the engine's

All of it is the kit's framework: the add-on's visitor node and the engine
script. A world made with the add-on gets it by updating the add-on. What
is the world's own is only saying where its floor is.

## Done looks like

To be written when briefed. In The Foundry on a Quest 3S: step by pointing,
step back, turn, switch to intense and walk, open the console and press a
row, go home; each the same as in the Grove. The owner tries it, since a
made-up headset can't hold controllers.

## Related

- `docs/plans/seated-mode.md` lists this as coming before a Godot seat.
- `game-worlds-kit-gaps` (COMBATRIG is a three.js game with its own
  controls; this is for worlds made with the add-on).
