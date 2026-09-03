// size/compat.ts — Complete -compat track. Twin of esm.ts, sole difference is init().
import RAPIER from "@dimforge/rapier3d-compat";

// WASM is inside the package as base64; init() decodes it and boots the engine.
// Skipping this causes World/collider calls to fail with 'not initialized'.
await RAPIER.init();

const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
console.log(RAPIER.version(), world.timestep);
