extends SceneTree
## Writes a scene out as the one file an item's model is: a binary glTF with everything it
## needs inside it (NSWP-17). An item made this way works in every world that draws items,
## whatever that world is made with: there is nothing to convert, in either direction.
##
##     godot --headless --path . --script addons/nswp/nswp_item_model.gd -- res://mallet.tscn mallet.glb
##     nswp make-item mallet.glb --title "Mallet" --host https://your.site/items/
##
## One unit is one metre. An item stands on its base and faces -Z: a thing that is pointed,
## points away from whoever holds it. No side may be longer than four metres.
##
## A material named `tint:<name>` (say `tint:accent`) is a colour whoever holds the item may
## choose: `nswp make-item` finds it, and it starts as the colour you gave the material. An
## animation in the scene keeps its name: an item's own logic plays it by that name.
##
## With `--sample` in place of a scene it writes a small mallet, made here in code, to show the
## whole of what a model can carry.

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() < 2:
		printerr("Give a scene and where to write its model: -- res://thing.tscn thing.glb   (or: -- --sample thing.glb)")
		quit(1)
		return
	var root: Node3D = _sample() if args[0] == "--sample" else _load(args[0])
	if root == null:
		printerr("That scene couldn't be read, or isn't a 3D scene: %s" % args[0])
		quit(1)
		return
	var doc := GLTFDocument.new()
	var state := GLTFState.new()
	var made := doc.append_from_scene(root, state)
	if made == OK:
		made = doc.write_to_filesystem(state, args[1])
	root.free()
	if made != OK:
		printerr("It couldn't be written to %s." % args[1])
		quit(1)
		return
	print("Wrote %s. Next: nswp make-item %s --title \"…\" --host https://…/" % [args[1], args[1]])
	quit(0)


func _load(path: String) -> Node3D:
	var packed := load(path) as PackedScene
	return null if packed == null else packed.instantiate() as Node3D


## A mallet: a handle, and a head in a colour its holder may choose.
func _sample() -> Node3D:
	var root := Node3D.new()
	root.name = "Mallet"
	var wood := StandardMaterial3D.new()
	wood.resource_name = "wood"
	wood.albedo_color = Color("7a5230")
	var head_paint := StandardMaterial3D.new()
	head_paint.resource_name = "tint:accent"
	head_paint.albedo_color = Color("d2452e")
	var handle := MeshInstance3D.new()
	handle.name = "Handle"
	var shaft := CylinderMesh.new()
	shaft.top_radius = 0.014
	shaft.bottom_radius = 0.016
	shaft.height = 0.3
	shaft.radial_segments = 12
	shaft.rings = 1
	shaft.material = wood
	handle.mesh = shaft
	handle.position = Vector3(0.0, 0.15, 0.0)
	var head := MeshInstance3D.new()
	head.name = "Head"
	var block := BoxMesh.new()
	block.size = Vector3(0.07, 0.07, 0.16)
	block.material = head_paint
	head.mesh = block
	head.position = Vector3(0.0, 0.32, 0.0)
	root.add_child(handle)
	root.add_child(head)
	return root
