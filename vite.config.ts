import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  // Sıra önemlidir. wasm() zincirin başında durur: .wasm importunu
  // instantiate çağrısına çevirir. Sonraki her eklenti onun çıktısını görür.
  plugins: [wasm()],

  build: {
    // wasm()'ın ürettiği top-level await'in çalışabilmesi için.
    // Alternatifi: plugins: [wasm(), topLevelAwait()] — ~73 KB daha büyük.
    target: "esnext",

    // Vite varsayılanı zaten 4096; buraya bilerek yazıyorum.
    // Bu sayı 1.570.176'nın üstüne çıkarsa .wasm base64 olarak
    // JS'in içine gömülür ve bütün kazancını kaybedersin.
    assetsInlineLimit: 4096,
  },

  // Dev sunucusunun dependency optimizer'ını Rapier'dan uzak tut.
  // Sebebi aşağıda: dev ile build farklı davranıyor.
  optimizeDeps: { exclude: ["@dimforge/rapier3d"] },
});
