class_name NswpItems
extends Node3D
## Things visitors carry, in a world made with Godot (NSWP-17).
##
## A visitor has a bag, and may take one thing from it in hand. Some things do something: a toy
## blaster sends out darts. This node is everything Godot has to do for that, and it is little,
## because everything about an item that isn't drawing is the kit's own script on the page, the
## same code a Three.js world runs: the Bag tab in the menu, fetching and checking what an item
## names, its own logic shut in its locked box, how what it sends out flies, and how the visitor
## is. So an item behaves the same here as in any other world.
##
## What is done here is what only the engine can do:
## - it draws the thing in their hand, the things in the air and their streaks of light;
## - it knows this world's shapes: each frame it is told where each thing went, and says what
##   that ran into. A thing sticks to anything with a collision shape. Nothing of your world
##   has to be an item.
##
##     var items := NswpItems.new()
##     items.visitor = $Visitor            # an NswpVisitor, or any node that stands on the floor
##     items.rule = "allowed"              # what your world's announcement says of items
##     add_child(items)
##
## A world has items unless it turns them off. One that leaves this node out fetches, draws and
## runs nothing carried, and says so in its announcement: `"items": "none"` in its world.json.
##
## The ring to aim by, the mark of a hit, how the visitor is and their item's counter are drawn
## by the page over the canvas, as the menu is. In a headset they aren't drawn yet.

## Who is carrying: the node that stands where the visitor stands. Its height is the floor under
## them. An `NswpVisitor` is also told when a press on the view was the item's, and to turn the
## view more slowly while they aim.
@export var visitor: Node3D
## What this world does with items: "allowed", or "play" where they are the game. It must be
## what the world's announcement says (`"items"` in its world.json; nothing said is "allowed").
@export var rule: String = "allowed"
## Whether an item's own logic runs here, in its locked box. The page must serve the kit's
## `item-box.html` beside it, under that page's own content rules: see the README.
@export var scripts: bool = true

## How wide a streak of light is at the thing, in metres. The kit's, not an item's to say.
const TRAIL_WIDTH := 0.026
## A press shorter than this is a tap; one held longer is the visitor walking.
const TAP_MS := 320

var _started: bool = false
## What is in their hand: the id of the item, the node drawn for it, and what the kit said of it.
var _held_id: String = ""
var _held_model: String = ""
var _held: Node3D = null
var _held_info: Dictionary = {}
var _held_player: AnimationPlayer = null
## Models that have been read, by the hash their file is named by: a node to copy for each use.
var _models: Dictionary = {}
## Things in the air or stuck, and their streaks of light, by key.
var _things: Dictionary = {}
var _trails: Dictionary = {}
## What the kit asked to have tested last frame, answered in this one.
var _met: Array = []
var _floors: Array = []
## How far the thing in hand has come up to the eye, from 0 to 1, and how wide they saw before.
var _sight_k: float = 0.0
var _sight_want: bool = false
var _fov_base: float = -1.0
var _trail_paint: StandardMaterial3D
## For tests: what the kit said last.
var last: Dictionary = {}


func _ready() -> void:
	# Nothing anyone carries is in the world's 360° picture: it is about whoever was here when it was taken.
	add_to_group(Nswp.NOT_IN_PREVIEW_GROUP)
	_trail_paint = StandardMaterial3D.new()
	_trail_paint.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_trail_paint.vertex_color_use_as_albedo = true
	_trail_paint.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	_trail_paint.cull_mode = BaseMaterial3D.CULL_DISABLED
	_trail_paint.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_trail_paint.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	if visitor is NswpVisitor:
		(visitor as NswpVisitor).tap_filter = _on_tap


func _process(delta: float) -> void:
	if not Nswp.is_live():
		return
	if not _started:
		# The menu comes first: the Bag tab is one of its tabs.
		var began := Nswp.items(rule, {} if scripts else {"box": false})
		_started = bool(began.get("ok", false))
		if not _started:
			return
	var camera := get_viewport().get_camera_3d()
	if camera == null:
		return
	var size := get_viewport().get_visible_rect().size
	# What this node knows that the camera doesn't: how wide they see when they aren't aiming, and
	# what each thing ran into since the kit last asked.
	if _fov_base >= 0.0:
		Nswp.frame_say("fov", _fov_base)
	Nswp.frame_say("sighting", _sight_k > 0.5)
	if not _met.is_empty():
		Nswp.frame_say("met", _met)
	if not _floors.is_empty():
		Nswp.frame_say("floors", _floors)
	var now := Nswp.frame(Nswp.view_of(camera, visitor, delta))
	last = now
	_met = []
	_floors = []
	if now.is_empty():
		return
	_draw_held(now.get("held"), camera, delta, bool(now.get("sight", false)), size.x / maxf(1.0, size.y))
	_draw_things(now.get("things", []))
	_draw_trails(now.get("trails", []), camera)
	for clip: Variant in now.get("clips", []):
		if typeof(clip) == TYPE_DICTIONARY and str(clip.get("who", "")) == "" and _held_player != null and _held_player.has_animation(str(clip.get("name", ""))):
			_held_player.stop()
			_held_player.play(str(clip.get("name", "")))


# ------------------------------------------------------------------------ a press on the view

## A tap or a click on the view, moving the casual way: the item's first press, sent where they
## pressed, if something in their hand does something. A press held is still how they walk.
func _on_tap(at: Vector2, held_ms: int) -> bool:
	var camera := get_viewport().get_camera_3d()
	if camera == null or not _started or held_ms >= TAP_MS:
		return false
	var from := camera.project_ray_origin(at)
	var dir := camera.project_ray_normal(at)
	return Nswp.item_tap(from, dir, held_ms)


# ------------------------------------------------------------------------ the thing in their hand

func _draw_held(held: Variant, camera: Camera3D, delta: float, want_sight: bool, aspect: float) -> void:
	if typeof(held) != TYPE_DICTIONARY:
		if _held != null:
			_held.queue_free()
			_held = null
			_held_player = null
		_held_id = ""
		_held_model = ""
		_end_sight(camera)
		return
	var id := str(held.get("id", ""))
	var sha := str(held.get("model", ""))
	_held_info = held
	if id != _held_id or sha != _held_model or _held == null:
		var made := _instance(sha, _size_of(held.get("size")))
		if made == null:
			return  # its bytes are on their way
		if _held != null:
			_held.queue_free()
		_held = made
		_held_id = id
		_held_model = sha
		_held_player = _player_in(made)
		made.add_to_group(Nswp.NOT_IN_PREVIEW_GROUP)
		camera.add_child(made)
	_tint(_held, held.get("tints", {}))
	# Where a hand would hold it: about a third of the height of the view, to the right and clear
	# of the bar; smaller and above the bar on a screen taller than it is wide. The same places
	# as in a Three.js world.
	var box := _size_of(held.get("size"))
	var acts := bool(held.get("acts", false))
	if _fov_base < 0.0 and _sight_k <= 0.002:
		pass
	var base_fov := camera.fov if _fov_base < 0.0 else _fov_base
	var tall1 := tan(deg_to_rad(base_fov / 2.0))
	var narrow := aspect < 1.0
	var far := clampf(box.y / (2.0 * tall1 * (0.24 if narrow else (0.4 if acts else 0.3))), 0.4, 0.95)
	var tall := tall1 * far
	var wide := tall * aspect
	var hip := Vector3(wide * 0.5 if narrow else minf(wide * 0.6, wide - box.x * 0.6), -tall * 0.56 if narrow else -tall * 0.99, -far)
	var aim: Variant = held.get("aim")
	var has_sight := typeof(aim) == TYPE_DICTIONARY and typeof(aim.get("at")) == TYPE_ARRAY and (aim.at as Array).size() == 3
	_sight_want = want_sight and has_sight
	_sight_k += ((1.0 if _sight_want else 0.0) - _sight_k) * minf(1.0, delta * 14.0)
	if has_sight:
		# Up to the eye: the mark of its sight on the middle of the view, an arm's length off.
		var up := Vector3(-float(aim.at[0]), -float(aim.at[1]), -0.36 - float(aim.at[2]))
		_held.position = hip.lerp(up, _sight_k)
		if _sight_k > 0.002 or _fov_base >= 0.0:
			if _fov_base < 0.0:
				_fov_base = camera.fov
			var share := lerpf(1.0, maxf(0.45, float(aim.get("zoom", 1.0))), _sight_k)
			camera.fov = _fov_base * share
			if visitor is NswpVisitor:
				(visitor as NswpVisitor).look_scale = share
			if _sight_k <= 0.002 and not _sight_want:
				_end_sight(camera)
	else:
		_held.position = hip
	# Something that is pointed is turned a little toward the middle, as a hand holds it.
	_held.rotation = Vector3(0.0, 0.1 * (1.0 - _sight_k) if acts else 0.0, 0.0)


func _end_sight(camera: Camera3D) -> void:
	_sight_k = 0.0
	_sight_want = false
	if _fov_base >= 0.0 and camera != null:
		camera.fov = _fov_base
	_fov_base = -1.0
	if visitor is NswpVisitor:
		(visitor as NswpVisitor).look_scale = 1.0


# ------------------------------------------------------------------------ things in the air

func _draw_things(things: Variant) -> void:
	if typeof(things) != TYPE_ARRAY:
		return
	var seen := {}
	var space := get_world_3d().direct_space_state
	for thing: Variant in things:
		if typeof(thing) != TYPE_DICTIONARY:
			continue
		var key := str(thing.get("key", ""))
		seen[key] = true
		var node: Node3D = _things.get(key)
		if node == null:
			var box := _size_of(thing.get("size"))
			var inner := _instance(str(thing.get("model", "")), box)
			if inner == null:
				continue
			# A model stands on its base. In the air it is carried by its middle.
			inner.position.y -= box.y / 2.0
			node = Node3D.new()
			node.add_child(inner)
			_tint(inner, thing.get("tints", {}))
			add_child(node)
			_things[key] = node
		var at: Array = thing.get("at", [0, 0, 0])
		var turn: Array = thing.get("turn", [0, 0, 0, 1])
		var scale_now := maxf(0.01, float(thing.get("scale", 1.0)))
		node.global_transform = Transform3D(Basis(Quaternion(float(turn[0]), float(turn[1]), float(turn[2]), float(turn[3])).normalized()).scaled(Vector3.ONE * scale_now), Vector3(float(at[0]), float(at[1]), float(at[2])))
		# Where it went this frame: did it run into anything of this world's?
		var test: Variant = thing.get("test")
		if typeof(test) == TYPE_DICTIONARY:
			# A thing falls as it flies: a step that took a while is a curve, given as the places it
			# passed. Each piece is tested in order, and the first meeting is the one.
			var path: Array[Vector3] = [_vec(test.get("a"))]
			var via: Variant = test.get("via")
			if typeof(via) == TYPE_ARRAY:
				for place: Variant in via:
					path.append(_vec(place))
			path.append(_vec(test.get("b")))
			var pieces := path.size() - 1
			for i in pieces:
				var hit := _cast(space, path[i], path[i + 1])
				if hit.is_empty():
					continue
				var along := path[i].distance_to(path[i + 1])
				var within := 0.0 if along <= 0.0001 else path[i].distance_to(hit.position) / along
				_met.append({"key": key, "step": int(test.get("step", -1)), "f": (float(i) + within) / float(pieces), "at": [hit.position.x, hit.position.y, hit.position.z], "ref": str((hit.collider as Node).get_path()) if hit.collider is Node else ""})
				break
		if bool(thing.get("down", false)):
			var below := _cast(space, node.global_position + Vector3(0.0, 0.05, 0.0), node.global_position + Vector3(0.0, -60.0, 0.0))
			if not below.is_empty():
				_floors.append({"key": key, "y": below.position.y})
	for key: String in _things.keys():
		if not seen.has(key):
			(_things[key] as Node3D).queue_free()
			_things.erase(key)


func _cast(space: PhysicsDirectSpaceState3D, a: Vector3, b: Vector3) -> Dictionary:
	if a.distance_to(b) < 0.0001:
		return {}
	var query := PhysicsRayQueryParameters3D.create(a, b)
	# A doorway is somewhere to go, not something to stick to; and nobody's own body stops their own dart.
	query.collide_with_areas = false
	if visitor is CollisionObject3D:
		query.exclude = [(visitor as CollisionObject3D).get_rid()]
	return space.intersect_ray(query)


# ------------------------------------------------------------------------ streaks of light

## A streak behind a thing: a ribbon along the middle the kit gave, turned to face the viewer,
## bright at the thing and fading to nothing. It follows the arc the thing flew.
func _draw_trails(trails: Variant, camera: Camera3D) -> void:
	if typeof(trails) != TYPE_ARRAY:
		return
	var seen := {}
	var eye := camera.global_position
	for trail: Variant in trails:
		if typeof(trail) != TYPE_DICTIONARY:
			continue
		var points: Array = trail.get("points", [])
		if points.size() < 2:
			continue
		var key := str(trail.get("key", ""))
		seen[key] = true
		var node: MeshInstance3D = _trails.get(key)
		if node == null:
			node = MeshInstance3D.new()
			node.mesh = ImmediateMesh.new()
			node.material_override = _trail_paint
			node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			add_child(node)
			node.global_transform = Transform3D.IDENTITY
			_trails[key] = node
		var base := Color(str(trail.get("color", "#ffffff")))
		var ribbon := node.mesh as ImmediateMesh
		ribbon.clear_surfaces()
		ribbon.surface_begin(Mesh.PRIMITIVE_TRIANGLE_STRIP)
		var count := points.size()
		for i: int in count:
			var p := _vec(points[i])
			var other := _vec(points[i + 1 if i + 1 < count else i - 1])
			var along := (other - p) if i + 1 < count else (p - other)
			var side := along.cross(eye - p)
			if side.length_squared() < 0.0000001:
				side = Vector3.UP
			side = side.normalized() * (TRAIL_WIDTH / 2.0) * (1.0 - (float(i) / float(count - 1)) * 0.85)
			var bright := float((points[i] as Array)[3]) if (points[i] as Array).size() > 3 else 0.0
			var paint := Color(base.r * bright, base.g * bright, base.b * bright, 1.0)
			ribbon.surface_set_color(paint)
			ribbon.surface_add_vertex(p + side)
			ribbon.surface_set_color(paint)
			ribbon.surface_add_vertex(p - side)
		ribbon.surface_end()
	for key: String in _trails.keys():
		if not seen.has(key):
			(_trails[key] as MeshInstance3D).queue_free()
			_trails.erase(key)


# ------------------------------------------------------------------------ models

## For whatever else draws an item here (`NswpPeople`, for what other people hold): something to
## draw for a model, as `_instance` gives it; its holder's colours; and its animations.
func instance_of(sha: String, size: Variant) -> Node3D:
	return _instance(sha, _size_of(size))


func tint(root: Node3D, tints: Variant) -> void:
	_tint(root, tints)


func player_in(root: Node) -> AnimationPlayer:
	return _player_in(root)


## Something to draw for a model, fitted to its box: a copy of what its file holds, or a plain
## box of its size where the file failed a check. Null while its bytes are on their way. The
## bytes are the kit's: fetched, checked against the hash the item's maker signed, and counted.
func _instance(sha: String, box: Vector3) -> Node3D:
	if sha == "":
		return _marker(box)
	if _models.has(sha):
		var kept: Variant = _models[sha]
		return _marker(box) if kept == null else _fitted((kept as Node3D).duplicate() as Node3D, box)
	var text := Nswp.model(sha)
	if text == "":
		return null
	var made: Node3D = null
	if text != "!":
		var doc := GLTFDocument.new()
		var state := GLTFState.new()
		if doc.append_from_buffer(Marshalls.base64_to_raw(text), "", state) == OK:
			made = doc.generate_scene(state) as Node3D
	if made != null:
		# Lights and cameras a file brings are not an item's to add to someone's world.
		for extra: Node in made.find_children("*", "Light3D", true, false) + made.find_children("*", "Camera3D", true, false):
			extra.get_parent().remove_child(extra)
			extra.free()
	_models[sha] = made
	return _marker(box) if made == null else _fitted(made.duplicate() as Node3D, box)


## Scaled to fit its box, standing on the middle of its base: as every renderer places a model.
func _fitted(root: Node3D, box: Vector3) -> Node3D:
	var has := AABB()
	var first := true
	for part: Node in root.find_children("*", "MeshInstance3D", true, false):
		var mesh_part := part as MeshInstance3D
		if mesh_part.mesh == null:
			continue
		var within := _to_root(root, mesh_part) * mesh_part.mesh.get_aabb()
		has = within if first else has.merge(within)
		first = false
	var holder := Node3D.new()
	holder.add_child(root)
	if first:
		return holder
	var fit := minf(box.x / maxf(has.size.x, 0.000001), minf(box.y / maxf(has.size.y, 0.000001), box.z / maxf(has.size.z, 0.000001)))
	if not is_finite(fit) or fit <= 0.0:
		fit = 1.0
	root.scale *= fit
	var middle := has.get_center() * fit
	root.position -= Vector3(middle.x, has.position.y * fit, middle.z)
	return holder


func _to_root(root: Node3D, node: Node3D) -> Transform3D:
	var t := Transform3D.IDENTITY
	var at: Node = node
	while at != null and at != root:
		if at is Node3D:
			t = (at as Node3D).transform * t
		at = at.get_parent()
	return root.transform * t if at == root else t


func _marker(box: Vector3) -> Node3D:
	var holder := Node3D.new()
	var shape := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = box
	shape.mesh = mesh
	var paint := StandardMaterial3D.new()
	paint.albedo_color = Color(0.6, 0.65, 0.7, 0.35)
	paint.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	paint.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	shape.material_override = paint
	shape.position.y = box.y / 2.0
	holder.add_child(shape)
	return holder


## Colour the parts a holder may choose: every material named `tint:<slot>` takes the colour
## chosen for it. A part that glows, glows in that colour. Nothing else about it is touched.
func _tint(root: Node3D, tints: Variant) -> void:
	if typeof(tints) != TYPE_DICTIONARY or root == null:
		return
	for part: Node in root.find_children("*", "MeshInstance3D", true, false):
		var mesh_part := part as MeshInstance3D
		if mesh_part.mesh == null:
			continue
		for surface: int in mesh_part.mesh.get_surface_count():
			var from := mesh_part.mesh.surface_get_material(surface)
			# Named `tint:<slot>` in the file; Godot reads that name with the colon made an underscore.
			if from == null or not (from.resource_name.begins_with("tint:") or from.resource_name.begins_with("tint_")):
				continue
			var slot := from.resource_name.substr(5)
			var chosen := str(tints.get(slot, ""))
			if not chosen.is_valid_html_color():
				continue
			var own := mesh_part.get_surface_override_material(surface) as BaseMaterial3D
			if own == null:
				own = from.duplicate() as BaseMaterial3D
				if own == null:
					continue
				mesh_part.set_surface_override_material(surface, own)
			var colour := Color(chosen)
			own.albedo_color = Color(colour.r, colour.g, colour.b, own.albedo_color.a)
			if own.emission_enabled:
				own.emission = colour


func _player_in(root: Node) -> AnimationPlayer:
	var found := root.find_children("*", "AnimationPlayer", true, false)
	return null if found.is_empty() else found[0] as AnimationPlayer


func _size_of(v: Variant) -> Vector3:
	return _vec(v) if typeof(v) == TYPE_ARRAY and (v as Array).size() == 3 else Vector3(0.2, 0.3, 0.2)


func _vec(v: Variant) -> Vector3:
	if typeof(v) != TYPE_ARRAY or (v as Array).size() < 3:
		return Vector3.ZERO
	return Vector3(float(v[0]), float(v[1]), float(v[2]))


## For tests: the colour of each part of something that its holder may choose, by name.
func _colours(root: Node3D) -> Dictionary:
	var found := {}
	if root == null:
		return found
	for part: Node in root.find_children("*", "MeshInstance3D", true, false):
		var mesh_part := part as MeshInstance3D
		if mesh_part.mesh == null:
			continue
		for surface: int in mesh_part.mesh.get_surface_count():
			var own := mesh_part.get_surface_override_material(surface) as BaseMaterial3D
			var from := mesh_part.mesh.surface_get_material(surface)
			if own != null and from != null:
				found[from.resource_name.substr(5)] = "#" + own.albedo_color.to_html(false)
	return found


## For tests: what is drawn now.
func report() -> Dictionary:
	return {
		"started": _started,
		"held": _held_id,
		"held_drawn": _held != null,
		"held_parts": 0 if _held == null else _held.find_children("*", "MeshInstance3D", true, false).size(),
		"held_at": [] if _held == null else [snappedf(_held.position.x, 0.001), snappedf(_held.position.y, 0.001), snappedf(_held.position.z, 0.001)],
		"animations": [] if _held_player == null else Array(_held_player.get_animation_list()),
		"things": _things.size(),
		"trails": _trails.size(),
		"sight": snappedf(_sight_k, 0.01),
		"colours": _colours(_held),
		"words": str(last.get("own", {}).get("words", "")) if typeof(last.get("own")) == TYPE_DICTIONARY else "",
		"acts": bool(_held_info.get("acts", false)) if _held != null else false,
		"own": last.get("own", {}),
		"on": (last.get("things", []) as Array).map(func(t: Variant) -> String: return str(t.get("on", "")) if typeof(t) == TYPE_DICTIONARY else ""),
		"stuck": (last.get("things", []) as Array).filter(func(t: Variant) -> bool: return typeof(t) == TYPE_DICTIONARY and str(t.get("state", "")) == "stuck").size() if typeof(last.get("things")) == TYPE_ARRAY else 0,
	}
