extends CharacterBody3D
## A visitor in the example world. W, A, S, D or the arrows walk; dragging the mouse, or a
## finger, looks round. It is in the group `visitor`, which the example's doors answer to.
##
## There are two cameras: an ordinary one for a flat screen, and an XRCamera3D under an
## XROrigin3D for a headset. Whichever suits is made current by the scene.

const SPEED := 2.4
const LOOK := 0.005

var flat_camera: Camera3D
var headset_camera: XRCamera3D
## Set by an on-screen button, for a visitor with no keyboard.
var walking_forward: bool = false

var _dragging: bool = false


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
	flat_camera.position.y = 1.6
	flat_camera.current = true
	add_child(flat_camera)
	var origin := XROrigin3D.new()
	headset_camera = XRCamera3D.new()
	origin.add_child(headset_camera)
	add_child(origin)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		_dragging = event.pressed
	elif event is InputEventMouseMotion and _dragging:
		rotate_y(-event.relative.x * LOOK)
	elif event is InputEventScreenDrag:
		rotate_y(-event.relative.x * LOOK)


func _physics_process(_delta: float) -> void:
	var right := float(Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT))
	var left := float(Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT))
	var back := float(Input.is_physical_key_pressed(KEY_S) or Input.is_physical_key_pressed(KEY_DOWN))
	var forward := float(Input.is_physical_key_pressed(KEY_W) or Input.is_physical_key_pressed(KEY_UP) or walking_forward)
	var direction := transform.basis * Vector3(right - left, 0.0, back - forward)
	if direction.length() > 1.0:
		direction = direction.normalized()
	velocity = Vector3(direction.x * SPEED, 0.0, direction.z * SPEED)
	move_and_slide()
