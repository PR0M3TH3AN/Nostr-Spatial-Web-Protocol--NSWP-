# NSWP-10: Who someone is

**Status:** Passes, names in rooms and the proven mark are implemented; profile cards beyond a name, hosted rooms that check passes, and taking a pass back early are proposed · **Kinds:** 27300 (pass) · **Schema:** [`pass`](../schemas/pass.schema.json) · **Vectors:** [`passes`](../vectors/passes.json) · **Code:** [`pass.ts`](../packages/core/src/pass.ts), SDK [`room.ts`](../packages/sdk/src/room.ts)

A world is someone else's website. It must never hold a visitor's key, and it
doesn't need to: what it needs is to know, when the visitor wants it known,
which identity is standing in the room. This document says how that is proved
without the key ever leaving the visitor's own client.

## Four rules everything else follows from

1. **A world never gets a key that matters.** No world asks for one, and no
   client gives one. A world that asks a visitor to sign in is doing
   something this protocol has no use for ([NSWP-09](09-what-a-world-owes.md)).
2. **Going by name is a choice made on each trip,** at the Airlock, in the
   visitor's own client. It is never the default the first time, and never
   happens for a site that hasn't adopted the protocol.
3. **A guest is a full visitor.** Nothing here is needed to walk around, to
   join a room, or to be seen.
4. **A name is shown only when it is proved.** Nobody is called anything on
   their own say-so.

## The pass

At the Airlock, the visitor's client makes a fresh **session key** for this
one trip and signs a pass with the visitor's identity key:

```json
{
  "kind": 27300,
  "created_at": 1794430800,
  "tags": [
    ["nswp:session", "<session public key>"],
    ["nswp:origin", "https://museum.example"],
    ["expiration", "1794445200"],
    ["name", "Alice"]
  ],
  "content": ""
}
```

It says: "at this site, until this time, the session key speaks for me."

| Tag | What it is |
|---|---|
| `nswp:session` | The session public key, 64 hex characters. Never the identity key itself |
| `nswp:origin` | The origin of the world the visitor is going to |
| `expiration` | When the pass stops. 4 hours after `created_at` by default, 12 at most |
| `name` | Optional. What the visitor chose to be called: one line, at most 48 characters |

The client hands the world two things in the arrival context
([NSWP-03](03-arrival.md)): `pass`, the signed event, and `sessionKey`, the
secret half of the session key. The world uses the session key for everything
the visitor does in a room there. Anyone who checks the pass knows which
identity is behind it.

Kind 27300 is experimental and in the ephemeral range on purpose: a relay
that is handed one isn't expected to keep it. The reference client never
sends one to a relay at all.

## Checking a pass

A pass is believed only when all of this holds. The vectors cover each line.

- It is a validly signed event of kind 27300.
- It has exactly one `nswp:session`, one `nswp:origin` and one `expiration`.
- `nswp:origin` is the reader's own origin. A pass made for another site is
  worth nothing here.
- `nswp:session` is the key the member is actually using, and is not the key
  that signed the pass.
- `expiration` is in the future, and at most 12 hours after `created_at`.
- `created_at` is not more than 120 seconds ahead of the reader's clock.

In a room, "the key the member is actually using" is the key their handshake
is signed with ([NSWP-06](06-rooms.md)). Every message that sets up the
connection is signed by it or encrypted to it, so a member can only show a
pass for a session key they hold. Copying someone else's pass gets them
nowhere: it names a key they can't speak with.

A pass that fails is ignored, and its owner stays a guest. It is not an error
to show to anyone.

## Names

- A name comes from a pass and from nowhere else. A reader tidies it before
  showing it: control characters and the invisible ones that hide or reorder
  text become spaces, runs of spaces become one, and it is cut at 48
  characters. A pass with no name, or none left after tidying, is shown by the
  short form of its key.
- A guest is shown as `Guest` and the first four hex digits of their session
  key. A guest can't choose that text, so nothing a guest types can pass for a
  name.
- **A name is not unique, and neither is a mark.** Anyone can call themselves
  Alice, and anyone can make a key whose mark matches someone else's: a mark
  is fifteen bits ([NSWP-05](05-looks.md)). What proves is the pass. What
  identifies is the key. So a reader that shows a name makes the key behind it
  one action away, in full.

## The mark

A member with a valid pass is drawn with the mark of **their identity key**,
whatever seed their look carries. It is the same mark in every world, and
they can't choose another.

A look whose seed is a public key (64 hex characters) is a claim to that key.
From a member without a pass for it, a reader doesn't honour the claim: it
draws the mark their session key generates instead. So nobody wears a key's
mark without proving the key.

A reader shows a proven mark differently from an unproven one. The reference
client puts a ring round it.

## In a room

The pass travels between members directly, never through a relay, as one more
text message on the channel they already share ([NSWP-06](06-rooms.md)):

| Text | Meaning |
|---|---|
| `id:<the pass, as JSON>` | "This is who I am." At most 4,000 characters. Said when the channel opens and three more times, 1.5 seconds apart, like a look |

A member who never says it is a guest. A member whose pass checks out is shown
by name from then on, for as long as the pass lasts. When it expires they are
a guest again.

## What it gives away

A client says this in plain words before a visitor first goes by name.

- **The world learns the key.** Its page is handed the pass, so whoever runs
  the site can know that this identity came, and when.
- **So does everyone in a room the visitor joins,** together with the
  visitor's IP address, because members connect to each other directly.
- **It can't be taken back.** A pass is signed. Anyone who was shown one can
  keep it as proof that this identity went to this site in those hours. It
  doesn't say which room.
- **The world can act as the visitor, there, until the pass ends.** It holds
  the session key. That is what a pass is for, and why it is good at one
  origin for a few hours and nowhere else.

## What a client does at the Airlock

The reference client offers, on each trip to a world that has adopted the
protocol:

| Choice | What goes with the visitor |
|---|---|
| By name | A pass and its session key, and their look |
| As a guest, wearing their look | Their look ([NSWP-05](05-looks.md)) |
| Plain | Nothing |

- **"By name" is offered only to someone already signed in.** The Airlock
  never asks anyone to sign in: a sign-in prompt in the middle of a crossing
  is exactly what a fake Airlock would show. If the session can't sign just
  then, the visitor is told, and chooses again; they are never sent on as
  something they didn't pick.
- **Only for a verified world.** A pass names the visitor's key for good, so
  it goes only to a site that has proved it is the one its announcement says.
- **The choice is remembered** once it has worked, and the first time it is
  never "by name".
- **A new session key every trip.** Two passes can't be linked by their
  session keys, only by the identity that signed them.

## In code

```js
import { arrival } from "nswp-sdk";
import { createPresence } from "nswp-sdk/three";

arrival.read();                       // reads, checks and scrubs, as always
const who = arrival.identity();       // { pubkey, name, pass, sessionKey } or undefined: checked against this origin
createPresence({ look: () => arrival.look(), identity: () => arrival.identity() });
```

`verifyRoomPass(event, { origin, session })` in `@nswp/core` is the check
above, for a world that draws its own rooms.

## Proposed, not built

- **A profile card with more than a name.** A picture or a bio means fetching
  from addresses the other person chose, which would show every member's IP
  address to those hosts. That belongs in the visitor's own client, reached by
  a hand-off the way a door is.
- **Taking a pass back early.** Today it lasts until it expires.
- **A pass for one room,** naming a room event, once rooms have them; and
  **hosted rooms** that check passes at the door (spec §9.1 to §9.5).
- **Going as another identity** than the one signed in.
- **Carrying the visitor's mute list,** so a world can leave out the people
  they have muted.
- **Proof for a world's server.** The entry assertion in
  [NSWP-03](03-arrival.md) is the format; no client issues one yet.

Background and reasoning: [`spec.md`](../spec.md) §4.3, §4.4, §9.2.
