# Physics that everyone in a room sees the same

- **Asked:** 2026-11-21. The owner: "We also need to talk through how we
  will be doing low/medium fidelity physics simulations across worlds so
  that players see and are effected by the same things. Games often need
  physics for fun interactive play so id like to think through how we can
  make that consistent across games/worlds in our bitportal kit. I know
  one user is the server host and we had planed fallbacks incase the host
  drops and so on. Will this work for interactive physics and moving game
  objects? Will everyone in the room have a consistent experience?"
- **Who:** not briefed. The kit. The owner asked to talk it through.
- **State:** asked

Everything below is the orchestrator's reading, to be argued with.

## What exists today

- The spec leaves physics to each world (§9.9) and the protocol is not to
  define a physics engine (its list of things it doesn't do). That stays
  true **of the protocol**. The owner's ask is about **the kit**: the kit
  may give every world one way of doing it, so worlds made with it behave
  alike, without the protocol requiring it of anyone else.
- In a room today, positions travel 10 to 20 times a second between
  everyone. Shared objects are planned as a conflict-free replicated data
  type (§9.4): no device in charge, good for a moved chair, and it says
  itself that it can't prevent cheating and doesn't suit games.
- The host handover the owner remembers (§9.10, COMBATRIG's) is about the
  **room's record**: who keeps the room alive. It does not yet say
  anything about who keeps moving objects in step. That is the piece to
  add.

## Will everyone see the same thing? The honest answer

**The same outcome, a moment late: yes. The same frame, at the same
instant: no, and no networked game does that.** What can be made true:

- **One device is in charge of each moving thing at a time.** It runs the
  simulation for that thing and sends where it is, ten to twenty times a
  second. Everyone else draws it smoothly between those updates. So the
  ball ends up in the same place for everyone; a far-away player sees it
  a fraction of a second later.
- **Who is in charge.** For casual play: whoever last touched the thing
  (you push the box, your device runs the box until it settles). That
  feels instant for the person acting. For games: the host for everything,
  or a room server (§9.5) as referee. That is fair, and slower for
  everyone but the host.
- **When the one in charge leaves.** Each thing passes to the next device
  in the room's admission order (§9.10's order), starting from the last
  position everyone had. A hitch of a fraction of a second, then on. This
  extends COMBATRIG's handover from the room to the objects in it.
- **Cheating.** Peer to peer, a player in charge of a thing can lie about
  it. Only a room server that runs the simulation itself stops that. So:
  peer to peer for play among friends; a hosted referee for anything
  competitive or with something at stake.

**Across engines.** A Three.js world and a Godot world won't compute the
same bounce from the same push: their physics engines differ. That doesn't
matter if one device is in charge of each thing and the others only draw
what it says, which is why that is the plan rather than everyone
simulating and hoping to agree.

## What "low and medium fidelity" can mean in practice

- **Low:** a few dozen objects that can be pushed, carried, thrown,
  stacked. Ten to twenty updates a second. Works peer to peer on a
  headset.
- **Medium:** a hundred or so, vehicles, a ball game. Fewer updates for
  things far away or at rest, more for things near and fast. Probably
  wants a room server once more than a handful of people play.
- **Not in reach peer to peer:** many fast objects with exact collisions
  between players (a shooter). That is a world's own multiplayer server
  (§9.9).

## The kit's half

- One physics library shipped in the kit (to be chosen; it must run in a
  headset's browser and be small), with a short list of kinds of thing: a
  box that can be pushed, a ball that bounces, a thing that can be held.
- One way of keeping a thing in step: who is in charge, what is sent,
  how others draw it, how charge passes on, as messages with vectors so
  the engine script and Godot do the same.
- Items (NSWP-17) already say "my hit box"; a held item uses the same
  path, so an item thrown in one world behaves like one thrown in
  another.

## Open, for the owner

- Casual first (last toucher in charge) or games first (host in charge)?
  The orchestrator's opinion: casual first. It needs no server and is
  what most worlds want; games then add a referee.
- Is a room server something you'd run, or only something a world's
  owner might?

## Must not

- Promise that everyone sees the same frame.
- Call a peer-to-peer game fair.
- Make the protocol require a physics engine. This is the kit's offer.
