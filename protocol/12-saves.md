# NSWP-12: Saves

**Status:** Implemented in the reference library and SDK; a signer has to implement its side before a save reaches an account (BitLogin's is not built yet: until it is, a save stays on the device) · **Kinds:** 37304 · **Vectors:** [`saves`](../vectors/saves.json) · **Code:** core [`save.ts`](../packages/core/src/save.ts), [`signing.ts`](../packages/core/src/signing.ts); SDK [`saves.ts`](../packages/sdk/src/saves.ts), [`signer.ts`](../packages/sdk/src/signer.ts) · **Guides:** [`controls-kit.md`](../docs/controls-kit.md), [`other-engines.md`](../docs/other-engines.md)

A world may have something to remember for its visitor: how far they got,
what they chose, what they built. A **save** is that, kept with the
visitor's own account so that it is there on their next device, in a form
any world can use and no world can abuse.

Saves are optional. A world that keeps nothing owes nothing here.

## Three rules

1. **A save is the visitor's.** It is a note signed by their key, on their
   own relays. No world and no service holds it for them, and it outlives
   the world's own server.
2. **Only the visitor can read it.** It is encrypted to their own key
   (NIP-44). What is on a relay doesn't say which world it is from, what is
   in it, or what slot it fills.
3. **A world reaches its own saves and nobody else's.** A world never names
   where a save is kept. The visitor's signer works that out from the
   address of the world that asked.

## The note

A save is addressable (experimental kind **37304**), so a relay keeps the
newest for each address:

```json
{
  "kind": 37304,
  "tags": [
    ["d", "<64 hex: where this world's save in this slot is kept>"],
    ["alt", "Something a world keeps for its visitor. Only they can read it."]
  ],
  "content": "<NIP-44, to the visitor's own key>"
}
```

**The address** (`d`) is

```text
HMAC-SHA256(key: K, message: "nswp-save\n" + <the world's origin> + "\n" + <slot>)
```

in lower-case hex, where `K` is the NIP-44 conversation key of the visitor's
key with itself, the origin is the world's (`https://arcade.example`, no
path), and the slot is the world's name for one save. Only the visitor's
signer can work it out, so nobody else can tell which worlds a person has
saves in, or find one to ask for.

**What is encrypted** is JSON:

```json
{ "v": 1, "world": "https://arcade.example", "slot": "main", "data": "<the world's own text>" }
```

`data` is text, in whatever shape the world likes; JSON is the usual choice.
The world and the slot are written inside as well as in the address, so that
opening a save checks them twice.

**Limits**

| | |
|---|---|
| `data` | 32,768 bytes of UTF-8. It has to fit in one note that any relay will take |
| A slot's name | Lower-case letters, digits and hyphens; 32 at most; starts with a letter or digit. `main` when a world names none |
| How often | 6 saves a minute and 60 an hour for one world. Counted apart from notes and passes |

A world with more to keep than that keeps it itself, and saves where it is.
An empty `data` clears a slot.

## What a world says to the signer

Three more messages in the conversation of
[NSWP-10](10-identity.md), "Signing from a world". All need the signer to be
unlocked for that world; otherwise, and for anything malformed, the answer
is `refused`, with no reason.

| From the world | The signer answers |
|---|---|
| `save`, with `slot` and `data` | `signed`, with the whole signed save. The signer works out the address, encrypts, sets the time and signs. The world sends it to the visitor's relays |
| `find`, with `slot` | `found`, with `d`: where this world's save in that slot is kept, for the world to ask a relay |
| `open`, with `event`: a save a relay gave it | `opened`, with `slot`, `data` and `at` (when it was saved, in seconds) |

**What the signer checks before it opens one:**

1. The signature, and that it is the visitor's own key's.
2. That it is kind 37304.
3. That it decrypts, and what is inside says `world` is the origin of the
   page that is asking. The signer takes that origin from the browser, never
   from the message.
4. That its `d` is the address of that world's slot, as the signer itself
   works it out.

So a world that gets hold of another world's save (they are on public
relays, though it can't tell which is which) is refused when it asks to have
it opened.

**A world can't have a save signed any other way.** Asking `sign` for kind
37304 is refused like any kind that isn't a note or a reaction. Application
data (kind 30078), where a client keeps its own, stays out of a world's
reach as before.

A signer that doesn't keep saves says nothing to these. The world then keeps
the save on the device, and says so.

## What a world does

- **Keeps it on the device first.** A save is written to the device at once,
  whoever the visitor is, and to their account after. A closed tab or a
  relay that is down loses nothing.
- **Sends it to the visitor's own relays:** the ones their relay list says
  they write to (NIP-65), or the usual ones if they have published none.
- **Loads the newer** of the device's copy and the account's. A world that
  needs more than "newest wins" keeps what it needs to decide in `data`.
- **Says where it was kept** when that matters to the visitor: with their
  account, or on this device only.
- **Asks nothing of a guest.** A guest's save stays on the device. Once
  they sign in, loading it takes it up into their account, as it does any
  save the device has that is newer than the account's.

## What it gives away

- **To a relay:** that this key has saved something, how big it is and when.
  Not where, and not what.
- **To the world:** nothing it didn't write itself. It learns the address of
  its own slots, which only it and the visitor's signer can use.
- **To another world:** nothing. It can't find this world's saves, and can't
  have one opened.

A world that the visitor has signed in to already knows their key. Saving
adds nothing to what it knows about them.

## In code

```ts
import { worldSaves } from "nswp-sdk/three";

const saves = worldSaves();
const last = await saves.load();                    // { data, at, from } or null
const r = await saves.save(JSON.stringify(state));  // { kept: "account" | "device" | "nowhere", said }
await saves.clear("run-2");
```

In another engine, `NSWP.save(data, slot)` and `NSWP.load(slot)`, answered
by `saved` and `loaded` events ([other-engines.md](../docs/other-engines.md)).

For a signer: `saveAddress`, `sealSave` and `openSave` in the core are the
whole of its side, and [`vectors/saves.json`](../vectors/saves.json) has an
address, a sealed save and what must be refused.

## Proposed, not built

- **Saves larger than one note:** a save that points at a file kept by hash,
  encrypted the same way.
- **A list of a visitor's saves at home:** where they could see how many
  they have, by world, and remove one. The signer can work out the address
  for any world the visitor names; it can't list worlds it was never told.
- **Removing a save from relays.** Clearing a slot replaces it with an empty
  save. A deletion (NIP-09) is a kind a world may not have signed.
