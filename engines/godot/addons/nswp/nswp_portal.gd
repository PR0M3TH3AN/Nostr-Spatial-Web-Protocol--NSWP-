class_name NswpPortal
extends Area3D
## A door to another world. Put it where the door is, give it a collision shape the size of
## the doorway, and say where it leads.
##
## Walking into it goes through, if `on_enter` is set. Otherwise call `enter()` from whatever
## the visitor does to choose it: a click, a trigger, a key.
##
## The door should say where it leads, in the world, before anyone goes: its name and its
## address. The visitor's own Airlock shows the real address next and asks; that check is
## theirs, and nothing a door draws stands in for it.

## The world's address. It must be https.
@export var url: String = ""
## The world's announcement (naddr1...), if you have it: their Airlock checks the address against it.
@export var naddr: String = ""
## Where in that world to arrive, or "" for its main entrance.
@export var entry_point: String = ""
## What the door is called, for a sign of your own making.
@export var label: String = ""
## Go through when the visitor walks in.
@export var on_enter: bool = true
## Only bodies in this group go through by walking in. Empty: any body.
@export var visitor_group: String = ""

## The visitor is on their way. The page is about to be left: stop anything that should stop.
signal leaving(portal: NswpPortal)
## The door couldn't be gone through.
signal refused(portal: NswpPortal, reason: String)

var _gone: bool = false


func _ready() -> void:
	body_entered.connect(_on_body_entered)
	Nswp.refused.connect(_on_refused)


## Go through this door.
func enter() -> void:
	if _gone or url == "":
		return
	_gone = true
	leaving.emit(self)
	if not Nswp.go(url, naddr, entry_point):
		_gone = false


func _on_body_entered(body: Node3D) -> void:
	if on_enter and (visitor_group == "" or body.is_in_group(visitor_group)):
		enter()


func _on_refused(reason: String) -> void:
	if _gone:
		_gone = false
		refused.emit(self, reason)
