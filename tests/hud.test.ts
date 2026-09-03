import { describe, expect, it } from "vitest";
import RAPIER_ESM from "@dimforge/rapier3d";
import { auditSetup } from "../src/checklist";
import { hudLines } from "../src/view/hud";
import { createSim, type RapierApi } from "../src/sim";

const ESM = RAPIER_ESM as unknown as RapierApi;

/**
 * Bu test makale ↔ kod paritesinin bekçisi: makaledeki HUD bloğu ile
 * demonun bastığı beş satır birebir aynı olmak zorunda. Sayılar da gerçek:
 * timestep WASM'dan geri okunuyor, y determinizm koşusundan geliyor,
 * 1.570.176 ise dist/'teki .wasm dosyasının gerçek boyutu.
 */
describe("HUD satırları", () => {
  it("saf ESM yolunda makaledeki bloğu birebir basar", () => {
    const report = auditSetup(ESM);
    const probe = new ESM.World({ x: 0, y: 0, z: 0 });
    probe.timestep = 1 / 60;
    const sim = createSim(ESM, 24);

    // Tarayıcıda bu bayrağı performance.getEntriesByType("resource") verir;
    // node'da .wasm isteği yok, o yüzden ölçülen değeri elle koyuyoruz.
    const lines = hudLines({
      report: { ...report, separateWasmRequest: true },
      timestep: probe.timestep,
      wasmBytes: 1_570_176,
      bodyCount: sim.bodies.length,
      colliderCount: sim.world.colliders.len(),
      steps: 1,
    });

    expect(lines).toEqual([
      "RAPIER      0.19.3",
      "wasm sınırı ✓  (timestep 0.01666666753590107)",
      "ayrı .wasm  ✓  (1.570.176 B, application/wasm)",
      "determinizm ✓  (y = 0.49872392416000366)",
      "gövde       24 · collider 25 · adım/kare 1",
    ]);
  });

  it("-compat yolunda üçüncü satır ✗ olur", () => {
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
      "ayrı .wasm  ✗  (base64 gömülü, ağda .wasm isteği yok)",
    );
  });
});
