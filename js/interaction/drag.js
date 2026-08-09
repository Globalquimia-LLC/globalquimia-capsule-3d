import * as THREE from 'three';
import { state } from '../state.js';
import { DRAG_TILT_LIMIT, DRAG_SENSITIVITY, SPIN_MAX_VELOCITY } from '../constants.js';

// ---------------------------------------------------------------------
// Free rotation by cursor drag (the same "grab and spin" feel as
// visor.html's <model-viewer camera-controls>), layered on top of the
// scroll-driven story/wizard rotation instead of replacing it. Mouse
// always; touch only once the wizard is active (state.wizardScrollLocked)
// — before that, touch on the canvas is still driving the pinned scroll
// story (one-finger scroll/zoom/pan), and rotating the capsule there too
// would fight that same gesture. Once the wizard locks scroll, the canvas
// itself is excluded from scroll-advance.js's swipe-to-change-step
// interception for exactly this reason (see isDragOwnedTarget there).
// Scrolling again after a drag used to re-assert whatever the active GSAP
// scrub tween wanted for rotation.y at that scroll position by setting it
// directly — a hard snap from wherever the drag left it, since a scrub
// tween always writes its own calculated value regardless of what the
// property currently holds. The story's rotation tweens target
// state.rotationTarget (a plain proxy, not the object itself) and
// scene.js's animate() eases capsuleGroup.rotation.y toward it instead —
// see ROTATION_CHASE_WINDOW_MS — so resuming scroll after a drag glides
// back into sync instead of jumping.
//
// Momentum: velocity is tracked continuously while dragging (so it
// reflects how fast the cursor was moving right up to the moment of
// release, not just the release event itself), then left to decay once
// the pointer lifts — the decay itself is applied every frame in
// scene.js's animate(), not here.
// ---------------------------------------------------------------------
let dragStartX = 0, dragStartY = 0;
let dragStartRotY = 0, dragStartRotX = 0;
let lastPointerX = 0, lastPointerT = 0;

export function initDragRotation() {
  const { container } = state;

  container.addEventListener('pointerdown', (e) => {
    // Step 4 locks rotation so logo/text placement stays predictable —
    // decal-drag.js takes over pointer handling on this same container
    // instead. isDragging never gets set here, so pointermove/up below
    // stay correctly inert for the whole gesture.
    const touchOk = e.pointerType === 'touch' && state.wizardScrollLocked;
    if ((e.pointerType !== 'mouse' && !touchOk) || !state.capsuleGroup || state.rotationLocked) return;
    state.isDragging = true;
    state.spinVelocityY = 0; // grabbing it again stops any momentum spin in progress
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartRotY = state.capsuleGroup.rotation.y;
    dragStartRotX = state.capsuleGroup.rotation.x;
    lastPointerX = e.clientX;
    lastPointerT = performance.now();
    container.classList.add('dragging');
    container.setPointerCapture(e.pointerId);
  });

  container.addEventListener('pointermove', (e) => {
    if (!state.isDragging || !state.capsuleGroup) return;
    state.capsuleGroup.rotation.y = dragStartRotY + (e.clientX - dragStartX) * DRAG_SENSITIVITY;
    state.capsuleGroup.rotation.x = THREE.MathUtils.clamp(
      dragStartRotX + (e.clientY - dragStartY) * DRAG_SENSITIVITY,
      -DRAG_TILT_LIMIT, DRAG_TILT_LIMIT
    );

    // Instantaneous velocity since the last move event, normalized to a
    // ~16ms (one 60fps frame) reference so it's comparable to how it'll be
    // applied per-frame later, regardless of how far apart events actually
    // fired. Lightly smoothed (70/30) so one jittery last-frame delta right
    // before release doesn't fully dictate the throw.
    const now = performance.now();
    const dt = Math.max(now - lastPointerT, 1);
    const rawVelocity = (e.clientX - lastPointerX) * DRAG_SENSITIVITY * (16 / dt);
    state.spinVelocityY = THREE.MathUtils.clamp(
      state.spinVelocityY * 0.7 + rawVelocity * 0.3,
      -SPIN_MAX_VELOCITY, SPIN_MAX_VELOCITY
    );
    lastPointerX = e.clientX;
    lastPointerT = now;
  });

  function endDrag(e) {
    if (!state.isDragging) return;
    state.isDragging = false;
    container.classList.remove('dragging');
    if (e && e.pointerId !== undefined && container.hasPointerCapture(e.pointerId)) {
      container.releasePointerCapture(e.pointerId);
    }
    // spinVelocityY carries over as-is — animate() in scene.js decays it every frame.
  }
  container.addEventListener('pointerup', endDrag);
  container.addEventListener('pointercancel', endDrag);
}
