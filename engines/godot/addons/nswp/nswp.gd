extends Node
## The NSWP kit for Godot: how a visitor arrived, and the doors out.
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
## Outside a browser (in the editor, or a desktop build) there is no Airlock and nobody
## arrived: `arrival` has its plain values, and the doors only say where they would lead.

## How the visitor arrived was read. Emitted once, at start, in a browser or not.
signal arrived(arrival: Dictionary)
## A door could not be gone through: `reason` is one word (`url_not_https`, `no_destination`, ...).
signal refused(reason: String)

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
	"blocked": [],
	"look": "",
	"guest": true,
	"name": "",
	"pubkey": "",
	"canGoHome": false,
	"warnings": [],
}

## How the visitor is moving now: "casual" or "intense". Set it when they choose, and it goes
## with them through a door. It starts as they arrived.
var moving: String = "casual"
## Whether they are in this world's open room with other people, and whether their microphone
## is on. Set these if the world has rooms of its own; they go with the visitor through a door.
var joined: bool = false
var mic: bool = false
## Identity keys of people they blocked here during this visit, for their own client to ask about.
var blocked_here: PackedStringArray = PackedStringArray()

var _js: JavaScriptObject = null


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
	moving = "intense" if str(arrival.get("moving", "casual")) == "intense" else "casual"
	arrived.emit(arrival)


## Whether this is running in a browser with the kit's script on the page: whether doors lead anywhere.
func is_live() -> bool:
	return _js != null


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
