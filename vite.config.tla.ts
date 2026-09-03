import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

// Second solution: wrap TLA with plugin, without bumping target.
// build.target intentionally omitted — proof that it works in default target too.
// Order is required: wasm() produces TLA first, topLevelAwait() wraps it after.
export default defineConfig({
  plugins: [wasm(), topLevelAwait()],
  optimizeDeps: { exclude: ["@dimforge/rapier3d"] },
});
