# NSWP-05: Looks

**Status:** Implemented for the generated and simple tiers; the model tier is written, and its reader built (drawing it is being built) · **Kinds:** 37301 · **Schema:** [`look`](../schemas/look.schema.json) · **Vectors:** [`looks`](../vectors/looks.json) · **Code:** [`avatar.ts`](../packages/core/src/avatar.ts), SDK [`figure.ts`](../packages/sdk/src/figure.ts)

A look is how a person appears to others in a room. It is a few choices from
short closed lists and three colours. It is data, never a file: nothing is
fetched to draw it, it can't carry an image, and it can't overload a device.
Every key has a look before its owner has chosen anything, so people differ
from each other from the start and each is the same in every world.

## The parts

| Part | Choices, in order |
|---|---|
| `color`, `accent`, `light` | `#rrggbb`, lowercase: the main colour, the trim, and everything that glows |
| `build` | `medium`, `slight`, `broad` |
| `head` | `round`, `square`, `tall`, `wedge`, `flat`, `faceted` |
| `face` | `band`, `split`, `dots`, `tee`, `slit`, `wide` |
| `accessory` | `none`, `antenna`, `halo`, `hat`, `crest`, `fins` |
| `body` | `cloak`, `coat`, `plate`, `robe` |
| `shoulders` | `none`, `pads`, `mantle`, `collar` |
| `pattern` | `plain`, `halves`, `stripe`, `bands`, `yoke` |
| `finish` | `matte`, `gloss`, `sheen` |

The lists name parts, not shapes. `tall` means a tall head; a world is free to
draw its own idea of one. The order matters: generation below picks by
position.

## The generated look

Given a **seed** (a public key in hex, or any string a client keeps for a
guest), every implementation must produce the same look:

1. `b` = SHA-256 of the seed, lowercased, as UTF-8 bytes. `b[i]` is byte `i`.
2. `hue` = (`b[0]` × 256 + `b[1]`) / 65536.
3. `color` = HSL(`hue`, 0.42 + (`b[4]` mod 4) × 0.08, 0.26 + (`b[5]` mod 4) × 0.04).
4. `accent` = HSL(`hue` + [0.08, 0.5, 0.92, 0.33][`b[2]` mod 4], 0.30 + (`b[6]` mod 4) × 0.10, 0.42 + (`b[7]` mod 4) × 0.06).
5. `light` = HSL(`hue` + [0, 0.12, 0.5, 0.88][`b[3]` mod 4], 0.9, 0.62).
6. `build`, `head`, `face`, `accessory`, `body`, `shoulders`, `pattern`,
   `finish` are entries `b[8]` to `b[15]` of their lists, each taken modulo the
   list's length.

Hues wrap at 1. HSL is converted to RGB the usual way, each channel rounded to
the nearest of 0 to 255. The vectors pin several seeds.

## The mark

Every look carries a mark that is **not a choice**: fifteen bits of the same
hash, written as four hex digits: `b[30]` with its top bit cleared, then
`b[31]`.

It is drawn as five rows of five cells, mirrored left to right. With the mark
read as a number, the cell in row `r` (0 at the top) and column `c` is lit when
bit `r × 3 + min(c, 4 − c)` is set.

Whatever else two people choose alike, their marks differ, and a copy of
someone's choices under another key comes out with the copier's mark.

**A mark alone proves nothing.** It is fifteen bits, so anyone can make a key
or a seed whose mark matches another's. What makes a mark someone's is a pass
([NSWP-10](10-identity.md)):

- A member whose pass checks out wears the mark of their identity key,
  whatever seed their look carries, and a reader draws it as proven. The
  reference client puts a lit frame round it.
- A seed that is a public key (64 hex characters) is a claim to that key.
  From someone with no pass for it, a reader draws the mark their session key
  generates instead.
- Anyone else's mark says only "the same visitor as before", if that.

## Choosing

A choice replaces one part of the generated look. A choice that is missing, or
not on its list, keeps the generated part. So a look never fails to draw, and
a newer list is read safely by an older world. A choice of `mark` is ignored.

## Three ways it is written

**As tags on an avatar event** (kind `37301`, addressable, `d` names the slot,
usually `default`). The author's key is the seed.

```json
{ "kind": 37301, "tags": [["d", "default"], ["simple", "head", "tall"], ["simple", "light", "#47f561"], ["alt", "Avatar preference"]], "content": "" }
```

**Inline**, for an arrival context or a room: a JSON object with the seed and
only the parts that differ from what the seed generates.

```json
{"s":"g0123456789abcdef01234567","head":"tall","light":"#47f561"}
```

`s` is 8 to 64 of `A-Z a-z 0-9 _ -`. The whole text is at most 600 characters.
Anything longer, not an object, or without a valid `s` is refused.

**Not at all.** Someone who has chosen nothing is drawn from whatever key the
world can see for them.

## How a look reaches a world

| Who | How | Published |
|---|---|---|
| Anyone the world has a key for | Generated from the key | Nothing |
| Signed in, with a chosen look | Their avatar event | The event |
| A guest with a chosen look | Inline in the arrival context ([NSWP-03](03-arrival.md)) | Nothing |
| People already in a room | Each tells the others, inline ([NSWP-06](06-rooms.md)) | Nothing |

**The cost.** A look that is the same everywhere makes its wearer recognisable
everywhere. A client therefore keeps nothing and sends nothing until the
visitor makes a look, and its Airlock offers the choice on every trip: go as
yourself, or go plain.

## Changing a look

A look is the visitor's, kept by their own client, and it is the same in
every world that doesn't dress its visitors its own way. So it is changed in
one place: their client.

- **A world never edits a look and never sends one back.** No part of a look
  travels on a link out of a world. A look a world could write would be a
  mark it could put on a visitor and then follow them by, from world to
  world, without their knowing. This is why a look is not one of the
  settings that travel ([NSWP-11](11-the-visitors-console.md)).
- **A world offers the way to change it.** The console has "Change how you
  look" under "You" in every world. Pressing it leaves for the visitor's own
  client with a door back to the world and `who=look`
  ([NSWP-02](02-doors.md)), exactly as signing in does
  ([NSWP-10](10-identity.md), "Signing in from inside a world"). They come
  back wearing what they chose.
- **A client keeps it as it keeps the visitor's other things.** In the
  browser first, and with their profile if they have asked for that, so
  another device starts from it. That is the client's business and no
  world's.

In the reference client the look is changed in the visitor's room, from the
menu: the same controls on a phone, at a desk and on a headset's wrist, with
their own figure standing in the room to show them. Each part steps through
the protocol's list for it.

## A model of your own

A signed-in person may wear a 3D file of their own in place of their simple
look: a VRM, or a plain GLB. It is said in their avatar event, with tags
beside the simple ones:

| Tag | Meaning |
|---|---|
| `["model", url, format, sha256]` | The file. `format` is `vrm` or `glb`. The url is a hint: the hash is the file |
| `["height", metres]` | How tall they want to be drawn, held within the limits below |
| `["thumb", url, sha256]` | A picture of it, for panels and cards. Optional; checked by its hash like the file |
| `["simple", part, value]` | As always: the simple look, which is what is drawn whenever the model isn't |

```json
{ "kind": 37301, "tags": [["d", "default"], ["model", "https://files.example/<sha256>.vrm", "vrm", "<sha256>"], ["height", "1.92"], ["simple", "head", "tall"], ["alt", "Avatar preference"]], "content": "" }
```

An event without `model` is a simple look. One whose model is plain `http`,
has no real hash, or is of another format names no model. In code:
`readLookModel(note)`.

- **Only a person a world can tie to a key wears one.** A guest has no event
  to name it by, and is drawn generated or simple, as always.
- **It is fetched as an item's files are:** by its hash, only from the file
  hosts on each viewer's own list ([NSWP-17](17-items.md), "Where a file is
  fetched from"). One kept anywhere else is not fetched unless the viewer
  turned on loading files from anywhere: its wearer is drawn as their simple
  look.
- **It is read and counted before anything draws it,** by the same reader as
  an item's model, against a lower budget, since a room holds several people
  at once (`LOOK_BUDGET`): 1,000,000 bytes, 12,000 triangles, 24 meshes, 8
  materials, pictures at most 1024 px, 128 joints, 64 morph targets on any
  one mesh. A file that names anything outside itself is refused. It may say
  it requires VRM's own extensions (`VRMC_vrm`, `VRMC_materials_mtoon`) or
  `KHR_materials_unlit`, and nothing else. A world may lower the budget in
  its manifest (`avatar.max_file_size_mb`, `avatar.max_triangles`), never
  raise it. A model that fails any of this is not drawn: its wearer is
  drawn as their simple look.
- **Nothing in a look runs, ever.** Spring bones (hair and cloth that swing,
  `VRMC_springBone`) are ignored in this first round.
- **Height** is from 0.85 m to 2.55 m (`LOOK_HEIGHT`), 1.7 m standard. A
  world may narrow it (`avatar.height: [least, most]` in its manifest); a
  height outside is drawn at the nearest limit (`lookHeight`). Height
  changes the drawing only: where the eyes are, reach, walking, personal
  space and the places to arrive are the same for everyone.
- **The mark stays.** The renderer draws the wearer's mark above every
  model. No file can hide it or replace it.
- **A VRM moves everywhere:** its standard skeleton is walked, turned and
  pointed by the renderer. A GLB with no skeleton floats along as a whole.
- **At most `LOOK_MODELS_AT_ONCE` (8) are drawn,** the nearest first; the
  rest are drawn as their simple looks.
- **Each viewer decides,** for everyone and for each person, as with
  pictures.

**The world's word,** in its manifest's `avatar`:

| `avatar` | The world draws |
|---|---|
| `formats` includes `vrm` and/or `glb` | People's own models of those formats, within its budget |
| `formats` left out, or neither | Everyone's simple look |
| `dress: "own"` | None of anyone's look: the world dresses everyone itself ("Recast" or "Uniform" below), keeping the mark recognisable |

The door says which, before anyone crosses.

**The cost** is the same as a chosen look's, and greater: a model makes its
wearer recognisable in every world that draws it. A client says so plainly
the first time someone publishes a look. Going plain for a trip (see "How a
look reaches a world") also leaves the model behind.

## What a world may change

| Level | What the world does | What survives |
|---|---|---|
| As it is | Draws a standard figure | Everything |
| Re-dressed | The same shapes in its own material and palette, with parts left off | Shapes, the mark, as much colour as the palette has |
| Recast | Reads the parts and draws something of its own | Whatever it maps |
| Uniform | Ignores it | Nothing |

A world that draws its visitors differently from each other at all should
keep the mark recognisable. It is the one cue that follows a person
everywhere and that someone else can't copy.

## Proposed, not built

Drawing the model tier (above): the reader, its budget and its limits are
built (`look-model.ts`, `readGlb`), and drawing it in the kit, the engines and
the reference client is being built (`docs/plans/own-models.md`). Publishing
an avatar event from a client: the reference editor keeps looks on the device only. The
lists themselves are a first proposal (Q25). Background and reasoning:
[`spec.md`](../spec.md) §4.2.
