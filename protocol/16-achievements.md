# NSWP-16: Achievements

**Status:** Implemented in the reference library and kit, as claims; the Arcade has four. A signer's side is one message, which BitLogin has not built yet: until it has, what a visitor earned stays on their device. Achievements granted by someone a reader trusts are proposed · **Kinds:** 37307 · **Vectors:** [`achievements`](../vectors/achievements.json) · **Code:** core [`achievement.ts`](../packages/core/src/achievement.ts); SDK [`achievements.ts`](../packages/sdk/src/achievements.ts), [`achieving.ts`](../packages/sdk/src/achieving.ts) · **Guide:** [`controls-kit.md`](../docs/controls-kit.md)

A world may mark things its visitors do: the first lantern caught, every
one of them, a run under a minute. A visitor who earns one may show it as
theirs. All of it is optional. A world that names no achievements owes
nothing here, and nothing about them appears in it.

It is built the way scores are ([NSWP-15](15-scores.md)), and for the same
reasons.

## Three rules

1. **What a visitor earned is theirs, and showing it is their choice.** It
   is kept on their device as they earn it. It becomes a note signed by
   their key only when they say to show it. An achievement shown says
   publicly that this person was in this world, and what they did there.
2. **An achievement shown is a claim.** Nothing here checks that it was
   earned. A client says whose it is, and never calls it verified.
3. **A reader counts first the people they have reason to know.** Keys cost
   nothing: "shown by 400" from keys nobody knows says little.

## An achievement

A world that marks achievements says so in its announcement, with the
capability `achievements` ([NSWP-01](01-worlds.md), "What a world offers"),
so that its door can say so. Which ones is not said there yet.

A world names the ones it has. Each has:

| | |
|---|---|
| `id` | Its name among this world's achievements: lower-case letters, digits and hyphens, 32 at most |
| `title` | What it is called: one line, 60 characters at most |
| `about` | What it is for, in a few words. Optional |
| `hidden` | Not named to someone who hasn't earned it. Optional |

## The note

An achievement held is addressable (experimental kind **37307**), one for
each person for each achievement of a world.

```json
{
  "kind": 37307,
  "tags": [
    ["d", "37300:<the world's publisher>:<the world's d>/all-twelve"],
    ["a", "37300:<the world's publisher>:<the world's d>"],
    ["achievement", "all-twelve"],
    ["title", "All twelve"],
    ["alt", "An achievement in a world: All twelve"],
    ["nswp:world", "https://arcade.example"]
  ],
  "content": ""
}
```

- `a` names the world, and is what a relay is asked by. `achievement`
  names which. `d` is the two joined by `/`: a note whose `d` disagrees
  with them is not one.
- `title` goes with it so that it can be shown anywhere, by a client that
  has never been to the world. It is the holder's word for what the world
  called it, shown as plain text.
- `nswp:world` is the mark the visitor's signer puts on what it signs for a
  world: the site that asked. **An achievement counts only if that mark is
  the world's own address.** Another site can't hand out this world's
  achievements, and one signed anywhere else is not counted.

## Showing one

A world asks its visitor's signer, in the conversation of
[NSWP-10](10-identity.md):

| From the world | The signer answers |
|---|---|
| `achieve`, with `world` (its own coordinate), `achievement` and `title` | `signed`, with the whole signed note; or `refused` |

- **Any world its visitor has unlocked may ask,** as with a score.
- **The signer writes the note** (`achievementForWorld`): the time and the
  mark are its own. `sign` still refuses the kind.
- **How often:** six a minute and sixty an hour for one world.
- **The world sends it** to the visitor's own relays and the usual ones.

**What a world does around that** (the reference kit does all of it):

- Keeps what a visitor earned on the device, whoever they are, and tells
  them when they earn one.
- Shows nothing publicly until the visitor presses to, and says that it is
  public.
- Takes what a guest earned as theirs once they sign in.

## Reading them

A client asks relays for a world's achievements by world (`#a`), never by
person. Then (`achievementsIn`): only a real signature counts; only a note
marked as asked for at the world's own address; each person once for each
achievement. It says how many people show each, and names the ones its
reader has reason to know.

## On a person's card

A world that marks achievements may say, on the card it shows about a
person, which of its own they show: "Shows 2 of 4 achievements here: First
light, All twelve". Like a score ([NSWP-15](15-scores.md), "On a person's
card"), that comes from what the world asked relays for by world, never by
person. A visitor's own client may show what someone holds in any world it
knows, counted only where the mark is that world's address.

## What it gives away

- **An achievement shown is public:** that this key was in this world, what
  it says it did there, and when it said so.
- **Until it is shown, nothing:** what was earned is kept on the device.

## In code

```ts
import { createAchievements, addAchievementControls, worldSigner } from "nswp-sdk/three";

const achievements = createAchievements({
  world: "37300:<publisher>:arcade",
  worldUrl: location.origin,
  list: [{ id: "all-twelve", title: "All twelve", about: "Catch every lantern in one run" }],
  hand: { pubkey: () => worldSigner().pubkey, sign: (w, id, title) => worldSigner().achieve(w, id, title) },
});
achievements.earn("all-twelve");                       // they just did it: kept on the device
addAchievementControls(controls, { achievements, signedIn: () => worldSigner().state === "unlocked" });
```

## Proposed, not built

- **An achievement granted, not claimed.** A world that runs a server, or a
  service a reader trusts, signs that someone earned it: a badge
  ([NIP-58](https://github.com/nostr-protocol/nips/blob/master/58.md)). A
  client then shows it as granted, and by whom. Nothing above changes: a
  grant is laid over a claim.
- **A world naming its achievements in its announcement,** so that a
  visitor's own client can show them on the world's door. (That it has
  some, it says already: the capability `achievements`.)
- **What someone has earned across every world there is,** beyond the ones
  a visitor's client already knows.
