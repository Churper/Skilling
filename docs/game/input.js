import * as THREE from "three";

export function createInputController({ domElement, camera, ground, player, setMoveTarget, interactables = [], onInteract = null, onHoverChange = null }) {
  const keys = new Set();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const walkPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -player.position.y);
  const groundFallbackPoint = new THREE.Vector3();
  let downInfo = null;
  let hoveredRoot = null;

  // Suppress context menu on canvas so right-click doesn't pop a menu
  domElement.addEventListener("contextmenu", (e) => e.preventDefault());

  function pointerToNdc(clientX, clientY) {
    pointer.x = (clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(clientY / window.innerHeight) * 2 + 1;
  }

  function getGroundPoint(clientX, clientY) {
    pointerToNdc(clientX, clientY);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(ground, true)[0];
    if (hit) return hit.point;

    walkPlane.constant = -player.position.y;
    if (raycaster.ray.intersectPlane(walkPlane, groundFallbackPoint)) return groundFallbackPoint;
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
    // Hover detection when not dragging
    if (!downInfo || !(event.buttons & 1)) {
      const interaction = getInteractable(event.clientX, event.clientY);
      const newRoot = interaction ? interaction.root : null;
      if (newRoot !== hoveredRoot) {
        hoveredRoot = newRoot;
        domElement.style.cursor = hoveredRoot ? "pointer" : "";
        if (typeof onHoverChange === "function") onHoverChange(hoveredRoot);
      }
    }
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

  /* Track crouch (Ctrl) separately — Windows fires spurious keyup gaps when
     holding Ctrl, so we use a timestamp to ignore brief releases. */
  let _ctrlLastDown = 0;
  const CTRL_HOLD_GRACE = 200; // ms — ignore keyup gaps shorter than this

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowleft", "arrowdown", "arrowright", " "].includes(key)) keys.add(key);
    if (key === "control") _ctrlLastDown = performance.now();
  });
  window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    if (key !== "control") keys.delete(key);
    // Ctrl keyup handled by isCrouchHeld() grace period
  });
  window.addEventListener("blur", () => { keys.clear(); _ctrlLastDown = 0; });

  function isCrouchHeld() {
    return (performance.now() - _ctrlLastDown) < CTRL_HOLD_GRACE;
  }

  return { keys, getHovered: () => hoveredRoot, isCrouchHeld };
}
