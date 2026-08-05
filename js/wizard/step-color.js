import { state } from '../state.js';
import { PALETTE, METAL_PALETTE, FINISH_PROPS } from '../constants.js';
import { updateRunningSummary } from './wizard.js';

function hexToRgbString(hexStr) {
  const n = parseInt(hexStr.replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgb(${r}, ${g}, ${b})`;
}

// Updates the on-screen controls (Pickr swatch button, hex/rgb readout,
// selected quick-swatch) for one finish+piece pair without touching the 3D
// material — used to give Mate a starting display value even when its
// finish isn't the one currently applied to the mesh.
function refreshDisplay(target, finishKey, hexStr) {
  const readout = document.getElementById(`readout-${finishKey}-${target}`);
  if (readout) readout.textContent = hexStr.toUpperCase() + ' · ' + hexToRgbString(hexStr);
  document.querySelectorAll(`.quick-swatches[data-finish="${finishKey}"][data-target="${target}"] .swatch`).forEach((s) => {
    s.classList.toggle('selected', s.dataset.hex === hexStr.toLowerCase());
  });
  const pickr = state.pickrInstances[`${finishKey}-${target}`];
  if (pickr) {
    // silent=true on both: don't re-fire 'change' and loop back into
    // setPieceColor. setColor() alone only updates the popup's own
    // internal state (palette cursor position, etc) — applyColor() is
    // what actually pushes that color to the button's own swatch.
    pickr.setColor(hexStr, true);
    pickr.applyColor(true);
  }
}

// Applies a color AND a finish (roughness/metalness) to the actual 3D
// material, then syncs that finish's own controls to match. Exported so
// wizard.js's resetWizard() can re-apply the original defaults.
export function setPieceColor(target, finishKey, hexStr, material) {
  material.color.set(hexStr);
  const props = FINISH_PROPS[finishKey];
  material.roughness = props.roughness;
  material.metalness = props.metalness;
  state.appliedColor[target] = { finish: finishKey, hex: hexStr };
  refreshDisplay(target, finishKey, hexStr);
  updateRunningSummary();
}

function buildSwatchGroup(container, finishKey, target, material, palette) {
  palette.forEach((c) => {
    const hexStr = '#' + c.hex.toString(16).padStart(6, '0');
    const btn = document.createElement('div');
    btn.className = 'swatch';
    btn.title = c.name;
    btn.dataset.hex = hexStr;
    btn.style.backgroundColor = hexStr;
    btn.addEventListener('click', () => setPieceColor(target, finishKey, hexStr, material));
    container.appendChild(btn);
  });
}

// Builds an inline (always-visible, not popup) Pickr panel directly into
// a finish+piece's .picker-mount — a bigger, richer embedded selector:
// palette + hue slider, plus the brand palette as Pickr's own native
// swatch row (not a separate custom one). Only one finish+piece's mount
// is visible at a time (Tapa/Cuerpo tabs), so this only ever builds the
// picker actually being shown.
function createColorPicker(target, finishKey, material, initialHex) {
  if (typeof Pickr === 'undefined') {
    // Fails loudly instead of the mount silently staying empty — that's
    // indistinguishable from "it's broken".
    console.error('Pickr (vendor/pickr.min.js) failed to load.');
    return null;
  }
  const pickr = Pickr.create({
    el: `#mount-${finishKey}-${target}`,
    theme: 'classic',
    default: initialHex,
    inline: true,
    swatches: PALETTE.map((c) => '#' + c.hex.toString(16).padStart(6, '0')),
    components: {
      preview: true,
      opacity: false,
      hue: true,
      // rgba/hsla/hsva/cmyk format toggles render but don't actually
      // switch the value in this vendored build (clicking them is a
      // no-op — verified live) — hex + free typing is what actually
      // works, so that's all that's offered.
      interaction: { hex: true, input: true, save: false },
    },
  });
  pickr.on('change', (color) => {
    const hexStr = '#' + color.toHEXA().toString().replace('#', '').slice(0, 6);
    setPieceColor(target, finishKey, hexStr, material);
  });
  // inline:true only changes how the popup is POSITIONED (in-flow vs a
  // floating overlay) — it does NOT make it visible on its own, and it
  // still runs its normal "click outside closes it" popup logic (any
  // click on the Tapa/Cuerpo tabs counts as "outside" and hides it).
  // Since visibility here is actually controlled by .picker-mount's own
  // CSS display (the tab switcher), force it to ignore Pickr's own
  // close attempts entirely — it should never really "close".
  pickr.show();
  pickr.on('hide', () => pickr.show());
  return pickr;
}

// Called from scene.js once the GLTF has loaded and capMaterial/bodyMaterial exist.
export function buildAllColorControls() {
  ['cap', 'body'].forEach((target) => {
    const material = target === 'cap' ? state.capMaterial : state.bodyMaterial;
    const defaultHex = target === 'cap' ? '#2e8ad6' : '#f8f8f8';

    ['tradicionales', 'mate'].forEach((finishKey) => {
      state.pickrInstances[`${finishKey}-${target}`] = createColorPicker(target, finishKey, material, defaultHex);
      refreshDisplay(target, finishKey, defaultHex);
    });

    const metalContainer = document.querySelector(`.quick-swatches[data-finish="metalizados"][data-target="${target}"]`);
    buildSwatchGroup(metalContainer, 'metalizados', target, material, METAL_PALETTE);

    // The mesh actually starts on Tradicionales at the original default hex.
    setPieceColor(target, 'tradicionales', defaultHex, material);
  });
}
