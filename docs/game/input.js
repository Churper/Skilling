import * as THREE from "three";

export function createInputController({ domElement, camera, ground, player, setMoveTarget, interactables = [], onInteract = null }) {
  const keys = new Set();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const walkPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -player.position.y);
  let downInfo = null;

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

  function findInteractableRoot(object) {
    let node = object;
    while (node) {
      if (node.userData && (node.userData.resourceType || node.userData.serviceType)) return node;
      node = node.parent;
    }
    return null;
  }

  function getInteractable(clientX, clientY) {
    if (!interactables.length) return null;
    pointerToNdc(clientX, clientY);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(interactables, true);
    for (const hit of hits) {
      const root = findInteractableRoot(hit.object);
      if (root) return { root, hit };
    }
    return null;
  }

  domElement.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    downInfo = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      pointerType: event.pointerType || "mouse",
      interaction: getInteractable(event.clientX, event.clientY),
    };
  });

  domElement.addEventListener("pointermove", (event) => {
    if (!downInfo || downInfo.id !== event.pointerId || !(event.buttons & 1)) return;
    if (Math.hypot(event.clientX - downInfo.x, event.clientY - downInfo.y) > 8) downInfo.moved = true;
    if (downInfo.pointerType === "mouse" && downInfo.moved) {
      setMoveTarget(getGroundPoint(event.clientX, event.clientY));
    }
  });

  const onPointerRelease = (event) => {
    if (!downInfo || downInfo.id !== event.pointerId || event.button !== 0) return;
    if (!downInfo.moved) {
      const interaction = downInfo.interaction || getInteractable(event.clientX, event.clientY);
      if (interaction && typeof onInteract === "function") {
        onInteract(interaction.root, interaction.hit.point);
      } else {
        setMoveTarget(getGroundPoint(event.clientX, event.clientY));
      }
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

  return { keys };
}
