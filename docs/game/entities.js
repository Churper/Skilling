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
  let currentTool = "fishing";

  const toolPoseByType = {
    axe: { x: 0.35, y: 0.2, z: 0.08, rx: -0.44, rz: 0.74 },
    pickaxe: { x: 0.35, y: 0.2, z: 0.08, rx: -0.51, rz: 0.69 },
    fishing: { x: 0.33, y: 0.24, z: 0.13, rx: -0.9, rz: 0.36 },
  };

  function setEquippedTool(tool) {
    currentTool = tool;
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
    const basePose = toolPoseByType[currentTool] || toolPoseByType.fishing;
    let toolRotX = basePose.rx;
    let toolRotZ = basePose.rz;
    let toolPosX = basePose.x;
    let toolPosY = basePose.y;
    let toolPosZ = basePose.z;

    if (gathering) {
      if (resourceType === "fishing") {
        const cast = Math.sin(animTime * 8.2) * 0.5 + 0.5;
        targetPitch = -0.02 + cast * 0.04;
        targetRoll = Math.sin(animTime * 4.2) * 0.02;
        targetScaleY = 0.99 + Math.sin(animTime * 8.2 + 0.8) * 0.015;
        toolRotX += Math.sin(animTime * 8.2) * 0.22;
        toolRotZ += Math.sin(animTime * 5.5) * 0.1;
        toolPosX += cast * 0.025;
        toolPosY += cast * 0.04;
        toolPosZ += cast * 0.01;
      } else {
        const swing = Math.sin(animTime * 11.8);
        const impact = Math.max(0, swing);
        targetPitch = impact * 0.09;
        targetRoll = Math.sin(animTime * 5.2) * 0.02;
        targetScaleY = 1 - impact * 0.045;
        toolRotX += swing * 0.58;
        toolRotZ += impact * 0.22;
        toolPosX += impact * 0.03;
        toolPosY += impact * 0.05;
      }
    } else if (moving) {
      const bob = Math.sin(animTime * 10.0);
      targetPitch = bob * 0.02;
      targetRoll = Math.sin(animTime * 5.0) * 0.01;
      targetScaleY = 1 + Math.sin(animTime * 10.0 + 0.9) * 0.015;
      toolRotX += bob * 0.08;
      toolRotZ += Math.sin(animTime * 5.8) * 0.06;
      toolPosY += Math.sin(animTime * 10.0) * 0.015;
    }

    player.rotation.x = THREE.MathUtils.damp(player.rotation.x, targetPitch, 18, dt);
    player.rotation.z = THREE.MathUtils.damp(player.rotation.z, targetRoll, 18, dt);
    player.scale.y = THREE.MathUtils.damp(player.scale.y, targetScaleY, 16, dt);
    player.scale.x = THREE.MathUtils.damp(player.scale.x, 1, 16, dt);
    player.scale.z = THREE.MathUtils.damp(player.scale.z, 1, 16, dt);

    toolAnchor.position.x = THREE.MathUtils.damp(toolAnchor.position.x, toolPosX, 20, dt);
    toolAnchor.rotation.x = THREE.MathUtils.damp(toolAnchor.rotation.x, toolRotX, 20, dt);
    toolAnchor.rotation.z = THREE.MathUtils.damp(toolAnchor.rotation.z, toolRotZ, 20, dt);
    toolAnchor.position.y = THREE.MathUtils.damp(toolAnchor.position.y, toolPosY, 20, dt);
    toolAnchor.position.z = THREE.MathUtils.damp(toolAnchor.position.z, toolPosZ, 20, dt);
  }

  scene.add(player);
  const playerBlob = addShadowBlob(player.position.x, player.position.z, 1.5, 0.24);
  return { player, playerBlob, setEquippedTool, updateAnimation };
}

function createAxeMesh() {
  const mesh = new THREE.Group();
  const handleMat = new THREE.MeshToonMaterial({ color: "#9b6f42" });
  const metalMat = new THREE.MeshToonMaterial({ color: "#c7d4df" });
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.05, 0.85, 6),
    handleMat
  );
  handle.rotation.z = Math.PI * 0.38;
  handle.position.set(0.02, 0.08, 0);
  mesh.add(handle);

  const bladeCore = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.16, 0.07),
    metalMat
  );
  bladeCore.position.set(0.16, 0.25, 0);
  bladeCore.rotation.z = Math.PI * 0.18;
  mesh.add(bladeCore);

  const bladeBit = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.14, 4),
    metalMat
  );
  bladeBit.position.set(0.28, 0.27, 0);
  bladeBit.rotation.z = -Math.PI * 0.5;
  bladeBit.rotation.x = Math.PI * 0.25;
  mesh.add(bladeBit);
  return mesh;
}

function createPickaxeMesh() {
  const mesh = new THREE.Group();
  const handleMat = new THREE.MeshToonMaterial({ color: "#9a6d41" });
  const metalMat = new THREE.MeshToonMaterial({ color: "#bdcad4" });
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.045, 0.9, 6),
    handleMat
  );
  handle.rotation.z = Math.PI * 0.4;
  handle.position.set(0.01, 0.08, 0);
  mesh.add(handle);

  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.42, 6),
    metalMat
  );
  head.position.set(0.15, 0.26, 0);
  head.rotation.z = Math.PI * 0.14;
  head.rotation.x = Math.PI * 0.5;
  mesh.add(head);
  return mesh;
}

function createFishingPoleMesh() {
  const mesh = new THREE.Group();
  const woodMat = new THREE.MeshToonMaterial({ color: "#a77a48" });
  const lineMat = new THREE.MeshToonMaterial({ color: "#d7eef7" });
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.028, 1.18, 6),
    woodMat
  );
  pole.rotation.z = Math.PI * 0.53;
  pole.position.set(0.02, 0.15, 0);
  mesh.add(pole);

  const line = new THREE.Mesh(
    new THREE.CylinderGeometry(0.003, 0.003, 0.3, 4),
    lineMat
  );
  line.position.set(0.55, 0.5, 0.02);
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
