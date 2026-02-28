# Skilling — Browser MMO (Three.js)

A toon-shaded isometric browser game inspired by RuneScape/Old School RuneScape. Players gather resources, train skills, craft items, fight slimes, and interact online.

## Quick Start
- **Play**: Open `docs/index.html` via any HTTP server (e.g. `npx serve docs` or GitHub Pages)
- **Editor**: `docs/editor.html` — standalone tile editor for terrain
- **Server**: `cd server && npm start` — WebSocket relay for multiplayer

## Project Structure

```
docs/                       # All game files (served via GitHub Pages)
  index.html                # Entry point — canvas + full UI markup
  main.js                   # Game loop, input wiring, gathering, combat, cave, emotes, nametags
  style.css                 # All UI styling (toon aesthetic, responsive, mobile)
  tilemap.json              # Exported tile placements (loaded by editor)
  editor.html               # Standalone tile map editor

  game/
    config.js               # Static data: tools, skills, items, prices, slime colors, upgrades
    scene.js                # Three.js renderer, camera, OrbitControls, bloom postprocessing
    entities.js             # Player slime mesh, tool models, animation, remote player avatars
    input.js                # Click/touch raycasting, keyboard, interaction detection
    ui.js                   # UI panel management: inventory, bank, skills, store, emotes, combat
    world.js                # Scene assembly: sky, terrain, buildings, trees, rocks, cave entrance
    terrainHeight.js        # Height system: river, hills, beach, cliffs, path/village flattening
    terrainLayout.js        # Terrain mesh builder, bridge, dock, fences, props, stepping stones
    tilesetRules.json       # Tile connection rules for editor

    systems/
      bagSystem.js          # Inventory slots, bank transfer, selling, item consumption
      constructionProgress.js # House building state machine
      progression.js        # XP/level formulas, gather fail chance
      remotePlayers.js      # Remote avatar lifecycle, position interpolation

    net/
      realtimeClient.js     # WebSocket + BroadcastChannel fallback, reconnect, state throttling

  models/                   # GLTF/GLB 3D assets
    terrain/                # Terrain tiles: Grass, Sand, Hill, Cliff, Water, Path, Props, Bridge, Dock, Fence
    *.gltf + *.bin          # Character models: trees, rocks, bushes, weapons

server/
  relay.js                  # Node.js WebSocket relay for multiplayer sync
```

## Key Constants (terrainHeight.js)
- `TILE_S = 2` — world units per tile
- `WATER_Y = 0.00`, `GRASS_Y = 0.40`, `HILL_Y = 2.40`, `PATH_Y = 0.00`
- Grid bounds: `GX_MIN=-24..GX_MAX=24`, `GZ_MIN=-22..GZ_MAX=26`
- Compass: North = +z, South = -z, East = +x, West = -x

## World Layout
- **Village** center: (0, -32) — Bank (-7,-32), Store (0,-32.5), Blacksmith (7,-32)
- **Training yard**: (-22, -34) — combat dummies
- **Construction site**: (18, -35) — house building
- **River**: Runs north-south through center, curves east near z=0
- **Bridge**: z=8, spans x=-4 to x=4 across river
- **Dock**: x=40, z=-16 on beach (fishing)
- **Beach**: Southeast corner (x>20, z<10), slopes to ocean
- **Hills**: NE (24,24) and NW (-26,22), radius 16
- **Cliffs**: North (z>40), West (x<-40), South (z<-38)
- **Volcano cave entrance**: NE hill area

## Architecture Notes
- **No bundler** — ES modules loaded directly via import maps in index.html
- **Three.js** loaded from CDN (esm.sh)
- **Vertex-colored terrain mesh** — no texture files for ground, colors computed per-vertex
- **Toon shading** via MeshToonMaterial throughout
- **Ground raycasting** for player height — raycast down against `ground` group
- **Bridge/dock walkability** — invisible BoxGeometry meshes added to `ground` group
- **Terrain triangles removed** under bridge/dock so ground doesn't show through

## Important Rules
- Be token-efficient. Don't over-read/over-plan. Just write code.
- NEVER overwrite user's manual tile placements — only add to empty cells
- Always push after changes unless told otherwise
- The `docs/` folder is the deployable game — keep it self-contained
- Models in `docs/models/` are binary assets, don't modify them
