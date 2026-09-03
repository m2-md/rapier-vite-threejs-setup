import { defineConfig } from "vitest/config";
import wasm from "vite-plugin-wasm";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [wasm()],
  test: {
    // Saf ESM paketinde "main"/"exports" yok; Node çözümlemesi giriş
    // dosyasını bulamıyor. Doğrudan gösteriyoruz.
    alias: {
      "@dimforge/rapier3d": fileURLToPath(
        new URL("./node_modules/@dimforge/rapier3d/rapier.js", import.meta.url),
      ),
    },
  },
});
