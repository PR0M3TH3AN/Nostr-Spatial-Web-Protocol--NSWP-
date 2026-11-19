# NSWP-11: The visitor's console

**Status:** Implemented in the reference SDK for a desk, a touch screen and a controller in a headset; tracked hands with a hidden console are proposed · **Code:** SDK [`ui/summon.ts`](../packages/sdk/src/ui/summon.ts), [`ui/hud.ts`](../packages/sdk/src/ui/hud.ts), [`form.ts`](../packages/sdk/src/form.ts), [`engine-menu.ts`](../packages/sdk/src/engine-menu.ts) · **Guides:** [`controls-kit.md`](../docs/controls-kit.md), [`other-engines.md`](../docs/other-engines.md)

A visitor carries a few things from world to world: the way home, how they
move, how loud things are, who they have muted, the way out of a headset.
[NSWP-09](09-what-a-world-owes.md) lists them. This document is about the
one place they are all found, which we call the visitor's console, and how it
shares a screen with a world that has an interface of its own.

A world may be a game with a score, a toolbar and a pause menu. It should be
able to fill the screen with those and nothing else. And a visitor should
still be able to reach their own controls in it, the same way they do
everywhere, without the world's interface being disturbed.

Both hold if three things do.

## 1. The world leads

A world chooses how much room the console takes, and may change it from
moment to moment:

| Level | What shows | For |
|---|---|---|
| Full | The world's name, a row of things always at hand, a menu | A world with no interface of its own |
| Quiet | One small mark, in a corner the world picks | A world with its own interface, or any world during play |
| Hidden | Nothing at all | A world whose own interface fills the screen |

A world may also take every key for itself while it needs them.

Hidden means hidden: no mark, no edge, no hint. A world that wants its own
interface to be the only one on screen gets exactly that.

## 2. The visitor can always summon it

One gesture on each kind of device belongs to the visitor, in every world.
It brings the console up over whatever the world is showing, at any level,
whatever the world has done with the keys:

| On | The summons |
|---|---|
| A desk | The key left of 1 (`` ` ``, by its place on the keyboard and not by what it types) |
| A touch screen | Two fingers held still for a little over half a second |
| A headset, with controllers | The upper face button (B or Y) held for a little over half a second |

It is put away the same way, or with Escape or its Close button. In a
headset, a press of the same button or its Close button puts it away.

A world:

- **never uses the summons for anything of its own.** A pinch, a two-finger
  drag and a press of B or Y are still the world's: it is the hold, and that
  one key, that are the visitor's.
- **never stops it reaching the console.** The reference console listens
  before the world does, so a world built with it can't do this by accident.
- **never draws anything that could be taken for the console,** summoned or
  not. This is the same rule as never drawing a sign-in
  ([NSWP-09](09-what-a-world-owes.md)).

## 3. Coming and going leaves nothing behind

- **It is drawn over everything,** the world's own interface included, while
  it is up. In a headset it comes up in front of the visitor.
- **The world is told** when it comes up and when it goes (`menuOpen`,
  `menuClose`), and should leave the visitor's input alone in between: a game
  pauses, or at least stops reading keys.
- **When it goes, nothing is left.** At the hidden level the screen is
  exactly as it was: no mark, no message, no changed layout.
- **Whatever had the keys has them back.** If the world's own menu was open
  and focused, it still is.
- **Nothing in the world was pressed.** The summons is heard by the console
  and by nothing else, so it can't also be a key in the world's game.

So a visitor can be deep in a world's own menus, bring up their console to
turn the music down or go home, put it away, and be exactly where they were.

## What is in it

The console holds what [NSWP-09](09-what-a-world-owes.md) says a visitor can
always do, in the same order in every world, and then the world's own
additions in sections of their own. A world may add to it. It may not take
one of the visitor's things out.

A world that hides the console no longer has to put those things in menus of
its own, since the visitor can summon the console. It may still do so, and a
good pause menu will. The one place the duty still stands is a headset used
with tracked hands and no controllers, where a hidden console has no summons
yet (below): there, a world that hides it offers those things itself.

## The same form on the other side

A visitor is in one of three forms: using a touch screen, at a desk with a
mouse and keys, or in a headset. Going through a door doesn't change which.

| They leave | They arrive |
|---|---|
| On a touch screen | Laid out for touch: things to tap, nothing that needs a key |
| At a desk | Laid out for a mouse and keys |
| In a headset | Offered the way back into the headset first, alone, in one action ([NSWP-02](02-doors.md), "How many actions a crossing takes") |

Most devices can only be one of the first two, and a world works that out
for itself. Some can be both: a laptop with a touch screen, a tablet with a
keyboard. So the form travels:

- **A world says** `form=touch` or `form=desk` on the link, for what the
  visitor was last using. A headset session is `xr=1`, as before, and `form`
  beside it says what they are out of the headset.
- **The visitor's client passes it on** as `form` in the arrival context
  ([NSWP-03](03-arrival.md)).
- **The world they arrive in starts them that way,** if their device can do
  it, and works it out for itself if not. A phone told `desk` is still a
  phone.
- **It is a preference and nothing more,** like how a visitor moves. Using
  the other changes it: a visitor who arrives laid out for touch and picks up
  the mouse is at a desk from then on.
- **It is not sent on the way home.** A visitor's own client knows their
  device.

A browser ends a headset session when the page changes, and only a press can
start another. So headset to headset costs one press on arriving, and no
more. That is the web's rule, not this protocol's. Where a browser offers to
carry a session across (the `sessiongranted` proposal), the reference SDK
takes it and nothing is asked.

## Who draws it

While a visitor is in a world, only that world's page is running. A web page
can't draw over another site, so no client can lay a console over a world
from outside. The console is drawn by the world's own page.

That makes this an agreement and not a guarantee:

- **A world built with the reference SDK, the template or the engine script
  keeps it without doing anything.** The console and the summons come with
  them, for Three.js, for Godot, and for anything else that can run the
  engine script.
- **A world built some other way keeps it by doing the same:** drawing a
  console with the visitor's things in it, and answering the summons.
- **A world can break it.** Nothing outside a world can check
  ([NSWP-09](09-what-a-world-owes.md), "Not decided"). The browser's and the
  headset's own controls are still the visitor's sure way out, and nothing
  security depends on the console.

A client that stays with the visitor inside every world, whatever that world
does, has to be the browser itself. [`browser/spec.md`](../browser/spec.md)
is the plan for one. There, the console would be the browser's own, the
summons would be one no page could intercept, and this document would say
what a world may ask of it instead of what a world owes.

## In code

```ts
import { createControls, mountHud } from "nswp-sdk/ui";

const controls = createControls({ title: "My game" });
const hud = mountHud(controls);

controls.setPresence("hidden");     // my own interface fills the screen
controls.claimInput(true);          // and I need every key
controls.onSignal((name) => {
  if (name === "menuOpen") pause();   // the visitor summoned their console
  if (name === "menuClose") resume();
});
```

In another engine, through the engine script: `NSWP.presence("hidden")`,
`NSWP.claim("1")`, and `menu` events from `NSWP.events()`. In Godot:
`Nswp.set_presence("hidden")`, `Nswp.claim_keys(true)` and the
`menu_toggled` signal.

## Proposed, not built

- **Tracked hands with a hidden console.** With controllers, B or Y held is
  the summons. With hands and no buttons, a quiet console answers to a raised
  wrist, and a hidden one has no summons yet. A palm turned to the face and
  held is the likely gesture; it needs trying in a headset first.
- **Saying so in the manifest.** Whether a world should be able to say it
  keeps this agreement, so a client can warn before a crossing into one that
  doesn't (Q33).

Background and reasoning: [`spec.md`](../spec.md) §21.3.
