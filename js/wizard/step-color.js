import { state } from '../state.js';
import { PALETTE, METAL_PALETTE, TRANSPARENT_PALETTE, FINISH_PROPS } from '../constants.js';
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
  document.querySelectorAll(`.quick-swatches[data-finish="${finishKey}"][data-target="${target}"] input[type="checkbox"]`).forEach((cb) => {
    cb.checked = cb.dataset.hex === hexStr.toLowerCase();
  });
  // Transparent's checkbox lives in its own group (data-finish="transparente"),
  // separate from whichever finishKey just got applied — keep it in sync
  // too, or switching to Traditional/Matte/Metallic while Transparent was
  // checked would leave it looking checked even though the material isn't
  // transparent anymore (see buildTransparentCheckboxGroup's uncheck path).
  if (finishKey !== 'transparente') {
    document.querySelectorAll(`.quick-swatches[data-finish="transparente"][data-target="${target}"] input[type="checkbox"]`).forEach((cb) => {
      cb.checked = false;
    });
  }
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
// material, then syncs that finish's own controls to match.
function setPieceColor(target, finishKey, hexStr, material) {
  material.color.set(hexStr);
  const props = FINISH_PROPS[finishKey];
  material.roughness = props.roughness;
  material.metalness = props.metalness;
  // Opacity/transparent applied unconditionally (not just for the
  // Transparent finish) so switching back to Traditional/Matte/Metallic
  // resets the mesh to fully opaque instead of staying see-through.
  material.transparent = props.transparent;
  material.opacity = props.opacity;
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

// Transparent uses checkboxes instead of plain color circles — at the
// user's request 2026-08-16, so it's unambiguous which option is applied
// (a lone white "Clear" swatch reads too subtly as selected/unselected on
// its own). No separate color-dot swatch alongside the checkbox (tried
// first, dropped 2026-08-16): "Clear"'s own color is white, so the dot
// rendered as a second, empty-looking circle right next to an already-
// checked checkbox — read as a confusing extra control rather than the
// color preview it was meant to be.
//
// Unlike Traditional/Matte/Metallic (switching between THOSE always
// applies a real color, never "none"), Transparent can be unchecked back
// off — at the user's request 2026-08-16, restoring whichever
// finish+color was actually active right before Transparent was picked
// (state.preTransparentColor, stashed the moment it's checked). Checking
// a DIFFERENT swatch elsewhere still behaves like a radio pick (only one
// finish is ever live) — refreshDisplay's own transparent-checkbox sync
// (above) is what un-checks this one when that happens.
function buildTransparentCheckboxGroup(container, target, material, palette) {
  palette.forEach((c) => {
    const hexStr = '#' + c.hex.toString(16).padStart(6, '0');
    const label = document.createElement('label');
    label.className = 'swatch-checkbox';
    label.title = c.name;

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.hex = hexStr;

    const name = document.createElement('span');
    name.className = 'swatch-checkbox-name';
    name.textContent = c.name;

    label.append(input, name);
    input.addEventListener('change', () => {
      if (input.checked) {
        if (state.appliedColor[target].finish !== 'transparente') {
          state.preTransparentColor[target] = { ...state.appliedColor[target] };
        }
        container.querySelectorAll('input[type="checkbox"]').forEach((other) => {
          if (other !== input) other.checked = false;
        });
        setPieceColor(target, 'transparente', hexStr, material);
      } else {
        const prev = state.preTransparentColor[target];
        if (prev) {
          setPieceColor(target, prev.finish, prev.hex, material);
        } else {
          // Nothing to fall back to (shouldn't happen — a real finish is
          // always applied once on load) — stay checked rather than
          // leaving the mesh with no active finish at all.
          input.checked = true;
        }
      }
    });
    container.appendChild(label);
  });
}

// Builds an inline (always-visible, not popup) Pickr panel directly into
// a finish+piece's .picker-mount — a bigger, richer embedded selector:
// palette + hue slider, plus the brand palette as Pickr's own native
// swatch row (not a separate custom one). Only one finish+piece's mount
// is visible at a time (Cap/Body tabs), so this only ever builds the
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
  // Dragging across the gradient square/hue slider fires 'change' on every
  // pixel of movement. At the user's request 2026-08-16 the capsule now
  // follows that live (applyLive below) instead of waiting for release —
  // but it deliberately does NOT call setPieceColor (full commit) on every
  // one of those ticks: setPieceColor's refreshDisplay calls
  // pickr.setColor()/applyColor() back on this SAME instance to keep its
  // swatch button in sync, and doing that WHILE Pickr is still tracking an
  // active drag fights the picker's own cursor (it recomputes the
  // gradient-square/hue-strip position from the round-tripped hex,
  // fighting wherever the pointer actually is). applyLive updates the 3D
  // material + hex/rgb readout only, leaving the picker instance itself
  // alone — 'changestop' (drag release, or the instant swatch/hex-input
  // picks below) is what runs the full commit once dragging is over. Also
  // skips updateRunningSummary() specifically (the one part of a full
  // commit that rebuilds a chip list's innerHTML) — the summary catching
  // up once on release instead of on every pixel is what keeps a drag
  // itself smooth.
  const applyLive = (color) => {
    const hexStr = '#' + color.toHEXA().toString().replace('#', '').slice(0, 6);
    material.color.set(hexStr);
    const props = FINISH_PROPS[finishKey];
    material.roughness = props.roughness;
    material.metalness = props.metalness;
    material.transparent = props.transparent;
    material.opacity = props.opacity;
    state.appliedColor[target] = { finish: finishKey, hex: hexStr };
    const readout = document.getElementById(`readout-${finishKey}-${target}`);
    if (readout) readout.textContent = hexStr.toUpperCase() + ' · ' + hexToRgbString(hexStr);
  };
  const commitColor = (color) => {
    const hexStr = '#' + color.toHEXA().toString().replace('#', '').slice(0, 6);
    setPieceColor(target, finishKey, hexStr, material);
  };
  pickr.on('change', (color, source) => {
    // Swatch clicks and hex-input edits are discrete picks, not a drag in
    // progress — commit immediately, same as before, rather than routing
    // them through the live-preview path meant for an active drag.
    if (source === 'swatch' || source === 'input') commitColor(color);
    else applyLive(color);
  });
  pickr.on('changestop', (_source, instance) => commitColor(instance.getColor()));
  // inline:true only changes how the popup is POSITIONED (in-flow vs a
  // floating overlay) — it does NOT make it visible on its own, and it
  // still runs its normal "click outside closes it" popup logic (any
  // click on the Cap/Body tabs counts as "outside" and hides it).
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

    const transparentContainer = document.querySelector(`.quick-swatches[data-finish="transparente"][data-target="${target}"]`);
    buildTransparentCheckboxGroup(transparentContainer, target, material, TRANSPARENT_PALETTE);

    // The mesh actually starts on Tradicionales at the original default hex.
    setPieceColor(target, 'tradicionales', defaultHex, material);
  });
}
