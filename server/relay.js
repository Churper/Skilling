const { WebSocketServer } = require("ws");
const crypto = require("node:crypto");

const port = Number(process.env.PORT || 8081);
const wss = new WebSocketServer({ port });

const clients = new Map(); // ws -> { id, room, name, color, state }
const rooms = new Map(); // room -> Set<ws>

function randomId() {
  return crypto.randomBytes(8).toString("hex");
}

function getRoomSet(room) {
  let set = rooms.get(room);
  if (!set) {
    set = new Set();
    rooms.set(room, set);
  }
  return set;
}

function removeFromRoom(ws) {
  const meta = clients.get(ws);
  if (!meta || !meta.room) return;
  const set = rooms.get(meta.room);
  if (!set) return;
  set.delete(ws);
  if (set.size <= 0) rooms.delete(meta.room);
}

function send(ws, payload) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(payload));
}

function broadcast(room, payload, except = null) {
  const set = rooms.get(room);
  if (!set) return;
  for (const ws of set) {
    if (except && ws === except) continue;
    send(ws, payload);
  }
}

function roomSnapshot(room, except = null) {
  const out = [];
  const set = rooms.get(room);
  if (!set) return out;
  for (const ws of set) {
    if (except && ws === except) continue;
    const meta = clients.get(ws);
    if (!meta) continue;
    out.push({
      id: meta.id,
      name: meta.name,
      color: meta.color,
      state: meta.state || null,
    });
  }
  return out;
}

function sanitizeName(value) {
  if (typeof value !== "string") return "Player";
  const trimmed = value.trim();
  if (!trimmed) return "Player";
  return trimmed.slice(0, 24);
}

function sanitizeRoom(value) {
  if (typeof value !== "string") return "main";
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "main";
  return trimmed.slice(0, 32);
}

function sanitizeColor(value) {
  if (typeof value !== "string") return "#58df78";
  const trimmed = value.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(trimmed)) return "#58df78";
  return trimmed;
}

wss.on("connection", (ws) => {
  clients.set(ws, {
    id: randomId(),
    room: null,
    name: "Player",
    color: "#58df78",
    state: null,
  });

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== "string") return;

    const meta = clients.get(ws);
    if (!meta) return;

    if (msg.type === "hello") {
      removeFromRoom(ws);
      meta.room = sanitizeRoom(msg.room);
      meta.name = sanitizeName(msg.name);
      meta.color = sanitizeColor(msg.color);
      meta.state = null;
      getRoomSet(meta.room).add(ws);

      send(ws, {
        type: "welcome",
        id: meta.id,
        room: meta.room,
        peers: roomSnapshot(meta.room, ws),
      });
      broadcast(
        meta.room,
        {
          type: "peer_join",
          peer: {
            id: meta.id,
            name: meta.name,
            color: meta.color,
            state: meta.state,
          },
        },
        ws
      );
      return;
    }

    if (!meta.room) return;

    if (msg.type === "profile") {
      meta.name = sanitizeName(msg.name || meta.name);
      meta.color = sanitizeColor(msg.color || meta.color);
      broadcast(
        meta.room,
        {
          type: "peer_state",
          id: meta.id,
          name: meta.name,
          color: meta.color,
          state: meta.state,
        },
        ws
      );
      return;
    }

    if (msg.type === "state") {
      const state = msg.state || {};
      meta.state = {
        x: Number(state.x) || 0,
        z: Number(state.z) || 0,
        yaw: Number(state.yaw) || 0,
        moving: !!state.moving,
        gathering: !!state.gathering,
        tool: typeof state.tool === "string" ? state.tool : "fishing",
      };
      broadcast(
        meta.room,
        {
          type: "peer_state",
          id: meta.id,
          name: meta.name,
          color: meta.color,
          state: meta.state,
        },
        ws
      );
    }
  });

  ws.on("close", () => {
    const meta = clients.get(ws);
    if (!meta) return;
    removeFromRoom(ws);
    if (meta.room) {
      broadcast(meta.room, { type: "peer_leave", id: meta.id }, ws);
    }
    clients.delete(ws);
  });
});

console.log(`[skilling-relay] listening on ws://localhost:${port}`);
