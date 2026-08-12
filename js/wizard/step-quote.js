import { state } from '../state.js';
import { PRICE_TABLE, FINISH_LABELS, PALETTE, METAL_PALETTE, DIRECTOR_API_URL, DIRECTOR_API_KEY, DIRECTOR_EMPRESA } from '../constants.js';
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

// Builds the plain-text summary sent as the cotizador's `notes` field and
// used by "copiar resumen", and refreshes the price estimate note. There's
// no on-screen list anymore — the summary only ever leaves the page as
// cotizador/clipboard text.
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

// Entra directo al cotizador (POST /quotes/generate, director-globalquimia-llc
// — ver GEP-400) en vez de armar un link de WhatsApp. La cola de aprobación
// del cotizador queda con el registro; el chat abierto por openChatwoot()
// abajo es el canal donde un agente humano realmente atiende al cliente.
async function submitQuote(clientName, clientContact, summary, qty) {
  const response = await fetch(DIRECTOR_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': DIRECTOR_API_KEY },
    body: JSON.stringify({
      empresa: DIRECTOR_EMPRESA,
      clientName,
      ...(clientContact ? { clientContact } : {}),
      notes: summary,
      items: [{ product: state.selectedTipo, quantity: qty }],
    }),
  });
  if (!response.ok) throw new Error(`quote request failed with status ${response.status}`);
  return response.json();
}

// Abre el widget de Chatwoot ya cargado por la página que embebe este
// diseñador — nunca se inyecta un script acá, para no crear una segunda
// instancia del widget peleando con la real. setConversationCustomAttributes
// le da al agente el resumen del diseño y el id de la cotización ya
// encolada, así arranca la charla con contexto en vez de pedirlo de cero.
function openChatwoot(summary, quoteId) {
  if (!window.$chatwoot) {
    console.warn('Capsula3D: window.$chatwoot no está disponible en esta página — no se pudo abrir el chat.');
    return;
  }
  if (quoteId != null) {
    window.$chatwoot.setConversationCustomAttributes({
      capsula3d_quote_id: String(quoteId),
      capsula3d_resumen: summary,
    });
  }
  window.$chatwoot.toggle('open');
}

export function initStepQuote() {
  document.getElementById('quote-qty').addEventListener('input', renderQuoteSummary);

  const nameInput = document.getElementById('quote-name');
  const nameError = document.getElementById('quote-name-error');
  nameInput.addEventListener('input', () => {
    if (nameInput.value.trim()) {
      nameInput.classList.remove('invalid');
      nameError.hidden = true;
    }
  });

  // "Solicitar cotización" plays the tunnel (capsule flies open, camera
  // dives through it, the Globalquimia logo appears and holds), files the
  // quote with the cotizador while the tunnel plays, then opens Chatwoot
  // and reverses the tunnel back out — the black overlay would otherwise
  // sit on top of the just-opened chat panel with pointer-events:auto,
  // making it unclickable.
  const submitBtn = document.getElementById('quote-submit-btn');
  const submitError = document.getElementById('quote-submit-error');
  submitBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.classList.add('invalid');
      nameError.hidden = false;
      nameInput.focus();
      return;
    }

    const contact = document.getElementById('quote-contact').value.trim();
    const qtyInput = document.getElementById('quote-qty');
    const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
    const summary = renderQuoteSummary();

    submitError.hidden = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';

    let quote = null;
    try {
      quote = await submitQuote(name, contact, summary, qty);
    } catch (err) {
      console.error('Capsula3D: fallo al enviar la cotización al cotizador', err);
    }

    submitBtn.disabled = false;
    submitBtn.textContent = 'Solicitar cotización';

    // El chat igual se abre si el cotizador falló — el cliente no debería
    // quedar trabado por un error de backend, solo pierde el registro
    // automático en la cola (el agente lo toma a mano desde el chat).
    if (!quote) {
      submitError.textContent = 'No pudimos registrar tu cotización automáticamente, pero podés seguir por el chat.';
      submitError.hidden = false;
    }

    playTunnelSequence(() => {
      openChatwoot(summary, quote && quote.id);
      setTimeout(() => {
        if (state.tunnelTimeline) state.tunnelTimeline.reverse();
      }, 600);
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
