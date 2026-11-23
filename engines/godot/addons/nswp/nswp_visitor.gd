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
## starts when the visitor asks for it in the menu. In a session the button every world's
## console comes up on (B on the right hand, Y on the left) leaves it, with the page's menu
## up and Home on it: moving about in a headset, and the console there, are not in this
## add-on yet, and until they are that button is the way out.
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
	add_child(origin)


func _ready() -> void:
	flat_camera.position.y = eye_height
	_make_marks()
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
	_ring.visible = casual and _hover != null and not _pressed
	if _ring.visible:
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

func _setup_headset() -> void:
	_xr = XRServer.find_interface("WebXR")
	if _xr == null:
		return
	_xr.session_supported.connect(_on_session_supported)
	_xr.session_started.connect(_on_session_started)
	_xr.session_ended.connect(_on_session_ended)
	_xr.session_failed.connect(_on_session_failed)
	Nswp.vr_pressed.connect(_on_vr_pressed)
	for hand in _hands:
		hand.button_pressed.connect(_on_hand_button)
	_xr.is_session_supported("immersive-vr")


## A button on either hand went down. The menu button leaves the session and brings the
## page's menu up, with Home on it. In a session nothing of the page can be seen, and this
## add-on draws no console there yet (docs/plans/godot-headset-controls.md): before this, the
## only way out of a headset here was to take it off.
func _on_hand_button(button: String) -> void:
	if button != MENU_BUTTON or not _presenting:
		return
	_on_vr_pressed(false)
	Nswp.open_console(true)
	Nswp.say("You left VR. Home is in this menu.")


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
	get_viewport().use_xr = false
	flat_camera.current = true
	Nswp.headset(true, false)


func _on_session_failed(why: String) -> void:
	_presenting = false
	Nswp.say("Couldn't start VR on this device.")
	Nswp.headset(true, false, true)
	headset_failed.emit(why)
