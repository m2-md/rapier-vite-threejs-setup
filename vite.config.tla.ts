import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

// İkinci çözüm: TLA'yı eklentiyle sarmala, hedefi yükseltme.
// build.target BİLEREK yok — varsayılan hedefte de çalıştığının kanıtı.
// Sıra zorunlu: wasm() önce TLA'yı üretir, topLevelAwait() sonra onu sarmalar.
export default defineConfig({
  plugins: [wasm(), topLevelAwait()],
  optimizeDeps: { exclude: ["@dimforge/rapier3d"] },
});
