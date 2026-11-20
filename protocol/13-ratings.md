# NSWP-13: Ratings

**Status:** Implemented in the reference library, and in BitPortal at home (giving one, and showing a tally on doors, in the lobby and at the Airlock); and in the reference kit on a world's own doors · **Kinds:** 37305 · **Vectors:** [`ratings`](../vectors/ratings.json) · **Code:** core [`rating.ts`](../packages/core/src/rating.ts)

A **rating** is what one person thought of one world: one to five stars,
and a few words if they like. A client shows what the people a visitor has
reason to trust thought of a place, before the visitor goes there.

## Three rules

1. **A rating is its giver's.** It is a note signed by their key. They can
   change it, and the newest is the one that stands.
2. **A count of strangers is not a rating.** Keys cost nothing: anyone can
   make a thousand and rate with each. A client never shows an average of
   everyone's ratings as if it meant something. It counts the people its
   visitor has reason to trust, and says who they are.
3. **A world doesn't collect its own.** A rating is given at the visitor's
   own client, never from inside the world it rates.

## The note

A rating is addressable (experimental kind **37305**), one for each world a
person has rated:

```json
{
  "kind": 37305,
  "tags": [
    ["d", "37300:<the world's publisher>:<the world's d>"],
    ["a", "37300:<the world's publisher>:<the world's d>", "<relay hint>"],
    ["rating", "4"],
    ["alt", "A rating of a world: 4 of 5"]
  ],
  "content": "Caught all twelve. Good fun."
}
```

- `d` and `a` both name the world, by its coordinate. `d` makes it one
  rating a person per world; `a` is what a relay is asked by. A rating whose
  two disagree is not a rating.
- `rating` is a whole number from 1 to 5. Anything else is not a rating.
- `content` is plain text, 280 characters at most, shown as text. Something
  longer is a comment on the world (NIP-22, kind 1111), not a rating.

A rating is of a world as announced by one key. A world announced again
under another key starts with none.

## Whose ratings count

This is the client's decision, and the part that matters.

- **The visitor's own** always counts, for them.
- **People the visitor has reason to trust:** the people they follow
  (NIP-02), and the curators whose lists of worlds they use
  ([NSWP-08](08-lists.md)). A client may reach further, to the people those
  follow, and should say so if it does.
- **Nobody else.** A rating by a key the visitor has no link to is not
  counted and not shown.
- **Never the world's own publisher,** for its own world.
- **Never one the world asked for itself.** A signer may mark what it signs
  with the site that asked (`nswp:world`, or a signer's own mark such as
  BitLogin's `bitlogin:site`). A rating marked with the origin of the world
  it rates is left out.

For each person counted, their newest rating of that world, with a real
signature. The tally is how many, and their average to one decimal place.

**Saying it.** A tally is always said with whose it is: "4.5 of 5, from 12
people you follow or whose lists you use". With nobody counted there is no
tally, and a client says nothing or says that: never "0 stars".

## On a world's own doors

A world is a Nostr client like any other, and may show what people thought
of the places its doors lead to, as a visitor's own client does:

- **The visitor's own rating always counts,** once they are signed in
  there.
- **The people they follow count where the visitor has let that world see
  who they follow** ([NSWP-10](10-identity.md), "Asking for more"). A world
  that hasn't been let counts nobody else.
- **Relays are asked by world, never by person:** for the ratings of the
  places its doors lead to. For a guest nothing is asked, and nothing is
  shown.
- **A door's sign says it in one line,** "★ 4.5 from 3", under where it
  leads, and says nothing where nobody they know has rated the place.
- **This is showing, never giving.** A rating is still given only at the
  visitor's own client.

## Giving one

- **At the visitor's own client,** where they are signed in: beside the door
  at home, or on the way back from a world.
- **Never from inside the world.** A world's signer refuses the kind
  ([NSWP-10](10-identity.md): only a note and a reaction are signed for a
  world), and a tally drops what a world got signed some other way.
- **Sent where it will be found:** the giver's own relays (NIP-65) and the
  relays their client reads worlds from.
- **Changed by giving another.** There is no un-rating in this version; see
  below.

## What it gives away

A rating is public: that this key rated this world, how, and when. It is the
one thing here that says publicly a person went somewhere. A client says so
before the first one is given.

## In code

```ts
import { buildRating, tallyRatings, tallyWords } from "@nswp/core";

const note = buildRating({ world: "37300:<publisher>:arcade", stars: 4, words: "Good fun.", now: Date.now() / 1000 });
// signed by the visitor at their own client, then sent to relays

const tally = tallyRatings(events, { world, counted: peopleTheyTrust, me: theirKey, worldUrl: "https://arcade.example/" });
tallyWords(tally); // "4.5 of 5, from 12", or "" when nobody counted has rated it
```

## Proposed, not built

- **Taking a rating back** (a deletion, NIP-09), from the visitor's client.
- **Reaching further than follows:** counting the people one's follows
  follow, weighted less.
- **A rating only from someone who went.** Nothing proves a rater visited.
  An entry assertion ([NSWP-03](03-arrival.md)) kept by the visitor's client
  could be attached; it would also say more about where they have been.
