extends Node3D

@export var sway_strength: float = 0.00018
@export var sway_smooth: float = 12.0
@export var bob_amount: float = 0.014
@export var bob_speed: float = 7.2

var base_pos: Vector3
var base_rot: Vector3
var bob_time: float = 0.0

func _ready() -> void:
	base_pos = position
	base_rot = rotation

func _process(delta: float) -> void:
	var mouse_vel := Input.get_last_mouse_velocity()
	var target_rot := base_rot + Vector3(
		-mouse_vel.y * sway_strength,
		-mouse_vel.x * sway_strength,
		-mouse_vel.x * sway_strength * 0.35
	)

	var player := get_node_or_null("../../..") as CharacterBody3D
	var move_mag := 0.0
	if player:
		move_mag = Vector2(player.velocity.x, player.velocity.z).length()

	if player and player.is_on_floor() and move_mag > 0.12:
		bob_time += delta * bob_speed * clamp(move_mag / 5.0, 0.8, 1.8)
	else:
		bob_time = lerp(bob_time, 0.0, delta * 5.0)

	var bob_pos := Vector3(0.0, sin(bob_time) * bob_amount, 0.0)
	var bob_rot := Vector3(sin(bob_time * 0.5) * bob_amount * 0.7, 0.0, cos(bob_time) * bob_amount)

	position = position.lerp(base_pos + bob_pos, delta * sway_smooth)
	rotation = rotation.lerp(target_rot + bob_rot, delta * sway_smooth)