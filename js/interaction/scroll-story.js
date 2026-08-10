import { state } from '../state.js';
import { CAP_OPEN_DELTA, ROTATION_CHASE_WINDOW_MS } from '../constants.js';
import { revealStepChildren } from '../wizard/wizard.js';
import { reframeCapsuleCamera, reframeDesktopWizardCapsule, resetDesktopWizardCapsule } from '../scene.js';

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
        const wizardActive = self.progress > 0.93;
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
        // Desktop equivalent of the mobile docking above — narrows
        // #canvas-container to the real gap between #step-number and
        // #designer (measured fresh, not a scroll-scrubbed DOM shift tuned
        // by hand) instead of leaving it full-bleed and hoping the capsule's
        // own on-screen footprint happens to land clear of both. See
        // reframeDesktopWizardCapsule in scene.js.
        if (state.isDesktopLayout && wizardActive !== canvasContainer.classList.contains('wizard-centered')) {
          canvasContainer.classList.toggle('wizard-centered', wizardActive);
          if (wizardActive) reframeDesktopWizardCapsule();
          else resetDesktopWizardCapsule();
        }
        if (!state.hasRevealedStep1 && wizardActive) {
          state.hasRevealedStep1 = true;
          revealStepChildren(document.querySelector('.step-panel[data-step="1"]'));
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

  // Stage 5 (0.90 -> 1.0): "Diseña tu cápsula" panel fades in on the right.
  // The capsule no longer moves via a scroll-scrubbed DOM shift here on
  // desktop — the onUpdate above narrows #canvas-container to the real
  // gap between the step number and this panel the moment wizardActive
  // flips true (see reframeDesktopWizardCapsule), which is more reliable
  // than trying to time a matching tween to the same moment by hand.
  tl.fromTo(designerInner, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.1, overwrite: false }, 0.90);

  // Text overlays keyed to the same timeline. Each grows FROM small while
  // fading in, holds at full size, then grows FURTHER while fading out —
  // size is tied to scroll position throughout, not just opacity.
  const zones = {
    1: [0.02, 0.24],
    2: [0.32, 0.52],
    3: [0.60, 0.69],
  };
  Object.entries(zones).forEach(([stage, [inAt, outAt]]) => {
    const el = document.querySelector('#stage-' + stage + ' .inner');
    tl.fromTo(el,
      { opacity: 0, scale: 0.62 },
      { opacity: 1, scale: 1, duration: 0.06, ease: 'power2.out', overwrite: false },
      inAt
    );
    tl.to(el,
      { opacity: 0, scale: 1.4, duration: 0.06, ease: 'power2.in', overwrite: false },
      outAt
    );
  });
}
