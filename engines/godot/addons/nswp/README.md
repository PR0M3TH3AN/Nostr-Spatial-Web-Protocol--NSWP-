# NSWP for Godot

Makes a Godot 4 project, exported for the Web, a world on the open spatial
web: it reads how a visitor arrived, and sends them on through their own
Airlock. It draws nothing. Your doors, your visitors and your signs are yours
to draw.

**Status (2026-11-18): run in Godot 4.7.2, exported for the Web, in Chrome
on a flat screen.** With the example beside this addon: an ordinary link and
an arrival both stand the visitor at the right entry point, the arrival is
taken out of the address, walking into a door leads to the visitor's Airlock
with where they are going, and the way home leads home. With a made-up
headset on the page, the way into it is offered, and a session that can't
start says why.

**Not tried:** a real headset (see "A headset" below), a phone, Firefox or
Safari, and Godot before 4.7.

## Set up

1. Copy `addons/nswp/` into your project and enable **NSWP** in Project
   Settings, Plugins. That adds the `Nswp` autoload and a setting,
   `nswp/airlock`: the Airlock to use for a visitor who arrived without one.
2. In your Web export preset, set **HTML, Head Include** to:

   ```html
   <script src="nswp-engine.js"></script>
   ```

3. After each export, copy `addons/nswp/web/nswp-engine.js` beside the
   exported `index.html`. An export can't do this for you: files it adds go
   inside the game's package, and the page has to load this one before the
   game starts.
4. Serve the export over https, with the file that says who may announce it
   (`/.well-known/nswp.json`) and an announcement, as for any world. See
   [`docs/add-your-site.md`](../../../../docs/add-your-site.md). Neither has
   anything to do with Godot.

## Use

```gdscript
func _ready() -> void:
	Nswp.place($Player)                   # stand them at the entry they asked for
	if Nswp.arrival.immersive:
		show_enter_vr_button()            # they left a headset to come here
	$HomeButton.visible = Nswp.arrival.canGoHome and not Nswp.arrival.home

func _on_home_pressed() -> void:
	Nswp.home()
```

- **Where they arrive.** Add a `Node3D` named for each entry point
  (`main-entrance` at least) to the group `nswp_entry`. `Nswp.place(node)`
  stands the visitor there.
- **Doors.** Add an `NswpPortal` (an `Area3D`) where a door is, with a
  collision shape the size of the doorway, and set its `url`. Walking in goes
  through, or call `enter()`. Say on the door where it leads; the visitor's
  Airlock shows the real address next and asks.
- **The way home.** `Nswp.home()`. Offer it wherever a visitor can reach it.
  If `Nswp.arrival.home` is true, this world is their home: offer
  `Nswp.doors()` there instead.
- **A headset.** `Nswp.arrival.immersive` says they left a headset session to
  come here: offer the way back in before anything else. A browser starts a
  session only on a press, so it has to be a button. Leaving through a door
  ends the session for you.
  Godot needs the browser's WebXR Layers to start a session. A Quest's
  browser has them. One that doesn't needs the polyfill Godot's manual names,
  as a file of your own beside the page: connect `session_failed` and say what
  it says, as the example does.
- **How they move, and who they were with.** Set `Nswp.moving`
  (`"casual"` or `"intense"`), `Nswp.joined` and `Nswp.mic` as they change,
  and they go with the visitor to the next world. `Nswp.arrival` has the same
  as they arrived.

## The example

[`../../example/`](../../example/) is a small world that uses all of the
above: two entry points, a door, the way home and the way into a headset,
built in one script so that it can be read in one sitting. The project file
beside it (`engines/godot/project.godot`) opens in Godot 4.

To export it and try it in a browser, from the repository's root:

```
npm run build:godot
node scripts/serve-local.mjs
```

The first needs Godot 4 and its web export templates (`GODOT=/path/to/godot`
if it isn't on the PATH). The export is about 40 MB, nearly all of it Godot
itself, and isn't kept in the repository.

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

Rooms: other visitors, their voices, shared screens and music. The kit's room
connection is JavaScript and would need more than text passed across. A world
in Godot today is one a visitor is alone in, or one with multiplayer of its
own.
