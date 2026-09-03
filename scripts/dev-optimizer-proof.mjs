// npm run dev-proof — proof that "dev and build behave differently".
//
// 1) WITHOUT optimizeDeps.exclude: Vite's dependency optimizer pre-bundles Rapier
//    with esbuild and inlines WASM as base64 into dep bundle.
//    Effectively yielding -compat behavior in dev.
// 2) WITH exclude: dev server wrapper shows ?url and top-level await — real .wasm request.
import { createServer } from "vite";
import wasm from "vite-plugin-wasm";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DEP_FILE = "deps/@dimforge_rapier3d.js";
const fmt = (n) => n.toLocaleString("en-US");

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
  // Dep optimizer runs on first real request: start server and query.
  await server.listen();
  // connection: close ensures socket doesn't hold server.close() open.
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

// 1) WITHOUT exclude -> optimizer active.
console.log("# 1) WITHOUT optimizeDeps.exclude — dep optimizer active");
await withServer(
  "node_modules/.vite-proof-optimized",
  { include: ["@dimforge/rapier3d"] },
  5291,
  async (get) => {
    // Compiled entry file contains dep bundle URL; requesting it waits for optimizer.
    const entry = await get("/size/esm.ts");
    const depUrl = entry.match(/\/[^"']*deps\/@dimforge_rapier3d\.js[^"']*/)?.[0];
    if (depUrl) await get(depUrl);

    const path = join(ROOT, "node_modules/.vite-proof-optimized", DEP_FILE);
    const src = readFileSync(path, "utf8");
    const blob = src.match(/[A-Za-z0-9+/=]{5000,}/)?.[0] ?? "";
    console.log(`node_modules/.vite/${DEP_FILE}   ${fmt(src.length)} bytes`);
    console.log(
      `  └─ contains ${fmt(blob.length)} char base64 blob` +
        (blob.length === 0 ? "  (NONE — unexpected!)" : ""),
    );
    console.log(
      `  → separate .wasm request in dev: ${src.includes("?url") ? "YES" : "NO"}: engine inside JS.`,
    );
  },
);

// 2) WITH exclude -> optimizer leaves Rapier untouched.
console.log("\n# 2) WITH optimizeDeps.exclude — wrapper header lines");
await withServer(
  "node_modules/.vite-proof-excluded",
  { exclude: ["@dimforge/rapier3d"] },
  5292,
  async (get) => {
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
      `\n  → ?import&url ${wrapper.includes("?import&url") ? "YES" : "NO"} · top-level await ${
        wrapper.includes("await __vite__initWasm") ? "YES" : "NO"
      }`,
    );
  },
);
