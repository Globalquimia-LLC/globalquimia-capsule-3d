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
//      the tunnel, then the page auto-scrolls into .closing underneath.
// ---------------------------------------------------------------------
export function playTunnelSequence() {
  const { camera, capsuleGroup, capNode, capMaterial, capMeshObj, maxDimGlobal } = state;
  if (state.tunnelStarted || !camera.userData.baseDir || !capsuleGroup || !capNode) return;
  state.tunnelStarted = true;
  state.tunnelPlaying = true;
  // tryAdvanceOnScroll (scroll-advance.js) swallows wheel/touch events
  // while the tunnel plays, but normalizeScroll drives the actual page
  // position through its own internal engine — a wheel event being
  // "prevented" doesn't stop THAT engine from still nudging scrollY on
  // its own, which is what let .closing peek in underneath mid-animation.
  // Disabling it here freezes scroll completely (our own wheel listener
  // keeps receiving events regardless, so scroll-up-to-reverse still
  // works); re-enabled right before the scrollIntoView handoff below.
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
    // time the dolly above finishes). Short beat after, not the long
    // pause this used to be — the summary below is meant to read as
    // arriving on the SAME dark screen right after the logo, not as a
    // separate screen the user waits for.
    .to(logo, { opacity: 1, scale: 1, duration: 0.8, ease: 'power2.out' })
    .to({}, { duration: 0.2 })
    // Past this point is the point of no return: the page itself
    // navigates to .closing, so scrolling back up from here on is normal
    // page scroll again rather than something this timeline can reverse.
    //
    // This can fire while the page is still sitting at the pinned #story
    // position (button-triggered from step 5, never having scrolled past
    // it) rather than already right at the pin's end (the old scroll-
    // triggered path). element.scrollIntoView() is a native DOM API — with
    // normalizeScroll re-enabled a line above, it drives an animated scroll
    // that normalizeScroll's own internal position tracking never sees,
    // the same class of desync that caused every other normalizeScroll bug
    // this project has hit. The visible symptom: #story's ScrollTrigger
    // pin never receives a clean "crossed past end" signal, so it stays
    // visually stuck pinned - the wizard panel keeps showing over .closing
    // instead of releasing - and the transition reads as a stray extra
    // scroll animation on top of the tunnel's own. Going through the
    // normalizer's own scrollY() setter (same mechanism scroll-story.js's
    // onLeave already uses to snap position) is an instant, correctly-
    // observed jump instead - no second scroll animation, and the pin
    // releases in the same tick.
    .call(() => {
      state.tunnelPlaying = false;
      // Remove the intro + the whole scroll-driven wizard from the document
      // instead of just scrolling past them — .closing becomes the real top
      // of the page, not something sitting far down a still-scrollable
      // document. "Volver a diseñar la cápsula" (wizard.js's resetWizard)
      // undoes this.
      document.documentElement.classList.add('quote-complete');
      if (state.scrollNormalizer) {
        state.scrollNormalizer.enable();
        state.scrollNormalizer.scrollY(0);
      } else {
        window.scrollTo(0, 0);
      }
      // .closing-item's reveal (js/intro.js's initIntro()) is a ScrollTrigger
      // firing on scroll CROSSING "top 75%" of .closing — that's built for a
      // gradual scroll, and landing here is an instant position jump instead
      // (intro/#story just vanished, scrollY snapped straight to 0), which
      // isn't guaranteed to register as a clean crossing. Forcing it
      // directly removes that dependency instead of hoping the trigger
      // fires; overwrite:true so it wins over whatever state that
      // ScrollTrigger tween is in.
      gsap.to('.closing-item', { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', overwrite: true });
    })
    // Starts right on top of the .closing-item reveal above (was '+=0.4',
    // a beat AFTER it) — the summary fades in while the overlay is still
    // mostly black and only just starting to clear, so it reads as
    // appearing on the same dark screen as the logo instead of the
    // overlay fully clearing first and revealing a new one underneath.
    .to(overlay, {
      opacity: 0, duration: 1.0, ease: 'power1.out',
      onComplete: () => { overlay.style.pointerEvents = 'none'; },
    }, '<');
}
