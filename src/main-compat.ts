import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { createSim, type RapierApi } from "./sim";
import { syncBodyToObject } from "./sync";
import { FixedStepper } from "./stepper";
import { buildScene } from "./scene";
import { createHud } from "./view/hud";
import { bindControls } from "./view/controls";

// WASM base64 olarak paketin içinde; init() onu çözüp motoru ayağa kaldırır.
// Bunu atlarsan World/collider çağrıları "not initialized" ile patlar.
// Bu satır senin kodunda bir top-level await — üç yerde esnext bu yüzden.
await RAPIER.init();

const { scene, camera, renderer } = buildScene();
// Bu noktadan sonra API saf ESM'dekiyle bire bir aynı: tek fark yukarıdaki init.
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
