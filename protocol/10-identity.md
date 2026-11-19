# NSWP-10: Who someone is

**Status:** Passes, names in rooms, the proven mark and signing in from inside a world are implemented; profile cards beyond a name, hosted rooms that check passes, and taking a pass back early are proposed · **Kinds:** 27300 (pass) · **Schema:** [`pass`](../schemas/pass.schema.json) · **Vectors:** [`passes`](../vectors/passes.json) · **Code:** [`pass.ts`](../packages/core/src/pass.ts), SDK [`room.ts`](../packages/sdk/src/room.ts)

A world is someone else's website. It must never hold a visitor's key, and it
doesn't need to: what it needs is to know, when the visitor wants it known,
which identity is standing in the room. This document says how that is proved
without the key ever leaving the visitor's own client.

## Four rules everything else follows from

1. **A world never gets a key that matters.** No world asks for one, and no
   client gives one. A world that asks a visitor to sign in is doing
   something this protocol has no use for ([NSWP-09](09-what-a-world-owes.md)).
   What a world may do is offer the way to the visitor's own client, which
   asks ("Signing in from inside a world", below).
2. **Going by name is a choice made on each trip,** in the visitor's own
   client: at the Airlock, or on its sign-in page when they asked to sign in
   from inside a world. It never happens without their having chosen it, and
   never for a site that hasn't adopted the protocol.
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
  something they didn't pick. A visitor who wants to sign in goes to the
  client's sign-in page, which is a page of its own and says so.
- **Only for a verified world.** A pass names the visitor's key for good, so
  it goes only to a site that has proved it is the one its announcement says.
- **The choice is remembered** once it has worked. Until a visitor has
  chosen "by name" themselves, it is never what they are sent as.
- **A new session key every trip.** Two passes can't be linked by their
  session keys, only by the identity that signed them.

## Signing in from inside a world

A visitor shouldn't have to go home to sign in. And no world may show a
sign-in. Both hold, because what a world offers is not a sign-in: it is the
way to the visitor's own client, and back.

1. **The world has a control that says who the visitor is here,** from what
   it was told on arrival and nothing else: "You are a guest here. Sign in",
   or "Here as Alice. Switch profile, or go as a guest". The reference kit
   puts it in the console of every world, under "You", and a world may draw
   it anywhere in an interface of its own
   ([NSWP-11](11-the-visitors-console.md), "Drawing it yourself"). It says
   where pressing it leads: the host of the visitor's own client.
2. **Pressing it leaves the world.** The world sends the visitor to their
   Airlock ([NSWP-02](02-doors.md), "Which Airlock") with a door back to
   itself and `who=1`. The door is the world's own: the announcement its
   manifest lists for its address, and the address. The visitor's state goes
   on the link as it does through any door (`xr=1`, `joined=1`, `form`,
   `set` and the rest), so they come back as they left.
3. **Their client asks them, in its own way, on its own page.** To sign in,
   to make a profile, to switch to another, or to go back as a guest. The
   world sees none of it.
4. **Their client takes them back through the door,** checked as any door is
   checked. If they chose to go by name and the site has proved it is who it
   says, they arrive with a pass. The world reads it as it reads any arrival.

What keeps this from being the thing rule 1 forbids:

- **A world never draws the sign-in, and never takes a credential.** Not in
  a frame, not in a panel, not "to save a step". The control only leaves.
- **`who=1` is a request, and a link is something anyone can write.** A
  client treats it as "show this visitor their choices". It never signs
  anyone in, never chooses "by name" for them, and never skips the check of
  the door. A visitor goes by name only by pressing the thing that says so,
  on their client's own page, after being told what it gives away.
- **A client never takes the way back from its sign-in page's own address.**
  It keeps the door itself, for that tab, and the way back leads to its
  Airlock and nowhere else.
- **The client's sign-in page says whose it is.** The one real protection a
  visitor has against a world that sends them to a page that only looks like
  their client's is the address of that page, and a sign-in that is bound to
  it (a passkey, a password manager). A client says so on the page, and a
  visitor who is asked for a password anywhere else leaves.
- **A world with no client to go back to offers nothing.** A visitor who
  opened it by itself, with no Airlock named in its manifest, has nobody to
  ask.

A client with no sign-in of its own ignores `who=1` and takes the visitor
back through the door.

In the reference client, the Airlock sends a `who=1` door to its sign-in
page. The page offers "Back to *the world*, by name" to someone signed in,
with what that gives away written under it, and "Go back as a guest" to
anyone. The Airlock then goes straight through to a place the visitor knows,
or shows its whole screen if anything about the door needs to be seen. If
they asked to go by name and can't (the site hasn't proved it is who it
says), the screen is shown and says so.

## In code

```js
import { arrival, portal } from "nswp-sdk";

portal.signIn();   // "who are you here?": leaves for the visitor's own client, and comes back
// The kit's console has the control already, under "You" (addViewControls). In another engine:
// NSWP.signIn(state), and in Godot Nswp.sign_in(). An `identity` event comes when the menu's is pressed.
```

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
