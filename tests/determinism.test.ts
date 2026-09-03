import { describe, expect, it } from "vitest";
import RAPIER_ESM from "@dimforge/rapier3d";
import RAPIER_COMPAT from "@dimforge/rapier3d-compat";
import { createSim, type RapierApi } from "../src/sim";

const ESM = RAPIER_ESM as unknown as RapierApi;
const COMPAT = RAPIER_COMPAT as unknown as RapierApi;

function runSteps(R: RapierApi, count: number, steps: number): number[] {
  const sim = createSim(R, count);
  for (let i = 0; i < steps; i++) sim.world.step();
  return sim.bodies.map((b) => b.translation().y);
}

describe("setup validation", () => {
  it("engine is running and version is pinned", () => {
    expect(ESM.version()).toBe("0.19.3");
  });

  it("pure ESM has no init() — -compat has it", async () => {
    expect((RAPIER_ESM as { init?: unknown }).init).toBeUndefined();
    expect(typeof RAPIER_COMPAT.init).toBe("function");
    await RAPIER_COMPAT.init();
  });

  it("same input produces identical output", () => {
    const a = runSteps(ESM, 8, 120);
    const b = runSteps(ESM, 8, 120);
    // Not toBeCloseTo, but toEqual: exact equality required.
    expect(a).toEqual(b);
  });

  it("two packages run the same engine", async () => {
    await RAPIER_COMPAT.init();
    expect(runSteps(ESM, 8, 120)).toEqual(runSteps(COMPAT, 8, 120));
  });

  it("timestep is actually applied", () => {
    const fast = createSim(ESM, 1);
    const slow = createSim(ESM, 1);
    slow.world.timestep = 1 / 120; // half step

    for (let i = 0; i < 30; i++) {
      fast.world.step();
      slow.world.step();
    }
    // Same step count, half elapsed time -> half travel distance. Cube must stay higher.
    expect(slow.bodies[0].translation().y).toBeGreaterThan(
      fast.bodies[0].translation().y,
    );
  });

  it("WASM boundary at f32: timestep rounded when read back", () => {
    const w = new ESM.World({ x: 0, y: 0, z: 0 });
    w.timestep = 1 / 60;
    expect(w.timestep).not.toBe(1 / 60);
    expect(w.timestep).toBeCloseTo(1 / 60, 7);
  });
});
