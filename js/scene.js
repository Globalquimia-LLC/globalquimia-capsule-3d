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
    // elongated shape.
    const camDist = maxDim * 2.6;
    const yaw = THREE.MathUtils.degToRad(35);
    const pitch = THREE.MathUtils.degToRad(-20);
    camera.position.set(
      camDist * Math.cos(pitch) * Math.sin(yaw),
      camDist * Math.sin(pitch) * -1,
      camDist * Math.cos(pitch) * Math.cos(yaw)
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
  // only the last size in a burst actually gets applied.
  let resizeScheduled = false;
  window.addEventListener('resize', () => {
    if (resizeScheduled) return;
    resizeScheduled = true;
    requestAnimationFrame(() => {
      resizeScheduled = false;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  });
}
