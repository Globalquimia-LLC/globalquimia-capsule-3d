// Generic accordion open/close, uniform at every level — currently just
// Color's 3 finish children (Tradicionales/Mate/Metalizados), each
// mutually exclusive within their parent. Height is animated to the real
// measured content height (not a guessed CSS max-height cap), so the
// easing curve actually plays out over the visible motion instead of
// mostly finishing off-screen.
function openAccBody(item) {
  const body = item.querySelector(':scope > .acc-body');
  item.classList.add('open');
  gsap.killTweensOf(body);
  gsap.set(body, { height: 'auto' });
  const targetH = body.offsetHeight;
  gsap.fromTo(body, { height: 0 }, {
    height: targetH, duration: 0.42, ease: 'power2.out',
    onComplete: () => gsap.set(body, { height: 'auto' }),
  });
}

function closeAccBody(item) {
  const body = item.querySelector(':scope > .acc-body');
  gsap.killTweensOf(body);
  gsap.set(body, { height: body.offsetHeight });
  gsap.to(body, {
    height: 0, duration: 0.3, ease: 'power2.in',
    onComplete: () => item.classList.remove('open'),
  });
}

export function initAccordion() {
  document.querySelectorAll('.acc-header').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.parentElement;
      const willOpen = !item.classList.contains('open');
      item.parentElement.querySelectorAll(':scope > .acc-item').forEach((sib) => {
        if (sib !== item && sib.classList.contains('open')) closeAccBody(sib);
      });
      if (willOpen) openAccBody(item); else closeAccBody(item);
    });
  });
}
