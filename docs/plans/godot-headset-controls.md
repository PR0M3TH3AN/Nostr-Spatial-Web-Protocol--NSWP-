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

## What the pixels crossing costs, measured (2026-11-23)

Asked for before the console is settled (the orchestrator: "Measure what the
pixels crossing costs before it's settled, and say the number").

**The number: about 4 to 6 ms a change, on a laptop.** That is the console's
own size, 1024 by 640, as its pixels, 2.6 MB each time. **It is not a Quest's
number.** Nothing here was measured on a headset.

**How it was measured** (`trials/godot-pixels.mjs`): this checkout's export of
the Godot example, in Chrome drawing on the laptop's own graphics card (an
Intel i5-1135G7 with Iris Xe, busy at a load of 12 to 14). A page's canvas of
the console's size is drawn afresh with a dozen boxes of words, as a console
is, and brought into Godot thirty times each way. Each step is timed where it
happens: the page's by the page's clock, Godot's by Godot's. Four runs; each
figure is the middle of a run, and the range is across the four.

| The way | Bytes across | Middle, ms | Worst seen, ms |
|---|---|---|---|
| Its pixels as they are, 1024 by 640 | 2,621,440 | 6.3 to 7.6 | 46 |
| The same, the canvas told it will be read back often | 2,621,440 | **4.1 to 5.9** | 23 |
| Three quarters the size each way, 768 by 480 | 1,474,560 | 2.3 to 4.4 | 25 |
| Half the size each way, 512 by 320 | 655,360 | 1.1 to 1.5 | 12 |
| Packed as a PNG, 1024 by 640 | 80,263 | 28.5 to 32.6 | 76 |

**Where the time goes,** for the second row:

| Step | Middle, ms |
|---|---|
| The page draws the console's picture | 0.2 |
| The page reads its own canvas back | 3.1 to 3.7 |
| Across to Godot (a copy of 2.6 MB) | 0.3 to 0.4 |
| Godot makes an image of it | under 0.1 |
| Onto a texture | 0.3 to 0.4 |

What follows from it:

- **The crossing itself is small.** Three quarters of the time is the page
  reading its own canvas back. Telling the canvas it will be read often
  (`willReadFrequently`) takes a third off.
- **Packing it is the wrong way:** a PNG is thirty times smaller and six times
  slower, at both ends.
- **A change costs about a third of a frame here.** A headset draws a frame
  every 11 to 14 ms. A Quest's processor is slower than this laptop's, by how
  much for this work I don't know: if it is two or three times, one change is
  about one frame.
- **So how often it changes is what matters, and pointing is what changes it
  most.** The kit's console draws itself again whenever what is pointed at
  changes, to light the row. A hand swept down six rows is twelve changes in
  a second.

### The question this leaves: who lights the row pointed at

| | A. In the picture | B. By the add-on |
|---|---|---|
| What lights a row | The kit's own drawing, as in every other world | A box the add-on draws over the row, where and how the engine script says (its place, its colour, its corners) |
| A crossing happens | Each time the row pointed at changes, and at every press, tab and page | Only when what the console shows changes: a press, a tab, a page. Never for pointing |
| At a sweep across six rows | Twelve crossings in a second | None |
| Drawn once | Wholly | All but the light on one row. Its look still comes from the kit, as numbers |
| The risk | A hitch at every row, of a size not known until tried on a Quest | A lit row that could drift from the kit's, if the kit's changes and the numbers don't |

**My recommendation: B.** It makes the cost of the crossing not matter: it
then happens at a press, where a frame is not missed. And the engine script
has to say what is under the pointer anyway, to take a press.

**What would settle the real number:** the same measurement read on the Quest
3S itself. It is a small addition to the example (open it with a mark in its
address, and its menu says the figure). Not built; say if it is wanted before
the console is.

### Not measured

- A headset, or a phone.
- Handing Godot the picture with no copy at all (the page drawing straight
  into Godot's own texture). Godot's web export gives a page no way to its
  textures that I found.
- A console of another size. Its size is the kit's (`console.ts`: 1024 by
  640), and the headset menu's redesign may change it.

## The order

1. **Moving** (one pull request): `NSWP.hands()`, the fade's numbers, the two
   hands, casual and intense, the fade and narrowing, where they may stand, doors,
   and the menu button leaving the session.
2. **The console in a headset** (one pull request, after the first is tried):
   the engine script's drawing handed over, the quad, the pointer.

## The stopgap, built first (2026-11-23)

**What it is:** in a session, B on the right hand or Y on the left leaves VR,
and the page's menu comes up with Home on it. That is the button every world's
console comes up on, so when the console is drawn here it takes the same
button and this stops being a way out.

**What a made-up headset could not show.** Godot starts a session only where
the browser has WebXR Layers. The made-up headset the other trials use (iwer
2.8.0) has none: its session starts, and Godot refuses it by name. So no
scripted browser here can be in a headset in a Godot world, and **the button
has not been seen to work.** What was checked: the script's own text (two
hands, Godot's name for that button, what the press does), that the example
exports and still comes up, and that it asks the headset for a session
(`trials/godot-leave-vr.mjs`).

**For the owner, on the Quest 3S, once The Foundry with this add-on is where
the headset can open it.** Six presses:

| Do this | It should |
|---|---|
| Open The Foundry, open the menu, press "Enter VR" | Put you in the world in the headset. No hands are drawn yet |
| Press A, then X, then each trigger and each grip, and push each stick | Do nothing at all. You stay in VR |
| Press **B** (the upper round button on the right controller) | End VR. You see the browser's flat page with The Foundry's menu open, Home in it, and the words "You left VR. Home is in this menu." |
| Press "Enter VR" again | Put you back in |
| Press **Y** (the upper round button on the left controller) | End VR, the same |
| Press Home | Take you home |

If B or Y does nothing, say so: it means the Quest's browser names that
button to Godot otherwise than Godot's own web export does, and I need the
name it gives.

## Moving, built second (2026-11-23)

**What is built:** `NSWP.hands` in the engine script (version 18), with the
kit's own `Locomotion` answering and the same Moving rows in an engine
world's menu as in every world; and in the add-on's visitor, the two hands
read each frame, notch turns about the head, a step to where a hand points
with the fade, a step back, walking and turning smoothly, the edge darkened
while walking for someone who chose that, a ring on the floor while a hand
is choosing, and a door lit by a hand and gone through at the trigger.

**How it was tried, since no scripted browser can be in a headset in a
Godot world:** on the flat page, with hands the trial makes up
(`trials/godot-hands.mjs`, 26 checks). The example is told where each stick
is, where the hand is and the way it points; from there on it is the same
code as in a headset. Shown: a notch each flick and back again; the ring two
metres ahead where the hand points; the step on letting go; no ring and no
step when pointing at the sky or level; a step back of a metre, once; a ring
no further than a step reaches, the step there, a second at once refused and
a moment later taken; a door lit from within reach; and, the intense way, a
walk ahead at about a brisk walk and a smooth turn.

**Not shown, and the owner's to try:** a real controller's names for its
stick and buttons, which way a real stick reads as forward, the fade (made
only in a session), the hands and the line drawn, the edge darkening, and
how any of it feels.

**For the owner, on the Quest 3S, once The Foundry with this add-on is where
the headset can open it.** The six presses of the stopgap, above, and then:

| Do this | It should |
|---|---|
| In VR, look at your hands | Show a small ball where each controller is |
| Push the **left** stick forward and hold it, pointing that hand at the floor a few steps away | Show a ring on the floor where you point, and a thin line from your hand |
| Let the stick go | Fade to black and back in a blink, and you are standing on the ring |
| Do it again, pointing at a wall, at the sky, or past the edge of the floor | Show no ring, and not move you |
| Pull the left stick back | Fade, and step you back about a metre |
| Flick the **right** stick right, then left | Turn you a notch each time, to that side |
| Point a hand at the door from close by | Light the door. Press the trigger: you go through, to your Airlock |
| Leave VR (B), open the menu, Moving, and press "In a headset: casual" so it says intense. "Enter VR" again | Walk smoothly ahead with the left stick, turn smoothly with the right, and stop at walls |

**If pushing the stick forward steps you back, or nothing happens when you
push it:** say which. The first is one number in the add-on
(`STICK_FORWARD`); the second means the Quest's browser names the stick to
Godot otherwise than its web export does.

## The console, built third (2026-11-23)

**What is built.** The orchestrator's answer to who lights the row pointed
at was B: the add-on, from the kit's numbers.

- **The kit draws the console once.** Its 2D drawing is moved, word for word,
  out of the file that puts it on a Three.js panel (`console.ts`) into one
  with no Three.js in it (`console-drawing.ts`). A Three.js world's panel and
  the engine script both draw with it.
- **The engine script hands it over** (version 19): `NSWP.console(json)`
  says what the console is and where each row is, and takes a press by a
  row's id; `NSWP.consolePixels()` gives the picture, to be taken only when
  it changed.
- **The picture never carries a lit row.** With each row the kit gives how
  to light it: a fill, an edge, its width and its four corners, in the
  console's own units. The add-on draws that box over the row's own
  rectangle and chooses nothing. A row the kit gives no light for (the tab
  that is up) is not lit.
- **One list of rows** decides what is lit and what a press lands on.
- **In the add-on's visitor:** the menu button (B or Y) brings the console up
  about a metre in front of them and puts it away; it stays where it opened;
  a hand pointed at it lights the row and that hand's trigger presses it; a
  hand pointing at the console points at nothing behind it; walking 2.6 m
  off puts it away, as in every world. The button no longer leaves the
  session: the way out is a row of the console.
- **The one-time question, casual or intense,** is asked in the console the
  first time they are in a headset, now that there is a console to ask it
  in.

**How it was tried, since no scripted browser can be in a headset in a Godot
world:** on the flat page, with hands the trial makes up
(`trials/godot-console.mjs`, 23 checks). Shown: the menu button brings it up
a metre ahead, 0.84 m wide, with the kit's picture on it; Godot holds as many
rows as the kit lists; a hand pointed at a row lights a box at the row's own
place and size; a sweep over every row and back leaves the picture the same
one, with nothing brought across; the tab that is up is pointed at and not
lit; a place that is no row lights nothing; a trigger on a tab changes the
picture, which then crosses once; a trigger on a row does what the page's
menu would; Close, and the button again. The picture's crossings are counted
in the page: one to bring it up, none for pointing, one for each press that
changes it.

**The Three.js worlds' own console** was looked at too, since its drawing
moved (`trials/xr-console.mjs`, new, 8 checks, the Gallery in a made-up
headset): it comes up, draws at its size, changes section, lights a row in
its own picture, and closes.

**Not shown, and the owner's to try:** a real controller's name for its menu
button, how the panel looks and reads in a headset, whether a real hand's ray
lands where it looks to, the one-time question (asked only in a session), and
how a tab change feels on a Quest.

**For the owner, on the Quest 3S, once The Foundry with this add-on is where
the headset can open it.** After the eight steps for moving, above:

| Do this | It should |
|---|---|
| In VR, press **B** (the upper round button on the right controller) | Bring a panel up about a metre in front of you: The Foundry's name at its head, tabs down its left, buttons beside them. You stay in VR. The first time ever in a headset, it comes up by itself, asking "casual or intense?" |
| Point either hand at a tab, then at another | Light the one you point at, faintly, and unlight it as you leave. Nothing else flickers or hitches |
| Sweep a hand down all the tabs, quickly | Light each in turn. Say if the view stutters as you do: it shouldn't, since pointing brings nothing across |
| Pull the trigger on a tab | Show that tab's buttons. Say if there is a hitch at that moment, and how bad |
| Pull the trigger on Travel, then on "Go home" | Take you home |
| Point at the panel with the door behind it, and pull the trigger | Press the panel, and not go through the door |
| Press **B** again, or pull the trigger on the cross at its top right | Put the panel away |
| Bring it up, then walk three steps away from it | Put it away by itself |
| On the flat page, before "Enter VR", open The Foundry with `#pixels` on the end of its address and wait five seconds | Say, in the page's menu, "The console's picture: … ms to bring across, … at most, 20 times." Read me the two numbers. Open the menu again to see them again |

**The last row is the Quest's real number** for what a tab change costs.
With the row lit by the add-on it no longer decides whether the design
works, only how a tab change feels.

## How it will be checked, and what can't be

- **By me:** unit tests of `NSWP.hands()` against the kit's own `Locomotion`, so
  the engine script and a Three.js world give the same answer to the same
  controllers. `npm run build:godot` exports the example. A made-up headset
  can't drive Godot's WebXR in a scripted browser (tried on 2026-11-23: Godot
  needs WebXR Layers, which the emulator lacks), so nothing in a Godot session
  can be shown by a trial here.
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
