# NSWP-09: What a world owes a visitor

**Status:** Implemented in the reference SDK; a world may meet it its own way · **Code:** SDK [`ui/model.ts`](../packages/sdk/src/ui/model.ts), [`three.ts`](../packages/sdk/src/three.ts) · **Guides:** [`controls-kit.md`](../docs/controls-kit.md), [`headset-checklist.md`](../docs/headset-checklist.md)

While a visitor is in a world, only that world's page is running. Their own
client is not there, and a web page can't draw over another site's VR session.
So the few things every visitor needs are not laid over a world by anyone.
They are things every world agrees to offer, drawn by the world itself.

The world leads. These stay out of the way of what it is doing, and are never
more than one deliberate action away.

## What a visitor can always do

| A visitor can always | Why |
|---|---|
| Go home, when they arrived with somewhere to return to ([NSWP-02](02-doors.md)) | The one exit that leads somewhere they already trust |
| Leave VR | Without reaching for the headset's own controls |
| See whether they are in a room and whether their microphone is on; leave the room; turn the microphone off ([NSWP-06](06-rooms.md)) | Being heard without knowing it is the worst failure a shared place has |
| See when someone in the room is recording what they see | Being recorded without knowing it is the next worst |
| Turn and move without turning their body or walking | Some visitors are seated |
| See the address of the world they are in | It is the world's word about itself, but its absence is a warning sign |

A world may put these anywhere: a pause menu, a wall, a wrist. It may add as
much of its own as it likes. It may not leave one out, or bury one more than a
single deliberate action deep. In a headset that is one `select`; on a flat
screen, one click or key.

## What a world never does

- **Navigate a visitor away itself.** A way out goes through their Airlock
  ([NSWP-02](02-doors.md)), which shows them where they are going.
- **Ask for a password, a recovery phrase or a sign-in.** A visitor never
  types a credential inside a world or in the middle of a crossing. A world
  that asks looks exactly like a phishing page, because immersive content can
  imitate any interface.
- **Treat a claim as a permission.** Capability and comfort tags, a look, and
  an unverified identity are things said, not things proven.

## In a headset

- Every action is one `select`, so a trigger, a pinch and gaze-and-pinch all
  work. Nothing needs a particular controller's buttons.
- The controls are reachable inside the session. The page can't be seen there.
- Moving is by stepping to a pointed-at spot, a jump and not a slide.
- **Arriving costs one action at most.** A visitor who left a headset session
  to get here is offered the way back in first, large and alone, and is asked
  nothing else ([NSWP-02](02-doors.md), "How many actions a crossing takes").
- **Sticks, grips and buttons are extras, never the only way.** A world may
  let a stick turn or move the visitor, a grip pick things up, a button open
  its menu. Anything a visitor must be able to do stays possible with one
  `select`, for the person with a single button, tracked hands or their gaze.
- **Nothing slides unless the visitor asked.** Turning and moving are in steps
  until they choose smooth, and that choice is theirs to keep or undo.
- **No request says what a visitor is holding.** A world draws controllers and
  hands itself, or loads their models from its own site. Fetching a
  controller's model from somewhere else tells that place which headset each
  visitor owns.

## How much room it takes

The reference SDK's controls kit draws the list for a world that doesn't want
to, at three levels the world chooses and can change from moment to moment:

| Level | On a flat screen | In a headset | For |
|---|---|---|---|
| Full | The world's name, a row of things always at hand, and a menu | A Menu button low in front, and a console above the wrist | A world with no interface of its own |
| Quiet | One small mark in a corner the world picks | The wrist only | A world with its own interface, or any world during play |
| Hidden | Nothing | Nothing | A world that draws the list in menus of its own |

## Levels of support

A proposed ladder, not a certification. A client can stop at any rung.

| Level | What it means |
|---|---|
| 1. Finding | Reads announcements and lists; shows what every door shows; tells verified from listed |
| 2. Going | Enters worlds through an Airlock; reads manifests; shows previews under their consent rule |
| 3. Being someone | A choice of identity per world; entry assertions; looks |
| 4. Being together | Rooms, invitations, homes |
| 5. More | Hosted rooms, moving together, paid entry |
| Always | The real address before any crossing; `https` only; the visitor's own blocks and mutes; lobby privacy; limits on what is fetched |

## Not decided

Whether any of this can be checked from outside, or only promised (Q33).
Background and reasoning: [`spec.md`](../spec.md) §11, §12.3, §21.2, §21.3.
