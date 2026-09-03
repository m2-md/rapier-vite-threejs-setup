// npm run dev-proof — "dev ile build aynı şeyi yapmıyor" iddiasının kanıtı.
//
// 1) optimizeDeps.exclude YOKKEN: Vite'ın dependency optimizer'ı Rapier'ı
//    esbuild ile önceden paketler ve WASM'ı base64 olarak dep bundle'ına gömer.
//    Yani dev'de fiilen -compat davranışı alırsın.
// 2) exclude VARKEN: dev sunucusunun ürettiği sarmalayıcıda ?url ve
//    top-level await görünür — gerçek bir .wasm isteği var.
import { createServer } from "vite";
import wasm from "vite-plugin-wasm";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DEP_FILE = "deps/@dimforge_rapier3d.js";
const fmt = (n) => n.toLocaleString("tr-TR");

async function withServer(cacheDir, optimizeDeps, port, fn) {
  rmSync(join(ROOT, cacheDir), { recursive: true, force: true });
  const server = await createServer({
    root: ROOT,
    configFile: false,
    cacheDir,
    logLevel: "silent",
    plugins: [wasm()],
    optimizeDeps,
    server: { port, strictPort: true },
  });
  // Dep optimizer gerçek bir istek görünce koşar: sunucuyu ayağa kaldır ve iste.
  await server.listen();
  // connection: close → undici soketi açık tutup server.close()'u kilitlemesin.
  const get = (path) =>
    fetch(`http://localhost:${port}${path}`, {
      headers: { connection: "close" },
    }).then((r) => r.text());
  try {
    return await fn(get);
  } finally {
    await Promise.race([
      server.close(),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
    rmSync(join(ROOT, cacheDir), { recursive: true, force: true });
  }
}

// 1) exclude YOK → optimizer devrede.
console.log("# 1) optimizeDeps.exclude YOK — dep optimizer devrede");
await withServer(
  "node_modules/.vite-proof-optimized",
  { include: ["@dimforge/rapier3d"] },
  5291,
  async (get) => {
    // Giriş dosyasının çevrilmiş hâlinde dep bundle'ın URL'si duruyor; onu
    // istemek optimizer'ın işini bitirmesini bekletir.
    const entry = await get("/size/esm.ts");
    const depUrl = entry.match(/\/[^"']*deps\/@dimforge_rapier3d\.js[^"']*/)?.[0];
    if (depUrl) await get(depUrl);

    const path = join(ROOT, "node_modules/.vite-proof-optimized", DEP_FILE);
    const src = readFileSync(path, "utf8");
    const blob = src.match(/[A-Za-z0-9+/=]{5000,}/)?.[0] ?? "";
    console.log(`node_modules/.vite/${DEP_FILE}   ${fmt(src.length)} bayt`);
    console.log(
      `  └─ içinde ${fmt(blob.length)} karakterlik base64 blok` +
        (blob.length === 0 ? "  (YOK — beklenmedi!)" : ""),
    );
    console.log(
      `  → dev'de ayrı .wasm isteği ${src.includes("?url") ? "VAR" : "YOK"}: motor JS'in içinde.`,
    );
  },
);

// 2) exclude VAR → optimizer Rapier'a dokunmuyor.
console.log("\n# 2) optimizeDeps.exclude VAR — sarmalayıcının ilk satırları");
await withServer(
  "node_modules/.vite-proof-excluded",
  { exclude: ["@dimforge/rapier3d"] },
  5292,
  async (get) => {
    // rapier_wasm3d.js'in ilk satırı ?import'a çevrilir; sarmalayıcı işte orada.
    const wrapper = await get(
      "/node_modules/@dimforge/rapier3d/rapier_wasm3d_bg.wasm?import",
    );
    const lines = wrapper.split("\n").filter((l) => l.trim().length > 0);
    const head = [
      ...lines.filter((l) => l.startsWith("import __vite__")),
      lines
        .find((l) => l.includes("__vite__initWasm({"))
        ?.replace(/\{.*$/s, "{ ... });"),
    ].join("\n");
    console.log(head);
    console.log(
      `\n  → ?import&url ${wrapper.includes("?import&url") ? "VAR" : "YOK"} · top-level await ${
        wrapper.includes("await __vite__initWasm") ? "VAR" : "YOK"
      }`,
    );
  },
);
