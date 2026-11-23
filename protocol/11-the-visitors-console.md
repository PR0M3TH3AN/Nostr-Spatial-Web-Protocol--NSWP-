# NSWP-11: The visitor's console

**Status:** Implemented in the reference SDK for a desk, a touch screen and a controller in a headset, with the settings that travel; tracked hands with a hidden console are proposed · **Code:** SDK [`ui/summon.ts`](../packages/sdk/src/ui/summon.ts), [`ui/hud.ts`](../packages/sdk/src/ui/hud.ts), [`form.ts`](../packages/sdk/src/form.ts), [`settings.ts`](../packages/sdk/src/settings.ts), [`engine-menu.ts`](../packages/sdk/src/engine-menu.ts) · **Guides:** [`controls-kit.md`](../docs/controls-kit.md), [`other-engines.md`](../docs/other-engines.md)

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

In fullscreen at a desk, where the browser lets a page hold Escape, Escape
is the console first: the first press brings it up, and a press with it up
leaves fullscreen and leaves the console up. Where a browser doesn't let a
page hold it, the first press leaves fullscreen, as the browser insists,
and the console comes up then. Either way a visitor can always leave
fullscreen with Escape: a client never holds the key so that they can't.

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

**The same order in every world.** The things every place has stand in one
order wherever a world's code happened to add them, so the taskbar reads the
same everywhere and a number key does the same thing everywhere:

1. the way home (or, for the visitor whose home this world is, the way to
   their doors: [NSWP-07](07-homes.md));
2. into a headset, where there is one;
3. joining the room here, then the microphone;
4. jumping, where there is no key for it.

A world's own things come after, in the order it added them. A client's own
place has no way home, being home: its doors stand first there. The sections
are in one order too: Travel, You, Room, People, Camera, Panels, View,
Moving, Sound, Display, Help, and then a world's own. "Display" is how the
controls themselves look; how the *visitor* looks is under "You".

Not every world has every thing: one with no room has no Join, and a device
with no headset has no VR. What a world has is in the same place as
everywhere else.

A world that hides the console no longer has to put those things in menus of
its own, since the visitor can summon the console. It may still do so, and a
good pause menu will. The one place the duty still stands is a headset used
with tracked hands and no controllers, where a hidden console has no summons
yet (below): there, a world that hides it offers those things itself.

## Drawing it yourself

A world may put any of the visitor's things into an interface of its own,
wherever it likes: the way home on its pause menu, the volumes on its own
settings screen, a button on a wall that brings the whole console up, a
headset wrist of its own design. It may draw them in its own style, with its
own art, in its own order.

What makes that safe for a visitor is that it is the same thing behind the
button, not a copy of it:

- **It does what the console's does, and nothing else.** A world's "home"
  button takes the visitor to *their* home, wherever their own client says
  that is, by the way home ([NSWP-02](02-doors.md)). It is never the world's
  idea of home, and never a link of the world's own.
- **It reads and writes the visitor's settings.** A volume set on a world's
  own slider is the visitor's volume: the console shows the same number, and
  it goes with them to the next world ("Settings that travel", below).
- **It says what it does in words a visitor knows.** "Go home" may be drawn
  as a house, a door or a rune, but it is called home.
- **The console stays whole, and the summons still brings it up.** Drawing
  some of it elsewhere takes nothing out of it.
- **It never looks like an Airlock or a sign-in.** Those are the visitor's
  client's own pages and no world draws them
  ([NSWP-09](09-what-a-world-owes.md)). A world may draw the button that
  *leads* to the sign-in, wherever it likes: `signer`, below, where the
  visitor's client named a signer, and `identity` where it named none.
  Pressed, `signer` opens a window at their sign-in address, and they stay
  in the world; `identity` leaves for the visitor's own client and comes
  back ([NSWP-10](10-identity.md), "One sign-in" and "Signing in from
  inside a world").

The things a visitor has, by the names a world presses them by:

| Name | What it does |
|---|---|
| `home` | Takes them home (or to their doors, in a world that is their home) |
| `signer` | Where their client named a signer: signs them in here, in a window at their sign-in address, and signs them out again. They never leave the world ([NSWP-10](10-identity.md), "One sign-in") |
| `identity` | Says who they are here, and leaves for their own client to sign in, switch profile or go on as a guest. Then brings them back. Absent where their client named a signer |
| `figure` | Leaves for their own client to change how they look, and brings them back wearing it ([NSWP-05](05-looks.md), "Changing a look") |
| `vr` | Into a headset session, or out of one |
| `fullscreen` | Whether they prefer a filled screen, in every world; fills it, or gives it back |
| `fps`, `move-style` | Casual or intense, at a desk and in a headset: what they prefer, in every world |
| `look-speed` | How fast the view turns under a mouse or a finger |
| `fov` | How wide they see at a desk |
| `jump` | Jumps |
| `sound-all`, `sound-effects`, `sound-music`, `sound-voices`, `sound-hum` | Their volumes |
| `sound-piece` | Says which piece of the place's music is playing, and goes on to the next |
| `gate-buy`, `gate-buy-2`… | In a paid world, while its gate is shut: asks their sign-in address to sell them what the row names, or signs them in first ([NSWP-10](10-identity.md), "The front room"). Absent everywhere else |
| `room-join`, `room-mic` | Joining the room here, and their microphone |
| `room-chat` | What the people in the room have written, and a place to write ([NSWP-06](06-rooms.md), "Words") |
| `room-chat-show` | Whether they see what people write at all |
| `feed` | Their own public posts, and a place to send one out, where they have a signer ([NSWP-10](10-identity.md), "Posting from a world") |
| `people-pictures` | Whether they see other people's pictures |
| `people-models` | Whether they see people's own models, where the world draws them ([NSWP-05](05-looks.md), "A model of your own"). On a person's card, `person-simple` draws that one person as their simple look instead, for this visitor alone |
| `files-anywhere` | Whether other people's files are loaded from anywhere they say they are kept, or only from the file hosts the visitor already uses ([NSWP-17](17-items.md), "Where a file is fetched from") |
| `look-size`, `look-motion` | The size of their text, and whether things move |

In the reference kit a world reads the whole list with `controls.view()`,
presses one with `controls.run(name)`, and hears of changes with
`controls.subscribe()`. In another engine, through the engine script:
`NSWP.view()`, `NSWP.run(name)` and a `changed` event; and
`NSWP.open("1")` for a button that brings the console up. In Godot:
`Nswp.console_view()`, `Nswp.run(name)`, `Nswp.open_console()` and the
`console_changed` signal.

A world built some other way keeps the same rules by hand: its home button
is `<the visitor's Airlock>` with no destination, and its settings begin
from the arrival and go out on the link.

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
more. That is the web's rule, not this protocol's. The press is made as
small as it can be: it may land anywhere on the page, and be made with
anything, as the press that fills a screen again may ([NSWP-02](02-doors.md)).
Where a browser offers to carry a session across (the `sessiongranted`
proposal), the reference SDK takes it and nothing is asked. No browser does
between two sites.

## Settings that travel

Each world is a different website, and a website can only remember what a
visitor chose on that site. So someone who turned the music down, made the
text larger or filled their screen had to do it again in every world. A few
settings now go with them instead, the same way the form they are in does:

| Setting | In the link and the arrival | |
|---|---|---|
| Their volumes | `sound`: `off`, `effects`, `music`, `voices` (each 0 to 1), `hum` | |
| The size of text and controls | `text`: 0.85 to 1.5 | |
| Whether things move as they open and close | `motion` | |
| Their hands in a headset | `wrist` (`left`, `right`, `off`), `hand` (which stick moves them), `turn` (30, 45 or 90 degrees a notch), `narrow` (the view narrowed while moving), `fade` (the view fades to black and back when the client jumps them: a step, being stepped aside) | |
| That they prefer a filled screen | `full` | Looked for first, before the place is built, and taken up at their very first press of any kind. A browser gives up a filled screen whenever the page changes and fills it only on a press: no page can do it sooner |
| That they prefer the intense way of moving at a desk | `intense` | The mouse looks round and keys walk, from the start, with nothing to switch on |
| How they prefer to move in a headset | `headset`: `casual` (point at the floor to step there, turn a notch at a time) or `intense` (one stick walks and the other turns, smoothly) | Said both ways once they have chosen, so a world can tell someone who chose casual from someone never asked. `turn` stays the size of a notch |
| How fast the view turns under a mouse or a finger | `look`: 0.25 to 3, 1 being the world's own speed | |
| How wide they see at a desk | `fov`: 50 to 110 degrees, top to bottom. Left out, each world's own | Not applied on a touch screen, where a world fits its view to the window, or in a headset |
| Whether they see other people's pictures | `pictures`. Left out, they do | A picture is fetched from its owner's own host, which learns the viewer's address ([NSWP-10](10-identity.md), "Pictures") |
| Whether they see people's own models | `models`. Left out, they do, where a world draws them | Off, everyone is drawn as their simple look. A model is fetched by its hash only from the file hosts on the viewer's own list ([NSWP-17](17-items.md), "Where a file is fetched from") |
| Whether they see what people write in a room | `chat`. Left out, they do | Turned off, nothing anyone writes is shown to them and they write nothing ([NSWP-06](06-rooms.md), "Words") |
| That other people's files are loaded only from the visitor's own file hosts | `filesAnywhere`: only `false` travels. A `true` arriving is ignored and never kept | Off, a file is fetched by its hash only from the file hosts on the visitor's own list ([NSWP-17](17-items.md), "Where a file is fetched from"). Any world can write the link a visitor arrives by, so a privacy switch that is off by default can't be turned on by one: on is only ever the visitor's own press in the console of the place they are in, kept by that place. No signed settings note is read for it |
| Whether anything people carry is fetched, drawn or run for them | `items`. Left out, it is, in a world that has items | Turned off, it is how they mute every item, in every world ([NSWP-17](17-items.md), "Muting") |
| What is in their hand | `holding`: an item's address, the colours they chose for it by slot, and the hash of its script if it was running for them; or `""` when they put it away themselves | Taken in hand again only if it is in the visitor's own bag, and its script runs unasked only if it is the one named ([NSWP-17](17-items.md), "Holding one"). If the settings would be too long for a link, this is left off after the pins |
| Which tabs of the console they keep on their bar | `pins`: the tabs' names, in the order they pinned them, four at most. Each is a short plain word: a lowercase letter, then up to eleven more letters, digits or hyphens. An empty list says they took them all off | A world shows the ones it has a tab for and keeps the rest to pass on. Only the visitor pins: a world never adds to the list. If the settings would be too long for a link, these are left off first |

**They say what the visitor prefers, not what happened to be so when they
left.** Someone who prefers a filled screen and pressed Escape for a moment
in one world still prefers a filled screen, and the next world fills it at
their first press. Someone who prefers the intense way arrives moving the
intense way. What changes a preference is the visitor's own hand on the
control for it, in any world's console or in their client's settings, and
nothing else: not the state of the screen as they leave, and not the device
they happen to be on. A world reports `full` and `intense` from what the
visitor chose, never from `document.fullscreenElement` or from whether the
pointer is held. Where a world can't offer a thing at all (the intense way,
on a phone) it says nothing about it, and the preference passes through
untouched.

- **A world says** `set=<settings>` on the link, for what the visitor has
  now: the settings as JSON, base64url, at most 400 characters.
- **The visitor's client passes them on** as `settings` in the arrival
  context ([NSWP-03](03-arrival.md)). It starts from what it keeps for the
  visitor itself, with what the link says over it, so a door that says
  nothing (one opened from a list on a page) still takes their preferences
  along.
- **The world they arrive in starts from them,** in place of whatever that
  site remembered, and keeps them for next time.
- **They go home too.** On the way home the link carries them, and the
  visitor's own client starts from them. What was changed in a world is not
  forgotten on leaving it.
- **A reader keeps what it knows and is in range, and ignores the rest.**
  So a setting added later doesn't break an older world.

**They are preferences and nothing more.** A link that says them falsely
has turned a volume down or made some text larger, and the visitor changes
it back. So nothing is asked about them, and nothing that would need asking
is ever one of them: a microphone, who is blocked, and hearing other
people's music are not settings, and travel under rules of their own or not
at all ([NSWP-02](02-doors.md)). A world's colours don't travel either:
those belong to each place.

**Between devices is the client's business.** What goes through a door is
the settings a visitor has now. A client may also keep them with the
visitor's profile, so that a second device starts from them: BitPortal does,
when the visitor asks, as one note on their relays that only their own key
can open (NIP-78 application data, sealed with NIP-44). A world never reads
such a note, and has no reason to: it couldn't open it, and a world asking
relays about its visitors would be a way to follow them. A world is told a
visitor's settings one way only, by their client, as they arrive.

How a visitor moves (`moving`) and the form they are in (`form`) are
settings of the same kind. They have fields of their own because a world
needs them before anything else is set up. At a desk, `intense` in the
settings is the word that counts where both are said, and in a headset
`headset` is: each says "casual" as plainly as "intense", which a flag that
is only ever present can't.

### Asked once

The first time a visitor is in a place at a desk with a mouse, or in a
headset, with nothing said about how they move there (no `intense`, or no
`headset`, in what they arrived with) and nothing kept by that site, the
place asks them once: casual or intense, and that it can be changed later.
Put away without an answer, it is casual. Their answer is then a setting like
the rest: it goes through every door, so no place they reach that way asks
again, and their client may keep it with their other settings for their next
device. Until they have answered, a place says nothing about it. On a touch
screen nothing is asked and the intense way isn't offered: there is no mouse
to look with. The two questions are separate: an answer at a desk is never
taken for one in a headset, or the other way round. A place reached with
nothing carried (its address typed in, no client) asks once on that site.
The kit does all of this (`createFps`, `createXrInput`).

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

**Where a client keeps the screen, it can draw the console.** A client that
shows a world in a frame of its own page is above that world, and can draw
there. [NSWP-02](02-doors.md), "The client has the menu", has the words:
the world's console steps aside, the world describes the tabs that are its
to fill, and the visitor's own tabs, and the way home, are the client's.
For a world shown that way the way home is then a guarantee, and a world
can no longer break it. (Status: the words are in the kit's core; no world
or client speaks them yet.)

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
