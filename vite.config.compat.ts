import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  build: {
    target: "esnext",
    // Bu depoda iki yol yan yana duruyor; -compat demosunun girişi ayrı.
    // Yalnızca -compat kullanan bir projede bu satır gereksizdir.
    rollupOptions: {
      input: fileURLToPath(new URL("./compat.html", import.meta.url)),
    },
  },
  esbuild: { target: "esnext" },
  optimizeDeps: { esbuildOptions: { target: "esnext" } },
});
