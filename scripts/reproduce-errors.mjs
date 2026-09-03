// npm run errors — source of the three build errors.
//
// Reproduces all three errors and logs full text.
// If expected error doesn't trigger, script exits with non-zero code.
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
  console.log(`# ${no}. error case — ${title}`);
  console.log(`${"=".repeat(72)}`);
  console.log(text.trim());
  console.log(`\n→ expected signature ${ok ? "FOUND" : "NOT FOUND"}: ${needle}`);
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
    return "(no error — build succeeded)";
  } catch (error) {
    return String(error.message ?? error);
  } finally {
    rmSync(join(ROOT, outDir), { recursive: true, force: true });
  }
}

// 1) Plugin completely missing: Vite does not know what to do with .wasm import.
show(
  1,
  "no plugin",
  "is not supported currently",
  await expectBuildError(
    { plugins: [], build: { target: "esnext" } },
    "dist-errors/no-plugin",
  ),
);

// 2) wasm() present, build.target default: target environment does not support TLA.
show(
  2,
  "wasm() installed, low target",
  "Top-level await is not available in the configured target environment",
  await expectBuildError({ plugins: [wasm()] }, "dist-errors/low-target"),
);

// 3) vitest, no alias: Node resolution looks for "main"/"exports" and fails.
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
    return `(${label}: no error — tests passed)`;
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

// Often suggested but INSUFFICIENT solution.
export default defineConfig({
  plugins: [wasm()],
  test: { server: { deps: { inline: ["@dimforge/rapier3d"] } } },
});
`;

show(
  3,
  "vitest, no alias",
  "Failed to resolve entry for package",
  runVitest("no alias", NO_ALIAS),
);

show(
  "3b",
  "vitest + server.deps.inline (INSUFFICIENT)",
  "Failed to resolve entry for package",
  runVitest("inline only", INLINE_ONLY),
);

console.log(`\n${"=".repeat(72)}`);
const missing = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? "✓" : "✗"} ${r.no}. ${r.title}`);
}
if (missing.length > 0) {
  console.error(
    `\n${missing.length} expected errors could not be reproduced.`,
  );
  process.exit(1);
}
console.log("\nall error outputs logged above.");
