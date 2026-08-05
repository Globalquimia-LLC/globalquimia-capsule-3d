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

  // Step 1 — Tipo.
  selectedTipo: null,

  // Step 2 — Tamaño.
  selectedSize: null,

  // Step 3 — Color. Last color+finish actually applied to each piece's
  // material — three finishes each keep their own picker state, but only
  // one is "live" on the mesh at a time; this is what step 5's summary reads.
  appliedColor: {
    cap: { finish: 'tradicionales', hex: '#2e8ad6' },
    body: { finish: 'tradicionales', hex: '#f8f8f8' },
  },
  pickrInstances: {},

  // Step 4 — Logo y Texto.
  activeDesignTarget: 'cap',
  customization: {
    cap: { logoImg: null, logoName: '', text: '', textColor: '#000000', fontSize: 'medium' },
    body: { logoImg: null, logoName: '', text: '', textColor: '#000000', fontSize: 'medium' },
  },
  decalMeshes: { cap: null, body: null },

  // Cursor-drag rotation + momentum spin (scene.js's animate() loop reads
  // isDragging/spinVelocityY every frame).
  isDragging: false,
  spinVelocityY: 0,

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
};
