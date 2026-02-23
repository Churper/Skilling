import * as THREE from "three";

export function createPlayer(scene, addShadowBlob) {
  const gradient = document.createElement("canvas");
  gradient.width = 6;
  gradient.height = 1;
  const gctx = gradient.getContext("2d");
  [28, 74, 126, 182, 232, 255].forEach((v, i) => {
    gctx.fillStyle = `rgb(${v},${v},${v})`;
    gctx.fillRect(i, 0, 1, 1);
  });
  const gradientMap = new THREE.CanvasTexture(gradient);
  gradientMap.colorSpace = THREE.NoColorSpace;
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.generateMipmaps = false;

  const player = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.45, 0.95, 6, 12),
    new THREE.MeshToonMaterial({ color: "#f6cf66", gradientMap })
  );
  player.position.set(0, 1.2, 10);

  const toolAnchor = new THREE.Group();
  toolAnchor.position.set(0.34, 0.22, 0.12);
  const baseToolAnchorPos = toolAnchor.position.clone();
  player.add(toolAnchor);

  const toolMeshes = {
    axe: createAxeMesh(),
    pickaxe: createPickaxeMesh(),
    fishing: createFishingPoleMesh(),
  };
  toolMeshes.axe.visible = false;
  toolMeshes.pickaxe.visible = false;
  toolMeshes.fishing.visible = true;
  toolAnchor.add(toolMeshes.axe, toolMeshes.pickaxe, toolMeshes.fishing);

  function setEquippedTool(tool) {
    toolMeshes.axe.visible = tool === "axe";
    toolMeshes.pickaxe.visible = tool === "pickaxe";
    toolMeshes.fishing.visible = tool === "fishing";
  }

  let animTime = 0;
  function updateAnimation(dt, state = {}) {
    animTime += dt;
    const moving = !!state.moving;
    const gathering = !!state.gathering;
    const resourceType = state.resourceType || "fishing";

    let targetPitch = 0;
    let targetRoll = 0;
    let targetScaleY = 1;
    let toolRotX = 0;
    let toolRotZ = 0;
    let toolPosY = baseToolAnchorPos.y;

    if (gathering) {
      if (resourceType === "fishing") {
        const cast = Math.sin(animTime * 8.2) * 0.5 + 0.5;
        targetPitch = -0.02 + cast * 0.04;
        targetRoll = Math.sin(animTime * 4.2) * 0.02;
        targetScaleY = 0.99 + Math.sin(animTime * 8.2 + 0.8) * 0.015;
        toolRotX = -0.84 + Math.sin(animTime * 8.2) * 0.22;
        toolRotZ = 0.44 + Math.sin(animTime * 5.5) * 0.1;
        toolPosY += cast * 0.04;
      } else {
        const swing = Math.sin(animTime * 11.8);
        const impact = Math.max(0, swing);
        targetPitch = impact * 0.09;
        targetRoll = Math.sin(animTime * 5.2) * 0.02;
        targetScaleY = 1 - impact * 0.045;
        toolRotX = -0.38 + swing * 0.58;
        toolRotZ = 0.62 + impact * 0.22;
        toolPosY += impact * 0.05;
      }
    } else if (moving) {
      const bob = Math.sin(animTime * 10.0);
      targetPitch = bob * 0.02;
      targetRoll = Math.sin(animTime * 5.0) * 0.01;
      targetScaleY = 1 + Math.sin(animTime * 10.0 + 0.9) * 0.015;
      toolRotX = -0.2 + bob * 0.08;
      toolRotZ = 0.18 + Math.sin(animTime * 5.8) * 0.06;
    }

    player.rotation.x = THREE.MathUtils.damp(player.rotation.x, targetPitch, 18, dt);
    player.rotation.z = THREE.MathUtils.damp(player.rotation.z, targetRoll, 18, dt);
    player.scale.y = THREE.MathUtils.damp(player.scale.y, targetScaleY, 16, dt);
    player.scale.x = THREE.MathUtils.damp(player.scale.x, 1, 16, dt);
    player.scale.z = THREE.MathUtils.damp(player.scale.z, 1, 16, dt);

    toolAnchor.rotation.x = THREE.MathUtils.damp(toolAnchor.rotation.x, toolRotX, 20, dt);
    toolAnchor.rotation.z = THREE.MathUtils.damp(toolAnchor.rotation.z, toolRotZ, 20, dt);
    toolAnchor.position.y = THREE.MathUtils.damp(toolAnchor.position.y, toolPosY, 20, dt);
  }

  scene.add(player);
  const playerBlob = addShadowBlob(player.position.x, player.position.z, 1.5, 0.24);
  return { player, playerBlob, setEquippedTool, updateAnimation };
}

function createAxeMesh() {
  const mesh = new THREE.Group();
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.05, 0.85, 6),
    new THREE.MeshToonMaterial({ color: "#9b6f42" })
  );
  handle.rotation.z = Math.PI * 0.45;
  mesh.add(handle);

  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.2, 0.06),
    new THREE.MeshToonMaterial({ color: "#c7d4df" })
  );
  blade.position.set(0.19, 0.22, 0);
  blade.rotation.z = Math.PI * 0.22;
  mesh.add(blade);
  return mesh;
}

function createPickaxeMesh() {
  const mesh = new THREE.Group();
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.045, 0.9, 6),
    new THREE.MeshToonMaterial({ color: "#9a6d41" })
  );
  handle.rotation.z = Math.PI * 0.48;
  mesh.add(handle);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.06, 0.07),
    new THREE.MeshToonMaterial({ color: "#bdcad4" })
  );
  head.position.set(0.2, 0.23, 0);
  head.rotation.z = Math.PI * 0.18;
  mesh.add(head);
  return mesh;
}

function createFishingPoleMesh() {
  const mesh = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.028, 1.18, 6),
    new THREE.MeshToonMaterial({ color: "#a77a48" })
  );
  pole.rotation.z = Math.PI * 0.58;
  mesh.add(pole);

  const line = new THREE.Mesh(
    new THREE.CylinderGeometry(0.003, 0.003, 0.3, 4),
    new THREE.MeshToonMaterial({ color: "#d7eef7" })
  );
  line.position.set(0.51, 0.37, 0);
  mesh.add(line);
  return mesh;
}

export function createMoveMarker(scene) {
  const marker = new THREE.Group();
  const markerRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.06, 10, 40),
    new THREE.MeshBasicMaterial({ color: "#fef8a2", transparent: true, opacity: 0.9, depthWrite: false, depthTest: false })
  );
  markerRing.rotation.x = Math.PI / 2;
  markerRing.renderOrder = 95;
  marker.add(markerRing);
  const markerBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.14, 1.15, 10),
    new THREE.MeshBasicMaterial({ color: "#f4ec8a", transparent: true, opacity: 0.42, depthWrite: false, depthTest: false })
  );
  markerBeam.position.y = 0.66;
  markerBeam.renderOrder = 95;
  marker.add(markerBeam);
  marker.renderOrder = 95;
  marker.visible = false;
  scene.add(marker);
  return { marker, markerRing, markerBeam };
}
