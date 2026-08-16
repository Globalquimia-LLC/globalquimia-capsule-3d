import * as THREE from 'three';
import { state } from '../state.js';
import { CAP_OPEN_DELTA, ROTATION_CHASE_WINDOW_MS } from '../constants.js';
import { revealStepChildren } from '../wizard/wizard.js';
import { reframeCapsuleCamera } from '../scene.js';

// Reused across calls purely to avoid allocating 8 new Vector3s every time
// this runs — computeDesktopCapsuleShiftPercent overwrites their contents
// each call, nothing here holds state between calls.
const BOX_CORNERS = Array.from({ length: 8 }, () => new THREE.Vector3());

// Desktop-only: how far to shift #canvas-container (xPercent) so the
// capsule ends up centered in the real gap BETWEEN .step-number (left)
// and .designer (right). Earlier versions of this estimated the capsule's
// on-screen position from its geometric origin plus a hand-tuned "visual
// bulk" correction constant — that worked for whichever single pose it
// was screenshotted against, then quietly drifted on every other pose
// (rotating normally on steps 1-3 vs. step 4's distinct locked angle) and
// every other screen width, since none of that was ever really measured.
//
// This instead projects the capsule's actual current Box3 (its real
// world-space bounding box, whatever rotation/zoom it's in right now)
// through the live camera to get its REAL on-screen left/right edges in
// pixels, and solves for the exact shift that centers THAT between the
// two DOM elements' real edges — no estimation, no per-pose constants to
// re-tune. Self-correcting by construction: it always measures the
// capsule's current actual screen position (via #canvas-container's own
// getBoundingClientRect, which already reflects whatever shift is
// currently applied) rather than assuming where a previous call left it.
export function computeDesktopCapsuleShiftPercent() {
  const { camera, capsuleGroup } = state;
  const container = document.getElementById('canvas-container');
  const rect = container.getBoundingClientRect();
  if (!camera || !capsuleGroup || !rect.width) return 0;

  const box = new THREE.Box3().setFromObject(capsuleGroup);
  let i = 0;
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        BOX_CORNERS[i++].set(x, y, z).project(camera);
      }
    }
  }
  let minScreenX = Infinity;
  let maxScreenX = -Infinity;
  for (const corner of BOX_CORNERS) {
    const screenX = (corner.x * 0.5 + 0.5) * rect.width;
    minScreenX = Math.min(minScreenX, screenX);
    maxScreenX = Math.max(maxScreenX, screenX);
  }
  const capsuleCenterPx = rect.left + (minScreenX + maxScreenX) / 2;

  // Asymmetric on purpose: .step-number is a translucent watermark BEHIND
  // the capsule (z-index:1 vs the canvas's 2) — some overlap there is the
  // original intended "peeking out from behind" look, not a bug, so a
  // small gap is enough. .designer's option list/color panel/etc. is
  // real, opaque, clickable content, so this side gets a wider margin.
  const numberRightEdge = document.getElementById('step-number').getBoundingClientRect().right + 24;
  const designerLeftEdge = document.getElementById('designer').getBoundingClientRect().left - 40;
  const desiredCenterPx = (numberRightEdge + designerLeftEdge) / 2;

  const currentXPercent = gsap.getProperty(container, 'xPercent') || 0;
  const deltaPx = desiredCenterPx - capsuleCenterPx;
  return currentXPercent + (deltaPx / rect.width) * 100;
}

// Re-centers #canvas-container between the step number and the designer
// panel using CURRENT layout — called again on every step change and on
// window resize (see wizard.js's goToStep and the listener below), not
// just once when the wizard first opens. A shift computed once for step
// 1's own layout and then left alone doesn't track a wider window or a
// step whose panel content genuinely reflows the designer's real
// boundaries, which is what let the capsule drift under the color/design
// panels on some screen sizes. Desktop only — mobile stacks the capsule
// above the panel instead, nothing to re-center there.
export function reapplyDesktopCapsuleShift() {
  if (!state.isDesktopLayout) return;
  const designerEl = document.getElementById('designer');
  if (!designerEl || !designerEl.classList.contains('active')) return;
  gsap.to('#canvas-container', {
    xPercent: computeDesktopCapsuleShiftPercent(),
    duration: 0.4,
    ease: 'power2.out',
    overwrite: 'auto',
  });
}

let resizeShiftScheduled = false;
window.addEventListener('resize', () => {
  if (resizeShiftScheduled) return;
  resizeShiftScheduled = true;
  requestAnimationFrame(() => {
    resizeShiftScheduled = false;
    reapplyDesktopCapsuleShift();
  });
});

// The main scroll-driven narrative: capsule spin/zoom/open-close synced to
// a pinned #story section, ending with the wizard fading in. Called once
// from scene.js's GLTF-load callback (needs maxDim/camDist from the
// loaded model's actual bounding box).
export function initScrollStory(maxDim, camDist) {
  const { camera } = state;
  const designerEl = document.getElementById('designer');
  const designerInner = designerEl.querySelector('.inner');
  const canvasContainer = document.getElementById('canvas-container');

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '#story',
      start: 'top top',
      end: '+=380%',
      scrub: 1,
      pin: true,
      // Safety net for fast/aggressive scrolling: normalizeScroll paces
      // wheel/touch input, but it still drives scroll through its own
      // engine rather than the browser's native scroll — a wheel-event
      // preventDefault() elsewhere (scroll-advance.js) can't reliably stop
      // it from occasionally pushing past `end` before the wizard is done
      // (still on step 1/2, nothing picked yet). onLeave fires exactly
      // when that happens; if the closing tunnel hasn't actually started
      // yet, snap straight back to the pin's own end instead of letting
      // .closing appear before the wizard has been completed.
      onLeave: (self) => {
        if (state.tunnelStarted) return;
        if (state.scrollNormalizer) state.scrollNormalizer.scrollY(self.end);
        else window.scrollTo(0, self.end);
      },
      onUpdate: (self) => {
        // Re-armed on every active scrub tick — see ROTATION_CHASE_WINDOW_MS.
        // Idle scroll (no ticks) means this stops refreshing and the chase
        // naturally stops too, instead of pulling the capsule back toward a
        // stale target while the user's just left it dragged.
        state.chaseUntil = performance.now() + ROTATION_CHASE_WINDOW_MS;
        document.getElementById('progress-fill').style.height = (self.progress * 100) + '%';
        let wizardActive = self.progress > 0.93;

        // Once the wizard has been entered there's no legitimate way back
        // into the pre-wizard cinematic (see scroll-advance.js's own
        // comment: step 1 is a hard floor) — but wheel events over a
        // <input type="range"> or .picker-mount are deliberately excluded
        // from step-navigation interception there (so native "wheel over
        // the slider" behavior keeps working), which leaves real page
        // scroll uncaught in that one case. On step 4 (Design), which is
        // full of range sliders (logo/text rotation, scale, font size),
        // scrolling back with the cursor over one of them let that
        // uncaught scroll drag this pinned timeline's own progress back
        // below the threshold — instantly popping the rotation/dolly/
        // cap-open cinematic back to life mid-wizard (reported 2026-08-16:
        // going step 4 -> 3 made the capsule "fall apart" into the
        // pre-step-1 animation). Once locked in, clamp progress from ever
        // dropping back below the threshold instead of trusting every
        // possible scroll source to have been intercepted upstream.
        if (state.wizardScrollLocked && !wizardActive) {
          const target = self.start + (self.end - self.start) * 0.94;
          if (state.scrollNormalizer) state.scrollNormalizer.scrollY(target);
          else window.scrollTo(0, target);
          wizardActive = true;
        }

        designerEl.classList.toggle('active', wizardActive);
        document.getElementById('step-number').classList.toggle('visible', wizardActive);
        document.getElementById('step-heading-mobile').classList.toggle('visible', wizardActive);
        document.getElementById('nav-controls').classList.toggle('visible', wizardActive);
        document.getElementById('stepper-mobile').classList.toggle('visible', wizardActive);
        // Mobile only: the capsule fills the whole #story otherwise, which
        // is what the intro/story cinematic zoom needs — but once the
        // wizard's own bottom-anchored card takes over most of the screen,
        // a full-bleed capsule floats in whatever gap is left over instead
        // of occupying a predictable spot. Docking it to a fixed top band
        // (see the mobile CSS) the moment the wizard activates keeps the
        // capsule in the same place regardless of how tall any given
        // step's content is; reframeCapsuleCamera re-fits it to that
        // band's own aspect ratio right after the class change takes
        // layout effect (classList.toggle is synchronous; the CSS applies
        // before the next line runs).
        if (!state.isDesktopLayout && wizardActive !== canvasContainer.classList.contains('docked')) {
          canvasContainer.classList.toggle('docked', wizardActive);
          // Undocking (leaving the wizard) resets any mobile pinch/button
          // zoom back to the default framing — otherwise re-entering the
          // wizard on a later visit would start pre-zoomed with no visual
          // explanation why.
          if (!wizardActive) state.mobileZoomFactor = 1;
          reframeCapsuleCamera();
        }
        if (!state.hasRevealedStep1 && wizardActive) {
          state.hasRevealedStep1 = true;
          revealStepChildren(document.querySelector('.step-panel[data-step="1"]'));
          // Not measured immediately: self.progress (driving wizardActive)
          // is the RAW scroll position, but the capsule's own rotation/
          // dolly are riding this same timeline's scrub:1 smoothing — up
          // to a real second of lag behind wherever progress just jumped
          // to. Measuring the capsule's Box3 before that catches up reads
          // a mid-transition pose (still zoomed in from the story, not yet
          // settled into step 1's), which is exactly what produced a
          // wildly wrong shift the one time this ran on a fast/bursty
          // scroll. Outlasts the smoothing window on purpose.
          setTimeout(reapplyDesktopCapsuleShift, 1100);
        }

        // Once the wizard is showing, normalizeScroll's own scroll engine
        // is exactly what let a plain wheel/touch event slip past the pin
        // into .closing even on step 1 — a preventDefault() in
        // tryAdvanceOnScroll stops the BROWSER's native scroll, but not
        // normalizeScroll's separate internal one, which kept nudging
        // scrollY forward on its own regardless. Disabling it here hands
        // scroll fully back to native behavior (which preventDefault DOES
        // stop) for as long as the wizard is up, and re-enables it the
        // moment scrolling back out drops below the threshold again, so
        // the earlier scroll-driven story stages stay paced as before.
        if (state.scrollNormalizer && wizardActive !== state.wizardScrollLocked) {
          state.wizardScrollLocked = wizardActive;
          if (wizardActive) state.scrollNormalizer.disable();
          else state.scrollNormalizer.enable();
        }
      },
    },
  });
  // Cached so scroll-advance.js's tryAdvanceOnScroll doesn't have to run
  // ScrollTrigger.getAll().find(...) — an O(n) scan across every trigger
  // on the page — on every single wheel/touch tick.
  state.storyScrollTrigger = tl.scrollTrigger;

  // Camera dolly: scale ALONG the fixed viewing direction (baseDir), not a
  // single axis — the camera sits at an angled 3/4 position, so animating
  // camera.position.z alone would drift off-angle instead of zooming.
  const dollyState = { dist: camDist };
  // Re-derives scene.js's aspectPad from the camDist it already computed
  // (rather than a second parameter) — every stage below was tuned as a
  // fixed maxDim multiple against a desktop aspect, same as camDist itself,
  // so each one needs the same narrow-viewport correction to stay
  // proportionally consistent through the whole zoom sequence instead of
  // snapping back to "too big" the moment stage 2 kicks in. The 2.6 here is
  // deliberately always scene.js's DESKTOP_CAM_DIST_MULT, never the mobile
  // one (2.0) — dividing by the desktop constant regardless of which one
  // actually produced camDist means this ratio comes out to exactly 1 on
  // desktop (a true no-op, matching the original framing) and to
  // aspectPad(aspect) scaled by mobile's own size boost on mobile, so
  // every dolly stage below inherits that same ~30%-bigger sizing
  // end-to-end instead of only the initial pose getting bigger and every
  // later stage snapping back to desktop scale the moment scroll starts.
  const aspectPad = camDist / (maxDim * 2.6);
  function applyDolly() {
    camera.position.copy(camera.userData.baseDir).multiplyScalar(dollyState.dist);
    camera.lookAt(0, 0, 0);
  }

  // Stage 1 (0 -> 0.29): closed, slow spin
  tl.to(state.rotationTarget, { y: Math.PI * 0.85, duration: 0.29, ease: 'power1.inOut' }, 0);

  // Stage 2 (0.29 -> 0.58): zoom in while the cap slides open
  tl.to(dollyState, { dist: maxDim * 1.35 * aspectPad, duration: 0.29, ease: 'power2.inOut', onUpdate: applyDolly }, 0.29);
  tl.to({ p: 0 }, {
    p: 1,
    duration: 0.29,
    ease: 'power2.inOut',
    onUpdate: function () {
      if (state.capNode) state.capNode.position.z = CAP_OPEN_DELTA * this.targets()[0].p;
    },
  }, 0.29);

  // The capsule is centered and zooming in right as stage-2's text (on the
  // RIGHT) appears, getting BIGGEST right at the end of the zoom (0.58) —
  // so the shift has to stay in effect for the entire zoom, not retreat
  // early, or the closest approach (the actual collision risk) happens
  // right as it's un-shifting back to center. Same DOM-level shift
  // technique as the designer-stage move, just larger + held longer.
  if (state.isDesktopLayout) {
    tl.to(canvasContainer, { xPercent: -22, yPercent: -9, duration: 0.05, ease: 'power1.inOut' }, 0.30);
    tl.to(canvasContainer, { xPercent: 0, yPercent: 0, duration: 0.05, ease: 'power1.inOut' }, 0.58);
  }

  // Stage 3 (0.58 -> 0.72): open, continued spin, ease out a touch
  tl.to(state.rotationTarget, { y: Math.PI * 1.35, duration: 0.14, ease: 'power1.out' }, 0.58);
  tl.to(dollyState, { dist: maxDim * 1.9 * aspectPad, duration: 0.14, ease: 'power2.inOut', onUpdate: applyDolly }, 0.58);

  // Stage 4 (0.72 -> 0.87): the cap slides back CLOSED, settling to a clean
  // angle + comfortable distance for the color picker
  tl.to({ p: 1 }, {
    p: 0,
    duration: 0.15,
    ease: 'power1.inOut',
    onUpdate: function () {
      if (state.capNode) state.capNode.position.z = CAP_OPEN_DELTA * this.targets()[0].p;
    },
  }, 0.72);
  tl.to(state.rotationTarget, { y: Math.PI * 1.5, duration: 0.15, ease: 'power1.inOut' }, 0.72);
  tl.to(dollyState, { dist: maxDim * 2.3 * aspectPad, duration: 0.15, ease: 'power2.inOut', onUpdate: applyDolly }, 0.72);

  // Stage 5 (0.90 -> 1.0): the designer panel fades in on the right; the
  // capsule (rendered by #canvas-container, shifted at the DOM level —
  // not the 3D camera — so the move is purely horizontal, no perspective
  // skew) slides left just enough to center it between the step number
  // and the panel. That shift is NOT baked in here as a static value on
  // this scrubbed timeline — a number computed once when the timeline was
  // built (and replayed by the scrub every time progress crosses back
  // over 0.90) fought reapplyDesktopCapsuleShift()'s own step-by-step,
  // resize-aware version below, the two visibly wrestling over
  // #canvas-container's xPercent. Left entirely to reapplyDesktopCapsuleShift
  // (called from the wizardActive block in onUpdate below, and again on
  // every step change / resize).
  tl.fromTo(designerInner, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.1, overwrite: false }, 0.90);
  if (state.isDesktopLayout) {
    designerEl.classList.add('side-right');
  }

  // Text overlays keyed to the same timeline. Each grows FROM small while
  // fading in, holds at full size, then grows FURTHER while fading out —
  // size is tied to scroll position throughout, not just opacity. Stage 0
  // (the former standalone intro hero, now living beside the capsule from
  // the very first frame) and stage 1 share camera-Stage 1's own rotation
  // (0 -> 0.29 above) rather than getting a dedicated motion stage of its
  // own — just two text beats riding the same "closed, slow spin" pose.
  const zones = {
    0: [0.00, 0.11],
    1: [0.13, 0.24],
    2: [0.32, 0.52],
    3: [0.60, 0.69],
  };
  Object.entries(zones).forEach(([stage, [inAt, outAt]]) => {
    const el = document.querySelector('#stage-' + stage + ' .inner');
    if (stage === '0') {
      // Visible from the very first frame, no scroll needed — this is the
      // one stage a first-time visitor sees without having scrolled at
      // all yet, so there's no "fade in" beat to scrub toward; it's just
      // already there, and fades out like every other stage once scrolled
      // past its zone.
      gsap.set(el, { opacity: 1, scale: 1 });
    } else {
      tl.fromTo(el,
        { opacity: 0, scale: 0.62 },
        { opacity: 1, scale: 1, duration: 0.06, ease: 'power2.out', overwrite: false },
        inAt
      );
    }
    tl.to(el,
      { opacity: 0, scale: 1.4, duration: 0.06, ease: 'power2.in', overwrite: false },
      outAt
    );
  });
}
