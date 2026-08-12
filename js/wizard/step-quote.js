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
// 5. Quantity & quote — assembles every choice made in steps 1-4
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
// used by "copy summary", and refreshes the price estimate note. There's
// no on-screen list anymore — the summary only ever leaves the page as
// cotizador/clipboard text.
export function renderQuoteSummary() {
  const qtyInput = document.getElementById('quote-qty');
  const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
  const { selectedTipo, selectedSize, appliedColor, customization } = state;

  const lines = [
    `Type: ${selectedTipo}`,
    `Size: ${selectedSize.code} (${selectedSize.length.toFixed(2)} mm)`,
    `Cap: ${FINISH_LABELS[appliedColor.cap.finish]} ${describeColor(appliedColor.cap.hex)}`,
    `Body: ${FINISH_LABELS[appliedColor.body.finish]} ${describeColor(appliedColor.body.hex)}`,
  ];
  if (customization.cap.logoName) lines.push(`Cap logo: ${customization.cap.logoName}`);
  if (customization.body.logoName) lines.push(`Body logo: ${customization.body.logoName}`);
  if (customization.cap.text) lines.push(`Cap text: "${customization.cap.text}"`);
  if (customization.body.text) lines.push(`Body text: "${customization.body.text}"`);
  lines.push(`Quantity: ${qty.toLocaleString('en-US')} units`);

  const estimate = computeEstimate(selectedSize.code, selectedTipo, qty);
  document.getElementById('quote-estimate').textContent = estimate
    ? `Estimated: $${estimate.toFixed(2)} USD`
    : 'Price subject to quotation — an advisor will follow up with the exact value.';

  return lines.join('\n');
}

// Goes straight into the cotizador (POST /quotes/generate,
// director-globalquimia-llc — see GEP-400) instead of building a WhatsApp
// link. The cotizador's approval queue keeps the record; the chat opened
// by openChatwoot() below is the channel where a human agent actually
// helps the customer.
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

// Opens the Chatwoot widget already loaded by the page embedding this
// designer — never injected here, so a second widget instance never fights
// the real one. setConversationCustomAttributes hands the agent the design
// summary and the id of the quote already queued, so the chat starts with
// context instead of asking for it from scratch.
function openChatwoot(summary, quoteId) {
  if (!window.$chatwoot) {
    console.warn('Capsula3D: window.$chatwoot is not available on this page — could not open chat.');
    return;
  }
  if (quoteId != null) {
    window.$chatwoot.setConversationCustomAttributes({
      capsula3d_quote_id: String(quoteId),
      capsula3d_summary: summary,
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

  // "Request a quote" plays the tunnel (capsule flies open, camera dives
  // through it, the Globalquimia logo appears and holds), files the quote
  // with the cotizador while the tunnel plays, then opens Chatwoot and
  // reverses the tunnel back out — the black overlay would otherwise sit
  // on top of the just-opened chat panel with pointer-events:auto, making
  // it unclickable.
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
    submitBtn.textContent = 'Sending...';

    let quote = null;
    try {
      quote = await submitQuote(name, contact, summary, qty);
    } catch (err) {
      console.error('Capsula3D: failed to submit the quote to the cotizador', err);
    }

    submitBtn.disabled = false;
    submitBtn.textContent = 'Request a quote';

    // The chat still opens even if the cotizador call failed — the
    // customer shouldn't get stuck over a backend error, they just lose
    // the automatic queue record (the agent picks it up by hand from chat).
    if (!quote) {
      submitError.textContent = "We couldn't register your quote automatically, but you can continue through chat.";
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
      btn.textContent = 'Copied ✓';
      setTimeout(() => { btn.textContent = original; }, 1500);
    });
  });
}
