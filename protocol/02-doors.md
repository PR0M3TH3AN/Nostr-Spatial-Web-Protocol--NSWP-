# NSWP-02: Doors and the Airlock

**Status:** Implemented · **Schema:** [`portal`](../schemas/portal.schema.json) · **Vectors:** [`portals`](../vectors/portals.json), [`destinations`](../vectors/destinations.json) · **Code:** [`portal.ts`](../packages/core/src/portal.ts), [`destination.ts`](../packages/core/src/destination.ts), SDK [`index.ts`](../packages/sdk/src/index.ts)

A door (the spec calls it a portal) is a link from one place to another. A
world can't be trusted to say where its own doors lead, and a web page can't
draw anything trustworthy inside someone else's VR session. So every crossing
stops on a plain page the visitor's own client controls: the **Airlock**.

## A destination

```json
{
  "schema": "nswp/portal/0.3",
  "label": "Enter the Art Gallery",
  "destination": {
    "naddr": "naddr1…",
    "url": "https://gallery.example/world",
    "entry_point": "main-entrance"
  }
}
```

A destination has an `naddr` (a world's coordinate), a `url`, or both, and
optionally a named entry point.

- When both are present the `naddr` wins. The client resolves it, compares the
  announcement's `r` with `url`, and treats a mismatch as a warning.
- A bare `url` is always shown as an unlisted destination.
- Destinations are `https` only. Everything else (`javascript:`, `data:`,
  `file:` and the rest) is refused before anything is done with the value.

## Going through

A world sends the visitor to an Airlock with the destination in the
**fragment**, never the query string, so no server logs where anyone went:

```text
<airlock>#to=<naddr or url>&url=<url, when both are given>&entry=<entry point>&xr=1
```

Each value is percent-encoded. `xr=1` is there only when the visitor is in a
headset session as they leave, which the world ends first. It lets the next
place offer the way back into one at once.

### Which Airlock

1. **The one the visitor came from.** The arrival context carries a return
   address ([NSWP-03](03-arrival.md)). The world remembers it for the browser
   tab's session and sends its doors back there.
2. **The world's default,** when there is no return address: the `airlock` in
   its manifest.
3. **A built-in screen,** when there is neither: the destination's origin, a
   confirm button, nothing else.

### Going home

An Airlock opened with **no destination** takes the visitor to that client's
start place, with no confirmation, since nothing is being crossed into. It is
still the way home if the fragment says `xr=1` and nothing else. A
world offers this wherever the visitor can reach it. It is the one exit a
world can offer that leads somewhere the visitor already trusts.

## What an Airlock does

Before the visitor commits, it shows:

1. The real destination, with the **registrable domain** emphasised. That
   comes from the Public Suffix List including its private section, so two
   sites under `vercel.app` don't display as the same domain.
2. Whether the world is verified for that address, or only listed and by whom,
   and a warning if the verified key has changed since the last visit.
3. The world's name, what kind of place it is, its intensity, any content
   warning, any price, and whether this device can run it.
4. How the visitor will go: anonymously, or as themselves, and wearing which
   look ([NSWP-05](05-looks.md)).

Then it waits for a **gesture**.

Hard rules:

- It is a static page with no analytics and no server side. Anyone can host one.
- It never forwards on its own to a destination the visitor hasn't approved
  before. Otherwise it is an open redirect carrying the client's good name.
- It navigates with `no-referrer`, so the destination doesn't learn where the
  visitor came from.

**The fast path.** An Airlock may skip its confirmation, showing the
destination for a moment with a way to cancel, only when the destination is a
verified world the visitor approved before, the key hasn't changed, there are
no warnings, and nothing is being paid.

## What every door shows

Wherever a destination is offered (a lobby, a door inside a world, the
Airlock), the visitor is shown, before committing: the real address as its
registrable domain; verified or only listed, and by whom; the world's name;
what kind of place it is; its intensity when stated; any content warning; any
price; and whether this device can run it.

A door inside a world is drawn by that world, so it is the world's word. The
Airlock repeats it, which is why the Airlock is never skipped for a
destination the visitor hasn't approved.

## How many actions a crossing takes

Between two sites a browser shows flat pages, and it won't let a page start a
headset session unasked. No world can change that. What everyone on the way
can do is ask for nothing more.

| Step | Whose page | Asks for |
|---|---|---|
| Leave | The world | One action: selecting a door, or walking through it |
| Confirm | The visitor's Airlock | One. None for a verified world they approved before |
| Arrive | The destination | One, to go back into the headset. None on a flat screen, and none where the browser carries the session over |

So a crossing in a headset is three actions at most, two to a familiar world,
and one where the browser allows it. Each party keeps its own count down:

**A world, as the visitor leaves**

- Goes at once. No "are you sure?", no farewell screen, nothing to dismiss:
  the Airlock is the confirmation, and it is the visitor's own.
- Says `xr=1` if they were in a headset session.

**An Airlock**

- Asks one thing: whether to go. Everything else on it is already chosen, the
  way the visitor chose last time, and none of it needs a second action.
- Passes `immersive` on in the arrival context ([NSWP-03](03-arrival.md)) when
  it was told `xr=1`.
- Skips its question, with a moment to cancel, for a verified world the
  visitor has approved before.

**A world, as the visitor arrives**

- When the arrival says `immersive`, the way back into the headset is the
  first thing on the page: alone, large enough to hit with a controller on
  the browser's flat panel, and ready before the world has finished loading.
- Asks nothing else on arriving. No splash, no "click to begin", no consent
  wall, no sign-in.
- Listens for `sessiongranted`. Where a browser gives it, the session carries
  over and there is nothing to ask at all. Few browsers do yet.
- Lets the visitor in before it is ready, and finishes loading behind the
  chamber's doors.

## The chamber

The two ends of a crossing can be the same place. The reference SDK ships a
small round room for it. As a visitor leaves, its walls rise round them and
the sign over its doors names where they are going. They arrive standing in
the same room, and its doors open onto the new world when that world is
ready. The flat pages in between are the lift moving.

**It is scenery, and it proves nothing.** The world a visitor is standing in
draws it, so a dishonest world can draw it any way it likes. So:

- It never asks for anything and has nothing in it to press. A chamber with a
  "continue" in it would be a world pretending to be an Airlock.
- It never says a destination is verified. It shows the address as the world
  names it, and says the visitor's Airlock checks it next.
- It never delays a departure. The reference one is shut in about half a
  second, and the visitor leaves even if it fails to draw.
- It is skipped for someone who has asked for less motion.

A world may draw a chamber of its own, or none. `createCrossing` in
`nswp-sdk/three` is the reference one.

## What this does not do

A hostile world is a website, and a website can navigate anywhere without
asking. The Airlock guarantees that crossings made through honest doors are
checked, and that the visitor has one known place to judge a destination. A
world that asks for a sign-in in the middle of a crossing is the warning sign:
the visitor is already signed in at their real Airlock.

## In code

```js
import { portal } from "nswp-sdk";
portal.go({ naddr: "naddr1…", url: "https://gallery.example/world", entryPoint: "main-entrance" });
portal.home();
```

Both say `xr=1` when given the session to end: `portal.go(dest, { xrSession })`.

## Not decided

Whether browsers will carry a headset session across a crossing between
different sites. Until one does, the action on arriving can't be removed, only
made the one thing asked. Background and reasoning: [`spec.md`](../spec.md) §6.
