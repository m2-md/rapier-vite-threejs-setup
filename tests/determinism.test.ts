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

describe("kurulum doğrulaması", () => {
  it("motor ayakta ve sürüm pinlenmiş", () => {
    expect(ESM.version()).toBe("0.19.3");
  });

  it("saf ESM'de init() yoktur — -compat'ta vardır", async () => {
    expect((RAPIER_ESM as { init?: unknown }).init).toBeUndefined();
    expect(typeof RAPIER_COMPAT.init).toBe("function");
    await RAPIER_COMPAT.init();
  });

  it("aynı girdi → bit-bit aynı çıktı", () => {
    const a = runSteps(ESM, 8, 120);
    const b = runSteps(ESM, 8, 120);
    // toBeCloseTo değil, toEqual: yaklaşık değil, tam eşitlik istiyoruz.
    expect(a).toEqual(b);
  });

  it("iki paket aynı motoru çalıştırıyor", async () => {
    await RAPIER_COMPAT.init();
    expect(runSteps(ESM, 8, 120)).toEqual(runSteps(COMPAT, 8, 120));
  });

  it("timestep gerçekten uygulanıyor", () => {
    const fast = createSim(ESM, 1);
    const slow = createSim(ESM, 1);
    slow.world.timestep = 1 / 120; // yarım adım

    for (let i = 0; i < 30; i++) {
      fast.world.step();
      slow.world.step();
    }
    // Aynı adım sayısı, yarı süre → yarı yol. Küp daha yukarıda kalmalı.
    expect(slow.bodies[0].translation().y).toBeGreaterThan(
      fast.bodies[0].translation().y,
    );
  });

  it("WASM sınırı f32'de: timestep geri okunduğunda yuvarlanmış", () => {
    const w = new ESM.World({ x: 0, y: 0, z: 0 });
    w.timestep = 1 / 60;
    expect(w.timestep).not.toBe(1 / 60);
    expect(w.timestep).toBeCloseTo(1 / 60, 7);
  });
});
