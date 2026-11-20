# NSWP-15: Scores

**Status:** Implemented in the reference library and kit, as claims; the Arcade keeps a board. A signer's side is one message, which BitLogin has not built yet: until it has, a visitor's best stays on their device. Checked scores, and boards across worlds, are proposed · **Kinds:** 37306 · **Vectors:** [`scores`](../vectors/scores.json) · **Code:** core [`score.ts`](../packages/core/src/score.ts); SDK [`scores.ts`](../packages/sdk/src/scores.ts), [`scoring.ts`](../packages/sdk/src/scoring.ts) · **Guide:** [`controls-kit.md`](../docs/controls-kit.md)

A world that keeps score may let its visitor post one, and show who else
has. All of it is optional. A world that names no boards owes nothing here,
and nothing about scores appears in it.

## Three rules

1. **A score is its owner's, and posting it is their choice.** It is a note
   signed by their key, sent only when they say to. A score on a board says
   publicly that this person was in this world, and how they did.
2. **A score is a claim.** Nothing here checks that it was earned: whoever
   holds a key can sign any number. A client says so wherever it shows one.
3. **A board lists the people a reader has reason to know first.** Keys cost
   nothing, so everyone else is listed after, apart, and a few at most.

## A board

A world may keep score on one board or several. Each has:

| | |
|---|---|
| `id` | Its name among this world's boards: lower-case letters, digits and hyphens, 32 at most |
| `title` | What it is called, for a reader |
| `order` | `high` where more is better, `low` where less is |
| `format` | `number`, or `time`: thousandths of a second, said as "42.5 s" |

A score is a whole number from 0 up. What it counts is the board's to say.

## The note

A score is addressable (experimental kind **37306**), one for each person
on each board. Posting a better one replaces it.

```json
{
  "kind": 37306,
  "tags": [
    ["d", "37300:<the world's publisher>:<the world's d>/lantern-run"],
    ["a", "37300:<the world's publisher>:<the world's d>"],
    ["board", "lantern-run"],
    ["score", "42500"],
    ["alt", "A score in a world: 42500"],
    ["nswp:world", "https://arcade.example"]
  ],
  "content": ""
}
```

- `a` names the world, and is what a relay is asked by. `board` names the
  board. `d` is the two joined by `/`: a score whose `d` disagrees with them
  is not a score.
- `nswp:world` is the mark the visitor's signer puts on what it signs for a
  world: the site that asked. **A score counts on a board only if that mark
  is the world's own address.** So another site can't post to this world's
  board, and a score signed anywhere else isn't on it.

## Posting one

A world asks its visitor's signer, in the conversation of
[NSWP-10](10-identity.md):

| From the world | The signer answers |
|---|---|
| `score`, with `world` (its own coordinate), `board` and `score` | `signed`, with the whole signed score; or `refused` |

- **Any world its visitor has unlocked may ask.** A score is less than a
  note, which such a world may already have signed. It is not one of the
  things asked for by name.
- **The signer writes the note.** The world gives three things and nothing
  else. The signer sets the time and the mark (`scoreForWorld`). `sign`
  still refuses the kind.
- **How often:** six a minute and sixty an hour for one world.
- **The world sends it** to the visitor's own relays
  ([NIP-65](https://github.com/nostr-protocol/nips/blob/master/65.md)) and
  the usual ones.

**What a world does around that** (the reference kit does all of it):

- Keeps a visitor's best on the device, whoever they are, as they make it.
- Posts only from the visitor's own press, and says that it is public.
- Posts only an improvement.
- Takes what a guest made as theirs once they sign in.

## Reading a board

A client asks relays for scores by world (`#a`), never by person: nobody is
told whose scores are being looked for. Then (`rankScores`):

1. Only a real signature counts, and each person's newest score on that
   board.
2. Only a score marked as asked for at the world's own address.
3. Best first; where two are level, whoever posted first.
4. The people the reader has reason to know (the people they follow, and
   the reader) are listed apart and first, each with their place among
   everyone. Everyone else follows, a few at most.

A client says a score is claimed. It never calls one verified, a record, or
a win, on this alone.

## What it gives away

- **A posted score is public:** that this key was in this world, what it
  scored, and when.
- **Until it is posted, nothing:** a best is kept on the device.
- **A world that reads who its visitor follows,** to list them first, has
  been let see that by them ([NSWP-14](14-people-and-messages.md)). One
  that hasn't lists only the visitor first.

## In code

```ts
import { createScores, addScoreControls, worldSigner } from "nswp-sdk/three";

const scores = createScores({
  world: "37300:<publisher>:arcade",
  worldUrl: location.origin,
  boards: [{ id: "lantern-run", title: "Lantern Run", order: "low", format: "time" }],
  hand: { pubkey: () => worldSigner().pubkey, sign: (w, b, s) => worldSigner().score(w, b, s) },
});
scores.record("lantern-run", 42_500);                  // a run ended: kept if it is their best
addScoreControls(controls, { scores, signedIn: () => worldSigner().state === "unlocked" });
```

## Proposed, not built

- **A checked score.** A service a reader trusts looks at how a score was
  made and signs that it holds. A client then shows that score as checked,
  by whom. Nothing above changes: a check is laid over a claim.
- **A world saying its boards in its announcement,** so that a visitor's own
  client can show a board on the world's door before they go in.
- **Boards across worlds,** which need someone to say which worlds count.
- **Scores on a person's card.**
