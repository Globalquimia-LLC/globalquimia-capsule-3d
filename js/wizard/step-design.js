import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { state } from '../state.js';
import { TEXT_COLOR_PALETTE, DECAL_CANVAS, DECAL_FONT_PX } from '../constants.js';
import { updateRunningSummary } from './wizard.js';

// ---------------------------------------------------------------------
// 4. Logo y Texto — the one section that must actually render onto the
// 3D capsule. Both pieces are tracked independently; each keeps its own
// logo image + text + color + size, composited onto one canvas and
// projected onto that piece's visible surface as a THREE.DecalGeometry.
//
// One shared piece toggle drives BOTH the Logo and Texto sections —
// previously each section had its own independent Tapa/Cuerpo tabs, so
// switching piece in one didn't affect the other and it was easy to edit
// the wrong piece without noticing.
// ---------------------------------------------------------------------
let refreshLogoUI = () => {};
let refreshTextoUI = () => {};

function setupDesignPieceToggle() {
  const toggle = document.getElementById('design-piece-toggle');
  toggle.querySelectorAll('.piece-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      toggle.querySelectorAll('.piece-toggle-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeDesignTarget = btn.dataset.target;
      refreshLogoUI();
      refreshTextoUI();
    });
  });
}

function setupLogoSection() {
  const fileInput = document.getElementById('logo-file-input');
  const fileNameEl = document.getElementById('logo-file-name');
  const clearBtn = document.getElementById('logo-clear-btn');

  refreshLogoUI = () => {
    fileNameEl.textContent = state.customization[state.activeDesignTarget].logoName || 'Ningún archivo seleccionado';
  };

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const target = state.activeDesignTarget;
        state.customization[target].logoImg = img;
        state.customization[target].logoName = file.name;
        refreshLogoUI();
        scheduleDecalUpdate(target);
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
    refreshLogoUI();
    scheduleDecalUpdate(target);
  });

  refreshLogoUI();
}

function setupTextoSection() {
  const input = document.getElementById('text-input');
  const sizeBtnsWrap = document.getElementById('font-size-btns');
  const resetBtn = document.getElementById('text-reset-btn');
  const clearBtn = document.getElementById('text-clear-btn');
  const swatchWrap = document.getElementById('text-color-swatches');

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
      scheduleDecalUpdate(target);
    });
    swatchWrap.appendChild(btn);
  });

  refreshTextoUI = () => {
    const s = state.customization[state.activeDesignTarget];
    input.value = s.text;
    sizeBtnsWrap.querySelectorAll('.font-size-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.size === s.fontSize);
    });
    swatchWrap.querySelectorAll('.swatch').forEach((sw) => {
      sw.classList.toggle('selected', sw.dataset.hex === s.textColor);
    });
  };

  input.addEventListener('input', () => {
    const target = state.activeDesignTarget;
    state.customization[target].text = input.value;
    scheduleDecalUpdate(target);
  });

  sizeBtnsWrap.querySelectorAll('.font-size-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = state.activeDesignTarget;
      state.customization[target].fontSize = btn.dataset.size;
      refreshTextoUI();
      scheduleDecalUpdate(target);
    });
  });

  resetBtn.addEventListener('click', () => {
    const target = state.activeDesignTarget;
    state.customization[target].fontSize = 'medium';
    state.customization[target].textColor = '#000000';
    refreshTextoUI();
    scheduleDecalUpdate(target);
  });

  clearBtn.addEventListener('click', () => {
    const target = state.activeDesignTarget;
    state.customization[target].text = '';
    input.value = '';
    scheduleDecalUpdate(target);
  });

  refreshTextoUI();
}

// Rebuilding a decal re-raycasts the mesh and re-triangulates the
// DecalGeometry — cheap individually, but not something to redo on every
// single keystroke. Debounce to once per short pause in typing.
const decalUpdateTimers = {};
function scheduleDecalUpdate(target) {
  updateRunningSummary(); // cheap — refresh immediately, don't wait on the debounce below
  clearTimeout(decalUpdateTimers[target]);
  decalUpdateTimers[target] = setTimeout(() => updateDecalForTarget(target), 200);
}

function disposeDecal(target) {
  const mesh = state.decalMeshes[target];
  if (!mesh) return;
  if (mesh.parent) mesh.parent.remove(mesh);
  mesh.geometry.dispose();
  if (mesh.material.map) mesh.material.map.dispose();
  mesh.material.dispose();
  state.decalMeshes[target] = null;
}

function buildDecalCanvas(s) {
  const canvas = document.createElement('canvas');
  canvas.width = DECAL_CANVAS.w;
  canvas.height = DECAL_CANVAS.h;
  const ctx = canvas.getContext('2d');
  const hasLogo = !!s.logoImg;
  const hasText = !!s.text.trim();
  let textY = canvas.height / 2;

  if (hasLogo && hasText) {
    const logoH = canvas.height * 0.42;
    const logoW = Math.min(canvas.width * 0.7, logoH * (s.logoImg.width / s.logoImg.height));
    ctx.drawImage(s.logoImg, (canvas.width - logoW) / 2, canvas.height * 0.05, logoW, logoH);
    textY = canvas.height * 0.8;
  } else if (hasLogo) {
    const logoH = canvas.height * 0.7;
    const logoW = Math.min(canvas.width * 0.85, logoH * (s.logoImg.width / s.logoImg.height));
    ctx.drawImage(s.logoImg, (canvas.width - logoW) / 2, (canvas.height - logoH) / 2, logoW, logoH);
  }
  if (hasText) {
    // The decal is clipped to a fixed physical box on the capsule — long
    // text at a fixed font size can run past that box and get cut off.
    // Shrink to fit the canvas width instead of letting that happen.
    let fontPx = DECAL_FONT_PX[s.fontSize];
    const maxTextWidth = canvas.width * 0.88;
    ctx.font = `700 ${fontPx}px Arial, Helvetica, sans-serif`;
    while (ctx.measureText(s.text).width > maxTextWidth && fontPx > 14) {
      fontPx -= 2;
      ctx.font = `700 ${fontPx}px Arial, Helvetica, sans-serif`;
    }
    ctx.fillStyle = s.textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.text, canvas.width / 2, textY);
  }
  return canvas;
}

// Finds a point + outward normal on `mesh`'s camera-facing surface by
// raycasting from the camera's side straight at it — stays correct
// regardless of the capsule's current rotation, with no hand-derived
// cylinder-surface trigonometry to get wrong.
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

function updateDecalForTarget(target) {
  disposeDecal(target);
  const mesh = target === 'cap' ? state.capMeshObj : state.bodyMeshObj;
  const s = state.customization[target];
  if (!mesh || !state.capsuleGroup || (!s.logoImg && !s.text.trim())) return;

  const surface = findVisibleSurfacePoint(mesh);
  if (!surface) return;

  const canvas = buildDecalCanvas(s);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  texture.colorSpace = THREE.SRGBColorSpace;

  const dummy = new THREE.Object3D();
  dummy.position.copy(surface.point);
  dummy.lookAt(surface.point.clone().add(surface.normal));

  // decalW covers most of the piece's diameter; decalDepth needs to be
  // generous — it's the box's extent along the projection axis, and a
  // curved surface recedes away from that axis fast, so a shallow box
  // clips the projection before it reaches the edges of decalW at all.
  const diameter = Math.max(surface.pieceSize.x, surface.pieceSize.y);
  const decalW = diameter * 0.7;
  const decalH = decalW * (DECAL_CANVAS.h / DECAL_CANVAS.w);
  const decalDepth = diameter * 2.2;
  const decalSize = new THREE.Vector3(decalW, decalH, decalDepth);

  const geometry = new DecalGeometry(mesh, surface.point, dummy.rotation, decalSize);
  // DecalGeometry bakes vertices in WORLD space using mesh.matrixWorld at
  // this exact moment. capsuleGroup keeps rotating as the user scrolls,
  // so the geometry has to be converted into capsuleGroup's local space
  // before parenting under it — otherwise the decal stays fixed in world
  // space while the capsule spins away from underneath it.
  geometry.applyMatrix4(state.capsuleGroup.matrixWorld.clone().invert());

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
  state.decalMeshes[target] = decalMesh;
}

export function initStepDesign() {
  setupDesignPieceToggle();
  setupLogoSection();
  setupTextoSection();
}
