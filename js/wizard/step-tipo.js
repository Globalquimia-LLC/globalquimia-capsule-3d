import { state } from '../state.js';
import { TIPO_OPTIONS, DEFAULT_TIPO_INDEX } from '../constants.js';
import { goToStep } from './wizard.js';

// ---------------------------------------------------------------------
// 1. Tipo de cápsula — selection-only, doesn't affect the 3D model.
// ---------------------------------------------------------------------
export function initStepTipo() {
  state.selectedTipo = TIPO_OPTIONS[DEFAULT_TIPO_INDEX];

  const list = document.getElementById('tipo-list');

  // Built once — a click only toggles .selected on the existing buttons,
  // never rebuilds the DOM, so the entrance stagger (revealStepChildren)
  // plays exactly once instead of replaying every time someone picks an
  // option.
  TIPO_OPTIONS.forEach((label, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'option-row' + (i === DEFAULT_TIPO_INDEX ? ' selected' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      list.querySelectorAll('.option-row').forEach((row) => row.classList.toggle('selected', row === btn));
      state.selectedTipo = label;
      goToStep(2);
    });
    list.appendChild(btn);
  });
}
