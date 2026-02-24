import * as THREE from "three";

export function createPlayer(scene, addShadowBlob) {
  // Slime body: low-poly squished sphere with flat bottom, bulged middle
  const slimeGeo = new THREE.SphereGeometry(0.52, 9, 7);
  const pos = slimeGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    // Flatten underside, keep a soft rounded shoulder profile.
    if (y < -0.08) y = -0.08 + (y + 0.08) * 0.24;
    const yNorm = THREE.MathUtils.clamp((y + 0.52) / 1.04, 0, 1);
    const belly = Math.sin(yNorm * Math.PI);
    const bulge = 1.0 + belly * 0.19;
    x *= bulge * 1.02;
    z *= bulge * 1.02;

    // Slightly taller cap to avoid a pancake look.
    y *= y > 0 ? 1.16 : 1.03;
    pos.setXYZ(i, x, y, z);
  }
  slimeGeo.computeVertexNormals();

  const player = new THREE.Mesh(
    slimeGeo,
    new THREE.MeshPhongMaterial({
      color: "#58df78",
      transparent: true,
      opacity: 0.68,
      shininess: 38,
      specular: new THREE.Color("#d8ffe4"),
      flatShading: true,
      side: THREE.FrontSide,
    })
  );
  player.position.set(0, 1.2, 10);

  // Keep facial features as opaque meshes so they stay crisp and black.
  const faceGroup = new THREE.Group();
  faceGroup.position.set(0, 0.16, 0.44);
  player.add(faceGroup);

  const faceMat = new THREE.MeshBasicMaterial({ color: "#0d110f" });
  const eyeGeo = new THREE.SphereGeometry(0.042, 8, 8);
  const leftEye = new THREE.Mesh(eyeGeo, faceMat);
  leftEye.position.set(-0.105, 0.08, 0.082);
  const rightEye = new THREE.Mesh(eyeGeo, faceMat);
  rightEye.position.set(0.105, 0.08, 0.082);
  faceGroup.add(leftEye, rightEye);

  const mouthMat = new THREE.MeshBasicMaterial({ color: "#0b0f0d" });
  const mouthCenter = new THREE.Mesh(
    new THREE.SphereGeometry(0.016, 7, 7),
    mouthMat
  );
  mouthCenter.position.set(0, -0.004, 0.088);
  faceGroup.add(mouthCenter);

  const mouthCurveGeo = new THREE.TorusGeometry(0.038, 0.008, 6, 10, Math.PI);
  const mouthLeft = new THREE.Mesh(mouthCurveGeo, mouthMat);
  mouthLeft.position.set(-0.042, -0.03, 0.084);
  mouthLeft.rotation.x = Math.PI;
  mouthLeft.rotation.z = Math.PI * 0.22;
  const mouthRight = new THREE.Mesh(mouthCurveGeo, mouthMat);
  mouthRight.position.set(0.042, -0.03, 0.084);
  mouthRight.rotation.x = Math.PI;
  mouthRight.rotation.z = -Math.PI * 0.22;
  faceGroup.add(mouthLeft, mouthRight);

  const toolAnchor = new THREE.Group();
  toolAnchor.position.set(0.0, 0.18, 0.1);
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
    axe:     { x: 0.36, y: 0.18, z: 0.1, rx: 0.42, ry: -1.08, rz: 0.18 },
    pickaxe: { x: 0.36, y: 0.18, z: 0.1, rx: 0.32, ry: -1.02, rz: 0.14 },
    fishing: { x: -0.36, y: 0.2, z: 0.12, rx: 0.94, ry: -0.78, rz: -0.05 },
  };

  const gatherPose = {
    axe:     { x: 0.34, y: 0.25, z: 0.12, rx: -0.44, ry: -1.28, rz: -0.16 },
    pickaxe: { x: 0.34, y: 0.25, z: 0.12, rx: -0.58, ry: -1.34, rz: -0.14 },
    fishing: { x: -0.34, y: 0.25, z: 0.14, rx: 1.42, ry: -0.72, rz: -0.24 },
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
  const handleMat = new THREE.MeshToonMaterial({ color: "#91633d" });
  const metalMat = new THREE.MeshToonMaterial({ color: "#c9d5de" });
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.023, 0.03, 0.86, 6),
    handleMat
  );
  handle.position.set(0.0, 0.36, 0.0);
  mesh.add(handle);

  const bladeCore = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.15, 0.22),
    metalMat
  );
  bladeCore.position.set(0, 0.74, 0.09);
  mesh.add(bladeCore);

  const bladeBit = new THREE.Mesh(
    new THREE.ConeGeometry(0.094, 0.14, 4),
    metalMat
  );
  bladeBit.position.set(0, 0.74, 0.24);
  bladeBit.rotation.x = Math.PI * 0.5;
  mesh.add(bladeBit);

  const backSpike = new THREE.Mesh(
    new THREE.ConeGeometry(0.04, 0.1, 4),
    metalMat
  );
  backSpike.position.set(0, 0.74, -0.09);
  backSpike.rotation.x = -Math.PI * 0.5;
  mesh.add(backSpike);

  const pommel = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 8, 8),
    new THREE.MeshToonMaterial({ color: "#7f5a36" })
  );
  pommel.position.set(0, -0.06, 0);
  mesh.add(pommel);

  // Align blade edge for hand poses.
  mesh.rotation.y = -Math.PI * 0.5;
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
