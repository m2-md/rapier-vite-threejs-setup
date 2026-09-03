// npm run size — reproduces the byte size table locally.
//
// ACTUALLY builds all four variants. Entry file is intentionally an "empty app"
// (size/esm.ts, size/compat.ts): if three.js scene were added, JS column would grow
// by the same amount in both, preserving the difference.
import { build } from "vite";
import { readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = "dist-size";

const VARIANTS = [
  {
    id: "esm",
    label: '`rapier3d` + `vite-plugin-wasm`, `target: "esnext"`',
    configFile: "vite.config.ts",
    input: "size/esm.html",
  },
  {
    id: "esm-tla",
    label:
      "`rapier3d` + `vite-plugin-wasm` + `vite-plugin-top-level-await` (default target)",
    configFile: "vite.config.tla.ts",
    input: "size/esm.html",
  },
  {
    id: "compat",
    label: '`rapier3d-compat`, zero plugins, `target: "esnext"`',
    configFile: "vite.config.compat.ts",
    input: "size/compat.html",
  },
  {
    id: "inline-trap",
    label: "TRAP: same ESM setup + `assetsInlineLimit: 2_000_000`",
    configFile: "vite.config.inline-trap.ts",
    input: "size/esm.html",
  },
];

const fmt = (n) => (n === 0 ? "—" : n.toLocaleString("en-US") + " B");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

async function measure(variant) {
  const outDir = join(OUT, variant.id);
  rmSync(join(ROOT, outDir), { recursive: true, force: true });

  // configFile + inline override: measures real config files directly.
  await build({
    root: ROOT,
    configFile: join(ROOT, variant.configFile),
    logLevel: "warn",
    build: {
      outDir,
      emptyOutDir: true,
      rollupOptions: { input: join(ROOT, variant.input) },
    },
  });

  const files = walk(join(ROOT, outDir));
  let js = 0;
  let wasm = 0;
  let gzip = 0;
  for (const file of files) {
    const buf = readFileSync(file);
    if (file.endsWith(".js")) js += buf.byteLength;
    else if (file.endsWith(".wasm")) wasm += buf.byteLength;
    else continue;
    gzip += gzipSync(buf, { level: 9 }).byteLength;
  }
  return { ...variant, js, wasm, total: js + wasm, gzip };
}

const rows = [];
for (const variant of VARIANTS) rows.push(await measure(variant));

console.log("\n| Setup | `dist/` JS | `dist/` .wasm | Total | gzip -9 |");
console.log("|---|---|---|---|---|");
for (const r of rows) {
  console.log(
    `| ${r.label} | ${fmt(r.js)} | ${fmt(r.wasm)} | ${fmt(r.total)} | ${fmt(r.gzip)} |`,
  );
}

const esm = rows.find((r) => r.id === "esm");
const compat = rows.find((r) => r.id === "compat");
const trap = rows.find((r) => r.id === "inline-trap");
const pct = (a, b) => (((a - b) / b) * 100).toFixed(1) + "%";

console.log("\nraw difference (compat − ESM) :", fmt(compat.total - esm.total), "→", pct(compat.total, esm.total));
console.log("gzip difference               :", fmt(compat.gzip - esm.gzip), "→", pct(compat.gzip, esm.gzip));
console.log("trap − compat                 :", fmt(trap.total - compat.total), "(trap is LARGER than compat)");
console.log(".wasm file in trap            :", trap.wasm === 0 ? "NONE (inlined)" : fmt(trap.wasm));
console.log("cost of TLA plugin            :", fmt(rows.find((r) => r.id === "esm-tla").js - esm.js), "JS");
