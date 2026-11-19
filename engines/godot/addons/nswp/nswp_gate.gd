class_name NswpGate
extends NswpPortal
## The standard doorway: an arched frame standing on the floor, a field of light in it, and a
## sign above saying where it leads. It is the same shape wherever a visitor meets one, in any
## world and any engine, so a way out is always recognisable.
##
## Put one where a door is and set `url` and `label`. It makes its own shape to walk into,
## lists itself in the menu, and lights up when a visitor points at it.
##
## The frame is the reference kit's own model (`gate/frame.obj`, made from its modelling code)
## and the three surfaces are its own shaders, written for Godot (`gate/*.gdshader`). To draw a
## door your own way, use `NswpPortal` and draw what you like: this is only the default.

## The door's colour: its light, and the seams in its frame.
@export var accent: Color = Color("4cc9f0"):
	set(value):
		accent = value
		_colour()
## The colour of the words on its sign.
@export var ink: Color = Color("f2f3f6")
## The colour of the ground it stands on, which its metal reflects and fades into with distance.
@export var ground: Color = Color("04070b"):
	set(value):
		ground = value
		_colour()

## Set to true while a visitor is pointing at this door; its light answers. `NswpVisitor` does this.
var aimed: bool = false

const FRAME := preload("res://addons/nswp/gate/frame.obj")
const ALLOY := preload("res://addons/nswp/gate/alloy.gdshader")
const VEIL := preload("res://addons/nswp/gate/veil.gdshader")
const GLOW := preload("res://addons/nswp/gate/glow.gdshader")
## The sign is drawn 1024 pixels wide and hung 2.2 metres wide, as the kit's is.
const SIGN_PIXELS := 1024
const SIGN_METRES := 2.2

var _alloy: ShaderMaterial
var _veil: ShaderMaterial
var _glows: Array[ShaderMaterial] = []
var _aim: float = 0.0
var _sign: Sprite3D


func _ready() -> void:
	super()
	var width := float(Nswp.kit.gateWidth)
	var height := float(Nswp.kit.gateHeight)
	var spring := float(Nswp.kit.gateSpring)

	# The shape a visitor walks into, if the scene gave it none.
	if not _has_shape():
		var shape := CollisionShape3D.new()
		var box := BoxShape3D.new()
		box.size = Vector3(width - 0.1, height, 0.3)
		shape.shape = box
		shape.position.y = height / 2.0
		add_child(shape)

	# The frame, in the kit's metal.
	_alloy = ShaderMaterial.new()
	_alloy.shader = ALLOY
	_alloy.set_shader_parameter("gloss", 0.75)
	var frame := MeshInstance3D.new()
	frame.name = "Frame"
	frame.mesh = FRAME
	frame.material_override = _alloy
	add_child(frame)

	# The field of light that fills it.
	_veil = ShaderMaterial.new()
	_veil.shader = VEIL
	_veil.set_shader_parameter("size", Vector2(width, height))
	_veil.set_shader_parameter("spring", spring)
	var veil := MeshInstance3D.new()
	veil.name = "Veil"
	var opening := QuadMesh.new()
	opening.size = Vector2(width, height)
	veil.mesh = opening
	veil.position.y = height / 2.0
	veil.material_override = _veil
	add_child(veil)

	# The light it gives off: a sheet either side of it, and a pool on the floor.
	var sheet_size := Vector2(width + 2.6, height + 1.7)
	for z: float in [0.125, -0.125]:
		var sheet := QuadMesh.new()
		sheet.size = sheet_size
		sheet.center_offset = Vector3(0.0, sheet_size.y / 2.0 - 0.2, z)
		add_child(_glow_mesh(sheet, false, spring, width / 2.0 + 0.09))
	var pool := QuadMesh.new()
	pool.size = Vector2(3.4, 4.8)
	var on_floor := _glow_mesh(pool, true, spring, width / 2.0 + 0.09)
	# Its corners are laid on the floor by its shader, so say where it really is.
	on_floor.custom_aabb = AABB(Vector3(-1.7, 0.0, -2.4), Vector3(3.4, 0.05, 4.8))
	add_child(on_floor)

	_colour()
	_hang_sign()
	Nswp.add_door(self, label if label != "" else "A door")


func _process(delta: float) -> void:
	var want := 1.0 if aimed else 0.0
	if is_equal_approx(_aim, want):
		return
	_aim = lerpf(_aim, want, minf(1.0, delta * 12.0))
	if absf(_aim - want) < 0.002:
		_aim = want
	_alloy.set_shader_parameter("aim", _aim)
	_veil.set_shader_parameter("aim", _aim)
	for glow in _glows:
		glow.set_shader_parameter("aim", _aim)


## What its sign says of where it leads: whose site it is, never a name alone.
func address_line() -> String:
	if url == "":
		return "A world on Nostr" if naddr != "" else "Nowhere yet"
	var read := Nswp.read_address(url)
	return str(read.domain) if bool(read.ok) else "invalid address"


func _has_shape() -> bool:
	for child in get_children():
		if child is CollisionShape3D or child is CollisionPolygon3D:
			return true
	return false


func _glow_mesh(mesh: Mesh, on_floor: bool, spring: float, radius: float) -> MeshInstance3D:
	var material := ShaderMaterial.new()
	material.shader = GLOW
	material.set_shader_parameter("on_floor", on_floor)
	material.set_shader_parameter("spring", spring)
	material.set_shader_parameter("radius", radius)
	_glows.append(material)
	var instance := MeshInstance3D.new()
	instance.name = "Pool" if on_floor else "Glow"
	instance.mesh = mesh
	instance.material_override = material
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return instance


func _colour() -> void:
	if _alloy == null:
		return
	_alloy.set_shader_parameter("accent", accent)
	_alloy.set_shader_parameter("ground", ground)
	_veil.set_shader_parameter("accent", accent)
	for glow in _glows:
		glow.set_shader_parameter("accent", accent)


## The sign: a dark panel with the door's name and, under it, where it leads. Drawn once, as
## a picture, and hung above the door facing whoever looks at it.
func _hang_sign() -> void:
	var lines := 2
	var size := Vector2i(SIGN_PIXELS, 64 + lines * 72)
	var view := SubViewport.new()
	view.name = "SignPicture"
	view.size = size
	view.transparent_bg = true
	view.disable_3d = true
	view.render_target_update_mode = SubViewport.UPDATE_ONCE

	var panel := Panel.new()
	panel.size = Vector2(size)
	var back := StyleBoxFlat.new()
	back.bg_color = Color(10.0 / 255.0, 12.0 / 255.0, 18.0 / 255.0, 0.72)
	back.set_corner_radius_all(32)
	panel.add_theme_stylebox_override("panel", back)
	view.add_child(panel)

	var name_line := Label.new()
	name_line.text = label if label != "" else "Portal"
	name_line.position = Vector2(40.0, 24.0)
	name_line.size = Vector2(size.x - 80.0, 72.0)
	name_line.clip_text = true
	name_line.add_theme_font_size_override("font_size", 56)
	name_line.add_theme_color_override("font_color", ink)
	# A heavier cut of the font a web export carries, since a browser gives a game no fonts of its own.
	var bold := FontVariation.new()
	bold.base_font = ThemeDB.fallback_font
	bold.variation_embolden = 0.7
	name_line.add_theme_font_override("font", bold)
	panel.add_child(name_line)

	var where_line := Label.new()
	where_line.text = address_line()
	where_line.position = Vector2(40.0, 24.0 + 72.0)
	where_line.size = Vector2(size.x - 80.0, 72.0)
	where_line.clip_text = true
	where_line.add_theme_font_size_override("font_size", 44)
	where_line.add_theme_color_override("font_color", ink)
	panel.add_child(where_line)
	add_child(view)

	_sign = Sprite3D.new()
	_sign.name = "Sign"
	_sign.texture = view.get_texture()
	_sign.pixel_size = SIGN_METRES / float(SIGN_PIXELS)
	_sign.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_sign.shaded = false
	_sign.no_depth_test = false
	_sign.position.y = float(Nswp.kit.gateSignHeight)
	add_child(_sign)
