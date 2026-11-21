# Starting a room or joining one, with a list of open rooms

- **Asked:** 2026-11-21. The owner: "As bitportal scales we will need
  better UI for joining rooms. Should be asked Start new room or join an
  existing room. These rooms could be Nostr notes. And seeing available
  rooms that are open to join could be a Nostr feed. User should select
  when creating a new room if it's public, invite only or private. This
  way any party can use a world with the people they want. And this
  should be able to scale to very large multiplayer server systems if the
  world host wants to run them. I think that was in our original spec."
- **Who:** not briefed. The kit and the protocol (NSWP-06), then
  BitPortal for the list of rooms happening now.
- **State:** asked

## What is already there, and what is only written down

**Built (NSWP-06, `room.ts`):** one way to be in a room. A world has an
open room, `lobby`, and a private room is a name nobody could guess,
shared as `#room=<name>` on the world's address. Joining is one press
("Join the room"), asked once and carried from world to world. Peer to
peer only, eight people by default.

**Written in the spec and not built (`spec.md` §9.1 to §9.10), and it is
nearly what the owner describes:**

- **A room is a Nostr note** (§9.1): NIP-53's interactive room, kind
  30312, naming its world, its host, its moderators, its transport and
  who may enter. A room needn't be published: an invite-only room's note
  can travel only inside its invitations.
- **A feed of open rooms** follows from that: ask relays for kind 30312
  notes that name this world. The spec's heartbeat (§9.10, from
  COMBATRIG) says which are live: a room whose host hasn't beaten for
  150 seconds is dormant and left off "happening now".
- **Who may enter** (§9.3): open; invite (a secret in the invitation);
  a list; the host's follows; a ticket (paid).
- **Very large rooms** (§9.5, §9.6, §9.9): a hosted room sends voice and
  movement through a room server anyone can run; a room that outgrows
  peer to peer moves to a server without ending; a world with its own
  multiplayer servers keeps them and says so in its manifest. A reference
  room server is in the spec's plan and not built.
- **Rooms that outlive their host** (§9.10): heartbeat, handover in
  admission order, old invitations still working. COMBATRIG's answers.

So the owner's memory is right: it is in the original spec. What is
missing is the build.

## Words (the orchestrator's reading)

The owner's three choices map onto the spec's, with one word to watch:

| Owner's word | What it can honestly be | Spec |
|---|---|---|
| Public | Listed in the feed; anyone may join | `open`, published |
| Invite only | Not listed; joined by an invitation link or by being on a list | `invite` or `list`, unpublished |
| Private | Invite only, **and** what is said and seen is encrypted so the host's server can't read it | `invite` + end-to-end encryption |

As with worlds by invitation ([private-worlds-by-invitation](private-worlds-by-invitation.md)),
"private" is kept for the encrypted kind. One thing the spec already says
plainly and the screen must say too: the world's own code sees everything
in any room held in it. A private room keeps out strangers and the room
server, not the world.

A room's guest list and a world's guest list should be one shape (BitGate's,
per [bitgate](bitgate.md)), not two.

## The kit's half and the client's half

- **Kit:** read and write room notes (§9.1, with vectors); the heartbeat
  and handover (§9.10); "Start a room" and "Join a room" in the console,
  the same on a desk, a phone and in a headset, with the three choices;
  the list of rooms in this world happening now; invitations. Every world
  gets it, including the template and other engines.
- **BitPortal:** rooms happening now across all worlds, as a feed (who is
  where, joinable from the room), and "join a friend" from a person's
  card.
- **Protocol:** NSWP-06 grows from "built" to cover the above; the room
  server's own protocol is a document of its own.

## Open, before building

- Whether NIP-53's kind 30312 fits (the spec's open question Q15).
- Who runs the first room server and a TURN server (Q17). Somebody pays
  for each.
- Whether the default stays "join the world's open room" with "start or
  join" one press away, or the choice comes first every time. The
  orchestrator's opinion: the default stays one press into the open room,
  so a person alone isn't asked a question before they can see anyone.

## Done looks like

To be written when briefed. Start a room, pick public, see it in another
visitor's list and join it; pick invite only and see it in nobody's list
but join by the link; the host leaves and the room goes on.

## Must not

- Call a room private that the room server can listen to.
- Show a room that isn't live as "happening now".
- Make a second shape of guest list.
