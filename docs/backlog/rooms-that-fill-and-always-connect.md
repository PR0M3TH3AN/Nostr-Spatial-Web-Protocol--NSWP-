# Rooms that fill one at a time, and two people who always connect

- **Asked:** 2026-11-25, by the owner: "multiplayer is not working for
  some reason. I cant seem to join the grove with a guest computer. they
  are both in a "room". Are the lobbies working correctly where we join
  everyone into the same room so long as there are spots avalable?"
- **Who:** the NSWP builder (the kit's rooms, `packages/sdk/src/room.ts`);
  a relay server for connections is a new hosted thing, the owner's word
  first.
- **State:** the cause found (below); the builder builds (2), (4), (3) in
  that order; TURN priced (below), set up only on the owner's word. Part 2
  (said when it fails, `unreached`) built 2026-11-25, not merged.

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

## TURN, priced (the orchestrator, 2026-11-25, at the owner's "Price Turn")

- **Cloudflare Realtime TURN:** $0.05 a GB of data sent from Cloudflare to
  the visitor, the first 1,000 GB a month free (shared with Cloudflare's
  SFU); their STUN, which the kit already uses, stays free.
- **What that buys, roughly:** only pairs that can't connect directly go
  through it. Voice and positions are about 60 kbit/s a direction, so a
  relayed pair talking for an hour is about 55 MB: the free 1,000 GB is
  some 18,000 such hours a month, and past it about a third of a cent an
  hour. A shared screen is far more (about 1 GB an hour for each watcher
  through it).
- **What it needs:** a Cloudflare TURN key in the owner's Cloudflare
  account (he has one for the domain's DNS), made and typed by him; a
  small Worker that holds it and hands a visitor credentials good for a
  few hours (`iceFrom`); a spending alert. A new host resource: his word
  before any of it is made.

## TURN, the setup plan (the owner, 2026-11-25: "Yes, plan it")

From Cloudflare's docs (realtime/turn/generate-credentials and its FAQ):
a TURN key is a long-term secret, a key id and an API token, kept on a
server; the server asks
`POST https://rtc.live.cloudflare.com/v1/turn/keys/<key id>/credentials/generate-ice-servers`
(`Authorization: Bearer <API token>`, body `{"ttl": seconds}`, at most 48
hours) and gets back `{ iceServers: [...] }` to hand to the page as it is.
Credentials can be revoked by username. No spending cap or alert was found
in those pages.

**Built by the NSWP builder, before anything is made at Cloudflare:**

1. **`services/ice/`**, a small Cloudflare Worker in this repository:
   `GET /` answers `{ iceServers, ttl }` for a page on a bitblocks.network
   address (its `Origin` checked; anything else refused), asking
   Cloudflare with the key it holds as two secrets, `TURN_KEY_ID` and
   `TURN_KEY_API_TOKEN`. Credentials last 6 hours; the kit asks again
   before they run out (`setConfiguration`). Port-53 addresses left out.
2. **Its own limits, since Cloudflare has no cap:** a few asks a minute
   from one address; a daily count of credentials, past which it answers
   STUN only (rooms carry on as today) and says so in its log. The count
   is its config, the owner's to set.
3. **The kit:** `iceFrom` asked at join, at most once per room per visit;
   if it doesn't answer in 3 seconds, STUN only. Tests against a stand-in
   Worker only.

**Then the owner, in this order, each on his own word:**

4. In the Cloudflare dashboard (Realtime, TURN), make a TURN key named
   `bitblocks-rooms`. Its id and token are typed by him alone, into the
   Worker's secrets (`npx wrangler secret put TURN_KEY_ID`, then
   `TURN_KEY_API_TOKEN`, in `services/ice/`), never in a chat, a file or
   a commit.
5. His word to deploy the Worker (at first on its workers.dev address;
   a bitblocks.network address needs a DNS record, his too).
6. One trial with two visitors whose direct way is blocked, through the
   real TURN: a few megabytes, inside the free 1,000 GB; his word for it.
7. The kit's default `iceFrom` set to the Worker in the next kit version,
   deployed on his word as every version is.
8. Afterwards: the orchestrator reads the TURN usage in Cloudflare's
   analytics weekly and tells him the gigabytes used.

## Must not

- Send a room's talk or video anywhere but the relay chosen, encrypted as
  WebRTC always is; no recording on it.
- Put a TURN key in a page, a world, or a commit.
