import { state } from '../state.js';
import { STEP_TITLES, STEP_INSTRUCTIONS, FINISH_LABELS } from '../constants.js';
import { renderQuoteSummary } from './step-quote.js';

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

// Short accumulated-choice chips, shown from step 1 onward — not just in
// the step 5 summary — so the running selection is always visible.
export function updateRunningSummary() {
  const el = document.getElementById('running-summary');
  if (!el) return;
  const { selectedTipo, selectedSize, appliedColor, customization } = state;
  const chips = [
    selectedTipo.replace(/\s*-\s*[A-Z-]+$/, ''),
    `Talla ${selectedSize.code}`,
    `${FINISH_LABELS[appliedColor.cap.finish]} tapa ${appliedColor.cap.hex.toUpperCase()}`,
    `${FINISH_LABELS[appliedColor.body.finish]} cuerpo ${appliedColor.body.hex.toUpperCase()}`,
  ];
  if (customization.cap.logoName || customization.body.logoName) chips.push('Con logo');
  if (customization.cap.text || customization.body.text) chips.push('Con texto grabado');
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

  gsap.to(inner, {
    opacity: 0, y: -6, duration: 0.22, ease: 'power2.in',
    onComplete: () => {
      if (oldPanel) oldPanel.classList.remove('active');
      if (newPanel) newPanel.classList.add('active');
      heading.textContent = STEP_TITLES[newStep];
      instruction.textContent = STEP_INSTRUCTIONS[newStep];
      gsap.fromTo(inner, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
      revealStepChildren(newPanel);
      if (newStep === 5) renderQuoteSummary();
    },
  });

  gsap.to(stepNumberEl, {
    opacity: 0, duration: 0.25, ease: 'power1.in',
    onComplete: () => {
      stepNumberEl.innerHTML = `<span class="of-total">Paso ${newStep} de 5</span>${newStep}`;
      gsap.to(stepNumberEl, { opacity: 1, duration: 0.3, ease: 'power1.out' });
    },
  });
  // The capsule keeps turning to greet each new step (a bit of motion, not
  // a side swap) — same fixed left/right layout throughout.
  if (state.isDesktopLayout && state.capsuleGroup) {
    gsap.to(state.capsuleGroup.rotation, { y: state.capsuleGroup.rotation.y + Math.PI * 0.6, duration: 0.95, ease: 'power3.inOut' });
  }
}

export function initWizardShell() {
  document.getElementById('step-back').addEventListener('click', () => goToStep(state.currentStep - 1));
}
