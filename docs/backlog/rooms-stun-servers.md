# Every room asks Cloudflare's and Google's STUN servers

- **Asked:** 2026-11-21, found by the NSWP builder while sealing a trial
  (not the owner's words; written down so it isn't lost).
- **Who:** not briefed. The kit (`room.ts`).
- **State:** asked

To connect people directly, a browser asks a STUN server for its own
public address. The kit's rooms default to Cloudflare's and Google's public
STUN servers, so each of them learns the address of everyone who joins a
room, and when. The spec already says a direct connection shows a member's
address to the others and that the Airlock says so before an open room
(§9.4); it doesn't say two outside companies see it too.

## To decide when briefed

- Say it plainly where joining is explained.
- Offer a STUN server of our own (or the world's, from its manifest, which
  the spec already allows) before the public ones, or instead of them.
- Whether the visitor can choose "relay only" (§9.4), which hides their
  address from the other members too.

## Must not

Change who is contacted without saying so in the words a visitor reads
before joining.
