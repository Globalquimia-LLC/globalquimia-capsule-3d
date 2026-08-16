// All the fixed data + tuning numbers the app is built from — grouped
// here so a real value (a size, a color, a timing constant) is never
// buried inside the module that happens to use it first.

// How far the cap travels along its own local axis to go from fully CLOSED
// to the reference OPEN pose. Derived directly from build_capsule.py's
// geometry: open_z(28.42mm) - closed_z(11.7mm) = 16.72mm = 0.01672m. Both
// nodes are exported with an IDENTITY transform (verified against the GLB)
// so this is a pure additive local offset on top of the baked closed-pose
// vertices.
export const CAP_OPEN_DELTA = 0.01672;

// ---------------------------------------------------------------------
// Drag rotation + momentum spin.
// ---------------------------------------------------------------------
export const DRAG_TILT_LIMIT = 0.6; // radians — keeps the vertical tilt from flipping the capsule end-over-end
export const DRAG_SENSITIVITY = 0.012;
export const SPIN_FRICTION = 0.95; // per-frame decay once released
export const SPIN_MAX_VELOCITY = 0.15; // radians/frame — caps an extreme flick
export const SPIN_MIN_VELOCITY = 0.0002; // below this it's imperceptible; stop updating

// Story-scrub rotation chase (see state.rotationTarget) — how long after
// the last scrub tick the capsule keeps easing toward rotationTarget.y,
// and how strong that ease is per frame.
export const ROTATION_CHASE_WINDOW_MS = 500;
export const ROTATION_CHASE_LERP = 0.14;

// Ambient idle spin — keeps the capsule visibly alive (never a frozen
// still frame) whenever nothing else (drag momentum, active scroll chase,
// the tunnel) is driving its rotation, including before any scrolling at
// all. Scales up with #story's own scroll progress (0 at the very top, 1
// once the wizard takes over) so it reads as barely-there at first and
// noticeably livelier by the time the story's later stages are showing.
export const IDLE_SPIN_BASE = 0.0025; // radians/frame at scroll progress 0
export const IDLE_SPIN_MAX = 0.009; // radians/frame at scroll progress 1

// ---------------------------------------------------------------------
// 1. Capsule type — selection-only, doesn't affect the 3D model.
// ---------------------------------------------------------------------
export const TIPO_OPTIONS = [
  'Gelatin capsules',
  'Vegetable capsules - K-CAPS',
  'Acid-resistant capsules - AR-CAPS',
  'Flavored capsules',
  'Liquid-fill capsules - LQ-CAPS',
];
export const DEFAULT_TIPO_INDEX = 0;

// ---------------------------------------------------------------------
// 2. Size — real published capsule sizes (Torpac/ACG technical charts,
// same source used for the 3D model's own "0" geometry); wall thickness
// is near-constant across sizes for a given capsule type, hence the fixed
// 0.30mm shown for all.
// ---------------------------------------------------------------------
export const SIZE_OPTIONS = [
  { code: '000', length: 26.14 },
  { code: '00',  length: 23.40 },
  { code: '0',   length: 21.60 },
  { code: '1',   length: 19.40 },
  { code: '2',   length: 18.00 },
  { code: '3',   length: 15.90 },
  { code: '4',   length: 14.30 },
  { code: '5',   length: 11.10 },
];
export const SIZE_WALL_MM = 0.30;
// The loaded GLB itself IS size "0" — every other size is expressed as a
// uniform scale of capsuleGroup relative to this reference length.
export const SIZE_REFERENCE_LENGTH = 21.60;
// Purely cosmetic multiplier on top of the per-size ratio above (scene.js,
// step-tamano.js) — shrinks how big the capsule renders on screen without
// touching the real technical lengths (SIZE_OPTIONS, the mm shown in the
// size list, or anything sent to the quote). 0.8 = 20% smaller across
// every size, at the user's request 2026-08-16.
export const DISPLAY_SCALE = 0.8;

// ---------------------------------------------------------------------
// 3. Color — brand + common capsule colors, fed into each Pickr instance's
// own native `swatches` row (not a separate custom row alongside it).
// ---------------------------------------------------------------------
export const PALETTE = [
  { name: 'Globalquimia Blue', hex: 0x006f9e },
  { name: 'Cyan',              hex: 0x1dbadf },
  { name: 'Yellow',            hex: 0xfdc400 },
  { name: 'Green',             hex: 0x95c11f },
  { name: 'Navy',              hex: 0x1c405d },
  { name: 'White',             hex: 0xf8f8f8 },
  { name: 'Black',             hex: 0x2b2b2b },
  { name: 'Gray',              hex: 0x9aa7ad },
  { name: 'Red',               hex: 0xd63b3b },
  { name: 'Orange',            hex: 0xf28c28 },
  { name: 'Pink',              hex: 0xe36ca0 },
  { name: 'Purple',            hex: 0x7d5ba6 },
  { name: 'Turquoise',         hex: 0x2ec4b6 },
  { name: 'Beige',             hex: 0xe4d5b7 },
];

// Transparent finish — real transparent capsule shells are colorless
// (no dye added), so this is a single "Clear" swatch rather than a full
// palette like the other finishes. The material's own see-through look
// comes from FINISH_PROPS.transparente below, not from this hex.
export const TRANSPARENT_PALETTE = [
  { name: 'Clear', hex: 0xffffff },
];

// Fixed metallic finish set (not the full spectrum — a closed palette, per
// the reference swatch grid).
export const METAL_PALETTE = [
  { name: 'Ivory',        hex: 0xe8e1cf },
  { name: 'Dark Purple',  hex: 0x3b1f5c },
  { name: 'Black',        hex: 0x1a1a1a },
  { name: 'Blue',         hex: 0x1e3a8a },
  { name: 'Brown',        hex: 0x5c3a21 },
  { name: 'Beige',        hex: 0xf0e4c8 },
  { name: 'Gold',         hex: 0xc9a227 },
  { name: 'Dusty Rose',   hex: 0xe8b8c8 },
  { name: 'Gray',         hex: 0x9a9a9a },
  { name: 'Green',        hex: 0x1e7b34 },
  { name: 'Orange',       hex: 0xe8752b },
  { name: 'Pink',         hex: 0xf06fa0 },
  { name: 'Purple',       hex: 0x7b2fbe },
  { name: 'Red',          hex: 0xd81e2c },
  { name: 'Burgundy',     hex: 0x7a1620 },
  { name: 'Yellow',       hex: 0xf0c419 },
  { name: 'Silver',       hex: 0xe4e4e4 },
  { name: 'Silver Gray',  hex: 0xa8a8a8 },
  { name: 'Bronze',       hex: 0xb8860b },
];

// Material response per finish — Traditional keeps the original semi-gloss
// look, Matte flattens the highlight, Metallic pushes metalness up so the
// same lighting rig reads as a metallic coat, Transparent drops opacity so
// the capsule actually reads as see-through instead of just a pale color.
// opacity/transparent are set on every entry (not just Transparent's) so
// setPieceColor can apply them unconditionally when switching finishes —
// without that, switching AWAY from Transparent back to another finish
// would leave the mesh stuck partially see-through.
export const FINISH_PROPS = {
  tradicionales: { roughness: 0.35, metalness: 0.05, opacity: 1,    transparent: false },
  mate:          { roughness: 0.9,  metalness: 0.02, opacity: 1,    transparent: false },
  metalizados:   { roughness: 0.25, metalness: 0.85, opacity: 1,    transparent: false },
  transparente:  { roughness: 0.05, metalness: 0.0,  opacity: 0.35, transparent: true  },
};
export const FINISH_LABELS = { tradicionales: 'Traditional', mate: 'Matte', metalizados: 'Metallic', transparente: 'Transparent' };

// ---------------------------------------------------------------------
// 4. Logo & Text.
// ---------------------------------------------------------------------
export const TEXT_COLOR_PALETTE = [
  { name: 'White',      hex: 0xffffff },
  { name: 'Black',      hex: 0x000000 },
  { name: 'Dark Gray',  hex: 0x2b2b2b },
  { name: 'Gray',       hex: 0x6b7280 },
  { name: 'Burgundy',   hex: 0x7a1f2b },
  { name: 'Blue',       hex: 0x1c3f8f },
  { name: 'Light Blue', hex: 0x1f7fbf },
  { name: 'Brown',      hex: 0x5c4020 },
  { name: 'Olive Green', hex: 0x4a6b1f },
  { name: 'Green',      hex: 0x1f5c34 },
  { name: 'Gold',       hex: 0xe8b923 },
];
export const DECAL_CANVAS = { w: 512, h: 256 };
// Continuous slider instead of a fixed small/medium/large set — min/max/step
// are in real px on the DECAL_CANVAS's own coordinate space (buildTextCanvas
// still shrinks-to-fit if a large size + long text would overflow).
export const DECAL_FONT_SIZE_RANGE = { min: 18, max: 110, step: 2, default: 52 };
// Free rotate/resize for a placed logo or text decal, on top of drag-to-
// reposition — degrees and percent so the values map directly onto slider
// UI, converted only where buildDecalGeometryAt actually needs radians/a
// plain multiplier.
export const DECAL_ROTATION_RANGE = { min: -180, max: 180, step: 5, default: 0 };
export const DECAL_SCALE_RANGE = { min: 50, max: 200, step: 5, default: 100 };
// No @font-face — canvas ctx.font can only use fonts already on the device,
// and this project doesn't load external fonts. Each entry's css string is
// what actually goes into ctx.font, fallback stack included.
export const FONT_FAMILIES = [
  { name: 'Arial', css: 'Arial, Helvetica, sans-serif' },
  { name: 'Helvetica', css: 'Helvetica, Arial, sans-serif' },
  { name: 'Verdana', css: 'Verdana, Geneva, sans-serif' },
  { name: 'Tahoma', css: 'Tahoma, Geneva, sans-serif' },
  { name: 'Trebuchet MS', css: '"Trebuchet MS", sans-serif' },
  { name: 'Segoe UI', css: '"Segoe UI", Arial, sans-serif' },
  { name: 'Calibri', css: 'Calibri, Candara, sans-serif' },
  { name: 'Century Gothic', css: '"Century Gothic", "Segoe UI", sans-serif' },
  { name: 'Georgia', css: 'Georgia, serif' },
  { name: 'Times New Roman', css: '"Times New Roman", Times, serif' },
  { name: 'Garamond', css: 'Garamond, Georgia, serif' },
  { name: 'Palatino', css: '"Palatino Linotype", Palatino, serif' },
  { name: 'Cambria', css: 'Cambria, Georgia, serif' },
  { name: 'Courier New', css: '"Courier New", Courier, monospace' },
  { name: 'Consolas', css: 'Consolas, "Courier New", monospace' },
  { name: 'Impact', css: 'Impact, Haettenschweiler, sans-serif' },
  { name: 'Comic Sans MS', css: '"Comic Sans MS", "Comic Sans", cursive' },
];
export const FONT_WEIGHTS = [
  { name: 'Normal', value: '400' },
  { name: 'Bold', value: '700' },
];
// Soft-warning threshold (px, shorter image dimension) for logo upload
// resolution — below this the projected decal is likely to look blurry.
export const DECAL_MIN_LOGO_PX = 300;

// ---------------------------------------------------------------------
// 5. Quantity & quote — deliberately does NOT compute a live price:
// Globalquimia has no published price list yet (marketing-plan.md §10.1)
// — showing a made-up number would be worse than showing none. This is
// the hook for when real costs exist: fill it in
// ({ sizeCode: { tipoLabel: pricePerThousandUSD } }) and computeEstimate
// (quote.js) starts returning a real number with no other change.
// ---------------------------------------------------------------------
export const PRICE_TABLE = null;

// Cotizador (Vendedor) — director-globalquimia-llc, see GEP-400 in the
// `gep` repo. The request goes straight into that endpoint
// (POST /quotes/generate, same backend as the rest of the cotizador)
// instead of building a WhatsApp link; see initStepQuote in
// wizard/step-quote.js.
//
// DIRECTOR_API_KEY is a low-value shared secret, not real protection:
// called from the browser, it's visible in anyone's page source either
// way, public repo or not — together with the backend's rate limit
// (5 requests/min per IP), it only filters out bots/curious visitors,
// not a determined attacker. Same reasoning documented in
// director-globalquimia-llc/src/server.ts.
export const DIRECTOR_API_URL = 'https://director-globalquimia-llc-production.up.railway.app/quotes/generate';
export const DIRECTOR_API_KEY = 'a35f45c0740d61408fac17161db793d9fa848c886d00925b4da0c88f17484361';
export const DIRECTOR_EMPRESA = 'globalquimia-llc';

// ---------------------------------------------------------------------
// Wizard step copy.
// ---------------------------------------------------------------------
export const STEP_TITLES = { 1: 'Capsule Type', 2: 'Size', 3: 'Color', 4: 'Logo & Text', 5: 'Quantity & Quote' };
export const STEP_INSTRUCTIONS = {
  1: 'Choose the capsule type for your product.',
  2: 'Choose a size — the capsule scales live to its real proportion.',
  3: 'Choose a finish and color for the cap and body.',
  4: 'Add your logo or engraved text and drag it onto the capsule to place it wherever you like.',
  5: 'Review your selection, adjust the quantity, and request your quote.',
};
