// The hero entrance — the only static section left that doesn't touch the
// capsule or wizard (the closing tunnel now hands off straight to
// WhatsApp, navigating away from the page — there's no separate closing
// section left to reveal here).
export function initIntro() {
  // Hero entrance: plays once immediately on load (no ScrollTrigger — the
  // page always opens on the intro). A gentle stagger reads as considered
  // rather than everything popping in at once.
  gsap.timeline({ defaults: { ease: 'power3.out' } })
    .to('.intro-item', { opacity: 1, y: 0, duration: 0.9, stagger: 0.14 }, 0.1);

  // Hex-pattern background drifts at a different rate than the content as
  // the intro scrolls away — a subtle parallax layer, not a headline effect.
  gsap.to('#intro-pattern', {
    yPercent: 18,
    ease: 'none',
    scrollTrigger: { trigger: '.intro', start: 'top top', end: 'bottom top', scrub: true },
  });
}
