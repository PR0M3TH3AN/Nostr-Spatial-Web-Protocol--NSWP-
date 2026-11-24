# Relays chosen well, the same way everywhere

- **Asked:** 2026-11-24, by the owner, after his Bag read as empty on his
  phone: "Id like to rely on the NIP-66. I thought we already had that in
  the game to avoid issues like this." Then: "we can also use NIP-65 and
  NIP-11 if these would help solve some of these issues." Then, with a
  pasted note proposing "a shared Adaptive Relay Manager, rather than
  having individual worlds maintain hardcoded relay lists": "bitlogin,
  bitportal, the KIT, BitUnlock, BitGate, should all be using these
  system automaticly to get the best relays and reloability at all times.
  Dont you think?" And: "And really dont you think we should just rout
  all this through bitlogin? So we have 1 realy system for all the games
  functions?"
- **Who:** the NSWP builder (the kit's relay code, which BitPortal and
  every world already carry); then BitLogin, BitUnlock and BitGate, each
  saying what it does with relays today.
- **State:** asked. The orchestrator's answer is yes, with what follows.

## What the kit has today

- **NIP-65, in part.** A person's own write relays are read from their
  relay list and used first (`packages/core/src/relay.ts`,
  `packages/sdk/src/relay-book.ts`: `askWell`, `sendWell`), in the order
  this device has found them answering. At most six of them.
- **NIP-66, as a last resort only.** Relays that two monitors agree are
  working are tried when a person's own and the usual relays have all
  failed (`packages/core/src/relay-discovery.ts`). It was built so that
  nothing depends on a monitor. It does nothing where some relay answers
  and the note is simply not on it, which is what happened.
- **NIP-11: nothing.** A relay that wants a sign-in or payment before it
  answers is asked like any other and uses up one of the six.
- **Four usual relays, written into the kit** (`DEFAULT_RELAYS`), which
  every world, BitPortal and the template carry.

## What went wrong, counted on the owner's own bag

One note, sent once to six of 23 relays, kept by one. Nothing sends it
again. A reader asks six, perhaps not that one, and takes the first
"that is all" as "there is none". See
[`phone-no-bar-in-the-arcade-and-an-empty-bag`](phone-no-bar-in-the-arcade-and-an-empty-bag.md).
Finding better relays would not have mended that by itself. Three rules
would have.

## Wanted

First, small, and for the next kit version (they are faults in what is
live):

1. **A note of a person's is not "sent" until enough relays took it.**
   A least number (three), counted from what the relays said, with usual
   relays added until it is met. Fewer: said to the person, and sent
   again at the next look.
2. **"None" is not said on one relay's word.** A look that finds nothing
   goes on to the rest of the person's relays, in waves, before "empty"
   is said; until then the line is "still looking" or "couldn't be
   looked for".
3. **What is found is put back where it is missing.** A device that finds
   a person's newest note on some relays and not on others they write to
   sends it to those (the note is already signed; nothing new is
   signed).
4. **A relay that won't answer a stranger doesn't use up a place.** Told
   from how it answered (it asked for a sign-in, or payment), from
   monitors' notes where there are any (NIP-66 carries it), and from the
   relay's own information (NIP-11) where that can be fetched.

Then, as a written design before code (`docs/plans/relays.md`, the
builder's draft, answered by the orchestrator):

5. One piece of relay code, in the kit's core where it needs no browser,
   that the kit, BitPortal, BitLogin, BitUnlock and BitGate all take, so
   that all of them choose, send, look and repair the same way. No
   project keeps a list of its own beyond a few to start from.
6. Monitors (NIP-66) used for more than the last resort: to order
   relays, to drop ones that are gone, to fill the usual list. Held to
   what the NIP asks: no single monitor believed, nothing needed from
   them for a client to work, and a relay taken from them still has to
   answer before it is leaned on.
7. A person told, in their own menu, how their relay list is doing: how
   many answer, how many refuse a stranger, how many hold their things;
   and offered a shorter list. Changing their list is signed by them,
   never done for them.

## Through BitLogin? (the orchestrator's answer, for the design to settle)

Partly, and the part is worth having.

- **Yes for what a person signs.** BitLogin already signs their notes.
  It should also send them, count who took them, keep what has not
  arrived, and send it again from wherever they next sign in. That is the
  wallet's way already, and it is what the bag lacked: the page that
  asked for the signature sent the note itself, once, and nothing
  remembered that it had reached one relay. One memory of how the
  person's relays are doing would live there too, where today each
  world's address learns it afresh.
- **Not for everything.** A world has to work for a guest and where
  there is no BitLogin at all: the kit is everyone's, and other people's
  clients will carry it. A room's passing traffic should not cross a
  frame on every message. And if every look went through one frame, every
  world would stop when that frame failed to load, and that frame would
  see everything every world reads.
- **Never a server in the middle.** "Through BitLogin" means BitLogin's
  code in the person's own browser, as now. A relay proxy on a server
  would be one place to fail and one place that sees who looks for whom.

So: one relay code for all of them (5 above); a person's own notes
signed and sent by BitLogin, with the kit sending them itself where
there is no BitLogin; public looks and a room's traffic by the kit
directly. The words between a world and BitLogin for "sign this and send
it" are a design question of their own, by names given.

## Must not

- Trust one monitor, or need any monitor for a client to work.
- Send a person's notes to a relay they did not name without that being
  counted and said (the usual relays are named in the kit and shown).
- Tell a monitor, or any relay, who is being looked for beyond what
  asking for their notes already does.
- Use the owner's public key with relays beyond what he asked.
