# Skilling Engine Architecture

## Core split

- `docs/main.js`
  - Runtime orchestration only: scene boot, input wiring, interaction routing, animation loop.
- `docs/game/config.js`
  - Static tuning/config values (tools, skills, economy prices, bag/build targets).
- `docs/game/systems/bagSystem.js`
  - Bag slot state, inventory counts, bank transfer, selling, and filtered consumption.
- `docs/game/systems/constructionProgress.js`
  - House progression state machine (stock, missing materials, progress %, completion).
- `docs/game/systems/progression.js`
  - XP/level and gather fail chance formulas.
- `docs/game/systems/remotePlayers.js`
  - Remote avatar lifecycle and interpolation for online peers.
- `docs/game/net/realtimeClient.js`
  - Browser realtime transport (WebSocket client, reconnect, state throttling).
- `docs/game/world.js`
  - All world mesh generation and service/resource nodes.
- `docs/game/entities.js`
  - Player visuals and marker entities.
- `docs/game/input.js`
  - Pointer/keyboard input translation to movement and interaction events.
- `docs/game/ui.js`
  - UI rendering, panels, and callbacks.

## Rules for maintainability

- Put formulas and constants in `config.js` or `systems/*`, not inside render loop code.
- Keep `main.js` focused on flow control, not data structure internals.
- Add new gameplay features by:
  1. Extending config.
  2. Adding/updating one `systems/*` module.
  3. Wiring that module in `main.js`.
