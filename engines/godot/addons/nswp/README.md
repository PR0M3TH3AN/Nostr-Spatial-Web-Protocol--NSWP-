# NSWP for Godot

Makes a Godot 4 project, exported for the Web, a world on the open spatial
web: it reads how a visitor arrived, and sends them on through their own
Airlock.

It also brings what a visitor already knows from every other world, so that
yours needn't remake it: the menu, the sounds, the standard doorway and the
way a visitor moves. Each is the reference kit's own, not a look-alike, and
each can be replaced with your own.

**Status (2026-11-18): run in Godot 4.7.2, exported for the Web, in Chrome
on a flat screen with a mouse and keyboard.** With the example beside this
addon:

- an ordinary link and an arrival both stand the visitor at the right entry
  point, and the arrival is taken out of the address;
- the kit's menu is over the canvas, with the way home, the sound volumes,
  how to move and fullscreen, and the kit's sound files are loaded;
- the standard doorway lights when pointed at, and a card says where it
  leads;
- moving the casual way and the intense way both work at the kit's speeds,
  with running and jumping in each;
- walking into a door leads to the visitor's Airlock with where they are
  going, and the way home leads home.

**Not tried:** a real headset (see "A headset" below), a real phone (a tap
on an emulated touch screen walks as it should), Firefox or Safari, and
Godot before 4.7. Nobody has listened to it
in Godot: a test can say the sounds are loaded, not how they sound.

## Set up

1. Copy `addons/nswp/` into your project and enable **NSWP** in Project
   Settings, Plugins. That adds the `Nswp` autoload and a setting,
   `nswp/airlock`: the Airlock to use for a visitor who arrived without one.
2. In your Web export preset, set **HTML, Head Include** to:

   ```html
   <script src="nswp-engine.js"></script>
   ```

3. After each export, copy everything in `addons/nswp/web/` beside the
   exported `index.html`: the script (`nswp-engine.js`) and the kit's sounds
   (`sounds/`). An export can't do this for you: files it adds go inside the
   game's package, and the page has to load these itself.
4. Serve the export over https, with the file that says who may announce it
   (`/.well-known/nswp.json`) and an announcement, as for any world. See
   [`docs/add-your-site.md`](../../../../docs/add-your-site.md). Neither has
   anything to do with Godot.

## Use

A whole world's worth:

```gdscript
func _ready() -> void:
	Nswp.menu("My world", Color("3df5a0"))     # the menu and the sounds

	var visitor := NswpVisitor.new()             # someone to walk about
	add_child(visitor)
	Nswp.place(visitor)                          # stood where they arrived

	var gate := NswpGate.new()                   # the standard doorway
	gate.url = "https://gallery.bitblocks.network/"
	gate.label = "The Gallery"
	gate.accent = Color("3df5a0")
	gate.visitor_group = "visitor"
	add_child(gate)
```

- **Where they arrive.** Add a `Node3D` named for each entry point
  (`main-entrance` at least) to the group `nswp_entry`. `Nswp.place(node)`
  stands the visitor there.
- **The menu and the sounds.** `Nswp.menu(title, accent)` puts the kit's
  menu over the canvas and starts its sounds. The menu has the way home, how
  to move at a desk, fullscreen, the way into a headset when there is one,
  the sound volumes and the visitor's own music. `Nswp.play("cross")` plays
  a cue by name; `Nswp.say("...")` shows a few words.
- **Doors.** An `NswpGate` is the standard doorway: set its `url`, `label`
  and `accent`. It makes its own shape to walk into, lists itself in the
  menu, and lights when a visitor points at it from within ten feet. Moving
  the casual way, a press then goes through; moving the intense way, it is
  walked into. Walking in always goes through. From further off a door
  does nothing, so nobody leaves by a stray click.
- **Moving.** An `NswpVisitor` moves the casual way (click or tap the floor
  to walk there, with a ring where a press would lead and a dotted line the
  way there, drawn for them alone; drag to look) or the intense way (the mouse looks round,
  W, A, S, D walk, F uses, Escape is the menu), as the visitor chooses in
  the menu. Either way Shift runs and Space jumps; where there is no
  keyboard, two taps run and the menu's Jump control jumps. It is in the
  group `visitor`.
- **The way home.** The menu offers it. `Nswp.home()` does it from your own
  code. If `Nswp.arrival.home` is true, this world is their home, and the
  menu offers their doors instead.
- **Signing in.** The menu offers it under "You": "You are a guest here.
  Sign in". It leaves for the visitor's own client, which asks them on its
  own page and brings them back here; `Nswp.arrival.name` and `pubkey` are
  then filled if they chose to come by name. `Nswp.sign_in()` does it from a
  button of your own. Never draw a sign-in yourself, and never ask for a
  password or a key: that is the one thing about signing in a world must not
  do ([NSWP-10](../../../../protocol/10-identity.md)).
- **A headset.** An `NswpVisitor` starts a session when the visitor presses
  Enter VR in the menu, and a visitor who left a headset to come here is
  told where that is. Leaving through a door ends the session for you.

  Godot needs the browser's WebXR Layers to start a session. A Quest's
  browser has them. One that doesn't needs the polyfill Godot's manual names,
  as a file of your own beside the page. A session that can't start is said
  in the menu, and `NswpVisitor.headset_failed` says why.

  In a session the visitor stands where they are: moving about in a headset
  isn't in this addon yet.
- **The form they are in.** `Nswp.arrival.form` is `"touch"` or `"desk"`:
  how they were using the last world, where this device can do the same.
  Lay your own interface out by it. It goes on with them through a door.
- **Who they were with.** Set `Nswp.joined` and `Nswp.mic` as they change,
  if your world has rooms of its own, and they go with the visitor to the
  next world. `Nswp.arrival` has the same as they arrived.

## Using your own instead

Everything above is a default.

| To change | Do this |
|---|---|
| The door's look | Use `NswpPortal` (an `Area3D` that goes through, with nothing drawn) and draw your own. Say on it where it leads: `Nswp.read_address(url).domain` is the part to show. |
| The sounds | Pass your own to `Nswp.menu(title, accent, {"sounds": {...}})`, as in any world's settings ([`docs/controls-kit.md`](../../../../docs/controls-kit.md), "Sound"). A cue you don't name stays the default. |
| How visitors move | Write your own. Put it in the group `visitor`, tell `Nswp.moved(metres)` how far it walked each frame so steps are heard, and read `Nswp.moving`, `Nswp.menu_open` and `Nswp.kit` so it agrees with the menu. |
| How much room the menu takes | `Nswp.set_presence("quiet")` for one small mark in a corner, or `"hidden"` for nothing at all, when your game has an interface of its own. `Nswp.claim_keys(true)` takes every key for your game. The visitor can still bring the menu up with the key left of 1, or two fingers held still: that gesture is theirs in every world ([NSWP-11](../../../../protocol/11-the-visitors-console.md)), so never use it for anything else. Watch `Nswp.menu_toggled` and leave their input alone while it is up. |
| Where the visitor's things are | Draw any of them in your own interface: `Nswp.run("home")` from your pause menu, `Nswp.run("sound-music")` from your settings screen, `Nswp.open_console()` from a button on a wall. `Nswp.console_view()` has every one with its words as they stand, and `console_changed` says when to read it again. Each is the same thing the menu has, so it uses the visitor's own settings and their own home ([NSWP-11](../../../../protocol/11-the-visitors-console.md), "Drawing it yourself"). |
| The menu | Leave `Nswp.menu()` out and draw your own. You then owe the visitor the way home yourself (`Nswp.home()`), wherever they can reach it. |

The numbers a visitor's body knows are in `Nswp.kit`: walking pace, how far
a tap takes them, how far a mouse turns the view, the size of a doorway.
Changing them makes your world feel different from every other. That is
yours to decide, and worth deciding on purpose.

## What is in here

| File | What it is |
|---|---|
| `nswp.gd` | The `Nswp` autoload. |
| `nswp_portal.gd` | `NswpPortal`: a door with nothing drawn. |
| `nswp_gate.gd` | `NswpGate`: the standard doorway. |
| `nswp_visitor.gd` | `NswpVisitor`: a visitor who moves the way every world's do. |
| `gate/frame.obj` | The doorway's frame. Made from the reference kit's modelling code; don't edit it here. |
| `gate/*.gdshader` | The kit's metal, the field of light in a doorway and its glow, written for Godot. |
| `web/` | What goes beside the exported page: the kit's script and its sounds. Godot ignores this folder. |

## The example

[`../../example/`](../../example/) is a small world that uses all of the
above: two entry points, a door and a floor. The project file beside it
(`engines/godot/project.godot`) opens in Godot 4.

To export it and try it in a browser, from the repository's root:

```
npm run build:godot
node scripts/serve-local.mjs
```

The first needs Godot 4 and its web export templates (`GODOT=/path/to/godot`
if it isn't on the PATH). The export is about 40 MB, nearly all of it Godot
itself, and isn't kept in the repository. On that server its door leads to
the copies of the other sites served there
([`docs/local-server.md`](../../../../docs/local-server.md)).

## What a world owes its visitors

The short list in
[`protocol/09-what-a-world-owes.md`](../../../../protocol/09-what-a-world-owes.md)
applies whatever the engine. The ones a Godot world is most likely to miss:

- Take the arrival out of the address (reading it does this) and don't keep
  it anywhere.
- Never ask a visitor for their key, and never show a sign-in of your own for
  their identity: who they are comes from `Nswp.arrival`, checked.
- Don't join anyone to other people, or turn a microphone on, on the word of
  the page's address. Only `Nswp.arrival` says so.
- Connect a visitor to nobody in `Nswp.arrival.blocked`.

## Not here yet

- **Rooms:** other visitors, their voices, shared screens and music. The
  kit's room connection is JavaScript and would need more than text passed
  across. A world in Godot today is one a visitor is alone in, or one with
  multiplayer of its own.
- **Moving in a headset**, and the menu there. The page's menu can't be seen
  in a session.
- **The crossing's room**, which the reference worlds stand a visitor in as
  they arrive and leave, and the view through a door of where it leads.
