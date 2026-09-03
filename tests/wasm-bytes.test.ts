import { describe, expect, it } from "vitest";
import { measureWasmBytes, type ResourceEntryLike } from "../src/view/hud";

/**
 * Test rationale: HUD previously matched with `.includes(".wasm")` and measured
 * Vite's generated JS WRAPPER in dev as "application/wasm 76 KB".
 * This trap appears only in dev server, not build — undetected without opening a browser.
 * Fixed by ensuring only the query-less binary entry is selected.
 */
const BASE = "http://localhost:5215/";
const DEV_ENTRIES: ResourceEntryLike[] = [
  // JS wrapper — text/javascript, should not be measured
  { name: `${BASE}node_modules/.vite/deps/rapier_wasm3d_bg.wasm?import`, encodedBodySize: 76_004 },
  // URL module — a few hundred bytes, should not be measured
  { name: `${BASE}node_modules/.vite/deps/rapier_wasm3d_bg.wasm?import&url`, encodedBodySize: 478 },
  // REAL binary — no query string
  { name: `${BASE}node_modules/.vite/deps/rapier_wasm3d_bg.wasm`, encodedBodySize: 1_570_176 },
];

describe("measureWasmBytes", () => {
  it("selects query-less REAL binary among three URLs in dev", () => {
    expect(measureWasmBytes(DEV_ENTRIES, BASE)).toBe(1_570_176);
  });

  it("never measures wrapper: returns 0 when binary is excluded", () => {
    const onlyWrappers = DEV_ENTRIES.filter((e) => e.name.includes("?"));
    expect(measureWasmBytes(onlyWrappers, BASE)).toBe(0);
  });

  it("recognizes hashed asset name in build output", () => {
    const built: ResourceEntryLike[] = [
      { name: `${BASE}assets/rapier_wasm3d_bg-C4tZ9x1Q.wasm`, encodedBodySize: 1_570_176 },
      { name: `${BASE}assets/index-BDJbUGIT.js`, encodedBodySize: 182_074 },
    ];
    expect(measureWasmBytes(built, BASE)).toBe(1_570_176);
  });

  it("returns 0 if no .wasm request exists (-compat track)", () => {
    const compat: ResourceEntryLike[] = [
      { name: `${BASE}assets/index-Mwh65gap.js`, encodedBodySize: 2_236_245 },
    ];
    expect(measureWasmBytes(compat, BASE)).toBe(0);
  });

  it("drops to transferSize if encodedBodySize is 0, otherwise 0 if none", () => {
    expect(
      measureWasmBytes([{ name: `${BASE}a.wasm`, encodedBodySize: 0, transferSize: 1_234 }], BASE),
    ).toBe(1_234);
    expect(measureWasmBytes([{ name: `${BASE}a.wasm` }], BASE)).toBe(0);
  });
});
