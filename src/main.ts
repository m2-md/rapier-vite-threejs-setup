import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d"; // init() YOK — saf ESM
import { createSim } from "./sim";
import { syncBodyToObject } from "./sync";
import { FixedStepper } from "./stepper";
import { buildScene } from "./scene";
import { createHud } from "./view/hud";
import { bindControls } from "./view/controls";

const { scene, camera, renderer } = buildScene();
const { world, bodies } = createSim(RAPIER, 24);

// Her gövde için bir mesh. 24 kutu için bu tamamen yeterli;
// on binlerce gövdeye çıkarsan InstancedMesh'e geçmen gerekir.
const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
const material = new THREE.MeshStandardMaterial({ color: 0x4cc9f0 });
const meshes = bodies.map(() => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  scene.add(mesh);
  return mesh;
});

// Sunum: HUD kurulum raporunu basar (A = yeniden ölç), R = yeniden düşür.
const hud = createHud(RAPIER, { world, bodies }, "ESM");
bindControls({ world, bodies });

const stepper = new FixedStepper(1 / 60);
let last = performance.now();

renderer.setAnimationLoop(() => {
  const now = performance.now();
  const frameSeconds = (now - last) / 1000;
  last = now;

  // Kaç adım gerekiyorsa o kadar; sıfır da olabilir, üç de.
  const steps = stepper.advance(frameSeconds);
  for (let i = 0; i < steps; i++) world.step();

  // Fizik ilerledi; şimdi ekranı ona göre güncelle.
  for (let i = 0; i < bodies.length; i++) {
    syncBodyToObject(bodies[i], meshes[i]);
  }

  renderer.render(scene, camera);
  hud.update(steps);
});
