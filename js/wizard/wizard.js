import { state } from '../state.js';
import { STEP_TITLES, STEP_INSTRUCTIONS, FINISH_LABELS } from '../constants.js';
import { renderQuoteSummary } from './step-quote.js';

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
  // Step 5 is the end of the line for the generic prev/next control —
  // "Solicitar cotización" is the only forward action from here, so the
  // next button would just be dead weight (scroll-advance.js already
  // doesn't let it do anything on step 5 either).
  document.getElementById('nav-next-btn').classList.toggle('hidden', newStep === 5);
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
  // Mobile's own fixed-position twin of `heading` (see the comment on
  // #step-heading-mobile in scroll_full.html) — kept in sync here rather
  // than duplicating goToStep's whole call site.
  const mobileHeading = document.getElementById('designer-heading-mobile');
  if (mobileHeading) mobileHeading.textContent = STEP_TITLES[newStep];
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
  // snaps to a fixed pose and stays there for the whole step. Runs on
  // mobile too now (used to be desktop-only) — the horizontal step-4 lock
  // in particular should look the same everywhere, not just on desktop.
  if (state.capsuleGroup) {
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
}
