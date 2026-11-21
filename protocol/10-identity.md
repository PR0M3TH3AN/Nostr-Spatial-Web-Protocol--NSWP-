# NSWP-10: Who someone is

**Status:** Passes, names and pictures in rooms, the proven mark, profile cards, signing in at a world in the signer's window, a pass from the signer and posting from a world are implemented, with signing in from inside a world and being signed in everywhere for a client that names no signer; hosted rooms that check passes, and taking a pass back early are proposed · **Kinds:** 27300 (pass) · **Schema:** [`pass`](../schemas/pass.schema.json) · **Vectors:** [`passes`](../vectors/passes.json) · **Code:** [`pass.ts`](../packages/core/src/pass.ts), SDK [`room.ts`](../packages/sdk/src/room.ts)

A world is someone else's website. It must never hold a visitor's key, and it
doesn't need to: what it needs is to know, when the visitor wants it known,
which identity is standing in the room. This document says how that is proved
without the key ever leaving the visitor's own client.

## Four rules everything else follows from

1. **A world never gets a key that matters.** No world asks for one, and no
   client gives one. A world that asks a visitor to sign in is doing
   something this protocol has no use for ([NSWP-09](09-what-a-world-owes.md)).
   What a world may do is open a window at the visitor's own sign-in
   address, or offer the way to their own client: either asks, and the
   world doesn't ("Signing from a world" and "Signing in from inside a
   world", below).
2. **Going by name is the visitor's choice, made in their own client and
   kept by it.** A client may take signing in as that choice for every world,
   if it says so plainly where they sign in and lets them go as a guest
   whenever they like ("Signed in everywhere", below). It never happens for
   a site that hasn't proved it is who it says, or hasn't adopted the
   protocol.
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
| `name` | Optional. What the visitor chose to be called: one line, at most 48 characters. A client that knows their Nostr profile uses the name in it |
| `picture` | Optional. Where their picture is: an `https` address, at most 300 characters. The one in their Nostr profile ("Pictures", below) |
| `about` | Optional. A few words they wrote about themselves: one line of plain text, at most 280 characters. The start of the `about` in their Nostr profile ("Who someone is", below) |

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

## Pictures

Nostr is where people already have a name and a face. A visitor who goes by
name brings both.

- **A picture comes from a pass and from nowhere else.** The visitor's own
  client reads it from their Nostr profile (kind 0, `picture`) and puts its
  address on the pass. Their identity key signs the pass, so the picture is
  theirs: nobody is given a face on someone else's say-so. A guest has none.
- **Only an `https` address is a picture.** Anything else is ignored, and
  the pass still stands. A world never asks a relay about its visitors to
  find one: it would be a way to follow them, and the pass already says.
- **A reader shows it with the name,** as a small round badge over it. It is
  also a button: choosing the picture chooses the person, as choosing them
  from a list does, and puts what can be done about them (their key, muting,
  blocking) in front of the visitor.
- **What is fetched is not trusted.** Nothing of the visitor's is sent with
  the request, there is a limit on its size, and it is only ever drawn,
  redrawn small. A picture that can't be read by a page (the place that
  holds it doesn't allow it) is simply not shown.
- **Showing pictures costs the viewer something, and is theirs to turn
  off.** A picture is fetched from wherever its owner keeps it, so that
  place learns the address of everyone who is shown it. Someone can put
  their picture on a server of their own for exactly that. It is the same
  as reading Nostr in any client, and a visitor who would rather not has one
  switch, which goes with them from world to world (`pictures`,
  [NSWP-11](11-the-visitors-console.md), "Settings that travel"). Off,
  nothing is fetched.
- **A picture proves nothing.** Like a name, anyone can use any picture.
  What proves is the pass, and what identifies is the key.

## Who someone is

Choosing a person (from the list of people, or by the picture over their
head) shows a card about them: their picture, their name, how they are known
here, the short form of their key with the whole of it one press away, and
what they wrote about themselves.

- **Everything on it comes off their pass.** A world never asks a relay
  about a visitor to fill a card in: that would be a way to follow them. So
  a card says what the person's own client chose to bring, and nothing else.
  A guest's card has a name the room made up, and says that nobody has
  vouched for who they are.
- **`about` is their own words, and is shown as theirs.** Their key signed
  it, so nobody put it there for them; and that is all the signature says.
  Anyone can write anything about themselves, a title or an office
  included. A reader sets it apart as a quotation, never as a fact about
  them, and never beside anything that reads as the world's or the client's
  own word.
- **It is plain text.** A reader makes it one line, drops what reorders or
  hides text, and cuts it to 280 characters, whatever was signed. Nothing in
  it is a link that opens, a picture that loads, or an address that is
  fetched.
- **The key is what tells two people apart.** A name is not unique and a
  picture can be copied. The card shows the short form of the key, and
  gives the whole of it to copy.
- **What can be done about them is beside it:** muting their voice or their
  music, blocking them. Those are the viewer's alone, and nobody is told.

Not on a pass, and so not on a card: a web address, a NIP-05 name, who they
follow. A NIP-05 name on a pass would be the holder's own claim and nothing
more, since the pass is theirs; checking one means asking the domain it
names, which tells that domain who is looking.

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

A client that names no signer may offer, on each trip to a world that has
adopted the protocol:

| Choice | What goes with the visitor |
|---|---|
| By name | A pass and its session key, and their look |
| As a guest, wearing their look | Their look ([NSWP-05](05-looks.md)) |
| Plain | Nothing |

The reference client names a signer, and offers the last two: a guest's
look, or plain. It never offers "by name". It says at the door that to be
known by name a visitor signs in at the world ("A pass from the signer",
below). The rest of this section is for a client that offers all three.

- **"By name" is offered only to someone already signed in.** The Airlock
  never asks anyone to sign in: a sign-in prompt in the middle of a crossing
  is exactly what a fake Airlock would show. If the session can't sign just
  then, the visitor is told, and chooses again; they are never sent on as
  something they didn't pick. A visitor who wants to sign in goes to the
  client's sign-in page, which is a page of its own and says so.
- **Only for a verified world.** A pass names the visitor's key for good, so
  it goes only to a site that has proved it is the one its announcement says.
- **The choice is the visitor's and it stands.** A client may send someone
  signed in by name until they say otherwise ("Signed in everywhere",
  below). Someone who isn't signed in is never sent by name.
- **A new session key every trip.** Two passes can't be linked by their
  session keys, only by the identity that signed them.

## Signed in everywhere

A client that names no signer may have a visitor sign in once, in that
client, and be signed in wherever they go. No world has a sign-in of its
own, so there is nothing to sign in to one by one: the client hands each
world a pass as they arrive ("The pass", above), and the next world another.

A client that does this:

- **Says so where they sign in,** with what it gives away: each world they
  visit that has proved who it is learns their public key, and so do the
  people in any room they join there.
- **Gives the way out beside it.** One switch, in the visitor's own client,
  to go to worlds as a guest while staying signed in. And the choice at the
  Airlock for any one trip.
- **Still never sends a pass to a site that hasn't proved it is who it
  says,** or that hasn't adopted the protocol. Signed in everywhere means
  everywhere that can be trusted with a name.
- **Still makes a new session key for every trip.**
- **Never takes it from a link.** Nothing a world or a link says makes
  someone signed in, or by name.

Where the client names a signer, a pass it hands over counts in a world only
once the visitor has signed in there ("One sign-in", below), and such a
client need hand over none: the signer makes it ("A pass from the signer").
The reference client names one and hands over none, so this section
describes a client that doesn't name one.

The reference client did this until 0.30.1, and doesn't now. Someone signed
in to it signs in at each world, once, in their sign-in address's window.
The tick on its sign-in page, "Go by my name in my own room", is for the
client's own room and for no world.

## Signing in from inside a world

A visitor shouldn't have to go home to sign in. And no world may show a
sign-in. Both hold, because what a world offers is not a sign-in: it is the
way to the visitor's own client, and back. This is the way for a client
that names no signer. Where one is named, a visitor signs in without
leaving the world ("Signing from a world" and "One sign-in", below).

1. **The world has a control that says who the visitor is here,** from what
   it was told on arrival and nothing else: "You are a guest here. Sign in",
   or "Here as Alice. Switch profile, or go as a guest". The reference kit
   puts it in the console, under "You", wherever the visitor's client named
   no signer, and a world may draw it anywhere in an interface of its own
   ([NSWP-11](11-the-visitors-console.md), "Drawing it yourself"). It says
   where pressing it leads: the host of the visitor's own client.
2. **Pressing it leaves the world.** The world sends the visitor to their
   Airlock ([NSWP-02](02-doors.md), "Which Airlock") with a door back to
   itself and `who=1`. The door is the world's own: the announcement its
   manifest lists for its address, and the address. The visitor's state goes
   on the link as it does through any door (`xr=1`, `joined=1`, `form`,
   `set` and the rest), so they come back as they left.
3. **Their client asks them, in its own way, in its own place.** To sign in,
   to make a profile, to switch to another, or to go back as a guest. The
   world sees none of it. That place may be somewhere to stand, reached by
   the crossing's room like any other ([NSWP-02](02-doors.md), "The
   chamber"), so that the visitor is never dropped from a world onto a page.
   What they type is still typed into the client's own page, under its own
   address.
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
page, which is drawn as a place: the client's own ground and sky, the
crossing's room opening as the visitor arrives and closing as they leave,
and the page on a panel in front of them. In a headset the panel is seen on
the headset's flat screen: an immersive session can't show a page, and no
client can change that. Nothing is typed on that page. It has a button that
opens a window at BitLogin's own address, and the visitor signs in there.
The page offers "Back to *the world*", and never "by name": the reference
client sends no pass, and to be known by name a visitor signs in at the
world ("A pass from the signer", below). The Airlock then goes straight
through to a place the visitor knows, or shows its whole screen if anything
about the door needs to be seen. A world built with the reference kit
doesn't send the reference client's visitors this way: where a signer is
named, the control is not shown ("One sign-in", below).

## Signing from a world

A pass lets a world know its visitor by name. It doesn't let them sign
anything as themselves: a Nostr note is theirs only if their own key signed
it, and a world is never given that key. So a world asks.

**The signer.** A client that offers signing has two pages: a signer and a
sign-in window. A world embeds the signer as a hidden frame. It has no
interface. The world can't read it or script it, and nothing is ever typed
into it.

**Where it is, is the client's to say.** A client names it in the arrival
(`signer`, [NSWP-03](03-arrival.md)): an `https` address, with the signer at
`signer/` and the window at `connect/` under it. A client that names none
keeps them beside its Airlock: for an Airlock at
`https://client.example/go/`, at `/signer/` and `/connect/`.

So the signer need not be the client's own. One place that does nothing but
sign in is a smaller thing to trust than a whole client, and one address is
one sign-in for every client and site that uses it. The reference client
names BitLogin's own site, `https://bitlogin.network/`.

**Someone no client brought has no client to say.** They opened the
world's address themselves: from a bookmark, a link a friend sent, a phone's
home screen. A world may name the signer it offers them, as it names an
Airlock for them ([NSWP-02](02-doors.md), "Which Airlock"). Then signing in
is the same thing in that world however a visitor came, which is what a
visitor expects and what the reference worlds do: they offer BitLogin's.
A world that names none has no sign-in for such a visitor but the way to a
client ("Signing in from inside a world"). A visitor a client brought is
never given the world's choice in place of their client's: a client that
names no signer has said how its visitors sign in, and that stands.

An arrival is something anyone can write, so a link can name a signer of
its own making, as it can an Airlock. What that gains is little, and a
world keeps it so:

- **A world says whose window will open, before it is pressed:** "Sign in,
  at *that address*". It is the address the client named,
  never a development server's copy of it.
- **A signer the visitor never signed in at can sign nothing as them.** A
  world checks what comes back against the key the signer said it holds,
  and a stranger's signer holds a stranger's key.
- **The window is where a password could be asked for,** and its address
  bar is what the visitor reads. A world never draws one itself.

**It starts locked, in every world.** A browser walls off what a site
stores when that site is embedded in another, and a signer never uses what
it could reach anyway. Unlocking it for one world is the visitor's doing,
in the client's own window:

1. The world opens the window from a press. It is a window of its own, with
   an address bar, and the world can't read it.
2. If the visitor isn't signed in at their client, they sign in there.
3. The window says hello to every frame of the page that opened it,
   addressed to the client's own origin. Only the client's own signer can
   hear that. The signer answers with the world it is embedded in, **as the
   browser reported it**, and a throwaway key.
4. The window shows that address and what the world may do, and waits.
5. On Allow, it hands the signer a key that can only sign, sealed to the
   throwaway key, and closes.

A world posing as the signer hears nothing, so the window finds no signer
and offers no Allow. A world can open a look-alike window on an address of
its own: the address bar tells them apart, and a password manager fills a
password in only at the address it was saved for.

**The window, and a panel in its place.** A window opening gives up a
filled screen. Where a world is shown inside a client that keeps the screen
(NSWP-02, "A client that keeps the screen"), and that client can show the
sign-in address's own panel, the world asks the client for the panel at the
visitor's press and opens no window (kit 0.63.0: `signer.unlock()` does
whichever applies, and `signer.panel` says which, for the words). The
panel is the window's own page, in a frame the client draws above the
world, and the steps above are the same: it finds the signer in the world
below it, the signer says which world embeds it as the browser reported
it, and on Allow the key is handed over. Three things are different, and
a world should know them:

- **The world never frames the panel itself.** A page that frames a
  question can cover it, shrink it or slide it under a press. Only the
  client does, by name on the sign-in address's own list, and a world
  can't script the page above it.
- **A panel has no address bar,** and a filled screen shows none anyway.
  What tells the real one from a copy a world might draw is a passkey,
  which can't be given to a copy, and a password manager, which fills a
  password in only at the address it was saved for. That is the sign-in
  address's to say to its visitor, and BitLogin does.
- **It is used only where it can work:** the client's panel must be for
  this world's own signer's address, and a panel that doesn't come up is
  given up on for that page, so the next press opens the window.

**What a world says to the signer**, as messages between the two pages,
each `{ "nswp": "nswp-signer", "v": 1, "t": ..., "id": ... }`:

| From the world | The signer answers |
|---|---|
| `state` | `state`: `unlocked`, and once unlocked `pubkey`, `name`, `picture`, `about`, `until`, `remembered`. Said again, unasked, whenever it changes |
| `sign`, with `event`: `kind`, `content`, `tags` | `signed`, with the whole signed note; or `refused` |
| `pass`, with `session`: a session public key | `signed`, with a room pass the signer wrote; or `refused` ("A pass from the signer", below) |
| `lock` | `state`, locked. The visitor's own way to end it, from the world's menu |
| `save`, `find`, `open` | A save kept, found or opened for this world and no other: [NSWP-12](12-saves.md) |
| `want`, with `more`: a list of names | `state`. It approves nothing: the signer remembers it for its own window ("Asking for more", below) |
| `propose`, with `event`: `kind`, `content`, `tags`, of kind 0, 5 or 10002 | `asking` at once; then, under the same `id`, `signed` with the whole signed note, or `refused` ("Asking the person", below) |
| `wallet` | `asking` at once; then, under the same `id`, `wallet` with `uri`, or `refused` ("Asking the person", below) |
| `pay`, with `invoice`: a Lightning invoice the world made | `asking` at once; then, under the same `id`, `paid`, with `preimage` where there is one, or `refused` ("Asking the person", below) |
| `file-save`, with `name`, `type`, `bytes`, and `private` (true unless said) | `asking` at once; then, under the same `id`, `file-saved` with `name`, `size`, `private`, and `url` for a public file; or `refused` ("Asking the person", below) |
| `file-pick` | `asking` at once; then, under the same `id`, `file` with `name`, `type`, `bytes`, and `url` for a public file; or `refused` ("Asking the person", below) |
| `tip`, with `sats`, and `to` (a person's key) or nobody (this world itself) | `asking` at once; then, under the same `id`, `paid`, or `refused` ("Tips, buying, and receipts", below) |
| `buy`, with `listing`: a listing's coordinate | `asking` at once; then, under the same `id`, `bought` with `receipt`, and `delivery` where something is released; or `refused` ("Tips, buying, and receipts", below) |
| `have`, with `listing` | At once, and with no question put to anyone: `receipt` with the visitor's receipt, or `none` ("Tips, buying, and receipts", below) |
| `follow`, with `list` and `add` or `remove` | `signed`, with the visitor's new follow list; or `refused` ([NSWP-14](14-people-and-messages.md)) |
| `seal`, with `to` and `text` | `sealed`, with the message as written and its two seals; or `refused` ([NSWP-14](14-people-and-messages.md)) |
| `unwrap`, with `event`: a wrapped message a relay gave it | `message`, with what was inside; or `refused` |
| `reach`, with `relays` | `signed`, with the list of where the visitor's messages reach them (kind 10050); or `refused` |
| `score`, with `world`, `board` and `score` | `signed`, with the visitor's score for that world's board; or `refused` ([NSWP-15](15-scores.md)) |
| `achieve`, with `world`, `achievement` and `title` | `signed`, with a note that the visitor holds that achievement of that world; or `refused` ([NSWP-16](16-achievements.md)) |

A world asks `state` once the frame has loaded, and again a few times: the
answer is how it knows a signer is there. A signer never sends anything to
a page whose address it doesn't know. Where the browser tells it which page
embeds it, it may say `ready` to that page, unasked. A refusal never says
why.

**What it signs for a world**, by kind:

| | Kinds | When |
|---|---|---|
| Ordinary | A note (1), a reaction (7) | Once the visitor has allowed that world |
| Careful | Their profile (0), who they follow (3), a deletion (5), their relay list (10002), and anything not named here | `sign` refuses them. Who they follow is changed by `follow`, for a world they let ("Asking for more"). A profile, a deletion and a relay list can be put to the visitor themselves, each time ("Asking the person") |
| Never | Private messages and their wrappings (4, 13, 14, 15, 1059, 1060), passes and room signals (27300, 27301), proofs of identity to a relay or a server (22242, 27235), wallet and remote-signer traffic (13194, 23194, 23195, 24133), application data (30078) | `sign` refuses them, whatever anyone says. A message is sent and read by `seal` and `unwrap`, for a world they let ("Asking for more") |

- **The note is the signer's to finish.** It sets the time itself, and adds
  `["nswp:world", "<the world's origin>"]`, dropping any such tag the world
  wrote. So a note signed from a world says which world asked.
- **Limits:** 8,000 characters, 60 tags; three notes a minute and twenty
  an hour for one world: the pace of a person. A world the visitor allowed
  still can't pour notes out under their name. A pass is counted apart, so
  signing in doesn't use up a post: two a minute and ten an hour.
- **How long it lasts is the signer's to say,** and it says so in `until`.
  The visitor locking it ends it at once. A signer may remember that a
  world was allowed, so the visitor isn't asked again each time its page is
  loaded: BitLogin's does, for thirty days on that device, keeping what it
  needs encrypted in storage the world can't read, and counting signatures
  across page loads. A signer that remembers nothing ends when the page
  does. It may say which, in `remembered`: false means this visit only,
  and a reader tells the visitor so, so that being asked again is no
  surprise.
- **A world checks what comes back** like anything else that arrives: a
  real signature, by the key the signer said it holds, on the note that was
  asked for, marked for this world.
- **The world sends the note to relays itself.** The signer reaches no
  network.

## Asking for more

A world is a Nostr client like any other, and a visitor may trust one with
more than a note and a reaction (owner's decision, 2026-11-20). What that
trust is given to, and how, is the visitor's:

- **Nothing more by default.** A world the visitor unlocked can have a note
  and a reaction signed, as before. Everything here is beside that.
- **A world asks, by name.** It sends `want` with `more`, a list of names
  from a short closed list. Each is one thing a person can be asked in a few
  plain words. None is "sign whatever I hand you".

  | Name | What the visitor is asked | What the world can then do |
  |---|---|---|
  | `follows` | "Change who you follow" | Follow and unfollow people for them, one at a time, with `follow` |
  | `messages` | "Send and read your private messages" | Have a message to one person written and sealed (`seal`), have one that was sent to them opened (`unwrap`), and have the list of where their messages reach them signed (`reach`) |

- **The visitor is shown it in their signer's own window,** the same one
  that unlocks it, in the signer's words, for that one world. `want`
  approves nothing. A world that was unlocked for less is shown the rest
  the next time the window is opened, and can't be given it any other way.
- **The signer says what was allowed** in `state`, as `more`. A world asks
  for nothing that isn't there.
- **A signer may say what it offers** in `state`, locked or not, as
  `offers`: the names it has a question for. A world doesn't ask for a name
  that is missing, or open the window for it: it tells its visitor their
  sign-in address doesn't offer that in worlds yet. A signer that says
  nothing of `offers` is asked, as before.
- **Ask when it is needed, not on arrival.** The reference kit sends `want`
  when the visitor presses the thing that needs it, and opens the window
  from that press.
- **It lasts as long as the unlock does,** and locking ends it.
- **A world never holds what does the work.** For `messages` the signer
  writes, seals and opens each message itself. The world is handed words to
  show and sealed notes to send: never a key, and never a way to encrypt or
  decrypt anything else.
- **What is never on the list:** private keys, proofs of identity to a
  relay or a server, passes, wallet and remote-signer traffic, application
  data. Those stay refused whatever anyone says.

A signer that offers none of this says nothing of `more`, and refuses
`follow`. A world then says that following is done at the visitor's own
client.

**Ways to unlock, the most seamless first.** Already unlocked for this
world; the visitor's passkey, without leaving the world; a signer of their
own (a browser extension, a phone that approves); their password in the
client's window; and, where no window can open (a headset), the trip by the
crossing's room, which brings back a pass and not a signer, from a client
that sends one. **Built: the window.** In a headset the reference kit says
that none can open there, and to leave the headset view for a moment to
sign in. The rest are in
[`docs/plans/signing-in-worlds.md`](../docs/plans/signing-in-worlds.md).

The reference signer is BitLogin's own site. The key moves from the
window's crypto worker to the signer's without passing through either page,
and the signer remembers a world the visitor allowed (BitLogin's
`docs/sign-in-window.md`).

## Asking the person

**Status:** the kit's half is implemented (kit 0.64.0: `signer.propose`,
`signer.wallet`; 0.65.0: `signer.pay`). BitLogin's half is built and not
yet live. One thing in the kit uses it: deleting your own post (0.66.0,
"Posting from a world"). Nothing asks for a wallet, a payment or a file
yet (`signer.saveFile`, `signer.pickFile`: 0.67.0).

Some things a visitor should be asked each time, in words, by their own
sign-in address, and never have done for them on a world's say: a change
to their profile, a deletion, a change to their relay list, a payment,
and a wallet for a world to spend with. `sign` refuses the first three and
always will. A world can put them to the visitor instead:

1. At the visitor's press, the world sends `propose` (a note of kind 0, 5
   or 10002), `pay` (a Lightning invoice it made) or `wallet`.
2. The signer answers `asking` at once, or `refused`. It has signed
   nothing: it holds the question for the sign-in address's own page.
3. On `asking`, the world has that page shown, exactly as for signing in:
   the client's panel where there is one, the window otherwise ("The
   window, and a panel in its place"). The page shows the visitor what is
   asked, in words, and who it is asked as.
4. At their press there, the answer comes back under the same `id`:
   `signed` with the whole note, `paid`, or `wallet` with a connection;
   or `refused`.

- **A closed list of kinds:** 0, 5, 10002 (`PROPOSE_KINDS`). Not who they
  follow: a whole list signed for a world could unfollow everyone, so that
  stays one person at a time (`follow`). Never a never-kind, and nothing
  unnamed.
- **A world checks what comes back** as it checks anything a signer hands
  it: really signed, by the key signed in here, exactly the kind, words
  and tags it put to them, and marked with this world's address. The kit
  does.
- **One question at a time, and not for long.** The sign-in address keeps
  one, for five minutes, and a few a minute at most; a new one ends the
  one before. A world waits no longer than that.
- **To be paid, a world asks for one payment** (`pay`). It makes the
  invoice itself, with whoever it takes payments through, and the sign-in
  address shows the visitor the amount and pays at their press. The world
  learns that it was paid and nothing about their wallet: no balance, and
  never a token. `paid` may carry a `preimage`, which is the payment's
  proof: its SHA-256 is the payment hash in the invoice, and the kit says
  whether it is (`proven`; `provesPayment` in the core). A world that
  hands over something of value goes by that, or by its own word from
  whoever it made the invoice with. `paid` with no proof is the sign-in
  address's say-so. This is the way to take a payment: a world that only
  wants paying has no need of a wallet.
- **A visitor's files are theirs, and a world gets a save dialog and an
  open dialog, no more** (`file-save`, `file-pick`). Their files are kept
  by their sign-in address, on servers they chose. A world can offer one
  to be saved: the sign-in address shows where it would go (a folder made
  for that world, unless they choose another), under what name, and
  whether sealed so only they can read it (`private`, the default), and
  saves it at their press. And a world can ask to be handed one: they
  browse their own files, choose, and say yes. A world can't list
  anything, not even what it saved; can't save without a press; and reads
  a file back only by asking for it. Bytes cross as bytes, 25 MB at most.
  A name is only a name and a type only a type (`files.ts` in the core).
  `url` comes only with a public file, and the kit passes it on only if
  the hash in it is these bytes' own. A file handed to a world is a
  stranger's file as far as the world's code goes: shown, never run.
  Saving can fail for reasons that are nobody's fault (a server that
  takes only pictures refuses a sealed file): the visitor is told why on
  that page, and the world hears `refused` only if they give up.
- **A wallet connection is spending power.** What comes back from `wallet`
  is a Nostr Wallet Connect address: this world can spend with it, within
  what the wallet itself allows. A world asks for one only for something
  the visitor is doing just then, keeps it no longer than it must, and
  never sends it anywhere.
- **A world never draws these questions itself,** and nothing here lets a
  world sign a careful kind without the visitor reading it on their own
  sign-in address's page.

## Tips, buying, and receipts

**Status:** the kit's half is implemented (kit 0.69.0: `signer.tip`,
`signer.buy`, `signer.have`, and `readReceipt` in the core). BitLogin's
half is built and not yet live. The kit offers tips in its menu, and
since 0.71.0 a gate for a paid world ("The front room", below); no world
of ours is paid. The whole plan, and what the owner decided, is
`docs/plans/paying-for-things.md`.

**A world names what it wants, and never where the money goes or who is
buying.**

- **A tip** (`tip`): a person's key and an amount, or just an amount for
  the world itself. The sign-in address finds the lightning address (in
  that person's own profile; or, for the world, in the `tip` of the
  world's own `/.well-known/nswp.json`, read from the world's own
  address), shows the visitor who it is for with the address beside the
  name, and pays at their press. The world hears `paid` or `refused`,
  and nothing else. Nothing is owned afterwards and no one takes a share.
  A world can't call a payment to itself a tip to somebody.
- **A purchase** (`buy`): a listing's coordinate,
  `30078:<the seller's key>:<its name>`. The sign-in address reads the
  listing, shows what it is, whose and what it costs, pays, and keeps the
  receipt. The world never signs as the buyer: that kind of note stays
  off a world's signer for good.
- **What is held** (`have`): answered at once, from what the signer has
  been handed, with no question and no network. A world is told only of
  its own listings (sold by a key its own manifest names) and of things
  bought through it. A world loaded again may hear `none` for something
  held, until the sign-in address has next been shown there; `buy` then
  returns the receipt and charges nothing.

**A receipt is the only proof.** It is the selling service's own signed
note: which key bought which listing, and until when. A world believes a
receipt and nothing else, and checks it itself (`readReceipt`): really
signed, by a service on the kit's list; in the form the kit knows; for
the listing asked about; the visitor's own; not run out. The word
`bought` is not believed without it. The list of services is short (one:
BitUnlock, by the key in its own signed policy), it can't be changed by
the page using it, and adding to it is not a world's to do.

**What a receipt can't say** is whether it was taken back since it was
signed. Only the service that signed it knows, and it answers anyone at
`<its address>/entitlements/<the receipt's fulfillment>/status`. The
kit's gate asks ("The front room").

**A bare payment is not a purchase.** `pay` pays an invoice and leaves
nothing behind. The kit treats nothing as bought without a receipt.

## A listing

**Status:** implemented in the core (kit 0.71.0: `readListing`,
`termWords`) · **Vectors:** [`listings`](../vectors/listings.json) ·
**Code:** [`listing.ts`](../packages/core/src/listing.ts)

A thing for sale is its seller's own signed note, kind `30078`, at the
coordinate `30078:<the seller's key>:<its name>`. It is the selling
service's product listing, with a few tags that say what it means here.
A world reads one only to show it; the visitor's sign-in address reads
it again for itself before anyone pays.

| Tag | What it says |
|---|---|
| `d` | Its name. With the seller's key, its coordinate |
| `price` | `["price", "<whole sats>", "SAT"]`, once |
| `status` | `active` while it is for sale |
| `br:delivery` | `seller-unlock-service-v1`: sold through a service that signs receipts |
| `br:unlock-service`, `br:unlock-service-pubkey` | That service: its address and the key it signs with |
| `nswp:for` | What buying it gives: a world's coordinate (`37300:…`) or an item's |
| `nswp:term` | How long it lasts, in whole seconds. Left out for something bought for good |
| `title` | What it is called. Without it, `title` or `name` in the content's JSON, and failing those its `d` |

Shown for sale only if all of these hold. The first that doesn't is why
not (`readListing`):

1. It was signed by the key in the coordinate asked for (`other-seller`),
   and the signature is real (`not-signed`). Nobody prices what isn't
   theirs.
2. Its `d` is the name asked for, once (`other-listing`).
3. It is `active`, through a service that signs receipts
   (`not-for-sale`).
4. It has one price in whole sats, and a term, where it has one, said
   once and in whole seconds (`not-a-listing`). A term that doesn't read
   is never taken as "for good".
5. The service it names is one whose receipts the reader believes
   (`unknown-service`). Bought anywhere else, it would end in a receipt
   nothing here could take.
6. It costs at least 500 sats (`too-cheap`). Nothing is sold under that:
   the selling service registers nothing under it, the sign-in address
   shows no purchase under it, and nor does a world.
7. Its price isn't divided between several people (`shared`), while
   shares are not in force.

Its name is the seller's own words: shown as plain text on one line, at
most eighty characters, with nothing in it a reader can't see. How long
it lasts is said after the price, in the largest whole unit: "500 sats,
for 30 days", "500 sats, once".

## The front room

**Status:** implemented (kit 0.71.0: `createPaidGate`, `worldGate`,
`addGateControls`), the `soft` kind only. Walked on one machine against
the selling service's sandbox with pretend sats, with a stand-in for the
sign-in address (`trials/front-room.mjs`). Not tried: a sign-in address's
own screen at a gate, a real headset, a receipt really taken back. No
world of ours is paid.
**Code:** SDK [`front-room.ts`](../packages/sdk/src/front-room.ts)

A paid world ([NSWP-01](01-worlds.md), "A paid world") has a gate. The
world puts it where it likes, and everything before it is free to
anyone: a taste first is the world's to choose. Past it is for someone
who holds a receipt.

**How shut it is.** This is the `soft` gate: the world and every honest
client keep to it. A world is a website and its files are public, so it
stops nobody who means to get round it, and it doesn't claim to. It is
right for anything whose worth is being there with others. A `sealed`
gate, where what is behind is encrypted and the key comes with the
purchase, is designed and not built.

**When it is open.** As the world loads it asks what is held (`have`),
for each listing its own manifest names. It opens only on a receipt it
checks itself, whoever checked it before: really signed, by a service on
the kit's list; for one of this world's own listings; the visitor's own;
not run out; and not taken back. It never opens on the word `bought`, a
flag in an address, or a bare payment. Open, it says nothing.

**When it is shut,** it shows what is for sale, read from the listing:
its name, its price and how long it lasts. And one control for each
thing, which asks the visitor's sign-in address to sell it (`buy`) at
their press. The world takes no money and draws no question about
paying: the sign-in address's own page does.

- **It fails closed, and says why in plain words.** While anything is
  unknown it is shut: the world's own manifest unread, the signer not
  heard from, nobody signed in.
- **Only the world's own listings.** Each must be sold by a key the
  world's manifest lets announce it. A world whose manifest names
  listings, none of them its own to sell, is shut and says so.
- **Only what was read is offered.** A listing that couldn't be read or
  doesn't hold up ("A listing") isn't offered, and the gate says why. A
  receipt still opens the gate while relays are down: it names its
  listing itself.
- **Signed out,** the same control offers sign-in first, the way a world
  already does ("One sign-in"). Signing out shuts the gate at once: a
  receipt is the buyer's, and signed out the visitor is nobody's.
- **In a headset,** where the sign-in address's page can't be seen, the
  control says to step out, press again, and come back in.
- **A pass for a time** closes the gate at its end. Someone inside is
  told, has two minutes, and is then stood in the front room again. No
  page is loaded again under them. Bought again before the end, or in
  those two minutes, it stays open. Someone who arrives after the end
  finds it shut.
- **Taken back.** The service that signed a receipt is asked whether it
  has taken it back, every five minutes at most, at its own address. If
  it says so the gate shuts then. If it can't be reached, a receipt
  found good within the last day stays good (a receipt was good the day
  it was signed); after that the gate is shut until the service answers.
  A paid world that draws no items is served with rules that let it
  reach that one service by name, and nothing else new; a free world's
  rules are untouched. What is asked carries the receipt's own name at
  that service and nothing more: no key, no cookie, no referrer, nothing
  about the visitor. A browser still says which site a request comes
  from, as it does of any request between sites, and the service sees
  the address it came from: so the service that sold a pass can tell that
  its holder is in that world now. A page can't switch that off.
- **A world with nothing for sale has no gate.** Nothing is read, asked
  or shown, and it behaves exactly as it did.

The control is one of the console's own ([NSWP-11](11-the-visitors-console.md)):
`gate-buy`, and `gate-buy-2` and on where a world sells more than one
thing. It comes after the things every place has, so the way home keeps
the first key.

```js
import { addGateControls, worldGate } from "nswp-sdk/three";

const gate = worldGate();                         // this page's signer, this world's own manifest
addGateControls(controls, gate, { presenting: () => renderer.xr.isPresenting });
const canStand = (x, z) => gate.open || !pastTheGate(x, z);   // where the gate stands is the world's
gate.onChange(() => (veil.visible = !gate.open));
```

Not built: the taken-back answer for a held item, the same for worlds
made in other engines, and a client's own mark on a door for what the
visitor already holds.

## Shares

**Status: written down, and not in force.** Nothing pays a share: a
listing is paid to its seller whole, as it always was. The rule is in
the core (`readShares`, `splitPrice`) with examples every implementation
is checked against (`vectors/shares.json`), so that the service that
sells, the sign-in address that pays and anything that shows a price
agree before any of them acts on it. It comes into force when the owner
says, and not before. The plan is `docs/plans/paying-for-things.md`,
section 8.

**What a seller writes.** One tag on the listing for each person its
price is divided between, the seller included:

```
["nswp:share", <who>, <parts>, <a word for what it is for>]
```

- **who**: a key (64 hex characters), or the word `client`: whichever
  client brought the buyer.
- **parts**: how many parts in ten thousand of the price, in digits, from
  1 to 10000, with no leading zero and no fraction.
- **a word**: at most 32 characters, on one line, with nothing unseen in
  it. Left out, the share is called `seller`, `client` or `share`.

A listing with no such tag has no shares. One with any must have them
all right: at most four; nobody twice; the seller among them; adding up to
exactly 10000. Otherwise it can't be sold with shares at all. Nothing is
dropped, guessed or made to fit.

**What a price comes to.** Each person but the seller is paid their
parts of the price, rounded down to a whole sat. The seller is paid what
is left. The selling service's own charge comes out of the seller's part
and nobody else's. Every payment is at least 10 sats, or the listing
can't be sold this way. They are paid smallest first and the seller
last (two of one size in the order of their keys), so that a payment cut
short leaves as little astray as it can, and nothing is handed over
until every one is paid.

**The client's share** names no key. It goes to the client that brought
the buyer, where one did and can be paid, and to the seller where none
did (a world opened by its own address). A seller offers it by writing it
into the listing they sign, so nothing is taken that wasn't offered, and
any client may be the one it goes to. Who the client is, is not the
world's to say: a world would name itself. The sign-in address knows
which page is showing its panel, and reads that client's key from the
client's own `/.well-known/nswp.json` (`share`), at the client's own
address. A client who is also named in the listing is one person, paid
once.

**Nobody is sent money they didn't agree to take.** The selling service
pays only a key that has told it, signed by that key, where to be paid.
A listing naming anyone else can't be sold with shares. The same holds
for a client: where the service can't pay the client named, that share
is the seller's. So for one listing and one client there are two right
plans, one with the client paid and one without, and the service's plan
says which. A sign-in address that checks the plan against the listing
takes either, and nothing else.

**The buyer sees every share,** by its word and by who it is for, before
paying.

## One sign-in

Where a visitor's client names a signer, there is one sign-in in a world, and
it is that one. A world never says "you are here as Alice" to someone who
hasn't signed in there.

- **A pass counts once the signer is unlocked for that world, as the same
  person.** A client may still hand the pass over on arrival. A reader holds
  it, and joins a room by name only while the signer is unlocked there and
  the key it reports is the key that signed the pass. Until then the visitor
  is a guest: to the room, and in everything the world says about them.
- **The name, the picture and the few words still come off the pass.**
  Nothing new is asked of anybody to show who is signed in.
- **Signing in or out in a world changes who the room sees.** A pass can't be
  shown late or taken back, so a reader leaves the room and joins it again:
  by name after signing in, as a guest after signing out.
- **A signer that remembers a world says so as the page loads.** A reader
  waits a moment for that before it joins a room (the reference kit: up to
  two and a half seconds), so someone who signed in there last week is by
  name from the first join, with nothing pressed.
- **Unlocked for a key the pass isn't for,** or with no pass at all, a
  reader asks the signer for one ("A pass from the signer", below). A signer
  that makes none leaves the visitor a guest in a room, able to sign: nobody
  has vouched for a name, and a reader says so.
- **A client's own pages are not a world it sent someone to.** There the
  visitor is signed in already, the client's own way.
- **A client that names no signer** is as before: its pass is its word.
- **However they came, it is the same sign-in.** A world that names a
  signer for visitors no client brought ("Signing from a world") shows
  them the same one row, and never the way to a client's sign-in place.
  The reference kit until 0.54.0 offered the row only to someone who had
  come through a door in that same tab; anyone else was sent to their
  client and came back still a guest, to be asked a second time.

What this costs: the first time in each world, one press and one yes in the
sign-in window, where "Signed in everywhere" asked for nothing. What it buys:
one meaning of "signed in", shown one way, and nothing said to a room that
the visitor's sign-in address didn't agree to for that world.

The reference kit shows it as one row under You, "Sign in, at
bitlogin.network" or "Signed in as Alice. Sign out here", under a card with
their picture, their name and their key. The older row ("Here as Alice.
Switch profile, or go as a guest") is not shown where a signer is named.

## A pass from the signer

A visitor who signs in at a world shouldn't need their client to have
vouched for them first. So the signer can make the pass.

- **A world asks with a session key and nothing else:** `pass`, with
  `session`, the public key of a session key the world's page made. The
  signer writes every other word of the pass itself: the site, from the
  address the browser reports, as for anything else it is asked; when it
  ends, four hours at most; and the name, the picture and the few words,
  from that key's own signed profile, read at the sign-in address and never
  by the world.
- **`sign` still refuses a pass.** Kind 27300 stays on the list a world can
  never have signed. A world can't write a pass and have it signed: it can
  only ask for the one the signer would write.
- **It is for a world the visitor allowed,** and has an allowance of its
  own for that world, apart from notes ("Signing from a world", "Limits").
- **What comes back is checked as any pass is** ("Checking a pass"), and
  then for whose it is: signed by the key the signer says it holds, for
  this site, naming the session that was asked for. Anything else is dropped
  and the visitor is a guest.
- **A reader asks when it has no pass for the signed-in key:** on signing
  in, and again once a pass has run out. A pass the visitor's client sent
  for the same key is used as it is. A reader that was refused, or got no
  answer, doesn't ask again until the visitor signs in afresh or the page is
  loaded again: a refusal means "a guest", not "try later".
- **A signer that makes none says nothing,** and nothing breaks: the reader
  stops waiting, and the visitor is a guest in a room who can still sign.
- **The `state` reply's `name`, `picture` and `about`** are for the
  visitor's own card. What a room sees comes off the pass.

With this a client need not send a pass on arrival at all, and a world then
learns nothing about a visitor until they say yes there. The reference
client sends none: its Airlock names the visitor's signer and nothing else
about them, and says at the door that signing in is done at the world.

## Posting from a world

What is written to a room stays in the room ([NSWP-06](06-rooms.md),
"Words"). A post is another thing, and a reader keeps the two apart so that
nobody takes one for the other.

- **It has a window of its own, named for what it is.** The reference kit
  calls it "My public feed": the visitor's own posts, newest first, with the
  place to write above them and one button, "Send out a post". It says, where
  they write, that anyone can read what is sent and that it can't be taken
  back. On a flat screen it is the other side of the panel the room's chat is
  on; in a headset, a panel of its own.
- **A post is a plain note:** kind 1, the words they wrote and no tags,
  signed by their signer ("Signing from a world"), checked, and sent from the
  page to relays. Nothing said in the room is ever posted, and nothing posted
  is said in the room.
- **It says how a post is marked.** A world's signer marks every note with
  the world that asked ("Signing from a world"). The window says so where
  the visitor writes: "Each post is marked as sent from" and the site. A
  client that signs in its own room says the same where its own sign-in
  marks what it signs (the kit's `RoomNotes.marked`).
- **A post goes to the relays its writer says they write to.** That is
  their own relay list (NIP-65: kind 10002, `r` tags, a tag with no marker
  or marked `write`), the newest one, looked for on the reader's usual
  relays. Only `wss` addresses on the open web are used, six at most. A list
  with fewer than two is filled out from the usual relays, to four in all,
  and someone who has published no list gets the usual ones. The window says
  which it was, and how many took the post.
- **Their earlier posts are read from the same relays, when they open the
  window,** and not before. Their posts and their relay list are the two
  things a world asks a relay about a person, and the person is the visitor,
  in their own browser, asking to see and to send their own posts. A world
  still never asks a relay about anyone else ("Pictures", "Who someone
  is"). Replies are left out: out of its thread a reply reads as nonsense.
- **A post is shown as plain words.** An address in it is text: nothing is
  fetched, and nothing opens. It is cut to 420 characters and one line.
- **It needs no room.** It is there whenever the visitor has a signer; signed
  out, the row says where they sign in first, and pressing it leads there.

**Deleting a post (kit 0.66.0).** Each of the visitor's own posts in that
window has a Delete. It is a deletion in the ordinary Nostr sense (NIP-09:
kind 5, naming the note), and a careful kind, so the world's signer signs
none on the world's word: it is put to the visitor at their sign-in
address ("Asking the person"), which tells them what it is and that it
can't be undone. The world checks what comes back (really signed, by
them, naming that one post and nothing else) and sends it to the relays
their posts go to. The window says what that is worth: relays are asked
to drop the post, and a copy kept somewhere else may remain. Nothing is
offered where nothing can ask them: a client's own room that signs as an
application has no Delete until its sign-in address lets it ask.

## In code

```js
import { hereAs } from "nswp-sdk/three";

controls.run("signer");   // where their client named a signer: opens its window, or signs them out. They stay in the world
hereAs();                 // who they are here now, checked, or undefined for a guest
// The kit's console has the row already, under "You" (addViewControls).
```

Where their client named no signer:

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

- **Taking a pass back early.** Today it lasts until it expires.
- **A pass for one room,** naming a room event, once rooms have them; and
  **hosted rooms** that check passes at the door (spec §9.1 to §9.5).
- **Going as another identity** than the one signed in.
- **Carrying the visitor's mute list,** so a world can leave out the people
  they have muted.
- **Proof for a world's server.** The entry assertion in
  [NSWP-03](03-arrival.md) is the format; no client issues one yet.

Background and reasoning: [`spec.md`](../spec.md) §4.3, §4.4, §9.2.
