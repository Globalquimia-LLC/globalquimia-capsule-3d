import { state } from '../state.js';
import { SIZE_OPTIONS, SIZE_WALL_MM, SIZE_REFERENCE_LENGTH, DISPLAY_SCALE } from '../constants.js';
import { goToStep } from './wizard.js';

// ---------------------------------------------------------------------
// 2. Size — selection-only. Dimensions are real published capsule
// sizes (Torpac/ACG technical charts, same source used for the 3D
// model's own "0" geometry); wall thickness is near-constant across
// sizes for a given capsule type, hence the fixed 0.30mm shown for all.
// ---------------------------------------------------------------------
function capsuleIconSVG(lengthMm, maxLengthMm) {
  const w = 22 + Math.round(28 * (lengthMm / maxLengthMm));
  const h = 14;
  const r = h / 2;
  const capW = w * 0.42;
  return `<svg class="capsule-icon" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    <rect class="body-half" x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}"></rect>
    <path class="cap-half" d="M ${r} 0 H ${capW} V ${h} H ${r} A ${r} ${r} 0 0 1 ${r} 0 Z"></path>
  </svg>`;
}

export function initStepTamano() {
  state.selectedSize = SIZE_OPTIONS[0];

  const list = document.getElementById('size-list');
  const maxLen = Math.max(...SIZE_OPTIONS.map((s) => s.length));

  function labelFor(opt) {
    return `${opt.code} (${opt.length.toFixed(2)} L x ${SIZE_WALL_MM.toFixed(2)} W mm)`;
  }

  // Built once — see step-tipo.js for why (avoids replaying the entrance
  // stagger on every click).
  SIZE_OPTIONS.forEach((opt) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'size-row' + (opt === SIZE_OPTIONS[0] ? ' selected' : '');
    btn.innerHTML = capsuleIconSVG(opt.length, maxLen) + `<span>${labelFor(opt)}</span>`;
    btn.addEventListener('click', () => {
      list.querySelectorAll('.size-row').forEach((row) => row.classList.toggle('selected', row === btn));
      state.selectedSize = opt;
      if (state.capsuleGroup) {
        const ratio = (opt.length / SIZE_REFERENCE_LENGTH) * DISPLAY_SCALE;
        gsap.to(state.capsuleGroup.scale, { x: ratio, y: ratio, z: ratio, duration: 1.0, ease: 'back.out(1.15)' });
      }
      goToStep(3);
    });
    list.appendChild(btn);
  });
}
