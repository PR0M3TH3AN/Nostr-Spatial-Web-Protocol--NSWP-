# NSWP-06: Rooms

**Status:** A first version is implemented: guests only, peer to peer. Room events, passes, hosted rooms and moderation are proposed · **Kinds:** 27301 (signals); 27300 (passes, proposed) · **Code:** [`room.ts`](../packages/core/src/room.ts), SDK [`room.ts`](../packages/sdk/src/room.ts) · **Tests:** [`room.test.ts`](../packages/core/test/room.test.ts)

A room is a group of people in a world who can see and hear each other. The
world is the place; a room is one gathering in it. Nobody is in a room until
they choose to join one, and joining shows their IP address to the others.

What is written here is exactly what the reference implementation does, so
that a second one can join the same rooms. It is the smallest room that
works, and it will change when room events and passes are built.

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

Each member makes a fresh **session key** when they join. It says nothing
about who they are, and is thrown away when they leave.

## The handshake

Members find each other with events of kind `27301` on public relays, tagged
`["x", <topic>]` and signed with the session key.

| Message | To | Content |
|---|---|---|
| `hello` | everyone | `{"t":"hello","v":1}`, in the clear. Sent on joining and every 20 seconds |
| `welcome` | one member | `{"t":"welcome"}` |
| `offer` | one member | `{"t":"offer","sdp":"…"}` |
| `answer` | one member | `{"t":"answer","sdp":"…"}` |
| `bye` | one member | `{"t":"bye"}` |

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
  default is 8 members.

## The connection

Each pair of members has one WebRTC connection, with:

- **One audio line,** agreed at the start in both directions, so turning a
  microphone on later is a change of track with no second handshake.
- **One data channel** named `pose`, unordered, with no retransmission.

A member counts as present when that channel opens. One who has been silent
for 8 seconds is treated as gone; a connection that hasn't opened after 25
seconds is abandoned.

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
| `rec:1` | "I am recording what I see." Said every 2 seconds while true. It holds for 6 seconds, so a lost message can't leave it stuck on |
| `rec:0` | "I have stopped." Said twice |

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
- **Names.** A guest is shown as `Guest` and the first four hex digits of
  their session key.

## Proposed, not built

- **Room events** that describe a room, and **room passes** (kind 27300) that
  let a member prove who they are: the spec's §9.1 and §9.2. Until then
  everyone is a guest, and names and marks prove nothing.
- **Who may enter** (invites, lists, follows, tickets), **hosted rooms** for
  more than a handful of people, moving between worlds together, and
  moderation: §9.3 to §9.10.
- **Sound in recordings,** which deserves more than a light.

There is no schema or vector file for these messages yet: the tests in
`room.test.ts` cover the handshake and the pose packet. Background and
reasoning: [`spec.md`](../spec.md) §9.
