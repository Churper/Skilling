import * as THREE from "three";

export function createInputController({ domElement, camera, ground, player, setMoveTarget }) {
  const keys = new Set();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const walkPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -player.position.y);
  let downInfo = null;
  let isMiddlePanning = false;

  function pointerToNdc(clientX, clientY) {
    pointer.x = (clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(clientY / window.innerHeight) * 2 + 1;
  }

  function getGroundPoint(clientX, clientY) {
    pointerToNdc(clientX, clientY);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(ground, false)[0];
    if (hit) return hit.point;

    const out = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(walkPlane, out)) return out;
    return null;
  }

  domElement.addEventListener("pointerdown", (event) => {
    if (event.button === 1) isMiddlePanning = true;
    downInfo = { id: event.pointerId, x: event.clientX, y: event.clientY, button: event.button, moved: false };
  });

  domElement.addEventListener("pointermove", (event) => {
    if (!downInfo || downInfo.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - downInfo.x, event.clientY - downInfo.y) > 8) downInfo.moved = true;
  });

  const onPointerRelease = (event) => {
    if (event.button === 1) isMiddlePanning = false;
    if (!downInfo || downInfo.id !== event.pointerId) return;
    if (!downInfo.moved && downInfo.button === 0) {
      setMoveTarget(getGroundPoint(event.clientX, event.clientY));
    }
    downInfo = null;
  };

  domElement.addEventListener("pointerup", onPointerRelease);
  domElement.addEventListener("pointercancel", onPointerRelease);

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowleft", "arrowdown", "arrowright"].includes(key)) keys.add(key);
  });
  window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));

  return {
    keys,
    isMiddlePanning: () => isMiddlePanning,
  };
}
