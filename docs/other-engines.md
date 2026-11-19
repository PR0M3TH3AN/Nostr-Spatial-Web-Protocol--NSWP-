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
| `NSWP.go(destination, state)` | Through a door. `destination` is JSON with `url`, and `naddr` and `entryPoint` if the door has them. Returns `""`, or one word for why not. |
| `NSWP.home(state)` | To their own start. False if there is no way there. |
| `NSWP.doors(state)` | To their doors, for a world that is someone's home. |

`state` is JSON saying how they are leaving: `immersive`, `joined`, `mic`,
`moving`, `blocked`. The engine ends a headset session itself before `go`.

It works under a strict content policy (`script-src 'self'`): nothing in it
is evaluated from text.

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
| `NSWP.presence(level)` | How much of the screen the controls take: `full`, `quiet` or `hidden`. For an engine with an interface of its own. |
| `NSWP.claim(on)` | Take every key for the game, or give them back. |
| `NSWP.kit()` | The numbers every world shares: walking pace, how far a tap takes a visitor, how a mouse turns the view, the size of the standard doorway. |
| `NSWP.check(url)` | How a door's address should be read on its sign. |

The events are `moving` (they chose casual or intense), `menu` (it opened or
closed: stop moving them, and let the pointer go), `vr` (they pressed Enter
VR or Leave VR), `jump` (they pressed Jump, which is how it is asked for
where there is no keyboard), `home`, `doors` and `door`.

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
people's figures, the crossing's room, the view through a door, panels, the
console in a headset. The protocol lets a world draw its visitors its own
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
- Running and jumping, both ways: Shift runs at 4.3 metres a second against
  2.4 walking, two clicks on the floor run there, and Space jumps 0.45 m.
- Arriving by an ordinary link and by an arrival, each entry point, a door
  through to the Airlock, and the way home.

**Not tried:** a real phone (a tap on an emulated touch screen walks as it
should), Firefox, Safari, and a real headset. With a made-up headset on the page the way in is offered; a session
itself wasn't started, since Godot needs the browser's WebXR Layers and the
made-up headset has none. Nobody has listened to it: the sound files are
asked for and decoded, and that is all a test can say.

**Not in the Godot addon:** moving in a headset (a session starts, and the
visitor stands where they are), the crossing's room, the view through a
door, and other people.

A Godot export is large (about 40 MB, nearly all the engine) and Godot's page
starts itself with a script written into the page, so it can't be served
under the reference worlds' strict content policy as it comes. The kit's
script can; the page Godot writes round it is Godot's.

## Others

Not done. Unity exports to the Web, and reaches headsets in a browser only
through a community package. Unreal has no web export from its maker. The
script above is what either would call.
