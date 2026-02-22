extends Node3D

@export var base_fov: float = 82.0

const WATER_LAYER: int = 2
const FISH_TYPES: PackedStringArray = ["Minnow", "Trout", "Bass", "Salmon", "Golden Koi"]
const FISH_XP: Dictionary = {
	"Minnow": 10,
	"Trout": 16,
	"Bass": 24,
	"Salmon": 38,
	"Golden Koi": 72,
}

@onready var camera: Camera3D = $Player/Head/Camera3D
@onready var pole: Node3D = $Player/Head/Camera3D/FishingPole
@onready var ground_mesh: MeshInstance3D = $Ground
@onready var world_env: WorldEnvironment = $WorldEnvironment
@onready var sun_light: DirectionalLight3D = $Sun

var water_root: Node3D
var water_mesh: MeshInstance3D
var water_area: Area3D
var bobber: MeshInstance3D
var cast_line: MeshInstance3D

var cast_state: int = 0
var cast_timer: float = 0.0
var bobber_time: float = 0.0
var last_cast_point: Vector3 = Vector3.ZERO

var inventory: Dictionary = {}
var inventory_labels: Dictionary = {}
var inventory_name_labels: Array[Label] = []
var total_label: Label
var status_label: Label
var hud_root: Control
var hud_crosshair: Label
var hud_fishing_panel: PanelContainer
var hud_inventory_panel: PanelContainer
var hud_fishing_title: Label
var hud_inventory_title: Label

var fishing_level: int = 1
var fishing_xp: int = 0
var fishing_level_label: Label
var fishing_xp_label: Label
var fishing_xp_bar: ProgressBar
var xp_drop_label: Label
var xp_drop_timer: float = 0.0
var xp_drop_base_top: float = -118.0
var xp_drop_base_bottom: float = -82.0

func _ready() -> void:
	randomize()
	_ensure_cast_input_map()
	_apply_window_scaling()
	_style_world_low_poly()
	_create_water_zone()
	_spawn_lowpoly_props()
	_build_hud()

	for fish_name in FISH_TYPES:
		inventory[fish_name] = 0
	_update_inventory_ui()
	_update_fishing_ui()
	_set_status("Hold right click or Tab: look mode • Tap/click water: cast")

	var window: Window = get_window()
	window.size_changed.connect(_on_window_size_changed)
	_on_window_size_changed()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch and event.pressed:
		_try_cast_from_screen(event.position)
		return

	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
		_try_cast_from_screen(event.position)
		return

	if event.is_action_pressed("cast"):
		_try_cast()

func _process(delta: float) -> void:
	if xp_drop_timer > 0.0 and xp_drop_label:
		xp_drop_timer -= delta
		xp_drop_label.visible = true
		xp_drop_label.modulate = Color(0.62, 0.94, 1.0, clamp(xp_drop_timer / 1.2, 0.0, 1.0))
		xp_drop_label.offset_top -= delta * 10.0
		xp_drop_label.offset_bottom -= delta * 10.0
		if xp_drop_timer <= 0.0:
			xp_drop_label.visible = false
			xp_drop_label.offset_top = xp_drop_base_top
			xp_drop_label.offset_bottom = xp_drop_base_bottom

	if cast_state == 0:
		return

	cast_timer -= delta
	bobber_time += delta
	_update_bobber_visual(delta)
	_update_cast_line()

	if cast_state == 1 and cast_timer <= 0.0:
		var fish_name: String = _roll_fish()
		_add_fish(fish_name)
		var xp_drop: int = _get_fish_xp(fish_name)
		var levels_gained: int = _add_fishing_xp(xp_drop)
		_show_xp_drop(xp_drop)
		if levels_gained > 0:
			_set_status("Caught %s (+%d XP) • Fishing Lv %d • Tap/click to reel in" % [fish_name, xp_drop, fishing_level])
		else:
			_set_status("Caught %s (+%d XP) • Tap/click to reel in" % [fish_name, xp_drop])
		cast_timer = randf_range(0.85, 1.9)

func _apply_window_scaling() -> void:
	var window: Window = get_window()
	window.content_scale_mode = Window.CONTENT_SCALE_MODE_DISABLED
	window.content_scale_aspect = Window.CONTENT_SCALE_ASPECT_IGNORE
	window.content_scale_factor = 1.0

func _on_window_size_changed() -> void:
	var window: Window = get_window()
	var size: Vector2i = window.size
	if size.x <= 0 or size.y <= 0:
		return

	var shortest_side: int = min(size.x, size.y)
	window.content_scale_factor = 1.0

	if camera:
		var aspect: float = float(size.x) / float(size.y)
		if aspect < 1.0:
			camera.fov = clamp(base_fov + (1.0 - aspect) * 10.0, base_fov, 94.0)
		elif aspect > 2.1:
			camera.fov = clamp(base_fov - (aspect - 2.1) * 6.0, 76.0, base_fov)
		else:
			camera.fov = base_fov

	_apply_hud_layout()

func _ensure_cast_input_map() -> void:
	if not InputMap.has_action("cast"):
		InputMap.add_action("cast")

	for existing in InputMap.action_get_events("cast"):
		if existing is InputEventMouseButton and existing.button_index == MOUSE_BUTTON_LEFT:
			return

	var mouse_event: InputEventMouseButton = InputEventMouseButton.new()
	mouse_event.button_index = MOUSE_BUTTON_LEFT
	InputMap.action_add_event("cast", mouse_event)

func _style_world_low_poly() -> void:
	if world_env and world_env.environment:
		var env: Environment = world_env.environment
		var sky_mat: ProceduralSkyMaterial = ProceduralSkyMaterial.new()
		sky_mat.sky_top_color = Color(0.30, 0.56, 0.73)
		sky_mat.sky_horizon_color = Color(0.70, 0.85, 0.90)
		sky_mat.ground_horizon_color = Color(0.39, 0.49, 0.37)
		sky_mat.ground_bottom_color = Color(0.23, 0.31, 0.24)
		var sky: Sky = Sky.new()
		sky.sky_material = sky_mat
		env.background_mode = Environment.BG_SKY
		env.sky = sky
		env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
		env.ambient_light_color = Color(0.74, 0.85, 0.80)
		env.ambient_light_energy = 0.45

	if ground_mesh:
		var ground_mat: StandardMaterial3D = StandardMaterial3D.new()
		ground_mat.albedo_color = Color(0.32, 0.46, 0.30)
		ground_mat.roughness = 1.0
		ground_mat.metallic = 0.0
		ground_mesh.material_override = ground_mat

	if sun_light:
		sun_light.light_energy = 1.3
		sun_light.shadow_enabled = false

func _create_water_zone() -> void:
	water_root = Node3D.new()
	water_root.name = "WaterZone"
	add_child(water_root)

	var shore_disk: MeshInstance3D = MeshInstance3D.new()
	var shore_mesh: CylinderMesh = CylinderMesh.new()
	shore_mesh.top_radius = 26.0
	shore_mesh.bottom_radius = 27.5
	shore_mesh.height = 0.8
	shore_mesh.radial_segments = 16
	shore_disk.mesh = shore_mesh
	shore_disk.position = Vector3(0.0, -0.42, 0.0)
	var shore_mat: StandardMaterial3D = StandardMaterial3D.new()
	shore_mat.albedo_color = Color(0.63, 0.58, 0.44)
	shore_mat.roughness = 1.0
	shore_disk.material_override = shore_mat
	water_root.add_child(shore_disk)

	water_mesh = MeshInstance3D.new()
	var pond_mesh: PlaneMesh = PlaneMesh.new()
	pond_mesh.size = Vector2(42.0, 42.0)
	water_mesh.mesh = pond_mesh
	water_mesh.position = Vector3(0.0, 0.02, 0.0)
	water_mesh.material_override = _create_water_material()
	water_root.add_child(water_mesh)

	water_area = Area3D.new()
	water_area.name = "WaterArea"
	water_area.collision_layer = WATER_LAYER
	water_area.collision_mask = 0
	water_area.monitoring = false
	water_area.add_to_group("cast_water")
	water_area.position = Vector3(0.0, 0.02, 0.0)
	var cast_shape: CollisionShape3D = CollisionShape3D.new()
	var cast_box: BoxShape3D = BoxShape3D.new()
	cast_box.size = Vector3(42.0, 1.6, 42.0)
	cast_shape.shape = cast_box
	water_area.add_child(cast_shape)
	water_root.add_child(water_area)

	cast_line = MeshInstance3D.new()
	cast_line.name = "CastLine"
	var line_mesh: CylinderMesh = CylinderMesh.new()
	line_mesh.top_radius = 0.004
	line_mesh.bottom_radius = 0.004
	line_mesh.height = 1.0
	line_mesh.radial_segments = 6
	cast_line.mesh = line_mesh
	var line_mat: StandardMaterial3D = StandardMaterial3D.new()
	line_mat.albedo_color = Color(0.93, 0.98, 1.0)
	line_mat.roughness = 0.2
	line_mat.metallic = 0.0
	cast_line.material_override = line_mat
	cast_line.visible = false
	add_child(cast_line)

	bobber = MeshInstance3D.new()
	bobber.name = "Bobber"
	var bobber_mesh: SphereMesh = SphereMesh.new()
	bobber_mesh.radius = 0.08
	bobber_mesh.height = 0.16
	bobber_mesh.radial_segments = 8
	bobber_mesh.rings = 4
	bobber.mesh = bobber_mesh
	var bobber_mat: StandardMaterial3D = StandardMaterial3D.new()
	bobber_mat.albedo_color = Color(0.95, 0.30, 0.20)
	bobber_mat.roughness = 0.6
	bobber.material_override = bobber_mat
	bobber.visible = false
	add_child(bobber)

func _create_water_material() -> ShaderMaterial:
	var shader := Shader.new()
	shader.code = """
shader_type spatial;
render_mode blend_mix, depth_draw_alpha_prepass, cull_disabled, unshaded;

uniform vec4 shallow_color : source_color = vec4(0.56, 0.93, 1.0, 0.48);
uniform vec4 deep_color : source_color = vec4(0.10, 0.46, 0.72, 0.72);
uniform vec4 edge_foam_color : source_color = vec4(0.84, 0.98, 1.0, 0.78);
uniform float wave_height = 0.07;
uniform float wave_speed = 1.35;
uniform float ripple_density = 15.0;

void vertex() {
	float t = TIME * wave_speed;
	float wave_a = sin(UV.x * 20.0 + t * 1.5);
	float wave_b = cos(UV.y * 16.0 - t * 1.2);
	float wave_c = sin((UV.x + UV.y) * 10.0 + t * 1.8);
	VERTEX.y += (wave_a + wave_b + wave_c) * wave_height * 0.333;
}

void fragment() {
	float t = TIME * wave_speed;
	float dist = distance(UV, vec2(0.5));
	float shore_blend = smoothstep(0.02, 0.65, dist);
	vec3 base_color = mix(deep_color.rgb, shallow_color.rgb, shore_blend);

	float ripple_a = sin((UV.x + UV.y) * ripple_density + t * 3.1);
	float ripple_b = cos((UV.x - UV.y) * (ripple_density * 0.75) - t * 2.4);
	float ripple = ripple_a * 0.6 + ripple_b * 0.4;
	float ripple_mask = smoothstep(0.28, 0.88, ripple * 0.5 + 0.5);
	float stripe = smoothstep(0.88, 0.97, ripple * 0.5 + 0.5);

	float shore_ring = smoothstep(0.74, 0.96, dist);
	float foam = shore_ring * smoothstep(0.45, 0.95, ripple_mask);
	base_color += vec3(0.10, 0.20, 0.26) * ripple_mask;
	base_color += vec3(0.16, 0.28, 0.34) * stripe;
	base_color = mix(base_color, edge_foam_color.rgb, foam * 0.7);

	ALBEDO = base_color;
	ALPHA = clamp(mix(deep_color.a, shallow_color.a, shore_blend) + foam * 0.18, 0.24, 0.72);
}
"""

	var material := ShaderMaterial.new()
	material.shader = shader
	return material

func _spawn_lowpoly_props() -> void:
	var rock_positions: Array[Vector3] = [
		Vector3(16.0, 0.0, 15.0),
		Vector3(-14.0, 0.0, 18.0),
		Vector3(20.0, 0.0, -10.0),
		Vector3(-18.0, 0.0, -12.0),
		Vector3(8.0, 0.0, -20.0),
		Vector3(-6.0, 0.0, 21.0),
	]

	for i in rock_positions.size():
		var rock: MeshInstance3D = MeshInstance3D.new()
		var rock_mesh: BoxMesh = BoxMesh.new()
		rock_mesh.size = Vector3(2.5 + i * 0.2, 1.0 + float(i % 3) * 0.35, 2.0 + float(i % 2) * 0.45)
		rock.mesh = rock_mesh
		rock.position = rock_positions[i] + Vector3(0.0, rock_mesh.size.y * 0.5 - 0.05, 0.0)
		rock.rotation_degrees.y = 15.0 + i * 27.0
		var rock_mat: StandardMaterial3D = StandardMaterial3D.new()
		rock_mat.albedo_color = Color(0.45 + float(i % 2) * 0.05, 0.43, 0.40)
		rock_mat.roughness = 1.0
		rock.material_override = rock_mat
		add_child(rock)

	var tree_positions: Array[Vector3] = [
		Vector3(23.0, 0.0, 8.0),
		Vector3(-23.0, 0.0, 6.0),
		Vector3(21.0, 0.0, -14.0),
		Vector3(-21.0, 0.0, -16.0),
	]

	for p in tree_positions:
		_spawn_tree(p)

func _spawn_tree(pos: Vector3) -> void:
	var trunk: MeshInstance3D = MeshInstance3D.new()
	var trunk_mesh: CylinderMesh = CylinderMesh.new()
	trunk_mesh.top_radius = 0.18
	trunk_mesh.bottom_radius = 0.22
	trunk_mesh.height = 2.4
	trunk_mesh.radial_segments = 6
	trunk.mesh = trunk_mesh
	trunk.position = pos + Vector3(0.0, 1.2, 0.0)
	var trunk_mat: StandardMaterial3D = StandardMaterial3D.new()
	trunk_mat.albedo_color = Color(0.35, 0.25, 0.18)
	trunk_mat.roughness = 1.0
	trunk.material_override = trunk_mat
	add_child(trunk)

	var canopy: MeshInstance3D = MeshInstance3D.new()
	var canopy_mesh: SphereMesh = SphereMesh.new()
	canopy_mesh.radius = 1.35
	canopy_mesh.height = 2.4
	canopy_mesh.radial_segments = 7
	canopy_mesh.rings = 4
	canopy.mesh = canopy_mesh
	canopy.position = pos + Vector3(0.0, 3.0, 0.0)
	var canopy_mat: StandardMaterial3D = StandardMaterial3D.new()
	canopy_mat.albedo_color = Color(0.25, 0.58, 0.31)
	canopy_mat.roughness = 1.0
	canopy.material_override = canopy_mat
	add_child(canopy)

func _build_hud() -> void:
	var layer: CanvasLayer = CanvasLayer.new()
	layer.layer = 20
	add_child(layer)

	hud_root = Control.new()
	hud_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	hud_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(hud_root)

	hud_crosshair = Label.new()
	hud_crosshair.text = "+"
	hud_crosshair.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hud_crosshair.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	hud_crosshair.anchor_left = 0.5
	hud_crosshair.anchor_right = 0.5
	hud_crosshair.anchor_top = 0.5
	hud_crosshair.anchor_bottom = 0.5
	hud_crosshair.offset_left = -12
	hud_crosshair.offset_right = 12
	hud_crosshair.offset_top = -16
	hud_crosshair.offset_bottom = 16
	hud_crosshair.add_theme_font_size_override("font_size", 26)
	hud_root.add_child(hud_crosshair)

	hud_fishing_panel = PanelContainer.new()
	hud_fishing_panel.anchor_left = 0.0
	hud_fishing_panel.anchor_right = 0.0
	hud_fishing_panel.anchor_top = 0.0
	hud_fishing_panel.anchor_bottom = 0.0
	hud_fishing_panel.offset_left = 18
	hud_fishing_panel.offset_right = 310
	hud_fishing_panel.offset_top = 18
	hud_fishing_panel.offset_bottom = 168
	hud_root.add_child(hud_fishing_panel)

	var fishing_style: StyleBoxFlat = StyleBoxFlat.new()
	fishing_style.bg_color = Color(0.05, 0.10, 0.15, 0.84)
	fishing_style.border_color = Color(0.28, 0.60, 0.66, 0.9)
	fishing_style.border_width_left = 2
	fishing_style.border_width_right = 2
	fishing_style.border_width_top = 2
	fishing_style.border_width_bottom = 2
	fishing_style.corner_radius_top_left = 10
	fishing_style.corner_radius_top_right = 10
	fishing_style.corner_radius_bottom_left = 10
	fishing_style.corner_radius_bottom_right = 10
	hud_fishing_panel.add_theme_stylebox_override("panel", fishing_style)

	var fishing_column: VBoxContainer = VBoxContainer.new()
	fishing_column.add_theme_constant_override("separation", 5)
	hud_fishing_panel.add_child(fishing_column)

	hud_fishing_title = Label.new()
	hud_fishing_title.text = "Fishing"
	hud_fishing_title.add_theme_font_size_override("font_size", 24)
	fishing_column.add_child(hud_fishing_title)

	fishing_level_label = Label.new()
	fishing_level_label.text = "Level 1"
	fishing_level_label.add_theme_font_size_override("font_size", 18)
	fishing_column.add_child(fishing_level_label)

	fishing_xp_label = Label.new()
	fishing_xp_label.text = "0 / 100 XP"
	fishing_column.add_child(fishing_xp_label)

	fishing_xp_bar = ProgressBar.new()
	fishing_xp_bar.min_value = 0
	fishing_xp_bar.max_value = 100
	fishing_xp_bar.value = 0
	fishing_xp_bar.show_percentage = false
	fishing_xp_bar.custom_minimum_size = Vector2(0, 14)
	fishing_column.add_child(fishing_xp_bar)

	hud_inventory_panel = PanelContainer.new()
	hud_inventory_panel.anchor_left = 1.0
	hud_inventory_panel.anchor_right = 1.0
	hud_inventory_panel.anchor_top = 0.0
	hud_inventory_panel.anchor_bottom = 0.0
	hud_inventory_panel.offset_left = -300
	hud_inventory_panel.offset_right = -18
	hud_inventory_panel.offset_top = 18
	hud_inventory_panel.offset_bottom = 250
	hud_root.add_child(hud_inventory_panel)

	var panel_style: StyleBoxFlat = StyleBoxFlat.new()
	panel_style.bg_color = Color(0.05, 0.10, 0.15, 0.82)
	panel_style.border_color = Color(0.24, 0.52, 0.62, 0.9)
	panel_style.border_width_left = 2
	panel_style.border_width_right = 2
	panel_style.border_width_top = 2
	panel_style.border_width_bottom = 2
	panel_style.corner_radius_top_left = 10
	panel_style.corner_radius_top_right = 10
	panel_style.corner_radius_bottom_left = 10
	panel_style.corner_radius_bottom_right = 10
	hud_inventory_panel.add_theme_stylebox_override("panel", panel_style)

	var column: VBoxContainer = VBoxContainer.new()
	column.add_theme_constant_override("separation", 4)
	hud_inventory_panel.add_child(column)

	hud_inventory_title = Label.new()
	hud_inventory_title.text = "Catch Inventory"
	hud_inventory_title.add_theme_font_size_override("font_size", 20)
	column.add_child(hud_inventory_title)

	for fish_name in FISH_TYPES:
		var row: HBoxContainer = HBoxContainer.new()
		var fish_label: Label = Label.new()
		fish_label.text = fish_name
		fish_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		inventory_name_labels.append(fish_label)
		var count_label: Label = Label.new()
		count_label.text = "0"
		count_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		row.add_child(fish_label)
		row.add_child(count_label)
		column.add_child(row)
		inventory_labels[fish_name] = count_label

	var total_row: HBoxContainer = HBoxContainer.new()
	var total_title: Label = Label.new()
	total_title.text = "Total"
	total_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	total_label = Label.new()
	total_label.text = "0"
	total_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	total_row.add_child(total_title)
	total_row.add_child(total_label)
	column.add_child(total_row)

	xp_drop_label = Label.new()
	xp_drop_label.anchor_left = 0.5
	xp_drop_label.anchor_right = 0.5
	xp_drop_label.anchor_top = 1.0
	xp_drop_label.anchor_bottom = 1.0
	xp_drop_label.offset_left = -120
	xp_drop_label.offset_right = 120
	xp_drop_label.offset_top = xp_drop_base_top
	xp_drop_label.offset_bottom = xp_drop_base_bottom
	xp_drop_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	xp_drop_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	xp_drop_label.add_theme_font_size_override("font_size", 24)
	xp_drop_label.text = "+0 XP"
	xp_drop_label.visible = false
	hud_root.add_child(xp_drop_label)

	status_label = Label.new()
	status_label.anchor_left = 0.5
	status_label.anchor_right = 0.5
	status_label.anchor_top = 1.0
	status_label.anchor_bottom = 1.0
	status_label.offset_left = -260
	status_label.offset_right = 260
	status_label.offset_top = -66
	status_label.offset_bottom = -30
	status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	status_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	status_label.add_theme_font_size_override("font_size", 18)
	hud_root.add_child(status_label)

	_apply_hud_layout()

func _apply_hud_layout() -> void:
	if not hud_root:
		return

	var window: Window = get_window()
	var size: Vector2i = window.size
	if size.x <= 0 or size.y <= 0:
		return

	var is_portrait: bool = size.y > size.x
	var shortest: int = min(size.x, size.y)
	var mobile: bool = shortest <= 900
	var font_scale: float = 1.0
	if shortest <= 420:
		font_scale = 1.45
	elif shortest <= 520:
		font_scale = 1.30
	elif shortest <= 700:
		font_scale = 1.18
	elif shortest >= 1500:
		font_scale = 1.10

	var pad: float = 14.0 if mobile else 18.0
	var panel_gap: float = 10.0 if mobile else 14.0
	var fishing_w: float = clamp(size.x * 0.32, 260.0, 410.0)
	var inv_w: float = clamp(size.x * 0.30, 250.0, 380.0)
	var fishing_h: float = 170.0
	var inventory_h: float = 262.0

	if is_portrait:
		hud_crosshair.visible = false
		hud_fishing_panel.anchor_left = 0.0
		hud_fishing_panel.anchor_right = 1.0
		hud_fishing_panel.offset_left = pad
		hud_fishing_panel.offset_right = -pad
		hud_fishing_panel.offset_top = pad
		hud_fishing_panel.offset_bottom = pad + 196.0

		hud_inventory_panel.anchor_left = 0.0
		hud_inventory_panel.anchor_right = 1.0
		hud_inventory_panel.offset_left = pad
		hud_inventory_panel.offset_right = -pad
		hud_inventory_panel.offset_top = hud_fishing_panel.offset_bottom + panel_gap
		hud_inventory_panel.offset_bottom = hud_inventory_panel.offset_top + 246.0
	else:
		hud_crosshair.visible = true
		hud_fishing_panel.anchor_left = 0.0
		hud_fishing_panel.anchor_right = 0.0
		hud_fishing_panel.offset_left = pad
		hud_fishing_panel.offset_right = pad + fishing_w
		hud_fishing_panel.offset_top = pad
		hud_fishing_panel.offset_bottom = pad + fishing_h

		hud_inventory_panel.anchor_left = 1.0
		hud_inventory_panel.anchor_right = 1.0
		hud_inventory_panel.offset_left = -(inv_w + pad)
		hud_inventory_panel.offset_right = -pad
		hud_inventory_panel.offset_top = pad
		hud_inventory_panel.offset_bottom = pad + inventory_h

	var title_size: int = int(round(24.0 * font_scale))
	var level_size: int = int(round(18.0 * font_scale))
	var body_size: int = int(round(16.0 * font_scale))
	var small_size: int = int(round(15.0 * font_scale))
	var xp_drop_size: int = int(round(24.0 * font_scale))
	var status_size: int = int(round(18.0 * font_scale))

	hud_fishing_title.add_theme_font_size_override("font_size", title_size)
	if hud_inventory_title:
		hud_inventory_title.add_theme_font_size_override("font_size", int(round(20.0 * font_scale)))
	if fishing_level_label:
		fishing_level_label.add_theme_font_size_override("font_size", level_size)
	if fishing_xp_label:
		fishing_xp_label.add_theme_font_size_override("font_size", body_size)
	if total_label:
		total_label.add_theme_font_size_override("font_size", body_size)
	if fishing_xp_bar:
		fishing_xp_bar.custom_minimum_size = Vector2(0, 16.0 if mobile else 14.0)

	for fish_label in inventory_name_labels:
		fish_label.add_theme_font_size_override("font_size", small_size)
	for count_label in inventory_labels.values():
		var count_text: Label = count_label as Label
		if count_text:
			count_text.add_theme_font_size_override("font_size", small_size)

	xp_drop_label.add_theme_font_size_override("font_size", xp_drop_size)
	xp_drop_label.offset_left = -160.0 if mobile else -120.0
	xp_drop_label.offset_right = 160.0 if mobile else 120.0
	xp_drop_base_top = -136.0 if mobile else -118.0
	xp_drop_base_bottom = -92.0 if mobile else -82.0
	if xp_drop_timer <= 0.0:
		xp_drop_label.offset_top = xp_drop_base_top
		xp_drop_label.offset_bottom = xp_drop_base_bottom

	status_label.add_theme_font_size_override("font_size", status_size)
	status_label.offset_left = -360.0 if mobile else -280.0
	status_label.offset_right = 360.0 if mobile else 280.0
	status_label.offset_top = -88.0 if mobile else -66.0
	status_label.offset_bottom = -40.0 if mobile else -30.0

func _try_cast() -> void:
	if cast_state == 1:
		_hide_cast_visuals()
		cast_state = 0
		_set_status("Hold right click or Tab: look mode • Tap/click water: cast")
		return

	var screen_point: Vector2 = get_viewport().get_visible_rect().size * 0.5
	if Input.get_mouse_mode() != Input.MOUSE_MODE_CAPTURED:
		screen_point = get_viewport().get_mouse_position()

	_try_cast_from_screen(screen_point)

func _try_cast_from_screen(screen_point: Vector2) -> void:
	if cast_state == 1:
		_hide_cast_visuals()
		cast_state = 0
		_set_status("Hold right click or Tab: look mode • Tap/click water: cast")
		return

	var ray_origin: Vector3 = camera.project_ray_origin(screen_point)
	var ray_direction: Vector3 = camera.project_ray_normal(screen_point)

	var params: PhysicsRayQueryParameters3D = PhysicsRayQueryParameters3D.create(ray_origin, ray_origin + ray_direction * 500.0)
	params.collide_with_areas = true
	params.collide_with_bodies = false
	params.collision_mask = WATER_LAYER

	var hit: Dictionary = get_world_3d().direct_space_state.intersect_ray(params)
	if not hit.is_empty() and hit.has("position"):
		var hit_pos: Vector3 = hit["position"]
		_start_cast(hit_pos)
		return

	# Touch/click fallback for mobile/web scaling cases:
	# intersect the water plane and ensure point is inside pond bounds.
	var plane_y: float = water_mesh.global_position.y if water_mesh else 0.02
	var ray_to_plane: float = (plane_y - ray_origin.y) / ray_direction.y if abs(ray_direction.y) > 0.0001 else -1.0
	if ray_to_plane <= 0.0:
		_set_status("Cast on water")
		return
	var plane_hit: Vector3 = ray_origin + ray_direction * ray_to_plane
	var local_hit: Vector3 = plane_hit - water_area.global_position
	if abs(local_hit.x) <= 21.0 and abs(local_hit.z) <= 21.0:
		_start_cast(plane_hit)
		return

	_set_status("Cast on water")

func _start_cast(point: Vector3) -> void:
	last_cast_point = point
	cast_state = 1
	cast_timer = randf_range(1.0, 2.0)
	bobber_time = 0.0
	_place_bobber(point)
	if pole and pole.has_method("play_cast_kick"):
		pole.call("play_cast_kick")
	_set_status("Fishing... wait for bites • Tap/click again to reel in")

func _place_bobber(point: Vector3) -> void:
	if not bobber:
		return
	bobber.visible = true
	bobber.global_position = point + Vector3(0.0, 0.08, 0.0)
	if cast_line:
		cast_line.visible = true
	_update_cast_line()

func _hide_cast_visuals() -> void:
	if bobber:
		bobber.visible = false
	if cast_line:
		cast_line.visible = false

func _update_bobber_visual(delta: float) -> void:
	if not bobber or not bobber.visible:
		return

	var float_wave: float = sin(bobber_time * 6.0) * 0.028
	var lift: float = 0.08 + float_wave
	lift += sin(bobber_time * 12.0) * 0.008
	bobber.global_position = last_cast_point + Vector3(0.0, lift, 0.0)
	bobber.rotate_y(delta * 1.8)

func _update_cast_line() -> void:
	if not cast_line or not bobber or not bobber.visible:
		return

	var tip: Vector3 = _get_pole_tip_world_position()
	var target: Vector3 = bobber.global_position
	var diff: Vector3 = target - tip
	var distance: float = diff.length()
	if distance < 0.02:
		cast_line.visible = false
		return

	cast_line.visible = true
	var up: Vector3 = diff.normalized()
	var tangent: Vector3 = up.cross(Vector3.FORWARD)
	if tangent.length() < 0.001:
		tangent = up.cross(Vector3.RIGHT)
	tangent = tangent.normalized()
	var binormal: Vector3 = tangent.cross(up).normalized()

	cast_line.global_basis = Basis(tangent, up, binormal)
	cast_line.global_position = tip + diff * 0.5
	cast_line.scale = Vector3(1.0, distance, 1.0)

func _get_pole_tip_world_position() -> Vector3:
	if pole:
		var rod: MeshInstance3D = pole.get_node_or_null("Rod") as MeshInstance3D
		if rod:
			return rod.to_global(Vector3(0.0, 0.0, -0.9))
	return camera.global_position + camera.global_basis * Vector3(0.2, -0.2, -0.8)

func _roll_fish() -> String:
	var r: float = randf()
	if r < 0.38:
		return "Minnow"
	if r < 0.68:
		return "Trout"
	if r < 0.88:
		return "Bass"
	if r < 0.98:
		return "Salmon"
	return "Golden Koi"

func _get_fish_xp(fish_name: String) -> int:
	return int(FISH_XP.get(fish_name, 10))

func _xp_needed_for_level(level: int) -> int:
	return 90 + (level - 1) * 28

func _add_fishing_xp(amount: int) -> int:
	var levels_gained: int = 0
	fishing_xp += amount
	var needed: int = _xp_needed_for_level(fishing_level)
	while fishing_xp >= needed:
		fishing_xp -= needed
		fishing_level += 1
		levels_gained += 1
		needed = _xp_needed_for_level(fishing_level)
	_update_fishing_ui()
	return levels_gained

func _update_fishing_ui() -> void:
	var needed: int = _xp_needed_for_level(fishing_level)
	if fishing_level_label:
		fishing_level_label.text = "Level %d" % fishing_level
	if fishing_xp_label:
		fishing_xp_label.text = "%d / %d XP" % [fishing_xp, needed]
	if fishing_xp_bar:
		fishing_xp_bar.max_value = needed
		fishing_xp_bar.value = fishing_xp

func _show_xp_drop(amount: int) -> void:
	if xp_drop_label:
		xp_drop_label.text = "+%d XP" % amount
		xp_drop_label.modulate = Color(0.62, 0.94, 1.0, 1.0)
		xp_drop_label.offset_top = xp_drop_base_top
		xp_drop_label.offset_bottom = xp_drop_base_bottom
		xp_drop_label.visible = true
	xp_drop_timer = 1.2

func _add_fish(fish_name: String) -> void:
	if not inventory.has(fish_name):
		inventory[fish_name] = 0
	inventory[fish_name] = int(inventory[fish_name]) + 1
	_update_inventory_ui()

func _update_inventory_ui() -> void:
	var total: int = 0
	for fish_name in FISH_TYPES:
		var fish_count: int = int(inventory.get(fish_name, 0))
		total += fish_count
		if inventory_labels.has(fish_name):
			var label: Label = inventory_labels[fish_name]
			label.text = str(fish_count)
	if total_label:
		total_label.text = str(total)

func _set_status(text_value: String) -> void:
	if status_label:
		status_label.text = text_value
