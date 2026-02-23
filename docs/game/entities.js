import * as THREE from "three";

export function createPlayer(scene, addShadowBlob) {
  const player = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.45, 0.95, 6, 12),
    new THREE.MeshStandardMaterial({ color: "#ffd463", roughness: 0.68, metalness: 0.04 })
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
