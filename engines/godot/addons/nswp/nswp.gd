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
##         if Nswp.arrival.immersive: offer_vr()      # they left a headset to come here
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

## The project setting that names the Airlock to send a visitor through when they arrived
## without one of their own. A visitor who came through an Airlock always goes back through theirs.
const AIRLOCK_SETTING := "nswp/airlock"
const DEFAULT_AIRLOCK := "https://portal.bitblocks.network/go/"
## Nodes in this group are places a visitor can arrive: each is named for its entry point.
const ENTRY_GROUP := "nswp_entry"
const MAIN_ENTRANCE := "main-entrance"

## How the visitor arrived. Read it after `_ready`, or on `arrived`.
##
## - `arrived`: false for someone who came by an ordinary link.
## - `entry`: the entry point the door named, or "".
## - `immersive`: they left a headset session to come here. Offer the way back in first.
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
## Whether there is a mouse to move the intense way with. False on a phone.
var has_mouse: bool = true

## The numbers every world shares, so that moving about feels the same in all of them and a
## doorway is the same size. In a browser they are read from the kit's script; these are the
## same numbers, for the editor. Lengths are metres, angles radians, speeds per second.
var kit: Dictionary = {
	"walkSpeed": 2.4,
	"tapReach": 6.0,
	"sprint": 1.75,
	"dragLook": 0.005,
	"lookSpeed": 0.0022,
	"pitchLimit": 1.4835298641951802,
	"doubleTap": 400,
	"jumpHeight": 0.45,
	"jumpGravity": 9.8,
	"gateWidth": 1.5,
	"gateHeight": 2.1,
	"gateSpring": 1.35,
	"gateSignHeight": 2.82,
	"doorReach": 3.05,
	"cues": [],
}

var _js: JavaScriptObject = null
var _menu: bool = false
## Doors listed in the menu, by id: each a node with `enter()`, and what it is called.
var _doors: Dictionary = {}


func _ready() -> void:
	if OS.has_feature("web"):
		_js = JavaScriptBridge.get_interface("NSWP")
		if _js == null:
			push_warning("NSWP: nswp-engine.js isn't on the page. Add it to the export's Head Include; see addons/nswp/README.md.")
		else:
			var options := {"airlock": str(ProjectSettings.get_setting(AIRLOCK_SETTING, DEFAULT_AIRLOCK))}
			var read: Variant = JSON.parse_string(str(_js.start(JSON.stringify(options))))
			if typeof(read) == TYPE_DICTIONARY:
				arrival.merge(read, true)
			var numbers: Variant = JSON.parse_string(str(_js.kit()))
			if typeof(numbers) == TYPE_DICTIONARY:
				kit.merge(numbers, true)
	moving = "intense" if str(arrival.get("moving", "casual")) == "intense" else "casual"
	arrived.emit(arrival)


func _process(_delta: float) -> void:
	if not _menu:
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
			"door":
				var id := str(event.get("id", ""))
				door_chosen.emit(id)
				var listed: Variant = _doors.get(id)
				if typeof(listed) == TYPE_DICTIONARY and is_instance_valid(listed.door) and listed.door.has_method("enter"):
					listed.door.enter()


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
func headset(supported: bool, presenting: bool) -> void:
	if _menu:
		_js.headset(JSON.stringify({"supported": supported, "presenting": presenting}))


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
func go(url: String, naddr: String = "", entry_point: String = "") -> bool:
	var destination := {"url": url}
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
