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
import { initAccordion } from './wizard/accordion.js';
import { state } from './state.js';

window.__stateDebug = state; // hook for automated testing

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

// Sets up its own wheel/touch listeners, then normalizeScroll — that
// internal order matters (see the comment in scroll-advance.js) and is
// kept inside initScrollAdvance() itself rather than split across calls
// here.
initScrollAdvance();
