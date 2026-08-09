import * as THREE from 'three';
import { state } from '../state.js';
import { CAP_OPEN_DELTA } from '../constants.js';

// ---------------------------------------------------------------------
// Closing tunnel. Four beats:
//   1. The cap pops open and keeps going — flies well past the normal
//      "open" pose and out of frame entirely (not the same short slide
//      used earlier in the scroll story).
//   2. With the cap gone, the body turns to face the camera head-on so
//      its hollow opening points straight at the viewer.
//   3. The camera pushes into that opening while a full-screen overlay
//      darkens over it — together reading as "flying into the capsule".
//   4. Once fully black, the Globalquimia logo fades in at the end of
//      the tunnel, holds for a beat, then onComplete runs — navigating
//      the page to WhatsApp, in practice (see step-quote.js).
// ---------------------------------------------------------------------
export function playTunnelSequence(onComplete) {
  const { camera, capsuleGroup, capNode, capMaterial, capMeshObj, maxDimGlobal } = state;
  if (state.tunnelStarted || !camera.userData.baseDir || !capsuleGroup || !capNode) return;
  state.tunnelStarted = true;
  state.tunnelPlaying = true;
  // tryAdvanceOnScroll (scroll-advance.js) swallows wheel/touch events
  // while the tunnel plays, but normalizeScroll drives the actual page
  // position through its own internal engine — a wheel event being
  // "prevented" doesn't stop THAT engine from still nudging scrollY on
  // its own. Disabling it here freezes scroll completely (our own wheel
  // listener keeps receiving events regardless, so scroll-up-to-reverse
  // still works); moot once onComplete navigates the page away, but keeps
  // scroll from drifting during the animation itself either way.
  if (state.scrollNormalizer) state.scrollNormalizer.disable();
  const overlay = document.getElementById('tunnel-overlay');
  const logo = document.getElementById('tunnel-logo');
  const dir = camera.userData.baseDir;
  const deepInside = dir.clone().multiplyScalar(maxDimGlobal * 0.04);

  // Any drag momentum still decaying would fight the scripted turn below.
  state.spinVelocityY = 0;

  // The body's opening faces local +Z (capNode slides further +Z to
  // open) — rotating capsuleGroup so that axis points at the camera's
  // fixed baseDir aims the hollow straight at the viewer, without moving
  // the camera itself off its established look-at-origin framing.
  const fromQuat = capsuleGroup.quaternion.clone();
  const toQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  const turnState = { t: 0 };

  // Darkening is tied to the camera's actual distance from the capsule,
  // not to a fixed time on the clock — everything stays fully lit at its
  // normal color while the camera is still approaching from outside, and
  // only starts fading to black once it actually crosses into the open
  // body (entryDist), reaching full black exactly as it reaches the
  // deepest point (endDist). entryDist is an approximation of where the
  // body's rim sits (there's no exact stored value for it).
  const endDist = deepInside.length();
  const entryDist = maxDimGlobal * 0.35;

  // capsuleGroup keeps turning by re-slerping fromQuat->toQuat every scrub
  // of turnState.t, which plays back correctly in reverse for free — same
  // for the camera dolly and overlay opacity below, since both are driven
  // off a plain 0->1 progress value rather than a one-shot relative delta.
  state.tunnelTimeline = gsap.timeline({
    onReverseComplete: () => {
      state.tunnelStarted = false;
      state.tunnelPlaying = false;
      overlay.style.pointerEvents = 'none';
      if (state.scrollNormalizer) state.scrollNormalizer.enable();
    },
  })
    // 1. Cap flies off — far past CAP_OPEN_DELTA, then fades and hides.
    // inOut (not a hard "in") so it leaves with a gentle push rather than
    // a snap-start, matching the softer camera dolly below.
    .to(capNode.position, { z: CAP_OPEN_DELTA * 25, duration: 1.1, ease: 'power2.inOut' }, 0)
    .to(capMaterial, {
      opacity: 0, duration: 0.6, ease: 'power1.inOut',
      onStart: () => { capMaterial.transparent = true; capMaterial.needsUpdate = true; },
    }, 0.5)
    // capMeshObj.visible stays true throughout — opacity alone (tweened
    // by GSAP, which .reverse() plays back correctly either direction)
    // is what hides it; toggling .visible via .call() doesn't have a
    // natural "undo" and would leave the cap invisible on the way back.
    // 2. Body turns to face the camera — starts as the cap is mid-exit.
    .to(turnState, {
      t: 1, duration: 1.4, ease: 'power2.inOut',
      onUpdate: () => capsuleGroup.quaternion.slerpQuaternions(fromQuat, toQuat, turnState.t),
    }, 0.5)
    .set(overlay, { pointerEvents: 'auto' }, 1.7)
    // 3. Camera pushes through the now-exposed opening — this is the beat
    // that actually reads as "entering the tunnel", so it gets the
    // gentlest curve of the whole sequence: inOut instead of a hard "in"
    // (which accelerated the whole way and slammed to a stop right as it
    // went black) and a touch more time to cover the same distance.
    // The overlay only starts darkening once the camera distance actually
    // drops below entryDist, not from the start of this dolly.
    .to(camera.position, {
      x: deepInside.x, y: deepInside.y, z: deepInside.z,
      duration: 2.6, ease: 'power2.inOut',
      onUpdate: () => {
        camera.lookAt(0, 0, 0);
        const dist = camera.position.length();
        overlay.style.opacity = THREE.MathUtils.clamp(
          THREE.MathUtils.mapLinear(dist, entryDist, endDist, 0, 1),
          0, 1
        );
      },
    }, 1.7)
    // 4. Logo at the end of the tunnel (overlay is fully black by the
    // time the dolly above finishes) — onComplete runs right after it
    // fades in, navigating the page away to WhatsApp at that point, so no
    // fade-out tween back to the wizard is needed here.
    .to(logo, { opacity: 1, scale: 1, duration: 0.8, ease: 'power2.out' })
    .call(() => {
      state.tunnelPlaying = false;
      if (onComplete) onComplete();
    });
}
