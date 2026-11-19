# NSWP for Godot

Makes a Godot 4 project, exported for the Web, a world on the open spatial
web: it reads how a visitor arrived, and sends them on through their own
Airlock. It draws nothing. Your doors, your visitors and your signs are yours
to draw.

**Status: written, not yet run in Godot.** The script it calls
(`web/nswp-engine.js`) is tested in a browser. The GDScript here is written
to Godot 4's documented API and has not been run. Treat it as a first draft
until that line changes.

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
- **How they move, and who they were with.** Set `Nswp.moving`
  (`"casual"` or `"intense"`), `Nswp.joined` and `Nswp.mic` as they change,
  and they go with the visitor to the next world. `Nswp.arrival` has the same
  as they arrived.

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
