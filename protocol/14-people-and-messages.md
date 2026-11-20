# NSWP-14: People and messages

**Status:** Following is implemented in the reference library and kit (a person's card, and a Following tab in the menu every world has; the signer's side as a function); no signer has built its side for worlds yet, BitLogin's included. Messages are implemented in the library only · **Kinds:** none of NSWP's own; Nostr's 3, 13, 14, 1059 and 10050 · **Vectors:** [`people`](../vectors/people.json) · **Code:** core [`people.ts`](../packages/core/src/people.ts), [`message.ts`](../packages/core/src/message.ts), [`signing.ts`](../packages/core/src/signing.ts); SDK [`people.ts`](../packages/sdk/src/people.ts), [`signer.ts`](../packages/sdk/src/signer.ts)

Following someone, and writing to them privately, are Nostr's own and are
used here as they are. Who a visitor follows in an NSWP client is who they
follow in every Nostr client, and a message sent from one is read in any
other that speaks NIP-17. NSWP adds no kinds. What it adds is where these
things may be done, and how a follow list is changed without losing it.

## Three rules

1. **A world is a Nostr client, and is trusted as one: when its visitor
   says so.** Following can be done from inside a world the visitor has let
   do it ([NSWP-10](10-identity.md), "Asking for more"). Nothing is allowed
   by default, and nothing by the world's own word.
2. **A world never builds a follow list.** It hands the visitor's signer
   their newest list and one change. The signer makes the change and signs.
   So a world can follow or unfollow one person at a time, and can't have a
   list of its own making signed.
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

## Following from inside a world

A world shows a card about a person ([NSWP-10](10-identity.md), "Who
someone is"). Beside muting and blocking it offers **Follow**, for someone
who came by name, to a visitor who is signed in there.

1. **The first press in a world asks.** The world sends `want` with
   `follows` and opens the signer's window, where the visitor is asked
   whether this world may change who they follow. Until they have said yes,
   the world asks no relay who they follow, and the control says "Follow".
2. **The world finds their newest list:** on their own relays and the usual
   ones, and on the device.
3. **It hands the signer that list and the one change** (`follow`, with
   `list` and `add` or `remove`). `list` is null only where relays answered
   and had none, and the visitor pressed a second time to start one.
4. **The signer checks and signs.** The list must be the visitor's own,
   with a real signature. It makes the one change (`followForWorld`) and
   signs the result. It marks nothing on it: a follow list that named the
   world it was last changed in would say where its owner had been.
5. **The world checks what came back** is that list with that change and no
   other, and sends it to the visitor's relays.

**Who they follow, in the menu.** Once a visitor has let a world see to
who they follow, the menu's **Following** tab lists them by name, there as
at their home: choose one to see who they are and to unfollow them, or
follow someone by their key (copied, or typed on a headset's keyboard).
Names come from each person's own profile, asked of relays a page at a
time, for the people on show, and kept on the device.

**What a signer does beside that:**

- Counts them: six a minute and sixty an hour for one world, the pace of a
  person.
- Remembers the time of the newest list of theirs it has signed or been
  handed, and refuses one older than that, or none at all once it has seen
  one. A world can't take a visitor back to an old list.

**What trusting a world with this means.** It can follow and unfollow
people for the visitor without asking each time, as any Nostr client they
use can. It can't sign anything else, read anything, or write a list of its
own. A signer that has never seen the visitor's list has to take a world's
word that there is none: a world that lied could start a new list over an
old one. That is the trust the visitor gives, and why it is asked for by
name, one world at a time.

## What it gives away

- **Following:** who follows whom is public, as everywhere on Nostr.
- **A message, to a relay:** that this key has been sent something, and
  roughly when. Not by whom.
- **A message, to its reader:** who wrote it and when, which they could
  show to anyone, though nothing they hold proves it to a stranger: the
  message itself carries no signature.
- **To a world the visitor let follow for them:** who they follow, which is public already. To any other world: nothing.

## In code

```ts
import { changeFollows, newestFollows, buildMessage, sealTemplate, wrapSeal, readSeal, readMessage } from "@nswp/core";

// Following, in a world built with the kit: all of the above.
const people = worldPeople();                      // nswp-sdk/three
const done = await people.follow(theirKey, "Ada"); // { ok, why, said }

// Following, in a client with its own signer: the newest list, one line changed.
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

- **BitLogin's side of `want` and `follow`.** Until a signer answers them,
  Follow in a world says where following is done.
- **People and messages at the visitor's home,** in BitPortal.
- **Messages from inside a world:** a second name on the list a world may
  ask for (`messages`), with the signer sealing and opening each one.
- **Conversations among several, and files.**
