# Rooms that fill one at a time, and two people who always connect

- **Asked:** 2026-11-25, by the owner: "multiplayer is not working for
  some reason. I cant seem to join the grove with a guest computer. they
  are both in a "room". Are the lobbies working correctly where we join
  everyone into the same room so long as there are spots avalable?"
- **Who:** the NSWP builder (the kit's rooms, `packages/sdk/src/room.ts`);
  a relay server for connections is a new hosted thing, the owner's word
  first.
- **State:** asked; the cause found (below); the fix waits on the owner's
  choice of relay server. Part 2 (said when it fails, `unreached`) built
  2026-11-25, not merged; parts 4 and 3 next, in that order.

## What was seen (the orchestrator, 2026-11-25, listening only)

Listening on the four room relays for the Grove's room while the owner
tried: two visitors (two session keys) found each other and exchanged
their handshake for over a minute, the offer sent again every 30 seconds,
and never connected. So finding each other works; the direct connection
between the two computers fails. The kit gives a room only STUN servers
(`DEFAULT_ICE`), no TURN relay, so when two browsers can't reach each
other directly (a router that won't loop back, a browser that hides its
local address, as Brave can, or a strict network), they never connect,
and each is "in the room" alone. Nothing says so.

Also seen: one visitor reached only one of the four relays, the other
three; they overlapped on one relay only.

## Today

- One room per world address and name (default "lobby"), at most 8
  (`ROOM_LIMITS.defaultMaxMembers`). There are no further lobbies: a ninth
  visitor joins and silently sees nobody.

## Wanted

1. **Two people in a room always connect:** a TURN relay as the fallback
   when a direct connection fails, its passwords short-lived and handed
   out by a small server (never a key in a page). Which service, and its
   cost, is the owner's choice.
2. **Said when it fails:** "Couldn't connect to Ada directly; trying
   another way", and if that fails too, said plainly, not "in the room"
   alone.
3. **Rooms that fill one at a time:** everyone joins the same room while
   it has a spot; when it is full, the next visitor goes to the next room
   (a second lobby), and so on. A private room by name is untouched.
4. **The room's relays chosen as well as the rest** (relays-chosen-well):
   more than one relay in common between any two visitors.
5. A trial with two visitors where the direct way is blocked: they meet
   through the relay.

## Must not

- Send a room's talk or video anywhere but the relay chosen, encrypted as
  WebRTC always is; no recording on it.
- Put a TURN key in a page, a world, or a commit.
