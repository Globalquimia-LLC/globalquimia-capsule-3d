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

// ---------------------------------------------------------------------
// 1. Tipo de cápsula — selection-only, doesn't affect the 3D model.
// ---------------------------------------------------------------------
export const TIPO_OPTIONS = [
  'Cápsulas de gelatina',
  'Cápsulas vegetal - K-CAPS',
  'Cápsulas ácido resistente - AR-CAPS',
  'Cápsulas saborizadas',
  'Cápsulas de relleno líquido - LQ-CAPS',
];
export const DEFAULT_TIPO_INDEX = 2;

// ---------------------------------------------------------------------
// 2. Tamaño — real published capsule sizes (Torpac/ACG technical charts,
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

// ---------------------------------------------------------------------
// 3. Color — brand + common capsule colors, fed into each Pickr instance's
// own native `swatches` row (not a separate custom row alongside it).
// ---------------------------------------------------------------------
export const PALETTE = [
  { name: 'Azul Globalquimia', hex: 0x006f9e },
  { name: 'Cian',              hex: 0x1dbadf },
  { name: 'Amarillo',          hex: 0xfdc400 },
  { name: 'Verde',             hex: 0x95c11f },
  { name: 'Navy',              hex: 0x1c405d },
  { name: 'Blanco',            hex: 0xf8f8f8 },
  { name: 'Negro',             hex: 0x2b2b2b },
  { name: 'Gris',              hex: 0x9aa7ad },
  { name: 'Rojo',              hex: 0xd63b3b },
  { name: 'Naranja',           hex: 0xf28c28 },
  { name: 'Rosa',              hex: 0xe36ca0 },
  { name: 'Morado',            hex: 0x7d5ba6 },
  { name: 'Turquesa',          hex: 0x2ec4b6 },
  { name: 'Beige',             hex: 0xe4d5b7 },
];

// Fixed metallic finish set (not the full spectrum — a closed palette, per
// the reference swatch grid).
export const METAL_PALETTE = [
  { name: 'Marfil',        hex: 0xe8e1cf },
  { name: 'Morado oscuro', hex: 0x3b1f5c },
  { name: 'Negro',         hex: 0x1a1a1a },
  { name: 'Azul',          hex: 0x1e3a8a },
  { name: 'Café',          hex: 0x5c3a21 },
  { name: 'Beige',         hex: 0xf0e4c8 },
  { name: 'Oro',           hex: 0xc9a227 },
  { name: 'Rosa palo',     hex: 0xe8b8c8 },
  { name: 'Gris',          hex: 0x9a9a9a },
  { name: 'Verde',         hex: 0x1e7b34 },
  { name: 'Naranja',       hex: 0xe8752b },
  { name: 'Rosa',          hex: 0xf06fa0 },
  { name: 'Púrpura',       hex: 0x7b2fbe },
  { name: 'Rojo',          hex: 0xd81e2c },
  { name: 'Vinotinto',     hex: 0x7a1620 },
  { name: 'Amarillo',      hex: 0xf0c419 },
  { name: 'Plata',         hex: 0xe4e4e4 },
  { name: 'Gris plateado', hex: 0xa8a8a8 },
  { name: 'Bronce',        hex: 0xb8860b },
];

// Material response per finish — Tradicionales keeps the original
// semi-gloss look, Mate flattens the highlight, Metalizados pushes
// metalness up so the same lighting rig reads as a metallic coat.
export const FINISH_PROPS = {
  tradicionales: { roughness: 0.35, metalness: 0.05 },
  mate:          { roughness: 0.9,  metalness: 0.02 },
  metalizados:   { roughness: 0.25, metalness: 0.85 },
};
export const FINISH_LABELS = { tradicionales: 'Tradicional', mate: 'Mate', metalizados: 'Metalizado' };

// ---------------------------------------------------------------------
// 4. Logo y Texto.
// ---------------------------------------------------------------------
export const TEXT_COLOR_PALETTE = [
  { name: 'Blanco',      hex: 0xffffff },
  { name: 'Negro',       hex: 0x000000 },
  { name: 'Gris oscuro', hex: 0x2b2b2b },
  { name: 'Gris',        hex: 0x6b7280 },
  { name: 'Vinotinto',   hex: 0x7a1f2b },
  { name: 'Azul',        hex: 0x1c3f8f },
  { name: 'Celeste',     hex: 0x1f7fbf },
  { name: 'Café',        hex: 0x5c4020 },
  { name: 'Verde oliva', hex: 0x4a6b1f },
  { name: 'Verde',       hex: 0x1f5c34 },
  { name: 'Dorado',      hex: 0xe8b923 },
];
export const DECAL_CANVAS = { w: 512, h: 256 };
export const DECAL_FONT_PX = { small: 34, medium: 52, large: 74 };

// ---------------------------------------------------------------------
// 5. Cantidad y cotización — deliberately does NOT compute a live price:
// Globalquimia has no published price list yet (marketing-plan.md §10.1)
// — showing a made-up number would be worse than showing none. This is
// the hook for when real costs exist: fill it in
// ({ sizeCode: { tipoLabel: pricePerThousandUSD } }) and computeEstimate
// (quote.js) starts returning a real number with no other change.
// ---------------------------------------------------------------------
export const PRICE_TABLE = null;
export const WHATSAPP_NUMBER = '573217408144';

// ---------------------------------------------------------------------
// Wizard step copy.
// ---------------------------------------------------------------------
export const STEP_TITLES = { 1: 'Tipo de cápsula', 2: 'Tamaño', 3: 'Color', 4: 'Logo y Texto', 5: 'Cantidad y cotización' };
export const STEP_INSTRUCTIONS = {
  1: 'Elegí el tipo de cápsula para tu producto.',
  2: 'Elegí la talla — la cápsula escala en vivo a la proporción real.',
  3: 'Elegí acabado y color para la tapa y el cuerpo.',
  4: 'Agregá tu logo o un texto grabado sobre la cápsula.',
  5: 'Revisá tu selección, ajustá la cantidad y pedí la cotización.',
};
