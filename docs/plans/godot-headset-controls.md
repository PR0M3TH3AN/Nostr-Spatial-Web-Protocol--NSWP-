# Headset controls for a Godot world: the approach

**Status:** an approach, written before any code, for
`docs/backlog/godot-headset-controls.md` (the owner, 2026-11-23: "I think Godot is
missing VR controls like we have in the other worlds"). NSWP builder, 2026-11-23.
Nothing here is built. The names in `code` that don't exist yet are proposals, for
the orchestrator to give.

## In short

- **The owner is right, and it is worse than "nothing moves them".** In a Godot
  world a visitor in a headset can't move, can't open the console, and can't go
  home. The only way out is to take the headset off.
- **The deciding is already written once, and stays in the kit.** What a stick, a
  trigger and a button mean is the kit's `Locomotion` (`actions.ts`), which draws
  nothing. The engine script hands it to an engine, so a Godot world decides
  nothing for itself and can't drift from the others.
- **The add-on's visitor does the moving:** it reads the two controllers, asks
  the engine script what they mean, and moves a body that Godot's own walls and
  floors already stop.
- **Two pull requests.** First the moving. Then the console in a headset, drawn
  once by the engine script and shown in Godot as a picture.

## What is true today, read from the code

`engines/godot/addons/nswp/nswp_visitor.gd`:

- It carries an `XROrigin3D` with an `XRCamera3D`, and starts a session when the
  menu's "Enter VR" is pressed. So the visitor sees the world, with their head
  tracked.
- Once a session runs (`_presenting`), `_unhandled_input` returns at its first
  line, and `jump()` refuses. Every way of moving is turned off.
- There are no controller nodes. Nothing reads a stick, a trigger or a button.
- The page's menu is hidden for the whole session (`hud.setHidden`, in the engine
  script's `headset()`), and nothing is drawn in its place. So there is no Home,
  no way out of VR, and no settings.

## What the engine script already gives an engine

| It gives | Where | Used for |
|---|---|---|
| The kit's numbers: walking speed, the reach of a tap, a door's reach | `NSWP.kit()` | Moving as far and as fast as every world |
| Casual or intense, and when it changes | `arrival`, the `moving` event | Which way they move |
| The whole console as data, and a press by id | `NSWP.view()`, `NSWP.run(id)` | A console of an engine's own drawing |
| "Launch" across the page for someone who arrived in a headset | `NSWP.headset()` | The door |
| Steps, a bump, a landing, heard | `NSWP.moved()`, `bump()`, `jumped()` | Sound |

## What it doesn't give yet, and would

Each is the kit's own code, reached from an engine. None is a second copy.

1. **What the hands mean.** `NSWP.hands(json)`, called each frame of a session
   with the two controllers as the engine read them (the stick, the trigger, the
   grip, the two buttons, which hand). It answers with the kit's `Intent`: turn
   by so many degrees, walk so far, which hand is choosing where to step, which
   hand let go and steps, the menu button, how much to darken the edge. The
   visitor's own settings (casual or intense, the turn, the hand, narrowing, the
   fade) are read where the kit already keeps them. One call a frame, a few
   hundred bytes each way.
2. **The comfort settings, said.** Whether to fade, and how long a fade is, in
   `NSWP.kit()` beside the other numbers, so an engine fades as the kit does.
3. **A console that can be seen in a headset** (the second pull request, below).

## What the add-on's visitor needs

- **Two hands.** An `XRController3D` for each under the `XROrigin3D`, each drawn
  as a small shape in the kit's style. Nothing is downloaded, as in every world.
- **The reading.** Each frame of a session: the stick, trigger, grip and buttons
  of each, by the names Godot gives WebXR's standard layout, handed to
  `NSWP.hands()`.
- **Casual.** A stick held forward shows where a step would land: a line from
  that hand to the floor, and the ring the visitor already has for a tap.
  Letting go steps there, with the fade. A stick pulled back steps back a metre.
  The other stick turns in notches.
- **Intense.** The moving stick walks, in the direction the head faces, through
  `move_and_slide`, so walls and floors stop them as they do at a desk. The other
  stick turns smoothly. The view's edge darkens while they move, where they chose
  that.
- **The fade and the narrowing.** One small mesh in front of the headset's
  camera, drawn over everything: black for a fade, a dark ring for narrowing.
- **Where they may stand.** A step lands only on something they could stand on:
  the ray's hit faces up, it is within one press's reach (`tapReach`), a body's
  width is clear there, and no wall is between. This is Godot's own physics, so a
  world says where its floor is by having one. Nothing new to declare.
- **Doors.** Pointing at an `NswpGate` within reach lights it, as at a desk.
  Casual: the trigger goes through. Intense: walking into it does.
- **Not in this:** what is in the visitor's hand (`NswpItems`) in a headset, and
  a seat. Both stay as they are.

## The console in a headset

In a Three.js world the kit draws the console on a canvas and puts it on a
surface in the world. A Godot world has no such surface.

**Proposed: the engine script draws it, and Godot shows the picture.** The
console's drawing is 2D and already the kit's (`console.ts`). The engine script
draws it to a canvas of its own and hands the engine the pixels when they change;
the add-on puts them on a quad that follows the visitor's off hand. A ray from the
pointing hand gives a place on the quad, the engine script says what is there, and
a trigger presses it (`NSWP.run`, as now).

- **Why not draw it in Godot from `NSWP.view()`?** That would be a second console
  to keep the same as the first, in a second language. The orchestrator's next
  job after this one redesigns the headset's console; drawn once, the redesign
  reaches Godot worlds with no change to the add-on.
- **What it costs:** pixels cross from the page to the engine each time the
  console changes (a tab, a hover), not each frame. The size and the rate need
  measuring before it is settled.
- **Until it is built** (the first pull request alone): the menu button on a
  controller leaves the session, which puts the visitor back at the page's own
  menu with Home on it. That closes the "can't get out" fault at once.

## The order

1. **Moving** (one pull request): `NSWP.hands()`, the fade's numbers, the two
   hands, casual and intense, the fade and narrowing, where they may stand, doors,
   and the menu button leaving the session.
2. **The console in a headset** (one pull request, after the first is tried):
   the engine script's drawing handed over, the quad, the pointer.

## How it will be checked, and what can't be

- **By me:** unit tests of `NSWP.hands()` against the kit's own `Locomotion`, so
  the engine script and a Three.js world give the same answer to the same
  controllers. `npm run build:godot` exports the example. Whether a made-up
  headset can drive Godot's WebXR in a scripted browser is not known; I try it
  first, and say.
- **Not by me:** anything held in a real hand. A made-up headset has no
  controllers to hold.

## For the owner, on the Quest 3S, once the first is merged

In The Foundry, from BitPortal or its own address. Each should be the same as in
the Grove.

| Do this | It should |
|---|---|
| "Enter VR" | Show two hands where yours are |
| Push the left stick forward and hold | Show a ring on the floor where you point. Let go: the view fades, and you are there |
| Point at a wall, or past the edge of the floor, and let go | Not move you |
| Pull the left stick back | Step you back about a metre, with the fade |
| Flick the right stick left or right | Turn you by a notch each flick |
| Point at a door from close by and press the trigger | Light it, then take you through |
| In the page's menu before entering, choose the intense way; enter again | Walk smoothly with the left stick, turn smoothly with the right, and stop at walls |
| Press the menu button on the left controller | Leave VR, with the page's menu and Home in front of you |

## Answered (the orchestrator, 2026-11-23)

1. **The names are given:** `NSWP.hands(json)`, answering with the kit's `Intent`,
   and the fade's numbers in `NSWP.kit()`. An engine can see this, so the engine
   script's version goes up with it: 18 goes to this change, and seated mode
   takes the next number.
2. **The console is drawn once,** by the engine script, and shown in Godot as a
   picture. What the pixels crossing costs is to be measured and said before it
   is settled.
3. **The stopgap is yes, and first, as a small pull request of its own:** a live
   fault goes before everything else here.

So the order is: the stopgap; then the kit pieces BitPortal's step 2 waits on;
then moving; then the console.

## The questions, as they were put

1. **The names:** `NSWP.hands`, and in `NSWP.kit()` the fade's numbers.
2. **The console drawn once and shown as a picture,** or drawn again in Godot.
   I recommend drawn once.
3. **The menu button leaving VR until the console is built:** a stopgap a
   visitor will meet. I recommend it, since today there is no way out at all.
