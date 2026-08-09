import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { state } from './state.js';
import { SPIN_FRICTION, SPIN_MIN_VELOCITY, ROTATION_CHASE_LERP } from './constants.js';
import { buildAllColorControls } from './wizard/step-color.js';
import { initScrollStory } from './interaction/scroll-story.js';
import { goToStep } from './wizard/wizard.js';
import { playTunnelSequence } from './interaction/tunnel.js';

// Renderer/camera/lights/environment, the capsule's GLTF load, and the
// render loop (momentum spin + scroll-rotation chase). Everything else
// (wizard steps, drag input, scroll interception) reads/writes the pieces
// this sets up on `state` rather than importing THREE objects directly.

// Fixed viewing angle (3/4 view — a camera along the capsule's local Z
// stares end-on into the rounded tip and just looks like a flat circle),
// same yaw/pitch the static product renders (render_capsule.py) use.
const YAW = THREE.MathUtils.degToRad(35);
const PITCH = THREE.MathUtils.degToRad(-20);
// 2.6 alone was tuned against a desktop-width (landscape) aspect — a
// FIXED distance means the capsule's on-screen SIZE scales with how
// narrow the viewport is, since the same distance covers proportionally
// less physical width on a tall/narrow phone screen than on a wide
// desktop one. The 1/aspect ratio keeps the capsule's rendered WIDTH
// consistent across viewports on its own, but a phone in portrait also
// has much less vertical room devoted to the capsule specifically once
// the wizard's own card takes up most of the screen — so portrait gets
// an extra pullback (MOBILE_EXTRA_PAD) on top of the width-matching
// ratio, leaving the capsule comfortably smaller rather than filling the
// whole narrow screen edge to edge. At aspect >= 1 (landscape/desktop,
// and also the docked mobile band — see reframeCapsuleCamera) it's a
// no-op, matching the original desktop framing exactly.
const MOBILE_EXTRA_PAD = 1.6;
function computeCamDist(maxDim, aspect) {
  const aspectPad = aspect >= 1 ? 1 : (1 / aspect) * MOBILE_EXTRA_PAD;
  return maxDim * 2.6 * aspectPad;
}

export function initScene() {
  state.container = document.getElementById('canvas-container');
  state.scene = new THREE.Scene();
  state.camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.001, 10);

  const { scene, camera, container } = state;

  state.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  const renderer = state.renderer;
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  // Soft shadows (PCF) read as product-photography quality at this scale;
  // a hard shadow map on a capsule this small would just look like a
  // pixelated dark smear under it.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // A tiny fake-studio environment (generated, no HDRI file to fetch) gives
  // the metalness-heavy "Metalizados" finish something to actually reflect —
  // with directional lights alone it just reads as flat dark grey since
  // there's nothing in the scene for a mirror-like surface to bounce.
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(1, 1.4, 1.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);
  const fillLight = new THREE.DirectionalLight(0xcfe0ff, 1.3);
  fillLight.position.set(-1.2, 0.3, -0.7);
  scene.add(fillLight);
  const rim = new THREE.DirectionalLight(0xffffff, 1.6);
  rim.position.set(0.2, -0.9, -1.4);
  scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));

  // Contact shadow catcher — an invisible-except-for-its-shadow plane below
  // the capsule. ShadowMaterial only ever paints the shadow itself, so the
  // "floor" never appears as a visible disc, just a soft grounding shadow.
  // Sized/positioned once the capsule's real bounding box is known (GLTF
  // load callback below), since the whole scene lives at ~0.02-unit scale.
  const shadowCatcher = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.ShadowMaterial({ opacity: 0.28 })
  );
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.receiveShadow = true;
  shadowCatcher.visible = false; // shown once sized correctly, below
  scene.add(shadowCatcher);

  const loader = new GLTFLoader();
  loader.load('capsule.glb', (gltf) => {
    const root = gltf.scene;
    root.traverse((obj) => {
      if (obj.name === 'capsule_cap') state.capNode = obj;
      // The GLB has no material at all (only per-vertex COLOR_0) — GLTFLoader's
      // fallback for that renders as translucent. Assign an explicit opaque
      // material with a plain color (not vertexColors) so each piece can be
      // recolored live from the palette without fighting baked vertex color.
      if (obj.isMesh) {
        // The GLB also has no NORMAL attribute (only POSITION + COLOR_0), so
        // there's nothing for lighting to shade against — compute smooth
        // normals directly from the geometry.
        obj.geometry.computeVertexNormals();
        const isCap = obj.name === 'capsule_cap';
        const mat = new THREE.MeshStandardMaterial({
          color: isCap ? 0x2e8ad6 : 0xf8f8f8,
          roughness: 0.35,
          metalness: 0.05,
          transparent: false,
          opacity: 1,
          side: THREE.DoubleSide,
        });
        obj.material = mat;
        // The cap can cast a real shadow onto the body (and vice versa)
        // once it swings open during the scroll story — both pieces both
        // cast and receive so that reads correctly either way.
        obj.castShadow = true;
        obj.receiveShadow = true;
        if (isCap) { state.capMaterial = mat; state.capMeshObj = obj; } else { state.bodyMaterial = mat; state.bodyMeshObj = obj; }
      }
    });

    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    root.position.sub(center); // center the whole capsule at the origin
    state.capsuleGroup = new THREE.Group();
    state.capsuleGroup.add(root);
    scene.add(state.capsuleGroup);
    window.__debugCapsuleGroup = state.capsuleGroup; // hook for automated testing

    buildAllColorControls();

    const maxDim = Math.max(size.x, size.y, size.z);
    state.maxDimGlobal = maxDim; // used later by the closing tunnel sequence

    // Shadow camera + contact-shadow catcher, sized to the capsule's real
    // (tiny) scale. near/far are measured from the LIGHT's actual position
    // (still a full ~2-unit vector, unscaled) to the scene content near the
    // origin — scaling them by maxDim alone (a ~0.02-unit quantity) would
    // put both planes way short of where the light actually is, clipping
    // the whole capsule out of the shadow frustum and producing no shadow.
    const lightDist = key.position.length();
    key.shadow.camera.left = -maxDim * 1.4;
    key.shadow.camera.right = maxDim * 1.4;
    key.shadow.camera.top = maxDim * 1.4;
    key.shadow.camera.bottom = -maxDim * 1.4;
    key.shadow.camera.near = lightDist - maxDim * 3;
    key.shadow.camera.far = lightDist + maxDim * 3;
    key.shadow.camera.updateProjectionMatrix();
    key.shadow.bias = -maxDim * 0.01;
    shadowCatcher.scale.setScalar(maxDim * 6);
    shadowCatcher.position.y = -maxDim * 0.62;
    shadowCatcher.visible = true;

    // The capsule's long axis is local Z — a camera placed straight along Z
    // stares end-on into the rounded tip (looks like a flat circle). Use a
    // 3/4 angled position instead, same yaw/pitch approach as the static
    // product renders (render_capsule.py) so it actually shows the capsule's
    // elongated shape. baseDir established here once; reframeCapsuleCamera
    // (below) only ever changes ITS MAGNITUDE (camDist) afterward, never
    // the direction, so scroll-story.js's applyDolly() — which always
    // reads baseDir fresh — keeps working unchanged.
    const camDist = computeCamDist(maxDim, camera.aspect);
    camera.position.set(
      camDist * Math.cos(PITCH) * Math.sin(YAW),
      camDist * Math.sin(PITCH) * -1,
      camDist * Math.cos(PITCH) * Math.cos(YAW)
    );
    camera.lookAt(0, 0, 0);
    camera.userData.baseDir = camera.position.clone().normalize();

    initScrollStory(maxDim, camDist);
    window.__capsuleReady = true; // hook for automated testing
    window.__goToStepDebug = goToStep; // hook for automated testing
    window.__playTunnelSequenceDebug = playTunnelSequence; // hook for automated testing
    window.__cameraDebug = camera; // hook for automated testing
  });

  function animate() {
    requestAnimationFrame(animate);
    // Momentum spin: only once the pointer's been released (a live drag
    // already sets rotation.y directly in drag.js) and only while it's
    // still fast enough to notice — decays a little more every frame.
    if (!state.isDragging && !state.rotationLocked && state.capsuleGroup && Math.abs(state.spinVelocityY) > SPIN_MIN_VELOCITY) {
      state.capsuleGroup.rotation.y += state.spinVelocityY;
      state.spinVelocityY *= SPIN_FRICTION;
    } else if (!state.isDragging && !state.rotationLocked && state.capsuleGroup && performance.now() < state.chaseUntil) {
      // Story scroll is actively driving rotationTarget right now (see the
      // ScrollTrigger onUpdate in scroll-story.js) — ease toward it instead
      // of snapping, so resuming scroll after a manual drag glides back
      // into sync.
      state.capsuleGroup.rotation.y += (state.rotationTarget.y - state.capsuleGroup.rotation.y) * ROTATION_CHASE_LERP;
    }
    renderer.render(scene, camera);
  }
  animate();

  // Debounced (rAF-coalesced) so a continuous window-resize drag doesn't
  // thrash the renderer/projection matrix on every single mousemove tick —
  // only the last size in a burst actually gets applied. Deliberately
  // does NOT touch camera.position — that stays under the scroll-driven
  // dolly timeline's exclusive control (applyDolly in scroll-story.js);
  // only aspect/size follow the container here, same as always.
  let resizeScheduled = false;
  window.addEventListener('resize', () => {
    if (resizeScheduled) return;
    resizeScheduled = true;
    requestAnimationFrame(() => {
      resizeScheduled = false;
      const rect = container.getBoundingClientRect();
      camera.aspect = (rect.width || window.innerWidth) / (rect.height || window.innerHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(rect.width || window.innerWidth, rect.height || window.innerHeight);
    });
  });
}

// Exported so scroll-story.js can re-frame the camera when docking/
// undocking #canvas-container on mobile (see initScrollStory) — resizes
// the renderer/aspect to the container's CURRENT box (whatever CSS says
// it is right now) and, unlike the plain resize handler above, also
// repositions the camera along its existing baseDir at the new aspect's
// camDist. Safe to reposition here specifically because docking only
// ever toggles once scroll is already locked (wizardActive) — the dolly
// timeline isn't mid-flight driving camera.position when this runs, so
// there's nothing for this to fight with.
export function reframeCapsuleCamera() {
  const { camera, renderer, container, maxDimGlobal } = state;
  if (!camera || !renderer || !container || !maxDimGlobal || !camera.userData.baseDir) return;
  const rect = container.getBoundingClientRect();
  const width = rect.width || window.innerWidth;
  const height = rect.height || window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  const camDist = computeCamDist(maxDimGlobal, camera.aspect);
  camera.position.copy(camera.userData.baseDir).multiplyScalar(camDist);
  camera.lookAt(0, 0, 0);
}
