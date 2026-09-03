import { auditSetup, type SetupReport } from "../checklist";
import type { RapierApi, Sim } from "../sim";

const LABEL_WIDTH = 12;
const label = (text: string) => text.padEnd(LABEL_WIDTH);
const fmt = (n: number) => n.toLocaleString("tr-TR");
const mark = (ok: boolean) => (ok ? "✓" : "✗");

export interface HudInput {
  report: SetupReport;
  /** WASM'dan geri okunan timestep — f32'ye yuvarlanmış hâli. */
  timestep: number;
  /** Ağdaki .wasm isteğinin baytı. 0 = ölçülemedi ya da istek yok. */
  wasmBytes: number;
  bodyCount: number;
  colliderCount: number;
  steps: number;
}

/** HUD'ın beş satırı. Saf fonksiyon: DOM yok, testte birebir doğrulanıyor. */
export function hudLines(input: HudInput): string[] {
  const { report } = input;
  const wasm = report.separateWasmRequest
    ? `${mark(true)}  (${input.wasmBytes > 0 ? `${fmt(input.wasmBytes)} B` : "boyut ölçülemedi"}, application/wasm)`
    : `${mark(false)}  (base64 gömülü, ağda .wasm isteği yok)`;

  return [
    label("RAPIER") + report.version,
    label("wasm sınırı") +
      `${mark(report.crossesWasmBoundary)}  (timestep ${input.timestep})`,
    label("ayrı .wasm") + wasm,
    label("determinizm") +
      `${mark(report.deterministic)}  (y = ${report.finalY})`,
    label("gövde") +
      `${input.bodyCount} · collider ${input.colliderCount} · adım/kare ${input.steps}`,
  ];
}

/** Ağ sekmesine programatik bakış — HUD'daki bayt SABİT YAZILMAZ, ölçülür.
 *
 * TUZAK: dev'de Vite aynı dosyayı üç ayrı URL'de servis eder —
 *   `rapier_wasm3d_bg.wasm?import`      → JS sarmalayıcı (~76 KB, text/javascript)
 *   `rapier_wasm3d_bg.wasm?import&url`  → URL modülü (~478 B, text/javascript)
 *   `rapier_wasm3d_bg.wasm`             → GERÇEK ikili (1.570.176 B, application/wasm)
 * `.includes(".wasm")` ile ilk eşleşmeyi almak sarmalayıcıyı ölçer ve onu
 * application/wasm diye etiketler. Sorgu dizesi OLMAYAN girdiyi arıyoruz.
 *
 * Girdiler parametre: node'da `performance`/`location` yok, ama tuzağın kendisi
 * saf mantık — testte üç URL'yi elle verip doğru olanı seçtiğini kanıtlıyoruz. */
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
  /** Kare döngüsünden çağrılır: canlı satırı ve FPS'i günceller. */
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
      reportEl.textContent = label("RAPIER") + "ölçülüyor…";
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

  /** Denetim 2×120 adım koşar: bloke edici işi ilk kareden sonraya bırak. */
  const audit = () => {
    durumEl.textContent = "ÖLÇÜLÜYOR";
    setTimeout(() => {
      report = auditSetup(R);
      durumEl.textContent = "HAZIR";
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
