// Entry point — wires every feature module together. No bundler: this is
// loaded as a plain <script type="module"> from scroll_full.html, so this
// file (and everything it imports) has to keep working served as-is by a
// static file server, same as before the split.
import { initIntro } from './intro.js';
import { initScene, initCapsuleZoomControls } from './scene.js';
import { initDragRotation } from './interaction/drag.js';
import { initDecalDrag } from './interaction/decal-drag.js';
import { initScrollAdvance } from './interaction/scroll-advance.js';
import { initWizardShell } from './wizard/wizard.js';
import { initStepTipo } from './wizard/step-tipo.js';
import { initStepTamano } from './wizard/step-tamano.js';
import { initStepDesign } from './wizard/step-design.js';
import { initStepQuote } from './wizard/step-quote.js';
import { initAccordion, initPieceTabs } from './wizard/accordion.js';
import { state } from './state.js';

window.__stateDebug = state; // hook for automated testing

// Header "‹ Back" — a real <a href="https://globalquimia.us/"> by default
// (works with zero JS, and for anyone who opened this page directly). When
// the visitor actually arrived via a same-site link (the common case: the
// "Request a quote" button on a capsule product page), history.back()
// returns them to that exact page instead of always landing on the home
// page.
const backLink = document.getElementById('header-back-link');
if (backLink && document.referrer && new URL(document.referrer).hostname === window.location.hostname) {
  backLink.addEventListener('click', (e) => {
    e.preventDefault();
    history.back();
  });
}

gsap.registerPlugin(ScrollTrigger);

initIntro();

// initScene() sets up state.container (among other things) as its first
// step — initDragRotation() needs that to already exist, so it has to run
// after. Every other init below is independent of both and of each other.
initScene();
initDragRotation();
initCapsuleZoomControls();

initWizardShell();
initStepTipo();
initStepTamano();
initStepDesign();
initDecalDrag();
initStepQuote();
initAccordion();
initPieceTabs();

// Sets up its own wheel/touch listeners, then normalizeScroll — that
// internal order matters (see the comment in scroll-advance.js) and is
// kept inside initScrollAdvance() itself rather than split across calls
// here.
initScrollAdvance();
