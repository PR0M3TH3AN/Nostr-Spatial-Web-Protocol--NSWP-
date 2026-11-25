# A headset's own key: a proposal

**Status (2026-11-25):** a proposal, for the BitPortal builder and the orchestrator to read. Nothing in it is built.
The owner chose Way 1 for now (BitLogin's own `/headset/` page, released) and asked to explore this as Way 2.

## Why

Signing in a headset from a phone hands the headset the account's own key, as pressing Allow does for any site. In a
headset the world draws everything you see, so BitLogin now shows the code and the number on its own page outside the
world (Way 1), and you step out of VR to read it. If the headset never held the account's key, a tricked yes would give
away very little, and the code could stay in the world.

## The idea, in NSWP's own terms

A pass ([NSWP-10](../../protocol/10-identity.md)) already says "at this site, until this time, this session key speaks
for me", signed by the identity key. This proposal adds one step in front of it:

1. **A device grant** (proposed kind 27305, next to the pass's 27300; BitLogin's own pairing note is 27304), signed by
   the identity key on the person's phone, which says: "until this time, this device key
   may make passes for me, at this site or family".
2. **Passes signed by the device key**, exactly as today's passes but with the device grant beside them.

The headset's BitLogin signer holds only the device key. The account's own key stays on the phone.

```json
{
  "kind": 27305,
  "created_at": 1794430800,
  "tags": [
    ["nswp:device", "<device public key>"],
    ["nswp:origin", "https://museum.example"],
    ["expiration", "1797022800"],
    ["nswp:label", "Meta Quest Browser"]
  ],
  "content": ""
}
```

| Tag | What it is |
|---|---|
| `nswp:device` | The device's public key, 64 hex characters. Never the identity key |
| `nswp:origin` | The site, or a family as `https://*.domain`, the device may make passes for |
| `expiration` | When it stops. Proposed: 30 days at most, as BitLogin's own grants |
| `nswp:label` | Optional. What the device is called, as the phone showed it |

The arrival context ([NSWP-03](../../protocol/03-arrival.md)) then carries `pass` (signed by the device key) and
`device` (this grant, signed by the identity key), where today it carries `pass` alone.

## Checking it

A pass signed by a device key is believed only when all of today's checks hold, and also:

- the device grant is a validly signed event of kind 27305 by the identity, and that identity is the one shown;
- the pass is signed by the grant's `nswp:device` key;
- the reader's origin is the grant's origin, or in its family;
- the grant's `expiration` is in the future, and no more than 30 days after its `created_at`;
- the device key isn't on the identity's list of devices signed out (below).

A pass that fails is ignored, as today, and its owner stays a guest.

## What the device key can and can't do

| | |
|---|---|
| Passes, and so being themselves in a room | **Yes** |
| A world's saves, scores and achievements made in that world | **Yes**, once each kind is taught to accept a device pass. Saves sealed to the identity key can't be opened by the device key: an open question, below |
| Notes and reactions in the world | **In the world only.** Elsewhere on Nostr they would show as the device key, so a headset wouldn't offer public posts, or would ask the phone |
| Private messages, the ecash wallet, the Connection Vault | **No**: they belong to the identity key, which isn't on the headset |

## Signing a device out

The phone signs the device out by publishing a list of device keys signed out, a replaceable event by the identity
(proposed kind 37312, `d` = `nswp-devices-out`: 37305 is ratings, and 37309 to 37311 are the agents pack's candidates). Worlds check it at arrival, from the identity's relays, at most once a
day per identity. It names public device keys only. The device grant's expiry is the backstop where no relay answers.

## What it changes, and for whom

- **NSWP:** NSWP-10 (the pass, its checks, the new kind and list), NSWP-03 (the arrival context's `device`), and the
  vectors.
- **BitPortal's kit and every world that checks passes:** they check the device grant, and fetch the sign-out list.
- **BitLogin:** the phone makes the device key and signs the grant. The headset's signer holds the device key and signs
  passes with it, and refuses anything that needs the identity key.

## Open questions

1. **Saves:** sealed to the identity key today ([NSWP-12](../../protocol/12-saves.md)). Should a device key get its own
   saves, or should the phone seal a world's save key to the device?
2. **How long a grant lasts:** 30 days, as BitLogin's grants, or shorter with renewal (which needs the phone).
3. **Public notes from a headset:** not offered, or asked of the phone.
4. **NIP-26**, Nostr's own delegation: it would let other Nostr apps believe a device's notes. Few honour it, so it's
   not proposed here.
5. **Whether worlds outside BitPortal adopt it.** Until they do, a headset signed in this way is a guest there.

## Next

The builder and the orchestrator read this. If it's taken up, the next step is the protocol text and its vectors,
before anything is built.
