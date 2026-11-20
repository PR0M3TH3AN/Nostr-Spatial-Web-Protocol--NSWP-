# Worlds in other engines

A world is a website. Nothing in the protocol says how it is drawn, and the
reference worlds use Three.js only because something had to. An engine that
can export to a web page can make a world.

## What has to happen, whatever the engine

1. **It is an https site** with `/.well-known/nswp.json`, the file that says
   whose key may announce it ([add-your-site.md](add-your-site.md)).
2. **It is announced** with a signed note. The `nswp` command does this.
3. **It reads how the visitor arrived** from the page's address when it comes
   up, and takes that out of the address
   ([NSWP-03](../protocol/03-arrival.md)).
4. **It sends visitors on** through their own Airlock, with where they are
   going after the `#` ([NSWP-02](../protocol/02-doors.md)).
5. **It offers the way home.**

The first two are files and a command. The last three are a little
JavaScript on the page that holds the engine's canvas.

## The script: `engines/nswp-engine.js`

One file, no rendering, built from `packages/sdk/src/engine.ts` by
`node scripts/build-engine.mjs`. It puts `NSWP` on the page. Every function
takes text and returns text or a yes or no, because text is what every
engine can pass to a page:

| Call | Does |
|---|---|
| `NSWP.start(options)` | Call once. `options` is JSON; `airlock` names the Airlock for a visitor who arrived without one. Returns the arrival. |
| `NSWP.arrival()` | How they arrived, as JSON: `arrived`, `entry`, `immersive`, `home`, `joined`, `mic`, `moving`, `blocked`, `look`, `guest`, `name`, `pubkey`, `canGoHome`. |
| `NSWP.go(destination, state)` | Through a door. `destination` is JSON with `url`, and `naddr` and `entryPoint` if the door has them, and `title`: what the door is called, for the sign in the crossing's room. Returns `""`, or one word for why not. The room shuts round them first, and then the page is left. |
| `NSWP.home(state)` | To their own start. False if there is no way there. |
| `NSWP.doors(state)` | To their doors, for a world that is someone's home. |
| `NSWP.changeLook(state)` | To their own client, to change how they look, and back here wearing it. The menu offers it under "You" and sends a `figure` event when it is pressed. A world never edits a look. |
| `NSWP.signIn(state)` | To their own client, to say who they are, for a visitor whose client named no sign-in address. Where it named one (the reference client does), signing in is the menu's own row, in a window of that address, and they never leave your world: see "The same sign-in" below. False if they came through no client. |
| `NSWP.who()` | Who they are here, now, as JSON: `guest` true, or `name`, `pubkey`, `picture` and `about`. A `who` event says when it changes: they signed in or out in the menu. |
| `NSWP.crossing()` | Where the crossing's room is: `"arriving"`, `"opening"`, `"none"`, `"leaving"`, `"shut"` or `"failed"`. A `crossing` event says when it changes. |
| `NSWP.loading(fraction)` | How much of the world has arrived, 0 to 1: the line of light over the room's doors fills. The page that starts the engine calls it. |
| `NSWP.ready()` | The world is ready: the room's doors open. Asking for the menu does this by itself, unless it was asked for with `hold` true. |
| `NSWP.failed(words)` | The world couldn't start: the doors stay shut and the sign says why. |

`NSWP.KIT` is the version of the kit the script was built from. Put it in
your manifest as `"kit"`, so a visitor's client can tell how old your
world's controls are, and copy the newer script in when `nswp check` says
there is one ([keeping-up.md](keeping-up.md)).

`NSWP.kit()` has two numbers the visitor sets for themselves, and they are
the same in every world: `lookSpeed` and `dragLook` are already scaled by
how fast they like the view to turn, and `fov` is how wide they asked to see
at a desk, in degrees top to bottom (0 for your world's own). Read `kit()`
again when a `changed` event comes. The menu has the controls for both. The
Godot addon's visitor does this for you.

`state` is JSON saying how they are leaving: `immersive`, `joined`, `mic`,
`moving`, `blocked`. The engine ends a headset session itself before `go`.

It works under a strict content policy (`script-src 'self'`): nothing in it
is evaluated from text.

## The crossing's room, the same at both ends

A visitor who leaves a Three.js world leaves from a small room whose walls
rise round them, and arrives in the next standing in that room, whose doors
open once the world is ready. An engine has two things in the way of that.
It takes a long while to arrive (Godot's is forty megabytes), and what its
export shows meanwhile is the engine's own loading screen.

So the script draws the room itself, flat, as the page: the view from
inside it, facing its doors. It needs no engine and no renderer.

- **It is there from the page's first moment,** before the engine has begun
  to load, wearing the world's name and colour. Those are said on the page,
  since the engine can't say them yet:
  `<meta name="nswp:title" content="My world">` and
  `<meta name="nswp:accent" content="#4cc9f0">`, before the script's tag.
- **The line of light over the doors is the loading bar.** The page that
  starts the engine tells it how far along it is: `NSWP.loading(0.4)`.
- **The doors open when the world asks for its menu,** which is the world
  saying it is up. A world with more to load first asks for the menu with
  `hold` true and calls `NSWP.ready()` when it is.
- **Leaving, it comes up again.** `go`, `home` and `doors` bring the room up
  round the visitor, with the door's name and address on the sign, shut its
  doors, and only then leave the page. Give `go` the door's name as `title`.
- **It is scenery, and proves nothing,** as the room it copies is
  ([NSWP-02](../protocol/02-doors.md)). It asks for nothing and has nothing
  in it to press.
- A page that wants none says so on the script's tag:
  `data-crossing="off"`.

Your engine's own loading screen has to go for this to be seen. For Godot
the addon has the page to export with (`addons/nswp/web/shell.html`).

## The same sign-in

The menu has the same sign-in as a Three.js world
([NSWP-10](../protocol/10-identity.md), "One sign-in"): under You, "Sign in,
at bitlogin.network" opens a window of the visitor's own sign-in address.
Signed in, the card at the head of You has their picture, name and key, and
"Signed in as" is said at the top of the view. Your engine is told
(`{"type":"who", ...}`), and `NSWP.who()` says who they are now. A name is
theirs only while they are signed in here: write none over a guest.

## The same menu and the same sounds

A visitor should find the same controls in every world: the same menu in the
same corner, the same sounds at the volumes they set, the same words. None of
that needs a renderer, so the script carries the reference kit's own menu
(`packages/sdk/src/ui/`) and its own sounds (`packages/sdk/src/sound.ts`),
not copies of them. The menu is drawn by the page over the engine's canvas.

| Call | Does |
|---|---|
| `NSWP.menu(options)` | Call once. Puts the menu over the canvas and starts the sounds. `options` is JSON: `title`, `accent`, `kit` (where the page serves the kit's sound files), `sounds` (the world's own), `help`. Returns how the visitor starts out moving. |
| `NSWP.events()` | What the visitor did in the menu since the engine last asked, as a JSON list. Ask every frame. |
| `NSWP.play(cue)` | Play a cue by name: `cross`, `arrive`, `hover`, `press` and the rest. |
| `NSWP.moved(metres)` | How far the visitor walked this frame. Their steps are heard. |
| `NSWP.bump()` | They walked into something. |
| `NSWP.say(text)` | A few words shown for a moment. |
| `NSWP.target(name, detail)` | What the visitor is pointing at, shown in a card beside the controls. |
| `NSWP.headset(state)` | Whether a headset session can start, and whether one is running. The menu offers the way in. |
| `NSWP.door(entry)` | List a door in the menu. |
| `NSWP.view()` | Everything in the visitor's console, as JSON, for an engine that draws some of it in an interface of its own. |
| `NSWP.run(id)` | Press one of them by its id: `home`, `fullscreen`, `sound-music`, `jump`. The same button, with the visitor's own settings and home. |
| `NSWP.open(on)` | Bring the console up, or put it away, from a button of the engine's own. |
| `NSWP.presence(level)` | How much of the screen the controls take: `full`, `quiet` or `hidden`. For an engine with an interface of its own. |
| `NSWP.claim(on)` | Take every key for the game, or give them back. |
| `NSWP.kit()` | The numbers every world shares: walking pace, how far a tap takes a visitor, how a mouse turns the view, the size of the standard doorway. |
| `NSWP.check(url)` | How a door's address should be read on its sign. |

The events are `moving` (they chose casual or intense), `menu` (it opened or
closed: stop moving them, and let the pointer go), `vr` (they pressed Enter
VR or Leave VR), `jump` (they pressed Jump, which is how it is asked for
where there is no keyboard), `home`, `doors`, `door`, and `changed`
(something in the console changed: an engine drawing its own reads
`NSWP.view()` again).

**The visitor can always bring the menu up,** whatever level the engine has
set and whatever it has done with the keys: the key left of 1 at a desk, or
two fingers held still on a touch screen
([NSWP-11](../protocol/11-the-visitors-console.md)). The script hears those
before the engine's canvas does, and the engine never hears them. It hears a
`menu` event instead, and should leave the visitor's input alone until the
next one. Never bind that key or that hold to anything in the game.

The visitor's settings travel with them: their volumes, the size of their
text, whether their screen was filled. The script's menu and sounds begin
from what they arrived with and send on what they have, with nothing for
the engine to do. `NSWP.arrival()` gives them as `settings`, for an engine
with an interface of its own.

`NSWP.arrival()` also says the form the visitor is in on a flat screen
(`form`: `touch` or `desk`), so an engine with its own interface can lay it
out the way they were using the last world. The script carries it on through
a door.

The sound files go beside the page, in a folder the engine names (`kit`).
Without them the sounds are the ones the kit makes in the browser.

## What an engine draws for itself

Its doors, and how its visitors move. An engine's side should take both from
the kit all the same, so that a door is recognisable and moving feels the
same: `NSWP.kit()` has the numbers, and the Godot addon has the doorway's
frame as a mesh made from the kit's own modelling code.

The rest of the reference kit's Three.js parts don't come along: other
people's figures, the view through a door, panels, the console in a
headset. (The crossing's room does, as the page's picture of it: above.) The protocol lets a world draw its visitors its own
way ([NSWP-05](../protocol/05-looks.md)), so that is allowed. It is also
work.

Rooms aren't in the script yet. The kit's room connection is JavaScript and
passes more than text.

## Godot

[`engines/godot/addons/nswp/`](../engines/godot/addons/nswp/README.md): an
addon. Godot 4 exports to the Web and supports headsets in the browser
itself, so it is the one engine besides Three.js where every part is the
engine's own.

| Part | What it is |
|---|---|
| `Nswp` | An autoload: how the visitor arrived, the doors out, the menu and the sounds. |
| `NswpGate` | The standard doorway. Its frame is the kit's own model, exported as a mesh; its three surfaces are the kit's shaders, written for Godot. |
| `NswpVisitor` | A visitor who moves the casual way or the intense way, as they choose in the menu, at the kit's own speeds. |
| `NswpPortal` | A door with nothing drawn, for a world that draws its own. |

Each default can be replaced. A world that wants its own door uses
`NswpPortal` and draws what it likes; one that wants its own sounds names
them, as any world does ([controls-kit.md](controls-kit.md), "Sound").

There is an example world beside it
([`engines/godot/example/`](../engines/godot/example/)): two entry points, a
door and nothing else of its own. `npm run build:godot` exports it, given
Godot 4 and its web export templates, and
[`node scripts/serve-local.mjs`](local-server.md) serves it with the other
sites.

**Status (2026-11-18):** run in Godot 4.7.2, exported for the Web, in Chrome
on a flat screen, with a mouse and keyboard:

- The kit's menu over the canvas, with the way home, the sound volumes, how
  to move, and fullscreen. The kit's sound files are loaded.
- The standard doorway, lit when pointed at, with a card saying where it
  leads.
- Moving the casual way: a click on the floor walks no further than the
  kit's reach, and a drag turns the view.
- Moving the intense way: the mouse looks round, and taking the pointer back
  opens the menu.
- The summons: with the controls hidden, the key left of 1 brought them up
  over the canvas and put them away, and Godot never saw the key.
- Marks on the floor moving the casual way (a ring where a press would lead,
  a dot and a dotted line once pressed), and the reach of a door: nine
  metres off it was not lit and a press walked towards it; at three it lit
  and a press went through.
- Running and jumping, both ways: Shift runs at 4.3 metres a second against
  2.4 walking, two clicks on the floor run there, and Space jumps 0.45 m.
- Arriving by an ordinary link and by an arrival, each entry point, a door
  through to the Airlock, and the way home.

**Not tried:** a real phone (a tap on an emulated touch screen walks as it
should), Firefox, Safari, and a real headset. With a made-up headset on the page the way in is offered; a session
itself wasn't started, since Godot needs the browser's WebXR Layers and the
made-up headset has none. Nobody has listened to it: the sound files are
asked for and decoded, and that is all a test can say.

**Added 2026-11-20,** run in Godot 4.7.2 exported for the Web, in Chrome on
a flat screen:

- The crossing's room in place of Godot's loading screen: up from the first
  moment, its line of light filling as the engine downloads, its doors
  opening on the world; and coming up and shutting on the way out by a door.
- The page the addon exports with has no script written into it.
- The same sign-in row, card and "Signed in as" as a Three.js world. Tried
  signed out only: nobody signs in to an account from a test.
- A path pressed out as they walk, with a ring at each turn, and the view
  turning to face the way they walk.
- A tab of the menu kept on the bar, as in every world.

**Not in the Godot addon:** moving in a headset (a session starts, and the
visitor stands where they are), the view through a door, posting from a
world, and other people. The crossing's room is the page's picture of it:
it can't be looked round in, as a Three.js world's can.

A Godot export is large (about 40 MB, nearly all the engine), which is what
the line of light in the crossing's room is for. The page the addon exports
with runs nothing written into it, so it can be served under a policy with
no inline script; the engine itself is WebAssembly and needs
`'wasm-unsafe-eval'` in `script-src`.

## Others

Not done. Unity exports to the Web, and reaches headsets in a browser only
through a community package. Unreal has no web export from its maker. The
script above is what either would call.
