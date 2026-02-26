import * as THREE from "three";

function createSlimeGeometry() {
  const slimeGeo = new THREE.SphereGeometry(0.51, 10, 8);
  const pos = slimeGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    if (y < 0) y *= 0.52;
    const yNorm = (y + 0.5) / 1.0;
    const bulge = 1.0 + 0.2 * Math.sin(yNorm * Math.PI);
    x *= bulge * 1.02;
    y *= 1.08;
    z *= bulge * 1.02;
    pos.setXYZ(i, x, y, z);
  }
  slimeGeo.computeVertexNormals();
  return slimeGeo;
}

function addSlimeFace(root, color = "#0d110f") {
  const faceGroup = new THREE.Group();
  faceGroup.position.set(0, 0.16, 0.44);
  root.add(faceGroup);

  const faceMat = new THREE.MeshBasicMaterial({ color });
  const eyeGeo = new THREE.SphereGeometry(0.042, 8, 8);
  const leftEye = new THREE.Mesh(eyeGeo, faceMat);
  leftEye.position.set(-0.105, 0.08, 0.082);
  const rightEye = new THREE.Mesh(eyeGeo, faceMat);
  rightEye.position.set(0.105, 0.08, 0.082);
  faceGroup.add(leftEye, rightEye);

  const mouth = new THREE.Mesh(
    new THREE.TorusGeometry(0.018, 0.006, 5, 10),
    faceMat
  );
  mouth.position.set(0, -0.016, 0.086);
  mouth.rotation.x = Math.PI * 0.08;
  faceGroup.add(mouth);
}

export function createPlayer(scene, addShadowBlob, weaponModels = null) {
  const slimeGeo = createSlimeGeometry();

  const slimeMaterial = new THREE.MeshPhongMaterial({
    color: "#58df78",
    transparent: true,
    opacity: 0.68,
    shininess: 38,
    specular: new THREE.Color("#d8ffe4"),
    flatShading: true,
    side: THREE.FrontSide,
  });

  const player = new THREE.Mesh(
    slimeGeo,
    slimeMaterial
  );
  // Spawn on shore instead of inside lake to avoid underwater visual state at load.
  player.position.set(0, 1.2, 28);

  addSlimeFace(player);

  const toolAnchor = new THREE.Group();
  toolAnchor.position.set(0.0, 0.18, 0.1);
  player.add(toolAnchor);

  function makeWeaponFromModel(model, scale = 0.6) {
    if (!model) return null;
    const g = model.clone();
    g.scale.setScalar(scale);
    return g;
  }

  const toolMeshes = {
    axe: createAxeMesh(),
    pickaxe: createPickaxeMesh(),
    fishing: createFishingPoleMesh(),
    sword: (weaponModels?.sword ? makeWeaponFromModel(weaponModels.sword, 0.5) : null) || createSwordFallback(),
    bow: (weaponModels?.bow ? makeWeaponFromModel(weaponModels.bow, 0.55) : null) || createBowMesh(),
    staff: (weaponModels?.staff ? makeWeaponFromModel(weaponModels.staff, 0.5) : null) || createStaffMesh(),
  };
  if (weaponModels?.sword && toolMeshes.sword) {
    // Sword model is already upright in model space; keep neutral.
    toolMeshes.sword.rotation.set(0, 0, 0);
  }
  if (weaponModels?.bow && toolMeshes.bow) {
    // Bow model's long axis is X; roll it upright to Y once.
    toolMeshes.bow.rotation.set(0, 0, Math.PI * 0.5);
  }
  toolMeshes.axe.visible = false;
  toolMeshes.pickaxe.visible = false;
  toolMeshes.sword.visible = false;
  toolMeshes.fishing.visible = true;
  toolMeshes.bow.visible = false;
  toolMeshes.staff.visible = false;
  toolAnchor.add(toolMeshes.axe, toolMeshes.pickaxe, toolMeshes.sword, toolMeshes.fishing, toolMeshes.bow, toolMeshes.staff);
  let currentTool = "fishing";

  const carryPose = {
    axe:     { x: -0.36, y: 0.19, z: 0.11, rx: 0.64, ry: -0.74, rz: -0.08 },
    pickaxe: { x: -0.36, y: 0.19, z: 0.11, rx: 0.58, ry: -0.82, rz: -0.06 },
    sword:   { x: -0.34, y: 0.20, z: 0.12, rx: 0.6, ry: -0.7, rz: -0.1 },
    fishing: { x: -0.36, y: 0.2, z: 0.12, rx: 0.94, ry: -0.78, rz: -0.05 },
    bow:     { x: -0.34, y: 0.22, z: 0.18, rx: 0.16, ry: -0.05, rz: -0.28 },
    staff:   { x: -0.32, y: 0.2, z: 0.14, rx: 0.8, ry: -0.6, rz: -0.1 },
  };

  const gatherPose = {
    axe:     { x: -0.34, y: 0.25, z: 0.13, rx: -0.24, ry: -0.88, rz: 0.03 },
    pickaxe: { x: -0.34, y: 0.25, z: 0.13, rx: -0.36, ry: -0.9, rz: 0.02 },
    sword:   { x: -0.32, y: 0.26, z: 0.14, rx: -0.2, ry: -0.8, rz: 0.05 },
    fishing: { x: -0.34, y: 0.25, z: 0.14, rx: 1.42, ry: -0.72, rz: -0.24 },
    bow:     { x: -0.3, y: 0.28, z: 0.2, rx: -0.12, ry: -0.06, rz: -0.16 },
    staff:   { x: -0.28, y: 0.3, z: 0.16, rx: 0.3, ry: -0.5, rz: 0.0 },
  };

  function setEquippedTool(tool) {
    currentTool = toolMeshes[tool] ? tool : "fishing";
    for (const key of Object.keys(toolMeshes)) {
      toolMeshes[key].visible = key === currentTool;
    }
  }

  let animTime = 0;
  function updateAnimation(dt, state = {}) {
    animTime += dt;
    const moving = !!state.moving;
    const gathering = !!state.gathering;
    const attacking = !!state.attacking;
    const combatStyle = state.combatStyle || "melee";
    const resourceType = state.resourceType || "fishing";

    let targetPitch = 0;
    let targetRoll = 0;
    let targetScaleY = 1;
    const useAttackPose = attacking || gathering;
    const basePose = useAttackPose
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

    if (attacking) {
      if (combatStyle === "melee") {
        const swingSpeed = 8.0;
        const swing = Math.sin(animTime * swingSpeed);
        const windup = Math.max(0, Math.sin(animTime * swingSpeed - 1.1));
        const impact = Math.max(0, swing);
        targetPitch = impact * 0.09 + windup * 0.03;
        targetRoll = Math.sin(animTime * 4.0) * 0.01;
        targetScaleY = 1 - impact * 0.05;
        toolRotX += windup * 0.2 - swing * 0.5;
        toolRotY += impact * -0.04;
        toolRotZ += impact * -0.12;
        toolPosX += impact * -0.02;
        toolPosY += impact * 0.04 - windup * 0.01;
        toolPosZ += impact * 0.015;
      } else if (combatStyle === "bow") {
        const draw = Math.sin(animTime * 5.5) * 0.5 + 0.5;
        targetPitch = -0.02 + draw * 0.01;
        targetRoll = Math.sin(animTime * 2.0) * 0.006;
        targetScaleY = 1 - draw * 0.02;
        toolRotX += draw * -0.15;
        toolRotZ += draw * 0.06;
        toolPosX += draw * -0.02;
        toolPosY += draw * 0.03;
      } else if (combatStyle === "mage") {
        const hover = Math.sin(animTime * 3.2);
        const pulse = Math.sin(animTime * 5.0) * 0.5 + 0.5;
        targetPitch = hover * 0.012;
        targetRoll = Math.sin(animTime * 1.8) * 0.008;
        targetScaleY = 1 + hover * 0.03;
        toolRotX += pulse * 0.12;
        toolPosY += hover * 0.025 + pulse * 0.015;
        toolPosZ += pulse * 0.01;
      }
    } else if (gathering) {
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
        toolRotX += windup * 0.16 - swing * 0.44;
        toolRotY += impact * -0.03;
        toolRotZ += impact * (isMining ? -0.08 : -0.1);
        toolPosX += impact * -0.016;
        toolPosY += impact * 0.03 - windup * 0.008;
        toolPosZ += impact * 0.01;
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
  function setSlimeColor(hexColor) {
    slimeMaterial.color.set(hexColor || "#58df78");
  }
  return { player, playerBlob, setEquippedTool, updateAnimation, setSlimeColor };
}

export function createRemotePlayerAvatar(scene, addShadowBlob, options = {}) {
  const slimeGeo = createSlimeGeometry();
  const slimeMaterial = new THREE.MeshPhongMaterial({
    color: options.color || "#6ed998",
    transparent: true,
    opacity: 0.68,
    shininess: 34,
    specular: new THREE.Color("#d8ffe4"),
    flatShading: true,
    side: THREE.FrontSide,
  });

  const player = new THREE.Mesh(slimeGeo, slimeMaterial);
  player.position.set(0, 1.2, 28);
  addSlimeFace(player);
  scene.add(player);
  const playerBlob = addShadowBlob(player.position.x, player.position.z, 0.95, 0.19);

  let animTime = 0;
  function updateAnimation(dt, moving = false) {
    animTime += dt;
    const idle = Math.sin(animTime * 1.8) * 0.022;
    const move = moving ? Math.sin(animTime * 6.4) * 0.03 : 0;
    const targetScaleY = 1 + idle + move;
    player.scale.y = THREE.MathUtils.damp(player.scale.y, targetScaleY, 10, dt);
    player.scale.x = THREE.MathUtils.damp(player.scale.x, 1, 10, dt);
    player.scale.z = THREE.MathUtils.damp(player.scale.z, 1, 10, dt);
  }

  function setColor(hexColor) {
    slimeMaterial.color.set(hexColor || "#6ed998");
  }

  function dispose() {
    scene.remove(player);
    if (playerBlob) scene.remove(playerBlob);
    slimeGeo.dispose();
    slimeMaterial.dispose();
  }

  return { player, playerBlob, updateAnimation, setColor, dispose };
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

  // Mirror orientation so swings angle into trees/rocks.
  mesh.rotation.y = -Math.PI * 0.5;
  mesh.scale.setScalar(0.9);
  return mesh;
}

function createSwordFallback() {
  const mesh = new THREE.Group();
  const bladeMat = new THREE.MeshToonMaterial({ color: "#c8d4e0" });
  const handleMat = new THREE.MeshToonMaterial({ color: "#7f5a36" });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.65, 0.1), bladeMat);
  blade.position.y = 0.52;
  mesh.add(blade);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.22), handleMat);
  guard.position.y = 0.18;
  mesh.add(guard);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.18, 6), handleMat);
  grip.position.y = 0.06;
  mesh.add(grip);
  // Mirror orientation so swings angle into trees/rocks.
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

  mesh.rotation.y = Math.PI * 0.5;
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

function createBowMesh() {
  const mesh = new THREE.Group();
  // Curved arc — partial torus
  const arc = new THREE.Mesh(
    new THREE.TorusGeometry(0.35, 0.025, 6, 16, Math.PI * 0.88),
    new THREE.MeshToonMaterial({ color: "#8a6030" })
  );
  arc.rotation.z = Math.PI * 0.06;
  mesh.add(arc);

  // String — thin cylinder connecting ends
  const string = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.004, 0.62, 4),
    new THREE.MeshToonMaterial({ color: "#e8dcc0" })
  );
  string.position.x = -0.08;
  mesh.add(string);

  mesh.scale.setScalar(0.88);
  return mesh;
}

function createStaffMesh() {
  const mesh = new THREE.Group();
  // Shaft — long cylinder
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.035, 1.2, 6),
    new THREE.MeshToonMaterial({ color: "#5a3a20" })
  );
  shaft.position.y = 0.5;
  mesh.add(shaft);

  // Orb on top
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 10, 10),
    new THREE.MeshBasicMaterial({ color: "#8844cc", transparent: true, opacity: 0.85 })
  );
  orb.position.y = 1.15;
  mesh.add(orb);

  // Glow ring around orb
  const glow = new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.015, 6, 16),
    new THREE.MeshBasicMaterial({ color: "#aa66ee", transparent: true, opacity: 0.5, depthWrite: false })
  );
  glow.position.y = 1.15;
  glow.rotation.x = Math.PI / 2;
  mesh.add(glow);

  mesh.rotation.y = Math.PI * 0.5;
  mesh.scale.setScalar(0.88);
  return mesh;
}

export function createCombatEffects(scene) {
  const effects = [];

  function attack(style, position, yaw, charge = 0, targetPos = null) {
    const c = THREE.MathUtils.clamp(charge, 0, 1);
    if (style === "melee") {
      const radius = THREE.MathUtils.lerp(0.5, 1.2, c);
      const geo = new THREE.TorusGeometry(radius, 0.06, 8, 24, Math.PI * 0.8);
      const mat = new THREE.MeshBasicMaterial({
        color: "#ffe066",
        transparent: true,
        opacity: THREE.MathUtils.lerp(0.7, 1.0, c),
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const arc = new THREE.Mesh(geo, mat);
      arc.position.copy(position);
      arc.position.y += 0.3;
      arc.rotation.y = yaw;
      arc.rotation.x = Math.PI / 2;
      scene.add(arc);
      effects.push({ mesh: arc, age: 0, duration: 0.35, type: "melee" });
    } else if (style === "bow") {
      const group = new THREE.Group();
      const arrowScale = THREE.MathUtils.lerp(0.8, 1.2, c);
      // Build arrow pointing along local -Z (Three.js default forward)
      // so rotation.y = yaw aligns with movement direction (sin(yaw), cos(yaw))
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015 * arrowScale, 0.015 * arrowScale, 0.6 * arrowScale, 4),
        new THREE.MeshBasicMaterial({ color: "#8B4513" })
      );
      shaft.rotation.x = Math.PI / 2;
      group.add(shaft);
      // Tip points in -Z direction
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.04 * arrowScale, 0.12 * arrowScale, 4),
        new THREE.MeshBasicMaterial({ color: "#c0c0c0" })
      );
      tip.rotation.x = -Math.PI / 2;
      tip.position.z = -0.36 * arrowScale;
      group.add(tip);
      // Fletching at the back (+Z end)
      const fletchMat = new THREE.MeshBasicMaterial({ color: "#cc3333", side: THREE.DoubleSide });
      for (let f = 0; f < 3; f++) {
        const fletch = new THREE.Mesh(
          new THREE.PlaneGeometry(0.06 * arrowScale, 0.1 * arrowScale),
          fletchMat
        );
        fletch.position.z = 0.26 * arrowScale;
        fletch.rotation.y = (f / 3) * Math.PI * 2;
        group.add(fletch);
      }
      group.position.copy(position);
      group.position.y += 0.4;
      group.rotation.y = yaw;
      scene.add(group);
      const speed = THREE.MathUtils.lerp(20, 35, c);
      effects.push({ mesh: group, age: 0, duration: 0.6, type: "bow", yaw, speed });
    } else if (style === "mage") {
      const tx = targetPos ? targetPos.x : position.x + Math.sin(yaw) * 3;
      const tz = targetPos ? targetPos.z : position.z + Math.cos(yaw) * 3;
      const ty = targetPos ? targetPos.y : position.y;

      // Phase 1: Ground shadow / targeting circle
      const shadowGeo = new THREE.RingGeometry(0.2, 1.1, 32);
      const shadowMat = new THREE.MeshBasicMaterial({
        color: "#220000",
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      });
      const shadow = new THREE.Mesh(shadowGeo, shadowMat);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(tx, ty + 0.08, tz);
      shadow.renderOrder = 97;
      scene.add(shadow);

      // Inner rune circle
      const runeGeo = new THREE.RingGeometry(0.45, 0.55, 24);
      const runeMat = new THREE.MeshBasicMaterial({
        color: "#ff4400",
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      });
      const rune = new THREE.Mesh(runeGeo, runeMat);
      rune.rotation.x = -Math.PI / 2;
      rune.position.set(tx, ty + 0.09, tz);
      rune.renderOrder = 98;
      scene.add(rune);

      effects.push({
        mesh: shadow,
        age: 0,
        duration: 1.4,
        type: "mage-shadow",
        rune,
        tx, tz, ty,
        impactSpawned: false,
      });

      // Phase 2: Fire meteor falling from sky (starts after 0.35s delay)
      const meteorGroup = new THREE.Group();
      // Core fireball
      const coreGeo = new THREE.SphereGeometry(0.28, 10, 10);
      const coreMat = new THREE.MeshBasicMaterial({
        color: "#ff6600",
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      });
      meteorGroup.add(new THREE.Mesh(coreGeo, coreMat));
      // Outer glow
      const glowGeo = new THREE.SphereGeometry(0.45, 8, 8);
      const glowMat = new THREE.MeshBasicMaterial({
        color: "#ff3300",
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      });
      meteorGroup.add(new THREE.Mesh(glowGeo, glowMat));
      // Trailing embers
      const emberColors = ["#ff4400", "#ff8800", "#ffcc00", "#ff6600"];
      for (let i = 0; i < 6; i++) {
        const ember = new THREE.Mesh(
          new THREE.SphereGeometry(0.06 + Math.random() * 0.06, 5, 5),
          new THREE.MeshBasicMaterial({
            color: emberColors[i % emberColors.length],
            transparent: true,
            opacity: 0.8,
            depthWrite: false,
          })
        );
        ember.position.set(
          (Math.random() - 0.5) * 0.3,
          0.3 + Math.random() * 0.5,
          (Math.random() - 0.5) * 0.3
        );
        meteorGroup.add(ember);
      }
      meteorGroup.position.set(tx, ty + 12, tz);
      meteorGroup.visible = false;
      scene.add(meteorGroup);

      effects.push({
        mesh: meteorGroup,
        age: 0,
        duration: 1.0,
        type: "mage-meteor",
        tx, tz, ty,
        startY: ty + 12,
        delay: 0.35,
        impactSpawned: false,
      });
    }
  }

  function spawnImpact(tx, ty, tz) {
    const fireColors = ["#ff4400", "#ff6600", "#ff8800", "#ffaa00", "#ffcc00", "#ff2200"];
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 2.5 + Math.random() * 3.5;
      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(0.08 + Math.random() * 0.06, 5, 5),
        new THREE.MeshBasicMaterial({
          color: fireColors[i % fireColors.length],
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
        })
      );
      particle.position.set(tx, ty + 0.3, tz);
      scene.add(particle);
      effects.push({
        mesh: particle,
        age: 0,
        duration: 0.55,
        type: "mage-burst",
        vx: Math.sin(angle) * speed,
        vy: 1.5 + Math.random() * 2.5,
        vz: Math.cos(angle) * speed,
      });
    }
    // Shockwave ring
    const ringGeo = new THREE.RingGeometry(0.1, 0.3, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: "#ff8844",
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(tx, ty + 0.12, tz);
    ring.renderOrder = 98;
    scene.add(ring);
    effects.push({ mesh: ring, age: 0, duration: 0.45, type: "mage-ring" });
  }

  function update(dt) {
    for (let i = effects.length - 1; i >= 0; i--) {
      const fx = effects[i];
      fx.age += dt;
      const t = fx.age / fx.duration;
      if (t >= 1) {
        scene.remove(fx.mesh);
        if (fx.mesh.material) fx.mesh.material.dispose();
        if (fx.mesh.geometry) fx.mesh.geometry.dispose();
        // Clean up rune sub-mesh for shadow
        if (fx.rune) {
          scene.remove(fx.rune);
          fx.rune.material.dispose();
          fx.rune.geometry.dispose();
        }
        // Clean up meteor group children
        if (fx.mesh.isGroup || fx.mesh.children?.length) {
          fx.mesh.traverse((child) => {
            if (child.material) child.material.dispose();
            if (child.geometry) child.geometry.dispose();
          });
        }
        effects.splice(i, 1);
        continue;
      }
      if (fx.type === "melee") {
        const scale = 1 + t * 1.5;
        fx.mesh.scale.setScalar(scale);
        fx.mesh.rotation.y += dt * 12;
        fx.mesh.material.opacity = (1 - t) * 0.9;
      } else if (fx.type === "bow") {
        fx.mesh.position.x += Math.sin(fx.yaw) * fx.speed * dt;
        fx.mesh.position.z += Math.cos(fx.yaw) * fx.speed * dt;
      } else if (fx.type === "mage-shadow") {
        // Fade in shadow, then pulse, then fade out
        const fadeIn = Math.min(1, fx.age / 0.3);
        const fadeOut = Math.max(0, 1 - (fx.age - 0.9) / 0.5);
        const pulse = 0.55 + Math.sin(fx.age * 10) * 0.15;
        fx.mesh.material.opacity = fadeIn * fadeOut * pulse * 0.5;
        fx.mesh.scale.setScalar(0.6 + fadeIn * 0.4);
        // Rune ring
        if (fx.rune) {
          fx.rune.material.opacity = fadeIn * fadeOut * (0.6 + Math.sin(fx.age * 14) * 0.2);
          fx.rune.rotation.z += dt * 3.5;
          fx.rune.scale.setScalar(0.7 + fadeIn * 0.3);
        }
      } else if (fx.type === "mage-meteor") {
        if (fx.age < fx.delay) {
          fx.mesh.visible = false;
          continue;
        }
        fx.mesh.visible = true;
        const meteorT = (fx.age - fx.delay) / (fx.duration - fx.delay);
        const eased = meteorT * meteorT; // accelerating fall
        const currentY = THREE.MathUtils.lerp(fx.startY, fx.ty + 0.3, eased);
        fx.mesh.position.y = currentY;

        // Animate trailing embers
        fx.mesh.children.forEach((child, idx) => {
          if (idx >= 2) {
            child.position.y = 0.3 + Math.random() * (1.0 - meteorT) * 0.8;
            child.position.x = (Math.random() - 0.5) * (1.0 - meteorT) * 0.5;
            child.position.z = (Math.random() - 0.5) * (1.0 - meteorT) * 0.5;
            child.material.opacity = (1 - meteorT) * 0.8;
          }
        });

        // Pulse core
        const coreScale = 0.8 + Math.sin(fx.age * 18) * 0.15 + meteorT * 0.4;
        fx.mesh.children[0].scale.setScalar(coreScale);

        // Spawn impact explosion when hitting ground
        if (meteorT >= 0.95 && !fx.impactSpawned) {
          fx.impactSpawned = true;
          spawnImpact(fx.tx, fx.ty, fx.tz);
        }
      } else if (fx.type === "mage-burst") {
        fx.mesh.position.x += fx.vx * dt;
        fx.mesh.position.y += fx.vy * dt;
        fx.mesh.position.z += fx.vz * dt;
        fx.vy -= 12.0 * dt;
        fx.mesh.material.opacity = (1 - t) * 0.95;
        fx.mesh.scale.setScalar(1 - t * 0.6);
      } else if (fx.type === "mage-ring") {
        const scale = 1 + t * 4.5;
        fx.mesh.scale.setScalar(scale);
        fx.mesh.material.opacity = (1 - t) * 0.85;
      }
    }
  }

  return { attack, update };
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
