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

// Tapa/Cuerpo piece switcher — a flat tab-bar (see .piece-tabgroup in
// styles.css) instead of an accordion: no open/close choreography, just
// swap which .piece-tab-panel carries the 'active' class. Generic across
// every .piece-tabgroup on the page (step 3's Tradicionales/Mate groups,
// step 4's single group), driven purely by matching data-target between
// a group's own .piece-tab buttons and its own .piece-tab-panel
// children. Step 4 also needs to physically move #design-controls-shared
// into whichever panel is now active — that extra behavior lives in
// step-design.js's own click listener on the same buttons rather than
// here, so this stays a plain, reusable switcher with no special case.
export function initPieceTabs() {
  document.querySelectorAll('.piece-tabgroup').forEach((group) => {
    const tabs = group.querySelectorAll(':scope > .piece-tabs > .piece-tab');
    const panels = group.querySelectorAll(':scope > .piece-tab-panels > .piece-tab-panel');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.toggle('active', t === tab));
        panels.forEach((p) => p.classList.toggle('active', p.dataset.target === tab.dataset.target));
      });
    });
  });
}
