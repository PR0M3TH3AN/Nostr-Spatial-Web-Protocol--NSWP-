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

## What an engine draws for itself

The reference kit's Three.js parts don't come along: other people's figures,
the crossing's room, panels, the console in a headset. The protocol lets a
world draw its visitors its own way ([NSWP-05](../protocol/05-looks.md)), so
that is allowed. It is also work.

Rooms aren't in the script yet. The kit's room connection is JavaScript and
passes more than text.

## Godot

[`engines/godot/addons/nswp/`](../engines/godot/addons/nswp/README.md): an
addon with an `Nswp` autoload and an `NswpPortal` node. Godot 4 exports to
the Web and supports headsets in the browser itself, so it is the one engine
besides Three.js where every part is the engine's own.

**Status (2026-11-18):** the script is tested in a browser, on a bare page
under a strict content policy. The Godot addon is written and has not been
run in Godot, which isn't on the machine this was written on.

## Others

Not done. Unity exports to the Web, and reaches headsets in a browser only
through a community package. Unreal has no web export from its maker. The
script above is what either would call.
