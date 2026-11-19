@tool
extends EditorPlugin
## Registers the `Nswp` autoload, and the project setting that names the Airlock to use for a
## visitor who arrived without one of their own.

const AUTOLOAD := "Nswp"
const SETTING := "nswp/airlock"
const DEFAULT_AIRLOCK := "https://portal.bitblocks.network/go/"


func _enter_tree() -> void:
	add_autoload_singleton(AUTOLOAD, "res://addons/nswp/nswp.gd")
	if not ProjectSettings.has_setting(SETTING):
		ProjectSettings.set_setting(SETTING, DEFAULT_AIRLOCK)
	ProjectSettings.set_initial_value(SETTING, DEFAULT_AIRLOCK)
	ProjectSettings.add_property_info({
		"name": SETTING,
		"type": TYPE_STRING,
		"hint": PROPERTY_HINT_PLACEHOLDER_TEXT,
		"hint_string": DEFAULT_AIRLOCK,
	})


func _exit_tree() -> void:
	remove_autoload_singleton(AUTOLOAD)
