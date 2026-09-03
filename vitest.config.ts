import { defineConfig } from "vitest/config";
import wasm from "vite-plugin-wasm";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [wasm()],
  test: {
    // Pure ESM package lacks "main"/"exports"; Node resolution fails
    // to find entry file. We point directly to it.
    alias: {
      "@dimforge/rapier3d": fileURLToPath(
        new URL("./node_modules/@dimforge/rapier3d/rapier.js", import.meta.url),
      ),
    },
  },
});
