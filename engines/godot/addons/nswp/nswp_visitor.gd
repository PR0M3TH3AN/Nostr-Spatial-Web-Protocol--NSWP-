class_name NswpVisitor
extends CharacterBody3D
## A visitor who moves the way every world's visitors move.
##
## Two ways, and the visitor chooses between them in the menu, as in any other world:
##
## - **Casual.** Click or tap the floor to walk there, a few metres at a time: twice to run.
##   A ring shows where a press would take them, and a dotted line the way there, for them
##   alone. Drag to look round. W, A, S, D and the arrows walk too.
## - **Intense.** The mouse looks round. W, A, S, D walk, F uses what is in the middle of
##   the view, and Escape brings up the menu. A visitor who arrives moving this way is
##   moving this way at once, with nothing to click first.
##
## Either way, Shift runs and Space jumps. Where there is no keyboard, two taps run and the
## menu's Jump control jumps.
##
## The speeds, the reach of a tap and how far a mouse turns the view are the kit's own
## (`Nswp.kit`), so it feels the same here as anywhere. Steps and bumps are heard through the
## kit's sounds. Pointing at an `NswpGate` from within ten feet lights it and says where it
## leads; moving the casual way a press then goes through it, and moving the intense way it
## is walked into. From further off a door does nothing, so nobody leaves by a stray click.
##
## It carries two cameras: an ordinary one, and an `XRCamera3D` for a headset, which it
## starts when the visitor asks for it in the menu.
##
## **In a headset** they move as in every other world, by their own settings. The casual way:
## a stick held forward shows a ring on the floor where the hand points, and letting go steps
## there, with a short fade; a stick pulled back steps back a metre; the other stick turns a
## notch at a time. The intense way: one stick walks, the other turns, smoothly, with the
## edge of the view darkened while they move if they chose that. What a stick means is not
## decided here: each frame the two hands are handed to the kit (`Nswp.hands`), and this does
## what comes back. Walls and floors stop them as they do at a desk: a step lands only where
## they could stand, and a walk slides along a wall. Pointing a hand at a door within reach
## lights it, and the trigger goes through.
##
## The button every world's console comes up on (B on the right hand, Y on the left) leaves
## the session, with the page's menu up and Home on it: the console is not drawn in a headset
## here yet, and until it is that button is the way to it.
##
## It is a default. Anything that is in the group `visitor` and tells `Nswp.moved()` how far
## it walked will do as well.

## Something was used: F, or a click, while moving the intense way. `what` is what the middle
## of the view pointed at, or null.
signal used(what: Object)
## A headset session couldn't start. `why` is what the browser said.
signal headset_failed(why: String)

## How high the visitor's eyes are, on a flat screen.
@export var eye_height: float = 1.6
## How far away something can be and still be pointed at, in metres.
@export var reach: float = 12.0
## Start a headset session when the visitor asks for one in the menu.
@export var headset: bool = true
## The colour of the marks on the floor: where a press would take them, and the way there.
## Only this visitor sees them.
@export var accent: Color = Color("4cc9f0")

var flat_camera: Camera3D
var headset_camera: XRCamera3D

## How far a pointer may move between press and release and still be a click, in pixels.
const CLICK_SLOP := 6.0

var _pitch: float = 0.0
var _pressed: bool = false
var _dragged: float = 0.0
var _pressed_at: int = 0
## Asked of each tap on the view, moving the casual way, before it is a step: given where it was
## and how long it was held, in milliseconds, it says whether it took the tap for itself.
## `NswpItems` sets it, so that a tap is the first press of what is in the visitor's hand.
var tap_filter: Callable = Callable()
## How much slower the view turns just now, from a little under a half to 1: `NswpItems` sets it
## while the visitor aims along a sight, by as much as they see narrower.
var look_scale: float = 1.0
## Where a tap is taking them, or null.
## The way they are walking, moving the casual way: each spot still ahead, in order. A press
## while they are walking adds to it from where it ends, so a path is pressed out as it is
## walked. Empty when they are standing.
var _path: Array[Vector2] = []
## The way they face as they walk a stretch, as a turn about the vertical. Kept as they
## arrive at a spot, so the view doesn't swing at the last step.
var _facing: float = 0.0
## Where a press would take them, under the pointer, or null.
var _hover: Variant = null
var _ring: MeshInstance3D
var _dot: MeshInstance3D
var _line: MultiMeshInstance3D
## A small ring at each turn of a pressed-out path.
var _knots: MultiMeshInstance3D
## Whether they are running there: two taps close together, and every tap after while they still are.
var _running: bool = false
var _tapped_at: int = -100000
var _was_on_floor: bool = true
var _aimed: Object = null
var _xr: XRInterface = null
var _presenting: bool = false
## The visitor's two hands in a headset.
var _hands: Array[XRController3D] = []

## The button under the thumb that the console comes up on in every world: B on the right
## hand, Y on the left (the kit's `Intent.menu`), by the name Godot gives it.
const MENU_BUTTON := "by_button"
## Which way is forward on a stick, as Godot gives it for a headset in a browser: 1.0 if
## pushing it away from you reads as positive, -1.0 if it reads as negative. The kit wants
## forward to be positive. If a visitor steps back when they push forward, it is this.
const STICK_FORWARD := 1.0
## Where the console and the hands come in the order of drawing: the console over the room, a
## row's light over the console, and the visitor's own hands over both (`_make_hands`).
const CONSOLE_PRIORITY := 20
const HANDS_PRIORITY := 30

## A small shape where each hand is, so the visitor sees them. Drawn here: nothing is downloaded.
var _hand_marks: Array[MeshInstance3D] = []
## A thin line from the hand that is choosing where to step.
var _hand_lines: Array[MeshInstance3D] = []
## The fade and the narrowing in a headset: one flat piece just in front of the eyes, drawn
## over everything. Black all over for a fade, a dark ring at the edge for narrowing.
var _shade: MeshInstance3D
var _shade_paint: ShaderMaterial
## How dark the view is for a jump just now, 0 to 1, and which way it is going: 1 darker,
## 2 lighter, 0 neither.
var _dark: float = 0.0
var _fading: int = 0
## What is to be done once the view is dark: a step, a step back.
var _jumps: Array[Callable] = []
## How much the edge of the view is darkened while they walk smoothly, 0 to 1.
var _narrow: float = 0.0
## How far a step that was just made went, in metres: said to the kit with the next frame, so
## that the next step is paced as in every world.
var _stepped: float = 0.0
## Where the hand that is choosing a step points on the floor, or null; and whether a step
## there may be taken now.
var _step_spot: Variant = null
var _step_ready: bool = true
## Each hand's trigger as it was last frame, so that a press is told from a hold.
var _trigger_was: Array[bool] = [false, false]
## For tests, on a flat page: hands made up by the test, in place of controllers.
var _pretend: Variant = null
## The console in a headset: the kit's own picture of the controls, on a panel that floats
## where it was opened. The kit draws it and says where each row is; this shows it, lights the
## row a hand points at as the kit says to, and tells the kit of a press.
var _console: MeshInstance3D
var _console_paint: StandardMaterial3D
var _console_picture: ImageTexture = null
var _console_lit: MeshInstance3D
var _console_lit_paint: ShaderMaterial
var _console_open := false
var _console_stamp := -1
## Where each pressable row is, as the kit last said: the one list a ray and a press go by.
var _console_rows: Array = []
var _console_units := Vector2(1024.0, 640.0)
var _console_place := {"wide": 0.84, "reach": 1.05, "drop": 0.18, "least": 0.4, "away": 2.6}
var _console_since := 0.0
var _console_aimed := ""
## What the kit last said the hands mean. For tests.
var _meant: Dictionary = {}

## The box over the row pointed at. Its place, its corners and its colours are the kit's: this
## only draws what it is told (`lit`, with each row the kit lists).
const LIT := """
shader_type spatial;
render_mode unshaded, cull_disabled, depth_test_disabled, shadows_disabled, blend_mix;
uniform vec2 size = vec2(100.0, 60.0);
uniform vec4 corners = vec4(0.0);
uniform vec4 fill : source_color = vec4(0.0);
uniform vec4 stroke : source_color = vec4(0.0);
uniform float line = 0.0;
float box(vec2 p, vec2 half, float r) {
	vec2 q = abs(p) - half + r;
	return length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - r;
}
void fragment() {
	vec2 p = (UV - 0.5) * size;
	float r = p.x < 0.0 ? (p.y < 0.0 ? corners.x : corners.w) : (p.y < 0.0 ? corners.y : corners.z);
	float d = box(p, size * 0.5, r);
	float inside = 1.0 - smoothstep(-0.75, 0.75, d);
	float edge = line > 0.0 ? smoothstep(-line - 0.75, -line + 0.75, d) : 0.0;
	ALBEDO = mix(fill.rgb, stroke.rgb, edge);
	ALPHA = mix(fill.a, stroke.a, edge) * inside;
}
"""

const SHADE := """
shader_type spatial;
render_mode unshaded, depth_test_disabled, cull_disabled, shadows_disabled, fog_disabled;
uniform float dark = 0.0;
uniform float narrow = 0.0;
void fragment() {
	float far = length(UV * 2.0 - 1.0);
	ALBEDO = vec3(0.0);
	ALPHA = max(dark, smoothstep(0.24, 0.42, far) * narrow);
}
"""


func _init() -> void:
	add_to_group("visitor")
	var shape := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.3
	capsule.height = 1.7
	shape.shape = capsule
	shape.position.y = 0.85
	add_child(shape)
	flat_camera = Camera3D.new()
	flat_camera.name = "Eyes"
	flat_camera.current = true
	add_child(flat_camera)
	var origin := XROrigin3D.new()
	origin.name = "Headset"
	headset_camera = XRCamera3D.new()
	origin.add_child(headset_camera)
	for tracker in ["left_hand", "right_hand"]:
		var hand := XRController3D.new()
		hand.name = "LeftHand" if tracker == "left_hand" else "RightHand"
		hand.tracker = tracker
		origin.add_child(hand)
		_hands.append(hand)
	# The fade and the narrowing: just in front of the eyes, wider than the view.
	_shade = MeshInstance3D.new()
	_shade.name = "Shade"
	var sheet := QuadMesh.new()
	sheet.size = Vector2(2.0, 2.0)
	_shade.mesh = sheet
	_shade_paint = ShaderMaterial.new()
	var shader := Shader.new()
	shader.code = SHADE
	_shade_paint.shader = shader
	_shade_paint.render_priority = 100
	_shade.material_override = _shade_paint
	_shade.position = Vector3(0.0, 0.0, -0.5)
	_shade.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_shade.visible = false
	headset_camera.add_child(_shade)
	add_child(origin)


func _ready() -> void:
	flat_camera.position.y = eye_height
	_make_marks()
	_make_hands()
	_make_console()
	# The kit may bring the console up itself: its one-time question on how to move, asked the
	# first time they are in a headset, is one of the console's sections.
	Nswp.console_asked.connect(_on_console_asked)
	_show_pointer()
	Nswp.moving_changed.connect(_on_moving_changed)
	Nswp.menu_toggled.connect(_on_menu_toggled)
	Nswp.jump_pressed.connect(jump)
	# Two people who arrive in the same spot step apart: the kit says how far this one moves.
	Nswp.nudged.connect(func(by: Vector3) -> void: global_position += by)
	# How wide the visitor asked to see at a desk, in every world. Left alone, it is this world's own.
	_own_fov = flat_camera.fov
	Nswp.console_changed.connect(_apply_fov)
	_apply_fov()
	if headset:
		_setup_headset()


var _own_fov := 75.0


func _apply_fov() -> void:
	var asked := float(Nswp.kit.get("fov", 0.0))
	flat_camera.fov = asked if asked > 0.0 else _own_fov


func _exit_tree() -> void:
	if Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


## Whether the visitor is moving the intense way, at a desk.
func intense() -> bool:
	return Nswp.moving == "intense" and Nswp.has_mouse and not _presenting


## Leave the floor: the same small jump as in every world. Does nothing in the air.
func jump() -> void:
	if not is_on_floor() or _presenting:
		return
	velocity.y = sqrt(2.0 * float(Nswp.kit.jumpGravity) * float(Nswp.kit.jumpHeight))
	Nswp.jumped()


## Whether the mouse is looking round now.
func looking() -> bool:
	return Input.mouse_mode == Input.MOUSE_MODE_CAPTURED


# ------------------------------------------------------------------------ looking and pointing

func _unhandled_input(event: InputEvent) -> void:
	if Nswp.menu_open or _presenting:
		return
	if event is InputEventKey and event.pressed and not event.echo and event.physical_keycode == KEY_SPACE:
		jump()
		return
	if intense():
		_intense_input(event)
	else:
		_casual_input(event)


## Moving the intense way, the mouse looks round whether or not the browser has given the page
## the pointer yet. A browser gives it only after a press, and a visitor who has just come
## through a door has pressed nothing here: they are not put back to the casual way for that.
## The pointer is hidden over the view, and taken at their first key or click.
func _intense_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
		# A click uses what is in the middle of the view, and takes the pointer if the page hasn't got it.
		if looking():
			_use()
		else:
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event is InputEventKey and event.pressed and not event.echo and not looking() and event.physical_keycode != KEY_ESCAPE:
		# Any key is a press as far as a browser is concerned: nothing need be clicked.
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
		if event.physical_keycode == KEY_F:
			_use()
	elif event is InputEventMouseMotion and (looking() or event.button_mask == 0):
		var speed := float(Nswp.kit.lookSpeed) * look_scale
		var limit := float(Nswp.kit.pitchLimit)
		rotate_y(-event.relative.x * speed)
		_pitch = clampf(_pitch - event.relative.y * speed, -limit, limit)
		flat_camera.rotation.x = _pitch
	elif event is InputEventKey and event.pressed and not event.echo and event.physical_keycode == KEY_F:
		_use()


func _casual_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			_pressed = true
			_dragged = 0.0
			_pressed_at = Time.get_ticks_msec()
		elif _pressed:
			_pressed = false
			if _dragged <= CLICK_SLOP:
				# Something in their hand may take a tap as its own (`NswpItems`): a press held is
				# still how they walk.
				if tap_filter.is_valid() and bool(tap_filter.call(event.position, Time.get_ticks_msec() - _pressed_at)):
					return
				_tap(event.position)
	elif event is InputEventMouseMotion:
		if _pressed:
			# Dragging looks round the way the kit's worlds do: sideways it turns them, up and down
			# it tilts the view, within the kit's limit (`tiltLimit`).
			_dragged += absf(event.relative.x) + absf(event.relative.y)
			var drag := float(Nswp.kit.get("dragLook", 0.005))
			var tilt := float(Nswp.kit.get("tiltLimit", 1.0471975511965976))
			rotate_y(event.relative.x * drag)
			_pitch = clampf(_pitch + event.relative.y * drag, -tilt, tilt)
			flat_camera.rotation.x = _pitch
		else:
			var hit := _ray(event.position)
			_point(null if hit.is_empty() else hit.collider)
			# A ring on the floor where a press would take them. A finger has nothing to hover
			# with: the mouse a touch stands in for doesn't count.
			_hover = null
			if event.device != InputEvent.DEVICE_ID_EMULATION and not hit.is_empty() and not (hit.collider is NswpPortal) and hit.normal.y >= 0.6:
				_hover = _within_a_press(hit.position, _press_from())


## Where a press leads from: their feet when they are standing, the end of the path when
## they are walking one.
func _press_from() -> Vector2:
	return Vector2(global_position.x, global_position.z) if _path.is_empty() else _path[-1]


## Where a press on `spot` would take them from `from`: there, or as far towards it as one
## press reaches.
func _within_a_press(spot: Vector3, from: Vector2) -> Vector2:
	var away := Vector2(spot.x - from.x, spot.z - from.y)
	var most := float(Nswp.kit.tapReach)
	if away.length() > most:
		away = away.normalized() * most
	return from + away


## The turn that faces from one spot towards another, for something that looks down -Z.
## Kept as it was when the two are all but the same spot.
func _aim(from: Vector2, to: Vector2) -> void:
	var away := to - from
	if away.length() > 0.3:
		_facing = atan2(-away.x, -away.y)


## Whether a door is near enough to choose from where they stand: within ten feet, as in
## every world. Further off it is not lit, and a press on it is a few steps towards it.
func _in_reach(door: Node3D) -> bool:
	var away := door.global_position - global_position
	return Vector2(away.x, away.z).length() <= float(Nswp.kit.doorReach)


## A tap or a click, moving the casual way. A door within reach is gone through. A door too
## far off, and the floor, are walked towards, no further than one press reaches.
func _tap(at: Vector2) -> void:
	var hit := _ray(at)
	if hit.is_empty():
		return
	var what: Object = hit.collider
	_point(what)
	var spot: Vector3 = hit.position
	if what is NswpPortal:
		if _in_reach(what as Node3D):
			(what as NswpPortal).enter()
			return
		spot = (what as Node3D).global_position
	elif hit.normal.y < 0.6:
		# A wall, not somewhere to stand.
		return
	var now := Time.get_ticks_msec()
	var again := now - _tapped_at <= int(Nswp.kit.doubleTap)
	_tapped_at = now
	_hover = null
	var here := Vector2(global_position.x, global_position.z)
	if again or _path.is_empty():
		# Standing, a walk begins. Pressed twice quickly, it is a run straight there and
		# nothing else: the way to change one's mind.
		var was_running := not _path.is_empty() and _running
		_path = [_within_a_press(spot, here)]
		_running = again or was_running
		_aim(here, _path[0])
		return
	# Walking already: the path goes on from where it ended, as far as one press reaches.
	var end: Vector2 = _path[-1]
	var next := _within_a_press(spot, end)
	if _path.size() < int(Nswp.kit.get("pathMost", 12)) and next.distance_to(end) > 0.3:
		_path.append(next)


## F, or a click, moving the intense way. A door is not gone through this way: moving the
## intense way, a doorway is walked into.
func _use() -> void:
	used.emit(_under(get_viewport().get_visible_rect().size / 2.0))


func _ray(at: Vector2) -> Dictionary:
	var camera := get_viewport().get_camera_3d()
	if camera == null:
		return {}
	var from := camera.project_ray_origin(at)
	var query := PhysicsRayQueryParameters3D.create(from, from + camera.project_ray_normal(at) * reach)
	query.collide_with_areas = true
	query.exclude = [get_rid()]
	return get_world_3d().direct_space_state.intersect_ray(query)


func _under(at: Vector2) -> Object:
	var hit := _ray(at)
	return null if hit.is_empty() else hit.collider


## Say what is pointed at. A door lights up, and the card beside the controls says where it
## leads: the same card, the same size, wherever the door is.
func _point(what: Object) -> void:
	# A door too far off to choose is not something pointed at.
	if what is NswpPortal and not _in_reach(what as Node3D):
		what = null
	if what == _aimed:
		return
	if is_instance_valid(_aimed) and _aimed is NswpGate:
		(_aimed as NswpGate).aimed = false
	_aimed = what
	if what is NswpPortal:
		var door := what as NswpPortal
		if door is NswpGate:
			(door as NswpGate).aimed = true
		var where := (door as NswpGate).address_line() if door is NswpGate else str(Nswp.read_address(door.url).domain)
		var how := "Walk in to go." if intense() else "Click, or walk in, to go."
		Nswp.play("hover")
		Nswp.target(door.label if door.label != "" else "A door", PackedStringArray([where, "%s Your Airlock shows the real address first, and asks." % how]))
	else:
		Nswp.target("")


# ------------------------------------------------------------------------ marks on the floor

## Marks for a visitor moving the casual way on a flat screen: a ring where a press would
## take them, a dot where they are going, and a dotted line from their feet to it. They are
## drawn here, for this visitor, and are nothing anyone else is told about.
func _make_marks() -> void:
	var paint := StandardMaterial3D.new()
	paint.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	paint.albedo_color = Color(accent, 0.85)
	paint.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	paint.no_depth_test = true
	paint.render_priority = 5
	var ring := TorusMesh.new()
	ring.inner_radius = 0.26
	ring.outer_radius = 0.34
	ring.rings = 48
	ring.ring_segments = 4
	_ring = _mark(ring, paint)
	_ring.scale = Vector3(1.0, 0.02, 1.0)
	var disc := CylinderMesh.new()
	disc.top_radius = 0.14
	disc.bottom_radius = 0.14
	disc.height = 0.004
	_dot = _mark(disc, paint)
	var small := CylinderMesh.new()
	small.top_radius = 0.07
	small.bottom_radius = 0.07
	small.height = 0.004
	small.radial_segments = 14
	small.material = paint
	var many := MultiMesh.new()
	many.transform_format = MultiMesh.TRANSFORM_3D
	many.mesh = small
	many.instance_count = 40
	many.visible_instance_count = 0
	_line = MultiMeshInstance3D.new()
	_line.multimesh = many
	_line.top_level = true
	_line.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_line)
	_line.global_transform = Transform3D.IDENTITY
	# Where a pressed-out path turns.
	var knot := TorusMesh.new()
	knot.inner_radius = 0.1
	knot.outer_radius = 0.15
	knot.rings = 24
	knot.ring_segments = 4
	knot.material = paint
	var turns := MultiMesh.new()
	turns.transform_format = MultiMesh.TRANSFORM_3D
	turns.mesh = knot
	turns.instance_count = 16
	turns.visible_instance_count = 0
	_knots = MultiMeshInstance3D.new()
	_knots.multimesh = turns
	_knots.top_level = true
	_knots.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_knots)
	_knots.global_transform = Transform3D.IDENTITY


## A small shape at each hand, and a thin line from it for choosing where to step.
##
## Drawn last, and so over the console: the console is drawn over the room whatever is nearer
## (`_make_console`, priority 20 and 21), and drawn the usual way a hand was painted first and
## the console over it. A priority only orders what is drawn in the see-through pass, so the
## paint is put in that pass; it is not see-through, and it keeps its place in depth, so a wall
## still hides a hand. The same as the kit does in a Three.js world (`drawnLast`, input.ts).
func _make_hands() -> void:
	var paint := StandardMaterial3D.new()
	paint.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	paint.albedo_color = accent
	paint.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	paint.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_ALWAYS
	paint.render_priority = HANDS_PRIORITY
	var ball := SphereMesh.new()
	ball.radius = 0.035
	ball.height = 0.07
	var line := BoxMesh.new()
	line.size = Vector3(0.004, 0.004, 3.0)
	for hand in _hands:
		var mark := MeshInstance3D.new()
		mark.mesh = ball
		mark.material_override = paint
		mark.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mark.visible = false
		hand.add_child(mark)
		_hand_marks.append(mark)
		var ray := MeshInstance3D.new()
		ray.mesh = line
		ray.material_override = paint
		ray.position = Vector3(0.0, 0.0, -1.5)
		ray.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		ray.visible = false
		hand.add_child(ray)
		_hand_lines.append(ray)


## The console's panel, and the box that lights a row on it. Neither moves with the visitor:
## the console stays where it was opened, so that it can be pointed at.
func _make_console() -> void:
	_console_paint = StandardMaterial3D.new()
	_console_paint.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_console_paint.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_console_paint.cull_mode = BaseMaterial3D.CULL_DISABLED
	_console_paint.no_depth_test = true
	_console_paint.render_priority = CONSOLE_PRIORITY
	_console = MeshInstance3D.new()
	_console.mesh = QuadMesh.new()
	_console.material_override = _console_paint
	_console.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_console.top_level = true
	_console.visible = false
	add_child(_console)
	var shader := Shader.new()
	shader.code = LIT
	_console_lit_paint = ShaderMaterial.new()
	_console_lit_paint.shader = shader
	_console_lit_paint.render_priority = CONSOLE_PRIORITY + 1
	_console_lit = MeshInstance3D.new()
	_console_lit.mesh = QuadMesh.new()
	_console_lit.material_override = _console_lit_paint
	_console_lit.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_console_lit.visible = false
	_console.add_child(_console_lit)


## Bring the console up in front of the visitor, or put it away.
func _console_set(open: bool) -> void:
	_console_take(Nswp.console({"open": open, "have": _console_stamp}), open and not _console_open)


## What the kit says the console now is: shown as that. `place` puts it in front of them, as
## it is opened.
func _console_take(now: Dictionary, place: bool = false) -> void:
	_console_open = bool(now.get("open", false))
	_console_since = 0.0
	if not _console_open:
		_console.visible = false
		_console_light("")
		return
	_console_units = Vector2(float(now.get("w", 1024.0)), float(now.get("h", 640.0)))
	for key: String in _console_place.keys():
		_console_place[key] = float(now.get(key, _console_place[key]))
	var wide := float(_console_place.wide)
	(_console.mesh as QuadMesh).size = Vector2(wide, wide * _console_units.y / _console_units.x)
	if place:
		var head := _head()
		var at := head + _ahead() * float(_console_place.reach)
		at.y = maxf(float(_console_place.least), head.y - float(_console_place.drop))
		var away := Vector3(at.x - head.x, 0.0, at.z - head.z)
		# Its face is turned to them: a flat panel's face is its +Z, and this points its -Z away.
		_console.global_transform = Transform3D(Basis.looking_at(away.normalized() if away.length() > 0.001 else -_ahead(), Vector3.UP), at)
	if now.has("rows") and typeof(now.rows) == TYPE_ARRAY:
		_console_rows = now.rows
	var stamp := int(now.get("stamp", -1))
	if stamp != _console_stamp or _console_picture == null:
		# The picture is being replaced: nothing is lit until a hand is seen to point at the new one.
		_console_light("")
		var pixels := Nswp.console_pixels()
		var w := int(_console_units.x)
		var h := int(_console_units.y)
		if pixels.size() == w * h * 4:
			var image := Image.create_from_data(w, h, false, Image.FORMAT_RGBA8, pixels)
			if _console_picture == null or _console_picture.get_width() != w or _console_picture.get_height() != h:
				_console_picture = ImageTexture.create_from_image(image)
				_console_paint.albedo_texture = _console_picture
			else:
				_console_picture.update(image)
			_console_stamp = stamp
	_console.visible = _console_picture != null


## Where on the console a hand points, in the console's own units, or null where it points
## past it. The same place decides what is lit and what a press lands on.
func _console_at(slot: int, pads: Array) -> Variant:
	if not _console_open or not _console.visible:
		return null
	var ray := _hand_ray(slot, pads)
	if ray.is_empty():
		return null
	var from: Vector3 = ray[0]
	var towards: Vector3 = ray[1]
	var face := _console.global_transform
	var along := towards.dot(face.basis.z)
	if absf(along) < 0.0001:
		return null
	var far := (face.origin - from).dot(face.basis.z) / along
	if far <= 0.0:
		return null
	var on := face.affine_inverse() * (from + towards * far)
	var size := (_console.mesh as QuadMesh).size
	if absf(on.x) > size.x * 0.5 or absf(on.y) > size.y * 0.5:
		return null
	return Vector2((on.x / size.x + 0.5) * _console_units.x, (0.5 - on.y / size.y) * _console_units.y)


## The row at a place on the console, or an empty one: a place in no row is the pane.
func _console_row(at: Vector2) -> Dictionary:
	for row: Variant in _console_rows:
		if typeof(row) == TYPE_DICTIONARY and at.x >= float(row.x) and at.x <= float(row.x) + float(row.w) and at.y >= float(row.y) and at.y <= float(row.y) + float(row.h):
			return row
	return {}


## Light this row, as the kit says to light it, or nothing (""): a row the kit gives no light
## for is not lit.
func _console_light(id: String) -> void:
	_console_aimed = ""
	_console_lit.visible = false
	if id == "":
		return
	for row: Variant in _console_rows:
		if typeof(row) != TYPE_DICTIONARY or str(row.get("id", "")) != id:
			continue
		_console_aimed = id
		var look: Variant = row.get("lit")
		if typeof(look) != TYPE_DICTIONARY:
			return
		var size := (_console.mesh as QuadMesh).size
		var per := size.x / _console_units.x
		(_console_lit.mesh as QuadMesh).size = Vector2(float(row.w), float(row.h)) * per
		_console_lit.position = Vector3((float(row.x) + float(row.w) * 0.5) * per - size.x * 0.5, size.y * 0.5 - (float(row.y) + float(row.h) * 0.5) * per, 0.002)
		var corners: Array = look.get("corners", [0, 0, 0, 0])
		var fill := Color(str(look.get("fill", "#ffffff")))
		fill.a = float(look.get("fillAlpha", 0.0))
		var stroke := Color(str(look.get("stroke", "#ffffff")))
		stroke.a = float(look.get("strokeAlpha", 0.0))
		_console_lit_paint.set_shader_parameter("size", Vector2(float(row.w), float(row.h)))
		_console_lit_paint.set_shader_parameter("corners", Vector4(float(corners[0]), float(corners[1]), float(corners[2]), float(corners[3])))
		_console_lit_paint.set_shader_parameter("fill", fill)
		_console_lit_paint.set_shader_parameter("stroke", stroke)
		_console_lit_paint.set_shader_parameter("line", float(look.get("line", 0.0)))
		_console_lit.visible = true
		return


## The console, each frame it is up: what the hands point at on it is lit and pressed, it is
## looked at again a few times a second, and it is put away once they have walked off.
## Returns the hands that are pointing at it: theirs is the console's, and nothing behind it.
func _console_frame(delta: float, pads: Array) -> Array:
	var on: Array = []
	if not _console_open:
		return on
	var lit := ""
	for pad: Variant in pads:
		if typeof(pad) != TYPE_DICTIONARY:
			continue
		var slot := int(pad.get("index", 0))
		var at: Variant = _console_at(slot, pads)
		if at == null:
			continue
		on.append(slot)
		var row := _console_row(at as Vector2)
		if row.is_empty():
			continue
		lit = str(row.id)
		if float(pad.get("trigger", 0.0)) > 0.5 and not _trigger_was[clampi(slot, 0, 1)]:
			_console_take(Nswp.console({"press": lit, "have": _console_stamp}))
			if not _console_open:
				return on
			lit = ""
	if lit != _console_aimed:
		_console_light(lit)
	_console_since += delta
	if _console_since > 0.3:
		_console_take(Nswp.console({"have": _console_stamp}))
	var head := _head()
	if _console_open and Vector2(head.x - _console.global_position.x, head.z - _console.global_position.z).length() > float(_console_place.away):
		_console_set(false)
	return on


func _mark(mesh: Mesh, paint: Material) -> MeshInstance3D:
	var mark := MeshInstance3D.new()
	mark.mesh = mesh
	mark.material_override = paint
	mark.top_level = true
	mark.visible = false
	mark.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mark)
	return mark


func _draw_marks() -> void:
	var casual := not intense() and not _presenting and not Nswp.menu_open
	var floor_y := global_position.y + 0.02
	if _step_spot != null:
		# In a headset: where the hand that is choosing a step points. Small until a step may be taken.
		var spot: Vector3 = _step_spot
		_ring.visible = true
		_ring.global_position = spot + Vector3(0.0, 0.02, 0.0)
		_ring.scale = Vector3.ONE * (1.0 if _step_ready else 0.55)
	else:
		_ring.scale = Vector3.ONE
		_ring.visible = casual and _hover != null and not _pressed
	if _ring.visible and _step_spot == null:
		var ring_at: Vector2 = _hover
		_ring.global_position = Vector3(ring_at.x, floor_y, ring_at.y)
	_dot.visible = casual and not _path.is_empty()
	var shown := 0
	var turns := 0
	if _dot.visible:
		var end: Vector2 = _path[-1]
		_dot.global_position = Vector3(end.x, floor_y, end.y)
		# The line through every spot on the way, with a small ring at each turn. Evenly spaced,
		# counted back from the end of each stretch, so the dots stay put as they walk along them.
		var from := Vector2(global_position.x, global_position.z)
		var flat := Basis.IDENTITY.scaled(Vector3(1.0, 0.02, 1.0))
		for leg in _path.size():
			var to: Vector2 = _path[leg]
			var far := from.distance_to(to)
			var d := far - (0.3 if leg == _path.size() - 1 else 0.32)
			var clear := 0.45 if leg == 0 else 0.32
			while far > 0.0 and d >= clear and shown < _line.multimesh.instance_count:
				var at := from.lerp(to, d / far)
				_line.multimesh.set_instance_transform(shown, Transform3D(Basis.IDENTITY, Vector3(at.x, floor_y, at.y)))
				shown += 1
				d -= 0.4
			if leg < _path.size() - 1 and turns < _knots.multimesh.instance_count:
				_knots.multimesh.set_instance_transform(turns, Transform3D(flat, Vector3(to.x, floor_y, to.y)))
				turns += 1
			from = to
	_line.multimesh.visible_instance_count = shown
	_knots.multimesh.visible_instance_count = turns


## What is marked on the floor now. For tests.
func marks() -> Dictionary:
	return {"ring": _ring.visible, "dot": _dot.visible, "dots": _line.multimesh.visible_instance_count, "turns": _knots.multimesh.visible_instance_count, "path": _path.size()}


# ------------------------------------------------------------------------ walking

func _physics_process(delta: float) -> void:
	var before := global_position
	var wish := Vector3.ZERO
	var keys := Vector2.ZERO
	if not Nswp.menu_open and not _presenting:
		keys = Vector2(
			float(Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT)) - float(Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT)),
			float(Input.is_physical_key_pressed(KEY_S) or Input.is_physical_key_pressed(KEY_DOWN)) - float(Input.is_physical_key_pressed(KEY_W) or Input.is_physical_key_pressed(KEY_UP)),
		)
	var speed := float(Nswp.kit.walkSpeed)
	# Whether they are stepping, walking or turning now: the kit moves nobody under them then.
	Nswp.frame_say("moving", keys != Vector2.ZERO or not _path.is_empty() or (_pressed and _dragged > 6.0))
	# Moving the casual way, walking (by the keys, or a tapped path) brings a tilted view back level.
	if not intense() and not _presenting and _pitch != 0.0 and (keys != Vector2.ZERO or not _path.is_empty()):
		var step := delta * float(Nswp.kit.get("levelRate", 1.6))
		_pitch = 0.0 if absf(_pitch) <= step else _pitch - signf(_pitch) * step
		flat_camera.rotation.x = _pitch
	if keys != Vector2.ZERO:
		# A key takes over from a tap, and from the whole of a pressed-out path.
		_path.clear()
		_running = false
		if keys.length() > 1.0:
			keys = keys.normalized()
		# Shift runs, however they are moving.
		if Input.is_physical_key_pressed(KEY_SHIFT):
			speed *= float(Nswp.kit.sprint)
		wish = (transform.basis * Vector3(keys.x, 0.0, keys.y)) * speed
	elif not _path.is_empty() and not Nswp.menu_open:
		var to: Vector2 = _path[0]
		var left := Vector2(to.x - before.x, to.y - before.z)
		if left.length() < 0.02:
			# At a spot on the path: on to the next, or done.
			_path.remove_at(0)
			if _path.is_empty():
				_running = false
		else:
			_aim(Vector2(before.x, before.z), to)
			# They face the way they walk, so a press ahead is a press where they are looking:
			# eased, never faster than the kit's rate, and not while they turn the view themselves.
			if not _pressed and not _presenting:
				var turn := wrapf(_facing - rotation.y, -PI, PI)
				var most := float(Nswp.kit.get("faceRate", 2.8)) * minf(delta, 0.1)
				rotation.y += clampf(turn * minf(1.0, delta * 7.0), -most, most)
			if _running:
				speed *= float(Nswp.kit.sprint)
			# No further in a frame than is left to go, so they stop on the spot and not past it.
			var pace := minf(speed, left.length() / maxf(delta, 0.001))
			wish = Vector3(left.x, 0.0, left.y).normalized() * pace
	# Moving the intense way, what is pointed at is whatever the middle of the view is on.
	if intense() and not Nswp.menu_open:
		_point(_under(get_viewport().get_visible_rect().size / 2.0))

	# In a headset the hands move them: the kit says what they mean, and a smooth walk comes back as a wish.
	if _presenting or _pretend != null:
		wish = _hands_frame(delta)

	velocity.x = wish.x
	velocity.z = wish.z
	# On the floor they stay on it, unless they have just jumped. In the air they are pulled back down.
	if not is_on_floor():
		velocity.y -= float(Nswp.kit.jumpGravity) * delta
	elif velocity.y < 0.0:
		velocity.y = 0.0
	move_and_slide()
	if is_on_floor() and not _was_on_floor:
		Nswp.play("land")
	_was_on_floor = is_on_floor()
	_draw_marks()

	var went := Vector2(global_position.x - before.x, global_position.z - before.z).length()
	if wish != Vector3.ZERO:
		# Steps are heard on the floor, not in the air.
		if is_on_floor():
			Nswp.moved(went)
		# Something was in the way: the walk ends there, the rest of the path with it, and it is heard.
		if is_on_wall() and went < wish.length() * delta * 0.3:
			_path.clear()
			_running = false
			Nswp.bump()


func _on_moving_changed(_moving: String) -> void:
	_path.clear()
	_pressed = false
	if not intense():
		_pitch = 0.0
		flat_camera.rotation.x = 0.0
	_show_pointer()
	_point(null)


func _on_menu_toggled(open: bool) -> void:
	if open:
		# The pointer is needed for the menu.
		_path.clear()
		_pressed = false
	_show_pointer()


## The pointer's own picture: there moving the casual way and while the menu is up, and not
## there moving the intense way, where the middle of the view is what points.
func _show_pointer() -> void:
	if intense() and not Nswp.menu_open:
		if not looking():
			Input.mouse_mode = Input.MOUSE_MODE_HIDDEN
	else:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


# ------------------------------------------------------------------------ a headset

# ------------------------------------------------------------------------ moving in a headset

## Each controller as it is now, in the shape the kit reads (`Nswp.hands`).
func _read_hands() -> Array:
	if _pretend != null:
		return _pretend as Array
	var pads: Array = []
	for i in _hands.size():
		var hand := _hands[i]
		if not hand.get_is_active():
			continue
		var stick := hand.get_vector2("thumbstick")
		pads.append({
			"index": i,
			"hand": "left" if hand.tracker == &"left_hand" else "right",
			"stick": [stick.x, stick.y * STICK_FORWARD],
			"trigger": 1.0 if hand.is_button_pressed("trigger_click") else 0.0,
			"squeeze": 1.0 if hand.is_button_pressed("grip_click") else 0.0,
			"primary": hand.is_button_pressed("ax_button"),
			"secondary": hand.is_button_pressed(MENU_BUTTON),
			"press": hand.is_button_pressed("thumbstick_click"),
		})
	return pads


## Where the visitor's head is, and the way it faces along the floor.
func _head() -> Vector3:
	return headset_camera.global_position if _presenting else flat_camera.global_position


func _ahead() -> Vector3:
	var eyes: Node3D = headset_camera if _presenting else flat_camera
	var ahead := -eyes.global_transform.basis.z
	ahead.y = 0.0
	return ahead.normalized() if ahead.length() > 0.001 else -global_transform.basis.z


## Where a hand is, and the way it points. A test's made-up hand says both.
func _hand_ray(slot: int, pads: Array) -> Array:
	for pad: Variant in pads:
		if typeof(pad) == TYPE_DICTIONARY and int(pad.get("index", -1)) == slot and pad.has("from") and pad.has("towards"):
			var from: Array = pad.from
			var towards: Array = pad.towards
			return [Vector3(from[0], from[1], from[2]), Vector3(towards[0], towards[1], towards[2]).normalized()]
	if slot < 0 or slot >= _hands.size():
		return []
	var hand := _hands[slot]
	return [hand.global_position, -hand.global_transform.basis.z]


## What a hand points at: a physics hit, or nothing.
func _hand_hit(slot: int, pads: Array) -> Dictionary:
	var ray := _hand_ray(slot, pads)
	if ray.is_empty():
		return {}
	var from: Vector3 = ray[0]
	var towards: Vector3 = ray[1]
	var query := PhysicsRayQueryParameters3D.create(from, from + towards * 30.0)
	query.collide_with_areas = true
	query.exclude = [get_rid()]
	return get_world_3d().direct_space_state.intersect_ray(query)


## Where a step from this hand would land, or null: on something they could stand on, no
## further than one step reaches, with room for a body there and nothing between.
func _step_from(slot: int, pads: Array) -> Variant:
	var hit := _hand_hit(slot, pads)
	if hit.is_empty() or hit.collider is NswpPortal or hit.normal.y < 0.6:
		return null
	var head := _head()
	var spot: Vector3 = hit.position
	var away := Vector2(spot.x - head.x, spot.z - head.z)
	if away.length() < 0.3:
		return null
	var most := float(Nswp.kit.get("stepReach", 5.0))
	var space := get_world_3d().direct_space_state
	if away.length() > most:
		# Further than a step reaches: as far that way as one goes, on whatever floor is there.
		away = away.normalized() * most
		var above := Vector3(head.x + away.x, head.y + 0.5, head.z + away.y)
		var down := PhysicsRayQueryParameters3D.create(above, above + Vector3.DOWN * 6.0)
		down.exclude = [get_rid()]
		var under := space.intersect_ray(down)
		if under.is_empty() or under.normal.y < 0.6:
			return null
		spot = under.position
	# Nothing between their head and where it would be.
	var sight := PhysicsRayQueryParameters3D.create(head, Vector3(spot.x, head.y, spot.z))
	sight.exclude = [get_rid()]
	if not space.intersect_ray(sight).is_empty():
		return null
	# Room for a body there: the body goes where the head's place on the floor is.
	var body := global_position + Vector3(spot.x - head.x, spot.y - global_position.y, spot.z - head.z)
	if test_move(Transform3D(global_transform.basis, body + Vector3(0.0, 0.05, 0.0)), Vector3.ZERO):
		return null
	return spot


## Turn on the spot, about the head: the head stays where it is.
func _turn_about_head(degrees: float) -> void:
	var angle := deg_to_rad(degrees)
	var head := _head()
	var pivot := Vector3(head.x, global_position.y, head.z)
	global_position = pivot + (global_position - pivot).rotated(Vector3.UP, angle)
	rotate_y(angle)


## A jump the kit makes: a step, a step back. Faded for someone who fades: made once the view
## is dark, and the view then comes back. Otherwise made now.
func _jump_to(made: Callable, fade: bool) -> void:
	if not fade or not _presenting:
		made.call()
		return
	_jumps.append(made)
	# Coming back in from one already: it goes dark again from where it is.
	_fading = 1


func _tend_shade(delta: float) -> void:
	var each := maxf(float(Nswp.kit.get("fadeSeconds", 0.12)), 0.01)
	if _fading == 1:
		_dark = minf(1.0, _dark + delta / each)
		if _dark >= 1.0:
			for made in _jumps:
				made.call()
			_jumps.clear()
			_fading = 2
	elif _fading == 2:
		_dark = maxf(0.0, _dark - delta / each)
		if _dark <= 0.0:
			_fading = 0
	_shade_paint.set_shader_parameter("dark", _dark)
	_shade_paint.set_shader_parameter("narrow", _narrow * 0.85)
	_shade.visible = _presenting and (_dark > 0.0 or _narrow > 0.01)


## One frame of a headset session: read the hands, ask the kit what they mean, and do it.
## Comes back with how they wish to walk this frame, smoothly, as a speed along the floor.
func _hands_frame(delta: float) -> Vector3:
	var pads := _read_hands()
	var meant := Nswp.hands(pads, delta, _stepped)
	_stepped = 0.0
	_meant = meant
	_step_spot = null
	if meant.is_empty():
		_tend_shade(delta)
		return Vector3.ZERO
	# The menu button brings the console up, and puts it away: the button every world's comes up on.
	if bool(meant.get("menu", false)):
		_console_set(not _console_open)
	var on_console := _console_frame(delta, pads)
	var fade := bool(meant.get("fade", true))
	_step_ready = bool(meant.get("mayStep", true))
	var turn := float(meant.get("turn", 0.0))
	if turn != 0.0:
		_turn_about_head(turn)
	var wish := Vector3.ZERO
	var walk: Array = meant.get("walk", [0.0, 0.0])
	var across := float(walk[0])
	var along := float(walk[1])
	if across != 0.0 or along != 0.0:
		var ahead := _ahead()
		var by := ahead * along + ahead.cross(Vector3.UP) * across
		if bool(meant.get("stepping", true)):
			# One step, landing at once: a jump. It stops at whatever is in the way.
			var back := func() -> void:
				move_and_collide(by)
			_jump_to(back, fade)
		else:
			wish = by / maxf(delta, 0.001)
	# A hand choosing where to step: a ring where it points.
	var aiming: Array = meant.get("aiming", [])
	if not aiming.is_empty():
		_step_spot = _step_from(int(aiming[0]), pads)
	# A hand that let go: the step, where one may be taken.
	for slot: Variant in meant.get("stepFrom", []):
		var spot: Variant = _step_from(int(slot), pads)
		if spot == null or not _step_ready:
			continue
		var to: Vector3 = spot
		var head := _head()
		_stepped = Vector2(to.x - head.x, to.z - head.z).length()
		_step_ready = false
		var body := global_position + Vector3(to.x - head.x, to.y - global_position.y, to.z - head.z)
		var went := _stepped
		var land := func() -> void:
			global_position = body
			velocity = Vector3.ZERO
			# Heard as the kit hears any move of that length: a long way at once lands.
			Nswp.moved(went)
		_jump_to(land, fade)
	# Close in fast and open slowly: it is the closing that helps.
	var narrow := float(meant.get("narrow", 0.0))
	_narrow += (narrow - _narrow) * minf(1.0, delta * (12.0 if narrow > _narrow else 3.0))
	_tend_shade(delta)
	# Doors: a hand pointed at one within reach lights it, and its trigger goes through. Walking
	# the intense way, a doorway is walked into, as at a desk.
	var pointed: Object = null
	for pad: Variant in pads:
		if typeof(pad) != TYPE_DICTIONARY:
			continue
		var slot := int(pad.get("index", 0))
		# A hand pointing at the console points at nothing behind it.
		var hit := {} if on_console.has(slot) else _hand_hit(slot, pads)
		var what: Object = null if hit.is_empty() else hit.collider
		if what is NswpPortal and _in_reach(what as Node3D):
			pointed = what
			var pressed := float(pad.get("trigger", 0.0)) > 0.5
			if pressed and not _trigger_was[clampi(slot, 0, 1)] and not bool(meant.get("intense", false)):
				(what as NswpPortal).enter()
		_trigger_was[clampi(slot, 0, 1)] = float(pad.get("trigger", 0.0)) > 0.5
	_point(pointed)
	# The hands, where they are; and a line from the one choosing a step.
	for i in _hand_marks.size():
		_hand_marks[i].visible = _presenting and _hands[i].get_is_active()
		_hand_lines[i].visible = _hand_marks[i].visible and aiming.has(float(i))
	return wish


## For tests, on a flat page: move as if in a headset, with hands the test makes up, in place
## of controllers. Each is as `Nswp.hands` takes it, and may say where it is and the way it
## points (`from`, `towards`, three numbers each). An empty list ends it.
func pretend_hands(pads: Array) -> void:
	_pretend = null if pads.is_empty() else pads


## What the kit last said the hands mean, and what was done about it. For tests.
func hands_report() -> Dictionary:
	var face := _console.global_transform
	var size := (_console.mesh as QuadMesh).size
	var lit_at: Array = []
	if _console_lit.visible:
		var box := _console_lit.global_position
		var lit_size := (_console_lit.mesh as QuadMesh).size
		lit_at = [snappedf(box.x, 0.001), snappedf(box.y, 0.001), snappedf(box.z, 0.001), snappedf(lit_size.x, 0.001), snappedf(lit_size.y, 0.001)]
	var console := {
		"open": _console_open,
		"shown": _console.visible,
		"stamp": _console_stamp,
		"rows": _console_rows.size(),
		"aimed": _console_aimed,
		"lit": lit_at,
		"at": [snappedf(face.origin.x, 0.001), snappedf(face.origin.y, 0.001), snappedf(face.origin.z, 0.001)],
		"right": [snappedf(face.basis.x.x, 0.001), snappedf(face.basis.x.y, 0.001), snappedf(face.basis.x.z, 0.001)],
		"up": [snappedf(face.basis.y.x, 0.001), snappedf(face.basis.y.y, 0.001), snappedf(face.basis.y.z, 0.001)],
		"size": [snappedf(size.x, 0.001), snappedf(size.y, 0.001)],
	}
	return {"meant": _meant, "spot": null if _step_spot == null else [snappedf((_step_spot as Vector3).x, 0.01), snappedf((_step_spot as Vector3).z, 0.01)], "ready": _step_ready, "dark": snappedf(_dark, 0.01), "narrow": snappedf(_narrow, 0.01), "shade": _shade.visible, "pretending": _pretend != null, "console": console}


func _setup_headset() -> void:
	_xr = XRServer.find_interface("WebXR")
	if _xr == null:
		return
	_xr.session_supported.connect(_on_session_supported)
	_xr.session_started.connect(_on_session_started)
	_xr.session_ended.connect(_on_session_ended)
	_xr.session_failed.connect(_on_session_failed)
	Nswp.vr_pressed.connect(_on_vr_pressed)
	_xr.is_session_supported("immersive-vr")


## The kit brought the console up, or put it away, itself: shown as it now is, in front of them.
func _on_console_asked(open: bool) -> void:
	_console_take(Nswp.console({"have": _console_stamp}), open and not _console_open)


func _on_session_supported(mode: String, supported: bool) -> void:
	if mode == "immersive-vr":
		# Someone who left a headset to come here is offered the way back in by the page, once it
		# hears that a session can start: a press anywhere takes them in (`vr_pressed`).
		Nswp.headset(supported, _presenting)


## A browser starts a headset session only on a press. The menu's control is one.
func _on_vr_pressed(enter: bool) -> void:
	if _xr == null:
		return
	if not enter:
		if _xr.is_initialized():
			_xr.uninitialize()
		return
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	_xr.session_mode = "immersive-vr"
	_xr.requested_reference_space_types = "local-floor, local"
	_xr.required_features = "local-floor"
	_xr.optional_features = "hand-tracking"
	if not _xr.initialize():
		_on_session_failed("the browser refused")


func _on_session_started() -> void:
	_presenting = true
	headset_camera.current = true
	get_viewport().use_xr = true
	Nswp.headset(true, true)


func _on_session_ended() -> void:
	_presenting = false
	# Out of the headset: a jump waiting for the dark is made now, and nothing stays dark.
	for made in _jumps:
		made.call()
	_jumps.clear()
	_fading = 0
	_dark = 0.0
	_narrow = 0.0
	_step_spot = null
	_shade.visible = false
	for mark in _hand_marks:
		mark.visible = false
	for line in _hand_lines:
		line.visible = false
	get_viewport().use_xr = false
	flat_camera.current = true
	Nswp.headset(true, false)
	# The kit has put the console away with the session: so has this.
	_console_take({"open": false})


func _on_session_failed(why: String) -> void:
	_presenting = false
	Nswp.say("Couldn't start VR on this device.")
	Nswp.headset(true, false, true)
	headset_failed.emit(why)
