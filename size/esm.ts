// Measurement ENTRY — no three.js, no scene, no HUD.
// The byte table is intentionally measured with an "empty application file":
// this ensures the difference between both setups comes solely from Rapier's delivery format.
import RAPIER from "@dimforge/rapier3d";

const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
console.log(RAPIER.version(), world.timestep);
