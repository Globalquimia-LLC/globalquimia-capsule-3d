import * as THREE from 'three';
import { state } from '../state.js';
import { buildDecalGeometryAt, worldToLocalPlacement } from '../wizard/step-design.js';

// ---------------------------------------------------------------------
// Drag-to-reposition for the logo/text decals — only active on step 4
// (state.rotationLocked), which is exactly what makes this simple: the
// capsule holds a fixed pose for the whole gesture, so the owner mesh's
// matrixWorld doesn't move out from under a drag in progress. Mouse only,
// same convention as drag.js (whole-capsule rotation), which this replaces
// for the duration of step 4 — see the rotationLocked guard added there.
//
// Grab-state is kept entirely module-local, never written to shared
// `state`, specifically so it can't interfere with drag.js's own
// unconditional pointerup/pointercancel handlers on the same container
// (they self-guard on state.isDragging, which this module never touches).
// ---------------------------------------------------------------------
let grabbed = null; // { target, type, ownerMesh, pieceSize } while a decal is held
let pendingNDC = null;
let rafScheduled = false;
const raycaster = new THREE.Raycaster();

function collectDecalMeshes() {
  const meshes = [];
  const lookup = new Map();
  for (const target of ['cap', 'body']) {
    for (const type of ['logo', 'text']) {
      const mesh = state.decalMeshes[target][type];
      if (mesh) { meshes.push(mesh); lookup.set(mesh, { target, type }); }
    }
  }
  return { meshes, lookup };
}

export function initDecalDrag() {
  const { container } = state;

  function pointerToNDC(e) {
    const rect = container.getBoundingClientRect();
    return new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
  }

  function processDrag() {
    rafScheduled = false;
    if (!grabbed || !pendingNDC) return;
    raycaster.setFromCamera(pendingNDC, state.camera);
    const hits = raycaster.intersectObject(grabbed.ownerMesh, false);
    if (!hits.length) return; // no hit this tick - leave the decal where it was rather than jitter/hide it

    const hit = hits[0];
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(grabbed.ownerMesh.matrixWorld);
    const worldNormal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();

    const decalMesh = state.decalMeshes[grabbed.target][grabbed.type];
    if (!decalMesh) { grabbed = null; return; } // cleared mid-drag (e.g. "Borrar") - bail rather than resurrect it

    // Repositioning must not reset whatever rotation/scale the sliders set -
    // read the current values back off customization each tick rather than
    // caching them at grab time, in case they change mid-drag some other way.
    const s = state.customization[grabbed.target];
    const rotation = THREE.MathUtils.degToRad(s[grabbed.type + 'RotationDeg']);
    const scale = s[grabbed.type + 'ScalePct'] / 100;
    const newGeometry = buildDecalGeometryAt(grabbed.ownerMesh, hit.point, worldNormal, grabbed.pieceSize, rotation, scale);
    decalMesh.geometry.dispose();
    decalMesh.geometry = newGeometry;

    state.customization[grabbed.target].placement[grabbed.type] = worldToLocalPlacement(hit.point, worldNormal);
  }

  container.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || !state.rotationLocked || !state.capsuleGroup) return;
    const { meshes, lookup } = collectDecalMeshes();
    if (!meshes.length) return;

    raycaster.setFromCamera(pointerToNDC(e), state.camera);
    const hits = raycaster.intersectObjects(meshes, false);
    if (!hits.length) return;

    const { target, type } = lookup.get(hits[0].object);
    const ownerMesh = target === 'cap' ? state.capMeshObj : state.bodyMeshObj;
    grabbed = {
      target, type, ownerMesh,
      pieceSize: new THREE.Box3().setFromObject(ownerMesh).getSize(new THREE.Vector3()),
    };
    container.classList.add('decal-dragging');
    container.setPointerCapture(e.pointerId);
  });

  container.addEventListener('pointermove', (e) => {
    if (!grabbed) return;
    pendingNDC = pointerToNDC(e);
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(processDrag);
  });

  function endDrag(e) {
    if (!grabbed) return;
    grabbed = null;
    pendingNDC = null;
    container.classList.remove('decal-dragging');
    if (e && e.pointerId !== undefined && container.hasPointerCapture(e.pointerId)) {
      container.releasePointerCapture(e.pointerId);
    }
  }
  container.addEventListener('pointerup', endDrag);
  container.addEventListener('pointercancel', endDrag);
}
