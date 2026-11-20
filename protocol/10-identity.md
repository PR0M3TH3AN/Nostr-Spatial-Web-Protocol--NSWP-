# NSWP-10: Who someone is

**Status:** Passes, names in rooms, the proven mark, signing in from inside a world and being signed in everywhere are implemented; profile cards beyond a name, hosted rooms that check passes, and taking a pass back early are proposed · **Kinds:** 27300 (pass) · **Schema:** [`pass`](../schemas/pass.schema.json) · **Vectors:** [`passes`](../vectors/passes.json) · **Code:** [`pass.ts`](../packages/core/src/pass.ts), SDK [`room.ts`](../packages/sdk/src/room.ts)

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
- **The choice is the visitor's and it stands.** In the reference client,
  someone signed in goes by name until they say otherwise ("Signed in
  everywhere", below). Someone who isn't signed in is never sent by name.
- **A new session key every trip.** Two passes can't be linked by their
  session keys, only by the identity that signed them.

## Signed in everywhere

A visitor signs in once, in their own client, and is signed in wherever they
go. No world has a sign-in of its own, so there is nothing to sign in to one
by one: the client hands each world a pass as they arrive
("The pass", above), and the next world another.

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
The reference client names one, so what follows describes a client that
doesn't.

The reference client does this. Going by name is the default for someone
signed in; "Go to worlds as myself" is a tick on the sign-in page, on until
they untick it; and choosing "a guest" at the Airlock unticks it.

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
and BitLogin on a panel in front of them. In a headset the panel is seen on
the headset's flat screen: an immersive session can't show a page, and no
client can change that. The page offers "Back to *the world*, by name" to someone signed in,
with what that gives away written under it, and "Go back as a guest" to
anyone. The Airlock then goes straight through to a place the visitor knows,
or shows its whole screen if anything about the door needs to be seen. If
they asked to go by name and can't (the site hasn't proved it is who it
says), the screen is shown and says so.

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

An arrival is something anyone can write, so a link can name a signer of
its own making, as it can an Airlock. What that gains is little, and a
world keeps it so:

- **A world says whose window will open, before it is pressed:** "Sign in
  to sign notes, at *that address*". It is the address the client named,
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

**What a world says to the signer**, as messages between the two pages,
each `{ "nswp": "nswp-signer", "v": 1, "t": ..., "id": ... }`:

| From the world | The signer answers |
|---|---|
| `state` | `state`: `unlocked`, and once unlocked `pubkey`, `name`, `picture`, `about`, `until`, `remembered`. Said again, unasked, whenever it changes |
| `sign`, with `event`: `kind`, `content`, `tags` | `signed`, with the whole signed note; or `refused` |
| `pass`, with `session`: a session public key | `signed`, with a room pass the signer wrote; or `refused` ("A pass from the signer", below) |
| `lock` | `state`, locked. The visitor's own way to end it, from the world's menu |

A world asks `state` once the frame has loaded, and again a few times: the
answer is how it knows a signer is there. A signer never sends anything to
a page whose address it doesn't know. Where the browser tells it which page
embeds it, it may say `ready` to that page, unasked. A refusal never says
why.

**What it signs for a world**, by kind:

| | Kinds | When |
|---|---|---|
| Ordinary | A note (1), a reaction (7) | Once the visitor has allowed that world |
| Careful | Their profile (0), who they follow (3), a deletion (5), their relay list (10002), and anything not named here | Only with their say each time, on a surface their client draws. **Not built: refused** |
| Never | Private messages and their wrappings (4, 13, 14, 15, 1059, 1060), passes and room signals (27300, 27301), proofs of identity to a relay or a server (22242, 27235), wallet and remote-signer traffic (13194, 23194, 23195, 24133), application data (30078) | Refused, whatever anyone says |

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

**Ways to unlock, the most seamless first.** Already unlocked for this
world; the visitor's passkey, without leaving the world; a signer of their
own (a browser extension, a phone that approves); their password in the
client's window; and, where no window can open (a headset), the trip by the
crossing's room, which brings back a pass and not a signer. **Built: the
window.** The rest are in
[`docs/plans/signing-in-worlds.md`](../docs/plans/signing-in-worlds.md).

The reference signer is BitLogin's own site. The key moves from the
window's crypto worker to the signer's without passing through either page,
and the signer remembers a world the visitor allowed (BitLogin's
`docs/sign-in-window.md`).

## One sign-in

Where a visitor's client names a signer, there is one sign-in in a world, and
it is that one. A world never says "you are here as Alice" to someone who
hasn't signed in there.

- **A pass counts once the signer is unlocked for that world, as the same
  person.** The client still hands the pass over on arrival. A reader holds
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
