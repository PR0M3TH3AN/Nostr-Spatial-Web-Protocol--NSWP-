# NSWP-17: Items

**Status:** Decided by the owner on 2026-11-20, and built in part. Implemented in the reference library: an item's description, a world's rule for items, and the warning on a door. Everything else here is the agreed design, not yet built: the bag, carrying, an item's own logic, people as part of a world's game, and muting · **Kinds:** 37303 · **Vectors:** [`items`](../vectors/items.json) · **Code:** core [`item.ts`](../packages/core/src/item.ts), [`constants.ts`](../packages/core/src/constants.ts) (`ITEM_RULES`)

An **item** is a thing a person can carry from world to world, or put in
their home: a lantern, a book, a map, a chair, a tool, a weapon. It has a
shape, and it may do something.

All of it is optional. A world that says nothing about items has none:
nothing carried is drawn there, and nothing runs.

## The rules everything else follows from

1. **An item never touches another person's device or account.** Whatever
   an item does of its own runs only on the device of the person carrying
   it. Nothing of theirs runs on anyone else's machine, reads anyone else's
   data, or signs anything as anyone else.
2. **A world has the last word.** An item says what it did: "I was swung",
   "I hit that with power 3". What that means, if anything, is decided by
   the world it is in. This is what lets one item work across worlds that
   have nothing else in common.
3. **In a world, a person is part of the game.** Where a world lets items
   work, the people in it can be reached by them: not ghosts who can be
   seen and never touched, but as much a part of its rules as anything the
   world made itself.
4. **A visitor is told before they go in,** and where items are not what
   the place is for, they can turn them off for themselves.

## What a world does with items

A world says which of three kinds of place it is, with an `items` tag in its
announcement ([NSWP-01](01-worlds.md)):

| | What it means |
|---|---|
| `none` (or nothing said) | Nothing carried is drawn or works there |
| `allowed` | Items work, and can affect other people. Anyone there may mute them |
| `play` | Items are part of the game. Nobody there is out of their reach |

**A door says so.** A door to a place where items are part of play says
"Items are part of play here" on its sign, and so does the visitor's Airlock
before they cross. A place that only allows them says "Items work here".
The words are the core's (`itemsWords`), so they are the same everywhere.

## An item's description

What a thing is, is said once by its maker, in an addressable note
(experimental kind **37303**; `d` names it among its maker's items):

```json
{
  "kind": 37303,
  "tags": [
    ["d", "brass-lantern"],
    ["title", "Brass lantern"],
    ["summary", "A lantern that swings as you walk."],
    ["model", "https://items.example/<sha256>.glb", "glb", "<sha256>"],
    ["thumb", "https://items.example/<sha256>.webp", "<sha256>"],
    ["size", "0.18 0.42 0.18"],
    ["collider", "box", "0 0.21 0", "0.18 0.42 0.18"],
    ["clip", "idle", "Swing"],
    ["clip", "use", "Flare"],
    ["behavior", "holdable"],
    ["fits", "place", "hand-left", "hand-right"],
    ["script", "https://items.example/<sha256>.js", "<sha256>"],
    ["license", "CC-BY-4.0"],
    ["alt", "Item: Brass lantern"]
  ],
  "content": ""
}
```

- **Every file is named with its hash.** The model, the picture and the
  script are each checked against it before they are used. What is drawn
  or run is exactly what the maker signed, and can't be changed later.
- **`model`** is a GLB file, which Three.js and Godot both read.
- **`size`** is its box in metres, 4 at most a side. A file that is larger
  is scaled down to fit.
- **`collider`** is its hit box, as simple shapes: a `box` (centre, size), a
  `sphere` (centre, radius) or a `capsule` (centre, radius, height). What
  touches what is worked out from these, never from the drawn shape.
- **`clip`** ties a moment (`idle`, `touch`, `held`, `move`, `use`) to an
  animation in the file.
- **`behavior`** is what it can be, from a closed list: `holdable`,
  `sittable`, `touchable`, `readable`, `wearable`. A reader ignores one it
  doesn't know.
- **`fits`** is where it may go: `place` (in a room), or a person's `head`,
  `back`, `hand-left`, `hand-right` or `side`.
- **`use`** is `anyone` (the default) or `granted`: only for someone its
  maker has granted it to.
- **`script`** is what it does of its own, where it does anything. See
  below.

**One site can hold any number of items.** An item is a note and some
files, and the files can be anywhere that serves them over `https`. A
maker keeps as many as they like in one place.

**The maker is always on show.** A description is signed, so anything that
draws an item can say who made it.

## What an item does

**Most items need no script.** A book says it is `readable`, a chair that
it is `sittable`, a hat that it is `wearable`. Each world knows what those
mean, and they work in every world that draws items, including one that
runs no scripts.

**An item's own logic** is for a thing that does more: a tool, an
instrument, a weapon.

- **It runs only for the person carrying it.** Everyone else sees what it
  did, never its code.
- **It runs shut away.** No network, no storage, nothing of the scene,
  nothing of the visitor: not their key, their name, or where they are. It
  can be stopped at once if it hangs.
- **It hears about its own item and nothing else:** picked up, put away,
  used, touched, and the passing of time.
- **It may ask for things from a fixed list:** play one of its own
  animations or sounds, show its own words, glow, send out one of the
  things it has described (a bolt, a ball), change its own state. Each has
  a ceiling on how often and how much.
- **It says what happened** to the world: "I was used", "I hit that with
  power 3". The world decides what that means.
- **Two switches.** A world chooses whether scripted items run there at
  all. A visitor approves an item's script the first time they use it, and
  is shown who made it.

One form serves every engine: the script is JavaScript, run in the
browser's own locked box, and the kit passes what it asks for to whichever
engine is drawing the world.

## People as part of the game

For an item to matter, a world has to be able to treat a visitor as it
treats anything else in its game. The kit gives every world the same
picture of a person:

- **A body:** a simple shape that things can hit.
- **State the world defines:** health, a score, a side, whatever its rules
  need, shared with the room.
- **Things done to them:** "hit, with power 3, by that item of that
  person's". The world's rules decide what follows.

**Who decides.** These worlds are pages with no server behind them, so
there is no referee. **The person something was done to decides what it
did to them, by the world's own rules running on their own device**, and
tells the room. Nobody's code runs on anyone else's device for it.

That is honest in the way a claimed score is honest ([NSWP-15](15-scores.md)):
someone who alters their own page could shrug off a hit. It is enough for
play among people who came to play. A world that needs more needs a
referee, which is a later thing, laid over this one.

## Muting

In a place where items are **allowed**, a visitor may:

- **Mute one person's items.** They no longer see or hear what those items
  do, and those items can't affect them. Nobody is told, as with muting a
  voice.
- **Mute all items,** with a switch of their own that goes with them from
  world to world.

In a place where items are **part of play**, nobody is out of their reach:
that is what the door said. A visitor can still leave.

**Everywhere, whatever the place:**

- A ceiling on how loud and how bright anything an item does may be, set by
  the visitor, holds.
- Blocking a person removes them and everything of theirs.

## A visitor's bag

A person keeps a list of the items they have: ones they made, ones they
took up from someone else's site, ones a world gave them. It is theirs,
signed by their key, and public to begin with: what someone carries is on
show anyway.

Carrying an item into a world is tied to who they are there. A guest
carries nothing.

## What is not here

- **Scarcity.** Nostr can prove who made a thing and who it was given to.
  It can't stop a maker giving the same thing a thousand times, and there
  is no ledger here that would. A maker may number what they give
  ("12 of 100"), and anyone can count; enforcing it needs a service a
  reader trusts.
- **Winning an item that must be granted.** A world that is only a page
  can't sign a grant. It can add an item anyone may use to its visitor's
  bag; a granted one waits for that same service.

## The order it is being built in

1. **Done:** an item's description; a world's rule for items; the warning
   on a door.
2. A visitor's bag, and holding one thing in a hand, drawn in worlds that
   allow it.
3. A person's body and state, and things done to them, with the affected
   person deciding.
4. Muting, and the ceilings.
5. An item's own logic, in its locked box.
