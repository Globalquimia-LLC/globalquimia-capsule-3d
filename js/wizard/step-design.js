import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { state } from '../state.js';
import { TEXT_COLOR_PALETTE, DECAL_CANVAS, DECAL_FONT_SIZE_RANGE, DECAL_ROTATION_RANGE, DECAL_SCALE_RANGE, FONT_FAMILIES, DECAL_MIN_LOGO_PX } from '../constants.js';
import { updateRunningSummary } from './wizard.js';

// ---------------------------------------------------------------------
// 4. Logo y Texto — the one section that must actually render onto the
// 3D capsule. Logo and text are independent decals (their own canvas,
// geometry, and placement) so each can be dragged to a different spot on
// the same piece — see decal-drag.js for the actual drag interaction;
// this module owns building/rebuilding the decal meshes themselves and
// the wizard-panel UI that feeds their content.
//
// Placement persistence: state.customization[target].placement.{logo,text}
// is null until first placed, then { localPoint, localNormal } in
// capsuleGroup-LOCAL space. Every rebuild converts that one stored local
// value against the CURRENT capsuleGroup.matrixWorld — never chained from
// a previous world value — so it survives the capsule rotating on other
// steps with zero drift. Only valid because capMeshObj/bodyMeshObj never
// move relative to capsuleGroup during steps 1-5 (capNode's own open/close
// offset is pinned for that whole span — see scroll-story.js/tunnel.js).
//
// One shared control block (Logo + Texto grabado) drives whichever piece
// is active — previously each section had its own independent Cap/Body
// copy, so switching piece in one didn't affect the other and it was easy
// to edit the wrong piece without noticing. Now presented as a Cap/Body
// tab switcher (see .piece-tabgroup in styles.css and initPieceTabs() in
// accordion.js, which owns the generic "swap which panel looks active"
// behavior) — this only needs to move #design-controls-shared into
// whichever tab's .piece-tab-panel was just clicked, and point it at that
// piece's stored data.
// ---------------------------------------------------------------------
let refreshLogoUI = () => {};
let refreshTextoUI = () => {};

function setupDesignPieceToggle() {
  const sharedControls = document.getElementById('design-controls-shared');
  const group = document.getElementById('design-piece-tabs');
  if (!group) return;
  group.querySelectorAll(':scope > .piece-tabs > .piece-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      state.activeDesignTarget = tab.dataset.target;
      group.querySelector(`:scope > .piece-tab-panels > .piece-tab-panel[data-target="${tab.dataset.target}"]`).appendChild(sharedControls);
      refreshLogoUI();
      refreshTextoUI();
    });
  });
}

// Rotation (degrees) + scale (percent) sliders — identical wiring for the
// logo and text sections, just targeting `${type}RotationDeg`/`${type}ScalePct`
// on the active piece's customization and rebuilding that type's decal.
// Returns a refresh() that syncs the sliders to whatever's active.
function setupRotateScaleControls(type, rotSlider, rotReadout, scaleSlider, scaleReadout) {
  rotSlider.min = DECAL_ROTATION_RANGE.min;
  rotSlider.max = DECAL_ROTATION_RANGE.max;
  rotSlider.step = DECAL_ROTATION_RANGE.step;
  scaleSlider.min = DECAL_SCALE_RANGE.min;
  scaleSlider.max = DECAL_SCALE_RANGE.max;
  scaleSlider.step = DECAL_SCALE_RANGE.step;

  const rotKey = type + 'RotationDeg';
  const scaleKey = type + 'ScalePct';

  rotSlider.addEventListener('input', () => {
    const target = state.activeDesignTarget;
    state.customization[target][rotKey] = Number(rotSlider.value);
    rotReadout.textContent = rotSlider.value + '°';
    scheduleDecalUpdate(target, type);
  });
  scaleSlider.addEventListener('input', () => {
    const target = state.activeDesignTarget;
    state.customization[target][scaleKey] = Number(scaleSlider.value);
    scaleReadout.textContent = scaleSlider.value + '%';
    scheduleDecalUpdate(target, type);
  });

  return () => {
    const s = state.customization[state.activeDesignTarget];
    rotSlider.value = s[rotKey];
    rotReadout.textContent = s[rotKey] + '°';
    scaleSlider.value = s[scaleKey];
    scaleReadout.textContent = s[scaleKey] + '%';
  };
}

function setupLogoSection() {
  const fileInput = document.getElementById('logo-file-input');
  const fileNameEl = document.getElementById('logo-file-name');
  const clearBtn = document.getElementById('logo-clear-btn');
  const errorEl = document.getElementById('logo-error');
  const warningEl = document.getElementById('logo-quality-warning');

  const refreshLogoTransform = setupRotateScaleControls(
    'logo',
    document.getElementById('logo-rotation-slider'), document.getElementById('logo-rotation-readout'),
    document.getElementById('logo-scale-slider'), document.getElementById('logo-scale-readout')
  );

  refreshLogoUI = () => {
    fileNameEl.textContent = state.customization[state.activeDesignTarget].logoName || 'No file selected';
    errorEl.hidden = true;
    warningEl.hidden = !state.customization[state.activeDesignTarget].logoImg
      || !state.customization[state.activeDesignTarget].logoLowRes;
    refreshLogoTransform();
  };

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (file.type !== 'image/png') {
      errorEl.textContent = 'The logo must be a PNG file (with transparency).';
      errorEl.hidden = false;
      warningEl.hidden = true;
      fileInput.value = '';
      return;
    }
    errorEl.hidden = true;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const target = state.activeDesignTarget;
        state.customization[target].logoImg = img;
        state.customization[target].logoName = file.name;
        // Non-blocking — a small but simple logo can still look fine, but a
        // low-res image projected onto the decal's physical size is the
        // most common way this ends up visibly pixelated.
        state.customization[target].logoLowRes = Math.min(img.width, img.height) < DECAL_MIN_LOGO_PX;
        refreshLogoUI();
        scheduleDecalUpdate(target, 'logo');
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  clearBtn.addEventListener('click', () => {
    fileInput.value = '';
    const target = state.activeDesignTarget;
    state.customization[target].logoImg = null;
    state.customization[target].logoName = '';
    state.customization[target].logoLowRes = false;
    state.customization[target].placement.logo = null; // fresh upload starts at the default spot again
    state.customization[target].logoRotationDeg = DECAL_ROTATION_RANGE.default;
    state.customization[target].logoScalePct = DECAL_SCALE_RANGE.default;
    refreshLogoUI();
    scheduleDecalUpdate(target, 'logo');
  });

  refreshLogoUI();
}

function setupTextoSection() {
  const input = document.getElementById('text-input');
  const sizeSlider = document.getElementById('font-size-slider');
  const sizeReadout = document.getElementById('font-size-readout');
  const familySelect = document.getElementById('font-family-select');
  const weightBtnsWrap = document.getElementById('font-weight-btns');
  const resetBtn = document.getElementById('text-reset-btn');
  const clearBtn = document.getElementById('text-clear-btn');
  const swatchWrap = document.getElementById('text-color-swatches');

  sizeSlider.min = DECAL_FONT_SIZE_RANGE.min;
  sizeSlider.max = DECAL_FONT_SIZE_RANGE.max;
  sizeSlider.step = DECAL_FONT_SIZE_RANGE.step;

  const refreshTextTransform = setupRotateScaleControls(
    'text',
    document.getElementById('text-rotation-slider'), document.getElementById('text-rotation-readout'),
    document.getElementById('text-scale-slider'), document.getElementById('text-scale-readout')
  );

  FONT_FAMILIES.forEach((f) => {
    const opt = document.createElement('option');
    opt.value = f.css;
    opt.textContent = f.name;
    familySelect.appendChild(opt);
  });

  TEXT_COLOR_PALETTE.forEach((c) => {
    const hexStr = '#' + c.hex.toString(16).padStart(6, '0');
    const btn = document.createElement('div');
    btn.className = 'swatch';
    btn.title = c.name;
    btn.dataset.hex = hexStr;
    btn.style.backgroundColor = hexStr;
    btn.addEventListener('click', () => {
      const target = state.activeDesignTarget;
      state.customization[target].textColor = hexStr;
      refreshTextoUI();
      scheduleDecalUpdate(target, 'text');
    });
    swatchWrap.appendChild(btn);
  });

  refreshTextoUI = () => {
    const s = state.customization[state.activeDesignTarget];
    input.value = s.text;
    sizeSlider.value = s.fontSizePx;
    sizeReadout.textContent = s.fontSizePx + 'px';
    familySelect.value = s.fontFamily;
    weightBtnsWrap.querySelectorAll('.font-size-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.weight === s.fontWeight);
    });
    swatchWrap.querySelectorAll('.swatch').forEach((sw) => {
      sw.classList.toggle('selected', sw.dataset.hex === s.textColor);
    });
    refreshTextTransform();
  };

  input.addEventListener('input', () => {
    const target = state.activeDesignTarget;
    state.customization[target].text = input.value;
    scheduleDecalUpdate(target, 'text');
  });

  sizeSlider.addEventListener('input', () => {
    const target = state.activeDesignTarget;
    state.customization[target].fontSizePx = Number(sizeSlider.value);
    sizeReadout.textContent = sizeSlider.value + 'px';
    scheduleDecalUpdate(target, 'text');
  });

  familySelect.addEventListener('change', () => {
    const target = state.activeDesignTarget;
    state.customization[target].fontFamily = familySelect.value;
    scheduleDecalUpdate(target, 'text');
  });

  weightBtnsWrap.querySelectorAll('.font-size-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = state.activeDesignTarget;
      state.customization[target].fontWeight = btn.dataset.weight;
      refreshTextoUI();
      scheduleDecalUpdate(target, 'text');
    });
  });

  resetBtn.addEventListener('click', () => {
    const target = state.activeDesignTarget;
    const s = state.customization[target];
    s.fontSizePx = DECAL_FONT_SIZE_RANGE.default;
    s.fontFamily = FONT_FAMILIES[0].css;
    s.fontWeight = '700';
    s.textColor = '#000000';
    s.textRotationDeg = DECAL_ROTATION_RANGE.default;
    s.textScalePct = DECAL_SCALE_RANGE.default;
    s.placement.text = null; // full reset, including position
    refreshTextoUI();
    scheduleDecalUpdate(target, 'text');
  });

  clearBtn.addEventListener('click', () => {
    const target = state.activeDesignTarget;
    state.customization[target].text = '';
    state.customization[target].placement.text = null;
    input.value = '';
    scheduleDecalUpdate(target, 'text');
  });

  refreshTextoUI();
}

// Rebuilding a decal re-raycasts the mesh and re-triangulates the
// DecalGeometry — cheap individually, but not something to redo on every
// single keystroke. Debounce to once per short pause in typing.
const decalUpdateTimers = {};
function scheduleDecalUpdate(target, type) {
  updateRunningSummary(); // cheap — refresh immediately, don't wait on the debounce below
  const key = target + ':' + type;
  clearTimeout(decalUpdateTimers[key]);
  decalUpdateTimers[key] = setTimeout(() => updateDecalForTarget(target, type), 200);
}

function disposeDecal(target, type) {
  const mesh = state.decalMeshes[target][type];
  if (!mesh) return;
  if (mesh.parent) mesh.parent.remove(mesh);
  mesh.geometry.dispose();
  if (mesh.material.map) mesh.material.map.dispose();
  mesh.material.dispose();
  state.decalMeshes[target][type] = null;
}

function buildLogoCanvas(s) {
  const canvas = document.createElement('canvas');
  canvas.width = DECAL_CANVAS.w;
  canvas.height = DECAL_CANVAS.h;
  const ctx = canvas.getContext('2d');
  const logoH = canvas.height * 0.8;
  const logoW = Math.min(canvas.width * 0.9, logoH * (s.logoImg.width / s.logoImg.height));
  ctx.drawImage(s.logoImg, (canvas.width - logoW) / 2, (canvas.height - logoH) / 2, logoW, logoH);
  return canvas;
}

function buildTextCanvas(s) {
  const canvas = document.createElement('canvas');
  canvas.width = DECAL_CANVAS.w;
  canvas.height = DECAL_CANVAS.h;
  const ctx = canvas.getContext('2d');
  // The decal is clipped to a fixed physical box on the capsule — long text
  // at a fixed font size can run past that box and get cut off. Shrink to
  // fit the canvas width instead of letting that happen.
  let fontPx = s.fontSizePx;
  const maxTextWidth = canvas.width * 0.88;
  ctx.font = `${s.fontWeight} ${fontPx}px ${s.fontFamily}`;
  while (ctx.measureText(s.text).width > maxTextWidth && fontPx > 14) {
    fontPx -= 2;
    ctx.font = `${s.fontWeight} ${fontPx}px ${s.fontFamily}`;
  }
  ctx.fillStyle = s.textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s.text, canvas.width / 2, canvas.height / 2);
  return canvas;
}

// Finds a point + outward normal on `mesh`'s camera-facing surface by
// raycasting from the camera's side straight at it — stays correct
// regardless of the capsule's current rotation, with no hand-derived
// cylinder-surface trigonometry to get wrong. Used only as the DEFAULT
// placement the first time a logo/text is added — after that, the user's
// own drag (decal-drag.js) takes over and this is never called again for
// that piece+type until it's cleared.
function findVisibleSurfacePoint(mesh) {
  const { camera } = state;
  if (!camera.userData.baseDir) return null;
  const box = new THREE.Box3().setFromObject(mesh);
  const center = box.getCenter(new THREE.Vector3());
  const pieceSize = box.getSize(new THREE.Vector3());
  const dir = camera.userData.baseDir;
  const origin = center.clone().addScaledVector(dir, pieceSize.length());
  const raycaster = new THREE.Raycaster(origin, dir.clone().negate());
  const hits = raycaster.intersectObject(mesh, false);
  if (!hits.length) return null;
  const hit = hits[0];
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  const worldNormal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
  return { point: hit.point, normal: worldNormal, pieceSize };
}

// World <-> capsuleGroup-local conversion for stored placements — the only
// two directions this ever needs, factored out so decal-drag.js's live
// reposition path and this module's content-rebuild path share the exact
// same math instead of it existing in two places and drifting apart.
// transformDirection (not the full normal matrix) is correct here only
// because capsuleGroup's scale is uniform (every capsule size is a uniform
// scale of the same reference model, per SIZE_REFERENCE_LENGTH in
// constants.js) — transformDirection normalizes away the scale, which for
// a uniform scale gives the exact same direction the true inverse-transpose
// normal matrix would. A future non-uniform scale on capsuleGroup would
// need the general normal-matrix form instead.
export function worldToLocalPlacement(worldPoint, worldNormal) {
  const inv = state.capsuleGroup.matrixWorld.clone().invert();
  return {
    localPoint: worldPoint.clone().applyMatrix4(inv),
    localNormal: worldNormal.clone().transformDirection(inv).normalize(),
  };
}

export function localToWorldPlacement(placement) {
  const mw = state.capsuleGroup.matrixWorld;
  return {
    worldPoint: placement.localPoint.clone().applyMatrix4(mw),
    worldNormal: placement.localNormal.clone().transformDirection(mw).normalize(),
  };
}

// Shared by the content-rebuild path below and decal-drag.js's live
// reposition path — the only place DecalGeometry actually gets built, so
// the trickiest math (world-space construction + local-space reparenting)
// exists in exactly one place.
//
// rotation (radians) twists the decal in-plane around its own surface
// normal; scale multiplies its footprint. Both default to identity so
// existing callers that don't care about them still work.
export function buildDecalGeometryAt(mesh, worldPoint, worldNormal, pieceSize, rotation = 0, scale = 1) {
  const dummy = new THREE.Object3D();
  dummy.position.copy(worldPoint);
  dummy.lookAt(worldPoint.clone().add(worldNormal));
  dummy.rotateZ(rotation); // around the projection axis (dummy's local Z, i.e. worldNormal) - twists the printed image, not its placement

  // decalW covers roughly half the piece's diameter (scaled by the user's
  // own size control on top). decalDepth is the box's extent along the
  // projection axis (split evenly in front of / behind the surface point) -
  // the capsule is a thin HOLLOW shell, not solid, so there's nothing
  // physically stopping a too-deep box from reaching all the way through to
  // the far side of the same curved cross-section and clipping a second,
  // unwanted copy of the decal there. Deep enough to comfortably cover the
  // local curvature under decalW (sag there is roughly decalW^2/(4*diameter),
  // well under a tenth of diameter even at max scale) but well short of the
  // ~diameter reach needed to punch through to the opposite wall.
  const diameter = Math.max(pieceSize.x, pieceSize.y);
  const decalW = diameter * 0.55 * scale;
  const decalH = decalW * (DECAL_CANVAS.h / DECAL_CANVAS.w);
  const decalDepth = diameter * 0.4;
  const decalSize = new THREE.Vector3(decalW, decalH, decalDepth);

  const geometry = new DecalGeometry(mesh, worldPoint, dummy.rotation, decalSize);
  // DecalGeometry bakes vertices in WORLD space using mesh.matrixWorld at
  // this exact moment. capsuleGroup keeps rotating as the user scrolls (on
  // steps other than 4), so the geometry has to be converted into
  // capsuleGroup's local space before parenting under it — otherwise the
  // decal stays fixed in world space while the capsule spins away from
  // underneath it.
  geometry.applyMatrix4(state.capsuleGroup.matrixWorld.clone().invert());
  return geometry;
}

export function updateDecalForTarget(target, type) {
  disposeDecal(target, type);
  const mesh = target === 'cap' ? state.capMeshObj : state.bodyMeshObj;
  const s = state.customization[target];
  const hasContent = type === 'logo' ? !!s.logoImg : !!s.text.trim();
  if (!mesh || !state.capsuleGroup || !hasContent) return;

  let worldPoint, worldNormal, pieceSize;
  if (s.placement[type]) {
    ({ worldPoint, worldNormal } = localToWorldPlacement(s.placement[type]));
    pieceSize = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
  } else {
    const surface = findVisibleSurfacePoint(mesh);
    if (!surface) return;
    worldPoint = surface.point;
    worldNormal = surface.normal;
    pieceSize = surface.pieceSize;
    s.placement[type] = worldToLocalPlacement(worldPoint, worldNormal); // persist the default so it doesn't re-derive (and potentially drift) on every rebuild
  }

  const canvas = type === 'logo' ? buildLogoCanvas(s) : buildTextCanvas(s);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  texture.colorSpace = THREE.SRGBColorSpace;

  const rotation = THREE.MathUtils.degToRad(s[type + 'RotationDeg']);
  const scale = s[type + 'ScalePct'] / 100;
  const geometry = buildDecalGeometryAt(mesh, worldPoint, worldNormal, pieceSize, rotation, scale);
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    roughness: 0.5,
    metalness: 0,
  });
  const decalMesh = new THREE.Mesh(geometry, material);
  state.capsuleGroup.add(decalMesh);
  state.decalMeshes[target][type] = decalMesh;
}

export function initStepDesign() {
  setupDesignPieceToggle();
  setupLogoSection();
  setupTextoSection();
}
