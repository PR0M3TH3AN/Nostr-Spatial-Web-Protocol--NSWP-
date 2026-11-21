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
2. In your Web export preset, set **HTML, Custom HTML Shell** to
   `res://addons/nswp/web/shell.html`, and **HTML, Head Include** to your
   world's name and colour:

   ```html
   <meta name="nswp:title" content="My world">
   <meta name="nswp:accent" content="#4cc9f0">
   ```

   The shell is the page your world is exported with. It has no loading
   screen of Godot's: from its first moment it shows the crossing's room,
   the one a visitor left the last world from, wearing that name and colour.
   The line of light over its doors fills as the engine arrives, and the
   doors open when your world asks for its menu (`Nswp.menu`). It also runs
   nothing written into the page itself, so it can be served under a content
   policy with no inline script. (Godot's engine still needs
   `'wasm-unsafe-eval'` there.)
3. In Project Settings, Application, Boot Splash: turn **Show Image** off
   and set **BG Color** to something dark. Nobody sees it, since the room is
   in front of it, but it is what the canvas holds for a moment.
4. After each export, copy everything in `addons/nswp/web/` but `shell.html`
   beside the exported `index.html`: the kit's script (`nswp-engine.js`),
   the script that starts the engine (`nswp-godot.js`) and the kit's sounds
   (`sounds/`). An export can't do this for you: files it adds go inside the
   game's package, and the page has to load these itself.
5. Serve the export over https, with the file that says who may announce it
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
- **What they prefer, in every world.** A filled screen, the intense way at
  a desk, how fast the view turns and how wide they see are the visitor's
  own, set once and brought with them. An `NswpVisitor` starts from them and
  follows them as they change (`Nswp.kit.lookSpeed`, `Nswp.kit.fov`, read
  again on `console_changed`). A visitor of your own reads the same numbers.
- **The way home.** The menu offers it. `Nswp.home()` does it from your own
  code. If `Nswp.arrival.home` is true, this world is their home, and the
  menu offers their doors instead.
- **Signing in.** The menu offers it under "You": "You are a guest here.
  Sign in". It leaves for the visitor's own client, which asks them on its
  own page and brings them back here; `Nswp.arrival.name` and `pubkey` are
  then filled if they chose to come by name. `Nswp.sign_in()` does it from a
  button of your own. Never draw a sign-in yourself, and never ask for a
  password or a key: that is the one thing about signing in a world must not
  do ([NSWP-10](../../../../protocol/10-identity.md)). They sign in once, in
  their own client, and arrive at every world signed in: there is nothing
  for your world to keep in step.
- **Their look.** "Change how you look" is beside it and works the same way:
  `Nswp.change_look()`. They come back wearing it (`Nswp.arrival.look`).
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

## Things visitors carry

A visitor has a bag, and may take one thing from it in hand. Some things do
something: a toy blaster sends out darts ([NSWP-17](../../../../protocol/17-items.md)).
To have that in your world:

```gdscript
var items := NswpItems.new()
items.visitor = $Visitor       # an NswpVisitor, or the node that stands where they stand
items.rule = "allowed"         # what your world's announcement says of items
add_child(items)
```

That is all of it. The Bag tab joins the menu; what a visitor holds is
drawn in their hand; what it sends out flies, sticks to anything of yours
with a collision shape, lets go and is gone. A tap or a click on the view
is the item's first press, and a press held still walks. Nothing of your
world has to be an item.

Almost none of it is this addon's: the kit's own script on the page does
everything that isn't drawing, and it is the same code a Three.js world
runs. So an item behaves the same in your world as in any other.

Three things to do beside the code:

1. **Nothing, in your announcement:** a world has items unless it says
   otherwise. A world that leaves `NswpItems` out can't draw them, and
   says so: `"items": "none"` in its `world.json`, signed and published,
   so that doors to it tell the truth.
2. **Serve the locked box.** An item's own logic runs in a page of its own
   that can reach nothing: `item-box.html`, beside your `index.html`. Its
   text is `ITEM_BOX_HTML` in the kit's core, and your host must send it
   with exactly `ITEM_BOX_CSP` as its Content-Security-Policy and none of
   your site's other content rules. `scripts/build-godot-example.mjs` in
   the kit's repository does both for the example. Where it isn't served
   that way, items are shapes in your world and do nothing of their own;
   set `items.scripts = false` to say so.
3. **Let your page fetch models:** `connect-src` with `https:`. An item's
   files are wherever its maker keeps them.

**Making an item in Godot.** Build it as a scene: one unit is one metre, it
stands on its base, and it faces -Z. Then:

```
godot --headless --path . --script addons/nswp/nswp_item_model.gd -- res://mallet.tscn mallet.glb
nswp make-item mallet.glb --title "Mallet" --host https://your.site/items/
```

The first writes the scene out as the one file an item's model is. The
second measures it, names it by its hash and writes its description, ready
to sign. A material named `tint_accent` (Godot won't keep a colon in a
name) is a colour whoever holds it may choose. The item then works in
every world that draws items, whatever each is made with.

With `NswpPeople` beside it (below), what a visitor holds is seen by
everyone in the room, and what it sends out reaches them: a hit, how
someone is, and muting one person's items all work as in every world.

**Not here yet:** anything of this in a headset.

## Other people

A visitor may join the room of your world, and then sees and hears whoever
else is there:

```gdscript
var people := NswpPeople.new()
people.visitor = $Visitor      # an NswpVisitor, or the node that stands where they stand
people.items = $Items          # your NswpItems, if you have one: what people hold is drawn
add_child(people)
```

The room's part of the menu is added (Join, the microphone, chat, who is
here), and whoever has joined is drawn: the same figures, names and
written words as in every other world, because the kit's script makes them
and this node only draws what it is handed. Voices and chat are the page's
own; there is nothing of sound to set up.

Nobody is joined to anything until they ask, having been told what joining
shows of them. Set `people.shared_music = false` for a place that wants
none of its visitors' music shared.

Two people who arrive in the same spot step apart. An `NswpVisitor` moves
itself; for a visitor of your own, connect `Nswp.nudged` and add what it
gives to where they stand.

**Not here yet:** a screen someone shares, pressing a person's picture (the
People tab has everyone), and anything of this in a headset.

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
| `nswp.gd` | The `Nswp` autoload. It also keeps a visitor's progress with their account: `save()`, `load_save()` and the signals `saved` and `loaded` ([NSWP-12](../../../../protocol/12-saves.md)). |
| `nswp_portal.gd` | `NswpPortal`: a door with nothing drawn. |
| `nswp_gate.gd` | `NswpGate`: the standard doorway. Set `category` and its sign says what kind of place it leads to. |
| `nswp_visitor.gd` | `NswpVisitor`: a visitor who moves the way every world's do. |
| `nswp_items.gd` | `NswpItems`: what a visitor holds, and what it sends out. |
| `nswp_people.gd` | `NswpPeople`: the room, and everyone else in it. |
| `nswp_item_model.gd` | Writes a scene out as an item's model. Run it from a terminal. |
| `gate/frame.obj` | The doorway's frame. Made from the reference kit's modelling code; don't edit it here. |
| `gate/*.gdshader` | The kit's metal, the field of light in a doorway and its glow, written for Godot. |
| `web/` | What goes beside the exported page: the kit's script and its sounds. Godot ignores this folder. |

## The example

[`../../example/`](../../example/) is a small world that uses all of the
above: two entry points, two doors and a floor. It is public as The Foundry,
at <https://foundry.bitblocks.network>, with a door to it in the Workshop. The project file beside it
(`engines/godot/project.godot`) opens in Godot 4.

To export it and try it in a browser, from the repository's root:

```
npm run build:godot
node scripts/serve-local.mjs
```

The first needs Godot 4 and its web export templates (`GODOT=/path/to/godot`
if it isn't on the PATH). The export is about 40 MB, nearly all of it Godot
itself, and isn't kept in the repository. The same command writes the
world's manifest and its site's headers beside the export, from
`engines/godot/world.json`: a Godot world of your own needs the same two
things ([`scripts/build-godot-example.mjs`](../../../../scripts/build-godot-example.mjs)
shows both, and `nswp check <address>` says whether a site has them right). On that server its door leads to
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

- **A screen someone shares** in a room: it is watched on one of the kit's
  panels, and there are none of those here yet.
- **Moving in a headset**, and the menu there. The page's menu can't be seen
  in a session.
- **The view through a door** of where it leads: a doorway here shows its
  field of light.
- **A room of its own shape to cross in.** The crossing's room is there, at
  both ends of every trip, but it is the page's picture of it, seen from its
  middle facing the doors. A Three.js world's can be looked round in.
- **Posting from a world** ("My public feed"). Signing in is here; the feed
  is not yet.
