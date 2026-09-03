// npm run size — makaledeki bayt tablosunu bu makinede yeniden üretir.
//
// Dört varyantı da GERÇEKTEN build eder. Giriş dosyası bilerek "boş uygulama"
// (size/esm.ts, size/compat.ts): three.js sahnesi katılsaydı JS sütunu ikisinde
// de aynı miktarda büyürdü, fark sabit kalırdı — o yüzden ölçüm bunun dışında.
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
      "`rapier3d` + `vite-plugin-wasm` + `vite-plugin-top-level-await` (varsayılan hedef)",
    configFile: "vite.config.tla.ts",
    input: "size/esm.html",
  },
  {
    id: "compat",
    label: '`rapier3d-compat`, sıfır eklenti, `target: "esnext"`',
    configFile: "vite.config.compat.ts",
    input: "size/compat.html",
  },
  {
    id: "inline-trap",
    label: "TUZAK: aynı ESM kurulumu + `assetsInlineLimit: 2_000_000`",
    configFile: "vite.config.inline-trap.ts",
    input: "size/esm.html",
  },
];

const fmt = (n) => (n === 0 ? "—" : n.toLocaleString("tr-TR") + " B");

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

  // configFile + inline override: gerçek konfigürasyon dosyaları ölçülüyor,
  // burada kopyalanmıyor. Tek değişen giriş dosyası ve çıktı klasörü.
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

console.log("\n| Kurulum | `dist/` JS | `dist/` .wasm | Toplam | gzip -9 |");
console.log("|---|---|---|---|---|");
for (const r of rows) {
  console.log(
    `| ${r.label} | ${fmt(r.js)} | ${fmt(r.wasm)} | ${fmt(r.total)} | ${fmt(r.gzip)} |`,
  );
}

const esm = rows.find((r) => r.id === "esm");
const compat = rows.find((r) => r.id === "compat");
const trap = rows.find((r) => r.id === "inline-trap");
const pct = (a, b) => "%" + (((a - b) / b) * 100).toFixed(1).replace(".", ",");

console.log("\nham fark (compat − ESM) :", fmt(compat.total - esm.total), "→", pct(compat.total, esm.total));
console.log("gzip fark               :", fmt(compat.gzip - esm.gzip), "→", pct(compat.gzip, esm.gzip));
console.log("tuzak − compat          :", fmt(trap.total - compat.total), "(tuzak compat'tan BÜYÜK)");
console.log("tuzakta .wasm dosyası   :", trap.wasm === 0 ? "YOK (inline edildi)" : fmt(trap.wasm));
console.log("TLA eklentisinin bedeli :", fmt(rows.find((r) => r.id === "esm-tla").js - esm.js), "JS");
