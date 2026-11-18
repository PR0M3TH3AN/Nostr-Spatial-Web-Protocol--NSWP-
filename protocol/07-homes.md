# NSWP-07: Homes

**Status:** Layouts and the built-in catalogue are implemented; published items are proposed · **Kinds:** 37302 (layout); 37303 (item, proposed) · **Code:** [`layout.ts`](../packages/core/src/layout.ts), SDK [`home.ts`](../packages/sdk/src/home.ts) · **Tests:** [`layout.test.ts`](../packages/core/test/layout.test.ts)

A home is a place of a person's own, described by a signed event and drawn by
a renderer. The person owns the description. Anyone can run the code that
draws it, and switching renderers doesn't lose the home, because the layout
isn't stored there.

## The layout

An addressable event of kind `37302`. `d` names the place.

```json
{
  "kind": 37302,
  "tags": [
    ["d", "home"],
    ["title", "Ada's place"],
    ["room", "hall", "#101217", "#3fc584"],
    ["item", "frame", "0 1.6 -3", "0", "https://blossom.example/<sha256>.webp", "<sha256>"],
    ["item", "portal", "2.5 0 -2.5", "-40", "37300:<pubkey>:example-museum"],
    ["item", "plant", "-2 0 -1", "0"],
    ["item", "note", "-3 1.5 0", "90", "Welcome. Shoes off."],
    ["access", "follows"],
    ["alt", "Home layout: Ada's place"]
  ],
  "content": ""
}
```

- `room` is a template and two colours: the ground, and the light.
- Each `item` is a type, a position in metres as `x y z` from the home's
  origin, a rotation about the vertical in degrees, then whatever that type
  needs.
- `access` is the default rule for rooms held there: `open`, `invite`, `list`,
  `follows` or `ticket`.

Axes: x to the right, y up, z towards the visitor. A visitor arrives looking
along -Z.

## The built-in catalogue

Every renderer draws these. A home made only of them is light and safe to
open anywhere, since nothing is fetched but pictures named by hash.

| Templates | `hall` (three walls, open towards the visitor), `open` (no walls) |
|---|---|

| Item | Takes |
|---|---|
| `frame` | A picture's `https` address and its SHA-256 |
| `portal` | A world's coordinate `37300:<pubkey>:<d>`, or an `https` address; then an optional label |
| `note` | A short text, at most 280 characters |
| `plant`, `lamp`, `bench`, `table`, `plinth` | Nothing |

How each looks is the renderer's own. The catalogue names things, not shapes.

## Limits

- At most 64 placements, none more than 50 m from the origin.
- At most 16 different published items among them.
- A placement the reader doesn't understand is dropped with a warning, and the
  rest of the home is drawn.
- A picture is checked against its hash before it is shown.

## A renderer

A renderer is any static site that reads a layout and draws it. A home's
address is `https://<renderer>/#<naddr of the layout>`.

A home is a world like any other: announced ([NSWP-01](01-worlds.md)), reached
through the Airlock, and able to hold rooms. Two parties stand behind it, and
the Airlock names both: who runs the renderer, and who laid out the place. Its
announcement is verified when its entry address is on the renderer's origin
and names the layout, the renderer's manifest admits the layout's key, and one
key signed both the announcement and the layout.

Someone who runs their own site can be their own renderer. The world template
starts as one.

## What a client must not do

A person's saved doors say what they are interested in. A client that draws
them in a home does so for the owner alone. They are never written into the
public layout, and a guest's copy of the home doesn't show them.

## Proposed, not built

- **Published items** (kind 37303): a thing described once by its maker, with
  a 3D file, a size and simple collision shapes, placed in a home by its
  coordinate. A renderer says in its manifest which it draws: none, those on
  lists it names, or any. One it won't draw is shown as a plain marker.
- **Things a person carries** from world to world.
- An editor, and a schema and vectors for layouts.

Who decides what is in the catalogue is an open question (Q23). Background and
reasoning: [`spec.md`](../spec.md) §4.5, §7.5, §10.4, §10.5.
