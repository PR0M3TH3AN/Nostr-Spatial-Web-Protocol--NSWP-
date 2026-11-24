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
- **State:** the four small mends (with two more found by BitPortal's
  runs) are ordered from the builder for kit 0.90.0, on the owner's word
  after they were put to him, 2026-11-24: "Yes please do the fix so its
  more consistent across all worlds and all users." The builder sends a
  plan with its numbers first. The written design for one relay code in
  every project comes after. The orchestrator's answer to "dont you
  think?" is yes, with what follows.

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

## What BitLogin does today (its session's report, read from its code at 4310d13, not run)

- **It sends none of what it signs for a site.** A person's notes, world
  saves, guest-list changes and passes are signed by BitLogin and handed
  back; the site or the kit sends them. That is the gap behind the bag.
- **Its own records it sends well:** the wallet, the files index,
  receipts and the pay limit go to the person's own write relays plus
  BitLogin's built-in list, at most 16; a record is saved once two
  relays confirm it; one not yet taken by two is kept in the browser,
  marked, and sent again at every opening. A read counts only when at
  least half the relays asked answered to the end: one relay's "that is
  all" is never "none" there.
- No ranking of relays; one that refused or never answered is not waited
  for, for three minutes. No NIP-66. NIP-11 only to check its vault
  relays' size limits. A relay that asks for a sign-in never counts
  toward "saved": the wallet's pools answer no such asking.
- **"Sign this and send it" as one act** would be a new thing for a site
  to ask for, with words of its own; a queue sealed in the signer's own
  storage for each site, tried again each time the signer loads; the
  site told how many relays took it and never which; the limits there
  are today. Its guess: two to four days with tests. Nothing built.

## What went wrong, counted on the owner's own bag

One note, sent once to six of 23 relays, kept by one. Nothing sends it
again. A reader asks six, perhaps not that one, and takes the first
"that is all" as "there is none". See
[`phone-no-bar-in-the-arcade-and-an-empty-bag`](phone-no-bar-in-the-arcade-and-an-empty-bag.md).
Finding better relays would not have mended that by itself. Three rules
would have.

## The builder's plan, and the names given (2026-11-24)

The builder found two more things in the kit: a relay list is cut to its
first 8 write relays, so with 23 the one holding a note may never be
asked; and seven places read or send a person's own note as the bag
does (follows, saves, scores and achievements, the room's notes, the
front room, and a person's look, which asks only the usual four).

Given by the orchestrator (in `docs/fleet.md` with the code):
`RELAY_PICK.listed` 24, `wave` 4, `waveMs` 3000, `took` 3, `mend` 6,
`usual` 1; `closed` on what is remembered of a relay; `askOwn`, answering
found, none or unreached. With five rulings: a relay's asking for a
sign-in is not a refusal by itself (three of the owner's relays ask and
then answer); closed to reading and closed to writing are kept apart;
waves, the put-back and the retries are for the visitor's own notes on
their own device, and someone else's note gets one look; a person's own
note always goes to at least one usual relay too; the visitor's own
relay list is kept on their device once known and a miss is never kept.
Two pull requests for kit 0.90.0: the helper with the bag first, then
the other readers and senders.

Approved the same hour for the Arcade's bar on a phone: where the
device's main pointer is touch, the quiet form keeps the bar.

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
   Where no relay answered at all, the line is "couldn't be looked
   for", never "empty": today it is "empty" (BitPortal, run).
3a. **A person's relay list that came late is not a miss kept.** A world
   waits two and a half seconds for it and then asks only the usual
   relays, and keeps that for ten minutes, so "Look again" asks the same
   wrong relays (BitPortal, run). The list is waited for while the usual
   relays are asked, used when it comes, kept on the device once known,
   and a miss is not kept.
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
5a. With it, one answer to which "usual" relays are meant: BitPortal's
   home uses the relays a visitor set in its Settings, a world the kit's
   four, so the two can write and look in different places (BitPortal,
   read).
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
