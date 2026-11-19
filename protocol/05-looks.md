# NSWP-05: Looks

**Status:** Implemented for the generated and simple tiers; the model tier is proposed · **Kinds:** 37301 · **Schema:** [`look`](../schemas/look.schema.json) · **Vectors:** [`looks`](../vectors/looks.json) · **Code:** [`avatar.ts`](../packages/core/src/avatar.ts), SDK [`figure.ts`](../packages/sdk/src/figure.ts)

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

The model tier (a 3D file, VRM or GLB, named by hash). Publishing an avatar
event from a client: the reference editor keeps looks on the device only. The
lists themselves are a first proposal (Q25). Background and reasoning:
[`spec.md`](../spec.md) §4.2.
