import { describe, expect, it } from "vitest";
import { measureWasmBytes, type ResourceEntryLike } from "../src/view/hud";

/**
 * Bu testin varlık sebebi bir hata: HUD bir süre `.includes(".wasm")` ile ilk
 * eşleşmeyi ölçtü ve dev'de Vite'ın ürettiği JS SARMALAYICIYI "application/wasm
 * 76 KB" diye ekrana bastı. Tuzak dev sunucusunda görünür, build'de değil —
 * yani tarayıcı açmadan yakalanmaz. Onu buraya sabitledik: aşağıdaki üç URL
 * `vite-plugin-wasm`'ın gerçekte ürettiği üçlü.
 */
const BASE = "http://localhost:5215/";
const DEV_ENTRIES: ResourceEntryLike[] = [
  // JS sarmalayıcı — text/javascript, ölçülmemeli
  { name: `${BASE}node_modules/.vite/deps/rapier_wasm3d_bg.wasm?import`, encodedBodySize: 76_004 },
  // URL modülü — birkaç yüz bayt, ölçülmemeli
  { name: `${BASE}node_modules/.vite/deps/rapier_wasm3d_bg.wasm?import&url`, encodedBodySize: 478 },
  // GERÇEK ikili — sorgu dizesi yok
  { name: `${BASE}node_modules/.vite/deps/rapier_wasm3d_bg.wasm`, encodedBodySize: 1_570_176 },
];

describe("measureWasmBytes", () => {
  it("dev'deki üç URL arasından sorgu-suz GERÇEK ikiliyi seçer", () => {
    expect(measureWasmBytes(DEV_ENTRIES, BASE)).toBe(1_570_176);
  });

  it("sarmalayıcıyı asla ölçmez: ikili listeden çıkınca 0 döner", () => {
    const onlyWrappers = DEV_ENTRIES.filter((e) => e.name.includes("?"));
    expect(measureWasmBytes(onlyWrappers, BASE)).toBe(0);
  });

  it("build çıktısındaki hash'li asset adını da tanır", () => {
    const built: ResourceEntryLike[] = [
      { name: `${BASE}assets/rapier_wasm3d_bg-C4tZ9x1Q.wasm`, encodedBodySize: 1_570_176 },
      { name: `${BASE}assets/index-BDJbUGIT.js`, encodedBodySize: 182_074 },
    ];
    expect(measureWasmBytes(built, BASE)).toBe(1_570_176);
  });

  it("hiç .wasm isteği yoksa (-compat yolu) 0 döner", () => {
    const compat: ResourceEntryLike[] = [
      { name: `${BASE}assets/index-Mwh65gap.js`, encodedBodySize: 2_236_245 },
    ];
    expect(measureWasmBytes(compat, BASE)).toBe(0);
  });

  it("encodedBodySize 0 ise transferSize'a düşer, hiçbiri yoksa 0", () => {
    expect(
      measureWasmBytes([{ name: `${BASE}a.wasm`, encodedBodySize: 0, transferSize: 1_234 }], BASE),
    ).toBe(1_234);
    expect(measureWasmBytes([{ name: `${BASE}a.wasm` }], BASE)).toBe(0);
  });
});
