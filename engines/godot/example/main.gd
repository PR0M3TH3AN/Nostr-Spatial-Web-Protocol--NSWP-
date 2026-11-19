extends Node3D
## A small world made in Godot, to show the NSWP addon at work.
##
## It has everything a world owes a visitor and nothing else, and everything in it that a
## visitor has met before is the kit's own: the doorway (`NswpGate`), the way they move
## (`NswpVisitor`), and the menu and sounds (`Nswp.menu`). Only the place itself is drawn
## here: a floor, a sky and two places to arrive. It is built in code, so that the whole of
## it can be read in one file.
##
## What to look at in `_ready`:
## - `Nswp.menu(...)`: the menu every world has, over the canvas, with its sounds.
## - `NswpVisitor.new()`: a visitor, moving the casual way or the intense way as they choose.
## - `Nswp.place(visitor)`: they are stood where they arrived.
## - `_add_door`: an `NswpGate`, which needs only to be told where it leads.

const GALLERY := "https://gallery.bitblocks.network/"
const ACCENT := Color("3df5a0")
const GROUND := Color("141b24")

var _visitor: NswpVisitor
var _gate: NswpGate
var _said: String = ""


func _ready() -> void:
	_build_place()
	# The kit's menu and sounds. The way home, how to move, fullscreen and the volumes are in it.
	Nswp.menu("A world in Godot", ACCENT, {"help": "A small world made in Godot with the NSWP addon. Drag to look around. Walk with W, A, S, D, or click the floor to step there: twice to run. Shift runs and Space jumps. Walk into the doorway to go to the Gallery: your own Airlock shows where it really leads, and asks, before you go."})

	_visitor = NswpVisitor.new()
	_visitor.name = "Visitor"
	_visitor.accent = ACCENT
	_visitor.headset_failed.connect(func(why: String) -> void: _say("A headset session couldn't start: %s" % why))
	add_child(_visitor)
	# Where they asked to arrive, or the main entrance.
	Nswp.place(_visitor)

	_gate = _add_door("The Gallery", GALLERY, Vector3(0.0, 0.0, -5.0))
	Nswp.refused.connect(func(reason: String) -> void: _say("That door can't be gone through: %s." % reason))
	_say(_arrival_words())
	if bool(Nswp.arrival.get("arrived", false)):
		Nswp.play("arrive")
	_report()


func _process(_delta: float) -> void:
	_report()


# ------------------------------------------------------------------------ the place

func _build_place() -> void:
	var sky := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("04070b")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("8fa3b8")
	environment.ambient_light_energy = 0.7
	sky.environment = environment
	add_child(sky)

	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-55.0, 30.0, 0.0)
	add_child(sun)

	var ground := StaticBody3D.new()
	ground.name = "Ground"
	var slab := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(24.0, 24.0)
	slab.mesh = plane
	var paint := StandardMaterial3D.new()
	paint.albedo_color = GROUND
	slab.material_override = paint
	ground.add_child(slab)
	var ground_shape := CollisionShape3D.new()
	var ground_box := BoxShape3D.new()
	ground_box.size = Vector3(24.0, 0.2, 24.0)
	ground_shape.shape = ground_box
	ground_shape.position.y = -0.1
	ground.add_child(ground_shape)
	add_child(ground)

	# Places a visitor can arrive. Each is named for its entry point and is in the addon's group.
	_add_entry("main-entrance", Vector3(0.0, 0.0, 4.0))
	_add_entry("balcony", Vector3(6.0, 0.0, 4.0))


func _add_entry(entry_name: String, at: Vector3) -> void:
	var marker := Node3D.new()
	marker.name = entry_name
	marker.position = at
	marker.add_to_group(Nswp.ENTRY_GROUP)
	add_child(marker)


## A door: the standard doorway, told where it leads and what colour this place is.
func _add_door(label: String, url: String, at: Vector3) -> NswpGate:
	var gate := NswpGate.new()
	gate.name = label
	gate.url = url
	gate.label = label
	gate.accent = ACCENT
	gate.ground = GROUND
	gate.visitor_group = "visitor"
	gate.position = at
	gate.leaving.connect(func(_p: NswpPortal) -> void: _say("Leaving for %s." % label))
	add_child(gate)
	return gate


# ------------------------------------------------------------------------ words

func _say(words: String) -> void:
	_said = words
	Nswp.say(words)


func _arrival_words() -> String:
	var a := Nswp.arrival
	if not bool(a.get("arrived", false)):
		return "You came by an ordinary link. Walk into the door to go to the Gallery." if Nswp.is_live() else "Not in a browser: doors lead somewhere only on the web."
	var who := "a guest" if bool(a.get("guest", true)) else str(a.get("name", ""))
	var where := str(a.get("entry", ""))
	return "You arrived as %s%s." % [who, "" if where == "" else " at %s" % where]


# ------------------------------------------------------------------------ for tests

## Says where things stand on the page itself, so that a test in a browser can read it.
## Nothing a world needs: take it out of your own.
func _report() -> void:
	if not OS.has_feature("web"):
		return
	var window := JavaScriptBridge.get_interface("window")
	if window == null:
		return
	var eyes := _visitor.flat_camera
	var door_on_screen := eyes.unproject_position(_gate.global_position + Vector3(0.0, 1.0, 0.0))
	var floor_on_screen := eyes.unproject_position(_visitor.global_position + _visitor.global_transform.basis * Vector3(1.5, 0.0, -4.0))
	window.nswpExample = JSON.stringify({
		"ready": true,
		"live": Nswp.is_live(),
		"at": [snappedf(_visitor.global_position.x, 0.01), snappedf(_visitor.global_position.z, 0.01)],
		"height": snappedf(_visitor.global_position.y, 0.001),
		"yaw": snappedf(_visitor.rotation.y, 0.001),
		"pitch": snappedf(eyes.rotation.x, 0.001),
		"said": _said,
		"entry": str(Nswp.arrival.get("entry", "")),
		"moving": Nswp.moving,
		"marks": _visitor.marks(),
		"form": str(Nswp.arrival.get("form", "")),
		"menu_open": Nswp.menu_open,
		"looking": _visitor.looking(),
		"aimed": _gate.aimed,
		"in_headset": Nswp.in_headset(),
		"kit": Nswp.kit,
		"door_at": [roundi(door_on_screen.x), roundi(door_on_screen.y)],
		"floor_at": [roundi(floor_on_screen.x), roundi(floor_on_screen.y)],
		"frame_corners": (_gate.get_node("Frame") as MeshInstance3D).mesh.get_faces().size(),
		"sign": _gate.address_line(),
	})
