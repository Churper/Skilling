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
  toolAnchor.position.set(0.35, 0.22, 0.1);
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
    axe: { x: 0.35, y: 0.2, z: 0.08, rx: -0.54, ry: 0.08, rz: 0.9 },
    pickaxe: { x: 0.35, y: 0.2, z: 0.08, rx: -0.62, ry: 0.1, rz: 0.85 },
    fishing: { x: 0.33, y: 0.24, z: 0.13, rx: -0.98, ry: -0.08, rz: 0.44 },
  };

  function setEquippedTool(tool) {
    currentTool = toolMeshes[tool] ? tool : "fishing";
    toolMeshes.axe.visible = currentTool === "axe";
    toolMeshes.pickaxe.visible = currentTool === "pickaxe";
    toolMeshes.fishing.visible = currentTool === "fishing";
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
    let toolRotY = basePose.ry;
    let toolRotZ = basePose.rz;
    let toolPosX = basePose.x;
    let toolPosY = basePose.y;
    let toolPosZ = basePose.z;
    const idle = Math.sin(animTime * 1.9);
    toolPosY += idle * 0.004;
    toolRotZ += Math.sin(animTime * 1.6) * 0.018;

    if (gathering) {
      if (resourceType === "fishing") {
        const cast = Math.sin(animTime * 4.8) * 0.5 + 0.5;
        const twitch = Math.sin(animTime * 9.6 + 0.4);
        targetPitch = -0.015 + cast * 0.03;
        targetRoll = Math.sin(animTime * 2.6) * 0.013;
        targetScaleY = 0.994 + Math.sin(animTime * 4.8 + 0.9) * 0.01;
        toolRotX += Math.sin(animTime * 4.8) * 0.23 + Math.max(0, twitch) * 0.05;
        toolRotY += Math.sin(animTime * 1.8) * 0.05;
        toolRotZ += Math.sin(animTime * 3.3) * 0.08;
        toolPosX += cast * 0.03;
        toolPosY += cast * 0.042;
        toolPosZ += cast * 0.015;
      } else {
        const isMining = resourceType === "mining";
        const swingSpeed = isMining ? 6.8 : 7.6;
        const swing = Math.sin(animTime * swingSpeed);
        const windup = Math.max(0, Math.sin(animTime * swingSpeed - 1.1));
        const impact = Math.max(0, swing);
        targetPitch = impact * 0.07 + windup * 0.02;
        targetRoll = Math.sin(animTime * 3.4) * (isMining ? -0.008 : 0.01);
        targetScaleY = 1 - impact * 0.036;
        toolRotX += -windup * 0.22 + swing * 0.58;
        toolRotY += impact * (isMining ? -0.12 : 0.08);
        toolRotZ += impact * (isMining ? 0.12 : 0.2);
        toolPosX += impact * 0.028;
        toolPosY += impact * 0.045 - windup * 0.012;
        toolPosZ += impact * 0.008;
      }
    } else if (moving) {
      const bob = Math.sin(animTime * 7.2);
      targetPitch = bob * 0.013;
      targetRoll = Math.sin(animTime * 3.6) * 0.008;
      targetScaleY = 1 + Math.sin(animTime * 7.2 + 0.9) * 0.01;
      toolRotX += bob * 0.075;
      toolRotY += Math.sin(animTime * 2.9) * 0.03;
      toolRotZ += Math.sin(animTime * 4.6) * 0.045;
      toolPosX += Math.sin(animTime * 3.6) * 0.008;
      toolPosY += bob * 0.014;
    }

    player.rotation.x = THREE.MathUtils.damp(player.rotation.x, targetPitch, 14, dt);
    player.rotation.z = THREE.MathUtils.damp(player.rotation.z, targetRoll, 14, dt);
    player.scale.y = THREE.MathUtils.damp(player.scale.y, targetScaleY, 12, dt);
    player.scale.x = THREE.MathUtils.damp(player.scale.x, 1, 12, dt);
    player.scale.z = THREE.MathUtils.damp(player.scale.z, 1, 12, dt);

    toolAnchor.position.x = THREE.MathUtils.damp(toolAnchor.position.x, toolPosX, 16, dt);
    toolAnchor.rotation.x = THREE.MathUtils.damp(toolAnchor.rotation.x, toolRotX, 16, dt);
    toolAnchor.rotation.y = THREE.MathUtils.damp(toolAnchor.rotation.y, toolRotY, 16, dt);
    toolAnchor.rotation.z = THREE.MathUtils.damp(toolAnchor.rotation.z, toolRotZ, 16, dt);
    toolAnchor.position.y = THREE.MathUtils.damp(toolAnchor.position.y, toolPosY, 16, dt);
    toolAnchor.position.z = THREE.MathUtils.damp(toolAnchor.position.z, toolPosZ, 16, dt);
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
    new THREE.CylinderGeometry(0.032, 0.04, 0.86, 6),
    handleMat
  );
  handle.rotation.z = Math.PI * 0.39;
  handle.position.set(0.02, 0.06, 0);
  mesh.add(handle);

  const bladeCore = new THREE.Mesh(
    new THREE.BoxGeometry(0.27, 0.15, 0.08),
    metalMat
  );
  bladeCore.position.set(0.2, 0.28, 0);
  bladeCore.rotation.z = Math.PI * 0.15;
  mesh.add(bladeCore);

  const bladeBit = new THREE.Mesh(
    new THREE.ConeGeometry(0.1, 0.15, 4),
    metalMat
  );
  bladeBit.position.set(0.35, 0.3, 0);
  bladeBit.rotation.z = -Math.PI * 0.5;
  bladeBit.rotation.x = Math.PI * 0.25;
  mesh.add(bladeBit);
  const backSpike = new THREE.Mesh(
    new THREE.ConeGeometry(0.045, 0.085, 4),
    metalMat
  );
  backSpike.position.set(0.06, 0.28, 0);
  backSpike.rotation.z = Math.PI * 0.5;
  backSpike.rotation.x = Math.PI * 0.25;
  mesh.add(backSpike);
  mesh.scale.setScalar(1.04);
  return mesh;
}

function createPickaxeMesh() {
  const mesh = new THREE.Group();
  const handleMat = new THREE.MeshToonMaterial({ color: "#9a6d41" });
  const metalMat = new THREE.MeshToonMaterial({ color: "#bdcad4" });
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.038, 0.94, 6),
    handleMat
  );
  handle.rotation.z = Math.PI * 0.38;
  handle.position.set(0.01, 0.08, 0);
  mesh.add(handle);

  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.032, 0.52, 6),
    metalMat
  );
  head.position.set(0.2, 0.31, 0);
  head.rotation.z = Math.PI * 0.15;
  head.rotation.x = Math.PI * 0.5;
  mesh.add(head);
  const tipA = new THREE.Mesh(
    new THREE.ConeGeometry(0.046, 0.11, 4),
    metalMat
  );
  tipA.position.set(0.44, 0.31, 0);
  tipA.rotation.z = -Math.PI * 0.5;
  tipA.rotation.x = Math.PI * 0.25;
  mesh.add(tipA);
  const tipB = new THREE.Mesh(
    new THREE.ConeGeometry(0.046, 0.11, 4),
    metalMat
  );
  tipB.position.set(-0.03, 0.31, 0);
  tipB.rotation.z = Math.PI * 0.5;
  tipB.rotation.x = Math.PI * 0.25;
  mesh.add(tipB);
  mesh.scale.setScalar(1.03);
  return mesh;
}

function createFishingPoleMesh() {
  const mesh = new THREE.Group();
  const woodMat = new THREE.MeshToonMaterial({ color: "#a77a48" });
  const lineMat = new THREE.MeshToonMaterial({ color: "#d7eef7" });
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.026, 1.22, 6),
    woodMat
  );
  pole.rotation.z = Math.PI * 0.56;
  pole.position.set(0.04, 0.17, 0);
  mesh.add(pole);

  const line = new THREE.Mesh(
    new THREE.CylinderGeometry(0.002, 0.002, 0.36, 4),
    lineMat
  );
  line.position.set(0.63, 0.54, 0.03);
  mesh.add(line);
  const bobber = new THREE.Mesh(
    new THREE.SphereGeometry(0.016, 8, 8),
    new THREE.MeshToonMaterial({ color: "#fff5dd" })
  );
  bobber.position.set(0.63, 0.35, 0.03);
  mesh.add(bobber);
  mesh.scale.setScalar(1.02);
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
