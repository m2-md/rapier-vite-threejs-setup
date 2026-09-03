# Rapier + Vite + Three.js Setup — Pure ESM vs `-compat`, Measured

<!-- LINKS:BEGIN — üretildi: scripts/sync-repo-links.py · elle düzenleme -->
**▶ [Live demo](https://m2-md.github.io/rapier-vite-threejs-setup/)** · [Source](https://github.com/m2-md/rapier-vite-threejs-setup)
<!-- LINKS:END -->

> Setting up Rapier physics in a modern Vite and Three.js application: asynchronous WebAssembly initialization and top-level await bundling.

Working code for the article "A Seven-Character Difference, 484 Kilobytes". The
subject is not one correct configuration but **a comparison of two setup paths** —
which is why this project deliberately produces four build variants:

| Variant | Package | Plugin | What it proves |
|---|---|---|---|
| `build:esm` | `@dimforge/rapier3d` | `vite-plugin-wasm`, `target: "esnext"` | separate `.wasm` asset, NO `init()` |
| `build:tla` | `@dimforge/rapier3d` | `[wasm(), topLevelAwait()]`, default target | the cost of the TLA plugin (+73,429 B JS) |
| `build:compat` | `@dimforge/rapier3d-compat` | NO plugin, 3× `esnext` | `await RAPIER.init()`, a single JS file |
| `build:inline-trap` | `@dimforge/rapier3d` | `assetsInlineLimit: 2_000_000` | trap: `.wasm` gets embedded as base64 |

Both Rapier packages are installed. The reason is the article's thesis: the same
`src/sim.ts` runs with both, and the tests prove the two produce **bit-for-bit
identical** results.

## Versions (pinned — not a preference, a requirement)

- `@dimforge/rapier3d@0.19.3` + `@dimforge/rapier3d-compat@0.19.3`. While Rapier's
  Rust core is far ahead, the npm package has been stuck at 0.19.3 for months.
- `three@0.185.1` + `@types/three`. Shadows use `PCFShadowMap` (`PCFSoftShadowMap`
  was deprecated in r185).
- Vite 6.4.3 + TypeScript + Vitest, package manager npm.
- **`"moduleResolution": "bundler"` is mandatory** in `tsconfig.json`: the pure ESM
  package has no `exports` field, and type resolution breaks under `node16`.

## Install

```bash
npm install
```

## Test (the core proof — no browser needed)

```bash
npm test
```

17 tests must be green:

| File | Tests | What it proves |
|---|---|---|
| `tests/determinism.test.ts` | 6 | `version()` is `"0.19.3"` · in pure ESM `init` is **undefined**, in `-compat` a **function** · two runs of the same package → bit-for-bit identical `y` array via `toEqual` · both packages run the same engine (`y = 0.49872392416000366`) · `timestep = 1/120` leaves the world halfway · `w.timestep = 1/60` read back is `!== 1/60` but `toBeCloseTo(1/60, 7)` |
| `tests/stepper.test.ts` | 4 | a full `dt` → 1 step · half a `dt` → 0, the second half → 1 · an 8-second frame stops at `maxStepsPerFrame` (5) · `alpha` is `0.25` a quarter into a step |
| `tests/hud.test.ts` | 2 | the five HUD lines the demo prints match the block in the article **exactly** · in `-compat` the third line is `✗` |
| `tests/wasm-bytes.test.ts` | 5 | `measureWasmBytes` picks the **real binary** — the one without a query string — out of the THREE `.wasm` URLs in dev (not the `?import` wrapper) · recognizes the hashed asset name in a build · 0 on the `-compat` track · falls back to `transferSize` when `encodedBodySize` is missing |

For Vitest to resolve the pure ESM package, **`test.alias` in `vitest.config.ts` is
mandatory**. `test.server.deps.inline` alone is NOT ENOUGH — both sit side by side
in the `npm run errors` output.

## Measurements (every number in the article)

All of them are triggered by hand; nothing runs in the background.

```bash
npm run inspect        # the base64 blob inside -compat's bundle
npm run size           # builds all four variants and prints the byte table
npm run cache-proof    # change one line → which file gets redownloaded
npm run errors         # actually reproduces the three setup errors
npm run dev-proof      # dev vs build: dep optimizer + ?url wrapper
npm run bootstrap-async # does TLA's third solution really run
```

`npm run bootstrap-async` → `y = 0.49872392416000366`. The same number shows up in
`auditSetup()`, `tests/determinism.test.ts` and the HUD — three separate paths, one
value.

### `npm run inspect`

```
rapier.mjs      : 2,238,719 characters
base64 blob     : 2,092,784 characters
decoded wasm    : 1,569,588 bytes
base64 overhead : %33.3
```

### `npm run size`

The entry file is deliberately an "empty app" (`size/esm.ts`, `size/compat.ts`): if
a three.js scene were added, the JS column would grow by the same amount in both
and the difference would stay constant.

```
| Setup | dist/ JS | dist/ .wasm | Total | gzip -9 |
| rapier3d + vite-plugin-wasm, target: "esnext"        |   182,074 B | 1,570,176 B | 1,752,250 B | 616,973 B |
| ... + vite-plugin-top-level-await (default target)    |   255,503 B | 1,570,176 B | 1,825,679 B | 621,138 B |
| rapier3d-compat, zero plugins, target: "esnext"       | 2,236,245 B |           — | 2,236,245 B | 829,447 B |
| TRAP: same ESM setup + assetsInlineLimit: 2e6         | 2,275,633 B |           — | 2,275,633 B | 834,017 B |

raw difference (compat − ESM) : 483,995 B → 27.6%
gzip difference               : 212,474 B → 34.4%
trap − compat                 : 39,388 B (trap is LARGER than compat)
.wasm file in trap            : NONE (inlined)
cost of TLA plugin            : 73,429 B JS
```

The same difference stays constant in the real demo with three.js too: `dist/` is
700,879 + 1,570,176 = 2,271,055 B, `dist-compat/` is a single 2,755,032 B file →
**483,977 B**. Adding three.js to the scene grows the JS column by the same amount
on both sides; the difference is constant.

### `npm run cache-proof`

```
# pure ESM track
before: esm-DeOAV6VB.js  (182,074 B)
after : esm-Mwh65gap.js  (182,094 B)
wasm  : rapier_wasm3d_bg-bb0TTxsO.wasm  (1,570,176 B)
        UNCHANGED -> served from cache

# -compat track
before: compat-DtTIk6Xs.js  (2,236,245 B)
after : compat-CYxT40n-.js  (2,236,265 B)
wasm  : NONE — engine is inside JS, redownloaded along with bundle
```

The script **reverts** the line it added (`document.title = "v2";`) — it does not
leave the working tree dirty.

### `npm run errors`

Three explosions in order: `[vite:wasm-fallback] ... "ESM integration proposal for
Wasm" is not supported currently` → `[vite:esbuild-transpile] ... Top-level await is
not available in the configured target environment` → `Failed to resolve entry for
package "@dimforge/rapier3d"`. The fourth block shows that `server.deps.inline` is
not enough. If any of the expected errors fails to appear, the script exits with a
non-zero code.

### `npm run dev-proof`

```
# 1) WITHOUT optimizeDeps.exclude — dep optimizer active
node_modules/.vite/deps/@dimforge_rapier3d.js   2,598,784 bytes
  └─ contains 2,093,568 char base64 blob
  → separate .wasm request in dev: NO: engine inside JS.

# 2) WITH optimizeDeps.exclude — wrapper header lines
import __vite__wasmUrl from "/node_modules/@dimforge/rapier3d/rapier_wasm3d_bg.wasm?import&url"
import __vite__initWasm from "/__vite-plugin-wasm-helper"
const __vite__wasmModule = await __vite__initWasm({ ... });

  → ?import&url YES · top-level await YES
```

## Running it (visual demo)

```bash
npm run dev           # pure ESM track   → http://localhost:5173/
npm run dev:compat    # -compat track    → http://localhost:5173/compat.html
```

**DO NOT open it with `file://`.** Neither ES modules nor WASM load over that
protocol; you will get a blank screen. The demo needs the Vite dev server.

### Keys

| Key | Action |
|---|---|
| `R` | drop the boxes again (initial transforms, zero velocity) |
| `A` | re-measure the setup audit (`auditSetup`, 2×120 steps, pushed past the first frame with `setTimeout(fn, 0)`) |

No automatic sweeping, no endless spawning, no measurement running in the
background. 24 bodies + ground, a single 1024 shadow map, no post-processing chain —
it will not spin up your fan.

### Expected output

The presentation is "dark cinematic + neon": ACES tone mapping, `PCFShadowMap`
shadows, emissive neon strips, a CSS vignette. No bloom.

The glass panel in the top left holds the five-line setup audit (`tests/hud.test.ts`
verifies these lines exactly):

```
RAPIER        0.19.3
wasm boundary ✓  (timestep 0.01666666753590107)
separate wasm ✓  (1,570,176 B, application/wasm)
determinism   ✓  (y = 0.49872392416000366)
bodies        24 · collider 25 · steps/frame 1
```

The verification condition: **DevTools → Network → filter `wasm`.**

- `npm run dev` → a single row, `application/wasm`, `Content-Length: 1570176`.
- `npm run dev:compat` → the list is **empty**, the HUD's third line is `✗`.

The difference between those two is this article's entire thesis.

## Build

```bash
npm run build            # = build:esm → dist/            (.wasm MUST be a separate file)
npm run build:compat     # → dist-compat/                 (single JS, no .wasm)
npm run build:tla        # → dist-tla/
npm run build:inline-trap # → dist-inline-trap/           (trap: NO .wasm)
npm run preview          # preview dist/
npm run preview:compat   # preview dist-compat/
```

If there is NO file with a `.wasm` extension inside `dist/`, you have fallen into
the `assetsInlineLimit` trap.

## File structure

```
src/
  sim.ts              # CORE: RapierApi type + createSim(R, count) — NO randomness
  sync.ts             # CORE: Rapier transform → THREE.Object3D (quaternion, NO Euler)
  stepper.ts          # CORE: FixedStepper (accumulator + maxStepsPerFrame + alpha)
  checklist.ts        # CORE: auditSetup(R) → SetupReport (4 measurable questions)
  scene.ts            # presentation: renderer, PCFShadowMap, neon strips, lights
  view/hud.ts         # presentation: hudLines() pure function + DOM binding
  view/controls.ts    # presentation: R = drop again
  main.ts             # demo entry — pure ESM (NO init())
  main-compat.ts      # demo entry — -compat (await RAPIER.init())
  bootstrap-async.ts  # TLA's third solution: async bootstrap (only valid on -compat)
size/
  esm.ts / esm.html         # measurement entry: Rapier only, no three.js
  compat.ts / compat.html   # the -compat twin of the same
scripts/
  inspect-compat.mjs      # the base64 blob and its overhead
  measure-size.mjs        # builds four variants and prints the byte table
  cache-proof.mjs         # cache proof (change one line → revert it)
  reproduce-errors.mjs    # the full text of the three errors
  dev-optimizer-proof.mjs # dev ≠ build
tests/
  determinism.test.ts · stepper.test.ts · hud.test.ts
vite.config.ts · vite.config.tla.ts · vite.config.inline-trap.ts · vite.config.compat.ts
vitest.config.ts          # test.alias — MANDATORY for the pure ESM package
```

Everything except `src/scene.ts`, `src/view/*` and the two `main*.ts` files is
DOM-free: the tests run under node.

## Lessons learned (also told in the article)

- The pure ESM package has **no** `RAPIER.init`: `init.js` is `export {};`. Every
  tutorial written for `-compat` hits a wall here.
- The pure package's `package.json` has no `main`/`exports`, only `module`. The
  browser build works (rollup reads `module`), Node resolution does not → vitest
  blows up. The fix is `test.alias`; `server.deps.inline` is not enough.
- The top-level await that `vite-plugin-wasm` produces is **not in your code**. That
  is why the "wrap the await in an async function" fix does not work on the pure ESM
  track.
- The plugin order is `[wasm(), topLevelAwait()]`; the reverse silently fails.
- If you do not add `optimizeDeps.exclude`, WASM gets embedded into the dep bundle as
  base64 in dev: you effectively get `-compat` behavior in dev while seeing something
  else in `dist/`.
- If `assetsInlineLimit` exceeds the size of the `.wasm`, the entire gain evaporates —
  you end up with a single file 39,388 bytes LARGER than `-compat`.
- The base64 overhead is plain math: 3 bytes → 4 characters, exactly 33.3%. Gzip does
  not erase it, it magnifies it proportionally (27.6% → 34.4%).
- The embedded/separate WASM of the two packages differs by 588 bytes (1,569,588 vs
  1,570,176): `wasm-bindgen`'s `bundler` and `web` targets emit different wrappers.
- Decouple the physics step from the render frame: `FixedStepper` plus the
  `maxStepsPerFrame` brake.
- `cuboid(hx, hy, hz)` takes HALF extents; `0.4` gives you a `0.8`-unit cube.

## License

MIT — see `LICENSE`.
