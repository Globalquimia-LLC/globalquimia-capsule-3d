// Single shared mutable store for everything that crosses module
// boundaries — THREE objects, wizard selections, and interaction flags.
// No framework/build step here (this has to stay servable as plain static
// files), so this is the lightest thing that actually works: one object,
// imported by reference everywhere, mutated in place. Modules that only
// ever read a field (e.g. state.capsuleGroup) don't need to re-import
// after another module sets it — same object, always current.
export const state = {
  // THREE scene primitives, set once scene.js finishes building them.
  scene: null,
  camera: null,
  renderer: null,
  container: null,

  // Capsule model pieces, set once the GLTF finishes loading.
  capsuleGroup: null,
  capNode: null,
  capMaterial: null,
  bodyMaterial: null,
  capMeshObj: null,
  bodyMeshObj: null,
  maxDimGlobal: 0,

  // Layout.
  isDesktopLayout: window.innerWidth > 760,

  // Wizard navigation.
  currentStep: 1,
  hasRevealedStep1: false,

  // Step 1 — Type.
  selectedTipo: null,

  // Step 2 — Size.
  selectedSize: null,

  // Step 3 — Color. Last color+finish actually applied to each piece's
  // material — three finishes each keep their own picker state, but only
  // one is "live" on the mesh at a time; this is what step 5's summary reads.
  appliedColor: {
    cap: { finish: 'tradicionales', hex: '#2e8ad6' },
    body: { finish: 'tradicionales', hex: '#f8f8f8' },
  },
  pickrInstances: {},
  // What appliedColor[target] held right before switching TO Transparent —
  // restored when the Transparent checkbox is unchecked (see step-color.js).
  // null until Transparent has actually been picked at least once.
  preTransparentColor: { cap: null, body: null },

  // Step 4 — Logo y Texto. `placement.{logo,text}` is null until first
  // placed, then `{ localPoint, localNormal }` in capsuleGroup-LOCAL space —
  // valid across the capsule rotating on other steps with zero drift, since
  // it's converted to world space fresh off the CURRENT matrixWorld on every
  // rebuild rather than chained from a previous world value. Only holds
  // because capMeshObj/bodyMeshObj never move relative to capsuleGroup
  // during steps 1-5 (see step-design.js's buildDecalGeometryAt) — a future
  // feature animating the cap open during step 4/5 would break that.
  activeDesignTarget: 'cap',
  customization: {
    cap: {
      logoImg: null, logoName: '', logoLowRes: false, text: '', textColor: '#000000', fontSizePx: 52,
      fontFamily: 'Arial, Helvetica, sans-serif', fontWeight: '700', placement: { logo: null, text: null },
      // Degrees / percent (not radians / raw multiplier) — these feed slider
      // UI directly; converted at the one point buildDecalGeometryAt needs them.
      logoRotationDeg: 0, logoScalePct: 100, textRotationDeg: 0, textScalePct: 100,
    },
    body: {
      logoImg: null, logoName: '', logoLowRes: false, text: '', textColor: '#000000', fontSizePx: 52,
      fontFamily: 'Arial, Helvetica, sans-serif', fontWeight: '700', placement: { logo: null, text: null },
      logoRotationDeg: 0, logoScalePct: 100, textRotationDeg: 0, textScalePct: 100,
    },
  },
  decalMeshes: { cap: { logo: null, text: null }, body: { logo: null, text: null } },

  // Cursor-drag rotation + momentum spin (scene.js's animate() loop reads
  // isDragging/spinVelocityY every frame).
  isDragging: false,
  spinVelocityY: 0,
  // True only on step 4 — capsule holds a fixed pose so logo/text placement
  // is predictable. drag.js and scene.js's animate() both check this; the
  // decal-drag module is what's active instead while it's true.
  rotationLocked: false,

  // Story-scrub rotation goes through this proxy instead of directly onto
  // capsuleGroup.rotation.y so a resumed scroll after a manual drag glides
  // back into sync instead of snapping — see ROTATION_CHASE_WINDOW_MS in
  // constants.js and the chase step in scene.js's animate().
  rotationTarget: { y: 0 },
  chaseUntil: 0,

  // Scroll story + scroll-advance.
  storyScrollTrigger: null, // cached once in scroll-story.js — avoids an O(n) ScrollTrigger.getAll().find() on every wheel/touch tick
  scrollNormalizer: null,
  wizardScrollLocked: false, // tracks whether scroll-story.js has disabled scrollNormalizer for the active wizard
  lastScrollAdvanceAt: 0,
  lastNudgeAt: 0,

  // Closing tunnel.
  tunnelStarted: false,
  tunnelPlaying: false,
  tunnelTimeline: null,

  // Mobile's docked capsule band has its own +/- zoom controls (see
  // scene.js's reframeCapsuleCamera/adjustCapsuleZoom) — 1 is the normal
  // aspect-fit framing, >1 zoomed in (camera closer), <1 zoomed out.
  // Reset to 1 whenever the band re-docks (scroll-story.js), so zooming
  // in on one visit doesn't carry over and surprise the next.
  mobileZoomFactor: 1,
};
