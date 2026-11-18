# NSWP-04: Previews

**Status:** Implemented · **Kinds:** a tag on 37300 · **Vectors:** [`world-events`](../vectors/world-events.json) · **Code:** [`world.ts`](../packages/core/src/world.ts) (`checkPreviewBytes`), SDK `capturePanorama`, `createPortalWindow`

A preview is what a visitor would see standing at a world's entry point. A
client draws it as the view through a door, so a door looks into the place it
leads to.

## The tag

On the world's announcement ([NSWP-01](01-worlds.md)):

```text
["preview", "<address>", "<type>", "<sha256>", "<width>x<height>"]
```

| Type | What it is | Ceiling |
|---|---|---|
| `pano` | A 360° still, equirectangular, twice as wide as tall, taken from the default entry point at eye height. The middle of the image looks along -Z | 4096 × 2048, 2 MB |
| `flat` | An ordinary picture | 1920 × 1080, 500 KB |

A world may give one of each. WebP, JPEG or PNG.

## Rules

- **The hash is required.** It is inside the signed announcement. A client
  checks the bytes it received against it and refuses a mismatch, so any
  mirror can serve the file.
- **Not from the world's own server while it is only listed.** Loading a
  picture tells its host that someone is looking. A client fetches a listed
  world's preview from a mirror or content-addressed storage, never from the
  world's origin. A preview that exists only on the world's own site is
  fetched when the visitor opens that world's door, not before.
- **Ceilings are enforced by the client,** whatever the announcement claims.
- **Consent.** A preview is content shown before the visitor chose to go
  anywhere. A client shows one unasked only for a world that reached the
  visitor through something they chose: a list they follow, their own saved
  doors, or a door in a world they are standing in. For any other world, and
  for any world with a `content-warning`, it shows a placeholder until asked.
- **A preview is a claim.** It is the publisher's own picture. Being verified
  doesn't make it honest, and the Airlock still shows the real address.
- **Without one,** a client draws a placeholder generated from the world's
  address.

## Making and drawing one

- A capture leaves out anything about one visitor, and leaves out the views
  through the world's own doors. A preview that held another world's preview
  would change whenever either was retaken.
- Drawn as a true window, a door seen from across a room shows only a few
  degrees of the destination. A client should work out the view as if the
  visitor stood no more than about 1.5 m from the door.

## Not decided

Where exactly the consent line falls (Q26). Richer forms, such as stereo
panoramas (Q22). Background and reasoning: [`spec.md`](../spec.md) §5.7, §5.8.
