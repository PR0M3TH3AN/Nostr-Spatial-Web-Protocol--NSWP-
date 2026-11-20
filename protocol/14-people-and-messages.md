# NSWP-14: People and messages

**Status:** Implemented in the reference library (changing a follow list; writing, wrapping and reading a message). Not built in BitPortal yet, and what a world offers is proposed · **Kinds:** none of NSWP's own; Nostr's 3, 13, 14, 1059 and 10050 · **Vectors:** [`people`](../vectors/people.json) · **Code:** core [`people.ts`](../packages/core/src/people.ts), [`message.ts`](../packages/core/src/message.ts)

Following someone, and writing to them privately, are Nostr's own and are
used here as they are. Who a visitor follows in an NSWP client is who they
follow in every Nostr client, and a message sent from one is read in any
other that speaks NIP-17. NSWP adds no kinds. What it adds is where these
things may be done, and how a follow list is changed without losing it.

## Three rules

1. **Only the visitor's own client does these.** Following, unfollowing,
   and sending or reading a private message are done where the visitor is
   signed in as themselves: at their home. A world never does them.
2. **A world can't have them signed.** A follow list is one of the kinds a
   world's signer refuses ([NSWP-10](10-identity.md), "careful"), and a
   private message or any of its wrappings is refused whatever anyone says
   ("never"). Neither changes here.
3. **A follow list is changed, never rewritten.** A client that writes one
   from an old copy, or from nothing, wipes out everyone its visitor
   followed.

## Following (NIP-02, kind 3)

A follow list is one note, replaced whole each time. So a client that
changes one:

- **Starts from the newest it can find:** asked for from the person's own
  relays ([NIP-65](https://github.com/nostr-protocol/nips/blob/master/65.md))
  and the usual ones, each signature checked, the newest taken.
- **Changes one line.** Following adds a `p` tag; unfollowing takes out
  every `p` tag naming that person.
- **Keeps the rest as it was, in its order:** everyone else, the relay and
  the name each was written with, tags of other kinds, and the content,
  where older clients keep their relays.
- **Writes one newer than the one it replaces,** so that a relay keeps it.
- **Refuses when it found no list.** "No list was found" is not "follows
  nobody": a relay may have been down. A client writes a first list only
  when its visitor has said they follow nobody yet.
- **Sends it where it will be found:** the person's own relays and the
  usual ones.

A follow is public. Anyone can read who a person follows, and a client says
so the first time.

## Private messages (NIP-17)

A message is three notes, one inside another:

| | Kind | Signed by | Says |
|---|---|---|---|
| The message | 14 | Nobody. It is never published as itself | Who wrote it, who it is to, the words, when |
| The seal | 13 | Its writer | Nothing: no tags, and the message encrypted (NIP-44) to its reader |
| The wrap | 1059 | A key made for this one message and thrown away | Who it is for (a `p` tag), and the seal encrypted to them |

What a relay holds says who a message is for. It doesn't say who sent it,
what it says, or exactly when: a wrap's time is moved back by up to two
days.

**Sending one.** The writer's client writes the message, has their signer
encrypt it to the reader and sign the seal, and wraps the seal itself with
a throwaway key. It does this twice: once for the reader, and once for the
writer, so that they can read back what they sent. Each wrap goes to the
relays its reader has said their messages reach them at (kind 10050).

**What a reader checks, in order:**

1. The wrap: a real signature, kind 1059, a `p` tag naming the reader.
2. The seal inside: a real signature, kind 13, no tags at all.
3. The message inside: kind 14, **written by the key that signed the
   seal**. A message that says it is from one person, sealed by another, is
   somebody passing themselves off. It is dropped.
4. That the reader wrote it or is one of the people it is to.
5. That it has words. Its id is worked out from what it says, never taken
   from what it claims.

**The words are plain text,** 2,000 characters at most as this library
writes and shows them, with new lines kept. Nothing in a message is a link
that opens, a picture that loads, or an address that is fetched.

**Where messages reach someone (kind 10050).** A short list of relays, of
the person's own choosing. Someone who has published none can't be sent a
message this way, and a client says so, never falling back to somewhere the
reader isn't looking. A client offers to write its visitor's list the first
time they open their messages, from their own relays, with their say.

**Not here:** the older kind of message (NIP-04, kind 4), which tells every
relay who is writing to whom; files in messages (kind 15); and a
conversation among several, which a reader recognises and this version
doesn't show.

## Messages from people the visitor doesn't know

Anyone can wrap a message for any key. So a client shows what comes from
the people its visitor follows, and from anyone the visitor has written to,
as messages. Everything else waits apart, as a request: shown by the
sender's key and name only until the visitor opens it, and never counted in
anything that asks for their attention. Someone the visitor has blocked is
never shown.

## What a world may offer (proposed)

A world shows a card about a person ([NSWP-10](10-identity.md), "Who
someone is"). Beside muting and blocking, it may offer **Follow** and
**Message**. Neither is done by the world:

- Each is a way to the visitor's own client, with the person's key and a
  door back to the world, as signing in from a world is
  ([NSWP-10](10-identity.md), "Signing in from inside a world"). The
  visitor's client shows the person again, from their own profile, and the
  visitor presses there.
- A world is never told who its visitor follows, and doesn't ask a relay.
  So a card in a world doesn't say "following".
- A link's word is something anyone can write. The client that receives
  one shows a person and a choice. It follows nobody and sends nothing
  because a link said so.

## What it gives away

- **Following:** who follows whom is public, as everywhere on Nostr.
- **A message, to a relay:** that this key has been sent something, and
  roughly when. Not by whom.
- **A message, to its reader:** who wrote it and when, which they could
  show to anyone, though nothing they hold proves it to a stranger: the
  message itself carries no signature.
- **To a world:** nothing. It isn't asked and isn't told.

## In code

```ts
import { changeFollows, newestFollows, buildMessage, sealTemplate, wrapSeal, readSeal, readMessage } from "@nswp/core";

// Following: the newest list, one line changed, signed by the visitor.
const next = changeFollows(newestFollows(events, me), { add: theirKey, now: Date.now() / 1000 });

// Sending: the signer seals and signs; the client wraps with a throwaway key.
const written = buildMessage({ from: me, to: theirKey, text, now: Date.now() / 1000 });
const seal = await signer.signEvent(sealTemplate(await signer.nip44.encrypt(theirKey, JSON.stringify(written)), Date.now() / 1000));
const wrap = wrapSeal(seal, theirKey, { now: Date.now() / 1000 });

// Reading: the signer opens each layer; the client checks what came out.
const sealIn = readSeal(await signer.decryptEvent(wrapIn));
const message = sealIn && readMessage(await signer.decryptEvent(sealIn), sealIn, me);
```

## Proposed, not built

- **All of it in BitPortal:** people and messages at home, on a phone, at a
  desk and in a headset, and the two ways home from a world's card.
- **Following from inside a world without leaving it:** the visitor's
  signer changing the list itself, on a surface it draws, with the
  visitor's say each time. This is the "careful" tier of
  [NSWP-10](10-identity.md), which no signer has built.
- **Word of a new message while in a world.** A world can't be told, so it
  would have to come from the visitor's signer or their client.
- **Conversations among several, and files.**
