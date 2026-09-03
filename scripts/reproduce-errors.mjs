// npm run errors — makaledeki üç hata metninin KAYNAĞI.
//
// Üç patlamayı da gerçekten üretir ve tam metnini basar. Beklenen hata
// çıkmazsa script sıfır olmayan kodla düşer: sessizce geçmesin.
import { build } from "vite";
import wasm from "vite-plugin-wasm";
import { execFileSync } from "node:child_process";
import { rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const ESM_HTML = join(ROOT, "size/esm.html");
const results = [];

function show(no, title, needle, text) {
  const ok = text.includes(needle);
  results.push({ no, title, ok, needle });
  console.log(`\n${"=".repeat(72)}`);
  console.log(`# ${no}. patlama — ${title}`);
  console.log(`${"=".repeat(72)}`);
  console.log(text.trim());
  console.log(`\n→ beklenen imza ${ok ? "BULUNDU" : "BULUNAMADI"}: ${needle}`);
}

async function expectBuildError(inlineConfig, outDir) {
  try {
    await build({
      root: ROOT,
      configFile: false,
      logLevel: "silent",
      ...inlineConfig,
      build: {
        outDir,
        emptyOutDir: true,
        rollupOptions: { input: ESM_HTML },
        ...inlineConfig.build,
      },
    });
    return "(hata çıkmadı — build başarılı oldu)";
  } catch (error) {
    return String(error.message ?? error);
  } finally {
    rmSync(join(ROOT, outDir), { recursive: true, force: true });
  }
}

// 1) Eklenti hiç yok: Vite .wasm importunu ne yapacağını bilmiyor.
show(
  1,
  "eklenti yok",
  "is not supported currently",
  await expectBuildError(
    { plugins: [], build: { target: "esnext" } },
    "dist-errors/no-plugin",
  ),
);

// 2) wasm() var, build.target varsayılan: eklentinin ürettiği TLA'yı hedef
//    karşılamıyor. O await senin kodunda değil — bağımlılığın içinde.
show(
  2,
  "wasm() takıldı, hedef düşük",
  "Top-level await is not available in the configured target environment",
  await expectBuildError({ plugins: [wasm()] }, "dist-errors/low-target"),
);

// 3) vitest, alias yok: Node çözümlemesi "main"/"exports" arıyor, bulamıyor.
function runVitest(label, configBody) {
  const configPath = join(ROOT, `vitest.config.__err.ts`);
  writeFileSync(configPath, configBody);
  try {
    execFileSync(
      "npx",
      [
        "vitest",
        "run",
        "--config",
        configPath,
        "tests/determinism.test.ts",
        "--reporter=basic",
      ],
      { cwd: ROOT, encoding: "utf8", stdio: "pipe" },
    );
    return `(${label}: hata çıkmadı — testler geçti)`;
  } catch (error) {
    const out = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
    const line = out
      .split("\n")
      .findIndex((l) => l.includes("Failed to resolve entry for package"));
    return line === -1
      ? out.slice(0, 1200)
      : out
          .split("\n")
          .slice(Math.max(0, line - 1), line + 4)
          .join("\n");
  } finally {
    unlinkSync(configPath);
  }
}

const NO_ALIAS = `import { defineConfig } from "vitest/config";
import wasm from "vite-plugin-wasm";

export default defineConfig({ plugins: [wasm()] });
`;

const INLINE_ONLY = `import { defineConfig } from "vitest/config";
import wasm from "vite-plugin-wasm";

// Sık önerilen ama YETMEYEN çözüm.
export default defineConfig({
  plugins: [wasm()],
  test: { server: { deps: { inline: ["@dimforge/rapier3d"] } } },
});
`;

show(
  3,
  "vitest, alias yok",
  "Failed to resolve entry for package",
  runVitest("alias yok", NO_ALIAS),
);

show(
  "3b",
  "vitest + server.deps.inline (YETMEZ)",
  "Failed to resolve entry for package",
  runVitest("sadece inline", INLINE_ONLY),
);

console.log(`\n${"=".repeat(72)}`);
const missing = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? "✓" : "✗"} ${r.no}. ${r.title}`);
}
if (missing.length > 0) {
  console.error(
    `\n${missing.length} beklenen hata üretilemedi — makaledeki hata metinleri güncellenmeli.`,
  );
  process.exit(1);
}
console.log("\nüç patlamanın (+ inline varyantının) tam metni yukarıda.");
