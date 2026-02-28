function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function randomName() {
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `Slime${suffix}`;
}

function randomId() {
  return `p_${Math.random().toString(36).slice(2, 10)}`;
}

function getStorage() {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch {
    // ignore
  }
  return null;
}

export function resolveOnlineConfig() {
  if (typeof window === "undefined") {
    return { wsUrl: "", room: "main", name: "Player" };
  }

  const params = new URLSearchParams(window.location.search);
  const host = window.location.hostname;
  const storage = getStorage();
  const storedWs = storage?.getItem("skilling_ws_url") || "";
  const storedRoom = storage?.getItem("skilling_room") || "";
  const storedName = storage?.getItem("skilling_name") || "";
  const defaultWs = host === "localhost" || host === "127.0.0.1" ? "ws://localhost:8081" : (storedWs || "wss://skilling.onrender.com");

  return {
    wsUrl: params.get("ws") || window.SKILLING_WS_URL || defaultWs,
    room: params.get("room") || window.SKILLING_ROOM || storedRoom || "main",
    name: params.get("name") || window.SKILLING_NAME || storedName || randomName(),
  };
}

export function createRealtimeClient({
  wsUrl,
  room = "main",
  name = "Player",
  color = "#58df78",
  sendIntervalMs = 80,
  reconnectMs = 2000,
  fallbackLocal = true,
  onConnected = null,
  onDisconnected = null,
  onWelcome = null,
  onPeerJoin = null,
  onPeerLeave = null,
  onPeerState = null,
  onPeerEmote = null,
  onServerMessage = null,
} = {}) {
  let ws = null;
  let channel = null;
  let connected = false;
  let closedByUser = false;
  let localId = randomId();
  let usingLocalTransport = false;
  let queuedState = null;
  let localState = null;
  let lastStateSentAt = 0;
  let flushTimer = null;
  const localPeers = new Map();
  const storage = getStorage();

  function persistIdentity() {
    try {
      storage?.setItem("skilling_room", room);
      storage?.setItem("skilling_name", name);
      if (wsUrl) storage?.setItem("skilling_ws_url", wsUrl);
    } catch {
      // ignore
    }
  }

  function clearFlushTimer() {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
  }

  function sendRaw(payload) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(payload));
    return true;
  }

  function scheduleFlush(delay) {
    clearFlushTimer();
    flushTimer = setTimeout(() => {
      flushTimer = null;
      if (!queuedState) return;
      const now = Date.now();
      if (now - lastStateSentAt < sendIntervalMs) {
        scheduleFlush(sendIntervalMs - (now - lastStateSentAt));
        return;
      }
      if (sendRaw({ type: "state", state: queuedState })) {
        lastStateSentAt = now;
        queuedState = null;
      }
    }, Math.max(0, delay));
  }

  function flushStateNow() {
    if (!queuedState) return;
    const now = Date.now();
    const elapsed = now - lastStateSentAt;
    if (elapsed < sendIntervalMs) {
      scheduleFlush(sendIntervalMs - elapsed);
      return;
    }
    if (sendRaw({ type: "state", state: queuedState })) {
      lastStateSentAt = now;
      queuedState = null;
    }
  }

  function handleMessage(event) {
    const msg = safeJsonParse(event.data);
    if (!msg || typeof msg.type !== "string") return;

    if (msg.type === "welcome") {
      localId = msg.id || null;
      if (typeof onWelcome === "function") onWelcome(msg);
      if (typeof onConnected === "function") onConnected({ id: localId, room: msg.room || room });
      persistIdentity();
      return;
    }
    if (msg.type === "peer_join") {
      if (typeof onPeerJoin === "function") onPeerJoin(msg.peer || null);
      return;
    }
    if (msg.type === "peer_leave") {
      if (typeof onPeerLeave === "function") onPeerLeave(msg.id);
      return;
    }
    if (msg.type === "peer_state") {
      if (msg.id && msg.id === localId) return;
      if (typeof onPeerState === "function") onPeerState(msg);
      return;
    }
    if (msg.type === "peer_emote") {
      if (msg.id && msg.id === localId) return;
      if (typeof onPeerEmote === "function") onPeerEmote(msg);
    }
    if (msg.type === "server_message") {
      if (typeof onServerMessage === "function") onServerMessage(msg);
    }
  }

  function buildPeerStatePayload(id, peer = {}) {
    return {
      id,
      name: peer.name || "Player",
      color: peer.color || "#58df78",
      state: peer.state || null,
    };
  }

  function upsertLocalPeer(id, payload = {}) {
    const prior = localPeers.get(id);
    const next = {
      id,
      name: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : prior?.name || "Player",
      color: typeof payload.color === "string" && payload.color.trim() ? payload.color.trim() : prior?.color || "#58df78",
      state: payload.state || prior?.state || null,
    };
    localPeers.set(id, next);
    if (!prior && typeof onPeerJoin === "function") onPeerJoin(buildPeerStatePayload(id, next));
    return next;
  }

  function postLocal(payload) {
    if (!channel) return;
    channel.postMessage({ ...payload, _from: localId, _room: room, _ts: Date.now() });
  }

  function handleLocalMessage(event) {
    const msg = event?.data;
    if (!msg || typeof msg !== "object") return;
    if (msg._from === localId) return;
    if (msg._room !== room) return;
    const peerId = msg._from;
    if (!peerId) return;

    if (msg.type === "local_hello") {
      const peer = upsertLocalPeer(peerId, { name: msg.name, color: msg.color, state: msg.state || null });
      if (peer.state && typeof onPeerState === "function") {
        onPeerState({ type: "peer_state", id: peerId, name: peer.name, color: peer.color, state: peer.state });
      }
      postLocal({ type: "local_hello_ack", _to: peerId, name, color, state: localState });
      return;
    }

    if (msg.type === "local_hello_ack") {
      if (msg._to && msg._to !== localId) return;
      const peer = upsertLocalPeer(peerId, { name: msg.name, color: msg.color, state: msg.state || null });
      if (peer.state && typeof onPeerState === "function") {
        onPeerState({ type: "peer_state", id: peerId, name: peer.name, color: peer.color, state: peer.state });
      }
      return;
    }

    if (msg.type === "local_state") {
      const peer = upsertLocalPeer(peerId, { state: msg.state || null });
      if (typeof onPeerState === "function") {
        onPeerState({ type: "peer_state", id: peerId, name: peer.name, color: peer.color, state: peer.state });
      }
      return;
    }

    if (msg.type === "local_profile") {
      const peer = upsertLocalPeer(peerId, { name: msg.name, color: msg.color });
      if (typeof onPeerState === "function") {
        onPeerState({ type: "peer_state", id: peerId, name: peer.name, color: peer.color, state: peer.state });
      }
      return;
    }

    if (msg.type === "local_emote") {
      const peer = upsertLocalPeer(peerId);
      if (typeof onPeerEmote === "function") {
        onPeerEmote({ type: "peer_emote", id: peerId, name: peer.name, emoji: msg.emoji || "" });
      }
      return;
    }

    if (msg.type === "local_leave") {
      localPeers.delete(peerId);
      if (typeof onPeerLeave === "function") onPeerLeave(peerId);
    }
  }

  function startLocalTransport() {
    if (usingLocalTransport) return;
    usingLocalTransport = true;
    connected = true;
    localPeers.clear();
    channel = new BroadcastChannel(`skilling-room:${room}`);
    channel.addEventListener("message", handleLocalMessage);
    if (typeof onConnected === "function") onConnected({ id: localId, room, transport: "local" });
    if (typeof onWelcome === "function") onWelcome({ id: localId, room, peers: [] });
    postLocal({ type: "local_hello", name, color, state: localState });
    persistIdentity();
  }

  function stopLocalTransport() {
    if (!usingLocalTransport) return;
    postLocal({ type: "local_leave" });
    if (channel) {
      channel.removeEventListener("message", handleLocalMessage);
      channel.close();
    }
    channel = null;
    usingLocalTransport = false;
    localPeers.clear();
  }

  function connect() {
    if (usingLocalTransport || ws) return;
    closedByUser = false;
    if (!wsUrl) {
      if (fallbackLocal) startLocalTransport();
      return;
    }

    ws = new WebSocket(wsUrl);
    ws.addEventListener("open", () => {
      connected = true;
      sendRaw({ type: "hello", room, name, color });
      flushStateNow();
    });
    ws.addEventListener("message", handleMessage);
    ws.addEventListener("close", () => {
      clearFlushTimer();
      ws = null;
      const hadConnection = connected;
      connected = false;
      if (hadConnection) localId = null;
      if (typeof onDisconnected === "function") onDisconnected({ reconnecting: !closedByUser && !!wsUrl, hadConnection });
      if (!closedByUser && !hadConnection && fallbackLocal) {
        startLocalTransport();
        return;
      }
      if (!closedByUser && wsUrl) {
        setTimeout(connect, reconnectMs);
      }
    });
    ws.addEventListener("error", () => {
      // Close path will handle callbacks/reconnect.
    });
  }

  function disconnect() {
    closedByUser = true;
    clearFlushTimer();
    stopLocalTransport();
    if (ws) ws.close();
    ws = null;
    connected = false;
    localId = randomId();
  }

  function sendState(state) {
    if (usingLocalTransport) {
      localState = state;
      postLocal({ type: "local_state", state });
      return;
    }
    if (!wsUrl) {
      localState = state;
      if (fallbackLocal && !usingLocalTransport) startLocalTransport();
      return;
    }
    queuedState = state;
    flushStateNow();
  }

  function updateProfile(profile = {}) {
    if (typeof profile.name === "string" && profile.name.trim()) name = profile.name.trim();
    if (typeof profile.color === "string" && profile.color.trim()) color = profile.color.trim();
    persistIdentity();
    if (usingLocalTransport) {
      postLocal({ type: "local_profile", name, color });
      return;
    }
    sendRaw({ type: "profile", name, color });
  }

  function sendEmote(emoji) {
    if (typeof emoji !== "string") return;
    const value = emoji.trim();
    if (!value) return;
    if (usingLocalTransport) {
      postLocal({ type: "local_emote", emoji: value });
      return;
    }
    sendRaw({ type: "emote", emoji: value });
  }

  return {
    isEnabled: !!wsUrl || !!fallbackLocal,
    getLocalId: () => localId,
    isConnected: () => connected || usingLocalTransport,
    getName: () => name,
    connect,
    disconnect,
    sendState,
    updateProfile,
    sendEmote,
  };
}
