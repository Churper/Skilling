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

export function resolveOnlineConfig() {
  if (typeof window === "undefined") {
    return { wsUrl: "", room: "main", name: "Player" };
  }

  const params = new URLSearchParams(window.location.search);
  const host = window.location.hostname;
  const defaultWs = host === "localhost" || host === "127.0.0.1" ? "ws://localhost:8081" : "";

  return {
    wsUrl: params.get("ws") || window.SKILLING_WS_URL || defaultWs,
    room: params.get("room") || window.SKILLING_ROOM || "main",
    name: params.get("name") || window.SKILLING_NAME || randomName(),
  };
}

export function createRealtimeClient({
  wsUrl,
  room = "main",
  name = "Player",
  color = "#58df78",
  sendIntervalMs = 80,
  reconnectMs = 2000,
  onConnected = null,
  onDisconnected = null,
  onWelcome = null,
  onPeerJoin = null,
  onPeerLeave = null,
  onPeerState = null,
} = {}) {
  let ws = null;
  let connected = false;
  let closedByUser = false;
  let localId = null;
  let queuedState = null;
  let lastStateSentAt = 0;
  let flushTimer = null;

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
    }
  }

  function connect() {
    if (!wsUrl || ws) return;
    closedByUser = false;

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
      localId = null;
      if (typeof onDisconnected === "function") onDisconnected({ reconnecting: !closedByUser && !!wsUrl, hadConnection });
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
    if (ws) ws.close();
    ws = null;
    connected = false;
    localId = null;
  }

  function sendState(state) {
    if (!wsUrl) return;
    queuedState = state;
    flushStateNow();
  }

  function updateProfile(profile = {}) {
    if (!wsUrl) return;
    if (typeof profile.name === "string" && profile.name.trim()) name = profile.name.trim();
    if (typeof profile.color === "string" && profile.color.trim()) color = profile.color.trim();
    sendRaw({ type: "profile", name, color });
  }

  return {
    isEnabled: !!wsUrl,
    getLocalId: () => localId,
    connect,
    disconnect,
    sendState,
    updateProfile,
  };
}
