import * as THREE from "three";

export function createPlayer(scene, addShadowBlob) {
  // Slime body: low-poly squished sphere with flat bottom, bulged middle
  const slimeGeo = new THREE.SphereGeometry(0.5, 8, 6);
  const pos = slimeGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    // Flatten bottom
    if (y < 0) y *= 0.42;
    // Bulge middle xz
    const yNorm = (y + 0.5) / 1.0;
    const bulge = 1.0 + 0.26 * Math.sin(yNorm * Math.PI);
    x *= bulge * 1.04;
    y *= 1.12;
    z *= bulge * 1.04;
    pos.setXYZ(i, x, y, z);
  }
  slimeGeo.computeVertexNormals();

  const player = new THREE.Mesh(
    slimeGeo,
    new THREE.MeshPhysicalMaterial({
      color: "#5deb7a",
      transparent: true,
      opacity: 0.6,
      roughness: 0.05,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      flatShading: true,
      side: THREE.FrontSide,
    })
  );
  player.position.set(0, 1.2, 10);

  // Face: eyes and mouth.
  const eyeMat = new THREE.MeshBasicMaterial({ color: "#000000" });
  const eyeGeo = new THREE.SphereGeometry(0.062, 8, 8);
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.115, 0.2, 0.395);
  player.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.115, 0.2, 0.395);
  player.add(rightEye);
  const mouthMat = new THREE.MeshBasicMaterial({ color: "#08110a" });
  const mouthLobeGeo = new THREE.SphereGeometry(0.026, 8, 8);
  const mouthLeft = new THREE.Mesh(mouthLobeGeo, mouthMat);
  mouthLeft.scale.set(1.1, 0.72, 1.0);
  mouthLeft.position.set(-0.032, 0.045, 0.43);
  player.add(mouthLeft);
  const mouthRight = new THREE.Mesh(mouthLobeGeo, mouthMat);
  mouthRight.scale.set(1.1, 0.72, 1.0);
  mouthRight.position.set(0.032, 0.045, 0.43);
  player.add(mouthRight);
  const mouthNose = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 8), mouthMat);
  mouthNose.position.set(0, 0.07, 0.432);
  player.add(mouthNose);

  // Lower-only filler prevents ground bleed at the feet without a visible inner-sphere ring.
  const baseFill = new THREE.Mesh(
    new THREE.SphereGeometry(0.46, 10, 8, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
    new THREE.MeshToonMaterial({ color: "#4ecf6d" })
  );
  baseFill.scale.set(0.95, 0.52, 0.95);
  baseFill.position.set(0, -0.17, 0);
  player.add(baseFill);

  const toolAnchor = new THREE.Group();
  toolAnchor.position.set(0.38, 0.08, 0.18);
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

  const carryPose = {
    axe:     { x: 0.38, y: 0.08, z: 0.18, rx: -0.12, ry: 0.30, rz: -0.38 },
    pickaxe: { x: 0.38, y: 0.08, z: 0.18, rx: -0.15, ry: 0.30, rz: -0.32 },
    fishing: { x: 0.33, y: 0.1, z: 0.21, rx: 0.58, ry: 0.05, rz: -0.06 },
  };

  const gatherPose = {
    axe:     { x: 0.34, y: 0.14, z: 0.22, rx: -1.0, ry: 0.08, rz: 0.08 },
    pickaxe: { x: 0.34, y: 0.14, z: 0.22, rx: -1.05, ry: 0.10, rz: 0.06 },
    fishing: { x: 0.33, y: 0.17, z: 0.23, rx: 1.34, ry: 0.08, rz: 0.16 },
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
    const basePose = gathering
      ? (gatherPose[currentTool] || gatherPose.fishing)
      : (carryPose[currentTool] || carryPose.fishing);
    let toolRotX = basePose.rx;
    let toolRotY = basePose.ry;
    let toolRotZ = basePose.rz;
    let toolPosX = basePose.x;
    let toolPosY = basePose.y;
    let toolPosZ = basePose.z;
    const idle = Math.sin(animTime * 1.9);
    toolPosY += idle * 0.005;
    toolRotZ += Math.sin(animTime * 1.6) * 0.015;

    if (gathering) {
      if (resourceType === "fishing") {
        const cast = Math.sin(animTime * 4.8) * 0.5 + 0.5;
        const twitch = Math.sin(animTime * 9.6 + 0.4);
        targetPitch = -0.015 + cast * 0.03;
        targetRoll = Math.sin(animTime * 2.6) * 0.013;
        targetScaleY = 0.994 + Math.sin(animTime * 4.8 + 0.9) * 0.01;
        toolRotX += Math.sin(animTime * 4.8) * 0.2 + Math.max(0, twitch) * 0.045;
        toolRotY += Math.sin(animTime * 1.8) * 0.05;
        toolRotZ += Math.sin(animTime * 3.3) * 0.08;
        toolPosX += cast * 0.022;
        toolPosY += cast * 0.034;
        toolPosZ += cast * 0.012;
      } else {
        const isMining = resourceType === "mining";
        const swingSpeed = isMining ? 6.8 : 7.6;
        const swing = Math.sin(animTime * swingSpeed);
        const windup = Math.max(0, Math.sin(animTime * swingSpeed - 1.1));
        const impact = Math.max(0, swing);
        targetPitch = impact * 0.07 + windup * 0.02;
        targetRoll = Math.sin(animTime * 3.4) * (isMining ? -0.008 : 0.01);
        targetScaleY = 1 - impact * 0.036;
        toolRotX += -windup * 0.18 + swing * 0.46;
        toolRotY += impact * (isMining ? -0.12 : 0.08);
        toolRotZ += impact * (isMining ? 0.1 : 0.15);
        toolPosX += impact * 0.018;
        toolPosY += impact * 0.03 - windup * 0.008;
        toolPosZ += impact * 0.008;
      }
    } else if (moving) {
      const stride = Math.sin(animTime * 7.2);
      targetPitch = stride * 0.013;
      targetRoll = Math.sin(animTime * 3.6) * 0.008;
      targetScaleY = 1 + Math.sin(animTime * 7.2 + 0.9) * 0.025;
      toolRotX += stride * 0.06;
      toolRotZ += Math.sin(animTime * 7.2 + 1.0) * 0.025;
      toolPosY += Math.abs(stride) * 0.008;
    } else {
      // Idle slime breathing squish
      targetScaleY = 1 + Math.sin(animTime * 1.9) * 0.035;
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
  const playerBlob = addShadowBlob(player.position.x, player.position.z, 1.0, 0.22);
  return { player, playerBlob, setEquippedTool, updateAnimation };
}

function createAxeMesh() {
  const mesh = new THREE.Group();
  const handleMat = new THREE.MeshToonMaterial({ color: "#9b6f42" });
  const metalMat = new THREE.MeshToonMaterial({ color: "#c7d4df" });
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.032, 0.82, 6),
    handleMat
  );
  handle.position.set(0.0, 0.34, 0.0);
  mesh.add(handle);

  const bladeCore = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.13, 0.075),
    metalMat
  );
  bladeCore.position.set(0.08, 0.72, 0);
  bladeCore.rotation.y = Math.PI * 0.06;
  mesh.add(bladeCore);

  const bladeBit = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.14, 4),
    metalMat
  );
  bladeBit.position.set(0.2, 0.72, 0);
  bladeBit.rotation.z = -Math.PI * 0.5;
  bladeBit.rotation.x = Math.PI * 0.25;
  mesh.add(bladeBit);

  const backSpike = new THREE.Mesh(
    new THREE.ConeGeometry(0.04, 0.08, 4),
    metalMat
  );
  backSpike.position.set(-0.07, 0.72, 0);
  backSpike.rotation.z = Math.PI * 0.5;
  backSpike.rotation.x = Math.PI * 0.25;
  mesh.add(backSpike);

  const pommel = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 8, 8),
    new THREE.MeshToonMaterial({ color: "#7f5a36" })
  );
  pommel.position.set(0, -0.06, 0);
  mesh.add(pommel);

  // Flip local forward so axe blade faces the same play direction as other tools.
  mesh.rotation.y = Math.PI;
  mesh.scale.setScalar(0.9);
  return mesh;
}

function createPickaxeMesh() {
  const mesh = new THREE.Group();
  const handleMat = new THREE.MeshToonMaterial({ color: "#9a6d41" });
  const metalMat = new THREE.MeshToonMaterial({ color: "#bdcad4" });
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.032, 0.92, 6),
    handleMat
  );
  handle.position.set(0, 0.39, 0);
  mesh.add(handle);

  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.48, 6),
    metalMat
  );
  head.position.set(0, 0.82, 0);
  head.rotation.x = Math.PI * 0.5;
  mesh.add(head);

  const tipA = new THREE.Mesh(
    new THREE.ConeGeometry(0.043, 0.11, 4),
    metalMat
  );
  tipA.position.set(0.23, 0.82, 0);
  tipA.rotation.z = -Math.PI * 0.5;
  tipA.rotation.x = Math.PI * 0.25;
  mesh.add(tipA);

  const tipB = new THREE.Mesh(
    new THREE.ConeGeometry(0.043, 0.11, 4),
    metalMat
  );
  tipB.position.set(-0.23, 0.82, 0);
  tipB.rotation.z = Math.PI * 0.5;
  tipB.rotation.x = Math.PI * 0.25;
  mesh.add(tipB);

  const pommel = new THREE.Mesh(
    new THREE.SphereGeometry(0.033, 8, 8),
    new THREE.MeshToonMaterial({ color: "#815d3b" })
  );
  pommel.position.set(0, -0.06, 0);
  mesh.add(pommel);

  mesh.scale.setScalar(0.9);
  return mesh;
}

function createFishingPoleMesh() {
  const mesh = new THREE.Group();
  const woodMat = new THREE.MeshToonMaterial({ color: "#a77a48" });
  const lineMat = new THREE.MeshToonMaterial({ color: "#d7eef7" });
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.02, 1.3, 6),
    woodMat
  );
  pole.position.set(0, 0.58, 0);
  mesh.add(pole);

  const reel = new THREE.Mesh(
    new THREE.TorusGeometry(0.045, 0.01, 6, 12),
    new THREE.MeshToonMaterial({ color: "#d9edf4" })
  );
  reel.position.set(0.03, 0.2, 0);
  reel.rotation.y = Math.PI * 0.5;
  mesh.add(reel);

  const line = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0015, 0.0015, 0.48, 4),
    lineMat
  );
  line.position.set(0, 1.06, 0.02);
  mesh.add(line);

  const bobber = new THREE.Mesh(
    new THREE.SphereGeometry(0.015, 8, 8),
    new THREE.MeshToonMaterial({ color: "#fff5dd" })
  );
  bobber.position.set(0, 0.82, 0.02);
  mesh.add(bobber);

  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.013, 0.15, 6),
    new THREE.MeshToonMaterial({ color: "#6f4d30" })
  );
  grip.position.set(0, 0.02, 0);
  mesh.add(grip);

  mesh.scale.setScalar(0.88);
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
