# NSWP-06: Rooms

**Status:** A first version is implemented: peer to peer, for guests and for people going by name. Room events, entry rules, hosted rooms and moderation are proposed · **Kinds:** 27301 (signals); 27300 (passes, [NSWP-10](10-identity.md)) · **Code:** [`room.ts`](../packages/core/src/room.ts), SDK [`room.ts`](../packages/sdk/src/room.ts) · **Tests:** [`room.test.ts`](../packages/core/test/room.test.ts)

A room is a group of people in a world who can see and hear each other. The
world is the place; a room is one gathering in it. Nobody is in a room until
they choose to join one, and joining shows their IP address to the others.

What is written here is exactly what the reference implementation does, so
that a second one can join the same rooms. It is the smallest room that
works, and it will change when room events are built.

## Finding each other

A room has a **topic**: the SHA-256, in hex, of this text as UTF-8:

```text
nswp/room/spike-1
<origin and path of the world's address>
<room name>
```

The three lines are joined with a newline, with none at the end. The default
room name is `lobby`. A private room has a name nobody else could guess, 4 to
48 of `A-Z a-z 0-9 _ -`, and is shared as `#room=<name>` on the world's
address. Because the topic is a hash, knowing a world's address is not enough
to find its private rooms.

Members meet on relays (below). Every member of a room should ask the same
ones, and as many as it can reach: two members who share no relay never find
each other. The kit's are `ROOM_RELAYS`, eight relays run by eight
operators; a world may name its own. A client that reaches fewer than two of
them tells its visitor so.

Each member speaks with a **session key**: a throwaway. A guest's is made
when they join and says nothing about who they are. Someone going by name
uses the one their pass names ([NSWP-10](10-identity.md)).

## The handshake

Members find each other with events of kind `27301` on public relays, tagged
`["x", <topic>]` and signed with the session key.

| Message | To | Content |
|---|---|---|
| `hello` | everyone | `{"t":"hello","v":1}`, in the clear. Sent on joining and every 20 seconds. The one sent on joining adds `"first":true`: whoever hears it knows this member joined after them ([NSWP-01](01-worlds.md), "Places to arrive"). A client that doesn't know `first` ignores it |
| `welcome` | one member | `{"t":"welcome"}` |
| `offer` | one member | `{"t":"offer","sdp":"…"}` |
| `answer` | one member | `{"t":"answer","sdp":"…"}` |
| `bye` | one member | `{"t":"bye"}` |
| `full` | one member | `{"t":"full"}`: this room is full; someone joining the world's default room goes on to the next lobby (below). A client that doesn't know `full` ignores it |

A message to one member has a `["p", <their session key>]` tag and its
content is encrypted to them with NIP-44. A `hello` is the only message in
the clear, and the only one without a `p` tag.

Rules:

- A message more than 60 seconds old or new is ignored. So is one with a bad
  signature, the wrong topic, or addressed to someone else.
- An `sdp` is at most 20,000 characters.
- **Who calls whom.** Of any two members, the one whose session key sorts
  lower as hex makes the offer. On hearing a `hello` or `welcome` from a
  stranger: if you are the one who offers, send an `offer`; otherwise, if it
  was a `hello`, answer `welcome` so they know to.
- ICE candidates are not sent one at a time. Each side waits up to 2.5
  seconds for gathering and sends one complete description.
- A member stops answering newcomers when the room is full for them. The
  default is 8 members. Then one of them tells the newcomer `full` (below).

### Lobbies that fill

A world's default room is not one room but a row of them, filled one at a
time: `lobby`, then `lobby-2`, `lobby-3` and on, at most 32 (with 8 to a
room, 256 people). Each is a room like any other, with its own topic. A room
by name is one room, and never moves anyone on.

- **Everyone joins at `lobby`,** so the first fills back up first as people
  leave.
- **A full room says so, once.** When a room is full for a member and a
  joining `hello` (with `first`) comes from someone not in it, the member with
  the lowest session key of those it is connected to sends a `hello` of its
  own and then answers `full`; the others say nothing. In a full room that is
  one member.
- **Who joined first stays.** Where that member is connected to someone whose
  joining `hello` was signed after the newcomer's (by `created_at`, then by
  the higher session key), less than 15 seconds ago, it tells that one `full`
  instead and lets the newcomer in. Two who arrive together are settled the
  same way by everyone.
- **Told `full` in a lobby,** a member says `bye` to anyone it is connected to
  there and joins the next lobby on the same relays, with a joining `hello`.
  At the last lobby, or in a room by name, it stays.
- **`full` is taken only while it may be:** within 15 seconds of joining that
  lobby, and only from someone whose `hello` was heard there (one that comes
  before their `hello` waits for it, within the same 15 seconds). Past that,
  it is ignored, so nobody settled in a lobby can be sent on by anyone.

## The connection

Each pair of members has one WebRTC connection, with:

- **One audio line,** agreed at the start in both directions, so turning a
  microphone on later is a change of track with no second handshake.
- **One data channel** named `pose`, unordered, with no retransmission.

A member counts as present when that channel opens. One who has been silent
for 8 seconds is treated as gone; a connection that hasn't opened after 25
seconds is abandoned.

**A first try that doesn't open is made again once, afresh.** The one who
offers sends a new `offer` (new candidates, new paths) when a first try
hasn't opened after 15 seconds or has failed; the other answers it as any
offer, dropping the try it had. A later try that fails or doesn't open in 25
seconds is given up, and the client tells its visitor that someone is there
who couldn't be reached, not only that they are in the room. It goes on
trying at each `hello`. Nothing changes on the wire: it is a second `offer`,
which every client already answers.

## What travels on the channel

**Where a member is,** as binary: 88 bytes, 22 little-endian 32-bit floats.

| Floats | What |
|---|---|
| 0 to 6 | Head: position x, y, z, then rotation as a quaternion x, y, z, w |
| 7 to 13 | Left hand, the same |
| 14 to 20 | Right hand, the same |
| 21 | Which hands are being tracked: 1 left, 2 right, 3 both, 0 neither |

Positions are metres in the world's own coordinates. A packet of another
size, or with a value that isn't finite or is beyond 10,000, is dropped. The
reference client sends 15 a second.

**Everything else,** as text. A message a member doesn't understand is
ignored, which is how new ones can be added.

| Text | Meaning |
|---|---|
| `look:<inline look>` | How this member looks ([NSWP-05](05-looks.md)). The channel doesn't retry, so it is said when the channel opens and three more times, 1.5 seconds apart. A member who never says it is drawn as their session key generates |
| `avatar:<a look note, as JSON>` | The member's own look note (kind 37301, [NSWP-05](05-looks.md), "A model of your own"), signed by their own key, where it names a model of theirs: so nobody has to ask a relay for each person. At most `LOOK_NOTE_LIMIT` (8,000) characters, said as often as a look, and only by a member who also says `id:`. A receiver believes it only once that member's pass has checked out, and only if the note is really signed by the key the pass names; anything else counts for nothing. A receiver takes a new note from one member no oftener than every few seconds (the reference kit: 3), and checks a note's signature once, so nobody can have a room check signatures as fast as they can send |
| `id:<a pass, as JSON>` | "This is who I am" ([NSWP-10](10-identity.md)). At most 4,000 characters, said as often as a look. It counts only if it checks out for this site and names the session key the member is speaking with. A member who never says it is a guest |
| `rec:1` | "I am recording what I see." Said every 2 seconds while true. It holds for 6 seconds, so a lost message can't leave it stuck on |
| `rec:0` | "I have stopped." Said twice |
| `say:<id>:<words>` | A few written words to the room. See "Words", below |

## Words

A member may write a few words to the room: `say:`, eight hex digits that
tell this line from their others, a colon, and the words.

```text
say:0a1b2c3d:Hello, room: how are you?
```

- **It goes where a pose goes, and nowhere else.** Straight from one browser
  to each of the others, on the connection the room already has. No relay
  sees it, nothing signs it, and nobody keeps it: a reader holds the lines in
  memory while they are in the room and forgets them on leaving. Someone who
  joins later is not shown what was written before.
- **Who wrote it is whoever holds the connection it arrived on.** A line
  carries no name. A reader shows the member's name as the room already
  knows it: `Guest` and four digits, or the name off a pass that checked
  out. Nothing in a line can make it look like someone else's.
- **The channel doesn't try again,** so a line is sent three times, 180
  milliseconds apart, and a reader takes the first: one with an id it has
  already had from that member is dropped. A reader remembers the last 32
  ids from each member.
- **It is words and nothing else.** A reader makes it one line, drops
  control characters and the invisible ones that reorder or hide text (the
  joiner inside an emoji stays), and cuts it to 240 characters, whatever was
  sent. It is shown as text: never as markup, never as a link that opens
  itself, never fetched from.
- **Nobody floods a room.** A reader takes no more than five lines from one
  member in ten seconds and drops the rest unseen. An honest client holds
  itself to the same and tells its own visitor to wait.
- **Seeing it is the reader's to turn off.** With chat off, nothing anyone
  writes is shown to them, they write nothing, and nobody is told. It is a
  preference that goes with them from world to world
  ([NSWP-11](11-the-visitors-console.md): `chat`).
- **Blocking someone ends it too:** the connection to them is closed, so
  nothing they write arrives.

The reference client makes a soft sound when a line arrives, heard from
where its writer stands: quieter and duller the further off they are, and to
the side they are on. It is never silent, since the line is there to read
however far away they are. It draws the line over the head of whoever wrote
it for a few seconds (four, and a little more for each character, to twelve at most),
and lists the lines in a panel: at the side of a flat screen, and on a panel
of the visitor's own in a headset, where the keyboard that comes up has a
Speak key wherever speech can be turned into words.

What this is not: notes on Nostr. Nothing here is published, signed by the
visitor's own key, or readable by anyone outside the room. A post is another
thing, with a window of its own ([NSWP-10](10-identity.md), "Posting from a
world").

## What a client owes the people in a room

- **Say before joining** that joining shows the visitor's IP address to the
  others.
- **Show when someone is recording.** The reference client puts a light over
  them, marks them in its list of people, and says so once.
- **Say when you record.** An honest client sends `rec:1` whenever it records
  other people. Nothing can make a dishonest one.
- **Personal space.** The reference client fades a figure out between 0.9 m
  and 0.45 m from the visitor's head, and moves a newcomer who appears within
  1 m to 1.4 m away. A person in a headset is never moved against their will.
- **Nobody outruns a run.** However a visitor moves (keys, a mouse, a
  finger on a phone, a headset's sticks or its steps), they cover ground no
  faster than someone running. The reference kit walks at 2.4 m a second and
  runs at 1.75 times that, 4.2 m a second, and nothing is faster:
  - On a flat screen a press on the floor is a walk to that spot, a few
    metres off at most, on a phone as at a desk. It is never a jump, whether
    or not the visitor has asked for less motion.
  - In a headset the casual way to move is a step that lands at once, since
    a slide there turns stomachs. It is paid for after it is taken: the next
    step may not land until a runner would have covered the same ground. A
    reader shows when a press would do nothing.
  This is each visitor's own page keeping to a pace, for the sake of the
  others. A room is a mesh with nobody in charge, so nothing stops someone
  who changes their own page: it is what an honest client does, like saying
  when it records.
- **Names.** A guest is shown as `Guest` and the first four hex digits of
  their session key. Only a member whose pass has checked out is shown by a
  name of their own, and their key is one action away
  ([NSWP-10](10-identity.md)).

## A world's own rules

A world's own site may say two things about its rooms
([NSWP-10](10-identity.md), "A world's own lists"). Each visitor's own
copy of the kit keeps them, for the others in the room; a room is a mesh
with nobody in charge, so this is what an honest client does.

- **People its owner keeps out.** Where the world keeps lists and its
  owner's block list names someone, a member whose pass names that key is
  let go the moment the pass checks out: their connection is closed with a
  `bye`, and they are not answered again in that visit. To them, everyone
  has left. Nobody is told, and the list is never added to the visitor's
  own blocks, kept, or carried on.
- **Only named people** (`named_only` in the world's manifest). A member is
  shown and heard only once their pass has checked out: until then nothing
  of them is passed on, not that they are there, nor how they look, where
  they stand or what they say, and the lines their sound comes on are held.
  A member who shows no pass within 7 seconds of their channel opening is
  let go as above, and so is one whose pass runs out. A visitor who is a
  guest there is told, when they press Join, that they must sign in first,
  and is not joined.
- **Only invited people,** where the world is by invitation. As for only
  named people, and a member's pass must also name someone on the owner's
  allow list, or a keeper; anyone else is let go. When the list changes,
  anyone no longer on it is let go at once. A visitor not invited is told
  so at Join, and is not joined.
- **Refused after the connection opens, not before.** A pass travels on the
  channel, which opens before it can be read. So someone kept out does
  connect for a moment, and learns the addresses connections are made
  between, before they are let go. A room that refused them before
  connecting would need a pass shown inside the handshake, which tells
  whoever is listening on the room's topic who is there; that is not done.
  A room whose very finding is kept from outsiders comes with a group key,
  and is not built.

Someone kept out whose own kit honours the list is told so at Join and is
not joined at all.

## Proposed, not built

- **Room events** that describe a room, and passes that name one room
  rather than a whole site: the spec's §9.1 and §9.2.
- **Who may enter** (invites, lists, follows, tickets), **hosted rooms** for
  more than a handful of people, moving between worlds together, and
  moderation: §9.3 to §9.10.
- **Sound in recordings,** which deserves more than a light.

There is no schema or vector file for these messages yet: the tests in
`room.test.ts` cover the handshake and the pose packet, and `chat.test.ts`
what a written line may be. Background and
reasoning: [`spec.md`](../spec.md) §9.
