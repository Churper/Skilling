import * as THREE from "three";
import { createRemotePlayerAvatar } from "../entities.js";

export function createRemotePlayers({ scene, addShadowBlob, getGroundY, weaponModels = null }) {
  const peers = new Map();

  function ensurePeer(peer) {
    if (!peer || !peer.id) return null;
    let entry = peers.get(peer.id);
    if (!entry) {
      const avatar = createRemotePlayerAvatar(scene, addShadowBlob, {
        color: peer.color || "#6ed998",
        weaponModels,
      });
      avatar.player.geometry.computeBoundingBox();
      const footOffset = -avatar.player.geometry.boundingBox.min.y;
      entry = {
        id: peer.id,
        avatar,
        targetPos: new THREE.Vector3(0, 0, 0),
        targetYaw: 0,
        moving: false,
        gathering: false,
        attacking: false,
        tool: "fishing",
        combatStyle: "melee",
        initialized: false,
        footOffset,
        headOffset: avatar.player.geometry.boundingBox.max.y,
      };
      peers.set(peer.id, entry);
    }
    if (peer.color) entry.avatar.setColor(peer.color);
    return entry;
  }

  function applyState(id, state = {}, peerMeta = null) {
    const entry = ensurePeer(peerMeta ? { id, ...peerMeta } : { id });
    if (!entry) return;

    if (Number.isFinite(state.x) && Number.isFinite(state.z)) {
      const y = getGroundY(state.x, state.z);
      entry.targetPos.set(state.x, y + entry.footOffset, state.z);
      if (!entry.initialized) {
        entry.avatar.player.position.copy(entry.targetPos);
        entry.initialized = true;
      }
    }
    if (Number.isFinite(state.yaw)) entry.targetYaw = state.yaw;
    entry.moving = !!state.moving;
    entry.gathering = !!state.gathering;
    entry.attacking = !!state.attacking;
    if (typeof state.tool === "string") {
      entry.tool = state.tool;
      if (entry.avatar.setEquippedTool) entry.avatar.setEquippedTool(state.tool);
    }
    if (typeof state.combatStyle === "string") entry.combatStyle = state.combatStyle;
  }

  function upsertPeer(peer) {
    if (!peer || !peer.id) return;
    ensurePeer(peer);
    if (peer.state) applyState(peer.id, peer.state, peer);
  }

  function removePeer(id) {
    const entry = peers.get(id);
    if (!entry) return;
    entry.avatar.dispose();
    peers.delete(id);
  }

  function setSnapshot(peerList = []) {
    const seen = new Set();
    for (const peer of peerList) {
      if (!peer?.id) continue;
      seen.add(peer.id);
      upsertPeer(peer);
    }
    for (const id of peers.keys()) {
      if (!seen.has(id)) removePeer(id);
    }
  }

  function update(dt) {
    for (const entry of peers.values()) {
      if (!entry.initialized) continue;

      entry.avatar.player.position.lerp(entry.targetPos, 1 - Math.exp(-dt * 9));

      let delta = entry.targetYaw - entry.avatar.player.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      entry.avatar.player.rotation.y += delta * Math.min(1, dt * 10);

      const groundY = getGroundY(entry.avatar.player.position.x, entry.avatar.player.position.z);
      entry.avatar.player.position.y = groundY + entry.footOffset;
      if (entry.avatar.playerBlob) {
        entry.avatar.playerBlob.position.set(entry.avatar.player.position.x, groundY + 0.03, entry.avatar.player.position.z);
      }
      entry.avatar.updateAnimation(dt, {
        moving: entry.moving,
        gathering: entry.gathering,
        attacking: entry.attacking,
        combatStyle: entry.combatStyle,
        tool: entry.tool,
      });
    }
  }

  function clear() {
    for (const id of Array.from(peers.keys())) removePeer(id);
  }

  function getEmoteAnchor(id, out = new THREE.Vector3()) {
    const entry = peers.get(id);
    if (!entry || !entry.initialized) return null;
    out.set(
      entry.avatar.player.position.x,
      entry.avatar.player.position.y + entry.headOffset + 0.45,
      entry.avatar.player.position.z
    );
    return out;
  }

  return {
    upsertPeer,
    applyState,
    removePeer,
    setSnapshot,
    update,
    count: () => peers.size,
    clear,
    getEmoteAnchor,
  };
}
