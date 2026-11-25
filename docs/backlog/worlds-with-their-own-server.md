# Worlds with their own server

- **Asked:** 2026-11-25, by the owner: "so this TURN would be how we could
  have worlds expand to external servers if they wanted one central
  server or wanted more players in a world than p2p would allow?", then,
  told it is a different piece: "make world servers a think we work
  towards."
- **Who:** a design first (the orchestrator with the owner, the NSWP
  builder); then the kit, the protocol, and one reference server.
- **State:** asked; something to work towards. Design not started.

## Why

A room today is peer to peer: each visitor sends to every other, so a
room stops at 8 (`ROOM_LIMITS.defaultMaxMembers`) and nobody holds the one
true copy of anything. TURN (rooms-that-fill-and-always-connect) only
carries one pair's traffic when they can't meet directly; it doesn't make
a room bigger. The owner's standing rule is that every decision assumes
big worlds full of players, NPCs and agents.

## Wanted

- **A world may name its own server** in its manifest, and the kit
  connects visitors to it instead of, or beside, peer to peer. A world
  that names none stays free and peer to peer, as now.
- **Two kinds, either or both:**
  - a **game server**: each visitor sends their state once and gets back
    the people near them, so a world holds hundreds; and, where the world
    wants it, the one true copy of items, hits, health and scores;
  - a **voice and video server** (an SFU): each voice sent once and
    passed to whoever should hear it.
- **Nostr keeps its jobs:** finding the world, who someone is (passes,
  BitLogin), the lobby, items in the Bag, notes. A server never needs a
  visitor's key; it takes the pass, as a room does.
- **Run by whoever owns the world,** on any host; BitPortal's own worlds
  may run one. A reference server in this repository, small enough for
  one person to run.
- **The same kit calls** for a world either way (`presence`, people,
  chat), so a world can move from peer to peer to a server without being
  rewritten.

## For the design to settle

- What the manifest says (an address, which kinds, which passes it
  takes), and its name, given by the orchestrator.
- How "near" is chosen for a big world (areas, distance, who is talking).
- Which state the server holds as the one true copy, and how an item in
  the Bag (a Nostr note) and an item in a server's world agree.
- Where agents run: on the server, so a world full of them doesn't need
  each visitor's computer to run them.
- What a visitor is told and asked: that this world has a server, run by
  whom, and what it sees (their address, what they say aloud).

## Must not

- Make a server needed for a world that doesn't want one.
- Give a server a visitor's key, or let it sign for them.
