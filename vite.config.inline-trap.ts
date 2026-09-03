import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";

// TRAP CONFIGURATION — do not copy this, exists only for benchmarking.
// Once assetsInlineLimit exceeds .wasm size (1,570,176 B), Vite embeds the file
// as base64 into JS: no separate .wasm request, no cache separation,
// resulting in a single file even larger than -compat.
export default defineConfig({
  plugins: [wasm()],
  build: {
    target: "esnext",
    assetsInlineLimit: 2_000_000,
  },
  optimizeDeps: { exclude: ["@dimforge/rapier3d"] },
});
