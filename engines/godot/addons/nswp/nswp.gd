extends Node
## The NSWP kit for Godot: how a visitor arrived, the doors out, and the menu and sounds
## every world shares.
##
## A world is a website, and a Godot project exported for the Web is one. What makes it a
## world is small: reading how the visitor arrived from the page's address, and sending them
## on through their own Airlock. This autoload does both, by calling the engine-neutral
## script (`web/nswp-engine.js`) that the exported page loads. See the README beside this file
## for what to set in the export.
##
## It is registered as the autoload `Nswp` when the plugin is enabled:
##
##     func _ready() -> void:
##         Nswp.place($Player)                        # stand them at the entry they asked for
##         # (someone who left a headset to come here is offered the way back in by the page)
##
##     Nswp.go("https://gallery.example/")            # through a door
##     Nswp.home()                                    # back to their own start
##
## It also brings the kit's own menu and sounds, the same ones every other world has:
##
##     Nswp.menu("My world", Color("3df5a0"))         # the menu, over the canvas, and the sounds
##     Nswp.play("cross")                             # a cue by name
##
## The defaults for the rest are beside this file: `NswpGate` is the standard doorway, and
## `NswpVisitor` moves a visitor the way every world's visitors move. Use them, or your own.
##
## Outside a browser (in the editor, or a desktop build) there is no Airlock and nobody
## arrived: `arrival` has its plain values, and the doors only say where they would lead.

## How the visitor arrived was read. Emitted once, at start, in a browser or not.
signal arrived(arrival: Dictionary)
## A door could not be gone through: `reason` is one word (`url_not_https`, `no_destination`, ...).
signal refused(reason: String)
## The visitor chose how to move, in the menu: "casual" or "intense". `moving` is already set.
signal moving_changed(moving: String)
## The menu was opened or closed. While it is open, leave the visitor where they are and let the pointer go.
signal menu_toggled(open: bool)
## The visitor pressed Enter VR (true) or Leave VR (false) in the menu. A browser starts a
## headset session only on a press, and this is one: start it now.
signal vr_pressed(enter: bool)
## Something in the visitor's console changed: a volume, the words on a control. If you
## draw any of it yourself (`console_view`), read it again.
signal console_changed
## The visitor pressed Jump in the menu: the way to ask where there is no keyboard.
signal jump_pressed
## The visitor chose a door from the menu's list (`add_door`). It has been gone through already
## if it has an `enter()` of its own.
signal door_chosen(id: String)
## The crossing's room changed: "arriving" (its doors shut, the world loading), "opening",
## "none" (gone: the world is the visitor's), "leaving", "shut" or "failed". The room is drawn
## by the page, over the canvas, from before the engine loaded: see `ready()`.
signal crossing_changed(state: String)
## Who the visitor is here changed: they signed in or out, in the menu. `who` has `guest`, and
## for someone signed in `name`, `pubkey`, `picture` and `about`. A name is theirs only while
## they are signed in here.
signal who_changed(who: Dictionary)
## A paid world's gate changed: it opened, shut, or has something new to say. `gate` is what
## `gate()` gives: act on `open`, and show `why` if you draw your own words.
signal gate_changed(gate: Dictionary)
## What was asked for with `load()` has come: `found` is false when nothing was kept in that slot.
## `from` is "account" or "device".
signal loaded(slot: String, found: bool, data: String, from: String)
## What was handed to `save()` has been kept: `kept` is "account", "device" or "nowhere", and `said`
## is words for the visitor ("Saved to your account").
signal saved(slot: String, kept: String, said: String)
## The kit moved the visitor a little along the floor: they arrived on top of someone. An
## `NswpVisitor` moves itself; a visitor of your own adds `by` to where it stands.
signal nudged(by: Vector3)

## The project setting that names the Airlock to send a visitor through when they arrived
## without one of their own. A visitor who came through an Airlock always goes back through theirs.
const AIRLOCK_SETTING := "nswp/airlock"
const DEFAULT_AIRLOCK := "https://portal.bitblocks.network/go/"
## The project setting that names where a visitor signs in when no client brought them: they opened
## your world's address themselves. A visitor a client brought signs in where that client says.
## Set it to "" to offer none.
const SIGNER_SETTING := "nswp/signer"
const DEFAULT_SIGNER := "https://bitlogin.network/"
## Nodes in this group are places a visitor can arrive: each is named for its entry point.
const ENTRY_GROUP := "nswp_entry"
const MAIN_ENTRANCE := "main-entrance"

## How the visitor arrived. Read it after `_ready`, or on `arrived`.
##
## - `arrived`: false for someone who came by an ordinary link.
## - `entry`: the entry point the door named, or "".
## - `immersive`: they left a headset session to come here. The page offers the way back in, once you call `headset(true, false)`: a press anywhere reaches you as `vr_pressed(true)`.
## - `home`: this world is where they start, and their own client brought them. Offer the way
##   to their doors (`doors()`) and leave the way home out.
## - `joined`, `mic`: they were among people where they came from, and heard.
## - `moving`: "casual" or "intense", how they were moving, on the device they are on.
## - `form`: "touch" or "desk": how to lay things out for them on a flat screen. It is how
##   they were where they came from, where this device can do the same.
## - `blocked`: keys of people they have blocked everywhere. Connect them to nobody on it.
## - `look`: how they chose to be seen, or "" if they came plain.
## - `guest`, `name`, `pubkey`: who they chose to be. A name is filled only when their pass
##   checked out for this site.
## - `canGoHome`: whether `home()` would lead anywhere.
var arrival: Dictionary = {
	"arrived": false,
	"entry": "",
	"immersive": false,
	"home": false,
	"joined": false,
	"mic": false,
	"moving": "casual",
	"form": "desk",
	"blocked": [],
	"look": "",
	"guest": true,
	"name": "",
	"pubkey": "",
	"canGoHome": false,
	"warnings": [],
}

## How the visitor is moving now: "casual" or "intense". It starts as they arrived, the menu
## changes it (`moving_changed`), and it goes with them through a door.
var moving: String = "casual"
## Whether they are in this world's open room with other people, and whether their microphone
## is on. Set these if the world has rooms of its own; they go with the visitor through a door.
var joined: bool = false
var mic: bool = false
## Identity keys of people they blocked here during this visit, for their own client to ask about.
var blocked_here: PackedStringArray = PackedStringArray()
## Whether the kit's menu is open over the canvas.
var menu_open: bool = false
## How a paid world's gate stands, as `gate()` last gave it and `gate_changed` last said. A
## world with no gate is "free", and open.
var gate_now: Dictionary = {"state": "free", "open": true, "reason": "", "why": "", "offers": [], "until": null}
## Whether there is a mouse to move the intense way with. False on a phone.
var has_mouse: bool = true

## The numbers every world shares, so that moving about feels the same in all of them and a
## doorway is the same size. In a browser they are read from the kit's script; these are the
## same numbers, for the editor. Lengths are metres, angles radians, speeds per second.
var kit: Dictionary = {
	"walkSpeed": 2.4,
	"topSpeed": 4.2,
	"tapReach": 6.0,
	"sprint": 1.75,
	"dragLook": 0.005,
	"lookSpeed": 0.0022,
	"fov": 0,
	"pitchLimit": 1.4835298641951802,
	"doubleTap": 400,
	"pathMost": 12,
	"faceRate": 2.8,
	"jumpHeight": 0.45,
	"jumpGravity": 9.8,
	"gateWidth": 1.5,
	"gateHeight": 2.1,
	"gateSpring": 1.35,
	"gateSignHeight": 2.82,
	"doorReach": 3.05,
	"doorSpacing": 2.5,
	"cues": [],
}

var _js: JavaScriptObject = null
## The frame the page was last asked about, what it answered, and what is to be said with the next.
var _frame_at: int = -1
var _frame_now: Dictionary = {}
var _frame_said: Dictionary = {}
var _menu: bool = false
## Doors listed in the menu, by id: each a node with `enter()`, and what it is called.
var _doors: Dictionary = {}


func _ready() -> void:
	if OS.has_feature("web"):
		_js = JavaScriptBridge.get_interface("NSWP")
		if _js == null:
			push_warning("NSWP: nswp-engine.js isn't on the page. Add it to the export's Head Include; see addons/nswp/README.md.")
		else:
			var options := {
				"airlock": str(ProjectSettings.get_setting(AIRLOCK_SETTING, DEFAULT_AIRLOCK)),
				"signer": str(ProjectSettings.get_setting(SIGNER_SETTING, DEFAULT_SIGNER)),
			}
			var read: Variant = JSON.parse_string(str(_js.start(JSON.stringify(options))))
			if typeof(read) == TYPE_DICTIONARY:
				arrival.merge(read, true)
			var numbers: Variant = JSON.parse_string(str(_js.kit()))
			if typeof(numbers) == TYPE_DICTIONARY:
				kit.merge(numbers, true)
	moving = "intense" if str(arrival.get("moving", "casual")) == "intense" else "casual"
	arrived.emit(arrival)


func _process(_delta: float) -> void:
	if _js == null:
		return
	# What the visitor did in the menu since the last frame.
	var happened: Variant = JSON.parse_string(str(_js.events()))
	if typeof(happened) != TYPE_ARRAY:
		return
	for event: Variant in happened:
		if typeof(event) != TYPE_DICTIONARY:
			continue
		match str(event.get("type", "")):
			"moving":
				moving = "intense" if str(event.get("moving", "")) == "intense" else "casual"
				moving_changed.emit(moving)
			"menu":
				menu_open = bool(event.get("open", false))
				menu_toggled.emit(menu_open)
			"vr":
				vr_pressed.emit(bool(event.get("enter", true)))
			"preview":
				# Whoever makes this world asked for its 360° picture (`NSWP.capturePreview` on the page).
				_take_preview(int(event.get("size", 1024)))
			"changed":
				# The visitor may have changed how fast the view turns or how wide they see: the numbers are read again.
				var again: Variant = JSON.parse_string(str(_js.kit()))
				if typeof(again) == TYPE_DICTIONARY:
					kit.merge(again, true)
				console_changed.emit()
			"jump":
				jump_pressed.emit()
			"home":
				home()
			"doors":
				doors()
			"identity":
				sign_in()
			"figure":
				change_look()
			"crossing":
				crossing_changed.emit(str(event.get("state", "")))
			"gate":
				var stands: Dictionary = (event as Dictionary).duplicate()
				stands.erase("type")
				gate_now = stands
				gate_changed.emit(gate_now)
			"who":
				for field: String in ["guest", "name", "pubkey"]:
					arrival[field] = event.get(field, arrival.get(field))
				who_changed.emit(event)
			"loaded":
				loaded.emit(str(event.get("slot", "")), bool(event.get("found", false)), str(event.get("data", "")), str(event.get("from", "")))
			"saved":
				saved.emit(str(event.get("slot", "")), str(event.get("kept", "nowhere")), str(event.get("said", "")))
			"door":
				var id := str(event.get("id", ""))
				door_chosen.emit(id)
				var listed: Variant = _doors.get(id)
				if typeof(listed) == TYPE_DICTIONARY and is_instance_valid(listed.door) and listed.door.has_method("enter"):
					listed.door.enter()


# ------------------------------------------------------------------------ things visitors carry
# The kit's own script does everything about an item that isn't drawing (NSWP-17). `NswpItems`
# is the node that draws: a world adds that, and has no need to call these itself.

## Begin: the Bag tab joins the menu, and what a visitor holds can be drawn. `rule` is what the
## world's announcement says of items: "allowed" (which is what saying nothing means) or "play". Call after `menu()`. Returns
## `{ "ok": true }` once it has begun.
func items(rule: String, options: Dictionary = {}) -> Dictionary:
	if _js == null or not _menu:
		return {"ok": false}
	var asked := options.duplicate()
	asked["rule"] = rule
	var began: Variant = JSON.parse_string(str(_js.items(JSON.stringify(asked))))
	return began if typeof(began) == TYPE_DICTIONARY else {"ok": false}


## Every frame: say where the visitor is, and be told what to draw. It is asked of the page once
## a frame however many nodes call it: the first call asks, and the rest are given the same answer.
## `view` is what `view_of()` makes. What a node has found out since the last frame goes with it
## (`frame_say`).
func frame(view: Dictionary) -> Dictionary:
	if _js == null:
		return {}
	var n := Engine.get_process_frames()
	if n == _frame_at:
		return _frame_now
	_frame_at = n
	var said := view.duplicate()
	said.merge(_frame_said, true)
	_frame_said = {}
	var now: Variant = JSON.parse_string(str(_js.frame(JSON.stringify(said))))
	_frame_now = now if typeof(now) == TYPE_DICTIONARY else {}
	# Two people who arrive in the same spot step apart: the kit says how far to move this one.
	var nudge: Variant = _frame_now.get("nudge")
	if typeof(nudge) == TYPE_ARRAY and nudge.size() == 2:
		nudged.emit(Vector3(float(nudge[0]), 0.0, float(nudge[1])))
	return _frame_now


## Something to say with the next frame: what the kit asked a node to find out (for items, what
## each thing ran into), or a number of the view a node knows better than the camera does.
func frame_say(key: String, value: Variant) -> void:
	_frame_said[key] = value


## Where the visitor is, for `frame()`: their view and which way it faces, the floor under them,
## and how wide they see. `visitor` is the node that stands where they stand.
func view_of(camera: Camera3D, visitor: Node3D, delta: float) -> Dictionary:
	var size := camera.get_viewport().get_visible_rect().size
	var turn := camera.global_transform.basis.get_rotation_quaternion()
	var at := camera.global_position
	return {
		"dt": delta,
		"head": [at.x, at.y, at.z],
		"turn": [turn.x, turn.y, turn.z, turn.w],
		"floor": visitor.global_position.y if visitor != null else at.y - 1.6,
		"fov": camera.fov,
		"aspect": size.x / maxf(1.0, size.y),
		"presenting": in_headset(),
	}


## Begin: the room's part of the menu is added (Join, the microphone, chat, who is here), and
## other people can be drawn. Call after `menu()`. Nobody is joined to anything until they ask.
## Returns `{ "ok": true }` once it has begun.
func people(options: Dictionary = {}) -> Dictionary:
	if _js == null or not _menu:
		return {"ok": false}
	var began: Variant = JSON.parse_string(str(_js.people(JSON.stringify(options))))
	return began if typeof(began) == TYPE_DICTIONARY else {"ok": false}


## What to draw a person's figure with, by the name a frame gave: three shapes and the colours of
## the kit's metal. Empty for a name no longer in use.
func figure(figure_name: String) -> Dictionary:
	if _js == null:
		return {}
	var got: Variant = JSON.parse_string(str(_js.figure(figure_name)))
	return got if typeof(got) == TYPE_DICTIONARY else {}


## A board's picture, as a PNG in base64, by the key a frame gave. "" for a key no longer in use.
func board(key: String) -> String:
	return "" if _js == null else str(_js.board(key))


## What this visitor sees of each person: for tests.
func people_info() -> Variant:
	return null if _js == null else JSON.parse_string(str(_js.peopleInfo()))


## A model's bytes, as base64, by the hash its file is named by: fetched, checked against that
## hash and counted by the kit. "" while they are on their way; "!" where the file failed.
func model(sha: String) -> String:
	return "" if _js == null else str(_js.model(sha))


## The view was pressed. True if that was the first press of the thing in the visitor's hand,
## sent the way they pressed: then do nothing else with it.
func item_tap(from: Vector3, dir: Vector3, held_ms: int) -> bool:
	if _js == null:
		return false
	return bool(_js.itemTap(JSON.stringify({"from": [from.x, from.y, from.z], "dir": [dir.x, dir.y, dir.z], "heldMs": held_ms})))


## The first press of the thing in the visitor's hand, and its second, from a control of the
## world's own. False if nothing in their hand does anything.
func item_use() -> bool:
	return false if _js == null else bool(_js.itemUse())


func item_second() -> bool:
	return false if _js == null else bool(_js.itemSecond())


## Open the doors of the crossing's room: the world is ready to be stepped into.
##
## A visitor arrives standing in the crossing's room, the same one they left the last world
## from, with its doors shut. The page draws it from its first moment, while the engine is
## still arriving. Asking for the menu (`menu()`) opens the doors by itself, so most worlds
## never call this. Call it when you asked for the menu with `{"hold": true}`, because your
## world has more to load before it should be seen.
func ready() -> void:
	if _js != null:
		_js.ready()


## Where the crossing's room is: "arriving", "opening", "none", "leaving", "shut" or "failed".
## While it isn't "none", the visitor can't see the world: don't start anything they would miss.
func crossing() -> String:
	return "none" if _js == null else str(_js.crossing())


## Who the visitor is here, now: `guest` true, or `name`, `pubkey`, `picture` and `about`.
func who() -> Dictionary:
	if _js == null:
		return {"guest": true, "name": "", "pubkey": "", "picture": "", "about": ""}
	var now: Variant = JSON.parse_string(str(_js.who()))
	return now if typeof(now) == TYPE_DICTIONARY else {"guest": true}


# ------------------------------------------------------------------------ a paid world's gate
# The gate is the kit's own script's (NSWP-10, "The front room"): what a visitor holds, what is for
# sale, and the one control that asks to buy, in the kit's menu. A world draws the gate and stops
# the visitor where it stands. Everything before it is free, and where it stands is yours to choose.

## Begin the gate. Call it once in `_ready`, in a world that is paid or keeps lists: its own
## site says what it is entered by (`access` in `/.well-known/nswp.json`), whose lists count
## (`keepers`), or that its rooms show only named people (`named_only`). `paid` false says your
## world's own settings ask for none of that: then nothing is made, read or asked, and the
## answer is "free". Such a world has no need to call this at all.
##
## Returns how the gate stands, and `gate_changed` says whenever that changes: `open` is whether
## a visitor may go past it now, and it is false until the gate knows. `why` is why it is shut,
## in plain words; `offers` what can be bought (`name`, `sats`, `term`, `words`); `until` when
## a pass ends, in seconds, or null.
##
## It opens on a receipt and on nothing else, and your world never takes the money or draws
## the question: the visitor's own sign-in address does, at the press of `gate-buy` in the menu.
func gate(paid: bool = true) -> Dictionary:
	if _js == null:
		# Not on the web there is nobody to ask what a visitor holds. In the editor that is the
		# world's maker, walking their own world: open. In anything exported it is shut.
		var making := OS.has_feature("editor")
		gate_now = {
			"state": "free" if not paid else ("open" if making else "shut"),
			"open": not paid or making,
			"reason": "" if not paid or making else "no-signer",
			"why": "" if not paid or making else "This gate opens only in a browser, where a visitor's sign-in address can be asked what they hold.",
			"offers": [],
			"until": null,
		}
		return gate_now
	var stands: Variant = JSON.parse_string(str(_js.gate(JSON.stringify({"paid": paid}))))
	if typeof(stands) == TYPE_DICTIONARY:
		gate_now = stands
	elif paid:
		# An answer that can't be read is not a yes.
		gate_now = {"state": "shut", "open": false, "reason": "", "why": "", "offers": [], "until": null}
	return gate_now


## Whether a visitor may go past the gate now. False while anything about it is unknown.
func gate_open() -> bool:
	return gate_now.get("open", false) == true


## Press the gate's control, as pressing it in the menu would: for a gate that is pressed in
## the world. It asks their sign-in address to sell them the first thing on offer, or signs
## them in first. Returns false if there is nothing to press just now.
func gate_press() -> bool:
	return run("gate-buy")


## Keep this for the visitor: text, your world's own (JSON is the usual choice), 32 KB at most, in
## a slot ("main" unless you name another: lower-case letters, digits and hyphens). It is kept on
## their device at once, and with their account if they are signed in here, encrypted so only
## they can read it; then it is there on their next device. `saved` says where it was kept.
## Your world can read its own saves and nobody else's.
func save(data: String, slot: String = "main") -> void:
	if _js == null:
		saved.emit(slot, "nowhere", "Saves need a browser.")
		return
	_js.save(data, slot)


## Ask for what was kept in a slot: the newer of their device's and their account's. The answer
## comes as `loaded`. Ask once the menu is up, and again on `who_changed` if a save matters to you:
## someone who signs in may have one from another device.
func load_save(slot: String = "main") -> void:
	if _js == null:
		loaded.emit(slot, false, "", "")
		return
	_js.load(slot)


## Whether this is running in a browser with the kit's script on the page: whether doors lead anywhere.
func is_live() -> bool:
	return _js != null


# ------------------------------------------------------------------------ the menu and the sounds

## Put the kit's menu over the canvas and start its sounds: the same menu, in the same corner,
## with the same sounds at the volumes the visitor set, as in every other world. Call it once.
##
## `accent` is the world's colour. `options` may have `sounds` (the world's own sounds, as in a
## world's settings: see docs/controls-kit.md, "Sound"), `kit` (where the page serves the kit's
## sound files, "sounds/kit/" unless you say) and `help` (a few lines for the Help section).
##
## The menu has the way home, how to move at a desk, fullscreen, the way into a headset when
## there is one (`headset()`), the sound volumes and the visitor's own music. What it can't do
## for you it tells you: `moving_changed`, `menu_toggled`, `vr_pressed`, `door_chosen`.
func menu(title: String, accent: Color = Color("4cc9f0"), options: Dictionary = {}) -> void:
	if _js == null or _menu:
		return
	var o := {"title": title, "accent": "#" + accent.to_html(false), "kit": "sounds/kit/"}
	o.merge(options, true)
	var began: Variant = JSON.parse_string(str(_js.menu(JSON.stringify(o))))
	_menu = true
	for id: String in _doors:
		_js.door(JSON.stringify({"id": id, "label": str(_doors[id].label)}))
	if typeof(began) == TYPE_DICTIONARY:
		has_mouse = bool(began.get("mouse", true))
		var starts := "intense" if str(began.get("moving", "")) == "intense" else "casual"
		if starts != moving:
			moving = starts
			moving_changed.emit(moving)


## Play one of the kit's cues by name: "cross", "arrive", "hover", "press", "notice" and the
## rest (`kit.cues`). It is the world's own sound for it if it has one, or the default.
func play(cue: String) -> void:
	if _menu:
		_js.play(cue)


## Say how far the visitor was moved this frame, in metres, by what moves them (keys, a tap, a
## stick: not how their head swayed). Their steps are heard. `NswpVisitor` does this.
func moved(metres: float) -> void:
	if _menu and metres > 0.0:
		_js.moved(metres)


## They walked into something.
func bump() -> void:
	if _menu:
		_js.bump()


## A few words shown for a moment, where the menu shows them.
func say(words: String) -> void:
	if _menu:
		_js.say(words)
	else:
		print("NSWP: ", words)


## Say what the visitor is pointing at, or "" for nothing, with a few more lines about it. On
## a flat screen it is shown beside the controls, the same size wherever the thing is, so a
## world needn't hang a sign in front of it.
func target(name_of_it: String, detail: PackedStringArray = PackedStringArray()) -> void:
	if _menu:
		_js.target(name_of_it, JSON.stringify(Array(detail)))


## Tell the menu about a headset: whether this browser can start a session (the way in is then
## offered) and whether one is running (the page's menu is put away, and the control is the way out).
##
## A visitor who left a headset to come here is offered the way back in by the page, as in every
## world: a press anywhere on it reaches you as `vr_pressed(true)`. Say `failed` when a session you
## asked for didn't start, so the next press is taken.
func headset(supported: bool, presenting: bool, failed: bool = false) -> void:
	if _menu:
		_js.headset(JSON.stringify({"supported": supported, "presenting": presenting, "failed": failed}))


## Everything in the visitor's console, for drawing some or all of it in an interface of
## your own: their home button on your pause menu, their volumes on your settings screen,
## wherever you like. `sections` is the whole menu and `hotbar` the few kept at hand; each
## item has an `id` to press it by (`run`), its `label` as it stands now, and `on`.
## The words change as things do; `console_changed` says when to ask again.
func console_view() -> Dictionary:
	if _menu:
		var read: Variant = JSON.parse_string(str(_js.view()))
		if typeof(read) == TYPE_DICTIONARY:
			return read
	return {"sections": [], "hotbar": [], "open": false}


## Press something in the visitor's console by its id, as pressing it there would: "home",
## "fullscreen", "sound-music", "jump". It is the same button, with the visitor's own
## settings and their own home. Returns false if there is no such thing just now.
func run(id: String) -> bool:
	return _menu and bool(_js.run(id))


## Bring the visitor's console up, or put it away: for a button of your own that opens it.
func open_console(open: bool = true) -> void:
	if _menu:
		_js.open("1" if open else "0")


## How much of the screen the kit's controls take: "full", "quiet" (one small mark in a
## corner) or "hidden" (nothing at all). For a world with an interface of its own, which
## leads. Whatever you choose, the visitor can still bring the controls up with the summons,
## which is theirs in every world: the key left of 1, or two fingers held still. Watch
## `menu_toggled`, and leave their input alone while the controls are up.
func set_presence(level: String) -> void:
	if _menu:
		_js.presence(level)


## Take every key for your own game, or give them back. The summons still works.
func claim_keys(claimed: bool) -> void:
	if _menu:
		_js.claim("1" if claimed else "0")


## List a door in the menu, so it can be gone through from there as well as by walking in.
## `door` is anything with an `enter()` method; `NswpGate` lists itself.
func add_door(door: Node, label: String) -> void:
	var id := str(door.get_instance_id())
	_doors[id] = {"door": door, "label": label}
	if _menu:
		_js.door(JSON.stringify({"id": id, "label": label}))


## How a door's address should be read on its sign: `domain` is the part that says whose site
## it is. A sign shows that, never a name alone. `ok` is false for an address no door can lead to.
func read_address(url: String) -> Dictionary:
	if _js != null:
		var read: Variant = JSON.parse_string(str(_js.check(url)))
		if typeof(read) == TYPE_DICTIONARY:
			return read
	var host := url.trim_prefix("https://").get_slice("/", 0)
	return {"ok": url.begins_with("https://"), "domain": host, "prefix": "", "host": host, "code": ""}


# ------------------------------------------------------------------------ arriving

## The place a visitor who arrived by `entry` should stand: the node in the group `nswp_entry`
## with that name, or the one named `main-entrance`, or null if the scene has neither.
func entry_marker(entry: String = "") -> Node3D:
	var wanted := entry if entry != "" else str(arrival.get("entry", ""))
	var main: Node3D = null
	for node in get_tree().get_nodes_in_group(ENTRY_GROUP):
		if not (node is Node3D):
			continue
		if wanted != "" and node.name == wanted:
			return node
		if node.name == MAIN_ENTRANCE:
			main = node
	return main


# ------------------------------------------------------------------------ the picture a door shows

## Nodes in this group are left out of the world's 360° picture: anything about one visitor.
## `NswpPeople` and `NswpItems` put themselves in it.
const NOT_IN_PREVIEW_GROUP := "nswp_not_in_preview"
## Emitted before the six views are taken, and after: hide and show anything else that is about
## one visitor, or changes from moment to moment.
signal preview_taking(taking: bool)

var _taking_preview: bool = false


## Take the six views the world's 360° picture is made from, and hand them to the page, which
## paints them into one picture (the kit's own painting, the same a Three.js world uses). Taken
## from the main entrance, at eye height, without fog or glow: those differ from view to view
## and would leave seams.
##
## A world needn't call this. Whoever makes it asks the page: `await NSWP.capturePreview(2048)`.
func _take_preview(size: int) -> void:
	if _js == null or _taking_preview:
		return
	var marker := entry_marker(MAIN_ENTRANCE)
	if marker == null:
		_js.previewFaces("{}")
		return
	_taking_preview = true
	preview_taking.emit(true)
	var hidden: Array[Node3D] = []
	for node in get_tree().get_nodes_in_group(NOT_IN_PREVIEW_GROUP):
		if node is Node3D and node.visible:
			node.visible = false
			hidden.append(node)
	var views: Variant = JSON.parse_string(str(_js.previewViews()))
	var faces: Array[String] = []
	var viewport := SubViewport.new()
	viewport.size = Vector2i(clampi(size, 128, 2048), clampi(size, 128, 2048))
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	viewport.msaa_3d = Viewport.MSAA_4X
	var camera := Camera3D.new()
	camera.fov = 90.0
	camera.near = 0.05
	camera.far = 700.0
	# The world's own light and sky, without what changes with the way a camera faces.
	for found in get_tree().root.find_children("*", "WorldEnvironment", true, false):
		var world_environment := found as WorldEnvironment
		if world_environment != null and world_environment.environment != null:
			var plain := world_environment.environment.duplicate() as Environment
			plain.fog_enabled = false
			plain.volumetric_fog_enabled = false
			plain.glow_enabled = false
			plain.ssao_enabled = false
			plain.ssr_enabled = false
			camera.environment = plain
			break
	viewport.add_child(camera)
	add_child(viewport)
	viewport.world_3d = get_viewport().world_3d
	camera.current = true
	var eye := marker.global_position + Vector3(0.0, 1.6, 0.0)
	if typeof(views) == TYPE_ARRAY:
		for view: Variant in views:
			if typeof(view) != TYPE_DICTIONARY:
				continue
			var forward := _three(view.get("forward"))
			var up := _three(view.get("up"))
			camera.look_at_from_position(eye, eye + forward, up)
			# Two frames: one for the camera to be where it was put, one for the picture of it.
			await RenderingServer.frame_post_draw
			await RenderingServer.frame_post_draw
			var image := viewport.get_texture().get_image()
			faces.append(Marshalls.raw_to_base64(image.save_png_to_buffer()))
	viewport.queue_free()
	for node in hidden:
		if is_instance_valid(node):
			node.visible = true
	_taking_preview = false
	preview_taking.emit(false)
	_js.previewFaces(JSON.stringify({"faces": faces}))


func _three(value: Variant) -> Vector3:
	if typeof(value) == TYPE_ARRAY and value.size() == 3:
		return Vector3(float(value[0]), float(value[1]), float(value[2]))
	return Vector3.ZERO


## Stand `visitor` where they arrived, facing the way that place faces. Returns false if the
## scene has no entry for them, and leaves them where they are.
func place(visitor: Node3D) -> bool:
	var marker := entry_marker()
	if marker == null:
		return false
	visitor.global_transform = marker.global_transform
	return true


# ------------------------------------------------------------------------ leaving

## Send the visitor through a door, to `url`. `naddr` is the world's announcement, if the door
## has it, and `entry_point` where in that world to arrive. Their own Airlock shows them the
## real address and asks before they go: a door here never needs to.
##
## A headset session is ended first, since the page is about to be left. Returns false, and
## emits `refused`, if the door can't be gone through.
func go(url: String, naddr: String = "", entry_point: String = "", title: String = "") -> bool:
	var destination := {"url": url}
	# What the door is called, for the sign in the crossing's room as it shuts round the visitor.
	if title != "":
		destination["title"] = title
	if naddr != "":
		destination["naddr"] = naddr
	if entry_point != "":
		destination["entryPoint"] = entry_point
	if _js == null:
		print("NSWP: a door to ", url, " (doors lead somewhere only in a browser)")
		return false
	var state := _state()
	_leave_headset()
	var reason := str(_js.go(JSON.stringify(destination), JSON.stringify(state)))
	if reason != "":
		refused.emit(reason)
		return false
	return true


## Take the visitor home: their own client's start. Offer it wherever they can reach it; it is
## the one exit that leads somewhere they already trust. Returns false if there is no way there.
## The menu offers it for you.
func home() -> bool:
	if _js == null or not bool(arrival.get("canGoHome", false)):
		return false
	var state := _state()
	_leave_headset()
	return bool(_js.home(JSON.stringify(state)))


## Take the visitor to their doors. For a world that is someone's home (`arrival.home`), which
## offers this where another world would offer the way home.
func doors() -> bool:
	if _js == null or not bool(arrival.get("canGoHome", false)):
		return false
	var state := _state()
	_leave_headset()
	return bool(_js.doors(JSON.stringify(state)))


## The visitor asked to say who they are: to sign in, switch to another profile, or go on as
## a guest. A world never asks that itself and never holds a key, so this leaves for their own
## client, which asks them in its own way and brings them back here: by name if they chose
## that (`arrival.name`, `arrival.pubkey`), as a guest if not. The menu offers it for you, under
## "You"; call this from a button of your own if you draw one. Returns false if they came
## through no client.
func sign_in() -> bool:
	if _js == null or not bool(arrival.get("canGoHome", false)):
		return false
	var state := _state()
	_leave_headset()
	return bool(_js.signIn(JSON.stringify(state)))


## The visitor asked to change how they look. Their look is kept by their own client and is
## the same in every world, so this leaves for it and brings them back here wearing it
## (`arrival.look`). The menu offers it for you, under "You". Never edit a look yourself or
## send one back: draw it your own way if your world has a style of its own, and leave what
## it is to them. Returns false if they came through no client.
func change_look() -> bool:
	if _js == null or not bool(arrival.get("canGoHome", false)):
		return false
	var state := _state()
	_leave_headset()
	return bool(_js.changeLook(JSON.stringify(state)))


## Whether the visitor is in a headset session now.
func in_headset() -> bool:
	var xr := XRServer.find_interface("WebXR")
	return xr != null and xr.is_initialized() and get_viewport().use_xr


func _state() -> Dictionary:
	return {
		"immersive": in_headset(),
		"joined": joined,
		"mic": joined and mic,
		"moving": moving,
		"blocked": Array(blocked_here),
	}


func _leave_headset() -> void:
	var xr := XRServer.find_interface("WebXR")
	if xr != null and xr.is_initialized():
		get_viewport().use_xr = false
		xr.uninitialize()
