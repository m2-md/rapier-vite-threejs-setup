// npm run cache-proof — makalenin görünmeyen farkı: tarayıcı önbelleği.
//
// Uygulama kodunda TEK satır değiştirip iki yolu da yeniden build eder.
// Saf ESM'de .wasm dosyasının içerik hash'i SABİT kalmalı (kullanıcı motoru
// yeniden indirmez); -compat'ta bütün bundle yeni bir isimle çıkmalı.
import { build } from "vite";
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = "dist-cache";
const PATCH = '\ndocument.title = "v2";\n';

const fmt = (n) => n.toLocaleString("tr-TR");

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

/** Tek satır ekle → build → dosyayı ESKİ hâline geri yaz (kirli ağaç bırakma). */
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
  console.log(`önce : ${jsA.name}  (${fmt(jsA.bytes)} B)`);
  console.log(`sonra: ${jsB.name}  (${fmt(jsB.bytes)} B)`);
  if (wasmA && wasmB) {
    const same = wasmA.name === wasmB.name;
    console.log(`wasm : ${wasmA.name}  (${fmt(wasmA.bytes)} B)`);
    console.log(`       ${same ? "DEĞİŞMEDİ → önbellekten gelir" : "DEĞİŞTİ (beklenmedi!)"}`);
    return same;
  }
  console.log("wasm : YOK — motor JS'in içinde, bundle'la birlikte yeniden iner");
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

const esmOk = report("saf ESM yolu", esm);
const compatOk = report("-compat yolu", compat);

console.log("\nsonuç:");
console.log(
  `  saf ESM : uygulama kodu değişti, .wasm hash'i ${esmOk ? "SABİT" : "DEĞİŞTİ"}`,
);
console.log(
  `  -compat : bundle ${compatOk ? "tamamen yenilendi" : "aynı kaldı (beklenmedi!)"}`,
);

if (!esmOk || !compatOk) {
  console.error("\nBEKLENEN SONUÇ ÇIKMADI — makaledeki önbellek iddiası doğrulanamadı.");
  process.exit(1);
}
