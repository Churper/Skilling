extends CharacterBody3D

@export var move_speed: float = 6.5
@export var acceleration: float = 12.0
@export var jump_velocity: float = 4.3
@export var mouse_sensitivity: float = 0.0022

var gravity: float = ProjectSettings.get_setting("physics/3d/default_gravity")

@onready var head: Node3D = $Head

func _ready() -> void:
	_ensure_default_input_map()
	_set_mouse_captured(false)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.get_mouse_mode() == Input.MOUSE_MODE_CAPTURED:
		rotate_y(-event.relative.x * mouse_sensitivity)
		head.rotate_x(-event.relative.y * mouse_sensitivity)
		head.rotation.x = clamp(head.rotation.x, deg_to_rad(-85.0), deg_to_rad(85.0))

	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_RIGHT:
		_set_mouse_captured(event.pressed)

	if event.is_action_pressed("toggle_mouse_capture"):
		_set_mouse_captured(Input.get_mouse_mode() != Input.MOUSE_MODE_CAPTURED)

	if event.is_action_pressed("ui_cancel"):
		_set_mouse_captured(false)

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		_set_mouse_captured(false)

func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y -= gravity * delta
	elif Input.is_action_just_pressed("jump"):
		velocity.y = jump_velocity

	var input_vec := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var local_dir := Vector3(input_vec.x, 0.0, input_vec.y)
	var world_dir := (transform.basis * local_dir).normalized()

	var target_x := world_dir.x * move_speed
	var target_z := world_dir.z * move_speed

	velocity.x = move_toward(velocity.x, target_x, acceleration * delta)
	velocity.z = move_toward(velocity.z, target_z, acceleration * delta)

	move_and_slide()

func _ensure_default_input_map() -> void:
	_add_action_key("move_forward", Key.KEY_W)
	_add_action_key("move_back", Key.KEY_S)
	_add_action_key("move_left", Key.KEY_A)
	_add_action_key("move_right", Key.KEY_D)
	_add_action_key("jump", Key.KEY_SPACE)
	_add_action_key("toggle_mouse_capture", Key.KEY_TAB)

func _add_action_key(action_name: StringName, keycode: Key) -> void:
	if not InputMap.has_action(action_name):
		InputMap.add_action(action_name)

	for existing in InputMap.action_get_events(action_name):
		if existing is InputEventKey and existing.physical_keycode == keycode:
			return

	var ev := InputEventKey.new()
	ev.physical_keycode = keycode
	InputMap.action_add_event(action_name, ev)

func _set_mouse_captured(captured: bool) -> void:
	Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED if captured else Input.MOUSE_MODE_VISIBLE)
