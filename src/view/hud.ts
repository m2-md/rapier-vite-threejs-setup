import { auditSetup, type SetupReport } from "../checklist";
import type { RapierApi, Sim } from "../sim";

const LABEL_WIDTH = 14;
const label = (text: string) => text.padEnd(LABEL_WIDTH);
const fmt = (n: number) => n.toLocaleString("en-US");
const mark = (ok: boolean) => (ok ? "✓" : "✗");

export interface HudInput {
  report: SetupReport;
  /** Timestep read back from WASM — rounded to f32. */
  timestep: number;
  /** Size in bytes of .wasm request on network. 0 = unmeasured or no request. */
  wasmBytes: number;
  bodyCount: number;
  colliderCount: number;
  steps: number;
}

/** Five lines of HUD. Pure function: no DOM, verified in tests. */
export function hudLines(input: HudInput): string[] {
  const { report } = input;
  const wasm = report.separateWasmRequest
    ? `${mark(true)}  (${input.wasmBytes > 0 ? `${fmt(input.wasmBytes)} B` : "size not measured"}, application/wasm)`
    : `${mark(false)}  (embedded base64, no .wasm request on network)`;

  return [
    label("RAPIER") + report.version,
    label("wasm boundary") +
      `${mark(report.crossesWasmBoundary)}  (timestep ${input.timestep})`,
    label("separate wasm") + wasm,
    label("determinism") +
      `${mark(report.deterministic)}  (y = ${report.finalY})`,
    label("bodies") +
      `${input.bodyCount} · collider ${input.colliderCount} · steps/frame ${input.steps}`,
  ];
}

/** Programmatic inspection of network entries — byte count is measured, not hardcoded.
 *
 * TRAP: In dev Vite serves the same file under three separate URLs:
 *   `rapier_wasm3d_bg.wasm?import`      → JS wrapper (~76 KB, text/javascript)
 *   `rapier_wasm3d_bg.wasm?import&url`  → URL module (~478 B, text/javascript)
 *   `rapier_wasm3d_bg.wasm`             → REAL binary (1,570,176 B, application/wasm)
 * Taking the first match with `.includes(".wasm")` measures the wrapper and labels it application/wasm.
 * We specifically query for the entry WITHOUT a query string.
 *
 * Input parameter: In Node `performance`/`location` are absent, but the logic is pure —
 * tests supply the three URLs manually to verify the correct one is chosen. */
export interface ResourceEntryLike {
  name: string;
  encodedBodySize?: number;
  decodedBodySize?: number;
  transferSize?: number;
}

export function measureWasmBytes(
  entries: readonly ResourceEntryLike[] = performance.getEntriesByType(
    "resource",
  ) as PerformanceResourceTiming[],
  baseHref: string = location.href,
): number {
  const binaries = entries.filter((e) => {
    try {
      const u = new URL(e.name, baseHref);
      return u.pathname.endsWith(".wasm") && u.search === "";
    } catch {
      return false;
    }
  });
  if (binaries.length === 0) return 0;
  return Math.max(
    ...binaries.map(
      (e) => e.encodedBodySize || e.decodedBodySize || e.transferSize || 0,
    ),
  );
}

export interface Hud {
  /** Called from frame loop: updates live line and FPS. */
  update(steps: number): void;
}

export function createHud(R: RapierApi, sim: Sim, paket: string): Hud {
  const reportEl = document.getElementById("report") as HTMLElement;
  const fpsEl = document.getElementById("stat-fps") as HTMLElement;
  const paketEl = document.getElementById("stat-paket") as HTMLElement;
  const durumEl = document.getElementById("stat-durum") as HTMLElement;

  paketEl.textContent = paket;

  let report: SetupReport | undefined;
  let steps = 0;
  let frames = 0;
  let lastFps = performance.now();

  const probe = new R.World({ x: 0, y: 0, z: 0 });
  probe.timestep = 1 / 60;

  const render = () => {
    if (report === undefined) {
      reportEl.textContent = label("RAPIER") + "measuring…";
      return;
    }
    reportEl.textContent = hudLines({
      report,
      timestep: probe.timestep,
      wasmBytes: measureWasmBytes(),
      bodyCount: sim.bodies.length,
      colliderCount: sim.world.colliders.len(),
      steps,
    }).join("\n");
  };

  /** Audit runs 2x120 steps: defer blocking work to the next frame. */
  const audit = () => {
    durumEl.textContent = "MEASURING";
    setTimeout(() => {
      report = auditSetup(R);
      durumEl.textContent = "READY";
      render();
    }, 0);
  };

  audit();
  render();
  window.addEventListener("keydown", (event) => {
    if (event.code === "KeyA") audit();
  });

  return {
    update(frameSteps: number) {
      steps = frameSteps;
      frames++;
      const now = performance.now();
      if (now - lastFps >= 500) {
        fpsEl.textContent = String(
          Math.round((frames * 1000) / (now - lastFps)),
        );
        frames = 0;
        lastFps = now;
      }
      render();
    },
  };
}
