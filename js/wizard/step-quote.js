import { state } from '../state.js';
import { PRICE_TABLE, FINISH_LABELS, WHATSAPP_NUMBER } from '../constants.js';

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

// Renders the summary list + estimate, and returns the plain-text
// version used by both the WhatsApp link and "copiar resumen".
export function renderQuoteSummary() {
  const qtyInput = document.getElementById('quote-qty');
  const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
  const { selectedTipo, selectedSize, appliedColor, customization } = state;

  const lines = [
    `Tipo: ${selectedTipo}`,
    `Tamaño: ${selectedSize.code} (${selectedSize.length.toFixed(2)} mm)`,
    `Tapa: ${FINISH_LABELS[appliedColor.cap.finish]} ${appliedColor.cap.hex.toUpperCase()}`,
    `Cuerpo: ${FINISH_LABELS[appliedColor.body.finish]} ${appliedColor.body.hex.toUpperCase()}`,
  ];
  if (customization.cap.logoName) lines.push(`Logo tapa: ${customization.cap.logoName}`);
  if (customization.body.logoName) lines.push(`Logo cuerpo: ${customization.body.logoName}`);
  if (customization.cap.text) lines.push(`Texto tapa: "${customization.cap.text}"`);
  if (customization.body.text) lines.push(`Texto cuerpo: "${customization.body.text}"`);
  lines.push(`Cantidad: ${qty.toLocaleString('es-CO')} unidades`);

  const listEl = document.getElementById('quote-summary-list');
  listEl.innerHTML = lines.map((l) => `<li>${l}</li>`).join('');

  const estimate = computeEstimate(selectedSize.code, selectedTipo, qty);
  document.getElementById('quote-estimate').textContent = estimate
    ? `Estimado: $${estimate.toFixed(2)} USD`
    : 'Precio sujeto a cotización — un asesor responde con el valor exacto.';

  return lines.join('\n');
}

export function initStepQuote() {
  document.getElementById('quote-qty').addEventListener('input', renderQuoteSummary);

  document.getElementById('quote-whatsapp-btn').addEventListener('click', () => {
    const summary = renderQuoteSummary();
    const msg = `Hola, quiero cotizar cápsulas personalizadas:\n${summary}`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
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
