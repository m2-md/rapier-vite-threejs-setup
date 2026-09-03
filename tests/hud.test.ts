import { describe, expect, it } from "vitest";
import RAPIER_ESM from "@dimforge/rapier3d";
import { auditSetup } from "../src/checklist";
import { hudLines } from "../src/view/hud";
import { createSim, type RapierApi } from "../src/sim";

const ESM = RAPIER_ESM as unknown as RapierApi;

/**
 * Guardian of parity: the HUD block must match the five lines exactly.
 * Real values: timestep read back from WASM, y from determinism run,
 * and 1,570,176 is the actual byte size of dist/ .wasm file.
 */
describe("HUD lines", () => {
  it("prints the exact block in pure ESM track", () => {
    const report = auditSetup(ESM);
    const probe = new ESM.World({ x: 0, y: 0, z: 0 });
    probe.timestep = 1 / 60;
    const sim = createSim(ESM, 24);

    // In browser performance.getEntriesByType("resource") provides this flag;
    // in Node there is no .wasm request, so measured value is injected manually.
    const lines = hudLines({
      report: { ...report, separateWasmRequest: true },
      timestep: probe.timestep,
      wasmBytes: 1_570_176,
      bodyCount: sim.bodies.length,
      colliderCount: sim.world.colliders.len(),
      steps: 1,
    });

    expect(lines).toEqual([
      "RAPIER        0.19.3",
      "wasm boundary ✓  (timestep 0.01666666753590107)",
      "separate wasm ✓  (1,570,176 B, application/wasm)",
      "determinism   ✓  (y = 0.49872392416000366)",
      "bodies        24 · collider 25 · steps/frame 1",
    ]);
  });

  it("becomes ✗ on the third line in -compat track", () => {
    const report = auditSetup(ESM);
    const sim = createSim(ESM, 24);
    const lines = hudLines({
      report: { ...report, separateWasmRequest: false },
      timestep: 0.01666666753590107,
      wasmBytes: 0,
      bodyCount: sim.bodies.length,
      colliderCount: sim.world.colliders.len(),
      steps: 1,
    });

    expect(lines[2]).toBe(
      "separate wasm ✗  (embedded base64, no .wasm request on network)",
    );
  });
});
