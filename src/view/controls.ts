import type { Sim } from "../sim";

/**
 * Single key: R = drop boxes again. No automatic sweeps, infinite spawn,
 * or background measurement — every measurement is explicitly triggered (A key in HUD).
 */
export function bindControls(sim: Sim): void {
  // Initial transforms are recorded at bind time; placement math
  // from createSim is not repeated, copied as-is.
  const start = sim.bodies.map((body) => ({
    t: body.translation(),
    r: body.rotation(),
  }));

  const zero = { x: 0, y: 0, z: 0 };

  window.addEventListener("keydown", (event) => {
    if (event.code !== "KeyR") return;
    sim.bodies.forEach((body, i) => {
      body.setTranslation(start[i].t, true);
      body.setRotation(start[i].r, true);
      body.setLinvel(zero, true);
      body.setAngvel(zero, true);
    });
  });
}
