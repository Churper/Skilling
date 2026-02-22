extends Node3D

@export var base_fov: float = 82.0

@onready var camera: Camera3D = $Player/Head/Camera3D

func _ready() -> void:
	var window := get_window()
	window.content_scale_mode = Window.CONTENT_SCALE_MODE_CANVAS_ITEMS
	window.content_scale_aspect = Window.CONTENT_SCALE_ASPECT_EXPAND
	window.size_changed.connect(_on_window_size_changed)
	_on_window_size_changed()

func _on_window_size_changed() -> void:
	var window := get_window()
	var size := window.size
	if size.x <= 0 or size.y <= 0:
		return

	# Keep perf predictable on very large/high-density displays.
	var shortest_side: int = min(size.x, size.y)
	var scale_factor := 1.0
	if shortest_side >= 1400:
		scale_factor = 0.9
	if shortest_side >= 2000:
		scale_factor = 0.8
	window.content_scale_factor = scale_factor

	# Small FOV adaptation for portrait/ultrawide so framing stays consistent.
	if camera:
		var aspect := float(size.x) / float(size.y)
		if aspect < 1.0:
			camera.fov = clamp(base_fov + (1.0 - aspect) * 10.0, base_fov, 94.0)
		elif aspect > 2.1:
			camera.fov = clamp(base_fov - (aspect - 2.1) * 6.0, 76.0, base_fov)
		else:
			camera.fov = base_fov
