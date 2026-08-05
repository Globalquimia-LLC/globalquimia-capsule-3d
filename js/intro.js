// The two static sections that don't touch the capsule or wizard at all —
// the hero entrance and the closing section's own reveal/parallax.
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

  // Closing section: content staggers in the first time it scrolls into
  // view (start: 'top 75%' — fires a bit before it's fully on screen so it
  // doesn't feel late), and the brand mark drifts as its own parallax layer.
  gsap.fromTo('.closing-item',
    { opacity: 0, y: 24 },
    {
      opacity: 1, y: 0, duration: 0.7, stagger: 0.1, ease: 'power2.out',
      scrollTrigger: { trigger: '.closing', start: 'top 75%' },
    }
  );
  gsap.to('#closing-symbol', {
    yPercent: -14,
    ease: 'none',
    scrollTrigger: { trigger: '.closing', start: 'top bottom', end: 'bottom top', scrub: true },
  });
}
