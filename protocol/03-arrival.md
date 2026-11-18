# NSWP-03: Arriving

**Status:** Implemented, except the `room` and `carry` fields; no client issues an entry assertion yet · **Kinds:** 27235 (entry assertion) · **Schemas:** [`arrival`](../schemas/arrival.schema.json), [`entry-assertion`](../schemas/entry-assertion.schema.json) · **Vectors:** [`arrivals`](../vectors/arrivals.json), [`assertions`](../vectors/assertions.json) · **Code:** [`arrival.ts`](../packages/core/src/arrival.ts)

A world is on a different origin from the visitor's client. It can't see their
signer and shouldn't. What it needs to know about an arriving visitor travels
with them, in the address, and only as much as they chose.

## The arrival context

The client appends `nswp=<value>` to the fragment of the destination's
address. If the address already has a fragment, the two are joined with `&`.
The value is the base64url encoding, without padding, of a JSON object:

```json
{
  "v": "nswp/arrival/0.3",
  "entry": "main-entrance",
  "airlock": "https://portal.bitblocks.network/go/",
  "look": "{\"s\":\"g0123456789abcdef01234567\",\"head\":\"tall\"}",
  "pass": { "kind": 27300, "…": "…" },
  "sessionKey": "<64 hex characters>",
  "assertion": { "kind": 27235, "…": "…" },
  "avatar": "naddr1…",
  "receipts": []
}
```

| Field | What it is |
|---|---|
| `v` | The format's version |
| `entry` | Which entry point to arrive at: 1 to 128 of `A-Z a-z 0-9 . _ -` |
| `airlock` | Where to send the visitor's next door, and the way home ([NSWP-02](02-doors.md)). `https` |
| `look` | The visitor's look, inline ([NSWP-05](05-looks.md)). At most 600 characters |
| `pass` | A pass: the visitor's identity key saying that a session key speaks for them here ([NSWP-10](10-identity.md)) |
| `sessionKey` | The secret half of that session key: a throwaway made for this trip. A pass and its key travel together or not at all; one without the other is dropped |
| `avatar` | The `naddr` of a published avatar event |
| `assertion` | An entry assertion, below |
| `receipts` | Up to 8 events proving the visitor paid for entry |

Rules for the client that sends it:

- **Only a site with a manifest gets one.** A site that hasn't adopted the
  protocol gets a plain visit, with nothing added to its address.
- **Everything about the visitor is optional,** and present only if they chose
  it at the Airlock, on this trip. `airlock` and `entry` say nothing about
  them.

Rules for the world that reads it:

- **Scrub it at once.** Read the value, then remove it from the address with
  `history.replaceState`, before loading any third-party script. Otherwise it
  stays in history and every script on the page can read it.
- **Trust none of it unread.** A value longer than 16,384 characters, or not
  JSON, is refused. A field that is malformed is dropped with a warning and
  the rest is kept: a bad `airlock` must not stop a visitor arriving.
- The return address, the look and the pass are kept for the browser tab's
  session and no longer. Arriving again without a look or a pass clears the
  one that was kept: each arrival says afresh how the visitor wants to be seen.

## The entry assertion

This is proof for a world's **server**, good for one request. Proof for the
people in a room is a pass ([NSWP-10](10-identity.md)), which is what the
reference client issues today.

A visitor who chose to arrive as themselves can carry a short-lived signed event:

```json
{
  "kind": 27235,
  "tags": [
    ["u", "https://museum.example/world"],
    ["method", "GET"],
    ["nswp:origin", "https://museum.example"],
    ["nswp:nonce", "<at least 16 characters, random>"],
    ["expiration", "<at most 60 seconds on>"]
  ],
  "content": ""
}
```

It has the shape of a NIP-98 event so existing verifiers can check it.

- It is bound to the destination's **origin** and a random nonce, and expires
  within 60 seconds.
- A world with a **server** rejects a reused event ID and any assertion for
  another origin, then issues its own session. After that it never needs the
  visitor's signer.
- A **static** world can check the signature and show a name, but can't stop a
  replay within the minute. It treats the identity as cosmetic and gates
  nothing on it.
- An anonymous arrival carries no assertion.

**What it gives away, for good.** A signature can't be taken back. An
assertion is transferable proof that this key chose to enter this world at
this time. A client says so in plain words the first time a visitor uses their
main identity.

## In code

```js
import { arrival } from "nswp-sdk";
const { context, warnings } = arrival.read(); // reads, validates and scrubs
arrival.returnAirlock();                       // for this tab
arrival.look();                                // what they chose to wear here
arrival.identity();                            // who they chose to be here, checked, or undefined
```

## Proposed, not built

`room` (joining a room on arrival, [NSWP-06](06-rooms.md)) and `"carry": false`
(asking a world not to draw what the visitor carries) are written in the spec
and are not in the schema or the library. No client yet makes an entry
assertion: the library verifies them, and the vectors cover that. Background
and reasoning: [`spec.md`](../spec.md) §4.3, §4.4.
