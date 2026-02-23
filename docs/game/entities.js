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
  scene.add(player);
  const playerBlob = addShadowBlob(player.position.x, player.position.z, 1.5, 0.24);
  return { player, playerBlob };
}

export function createMoveMarker(scene) {
  const marker = new THREE.Group();
  const markerRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.06, 10, 40),
    new THREE.MeshBasicMaterial({ color: "#fef8a2", transparent: true, opacity: 0.9 })
  );
  markerRing.rotation.x = Math.PI / 2;
  marker.add(markerRing);
  const markerBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.14, 1.15, 10),
    new THREE.MeshBasicMaterial({ color: "#f4ec8a", transparent: true, opacity: 0.42 })
  );
  markerBeam.position.y = 0.58;
  marker.add(markerBeam);
  marker.visible = false;
  scene.add(marker);
  return { marker, markerRing, markerBeam };
}
