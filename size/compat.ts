// size/compat.ts — -compat yolunun TAMAMI. esm.ts'in ikizi, tek fark init().
import RAPIER from "@dimforge/rapier3d-compat";

// WASM base64 olarak paketin içinde; init() onu çözüp motoru ayağa kaldırır.
// Bunu atlarsan World/collider çağrıları "not initialized" ile patlar.
await RAPIER.init();

const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
console.log(RAPIER.version(), world.timestep);
