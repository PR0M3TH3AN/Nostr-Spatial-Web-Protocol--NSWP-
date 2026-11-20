class_name NswpPeople
extends Node3D
## Other people, in a world made with Godot (spec §9.4).
##
## A visitor may join the room of the place they are in, and then sees and hears whoever else is
## there. This node is everything Godot has to do for that, and it is little, because everything
## about a room that isn't drawing is the kit's own script on the page, the same code a Three.js
## world runs: joining and leaving, who is here and where, their voices from where they stand,
## chat, the list of people and a card for each, muting and blocking. Their figures, their names
## and what they write are made there too, so people look the same here as in any other world.
##
## What is done here is to draw what the kit hands over:
## - a figure for each person: a head, a body and two hands, in the kit's metal;
## - boards: flat pictures that face the viewer (a name, a picture, a few written words).
##
##     var people := NswpPeople.new()
##     people.visitor = $Visitor          # an NswpVisitor, or any node that stands on the floor
##     add_child(people)
##
## Nobody is joined to anything until they ask, in the menu, having been told what it shows of
## them. Voices and chat are the page's own: there is nothing of sound to do here.

## Who is looking: the node that stands where the visitor stands. Its height is the floor under them.
@export var visitor: Node3D
## False for a place that wants none of its visitors' music shared: a concert, a library.
@export var shared_music: bool = true
## This world's `NswpItems`, where it has one: then what other people hold is drawn in their
## hands, in the colours they chose. Left out, nothing anyone else carries is drawn.
@export var items: NswpItems

const ALLOY := preload("res://addons/nswp/gate/alloy.gdshader")

var _started: bool = false
## Everyone being drawn, by their key: the nodes for each.
var _people: Dictionary = {}
## Figures that have been read, by the name the kit gave: three meshes and the metal's colours.
var _figures: Dictionary = {}
## Boards' pictures that have been read, by key.
var _pictures: Dictionary = {}
## For tests: what the kit said last.
var last: Dictionary = {}


func _process(delta: float) -> void:
	if not Nswp.is_live():
		return
	if not _started:
		# The menu comes first: the room's controls are part of it.
		var began := Nswp.people({} if shared_music else {"sharedMusic": false})
		_started = bool(began.get("ok", false))
		if not _started:
			return
	var camera := get_viewport().get_camera_3d()
	if camera == null:
		return
	var now := Nswp.frame(Nswp.view_of(camera, visitor, delta))
	last = now
	_draw(now.get("people", []))
	# An animation of what someone else holds began: a blaster's slide, as they fire.
	for clip: Variant in now.get("clips", []):
		if typeof(clip) != TYPE_DICTIONARY or not _people.has(str(clip.get("who", ""))):
			continue
		var player: Variant = _people[str(clip.get("who", ""))].get("held_player")
		if player is AnimationPlayer and (player as AnimationPlayer).has_animation(str(clip.get("name", ""))):
			(player as AnimationPlayer).stop()
			(player as AnimationPlayer).play(str(clip.get("name", "")))


func _draw(people: Variant) -> void:
	var seen := {}
	var figures_seen := {}
	var pictures_seen := {}
	if typeof(people) == TYPE_ARRAY:
		for p: Variant in people:
			if typeof(p) != TYPE_DICTIONARY:
				continue
			var key := str(p.get("key", ""))
			if key == "":
				continue
			seen[key] = true
			figures_seen[str(p.get("figure", ""))] = true
			if not _people.has(key):
				_people[key] = _person()
			_place(_people[key], p, pictures_seen)
	for key: String in _people.keys():
		if not seen.has(key):
			(_people[key].root as Node3D).queue_free()
			_people.erase(key)
	# What nobody is drawn with any more is let go of.
	for name_was: String in _figures.keys():
		if not figures_seen.has(name_was):
			_figures.erase(name_was)
	for key: String in _pictures.keys():
		if not pictures_seen.has(key):
			_pictures.erase(key)


## The nodes one person is drawn with: nothing in them yet.
func _person() -> Dictionary:
	var root := Node3D.new()
	root.top_level = true
	add_child(root)
	var metal := ShaderMaterial.new()
	metal.shader = ALLOY
	# These shapes are made here, corner by corner, and not read from a file.
	metal.set_shader_parameter("flow_flipped", false)
	var parts: Array[MeshInstance3D] = []
	for i in 4:
		var part := MeshInstance3D.new()
		part.top_level = true
		part.material_override = metal
		# A person is never something a thing sticks to as a shape of this world: the kit knows where they are.
		part.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		root.add_child(part)
		parts.append(part)
	return {"root": root, "metal": metal, "head": parts[0], "body": parts[1], "hands": [parts[2], parts[3]], "figure": "", "boards": {}, "held": null, "held_id": "", "held_tints": "", "held_player": null}


func _place(person: Dictionary, p: Dictionary, pictures_seen: Dictionary) -> void:
	var figure_name := str(p.get("figure", ""))
	if figure_name != str(person.figure):
		var f := _figure(figure_name)
		if not f.is_empty():
			person.figure = figure_name
			(person.head as MeshInstance3D).mesh = f.head
			(person.body as MeshInstance3D).mesh = f.body
			for hand: MeshInstance3D in person.hands:
				hand.mesh = f.hand
			var metal: ShaderMaterial = person.metal
			metal.set_shader_parameter("accent", f.accent)
			metal.set_shader_parameter("gloss", f.gloss)
			metal.set_shader_parameter("sheen", f.sheen)
	(person.metal as ShaderMaterial).set_shader_parameter("opacity", clampf(float(p.get("opacity", 1.0)), 0.0, 1.0))
	_put(person.head, p.get("head"))
	_put(person.body, p.get("body"))
	var hands: Variant = p.get("hands", [])
	for i in 2:
		var hand: MeshInstance3D = person.hands[i]
		var where: Variant = hands[i] if typeof(hands) == TYPE_ARRAY and hands.size() > i else null
		hand.visible = typeof(where) == TYPE_DICTIONARY
		if hand.visible:
			_put(hand, where)
	# What they hold: the same model, checked the same way, as in their own hand.
	var held: Variant = p.get("held")
	if items != null and typeof(held) == TYPE_DICTIONARY:
		var held_id := "%s|%s" % [str(held.get("id", "")), str(held.get("model", ""))]
		if held_id != str(person.held_id):
			_drop_held(person)
			var made := items.instance_of(str(held.get("model", "")), held.get("size"))
			# Null while its bytes are on their way: asked for again next frame.
			if made != null:
				made.top_level = true
				(person.root as Node3D).add_child(made)
				person.held = made
				person.held_id = held_id
				person.held_player = items.player_in(made)
		if person.held != null:
			_put(person.held, held)
			var colours := JSON.stringify(held.get("tints", {}))
			if colours != str(person.held_tints):
				items.tint(person.held, held.get("tints"))
				person.held_tints = colours
	else:
		_drop_held(person)
	# Boards: a name, a picture, a few written words, how they are. Each faces whoever is looking.
	var boards: Dictionary = person.boards
	var shown := {}
	var listed: Variant = p.get("boards", [])
	if typeof(listed) == TYPE_ARRAY:
		for b: Variant in listed:
			if typeof(b) != TYPE_DICTIONARY:
				continue
			var key := str(b.get("key", ""))
			var picture := _picture(key)
			if picture == null:
				continue
			pictures_seen[key] = true
			shown[key] = true
			if not boards.has(key):
				var sprite := Sprite3D.new()
				sprite.top_level = true
				sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
				sprite.shaded = false
				sprite.double_sided = true
				sprite.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
				sprite.texture = picture
				(person.root as Node3D).add_child(sprite)
				boards[key] = sprite
			var board: Sprite3D = boards[key]
			var wide := float(picture.get_width())
			board.pixel_size = float(b.get("w", 0.5)) / maxf(1.0, wide)
			# Words stand on their own bottom edge, over a head; everything else is placed by its middle.
			board.offset = Vector2(0.0, float(picture.get_height()) * 0.5) if bool(b.get("foot", false)) else Vector2.ZERO
			board.global_position = _vec(b.get("at"))
			var colour := Color.html(str(b.get("tint"))) if b.has("tint") and Color.html_is_valid(str(b.get("tint"))) else Color.WHITE
			colour.a = clampf(float(b.get("opacity", 1.0)), 0.0, 1.0)
			board.modulate = colour
	for key: String in boards.keys():
		if not shown.has(key):
			(boards[key] as Node3D).queue_free()
			boards.erase(key)


func _drop_held(person: Dictionary) -> void:
	if person.held != null:
		(person.held as Node3D).queue_free()
	person.held = null
	person.held_id = ""
	person.held_tints = ""
	person.held_player = null


func _put(node: Node3D, where: Variant) -> void:
	if typeof(where) != TYPE_DICTIONARY:
		return
	var q: Variant = where.get("q")
	var basis := Basis.IDENTITY
	if typeof(q) == TYPE_ARRAY and q.size() == 4:
		basis = Basis(Quaternion(float(q[0]), float(q[1]), float(q[2]), float(q[3])).normalized())
	node.global_transform = Transform3D(basis, _vec(where.get("p")))


## A figure's three meshes and its metal's colours, read once from the kit.
func _figure(figure_name: String) -> Dictionary:
	if figure_name == "":
		return {}
	if _figures.has(figure_name):
		return _figures[figure_name]
	var got := Nswp.figure(figure_name)
	if got.is_empty():
		return {}
	var accent := str(got.get("accent", "#4cc9f0"))
	var read := {
		"head": _mesh(got.get("head")),
		"body": _mesh(got.get("body")),
		"hand": _mesh(got.get("hand")),
		"accent": Color.html(accent) if Color.html_is_valid(accent) else Color(0.298, 0.788, 0.941),
		"gloss": float(got.get("gloss", 0.7)),
		"sheen": float(got.get("sheen", 0.0)),
	}
	_figures[figure_name] = read
	return read


## One shape of a figure, from its corners: where each is, which way it faces, its tone, and how
## much of a light it is. The kit's metal reads the last two from the colour and the texture place.
func _mesh(shape: Variant) -> ArrayMesh:
	var mesh := ArrayMesh.new()
	if typeof(shape) != TYPE_DICTIONARY:
		return mesh
	var count := int(shape.get("count", 0))
	var at := Marshalls.base64_to_raw(str(shape.get("position", ""))).to_float32_array()
	var facing := Marshalls.base64_to_raw(str(shape.get("normal", ""))).to_float32_array()
	var tone := Marshalls.base64_to_raw(str(shape.get("tone", ""))).to_float32_array()
	var glow := Marshalls.base64_to_raw(str(shape.get("glow", ""))).to_float32_array()
	var flow := Marshalls.base64_to_raw(str(shape.get("flow", ""))).to_float32_array()
	if count <= 0 or at.size() < count * 3 or facing.size() < count * 3 or tone.size() < count * 3 or glow.size() < count or flow.size() < count:
		return mesh
	var places := PackedVector3Array()
	var normals := PackedVector3Array()
	var colours := PackedColorArray()
	var uvs := PackedVector2Array()
	places.resize(count)
	normals.resize(count)
	colours.resize(count)
	uvs.resize(count)
	# The kit lists a triangle's corners the other way round from Godot: each is turned over as it is read.
	for t in count / 3:
		for c in 3:
			var from := t * 3 + c
			var to := t * 3 + (2 - c)
			places[to] = Vector3(at[from * 3], at[from * 3 + 1], at[from * 3 + 2])
			normals[to] = Vector3(facing[from * 3], facing[from * 3 + 1], facing[from * 3 + 2])
			colours[to] = Color(tone[from * 3], tone[from * 3 + 1], tone[from * 3 + 2])
			uvs[to] = Vector2(glow[from], flow[from])
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = places
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_COLOR] = colours
	arrays[Mesh.ARRAY_TEX_UV] = uvs
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return mesh


## A board's picture, read once from the kit. Null while there is none to be had.
func _picture(key: String) -> ImageTexture:
	if key == "":
		return null
	if _pictures.has(key):
		return _pictures[key]
	var text := Nswp.board(key)
	if text == "":
		return null
	var image := Image.new()
	if image.load_png_from_buffer(Marshalls.base64_to_raw(text)) != OK:
		return null
	image.generate_mipmaps()
	var picture := ImageTexture.create_from_image(image)
	_pictures[key] = picture
	return picture


func _vec(v: Variant) -> Vector3:
	if typeof(v) == TYPE_ARRAY and v.size() == 3:
		return Vector3(float(v[0]), float(v[1]), float(v[2]))
	return Vector3.ZERO


## For tests: who is drawn, and with what.
func report() -> Dictionary:
	var drawn := []
	for key: String in _people.keys():
		var person: Dictionary = _people[key]
		var head: MeshInstance3D = person.head
		var body: MeshInstance3D = person.body
		drawn.append({
			"key": key,
			"figure": str(person.figure),
			"head_corners": head.mesh.get_faces().size() if head.mesh != null else 0,
			"body_corners": body.mesh.get_faces().size() if body.mesh != null else 0,
			"head": [snappedf(head.global_position.x, 0.01), snappedf(head.global_position.y, 0.01), snappedf(head.global_position.z, 0.01)],
			"hands": [(person.hands[0] as Node3D).visible, (person.hands[1] as Node3D).visible],
			"boards": (person.boards as Dictionary).size(),
			"held": str(person.held_id),
			"held_drawn": person.held != null,
		})
	return {"started": _started, "room": last.get("room", {}), "people": drawn}
