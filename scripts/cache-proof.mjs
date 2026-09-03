// npm run cache-proof — verify browser caching difference.
//
// Modifies a SINGLE line in app code and rebuilds both tracks.
// In pure ESM, .wasm content hash must remain STABLE (user does not redownload engine);
// in -compat, the entire bundle must be emitted with a new hash.
import { build } from "vite";
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = "dist-cache";
const PATCH = '\ndocument.title = "v2";\n';

const fmt = (n) => n.toLocaleString("en-US");

async function buildInto(configFile, input, id) {
  const outDir = join(OUT, id);
  rmSync(join(ROOT, outDir), { recursive: true, force: true });
  await build({
    root: ROOT,
    configFile: join(ROOT, configFile),
    logLevel: "silent",
    build: {
      outDir,
      emptyOutDir: true,
      rollupOptions: { input: join(ROOT, input) },
    },
  });

  const dir = join(ROOT, outDir, "assets");
  const files = readdirSync(dir).filter(
    (f) => f.endsWith(".js") || f.endsWith(".wasm"),
  );
  return files.map((name) => ({
    name,
    bytes: readFileSync(join(dir, name)).byteLength,
  }));
}

/** Append single line -> build -> revert file back to ORIGINAL state. */
async function beforeAfter(configFile, entry, html, id) {
  const entryPath = join(ROOT, entry);
  const original = readFileSync(entryPath, "utf8");
  const before = await buildInto(configFile, html, `${id}-a`);
  try {
    writeFileSync(entryPath, original + PATCH);
    const after = await buildInto(configFile, html, `${id}-b`);
    return { before, after };
  } finally {
    writeFileSync(entryPath, original);
  }
}

const pick = (files, ext) => files.find((f) => f.name.endsWith(ext));

function report(title, { before, after }) {
  const jsA = pick(before, ".js");
  const jsB = pick(after, ".js");
  const wasmA = pick(before, ".wasm");
  const wasmB = pick(after, ".wasm");

  console.log(`\n# ${title}`);
  console.log(`before: ${jsA.name}  (${fmt(jsA.bytes)} B)`);
  console.log(`after : ${jsB.name}  (${fmt(jsB.bytes)} B)`);
  if (wasmA && wasmB) {
    const same = wasmA.name === wasmB.name;
    console.log(`wasm  : ${wasmA.name}  (${fmt(wasmA.bytes)} B)`);
    console.log(`        ${same ? "UNCHANGED -> served from cache" : "CHANGED (unexpected!)"}`);
    return same;
  }
  console.log("wasm  : NONE — engine is inside JS, redownloaded along with bundle");
  return jsA.name !== jsB.name;
}

const esm = await beforeAfter(
  "vite.config.ts",
  "size/esm.ts",
  "size/esm.html",
  "esm",
);
const compat = await beforeAfter(
  "vite.config.compat.ts",
  "size/compat.ts",
  "size/compat.html",
  "compat",
);

const esmOk = report("pure ESM track", esm);
const compatOk = report("-compat track", compat);

console.log("\nresult:");
console.log(
  `  pure ESM : application code changed, .wasm hash is ${esmOk ? "STABLE" : "CHANGED"}`,
);
console.log(
  `  -compat  : bundle ${compatOk ? "completely renewed" : "remained same (unexpected!)"}`,
);

if (!esmOk || !compatOk) {
  console.error("\nUNEXPECTED RESULT — caching claim could not be verified.");
  process.exit(1);
}
