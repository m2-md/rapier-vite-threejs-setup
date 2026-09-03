# Rapier + Vite + Three.js Kurulumu — Saf ESM vs `-compat`, Ölçülmüş

"Yedi Karakterlik Fark, 484 Kilobayt" makalesinin çalışan kodu. Konu tek bir doğru
konfigürasyon değil, **iki kurulum yolunun karşılaştırması** — bu yüzden proje
bilerek dört build varyantı üretiyor:

| Varyant | Paket | Eklenti | Ne kanıtlıyor |
|---|---|---|---|
| `build:esm` | `@dimforge/rapier3d` | `vite-plugin-wasm`, `target: "esnext"` | ayrı `.wasm` asset'i, `init()` YOK |
| `build:tla` | `@dimforge/rapier3d` | `[wasm(), topLevelAwait()]`, varsayılan hedef | TLA eklentisinin bedeli (+73.429 B JS) |
| `build:compat` | `@dimforge/rapier3d-compat` | eklenti YOK, 3× `esnext` | `await RAPIER.init()`, tek JS dosyası |
| `build:inline-trap` | `@dimforge/rapier3d` | `assetsInlineLimit: 2_000_000` | tuzak: `.wasm` base64'e gömülür |

İki Rapier paketi de kurulu. Sebebi yazının tezi: aynı `src/sim.ts` her ikisiyle de
koşuyor ve testler ikisinin **bit-bit aynı** sonucu verdiğini kanıtlıyor.

## Sürümler (pinli — tercih değil, zorunluluk)

- `@dimforge/rapier3d@0.19.3` + `@dimforge/rapier3d-compat@0.19.3`. Rapier'ın Rust
  çekirdeği çok daha ilerideyken npm paketi aylardır 0.19.3'te sabit.
- `three@0.185.1` + `@types/three`. Gölge `PCFShadowMap` (r185'te `PCFSoftShadowMap`
  deprecate edildi).
- Vite 6.4.3 + TypeScript + Vitest, paket yöneticisi npm.
- `tsconfig.json`'da **`"moduleResolution": "bundler"` zorunlu**: saf ESM paketinin
  `exports` alanı yok, `node16` ile tip çözümlemesi kırılır.

## Kurulum

```bash
npm install
```

## Test (çekirdek kanıt — tarayıcı gerekmez)

```bash
npm test
```

17 test yeşil olmalı:

| Dosya | Test | Ne kanıtlıyor |
|---|---|---|
| `tests/determinism.test.ts` | 6 | `version()` `"0.19.3"` · saf ESM'de `init` **undefined**, `-compat`'ta **function** · aynı paket iki koşu → `toEqual` ile bit-bit aynı `y` dizisi · iki paket aynı motoru çalıştırıyor (`y = 0.49872392416000366`) · `timestep = 1/120` dünyayı yarı yolda tutuyor · `w.timestep = 1/60` geri okunduğunda `!== 1/60` ama `toBeCloseTo(1/60, 7)` |
| `tests/stepper.test.ts` | 4 | tam `dt` → 1 adım · yarım `dt` → 0, ikinci yarım → 1 · 8 saniyelik kare `maxStepsPerFrame`'de duruyor (5) · `alpha` çeyrek adımda `0.25` |
| `tests/hud.test.ts` | 2 | demonun bastığı beş HUD satırı makaledeki blokla **birebir** aynı · `-compat`'ta üçüncü satır `✗` |
| `tests/wasm-bytes.test.ts` | 5 | `measureWasmBytes` dev'deki ÜÇ `.wasm` URL'si arasından sorgu-suz **gerçek ikiliyi** seçiyor (`?import` sarmalayıcısını değil) · build'deki hash'li asset adını tanıyor · `-compat` yolunda 0 · `encodedBodySize` yoksa `transferSize`'a düşüyor |

Vitest'in saf ESM paketini çözebilmesi için `vitest.config.ts`'de **`test.alias`
zorunlu**. `test.server.deps.inline` tek başına YETMİYOR — ikisi de
`npm run errors` çıktısında yan yana duruyor.

## Ölçümler (makaledeki bütün sayılar)

Hepsi elle tetiklenir; arka planda koşan hiçbir şey yok.

```bash
npm run inspect        # -compat'ın bundle'ı içindeki base64 bloğu
npm run size           # dört varyantı build edip bayt tablosunu basar
npm run cache-proof    # tek satır değiştir → hangi dosya yeniden iniyor
npm run errors         # üç kurulum hatasını gerçekten üretir
npm run dev-proof      # dev ile build'in farkı: dep optimizer + ?url sarmalayıcı
npm run bootstrap-async # TLA'nın üçüncü çözümü gerçekten koşuyor mu
```

`npm run bootstrap-async` → `y = 0.49872392416000366`. Aynı sayı `auditSetup()`,
`tests/determinism.test.ts` ve HUD'da da çıkıyor — üç ayrı yol, tek değer.

### `npm run inspect`

```
rapier.mjs      : 2.238.719 karakter
base64 blok     : 2.092.784 karakter
çözülmüş wasm   : 1.569.588 bayt
base64 vergisi  : %33.3
```

### `npm run size`

Giriş dosyası bilerek "boş uygulama" (`size/esm.ts`, `size/compat.ts`): three.js
sahnesi katılsa JS sütunu ikisinde de aynı miktarda büyür, fark sabit kalır.

```
| Kurulum | dist/ JS | dist/ .wasm | Toplam | gzip -9 |
| rapier3d + vite-plugin-wasm, target: "esnext"        |   182.074 B | 1.570.176 B | 1.752.250 B | 616.973 B |
| ... + vite-plugin-top-level-await (varsayılan hedef)  |   255.503 B | 1.570.176 B | 1.825.679 B | 621.138 B |
| rapier3d-compat, sıfır eklenti, target: "esnext"      | 2.236.245 B |           — | 2.236.245 B | 829.447 B |
| TUZAK: aynı ESM kurulumu + assetsInlineLimit: 2e6     | 2.275.633 B |           — | 2.275.633 B | 834.017 B |

ham fark (compat − ESM) : 483.995 B → %27,6
gzip fark               : 212.474 B → %34,4
tuzak − compat          : 39.388 B (tuzak compat'tan BÜYÜK)
tuzakta .wasm dosyası   : YOK (inline edildi)
TLA eklentisinin bedeli : 73.429 B JS
```

Aynı fark three.js'li gerçek demoda da sabit kalıyor: `dist/` 700.879 + 1.570.176 =
2.271.055 B, `dist-compat/` 2.755.032 B tek dosya → **483.977 B**. Yani three.js'i
sahneye katmak JS sütununu ikisinde de aynı miktarda büyütüyor; fark sabit.

### `npm run cache-proof`

```
# saf ESM yolu
önce : esm-DeOAV6VB.js  (182.074 B)
sonra: esm-Mwh65gap.js  (182.094 B)
wasm : rapier_wasm3d_bg-bb0TTxsO.wasm  (1.570.176 B)
       DEĞİŞMEDİ → önbellekten gelir

# -compat yolu
önce : compat-DtTIk6Xs.js  (2.236.245 B)
sonra: compat-CYxT40n-.js  (2.236.265 B)
wasm : YOK — motor JS'in içinde, bundle'la birlikte yeniden iner
```

Script eklediği satırı (`document.title = "v2";`) **geri alır** — çalışma ağacını
kirli bırakmaz.

### `npm run errors`

Üç patlama sırayla: `[vite:wasm-fallback] ... "ESM integration proposal for Wasm" is
not supported currently` → `[vite:esbuild-transpile] ... Top-level await is not
available in the configured target environment` → `Failed to resolve entry for
package "@dimforge/rapier3d"`. Dördüncü blok `server.deps.inline`'ın yetmediğini
gösteriyor. Beklenen hatalardan biri çıkmazsa script sıfır olmayan kodla düşer.

### `npm run dev-proof`

```
# 1) optimizeDeps.exclude YOK — dep optimizer devrede
node_modules/.vite/deps/@dimforge_rapier3d.js   2.598.784 bayt
  └─ içinde 2.093.568 karakterlik base64 blok
  → dev'de ayrı .wasm isteği YOK: motor JS'in içinde.

# 2) optimizeDeps.exclude VAR — sarmalayıcının ilk satırları
import __vite__wasmUrl from "/node_modules/@dimforge/rapier3d/rapier_wasm3d_bg.wasm?import&url"
import __vite__initWasm from "/__vite-plugin-wasm-helper"
const __vite__wasmModule = await __vite__initWasm({ ... });

  → ?import&url VAR · top-level await VAR
```

## Çalıştırma (görsel demo)

```bash
npm run dev           # saf ESM yolu   → http://localhost:5173/
npm run dev:compat    # -compat yolu   → http://localhost:5173/compat.html
```

**`file://` ile AÇMA.** Ne ES modülleri ne WASM o protokolde yüklenir; boş ekran
görürsün. Demo Vite dev sunucusu ister.

### Tuşlar

| Tuş | İş |
|---|---|
| `R` | kutuları yeniden düşür (başlangıç transformları, sıfır hız) |
| `A` | kurulum denetimini yeniden ölç (`auditSetup`, 2×120 adım, `setTimeout(fn, 0)` ile ilk kareden sonraya atılır) |

Otomatik süpürme, sonsuz spawn, arka planda koşan ölçüm YOK. 24 gövde + zemin,
tek 1024 gölge haritası, post-process zinciri yok — fanı çalıştırmaz.

### Beklenen çıktı

Sunum "dark cinematic + neon": ACES tone mapping, `PCFShadowMap` gölgeler, emissive
neon şeritler, CSS vignette. Bloom yok.

Sol üstteki cam panelde beş satırlık kurulum denetimi var (`tests/hud.test.ts` bu
satırları birebir doğruluyor):

```
RAPIER      0.19.3
wasm sınırı ✓  (timestep 0.01666666753590107)
ayrı .wasm  ✓  (1.570.176 B, application/wasm)
determinizm ✓  (y = 0.49872392416000366)
gövde       24 · collider 25 · adım/kare 1
```

Doğrulama koşulu: **DevTools → Network → filtre `wasm`.**

- `npm run dev` → tek satır, `application/wasm`, `Content-Length: 1570176`.
- `npm run dev:compat` → liste **boş**, HUD'un üçüncü satırı `✗`.

İkisi arasındaki fark bu yazının bütün tezi.

## Build

```bash
npm run build            # = build:esm → dist/            (.wasm ayrı dosya OLMALI)
npm run build:compat     # → dist-compat/                 (tek JS, .wasm yok)
npm run build:tla        # → dist-tla/
npm run build:inline-trap # → dist-inline-trap/           (tuzak: .wasm YOK)
npm run preview          # dist/ önizleme
npm run preview:compat   # dist-compat/ önizleme
```

`dist/` içinde `.wasm` uzantılı bir dosya YOKSA `assetsInlineLimit` tuzağına
düşülmüş demektir.

## Dosya yapısı

```
src/
  sim.ts              # ÇEKİRDEK: RapierApi tipi + createSim(R, count) — rastgelelik YOK
  sync.ts             # ÇEKİRDEK: Rapier transform → THREE.Object3D (quaternion, Euler YOK)
  stepper.ts          # ÇEKİRDEK: FixedStepper (accumulator + maxStepsPerFrame + alpha)
  checklist.ts        # ÇEKİRDEK: auditSetup(R) → SetupReport (4 ölçülebilir soru)
  scene.ts            # sunum: renderer, PCFShadowMap, neon şeritler, ışıklar
  view/hud.ts         # sunum: hudLines() saf fonksiyon + DOM bağlama
  view/controls.ts    # sunum: R = yeniden düşür
  main.ts             # demo girişi — saf ESM (init() YOK)
  main-compat.ts      # demo girişi — -compat (await RAPIER.init())
  bootstrap-async.ts  # TLA'nın üçüncü çözümü: async bootstrap (yalnız -compat'ta geçerli)
size/
  esm.ts / esm.html         # ölçüm girişi: sadece Rapier, three.js yok
  compat.ts / compat.html   # aynısının -compat ikizi
scripts/
  inspect-compat.mjs      # base64 bloğu ve vergisi
  measure-size.mjs        # dört varyantı build edip bayt tablosu
  cache-proof.mjs         # önbellek kanıtı (tek satır değiştir → geri al)
  reproduce-errors.mjs    # üç hatanın tam metni
  dev-optimizer-proof.mjs # dev ≠ build
tests/
  determinism.test.ts · stepper.test.ts · hud.test.ts
vite.config.ts · vite.config.tla.ts · vite.config.inline-trap.ts · vite.config.compat.ts
vitest.config.ts          # test.alias — saf ESM paketi için ZORUNLU
```

`src/scene.ts`, `src/view/*` ve iki `main*.ts` dışındaki her şey DOM'suz: testler
node altında koşar.

## Alınan dersler (makalede de anlatılır)

- Saf ESM paketinde `RAPIER.init` **yok**: `init.js` = `export {};`. `-compat` için
  yazılmış her eğitim materyali burada duvara çarpar.
- Saf paketin `package.json`'ında `main`/`exports` yok, sadece `module` var. Tarayıcı
  build'i çalışır (rollup `module`'ü okur), Node çözümlemesi çalışmaz → vitest patlar.
  Çözüm `test.alias`; `server.deps.inline` yetmiyor.
- `vite-plugin-wasm`'ın ürettiği top-level await **senin kodunda değil**. Bu yüzden
  "await'i async fonksiyona al" çözümü saf ESM yolunda işe yaramaz.
- Eklenti sırası `[wasm(), topLevelAwait()]`; tersi sessizce çalışmaz.
- `optimizeDeps.exclude` koymazsan dev'de WASM base64 olarak dep bundle'a gömülür:
  dev'de fiilen `-compat` davranışı alırsın, `dist/`'te başka bir şey görürsün.
- `assetsInlineLimit` `.wasm`'ın boyutunu geçerse bütün kazanç uçar — hatta
  `-compat`'tan 39.388 bayt büyük tek bir dosya elde edersin.
- Base64 vergisi matematik: 3 bayt → 4 karakter, tam %33,3. Gzip bunu silmiyor,
  oransal olarak büyütüyor (%27,6 → %34,4).
- İki paketin gömülü/ayrı WASM'ı 588 bayt farklı (1.569.588 vs 1.570.176):
  `wasm-bindgen`'in `bundler` ve `web` hedefleri farklı sarmalayıcı üretiyor.
- Fizik adımını render karesinden ayır: `FixedStepper` + `maxStepsPerFrame` freni.
- `cuboid(hx, hy, hz)` YARIM boyut alır; `0.4` → `0.8` birimlik küp.

## Lisans

MIT — bkz. `LICENSE`.
