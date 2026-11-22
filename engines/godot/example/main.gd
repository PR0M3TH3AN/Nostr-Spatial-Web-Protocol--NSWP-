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
const WORKSHOP := "https://workshop.bitblocks.network/"
## What this place is called: on the crossing's room as they arrive, over the menu, and in its announcement.
const TITLE := "The Foundry"
const ACCENT := Color("3df5a0")
const GROUND := Color("141b24")

## Whether this world needs a gate: whether its own `world.json` names what it is entered by
## (`access`), whose lists count (`keepers`), or that its rooms show only named people
## (`named_only`). It names none of them, so there is no gate here: nothing is read and nobody
## is asked. The build stops if this and `world.json` disagree.
const NEEDS_GATE := false
## Where a gate would stand if it were: across the way, between where a visitor arrives and
## the doors. Everything before it is free.
const GATE_Z := 0.0

var _visitor: NswpVisitor
var _veil: StaticBody3D
var _items: NswpItems
var _people: NswpPeople
var _gate: NswpGate
var _said: String = ""


func _ready() -> void:
	_build_place()
	# The kit's menu and sounds. The way home, how to move, fullscreen and the volumes are in it.
	Nswp.menu(TITLE, ACCENT, {"help": "A small world made in Godot with the NSWP addon. Drag to look around. Walk with W, A, S, D, or click the floor to step there: twice to run. Shift runs and Space jumps. Walk into the doorway to go to the Gallery: your own Airlock shows where it really leads, and asks, before you go."})

	_visitor = NswpVisitor.new()
	_visitor.name = "Visitor"
	_visitor.accent = ACCENT
	_visitor.headset_failed.connect(func(why: String) -> void: _say("A headset session couldn't start: %s" % why))
	add_child(_visitor)
	# Where they asked to arrive, or the main entrance.
	Nswp.place(_visitor)
	# What visitors carry (NSWP-17): the Bag tab in the menu, the thing in their hand, and what it
	# sends out. A world has items unless its announcement says "none"; one that says so
	# leaves this node out. Everything but the drawing is the kit's own script.
	_items = NswpItems.new()
	_items.name = "Items"
	_items.visitor = _visitor
	_items.rule = "allowed"
	add_child(_items)
	# Other people (spec §9.4): the room's part of the menu, and whoever else has joined, drawn as
	# they are in every world. Nobody is joined to anything until they ask.
	_people = NswpPeople.new()
	_people.name = "People"
	_people.visitor = _visitor
	_people.items = _items
	add_child(_people)

	# A paid world's gate (NSWP-10, "The front room"). The kit's script asks what the visitor
	# holds and puts the one control that asks to buy in the menu; this world draws the gate
	# and stops them at it. This world is free and keeps no lists, so `gate(false)` makes nothing
	# and says "free".
	_build_veil()
	Nswp.gate_changed.connect(func(_stands: Dictionary) -> void: _tend_gate())
	Nswp.gate(NEEDS_GATE)
	_tend_gate()

	_gate = _add_door("The Gallery", GALLERY, "experience", Vector3(-2.2, 0.0, -5.0))
	_add_door("The Workshop", WORKSHOP, "experience", Vector3(2.2, 0.0, -5.0))
	Nswp.refused.connect(func(reason: String) -> void: _say("That door can't be gone through: %s." % reason))
	_say(_arrival_words())
	# The sound of arriving is played by the crossing's room as its doors open.
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
	plane.size = Vector2(60.0, 60.0)
	slab.mesh = plane
	# The ground every NSWP world stands on: dark, ruled with lines of the place's own light that fade with
	# distance (docs/grid-look.md). Drawn here by a few lines of shader, since Godot has no part of the kit's for it.
	var paint := ShaderMaterial.new()
	var ruled := Shader.new()
	ruled.code = """shader_type spatial;
render_mode unshaded;
uniform vec3 ground : source_color;
uniform vec3 light : source_color;
varying vec3 at;
void vertex() { at = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 cell = at.xz / 2.0;
	vec2 edge = abs(fract(cell - 0.5) - 0.5) / fwidth(cell);
	float line = 1.0 - min(min(edge.x, edge.y), 1.0);
	float near = clamp(1.0 - length(at.xz - CAMERA_POSITION_WORLD.xz) / 46.0, 0.0, 1.0);
	ALBEDO = mix(ground, light, line * near * 0.85);
}"""
	paint.shader = ruled
	paint.set_shader_parameter("ground", GROUND)
	paint.set_shader_parameter("light", ACCENT)
	slab.material_override = paint
	ground.add_child(slab)
	var ground_shape := CollisionShape3D.new()
	var ground_box := BoxShape3D.new()
	ground_box.size = Vector3(60.0, 0.2, 60.0)
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


## The gate itself, while it is shut: a sheet of light across the way with a bright line where
## it meets the floor, and something solid behind it so nobody walks through.
func _build_veil() -> void:
	_veil = StaticBody3D.new()
	_veil.name = "PaidGate"
	_veil.position = Vector3(0.0, 0.0, GATE_Z)
	var shape := CollisionShape3D.new()
	shape.name = "Shape"
	var box := BoxShape3D.new()
	box.size = Vector3(60.0, 6.0, 0.3)
	shape.shape = box
	shape.position.y = 3.0
	_veil.add_child(shape)
	var sheet := MeshInstance3D.new()
	var quad := QuadMesh.new()
	quad.size = Vector2(60.0, 3.2)
	sheet.mesh = quad
	sheet.position.y = 1.6
	var light := StandardMaterial3D.new()
	light.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	light.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	light.cull_mode = BaseMaterial3D.CULL_DISABLED
	light.albedo_color = Color(ACCENT, 0.16)
	sheet.material_override = light
	_veil.add_child(sheet)
	var line := MeshInstance3D.new()
	var strip := BoxMesh.new()
	strip.size = Vector3(60.0, 0.02, 0.07)
	line.mesh = strip
	line.position.y = 0.012
	var bright := StandardMaterial3D.new()
	bright.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	bright.albedo_color = ACCENT
	line.material_override = bright
	_veil.add_child(line)
	add_child(_veil)


## The gate follows what the kit says of it: there and solid while shut, gone while open.
func _tend_gate() -> void:
	var shut := not Nswp.gate_open()
	_veil.visible = shut
	(_veil.get_node("Shape") as CollisionShape3D).set_deferred("disabled", not shut)
	# Shut with them past it (their time ran out): they are stood where they arrived again.
	# Nothing is loaded again under them.
	if _visitor != null and str(Nswp.gate_now.get("state", "")) == "shut" and _visitor.global_position.z < GATE_Z:
		Nswp.place(_visitor)


## A door: the standard doorway, told where it leads and what colour this place is.
func _add_door(label: String, url: String, category: String, at: Vector3) -> NswpGate:
	var gate := NswpGate.new()
	gate.name = label
	gate.url = url
	gate.label = label
	gate.category = category
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
		return "You came by an ordinary link. This place is made in Godot. Walk into a door to go on." if Nswp.is_live() else "Not in a browser: doors lead somewhere only on the web."
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
		"items": _items.report(),
		"people": _people.report(),
		"info": Nswp.people_info(),
		"gate": Nswp.gate_now,
		"veil": _veil.visible,
	})
