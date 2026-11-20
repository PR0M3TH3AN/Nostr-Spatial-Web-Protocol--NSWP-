# Godot: what is still to do

**Status (2026-11-20):** a list, set down when the owner paused this work to
look at sign-in. Part 1 (other people) is done, the same day: kit 0.55.0.
The rest is not started. What Godot worlds already have is
in [other-engines.md](../other-engines.md), under "Godot".

## Where it stands

A world made with Godot has the same doors, crossing, menu, sign-in, saves
and sounds as a Three.js world, and (kit 0.54.0) the things visitors carry:
the Bag tab, an item in hand, its locked box, darts that fly, stick and
let go, a holder's colours, tap or click to fire.

All of that is for **one visitor by themself.** A Godot world has no rooms.

## To do, in the order it should be done

### 1. Other people (rooms): done in 0.55.0

How it was done, since the rest should be done the same way: the kit's own
people code (`presence.ts`) runs unchanged on a scene with nothing in it to
draw (`engine-world.ts`), and says what it is drawing (`drawn()`); the
engine is handed figures as shapes and everything flat as pictures
(`engine-people.ts`), and draws them. Nothing about a room was written
twice. Left over from this part: a picture over a name hasn't been seen
working, pressing a person, and a screen someone shares.

As it was listed:

- The kit's room connection (`room.ts`) behind the engine script's text
  calls: join, leave, who is here, where each person is, what each says.
  Voices and chat can stay the page's own work; Godot needs none of the
  sound.
- Drawing other visitors in Godot: the kit's avatar is made in Three.js
  code, so Godot needs either the avatar written out as a model it can
  load, or its own drawing from the same description of a look. Decide
  which before starting; the first is one copy, the second is two.
- Saying where this visitor is, at the room's rate.
- The same bar entries as a Three.js world: Leave, Mic, Chat.

### 2. Items between people

Needs rooms. Most of the logic is already shared, so this is wiring.

- What someone else holds, drawn in their hand, in their colours.
- Darts others send, seen flying and landing in the same place.
- A hit: the mark for whoever sent it, health for whoever it reached, the
  red edge and the break-up at none left.
- Sounds of other people's items, fading with distance.
- Muting one person's items.

### 3. Things never tried in Godot

Wired, but not seen working:

- Aiming along the sight with the other mouse button (a test can't take
  the pointer; needs a person at a desk).
- A phone: touch to walk, tap to fire, the bar's Fire and Reload.
- Safari and Firefox.

### 4. A headset

- Moving in a session (today a session starts and the visitor stands
  still).
- The menu in a session: the page's menu can't be seen there.
- How the visitor is (ring, hit mark, health, counter), drawn by Godot
  from `own` in what `NSWP.frame` returns.
- An item held in a hand that is tracked, and its trigger.

### 5. Smaller things

- The view through a door of where it leads.
- A crossing's room that can be looked round in.
- Posting from a world ("My public feed").
- The engine script grew to about 1.4 MB with items. If that matters,
  split what a world without items doesn't need.

## Waiting on the owner

- The Foundry's announcement saying items are allowed is signed and not
  published.
- A deploy of kit 0.54.0 to the public sites.

## Rules to keep while doing it

One copy of everything that isn't drawing: an engine's addon draws what the
script returns and answers what it is asked, and grows no logic of its own
(AGENTS.md, "Items in other engines").
