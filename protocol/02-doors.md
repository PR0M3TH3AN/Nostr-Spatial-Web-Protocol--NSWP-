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
<airlock>#to=<naddr or url>&url=<url, when both are given>&entry=<entry point>&xr=1&moving=intense&joined=1&mic=1&form=touch&set=<settings>&blocked=<key>,<key>
```

Each value is percent-encoded. `xr=1` is there only when the visitor is in a
headset session as they leave, which the world ends first. It lets the next
place offer the way back into one at once.

`joined=1` is there only when the visitor is in the world's open room as they
leave, and `mic=1`, only beside it, when their microphone is on. They are
what lets someone stay among people from one world to the next ("Staying
joined", below).

`moving=intense` is there when the visitor has chosen the intense way of
moving, so that they needn't choose it again in every world ("How a visitor
moves", below).

`form=touch` or `form=desk` says what the visitor was using a flat screen
with, so that they arrive laid out the same way
([NSWP-11](11-the-visitors-console.md), "The same form on the other side").
It is not sent on the way home.

`set=<settings>` is the visitor's settings as they leave: their volumes, the
size of their text, whether things move, their hands in a headset, whether
their screen was filled. The place they arrive starts from them
([NSWP-11](11-the-visitors-console.md), "Settings that travel"). It is sent
on the way home too.

`blocked` is there only when the visitor blocked someone in this world during
this visit: the identity keys of the people, as hex, at most sixteen
("Blocks that travel", below).

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

A client may let a visitor choose where they start: a world of their own
([NSWP-07](07-homes.md)). Then home and the place their client keeps their
doors are two places. An Airlock opened with no destination and `doors=1`
takes the visitor to their doors: the client's own place, never a world. A
client with one place for both takes them there either way. `doors=1`,
`xr=1`, `moving=intense`, `joined=1`, `mic=1`, `set` and `blocked` may come
together, and nothing else may.

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

## Staying joined

Someone in a room with other people, who walks through a door, expects to
still be with people on the other side. Asking them to join again in every
world is the kind of small thing that makes a place feel like separate
websites. So being joined can travel, and so can a microphone that is on.

It travels as a claim, and the rules are about who may make it and who may
act on it:

- **A world says it** by adding `joined=1` to the link it sends the visitor
  through, and `mic=1` beside it. It says so only for its **open** room. A
  private room does not travel: the open room in the next world is other
  people.
- **A link is something anyone can write.** A link in a message can say
  `joined=1&mic=1` as easily as a world can. So neither flag is ever an
  instruction to the destination. The visitor's own client reads them and
  decides.
- **Joined** may be passed on by default. Being seen in a room is what
  joining was, the visitor is told the moment they arrive, and leaving is one
  press. The client shows it on its screen and lets them say no there.
- **A microphone is passed on only when the visitor has said, in their own
  client, that theirs may stay on as they travel.** Off until they say so,
  and remembered once they do. Without that, a link somebody sent could put
  a live microphone into a room of strangers. A microphone never travels
  without joined.
- **The destination trusts its arrival context, not the link.** It joins its
  open room when the arrival says `joined`, and turns the microphone on when
  it says `mic` and the browser allows that site a microphone at all
  ([NSWP-03](03-arrival.md)). It says both to the visitor at once.
- **On the way home** nothing is asked, so joined goes along and a microphone
  goes only when the visitor had already said it may.

## How a visitor moves

There are two ways to move, and people are firmly of one kind or the other.
The menu calls them the same thing wherever the visitor is:

| | Casual | Intense |
|---|---|---|
| At a desk | Click where you want to stand, drag to look round | The mouse looks, keys walk and run, a key uses what is in front of you |
| In a headset | Point at the floor to step there, turn a notch at a time, the view narrowed while moving | One stick walks and the other turns, smoothly, with the whole view |

Casual is what a visitor gets. Having chosen intense, nobody wants to choose
it again at every door.

- **A world says** `moving=intense` on the link when its visitor is moving
  that way, on the device they are using.
- **The visitor's client passes it on** as `moving` in the arrival context
  ([NSWP-03](03-arrival.md)).
- **A world that offers the two ways starts them in it, with nothing to
  press first.** A browser hands a page the pointer only after a press, and
  a visitor who has just arrived has pressed nothing. That is no reason to
  put them back to the casual way: the mouse looks round at once, and the
  pointer is taken at their first key or click without their being asked.
- **It is for the device they arrive on:** in a headset if they left one (`immersive`), at a desk
  otherwise. Choosing intense at a desk never makes a headset slide: that is
  a different choice, and one that makes some people ill.
- **It is a preference and nothing more.** It gives a world nothing, takes
  nothing from the visitor, and is theirs to change the moment they arrive.
  A link that says it falsely has changed a setting. So, unlike a
  microphone or a block, there is nothing here for a client to ask about.

## Blocks that travel

A visitor who blocks someone in one world expects not to meet them in the
next. But each world is its own site, and one site can tell another nothing.
The one thing that goes everywhere a visitor goes is their own client. So a
block that travels is a list the client keeps.

- **A world reports** who its visitor blocked there, during this visit, on
  the link it sends them through: `blocked=<key>,<key>`. Identity keys only:
  people who came by name. A guest is a new key every visit, and no list can
  follow one.
- **A report is a link, and anyone can write a link.** One in a message could
  name a visitor's friends. So a client never adds to its list unseen. It
  shows who, and adds them only when the visitor says so. It doesn't hurry
  past that question, and where there is no screen to ask on (the way home)
  the report waits.
- **Nobody is ever taken off the list by a link.** That is done in the
  client, by the visitor.
- **The client hands the list on** in the arrival context, as `blocked`
  ([NSWP-03](03-arrival.md)). The world leaves the visitor unconnected to
  anyone on it, for that visit, and keeps nothing.
- **The cost, said plainly.** Each world a visitor arrives in learns the keys
  on their list. A client says so where the list is shown.
- **What it doesn't do.** It hides two people from each other. The blocked
  person is still in the room for everyone else: removing someone is for a
  room's host.

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
- A door is **chosen from near it**: in the reference SDK, within ten feet.
  Further off, a door doesn't answer to being pointed at or pressed, so a
  stray click across a room is not a crossing. Walking into a doorway always
  goes through, and moving the intense way it is the only way through one.
- It comes up for a door **chosen from where the visitor stands**: a click, a
  trigger, the menu. A visitor who **walks into** a doorway is already going
  through it, so nothing is brought up round them and they go at once. Either
  way they arrive standing in the room at the other end, and its doors open
  onto the new world.

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

Both say `joined=1`, `mic=1` and `blocked` when given them:
`portal.go(dest, { xrSession, ...room.travelling() })`, where `room` is what
`addRoomControls` returned.

## Not decided

Whether browsers will carry a headset session across a crossing between
different sites. Until one does, the action on arriving can't be removed, only
made the one thing asked. Background and reasoning: [`spec.md`](../spec.md) §6.
