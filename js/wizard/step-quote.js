import { state } from '../state.js';
import { PRICE_TABLE, FINISH_LABELS, WHATSAPP_NUMBER, PALETTE, METAL_PALETTE } from '../constants.js';
import { playTunnelSequence } from '../interaction/tunnel.js';

// Named colors only ever come from PALETTE (tradicionales/mate free-pick
// quick swatches) or METAL_PALETTE (metalizados' closed set) — an exact hex
// match means the user picked one of those named swatches rather than a
// custom hue off the spectrum or a typed-in value. No emoji swatch here —
// tried a nearest-color circle emoji first, but it renders as a broken
// "tofu" glyph on systems without a full emoji font, which is worse than
// just the hex, so plain text (name when there is one) is what's reliable.
function colorNameFor(hexStr) {
  const target = hexStr.toLowerCase();
  const match = [...PALETTE, ...METAL_PALETTE].find(
    (c) => '#' + c.hex.toString(16).padStart(6, '0') === target
  );
  return match ? match.name : null;
}

function describeColor(hexStr) {
  const name = colorNameFor(hexStr);
  return `${name ? name + ' ' : ''}${hexStr.toUpperCase()}`;
}

// ---------------------------------------------------------------------
// 5. Cantidad y cotización — assembles every choice made in steps 1-4
// plus a quantity into a structured request. Deliberately does NOT
// compute a live price: Globalquimia has no published price list yet
// (marketing-plan.md §10.1) — showing a made-up number would be worse
// than showing none. PRICE_TABLE (constants.js) is the hook for when
// real costs exist: fill it in and computeEstimate starts returning a
// real number with no other change.
// ---------------------------------------------------------------------
function computeEstimate(sizeCode, tipoLabel, qty) {
  if (!PRICE_TABLE) return null;
  const perThousand = PRICE_TABLE[sizeCode] && PRICE_TABLE[sizeCode][tipoLabel];
  return perThousand ? (perThousand * qty) / 1000 : null;
}

// Builds the plain-text summary used by the WhatsApp message and
// "copiar resumen", and refreshes the price estimate note. There's no
// on-screen list anymore — the summary only ever leaves the page as
// WhatsApp/clipboard text.
export function renderQuoteSummary() {
  const qtyInput = document.getElementById('quote-qty');
  const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
  const { selectedTipo, selectedSize, appliedColor, customization } = state;

  const lines = [
    `Tipo: ${selectedTipo}`,
    `Tamaño: ${selectedSize.code} (${selectedSize.length.toFixed(2)} mm)`,
    `Tapa: ${FINISH_LABELS[appliedColor.cap.finish]} ${describeColor(appliedColor.cap.hex)}`,
    `Cuerpo: ${FINISH_LABELS[appliedColor.body.finish]} ${describeColor(appliedColor.body.hex)}`,
  ];
  if (customization.cap.logoName) lines.push(`Logo tapa: ${customization.cap.logoName}`);
  if (customization.body.logoName) lines.push(`Logo cuerpo: ${customization.body.logoName}`);
  if (customization.cap.text) lines.push(`Texto tapa: "${customization.cap.text}"`);
  if (customization.body.text) lines.push(`Texto cuerpo: "${customization.body.text}"`);
  lines.push(`Cantidad: ${qty.toLocaleString('es-CO')} unidades`);

  const estimate = computeEstimate(selectedSize.code, selectedTipo, qty);
  document.getElementById('quote-estimate').textContent = estimate
    ? `Estimado: $${estimate.toFixed(2)} USD`
    : 'Precio sujeto a cotización — un asesor responde con el valor exacto.';

  return lines.join('\n');
}

function whatsAppUrl(summary) {
  const msg = `Hola, quiero cotizar cápsulas personalizadas:\n${summary}`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}

export function initStepQuote() {
  document.getElementById('quote-qty').addEventListener('input', renderQuoteSummary);

  // "Solicitar cotización" plays the tunnel (capsule flies open, camera
  // dives through it, the Globalquimia logo appears and holds) and only
  // once that finishes does the page itself navigate to WhatsApp — no new
  // tab/window at all, so there's nothing for a popup blocker to catch.
  document.getElementById('quote-whatsapp-btn').addEventListener('click', () => {
    const summary = renderQuoteSummary();
    playTunnelSequence(() => {
      window.location.href = whatsAppUrl(summary);
    });
  });

  document.getElementById('quote-copy-btn').addEventListener('click', () => {
    const summary = renderQuoteSummary();
    const btn = document.getElementById('quote-copy-btn');
    const original = btn.textContent;
    navigator.clipboard.writeText(summary).then(() => {
      btn.textContent = 'Copiado ✓';
      setTimeout(() => { btn.textContent = original; }, 1500);
    });
  });
}
