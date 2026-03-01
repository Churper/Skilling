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
      const groundY = getGroundY(state.x, state.z);
      entry.targetGroundY = groundY;
      /* Use transmitted Y (includes jump height) if available, otherwise ground */
      const posY = Number.isFinite(state.y) ? state.y : groundY + entry.footOffset;
      entry.targetPos.set(state.x, posY, state.z);
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
    if (Number.isFinite(state.scaleY) && Number.isFinite(state.scaleXZ)) {
      entry.targetScaleY = state.scaleY;
      entry.targetScaleXZ = state.scaleXZ;
    }
    if ("instance" in state) entry.instance = state.instance || "";
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

  let _localInstance = "";
  function setLocalInstance(inst) { _localInstance = inst || ""; }

  function update(dt) {
    for (const entry of peers.values()) {
      if (!entry.initialized) continue;

      /* hide players in a different instance */
      const sameInstance = (entry.instance || "") === _localInstance;
      entry.avatar.player.visible = sameInstance;
      if (entry.avatar.playerBlob) entry.avatar.playerBlob.visible = sameInstance;
      if (!sameInstance) continue;

      entry.avatar.player.position.lerp(entry.targetPos, 1 - Math.exp(-dt * 9));

      let delta = entry.targetYaw - entry.avatar.player.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      entry.avatar.player.rotation.y += delta * Math.min(1, dt * 10);

      /* Blob stays on ground; player Y comes from lerped targetPos (includes jump) */
      const groundY = entry.targetGroundY != null ? entry.targetGroundY : 0;
      if (entry.avatar.playerBlob) {
        entry.avatar.playerBlob.position.set(entry.avatar.player.position.x, groundY + 0.03, entry.avatar.player.position.z);
      }
      /* apply crouch/jump squish from remote */
      const tgtSY = entry.targetScaleY ?? 1;
      const tgtSXZ = entry.targetScaleXZ ?? 1;
      const curSY = entry.avatar.player.scale.y;
      const curSXZ = entry.avatar.player.scale.x;
      const lerpF = 1 - Math.exp(-dt * 12);
      entry.avatar.player.scale.set(
        curSXZ + (tgtSXZ - curSXZ) * lerpF,
        curSY + (tgtSY - curSY) * lerpF,
        curSXZ + (tgtSXZ - curSXZ) * lerpF,
      );

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
    if ((entry.instance || "") !== _localInstance) return null;
    out.set(
      entry.avatar.player.position.x,
      entry.avatar.player.position.y + entry.headOffset + 0.45,
      entry.avatar.player.position.z
    );
    return out;
  }

  function hitTest(raycaster) {
    let closest = null;
    let closestDist = Infinity;
    for (const [id, entry] of peers) {
      if (!entry.initialized) continue;
      const intersects = raycaster.intersectObject(entry.avatar.player, true);
      if (intersects.length > 0 && intersects[0].distance < closestDist) {
        closestDist = intersects[0].distance;
        closest = { id, name: entry.name || id, totalLevel: entry.totalLevel || 6, skills: entry.skills || null, tool: entry.tool, combatStyle: entry.combatStyle, moving: entry.moving, gathering: entry.gathering, attacking: entry.attacking, bossKc: entry.bossKc || 0 };
      }
    }
    return closest;
  }

  function applyStateFull(id, state = {}, peerMeta = null) {
    applyState(id, state, peerMeta);
    const entry = peers.get(id);
    if (entry && peerMeta?.name) entry.name = peerMeta.name;
    if (entry && state?.totalLevel) entry.totalLevel = state.totalLevel;
    if (entry && state?.skills) entry.skills = state.skills;
    if (entry && state?.bossKc != null) entry.bossKc = state.bossKc;
  }

  return {
    upsertPeer,
    applyState: applyStateFull,
    removePeer,
    setSnapshot,
    update,
    count: () => peers.size,
    clear,
    getEmoteAnchor,
    hitTest,
    setLocalInstance,
  };
}
