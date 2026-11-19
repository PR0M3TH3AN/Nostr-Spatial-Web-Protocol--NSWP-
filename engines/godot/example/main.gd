extends Node3D
## A small world made in Godot, to show the NSWP addon at work.
##
## It has everything a world owes a visitor and nothing else: two places to arrive, a door
## that says where it leads, the way home, and the way into a headset. Everything here is
## built in code, so that the whole of it can be read in one file.
##
## What to look at:
## - `_ready`: the visitor is stood where they arrived (`Nswp.place`).
## - `_add_door`: an `NswpPortal` with a shape, a frame and a sign.
## - `_build_ui`: the way home, shown only when there is one.
## - `_setup_headset`: the way into a headset, offered first to someone who left one to come.

const GALLERY := "https://gallery.bitblocks.network/"
const ACCENT := Color("3df5a0")
const INK := Color("eef5fb")

var _player: CharacterBody3D
var _status: Label
var _vr_button: Button
var _xr: XRInterface


func _ready() -> void:
	_build_world()
	_build_ui()
	_setup_headset()
	# Where they asked to arrive, or the main entrance.
	Nswp.place(_player)
	_say(_arrival_words())
	Nswp.refused.connect(func(reason: String) -> void: _say("That door can't be gone through: %s." % reason))
	_report()


func _process(_delta: float) -> void:
	_report()


# ------------------------------------------------------------------------ the world

func _build_world() -> void:
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
	var slab := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(24.0, 24.0)
	slab.mesh = plane
	slab.material_override = _paint(Color("141b24"))
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

	_player = preload("res://example/player.gd").new()
	_player.name = "Visitor"
	add_child(_player)

	_add_door("The Gallery", GALLERY, Vector3(0.0, 0.0, -5.0))


func _add_entry(entry_name: String, at: Vector3) -> void:
	var marker := Node3D.new()
	marker.name = entry_name
	marker.position = at
	marker.add_to_group(Nswp.ENTRY_GROUP)
	add_child(marker)


## A door: the portal itself, a shape the size of the doorway, a frame to see it by, and a
## sign that says where it leads before anyone goes.
func _add_door(label: String, url: String, at: Vector3) -> void:
	var portal := NswpPortal.new()
	portal.name = label
	portal.url = url
	portal.label = label
	portal.visitor_group = "visitor"
	portal.position = at

	var doorway := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(1.4, 2.4, 0.5)
	doorway.shape = box
	doorway.position.y = 1.2
	portal.add_child(doorway)

	for x: float in [-0.85, 0.85]:
		portal.add_child(_block(Vector3(0.2, 2.7, 0.2), Vector3(x, 1.35, 0.0), Color("1c2530")))
	portal.add_child(_block(Vector3(1.9, 0.2, 0.2), Vector3(0.0, 2.8, 0.0), Color("1c2530")))
	var light := MeshInstance3D.new()
	var quad := QuadMesh.new()
	quad.size = Vector2(1.5, 2.6)
	light.mesh = quad
	light.position.y = 1.3
	var glow := StandardMaterial3D.new()
	glow.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	glow.albedo_color = Color(ACCENT, 0.35)
	glow.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	glow.cull_mode = BaseMaterial3D.CULL_DISABLED
	light.material_override = glow
	portal.add_child(light)

	var sign := Label3D.new()
	sign.text = "%s\n%s" % [label, url.trim_prefix("https://").trim_suffix("/")]
	sign.position.y = 3.3
	sign.pixel_size = 0.006
	sign.modulate = INK
	sign.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	portal.add_child(sign)

	portal.leaving.connect(func(_p: NswpPortal) -> void: _say("Leaving for %s. Your Airlock shows the real address next, and asks." % label))
	add_child(portal)


func _block(size: Vector3, at: Vector3, colour: Color) -> MeshInstance3D:
	var mesh := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = size
	mesh.mesh = box
	mesh.position = at
	mesh.material_override = _paint(colour)
	return mesh


func _paint(colour: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = colour
	return material


# ------------------------------------------------------------------------ what is on the screen

func _build_ui() -> void:
	var layer := CanvasLayer.new()
	var column := VBoxContainer.new()
	column.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT, Control.PRESET_MODE_MINSIZE, 16)
	column.grow_vertical = Control.GROW_DIRECTION_BEGIN
	layer.add_child(column)

	_status = Label.new()
	_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_status.custom_minimum_size = Vector2(420.0, 0.0)
	column.add_child(_status)

	var row := HBoxContainer.new()
	column.add_child(row)

	# The way home, where there is one. In a world that is the visitor's own home, home leads
	# nowhere new: the way to their doors is offered in its place.
	if bool(Nswp.arrival.get("canGoHome", false)):
		var at_home := bool(Nswp.arrival.get("home", false))
		var home := Button.new()
		home.name = "Home"
		home.text = "Your doors" if at_home else "Go home"
		home.pressed.connect(func() -> void:
			if at_home:
				Nswp.doors()
			else:
				Nswp.home())
		row.add_child(home)

	_vr_button = Button.new()
	_vr_button.name = "EnterVR"
	_vr_button.text = "Enter VR"
	_vr_button.visible = false
	_vr_button.pressed.connect(_enter_headset)
	row.add_child(_vr_button)

	# For a visitor with no keyboard: hold to walk forward.
	var walk := Button.new()
	walk.name = "Walk"
	walk.text = "Walk"
	walk.button_down.connect(func() -> void: _player.walking_forward = true)
	walk.button_up.connect(func() -> void: _player.walking_forward = false)
	row.add_child(walk)

	add_child(layer)


func _say(words: String) -> void:
	_status.text = words


func _arrival_words() -> String:
	var a := Nswp.arrival
	if not bool(a.get("arrived", false)):
		return "You came by an ordinary link. Walk into the door to go to the Gallery." if Nswp.is_live() else "Not in a browser: doors lead somewhere only on the web."
	var who := "a guest" if bool(a.get("guest", true)) else str(a.get("name", ""))
	var where := str(a.get("entry", ""))
	return "You arrived as %s%s, moving the %s way.%s" % [
		who,
		"" if where == "" else " at %s" % where,
		str(a.get("moving", "casual")),
		" You left a headset to come here: Enter VR takes you back in." if bool(a.get("immersive", false)) else "",
	]


# ------------------------------------------------------------------------ a headset

func _setup_headset() -> void:
	_xr = XRServer.find_interface("WebXR")
	if _xr == null:
		return
	_xr.session_supported.connect(_on_session_supported)
	_xr.session_started.connect(_on_session_started)
	_xr.session_ended.connect(_on_session_ended)
	_xr.session_failed.connect(func(message: String) -> void: _say("A headset session couldn't start: %s" % message))
	_xr.is_session_supported("immersive-vr")


func _on_session_supported(mode: String, supported: bool) -> void:
	if mode == "immersive-vr":
		_vr_button.visible = supported


## A browser starts a headset session only on a press, so this is a button's doing.
func _enter_headset() -> void:
	_xr.session_mode = "immersive-vr"
	_xr.requested_reference_space_types = "local-floor, local"
	_xr.required_features = "local-floor"
	_xr.optional_features = "hand-tracking"
	if not _xr.initialize():
		_say("A headset session couldn't start.")


func _on_session_started() -> void:
	_player.headset_camera.current = true
	get_viewport().use_xr = true
	_vr_button.visible = false


func _on_session_ended() -> void:
	get_viewport().use_xr = false
	_player.flat_camera.current = true
	_vr_button.visible = true


# ------------------------------------------------------------------------ for tests

## Says where things stand on the page itself, so that a test in a browser can read it.
## Nothing a world needs: take it out of your own.
func _report() -> void:
	if not OS.has_feature("web"):
		return
	var window := JavaScriptBridge.get_interface("window")
	if window == null:
		return
	window.nswpExample = JSON.stringify({
		"ready": true,
		"live": Nswp.is_live(),
		"at": [snappedf(_player.global_position.x, 0.01), snappedf(_player.global_position.z, 0.01)],
		"status": _status.text,
		"entry": str(Nswp.arrival.get("entry", "")),
		"moving": Nswp.moving,
		"home_button": _find_button("Home") != "",
		"home_text": _find_button("Home"),
		"vr_button": _vr_button.visible,
		"in_headset": Nswp.in_headset(),
	})


func _find_button(button_name: String) -> String:
	var found := find_child(button_name, true, false)
	return (found as Button).text if found is Button else ""
