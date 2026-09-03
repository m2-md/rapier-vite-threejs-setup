import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";

// TUZAK KONFİGÜRASYONU — bunu kopyalama, ölçmek için var.
// assetsInlineLimit .wasm'ın boyutunu (1.570.176 B) geçtiği an Vite dosyayı
// base64 olarak JS'in içine gömer: ayrı .wasm isteği yok, önbellek ayrımı yok,
// ve sonuçta -compat'tan bile büyük tek bir dosya.
export default defineConfig({
  plugins: [wasm()],
  build: {
    target: "esnext",
    assetsInlineLimit: 2_000_000,
  },
  optimizeDeps: { exclude: ["@dimforge/rapier3d"] },
});
