import { state } from '../state.js';
import { STEP_TITLES, STEP_INSTRUCTIONS, FINISH_LABELS, TIPO_OPTIONS, DEFAULT_TIPO_INDEX, SIZE_OPTIONS } from '../constants.js';
import { renderQuoteSummary } from './step-quote.js';
import { setPieceColor } from './step-color.js';
import { resetDesignCustomization } from './step-design.js';

// The pose the capsule locks to for step 4: long axis horizontal AND
// perpendicular to the viewer (lying flat across the screen, full side
// visible — not angled toward/away from the camera). Derived from the
// camera's own fixed viewing direction rather than a hand-picked angle, so
// it stays correct if scene.js's camera yaw/pitch ever changes: the
// capsule's local Z axis, after a pure Y-rotation by theta, points at
// world (sin(theta), 0, cos(theta)) — solving for that to be parallel to
// the camera's world-space "right" vector (derived from baseDir, since the
// camera has no roll) gives theta = atan2(baseDir.z, -baseDir.x).
function computeStep4LockRotationY() {
  const dir = state.camera.userData.baseDir;
  return Math.atan2(dir.z, -dir.x);
}

export function updateStepper(step) {
  document.querySelectorAll('.stepper-item').forEach((item) => {
    const s = Number(item.dataset.step);
    item.classList.toggle('active', s === step);
    item.classList.toggle('completed', s < step);
  });
  document.querySelectorAll('.stepper-line').forEach((line, i) => {
    line.classList.toggle('completed', i + 1 < step);
  });
}

// Short accumulated-choice chips for steps already CONFIRMED (passed on
// the way forward) — tipo/tamaño/color all start out pre-filled with a
// sane default (see initStepTipo/initStepTamano) so the 3D capsule always
// has something to render, but a default nobody actually picked yet isn't
// a "choice" worth summarizing. Gating each chip behind currentStep means
// step 1 shows nothing at all until the user has actually moved past it,
// instead of a full-looking 4-chip summary appearing before any real pick.
export function updateRunningSummary() {
  const el = document.getElementById('running-summary');
  if (!el) return;
  const { currentStep, selectedTipo, selectedSize, appliedColor, customization } = state;
  const chips = [];
  if (currentStep > 1) chips.push(selectedTipo.replace(/\s*-\s*[A-Z-]+$/, ''));
  if (currentStep > 2) chips.push(`Talla ${selectedSize.code}`);
  if (currentStep > 3) {
    chips.push(`${FINISH_LABELS[appliedColor.cap.finish]} tapa ${appliedColor.cap.hex.toUpperCase()}`);
    chips.push(`${FINISH_LABELS[appliedColor.body.finish]} cuerpo ${appliedColor.body.hex.toUpperCase()}`);
  }
  if (currentStep > 4) {
    if (customization.cap.logoName || customization.body.logoName) chips.push('Con logo');
    if (customization.cap.text || customization.body.text) chips.push('Con texto grabado');
  }
  el.innerHTML = chips.map((c) => `<span class="chip">${c}</span>`).join('');
}

// Staggers a step panel's own top-level items in as it becomes visible —
// list rows for Tipo/Tamaño, the finish/logo-texto cards for Color and
// Logo y Texto. Called once for step 1 (when the designer itself first
// activates on scroll, from scroll-story.js) and every time goToStep
// reveals a panel — never at build time, since an animation started while
// display:none finishes invisibly and the step would just appear with no
// motion at all.
export function revealStepChildren(panel) {
  if (!panel) return;
  const targets = panel.querySelectorAll(':scope > .option-list > *, :scope > .size-list > *, :scope > .acc-menu > .acc-item');
  if (!targets.length) return;
  gsap.fromTo(targets,
    { opacity: 0, y: 12 },
    { opacity: 1, y: 0, duration: 0.45, stagger: 0.05, ease: 'power2.out' });
}

export function goToStep(newStep) {
  if (newStep === state.currentStep || newStep < 1 || newStep > 5) return;
  state.currentStep = newStep;

  const designerEl = document.getElementById('designer');
  const inner = designerEl.querySelector('.inner');
  const heading = document.getElementById('designer-heading');
  const instruction = document.getElementById('step-instruction');
  const backBtn = document.getElementById('step-back');
  const stepNumberEl = document.getElementById('step-number');
  const oldPanel = designerEl.querySelector('.step-panel.active');
  const newPanel = designerEl.querySelector(`.step-panel[data-step="${newStep}"]`);

  backBtn.classList.toggle('visible', newStep > 1);
  updateStepper(newStep);
  updateRunningSummary();

  // Everything that determines WHAT is showing (active panel, heading,
  // instruction, the step number itself) is applied immediately/
  // synchronously — never gated behind a tween's onComplete. Under a
  // contended GPU/tab-heavy browser, GSAP's own ticker can run far slower
  // than real time (its lag-smoothing spreads a stalled frame instead of
  // jumping), which used to leave the panel/number showing the *previous*
  // step for however long that tween took to catch up — sometimes several
  // seconds. The fade below is purely decorative on top of an already-
  // correct DOM; if it stutters or never gets a frame, the content is
  // still right.
  if (oldPanel) oldPanel.classList.remove('active');
  if (newPanel) newPanel.classList.add('active');
  heading.textContent = STEP_TITLES[newStep];
  instruction.textContent = STEP_INSTRUCTIONS[newStep];
  stepNumberEl.innerHTML = `<span class="of-total">Paso ${newStep} de 5</span>${newStep}`;
  if (newStep === 5) renderQuoteSummary();
  revealStepChildren(newPanel);

  // gsap.killTweensOf so a rapid string of steps doesn't pile up competing
  // fade tweens on the same elements — each new step's fade simply takes
  // over from wherever the last one got to.
  gsap.killTweensOf(inner);
  gsap.fromTo(inner, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
  gsap.killTweensOf(stepNumberEl);
  gsap.fromTo(stepNumberEl, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power1.out' });

  // Step 4 needs the capsule to hold still so logo/text placement is
  // predictable — computed fresh on every call (not "set true entering 4,
  // false entering 5") so going back 4 -> 3 also correctly unlocks it.
  state.rotationLocked = newStep === 4;
  state.container.classList.toggle('rotation-locked', state.rotationLocked);

  // The capsule keeps turning to greet each new step (a bit of motion, not
  // a side swap) — same fixed left/right layout throughout. Step 4 instead
  // snaps to a fixed pose and stays there for the whole step.
  if (state.isDesktopLayout && state.capsuleGroup) {
    gsap.killTweensOf(state.capsuleGroup.rotation);
    if (state.rotationLocked) {
      state.spinVelocityY = 0; // momentum isn't a tween — killTweensOf above doesn't touch it
      gsap.to(state.capsuleGroup.rotation, { x: 0, y: computeStep4LockRotationY(), duration: 0.9, ease: 'power3.inOut' });
    } else {
      gsap.to(state.capsuleGroup.rotation, { y: state.capsuleGroup.rotation.y + Math.PI * 0.6, duration: 0.95, ease: 'power3.inOut' });
    }
  }
}

export function initWizardShell() {
  document.getElementById('step-back').addEventListener('click', () => goToStep(state.currentStep - 1));
  document.getElementById('closing-redesign-btn').addEventListener('click', resetWizard);
}

// "Volver a diseñar la cápsula" (.closing, after a completed quote) — a
// full reset back to step 1, not just a scroll back. Only reachable once
// the tunnel has actually finished (tunnelStarted stays true past the
// "point of no return" — see tunnel.js), so currentStep is always 5 here.
export function resetWizard() {
  // Undo tunnel.js's "hide the intro + wizard entirely" — bringing #story
  // back into layout changes its height, so the ScrollTrigger refresh below
  // (right before using its .end) is what makes storyScrollTrigger's cached
  // start/end reflect that again instead of the collapsed display:none ones.
  document.documentElement.classList.remove('quote-complete');

  // progress(0) restores cap position, body orientation, camera position,
  // and overlay opacity to exactly what they were right before
  // playTunnelSequence() started — the same restoration .reverse() already
  // does via scroll-up, just instant instead of animated back through the
  // whole choreography. Then kill it outright so a later
  // playTunnelSequence() call builds a completely fresh timeline.
  if (state.tunnelTimeline) {
    state.tunnelTimeline.progress(0);
    state.tunnelTimeline.kill();
    state.tunnelTimeline = null;
  }
  state.tunnelStarted = false;
  state.tunnelPlaying = false;
  const overlay = document.getElementById('tunnel-overlay');
  overlay.style.opacity = 0;
  overlay.style.pointerEvents = 'none';
  document.getElementById('tunnel-logo').style.opacity = 0;

  state.selectedTipo = TIPO_OPTIONS[DEFAULT_TIPO_INDEX];
  document.querySelectorAll('#tipo-list .option-row').forEach((row, i) => {
    row.classList.toggle('selected', i === DEFAULT_TIPO_INDEX);
  });
  state.selectedSize = SIZE_OPTIONS.find((s) => s.code === '0');
  document.querySelectorAll('#size-list .size-row').forEach((row, i) => {
    row.classList.toggle('selected', SIZE_OPTIONS[i].code === '0');
  });
  if (state.capsuleGroup) state.capsuleGroup.scale.setScalar(1); // ratio for size '0' (the reference length) is 1

  // Re-applies to the actual materials, not just state, so the capsule
  // visually resets too — same defaults scene.js's GLTF-load callback
  // originally applied.
  if (state.capMaterial) setPieceColor('cap', 'tradicionales', '#2e8ad6', state.capMaterial);
  if (state.bodyMaterial) setPieceColor('body', 'tradicionales', '#f8f8f8', state.bodyMaterial);

  resetDesignCustomization();

  state.hasRevealedStep1 = false; // step 1's entrance stagger plays again, like a genuine first visit
  goToStep(1);

  // Land back on the wizard itself, not the very top of the page — .closing
  // sits well past #story's pin, so a plain "scroll to 0" would surface the
  // marketing intro before the wizard even starts, exactly the confusing
  // state this button exists to get out of. Same normalizer.scrollY()
  // pattern used everywhere else in this project for a programmatic jump,
  // for the same reason: a native scrollTo/scrollIntoView here would desync
  // from normalizeScroll's own position tracking.
  const st = state.storyScrollTrigger;
  if (st) {
    ScrollTrigger.refresh(); // re-measure #story's pin distance now that it's back in layout, so st.end below is current
    if (state.scrollNormalizer) {
      state.scrollNormalizer.enable();
      state.scrollNormalizer.scrollY(st.end);
    } else {
      window.scrollTo(0, st.end);
    }
  }
}
