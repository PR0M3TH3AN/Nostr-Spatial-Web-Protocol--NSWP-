# Seated and vehicle mode: a design

**Status:** a design, answered by the orchestrator on 2026-11-22 (section 8 gives the
names, and section 2 holds the answers); being built in section 7's order, the fade first.
NSWP builder, 2026-11-22. From `docs/backlog/game-worlds-kit-gaps.md` ("A seated or vehicle mode",
COMBATRIG's bitp-3, a VR cockpit) and the fade in
`docs/backlog/headset-casual-and-intense.md` ("A fade for jumps the kit makes"). Every
new name below is a proposal, listed at the end; none is used before it is given
(rule 11).

## 0. In one paragraph

A world like COMBATRIG puts the visitor in a seat that moves: a cockpit that walks,
turns and is thrown about. Done carelessly, that is the surest way to make someone ill.
So the kit gives a world four things:

- a **seat**: the visitor's view is fixed to a point in something that moves;
- **recentring**: their head is put back at the seat's eye point when they ask, or when
  the headset says it was recentred;
- a **comfort vignette** that darkens the edge of the view as the seat moves, harder
  the faster it turns or speeds up;
- a **fade**: a short fade to black and back, for every jump the kit makes for someone
  moving the casual way.

And it holds one rule above all of them: **a visitor moving the casual way is never moved
smoothly unless they agreed to it.** They agree at their Airlock, before they go in, or
once in the world, in the same words, if they came by a plain link.

## 1. What there is today

- **Casual and intense** (NSWP-02, "How a visitor moves"; `createXrInput` in
  `packages/sdk/src/input.ts`):
  - Casual in a headset: point at the floor to step there, and turn a notch at a time.
    The default.
  - Intense: the sticks walk and turn smoothly.
  - The choice is asked once, kept, and carried: the `headset` setting, and `moving` on
    the link.
  - **Smooth movement is never given unasked.** It is AGENTS' rule, and NSWP-02's "a
    different choice, and one that makes some people ill".
- **The vignette exists already:** a ring of dark at the edge of the view while the
  sticks slide the visitor (`input.ts`). It is on by default (`Comfort.narrow`, the
  travelling setting `narrow`) and can be turned off in Moving. It reacts only to the
  visitor's own sliding.
- **A world's comfort, in its announcement** (NSWP-01): `comfort` tags with
  `locomotion` (`stationary`, `teleport`, `smooth`, `vehicle`), `intensity` (`low`,
  `medium`, `high`) and `seated` (`supported`, `required`, `unsupported`).
- **BitPortal's Airlock** shows them as chips ("Movement: vehicle", "Seated: required")
  and asks nothing about them.
- **No seat, no recentring, no fade.** A headset step, stepping aside on arrival (spawn
  points, PR 316) and a door all cut instantly.
- **Engine worlds:** the engine script carries the menu, the settings and the sounds. The
  **Godot visitor (`nswp_visitor.gd`) has no controller movement in a headset at all**:
  it shows the view and nothing moves it.

## 2. The rule: casual is never moved smoothly unasked

"Smooth" here means any continuous movement of the visitor's view that isn't their own
head: a vehicle driving, a seat turning, a platform carrying them. A jump with a fade is
not smooth, and is always allowed.

| The visitor moves | A world that moves them smoothly (`locomotion` `smooth` or `vehicle`) |
|---|---|
| **Intense** (in a headset) | Allowed. They chose smooth movement. The vignette follows their own `narrow` setting. |
| **Casual**, and agreed at the Airlock | Allowed for this world, this visit. The vignette is on, whatever `narrow` says: it is the comfortable way, and they didn't choose otherwise. |
| **Casual**, and agreed once in this world | The same, and the world remembers it, for this world only. |
| **Casual**, and not agreed | **Never moved smoothly.** The seat holds them still: the vehicle moves, and their view jumps with a fade to keep up, or stays put while the world shows the vehicle from outside. Which of those is the world's choice. A world that says nothing gets the jumps. The kit never lets the jumps come faster than one a second (`CATCH_UP_MS`): at 120 ms each way, more would be mostly black, which is worse than either. In every case the kit refuses to slide the view. |

- **At the Airlock** (BitPortal's code; the kit gives it the words):
  - For a world whose `locomotion` is `smooth` or `vehicle`, and a visitor whose headset
    choice is casual (or not yet made), the Airlock says, before the gesture: **"This
    world moves you smoothly (in a vehicle). That makes some people unwell. Go in, and
    let it move me smoothly here"**, beside **"Go in without it"**.
  - The first carries the agreement on the link. The second goes in casual, with no
    agreement.
  - An intense visitor sees only the chip, as today.
  - A `seated: required` world adds "You'll be seated for this world: have somewhere to
    sit" to the words, whoever they are.
- **On the link and in the arrival** (NSWP-03): the field `smooth`, for this visit only,
  both ways. `smooth=1` means the visitor said yes at the Airlock; `smooth=0` means they
  said "Go in without it". Absent means a plain link.
  - The Airlock asks every time, so the visitor chooses fresh at each crossing.
  - The Airlock's answer holds for that visit, both ways. "Go in without it" holds even
    where the world kept an earlier yes from its own question; that is why the link
    carries `0` too.
  - Like `moving`, it is a preference, not a permission. Unlike `moving`, it is never
    inferred, never kept by the Airlock or by the world, and only ever set by the
    visitor's own press.
- **In the world, by a plain link** (no `smooth` on it), with a casual choice: the world
  uses the answer it kept from asking before. If it has none, the first time it would
  move them smoothly the kit asks once, in the headset, in the same words, and the world
  waits. Plain links are common (shared links, refreshes, other clients), and sending
  someone back out to an Airlock is a dead end.
  - The answer is kept for this world only, on this device, and can be changed in Moving
    ("Let this world move me smoothly: on / off").
  - It is the only answer a world keeps.
- **Desk and phone:** none of this applies. A view that moves on a flat screen is a
  different thing, and NSWP-02 already lets a desk's casual way move the view as a world
  draws it. The seat still works there (the camera rides with it); the vignette and the
  question are a headset's.

**It squares with "never slide unasked"** because asking is the whole of it: the slide
needs either the visitor's standing choice (intense) or their press for this world (the
Airlock or the one-time question). A world can't set the field itself. A link that
carries it falsely has only changed a setting the visitor can see and undo, the same
reasoning NSWP-02 gives for `moving`.

## 3. The kit's half (Three.js, `nswp-sdk/three`)

### 3.1 The seat

- **A world gives a seat:** an `Object3D` in its scene (the cockpit's chair), and an eye
  point in it (where a sitting person's eyes are, in the seat's own space).
- **Sitting in it:**
  - The kit hangs the visitor's rig from the seat, so the seat's movement is theirs.
  - It puts their head at the eye point: it offsets the rig by the difference between
    where their head is in their play space and where the eye point is. That works the
    same for someone sitting on a sofa and someone standing, since only the head is
    matched.
  - Walking, stepping and the sticks are paused while seated: the world's controls drive
    the seat. Turning a notch stays the visitor's (it turns them in the seat), unless the
    world says the seat faces one way only.
- **Standing up:** the world lets them out, and the kit puts the rig back on the floor
  where the seat is, with a fade.
- **The console still comes up,** above the wrist or from the low button, as everywhere.
  It is never blocked by being seated, and NSWP-09's "leave VR" and "go home" work
  throughout.

### 3.2 Recentring

- **On the visitor's word:** a control in the console's Moving section, "Recentre my
  seat", puts their head back at the eye point and facing the seat's forward. It is shown
  only while seated.
- **On the headset's word:** on Quest, holding the Meta button recentres the view, and
  the browser says so with a `reset` event on the reference space. The kit listens for
  it and recentres the seat, so the system's own way does the expected thing.
- With a fade in casual, and a cut in intense, as any jump.

### 3.3 The comfort vignette, driven by the seat

- **The same ring the kit already draws.** Today it reacts to the visitor's own sliding;
  it would also react to the seat's movement: its speed changing, and its turning,
  measured each frame from the seat's pose in the world. Steady speed in a straight line
  darkens little; a turn or a jolt darkens more.
- Its strength follows section 2's table: `narrow` for intense, always on for an agreed
  casual visitor.
- **A world may draw its own cockpit frame** (COMBATRIG's canopy). A fixed frame around
  the view is itself one of the best comforts, since the eye sees something that doesn't
  move. The kit's vignette sits inside it and never covers the console.

### 3.4 The fade for jumps

- **For a visitor moving the casual way,** every jump the kit makes is a short fade to
  black, the jump, and back. About 120 ms each way. The jumps are:
  - a headset step;
  - stepping aside on arrival (spawn points);
  - recentring;
  - sitting down and standing up;
  - the jumps a casual visitor's seat makes to keep up with a vehicle they didn't agree
    to ride smoothly.
- **Intense keeps the instant cut,** as the backlog says.
- **It is a full-view dark sheet** on the camera, beside the vignette, drawn the same way
  (one mesh, no extra pass). The jump happens while the view is fully dark, so nothing is
  seen to move.
- **A world's own jumps** (a respawn, a teleporter of its own) can ask for the same fade
  around a function of theirs.
- A visitor can turn it off in Moving ("Fade when I step: on / off"). It is on by default
  for casual and off for intense, and it travels with the other headset settings.

## 4. The engine and Godot half

The engine script can't draw in an engine's scene, so the drawing is the engine's.
What the script gives is the decision and the settings: the same rules, read the same
way.

- **The script** gives the engine:
  - whether this visitor may be moved smoothly here (the agreement, their choice, and
    the world's `comfort` as its manifest or announcement says);
  - the fade setting and the vignette setting, read with `kit()` as `look` and `fov`
    are today;
  - an event when they should recentre: their press in the console, or the headset's
    `reset`;
  - the one-time question for a plain link, asked in the kit's console.
- **The engine tells the script** when the visitor sits and stands, so the console shows
  "Recentre my seat" only while seated.
- **The Godot add-on:**
  - a seat node: an `XROrigin3D` hung from a world's chair, with the eye-point offset;
  - the vignette and the fade as two small shaders on the headset camera, ported from
    the kit's, as the gate's shaders already are (`gate/*.gdshader`);
  - recentring on Godot's WebXR reference-space reset signal and on the script's event.
- **The Godot visitor first needs headset movement at all** (casual steps and the
  intense sticks), which it doesn't have. That is a gap of its own, and comes before
  its seat; it's listed in section 7 as a step.

## 5. Quest 3 and 3S, in Meta's own browser, first

- `immersive-vr` with `local-floor`, which the Quest's browser gives. Seated height
  comes from matching the head to the eye point (3.1), not from `local`, so a visitor
  who sits after arriving is still at the right height after one recentre.
- The Meta button's hold-to-recentre is listened for (3.2), so the system's own way
  works.
- **Frame time:** the vignette and the fade add one transparent quad each, drawn last,
  no extra pass. COMBATRIG's own frames are its work (bitp-3 is "performance first").
- **Tried in two ways:**
  - The made-up headset (iwer, as `trials/xr-test-*.mjs` use) for everything that can
    be measured.
  - **The owner's Quest 3S** for how it feels, with exact things to look for, since a
    made-up headset can't say whether anyone feels ill. I'd write those for the
    orchestrator to hand on: "sit in the seat; the view is at your eyes; hold the Meta
    button; you are back at your eyes, facing forward; drive; the edges darken in turns
    and not on a straight", and so on.

## 6. What done looks like, and the trials

**Done:**
- A casual visitor is never moved smoothly in any world without their press. The
  vehicle jumps with a fade instead, and a test fails if the view slides.
- A visitor who agreed at the Airlock rides smoothly, with the vignette on.
- An intense visitor rides with their own `narrow` setting.
- Recentring works from the console and from the Meta button.
- Every kit jump fades for casual, and cuts for intense.
- The same holds in an engine world, through the script, and in the Godot example once
  its visitor can move in a headset.
- COMBATRIG's cockpit (bitp-3) sits on it with no comfort machinery of its own.
- The owner, on the Quest, says the seat and the fade feel right.

**Trials and tests:**
- **Unit tests:** section 2's table as one core function (every row, including a false
  link field); the eye-point offset sums; the vignette's strength from a seat's movement;
  the fade's order (dark before the jump, light after).
- **`trials/seated-ride.mjs`:** a reference world with a seat on a moving platform, in
  the made-up headset:
  - casual, not agreed: the view never moves between frames by more than a head could,
    and jumps only while the view is dark;
  - casual, agreed by the link: it rides smoothly, with the vignette over 0 in turns;
  - intense with `narrow` off: it rides, with no vignette;
  - recentring through the console puts the head at the eye point within a centimetre;
  - a reference-space reset does the same, where the made-up headset can send one
    (checked; if it can't, that case is the Quest's).
- **`trials/fade-steps.mjs`:** a casual headset step, a spawn step-aside and a door in
  the made-up headset. Each is dark at the moment of the jump. In intense, none is.
- **For the Godot example:** the same ride, once its visitor moves.
- **The owner's Quest check list,** as in section 5.

## 7. Order

1. The fade for kit jumps in casual (3.4). It is small, stands on its own, and spawn
   points want it now.
2. The seat and recentring, in the kit (3.1, 3.2).
3. The rule and its words: the core function for section 2's table; the arrival field
   (NSWP-03); the words for the Airlock (and BitPortal's Airlock then showing them, its
   code); the in-world question.
4. The seat-driven vignette (3.3), and a reference world with a ride for the trial.
5. The engine script's half (section 4), then the Godot visitor's headset movement, then
   its seat, vignette and fade.
6. COMBATRIG's cockpit on it (its own session).

Each is one pull request, under `## Next`, with its trial.

## 8. Names, given by the orchestrator (2026-11-22)

All as proposed, with the link taking `0` as well as `1`, and the engine VERSION 18.

| What | Name |
|---|---|
| Arrival field: the visitor's answer at the Airlock, for this visit (NSWP-03) | `smooth` (`true` or `false`; absent for a plain link) |
| Link parameter for it, as the Airlock writes it | `smooth=1`, `smooth=0` |
| Core: may this visitor be moved smoothly here (section 2's table) | `maySlide(world, visitor)` |
| Core: the Airlock's words for a world that moves you, and for a seated one | `rideWords(world, visitor)` |
| Comfort setting: fade when the kit jumps you | `Comfort.fade` |
| Its travelling setting, beside `turn`, `hand` and `narrow` (NSWP-11) | `fade` |
| Kit (three): sit in a seat, and stand up | `xrInput.sit(seat, { eye, facing? })`, `xrInput.stand()` |
| Kit: recentre the seat | `xrInput.recentre()` |
| Kit: a jump with the fade, for a world's own | `xrInput.jump(fn)` |
| Kit: the one-time question's id, and the Moving switch for this world | `ride-ask`, `ride-here` |
| Console: the recentre control's id | `recentre` |
| Engine script: the engine says the visitor sat or stood | `seated(on)` |
| Engine script: whether this visitor may be moved smoothly here, and the fade setting | in `kit()`, as `slide` and `fade` |
| Engine script: the event to recentre | `{ type: "recentre" }` |
| Engine VERSION | 18 |
| The shortest time between a casual visitor's catch-up jumps in a vehicle | `CATCH_UP_MS` = 1000 |
| The Moving switch for the fade | `move-fade` |
| Godot: the seat node, and the signal to recentre | `NswpSeat`, `Nswp.recentre_asked` |

**The orchestrator's answers (2026-11-22):**
- **(a)** All names given as proposed, with `smooth=0` too, and the engine VERSION 18.
- **(b)** The world's choice, with a kit default (the jumps) and a kit limit (one a
  second at most, `CATCH_UP_MS`). The kit refuses to slide the view in every case.
- **(c)** Keep the in-world question, asked once in the headset with the world waiting.
- **(d)** The Airlock decides for that visit only, both ways (`smooth=1` and `smooth=0`).
  The world keeps only the in-world answer. Absent means a plain link: use the kept
  answer, or ask.
- **(e)** `fade` travels, beside `turn`, `hand` and `narrow`: it is the person's comfort
  preference, not the device's.
