import { state } from '../state.js';
import { goToStep } from '../wizard/wizard.js';

// ---------------------------------------------------------------------
// Scroll-to-continue — replaces "Continuar" buttons on steps 3/4. Once
// the main scroll story is fully consumed (progress ~1, which is exactly
// when the wizard is showing at all), further downward scroll/wheel/swipe
// would normally just unpin #story and scroll past it — intercepted here
// instead and repurposed as "move to the next step" while on 3 or 4.
// Steps 1-2 stay click-driven on purpose: picking a tipo/tamaño is an
// actual decision, not a "continue when ready" beat. Step 5 is the end
// of the line — scrolling down does nothing there; only the explicit
// "Solicitar cotización" button starts the closing tunnel.
//
// Scrolling back up mirrors scrolling down: while the tunnel is
// mid-flight (started via that button) it reverses (same eased path,
// backwards, via GSAP's own .reverse() — that's what keeps it feeling
// like one continuous motion instead of a jump-cut back to step 5), and
// once it's fully closed again an upward scroll retreats the wizard a
// step at a time — 5 -> 4 -> 3 -> 2 -> 1 — showing each one's own
// content as it lands, same as clicking "Volver" repeatedly but
// scroll-driven. Step 1 is a hard floor, not a step like the others:
// once the wizard has been entered, there's no scroll/button path back
// out to the pre-wizard intro/story — see the deltaY < 0 branch below.
// ---------------------------------------------------------------------
function nudgeStepMenu() {
  const now = performance.now();
  if (now - state.lastNudgeAt < 500) return; // already mid-pulse — let it finish instead of restacking
  state.lastNudgeAt = now;
  const panel = document.querySelector('.step-panel.active');
  if (!panel) return;
  panel.classList.remove('nudge');
  void panel.offsetWidth; // force reflow so re-adding the class restarts the animation
  panel.classList.add('nudge');
}

function tryAdvanceOnScroll(deltaY) {
  const st = state.storyScrollTrigger;
  if (!st) return false;
  // st.progress is smoothed by scrub:1 — it lags up to ~1s behind the
  // real scroll position, so gating on it (progress >= 0.999) let the
  // first wheel tick or two slip past the pin's actual end before this
  // caught up, unpinning #story into .closing for a frame. window.scrollY
  // vs st.end (both real pixel values, no smoothing) has no such lag —
  // but a plain "< st.end" check alone still isn't enough: the *last*
  // tick before actually reaching the end is still legitimately let
  // through (correct, so the final bit of story motion isn't skipped),
  // and a single wheel/trackpad tick's delta can easily be bigger than
  // whatever's left of that gap, overshooting past st.end in one motion
  // (measured: a 150px tick from 30px out landed 120px past the end —
  // exactly the gap that let .closing peek through). So: predict where
  // this tick would land, and if it would cross st.end, clamp the actual
  // scroll to land exactly on it instead of wherever the raw delta says.
  // This predictive clamp only matters while still approaching the pin —
  // normalizeScroll's own engine is still driving scroll then, and is what
  // can overshoot past st.end in one tick (see comment above). Once the
  // wizard is active, scroll-story.js has already disabled scrollNormalizer
  // and every wheel/touch event down here gets swallowed (falls through to
  // the step-advance/retreat logic below, which returns true), so scrollY
  // never actually moves again — comparing it to st.end at that point would
  // only ever misfire (e.g. right after a step goToStep() left scrollY
  // sitting anywhere from an earlier native scroll), and a deltaY < 0 catch
  // here would swallow scroll-up retreats before they ever reach the
  // step-back logic below.
  if (!state.wizardScrollLocked && window.scrollY < st.end - 2) {
    if (deltaY > 0 && window.scrollY + deltaY > st.end) {
      window.scrollTo(0, st.end);
      return true;
    }
    return false;
  }

  if (state.tunnelTimeline && state.tunnelPlaying) {
    // Symmetric control: scroll up unwinds the sequence, scroll down drives
    // it forward again — either direction can interrupt and take over from
    // wherever the other one left off. Without the play() branch, scrolling
    // down after a partial reverse did nothing (event still swallowed
    // below), leaving the timeline to keep auto-unwinding on its own
    // regardless of the user then trying to scroll back into it.
    if (deltaY < 0) state.tunnelTimeline.reverse();
    else if (deltaY > 0) state.tunnelTimeline.play();
    return true; // swallow all scroll while the tunnel is animating either way
  }

  if (deltaY === 0) return false;
  if (deltaY > 0 && state.currentStep < 3) {
    // Steps 1-2 stay click-only going forward — but letting the event
    // fall through to native scroll here used to unpin #story once its
    // scrub was maxed out, dropping straight into .closing early. Swallow
    // it and nudge the option list instead of doing nothing (or worse).
    nudgeStepMenu();
    return true;
  }
  // Step 1 is the floor, not a step to retreat past — once the wizard is
  // up, there's no way back to the pre-wizard intro/story. Swallow (not
  // "return false") so the event doesn't fall through to native scroll,
  // which used to unpin #story and reveal the earlier stages again.
  if (deltaY < 0 && state.currentStep <= 1) return true;

  // A hard swipe/wheel burst can dispatch many events in a row — without
  // a cooldown that would blow through 2-3 steps on one gesture instead
  // of feeling like "one scroll, one step".
  const now = performance.now();
  if (now - state.lastScrollAdvanceAt < 700) return true; // still swallow the event so the page itself doesn't scroll
  state.lastScrollAdvanceAt = now;

  if (deltaY > 0) {
    // Step 5 is the end of the line — no scroll-triggered advance from
    // here. "Solicitar cotización" (step-quote.js) is the only way to
    // start the closing tunnel; the event is still swallowed below so it
    // doesn't fall through to native page scroll.
    if (state.currentStep < 5) goToStep(state.currentStep + 1);
  } else {
    goToStep(state.currentStep - 1);
  }
  return true;
}

// Button-driven equivalent of one solid wheel/swipe tick, for anyone with
// no mouse/trackpad/touchscreen to drive the scroll-based navigation at
// all (see the fixed prev/next buttons in scroll_full.html). direction is
// +1 (forward/down) or -1 (back/up).
function manualStep(direction) {
  // tryAdvanceOnScroll already knows how to route this once the tunnel is
  // mid-flight or the wizard is locked in (reverse/play the tunnel, step
  // the wizard forward/back, nudge the menu on 1-2, swallow retreats past
  // step 1) — same as a real wheel tick. It returns false only in the
  // still-in-the-free-scroll-story case (nothing wizard-related to route
  // yet) — a button press has no native scroll to fall back on there, so
  // that case gets an explicit scroll nudge below.
  if (tryAdvanceOnScroll(direction * 300)) return;
  const st = state.storyScrollTrigger;
  let target = window.scrollY + direction * (window.innerHeight * 0.6);
  if (st) target = Math.min(target, st.end);
  target = Math.max(target, 0);
  // scrollNormalizer.scrollY() only actually moves anything while the
  // normalizer itself is the one driving scroll — this fallback is only
  // ever reached pre-wizard (free-scroll story), the one state where it's
  // still enabled. Calling the normalizer's own setter while it's disabled
  // (wizard active) would be a silent no-op anyway, but that path is now
  // moot: tryAdvanceOnScroll already swallows every wizard-active call
  // above, including step 1's retreat attempt, so execution never reaches
  // here once the wizard has been entered.
  if (state.scrollNormalizer && !state.wizardScrollLocked) state.scrollNormalizer.scrollY(target);
  else window.scrollTo({ top: target, behavior: 'smooth' });
}

// Range sliders (Rotar/Tamaño, font size...) and Pickr's own gradient
// square/hue strip (anything under .picker-mount) need to OWN their drag
// gesture end to end. The global wheel/touchmove listeners below
// otherwise treat any vertical drag on top of them as a step-advance/
// retreat swipe, which steals the input (a color/slider drag stops
// having any visible effect past the very first pixel) and, worse,
// changes the wizard step out from under whatever the user was actually
// trying to do. A tap still works either way (touchstart+touchend with
// no intervening move is never a "drag"), so this only needs to suppress
// interception once an actual drag on one of these starts.
function isRangeOrPickerTarget(el) {
  return !!(el && el.closest && el.closest('input[type="range"], .picker-mount'));
}

// The capsule canvas — touch-only, and only once the wizard is active
// (mouse-drag rotation runs through pointerdown/pointermove in drag.js,
// entirely separate from wheel/touchstart, so it never needed this).
// Deliberately NOT folded into the wheel listener below: wheel has no
// canvas-owned behavior to protect (nothing rotates the capsule on
// wheel), so excluding it there — as an earlier version of this file did,
// reusing the same combined check for both — meant scrolling the wheel
// while the cursor happened to be sitting over the capsule (very
// plausible on desktop; the capsule sits right in the middle of the
// step's own content) silently did nothing AND still leaked into native
// scroll un-prevented, un-pinning #story and breaking the "retreat one
// step at a time" behavior instead of landing on the previous step.
// #canvas-container is scoped to wizardScrollLocked specifically —
// pre-wizard, touch on the canvas is still what drives the
// scroll-through-story cinematic, and excluding it there would break
// that instead.
function isCanvasTarget(el) {
  return !!(el && el.closest && state.wizardScrollLocked && el.closest('#canvas-container'));
}

export function initScrollAdvance() {
  window.addEventListener('wheel', (e) => {
    if (isRangeOrPickerTarget(e.target)) return;
    if (tryAdvanceOnScroll(e.deltaY)) e.preventDefault();
  }, { passive: false });

  document.getElementById('nav-prev-btn').addEventListener('click', () => manualStep(-1));
  document.getElementById('nav-next-btn').addEventListener('click', () => manualStep(1));

  let lastTouchY = null;
  let touchOwnedByControl = false;
  let touchOwnedByCanvas = false;
  window.addEventListener('touchstart', (e) => {
    lastTouchY = e.touches[0].clientY;
    touchOwnedByCanvas = isCanvasTarget(e.target);
    touchOwnedByControl = touchOwnedByCanvas || isRangeOrPickerTarget(e.target);
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (lastTouchY === null) return;
    if (touchOwnedByCanvas) {
      // The capsule's rotation comes entirely from drag.js's own pointer
      // listeners, not from any native browser behavior — so unlike the
      // slider/picker case below, there's nothing native to preserve here,
      // only the native SCROLL to suppress. Left unprevented, a vertical
      // drag on the capsule both rotated it (drag.js) AND scrolled the
      // real page underneath at the same time (wizardScrollLocked hands
      // scroll fully back to native — see scroll-story.js), un-pinning
      // #story mid-gesture and dropping back into the pre-wizard intro.
      e.preventDefault();
      return;
    }
    if (touchOwnedByControl) return; // slider/picker — let native touch-drag track the finger smoothly
    const dy = lastTouchY - e.touches[0].clientY; // finger moving up = scrolling down
    if (tryAdvanceOnScroll(dy)) e.preventDefault();
    lastTouchY = e.touches[0].clientY;
  }, { passive: false });

  // normalizeScroll installs its OWN wheel/touch listeners on this same
  // window — DOM listeners for one event type run in registration order,
  // so calling this only now (after ours, above) means our handler always
  // gets first look at every event and can preventDefault() before
  // normalizeScroll's own listener acts on it. Called the other way
  // around (right after registerPlugin, before any of our own listeners
  // existed), normalizeScroll saw and acted on every wheel/touch event a
  // beat before tryAdvanceOnScroll ever ran — so its own preventDefault()
  // came too late to matter, and a fast flick could still blow straight
  // through the pinned wizard into .closing despite the clamping logic
  // above being otherwise correct.
  state.scrollNormalizer = ScrollTrigger.normalizeScroll(true);
}
