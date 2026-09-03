import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d"; // NO init() — pure ESM
import { createSim } from "./sim";
import { syncBodyToObject } from "./sync";
import { FixedStepper } from "./stepper";
import { buildScene } from "./scene";
import { createHud } from "./view/hud";
import { bindControls } from "./view/controls";

const { scene, camera, renderer } = buildScene();
const { world, bodies } = createSim(RAPIER, 24);

// One mesh for each body. Completely sufficient for 24 boxes;
// if scaling to tens of thousands of bodies, switch to InstancedMesh.
const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
const material = new THREE.MeshStandardMaterial({ color: 0x4cc9f0 });
const meshes = bodies.map(() => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  scene.add(mesh);
  return mesh;
});

// Presentation: HUD prints setup report (A = re-measure), R = drop again.
const hud = createHud(RAPIER, { world, bodies }, "ESM");
bindControls({ world, bodies });

const stepper = new FixedStepper(1 / 60);
let last = performance.now();

renderer.setAnimationLoop(() => {
  const now = performance.now();
  const frameSeconds = (now - last) / 1000;
  last = now;

  // Run as many steps as required; can be zero or three.
  const steps = stepper.advance(frameSeconds);
  for (let i = 0; i < steps; i++) world.step();

  // Physics advanced; now update the screen accordingly.
  for (let i = 0; i < bodies.length; i++) {
    syncBodyToObject(bodies[i], meshes[i]);
  }

  renderer.render(scene, camera);
  hud.update(steps);
});
