class_name NswpVisitor
extends CharacterBody3D
## A visitor who moves the way every world's visitors move.
##
## Two ways, and the visitor chooses between them in the menu, as in any other world:
##
## - **Casual.** Click or tap the floor to walk there, a few steps at a time. Drag to look
##   round. W, A, S, D and the arrows walk too.
## - **Intense.** Click the view and the mouse looks round. W, A, S, D walk, Shift runs, F
##   uses what is in the middle of the view, and Escape brings up the menu.
##
## The speeds, the reach of a tap and how far a mouse turns the view are the kit's own
## (`Nswp.kit`), so it feels the same here as anywhere. Steps and bumps are heard through the
## kit's sounds. Pointing at an `NswpGate` lights it and says where it leads.
##
## It carries two cameras: an ordinary one, and an `XRCamera3D` for a headset, which it
## starts when the visitor asks for it in the menu.
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

var flat_camera: Camera3D
var headset_camera: XRCamera3D

## How far a pointer may move between press and release and still be a click, in pixels.
const CLICK_SLOP := 6.0
const GRAVITY := 9.8

var _pitch: float = 0.0
var _pressed: bool = false
var _dragged: float = 0.0
## Where a tap is taking them, or null.
var _heading: Variant = null
var _aimed: Object = null
var _xr: XRInterface = null
var _presenting: bool = false


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
	add_child(origin)


func _ready() -> void:
	flat_camera.position.y = eye_height
	Nswp.moving_changed.connect(_on_moving_changed)
	Nswp.menu_toggled.connect(_on_menu_toggled)
	if headset:
		_setup_headset()


func _exit_tree() -> void:
	if Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


## Whether the visitor is moving the intense way, at a desk.
func intense() -> bool:
	return Nswp.moving == "intense" and Nswp.has_mouse and not _presenting


## Whether the mouse is looking round now.
func looking() -> bool:
	return Input.mouse_mode == Input.MOUSE_MODE_CAPTURED


# ------------------------------------------------------------------------ looking and pointing

func _unhandled_input(event: InputEvent) -> void:
	if Nswp.menu_open or _presenting:
		return
	if intense():
		_intense_input(event)
	else:
		_casual_input(event)


func _intense_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
		# The first click takes the pointer; from then on a click uses what is in the middle of the view.
		if looking():
			_use()
		else:
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event is InputEventMouseMotion and looking():
		var speed := float(Nswp.kit.lookSpeed)
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
		elif _pressed:
			_pressed = false
			if _dragged <= CLICK_SLOP:
				_tap(event.position)
	elif event is InputEventMouseMotion:
		if _pressed:
			# Dragging turns the visitor the way the kit's worlds do.
			_dragged += absf(event.relative.x) + absf(event.relative.y)
			rotate_y(event.relative.x * float(Nswp.kit.get("dragLook", 0.005)))
		else:
			_point(_under(event.position))


## A tap or a click, moving the casual way: a door is gone to, and the floor is walked on, no
## further than a few steps at a time.
func _tap(at: Vector2) -> void:
	var hit := _ray(at)
	if hit.is_empty():
		return
	var what: Object = hit.collider
	_point(what)
	var spot: Vector3 = hit.position
	if what is NswpPortal:
		spot = (what as Node3D).global_position
	elif hit.normal.y < 0.6:
		# A wall, not somewhere to stand.
		return
	var from := global_position
	var away := Vector2(spot.x - from.x, spot.z - from.z)
	var most := float(Nswp.kit.tapReach)
	if away.length() > most:
		away = away.normalized() * most
	_heading = Vector2(from.x + away.x, from.z + away.y)


func _use() -> void:
	var what := _under(get_viewport().get_visible_rect().size / 2.0)
	used.emit(what)
	if what is NswpPortal:
		(what as NswpPortal).enter()


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
		var how := "Press F, or walk in, to go." if intense() else "Walk in to go."
		Nswp.play("hover")
		Nswp.target(door.label if door.label != "" else "A door", PackedStringArray([where, "%s Your Airlock shows the real address first, and asks." % how]))
	else:
		Nswp.target("")


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
	if keys != Vector2.ZERO:
		# A key takes over from a tap.
		_heading = null
		if keys.length() > 1.0:
			keys = keys.normalized()
		if intense() and Input.is_physical_key_pressed(KEY_SHIFT):
			speed *= float(Nswp.kit.sprint)
		wish = (transform.basis * Vector3(keys.x, 0.0, keys.y)) * speed
	elif _heading != null and not Nswp.menu_open:
		var to: Vector2 = _heading
		var left := Vector2(to.x - before.x, to.y - before.z)
		if left.length() < 0.02:
			_heading = null
		else:
			# No further in a frame than is left to go, so they stop on the spot and not past it.
			var pace := minf(speed, left.length() / maxf(delta, 0.001))
			wish = Vector3(left.x, 0.0, left.y).normalized() * pace
	# While the mouse is looking round, what is pointed at is whatever the middle of the view is on.
	if intense() and looking():
		_point(_under(get_viewport().get_visible_rect().size / 2.0))

	velocity.x = wish.x
	velocity.z = wish.z
	velocity.y = 0.0 if is_on_floor() else velocity.y - GRAVITY * delta
	move_and_slide()

	var went := Vector2(global_position.x - before.x, global_position.z - before.z).length()
	if wish != Vector3.ZERO:
		Nswp.moved(went)
		# Something was in the way: a tap ends there, and it is heard.
		if is_on_wall() and went < wish.length() * delta * 0.3:
			_heading = null
			Nswp.bump()


func _on_moving_changed(_moving: String) -> void:
	_heading = null
	_pressed = false
	if not intense():
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		_pitch = 0.0
		flat_camera.rotation.x = 0.0
	_point(null)


func _on_menu_toggled(open: bool) -> void:
	if open:
		# The pointer is needed for the menu.
		_heading = null
		_pressed = false
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
	_xr.is_session_supported("immersive-vr")


func _on_session_supported(mode: String, supported: bool) -> void:
	if mode == "immersive-vr":
		Nswp.headset(supported, _presenting)
		# They left a headset to come here: say where the way back in is.
		if supported and bool(Nswp.arrival.get("immersive", false)):
			Nswp.say("You left a headset to come here. Enter VR, in the row of controls, takes you back in.")


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
	headset_failed.emit(why)
