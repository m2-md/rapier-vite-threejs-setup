import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  build: {
    target: "esnext",
    // Both tracks coexist side by side in this repo; -compat demo has a separate entry.
    // In a project using only -compat this line is unnecessary.
    rollupOptions: {
      input: fileURLToPath(new URL("./compat.html", import.meta.url)),
    },
  },
  esbuild: { target: "esnext" },
  optimizeDeps: { esbuildOptions: { target: "esnext" } },
});
