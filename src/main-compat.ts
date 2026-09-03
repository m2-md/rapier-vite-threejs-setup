import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { createSim, type RapierApi } from "./sim";
import { syncBodyToObject } from "./sync";
import { FixedStepper } from "./stepper";
import { buildScene } from "./scene";
import { createHud } from "./view/hud";
import { bindControls } from "./view/controls";

// WASM is inside the package as base64; init() decodes it and boots the engine.
// Skipping this causes World/collider calls to fail with 'not initialized'.
// This line is a top-level await in your code — which is why esnext is needed in 3 places.
await RAPIER.init();

const { scene, camera, renderer } = buildScene();
// Beyond this point the API is identical to pure ESM: sole difference is the init above.
const { world, bodies } = createSim(RAPIER as unknown as RapierApi, 24);

const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
const material = new THREE.MeshStandardMaterial({ color: 0x4cc9f0 });
const meshes = bodies.map(() => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  scene.add(mesh);
  return mesh;
});

const hud = createHud(
  RAPIER as unknown as RapierApi,
  { world, bodies },
  "COMPAT",
);
bindControls({ world, bodies });

const stepper = new FixedStepper(1 / 60);
let last = performance.now();

renderer.setAnimationLoop(() => {
  const now = performance.now();
  const frameSeconds = (now - last) / 1000;
  last = now;

  const steps = stepper.advance(frameSeconds);
  for (let i = 0; i < steps; i++) world.step();

  for (let i = 0; i < bodies.length; i++) {
    syncBodyToObject(bodies[i], meshes[i]);
  }

  renderer.render(scene, camera);
  hud.update(steps);
});
