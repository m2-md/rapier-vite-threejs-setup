# Yedi Karakterlik Fark, 484 Kilobayt: Vite + Three.js Projesinde Rapier — WASM Yükleme, Top-Level Await ve İlk Rigid Body'n

*Rapier npm'de iki paket olarak durur: `@dimforge/rapier3d` ve `@dimforge/rapier3d-compat`. Aradaki yedi karakter, `dist/` klasöründe yarım megabayta, tarayıcı önbelleğinde ise "uygulama kodunda tek satır değiştim, motoru yeniden indir" farkına dönüşüyor. İki yolu da sonuna kadar kurdum, üç hatanın tam metnini bıraktım, seçimi ölçülmüş baytlara bağladım. Sonunda da düşen ilk küpün var.*

*Tahmini okuma süresi: 18 dakika*

---

`npm i @dimforge/rapier3d` dedim, üç satır kod yazdım, `npm run build` dedim. Vite bana şunu döndü:

```
[vite:wasm-fallback] Could not load .../rapier_wasm3d_bg.wasm
(imported by node_modules/@dimforge/rapier3d/rapier_wasm3d.js):
"ESM integration proposal for Wasm" is not supported currently.
```

Sonra eklentiyi kurdum, tekrar denedim, bu sefer başka bir şey patladı. Onu da çözdüm, `vitest` koştum, üçüncü bir hata çıktı — bu sefer paketin `package.json`'ı yüzünden. Üç hata, üç ayrı katman, hiçbiri belgede yan yana durmuyor.

Bu seride Rapier'ı iki kez kullandım ve iki kez de `-compat` paketini seçip bu çileyi bir paragrafta geçtim. Sebebi dürüsttü: o yazıların konusu karakter fiziği ve instancing'di, WASM bootstrap'i değil. Ama borç birikti. Bu yazı o borcun ödenmesi.

Şöyle düşün. Rapier'ın kalbi Rust'ta yazılmış, WebAssembly'ye derlenmiş 1,5 megabaytlık bir motor bloğu. Senin JavaScript bundle'ın ise o motoru taşıyacak araç. Soru şu: motoru araca nasıl teslim edersin?

İki cevap var. Ya motoru kendi kasasında ayrı gönderirsin — kapıda forklift ister, kapının da geniş olması gerekir. Ya da motoru söküp base64 olarak aracın kullanma kılavuzunun sayfalarına dökersin — forklift yok, kapı sorunu yok, ama kılavuz 2 megabayt oldu ve içindeki bir yazım hatasını düzelttiğin an motoru da yeniden yolluyorsun.

`@dimforge/rapier3d` birinci yol. `@dimforge/rapier3d-compat` ikinci yol. Bu metafora yazı boyunca sadık kalacağım, çünkü aradaki bütün farklar bu tek görüntüden türüyor.

Yol haritası yedi durak: önce iki paketin `node_modules` içindeki gerçek anatomisini açacağız, sonra üç patlamayı sırasıyla göreceğiz. Üçüncü durak yazının çekirdeği — saf ESM yolunun tam kurulumu, eklenti sırası, dev/build ayrımı ve `assetsInlineLimit` tuzağı. Dördüncüsü `-compat` yolu; kısa tutacağım, çünkü ayrıntısını bu seride iki kez yazdım. Beşincide ilk rigid body'yi düşürüp three.js'e bağlayacağız. Altıncıda kurulumun doğru olduğunu ölçen bir kontrol listesi çıkaracağız, yedincide de bütün fiziği tarayıcı açmadan deterministik testle çiviye vuracağız.

Sürüm notu, çünkü bu konuda bir tuhaflık var: bu yazıdaki her şey `@dimforge/rapier3d@0.19.3`, `@dimforge/rapier3d-compat@0.19.3`, `three@0.185.1` ve Vite 6 ile ölçüldü. Rapier'ın Rust çekirdeği bu satırları yazarken çok daha ilerideydi; npm paketi ise aylardır 0.19.3'te sabit. Bunu gizlemek yerine yazıyorum: JS tarafındaki Rapier, Rust tarafındaki Rapier'ın gerisinde ve öyle kalabilir. Sürümü pinlemek bu yüzden tercih değil, zorunluluk.

### İki Paket, İki Dünya

En hızlı öğrenme yolu `node_modules`'a girip bakmak. İki paketin `package.json`'ları yan yana konunca hikâye kendini anlatıyor.

```jsonc
// upstream paket dosyası — bu depoda değil, node_modules'tan alıntı
// node_modules/@dimforge/rapier3d/package.json — saf ESM (ilgili alanlar)
{
  "module": "rapier.js",
  "types": "rapier.d.ts",
  "sideEffects": ["./*.js"]
  // "main" alanı YOK. "exports" alanı YOK.
}
```

```jsonc
// upstream paket dosyası — bu depoda değil, node_modules'tan alıntı
// node_modules/@dimforge/rapier3d-compat/package.json (ilgili alanlar)
{
  "type": "module",
  "main": "rapier.cjs",
  "module": "rapier.mjs",
  "types": "rapier.d.ts",
  "exports": {
    ".": {
      "types": "./rapier.d.ts",
      "require": "./rapier.cjs",
      "import": "./rapier.mjs"
    }
  }
}
```

`-compat` paketinin adındaki "compat" tam olarak burayı işaret ediyor: CommonJS `require`'ı da, ESM `import`'u da, modern `exports` haritasını da karşılıyor. Saf paket ise yalnızca `module` alanına sahip. Bir bundler bunu okur; ham Node okuyamaz. Bu tek eksik alan yedinci bölümde vitest'i yere serecek — orada döneceğiz.

Şimdi asıl fark. Saf paketteki bir dosyayı açalım; tamamı 165 bayt:

```js
// upstream paket dosyası — bu depoda değil
// node_modules/@dimforge/rapier3d/rapier_wasm3d.js — dosyanın TAMAMI (165 bayt)
import * as wasm from "./rapier_wasm3d_bg.wasm";
export * from "./rapier_wasm3d_bg.js";
import { __wbg_set_wasm } from "./rapier_wasm3d_bg.js";
__wbg_set_wasm(wasm);
```

Birinci satıra iyi bak. Bir `.wasm` dosyası doğrudan `import` ediliyor — bir JS modülüymüş gibi. Buna WebAssembly'nin ESM entegrasyon önerisi deniyor ve tarayıcılar bunu henüz varsayılan olarak desteklemiyor. `wasm-bindgen`'in "bundler" hedefi böyle kod üretir; boşluğu doldurmak bundler'ın işidir. Vite bu satırı gördüğünde ne yapacağını bilmez ve girişteki hatayı verir. Forklift eksik.

Bir dosya daha, bu sefer daha da kısa:

```js
// upstream paket dosyası — bu depoda değil
// node_modules/@dimforge/rapier3d/init.js — dosyanın TAMAMI, 43 bayt
export {};
//# sourceMappingURL=init.js.map
```

Boş. Saf ESM paketinde `RAPIER.init` diye bir şey yok; `typeof RAPIER.init` sana `undefined` döner. `-compat` için yazılmış her eğitim videosunu, her StackOverflow cevabını, hatta bu serideki kendi iki yazımı saf pakete kopyalarsan ilk çarpacağın duvar bu. `init()` yoktur çünkü gerek yoktur: WASM'ın hazırlanmasını modül grafiği senin yerine bekler. Motor kasadan çıkarılmış, monte edilmiş, sen `import` satırını yazdığında çalışır hâlde teslim edilmiştir.

`-compat` tarafında ise `init.d.ts` şunu diyor:

```ts
// upstream paket dosyası — bu depoda değil
// node_modules/@dimforge/rapier3d-compat/init.d.ts
export declare function init(): Promise<void>;
```

Base64'ü çözüp WASM'ı derleyen o fonksiyon. Çağırmazsan motor yok.

Peki base64'e dökmenin bedeli tam olarak nedir? Ölçelim. Küçük bir script, `-compat`'ın bundle'ının içine bakıyor:

```js
// scripts/inspect-compat.mjs
import { readFileSync } from "node:fs";

const src = readFileSync(
  "node_modules/@dimforge/rapier3d-compat/rapier.mjs",
  "utf8",
);

// Dosyadaki en uzun base64 bloğunu bul — gömülü WASM bu.
const blob = src.match(/[A-Za-z0-9+/=]{5000,}/)?.[0] ?? "";
const bytes = Buffer.from(blob, "base64").byteLength;
const fmt = (n) => n.toLocaleString("tr-TR");

console.log("rapier.mjs      :", fmt(src.length), "karakter");
console.log("base64 blok     :", fmt(blob.length), "karakter");
console.log("çözülmüş wasm   :", fmt(bytes), "bayt");
console.log("base64 vergisi  : %" + ((blob.length / bytes - 1) * 100).toFixed(1));
```

Çıktı:

```
rapier.mjs      : 2.238.719 karakter
base64 blok     : 2.092.784 karakter
çözülmüş wasm   : 1.569.588 bayt
base64 vergisi  : %33.3
```

Küçük bir ayrıntı: gömülü WASM 1.569.588 bayt, saf paketin `dist`'e kopyaladığı
`.wasm` ise 1.570.176. Aradaki 588 bayt `wasm-bindgen`'in iki farklı hedefinden
geliyor — `bundler` ile `web` aynı motoru biraz farklı sarmalıyor.

`rapier.mjs` dosyasının %93'ü tek bir base64 bloğu. Vergi de matematiğin kendisi: base64 her 3 baytı 4 karaktere çevirir, bu da tam olarak üçte bir şişme demektir. Kılavuza dökülen motor, kasadaki motordan üçte bir daha çok yer kaplıyor.

"Ama gzip bunu siler" diye düşünüyorsan — ben de öyle düşünüyordum. Silmiyor. İki projeyi de gerçekten kurup `vite build` koşturdum:

| Kurulum | `dist/` JS | `dist/` .wasm | Toplam | gzip -9 |
|---|---|---|---|---|
| `rapier3d` + `vite-plugin-wasm`, `target: "esnext"` | 182.074 B | 1.570.176 B | **1.752.250 B** | 616.973 B |
| `rapier3d` + `vite-plugin-wasm` + `vite-plugin-top-level-await` (varsayılan hedef) | 255.503 B | 1.570.176 B | 1.825.679 B | 621.138 B |
| `rapier3d-compat`, sıfır eklenti, `target: "esnext"` | 2.236.245 B | — | **2.236.245 B** | 829.447 B |

Ham fark 483.995 bayt — yaklaşık %28. Gzip'ten sonraki fark 212.474 bayt, yani %34. Sıkıştırma base64 vergisini azaltmıyor, oransal olarak büyütüyor. Sebep şu: DEFLATE, ikili veride tekrar eden bayt örüntülerini yakalar; base64 o örüntüleri 6-bitlik pencerelere böler ve hizalamayı bozar. Sıkıştırıcı aynı motoru görüyor ama artık tanıyamıyor.

> Bu sayılar benim makinemde, Vite 6.4.3 + Rapier 0.19.3 + boş bir uygulama dosyasıyla ölçüldü. Depoda `npm run size` bu tabloyu senin makinende yeniden üretiyor; three.js'i de sahneye kattığın an JS sütunu ikisinde de aynı miktarda büyür, fark sabit kalır.

Bir de görünmeyen bir fark var. Bence en önemlisi de bu. Uygulama kodunda tek bir satır değiştirip iki projeyi de yeniden build ettim:

```
# saf ESM yolu
önce : esm-DeOAV6VB.js  (182.074 B)  +  rapier_wasm3d_bg-bb0TTxsO.wasm
sonra: esm-Mwh65gap.js  (182.094 B)  +  rapier_wasm3d_bg-bb0TTxsO.wasm  ← hash aynı

# -compat yolu
önce : compat-DtTIk6Xs.js  (2.236.245 B)
sonra: compat-CYxT40n-.js  (2.236.265 B)                               ← hepsi yeni
```

Saf ESM'de motor kasası kendi etiketiyle depoda duruyor; kullanıcı senin 182 kilobaytlık uygulama kodunu yeniden indiriyor, 1,5 megabaytlık motoru önbellekten alıyor. `-compat`'ta kılavuzdaki tek harflik düzeltme, 2,2 megabaytın tamamını yeniden yola çıkarıyor. Haftada üç kez deploy eden bir oyun için bu fark, dosya boyutu tablosundan daha çok canını yakar.

### Patlamalar, Geldikleri Sırayla

Saf ESM yolunu kurarken üç hata alırsın ve sırası sabittir. Her birinin tam metnini buraya bırakıyorum, çünkü insanlar hata mesajını arayarak geliyor.

Birinci patlama, hiç eklenti yokken:

```
[vite:wasm-fallback] Could not load
node_modules/@dimforge/rapier3d/rapier_wasm3d_bg.wasm
(imported by node_modules/@dimforge/rapier3d/rapier_wasm3d.js):
"ESM integration proposal for Wasm" is not supported currently.
Use vite-plugin-wasm or other community plugins to handle this.
Alternatively, you can use `.wasm?init` or `.wasm?url`.
See https://vite.dev/guide/features.html#webassembly for more details.
```

Bu Vite'ın kibar hâli: ne olduğunu da söylüyor, çözümü de. Forkliftin adı bile burada geçiyor: `npm i -D vite-plugin-wasm`, sonra `plugins: [wasm()]`.

İkinci patlama, forklift takıldıktan hemen sonra:

```
[vite:esbuild-transpile] Transform failed with 1 error:
assets/esm-!~{001}~.js:6143:27: ERROR: Top-level await is not available in the
configured target environment ("chrome87", "edge88", "es2020", "firefox78",
"safari14" + 2 overrides)

6143|  const __vite__wasmModule = await __vite__initWasm({ "./rapier_wasm3d_bg.js": …
   |                             ^
```

İşte bu, bu yazının başlığındaki hata. Ama dikkat: o `await` senin yazdığın bir satır değil. `vite-plugin-wasm`, `.wasm` importunu bir `WebAssembly.instantiate` çağrısına çevirir; instantiate asenkrondur; eklenti de karşılığında modül seviyesinde bir `await` üretmek zorunda kalır: bir top-level await (modül üstü bekleme). Forklift kapıyı zorluyor.

Kapı, Vite'ın derleme hedefi. Vite'ın varsayılan `build.target` değeri modern tarayıcıların bir alt kümesini hedefler ve o küme top-level await'i içermez. Hata metnindeki tarayıcı listesi tam olarak bunu söylüyor: `chrome87`, `edge88`, `firefox78`, `safari14`.

Üç çözüm var. Üçü de her senaryoda işe yaramıyor — burası önemli.

Birinci çözüm, hedefi yükseltmek. En basiti, benim önerdiğim:

```ts
// vite.config.ts — SADECE ilgili satır; depodaki tam dosya aşağıda
export default defineConfig({
  build: { target: "esnext" },
});
```

İkinci çözüm, `vite-plugin-top-level-await`. Eklenti, TLA'yı promise tabanlı bir sarmalayıcıya dönüştürür ve eski hedeflerde de çalışır:

```ts
// vite.config.tla.ts
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

// İkinci çözüm: TLA'yı eklentiyle sarmala, hedefi yükseltme.
// build.target BİLEREK yok — varsayılan hedefte de çalıştığının kanıtı.
// Sıra zorunlu: wasm() önce TLA'yı üretir, topLevelAwait() sonra onu sarmalar.
export default defineConfig({
  plugins: [wasm(), topLevelAwait()],
  optimizeDeps: { exclude: ["@dimforge/rapier3d"] },
});
```

Bunun bir bedeli var, ölçtüm: JS bundle 182.074 bayttan 255.503 bayta çıkıyor. Tam 73.429 bayt, sarmalayıcı ve es2020'ye düşürülen kodun toplamı. Eğer gerçekten Safari 14 desteklemen gerekiyorsa bu ödenmesi makul bir bedel; gerekmiyorsa `esnext` daha küçük ve daha az sihirli.

Üçüncü çözüm, `await`'i bir `async` fonksiyonun içine almak:

```ts
// src/bootstrap-async.ts
import { createSim, type RapierApi } from "./sim";

/**
 * TLA hatasının ÜÇÜNCÜ çözümü: await'i bir async fonksiyonun içine al.
 * Yalnızca -compat yolunda geçerli — çünkü orada await'i SEN yazıyorsun.
 * Saf ESM yolunda o await eklentinin ürettiği bir bağımlılığın içindedir.
 *
 * Bu dosya demo girişi değil; `npm run bootstrap-async` ile koşar ve testlerle
 * aynı sayıyı basar: y = 0.49872392416000366.
 */
function startGame(R: RapierApi): void {
  const { world, bodies } = createSim(R, 8);
  for (let i = 0; i < 120; i++) world.step();
  console.log("y =", bodies[0].translation().y);
}

async function bootstrap() {
  const RAPIER = await import("@dimforge/rapier3d-compat");
  await RAPIER.init();
  startGame(RAPIER as unknown as RapierApi);
}
void bootstrap();
```

Şimdi dikkat, çünkü bu üçüncü çözüm en çok tavsiye edilen ve saf ESM yolunda en işe yaramayan olan. `await`'i sarmalayabilmen için o `await`'in senin kodunda olması gerekir. Saf ESM yolunda değil — eklenti onu bir bağımlılığın içinde üretiyor, senin erişemediğin bir yerde. Async bootstrap bu yüzden yalnızca `-compat` yolunda geçerli bir çözüm; orada `await RAPIER.init()`'i sen yazıyorsun, sen sarmalıyorsun.

Üçüncü patlamayı yedinci bölüme saklıyorum, çünkü o tarayıcıda değil vitest'te çıkıyor ve tamamen ayrı bir katman.

### Saf ESM Yolu: `vite-plugin-wasm` + `vite-plugin-top-level-await`

Yazının çekirdeği burası. Önce kurulum:

```bash
npm i @dimforge/rapier3d@0.19.3 three@0.185.1
npm i -D vite vite-plugin-wasm @types/three @types/node typescript vitest
# İkinci TLA çözümünü deneyeceksen (aşağıda ölçtüm, ~73 KB bedeli var):
npm i -D vite-plugin-top-level-await
```

Sonra tam yapılandırma. Her satırın niye orada olduğunu yanına yazdım:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  // Sıra önemlidir. wasm() zincirin başında durur: .wasm importunu
  // instantiate çağrısına çevirir. Sonraki her eklenti onun çıktısını görür.
  plugins: [wasm()],

  build: {
    // wasm()'ın ürettiği top-level await'in çalışabilmesi için.
    // Alternatifi: plugins: [wasm(), topLevelAwait()] — ~73 KB daha büyük.
    target: "esnext",

    // Vite varsayılanı zaten 4096; buraya bilerek yazıyorum.
    // Bu sayı 1.570.176'nın üstüne çıkarsa .wasm base64 olarak
    // JS'in içine gömülür ve bütün kazancını kaybedersin.
    assetsInlineLimit: 4096,
  },

  // Dev sunucusunun dependency optimizer'ını Rapier'dan uzak tut.
  // Sebebi aşağıda: dev ile build farklı davranıyor.
  optimizeDeps: { exclude: ["@dimforge/rapier3d"] },
});
```

Eklenti sırasına bir cümle daha borçluyum. `vite-plugin-top-level-await` kullanıyorsan `[wasm(), topLevelAwait()]` sırası zorunlu, tersi değil. `wasm()` önce çalışıp TLA'yı üretmeli ki `topLevelAwait()` onu sarmalayacak bir şey bulabilsin. Ters yazarsan sessizce hiçbir şey olmaz ve aynı hatayı almaya devam edersin — bu tür hatalar en sinir bozucu olanlar, çünkü konfigürasyona bakıp "ama eklenti orada" dersin.

Şimdi belgelerin yan yana koymadığı kısım: dev ile build aynı şeyi yapmıyor.

`vite build` sırasında `.wasm`, içerik hash'i olan ayrı bir asset olarak `dist/assets/` altına kopyalanır. Tarayıcı onu ayrı bir istekle, `Content-Type: application/wasm` başlığıyla çeker. Sana anlattığım her şey burada geçerli.

`vite dev` sırasında ise araya bir üçüncü oyuncu giriyor: dependency pre-bundler. Vite, `node_modules` içindeki bağımlılıkları esbuild ile önceden paketleyip `node_modules/.vite/deps/` altına koyar — normalde harika bir optimizasyon, yüzlerce küçük modül isteğini tek dosyaya indirir. Ama Rapier söz konusu olunca şunu üretiyor:

```
node_modules/.vite/deps/@dimforge_rapier3d.js   2.598.784 bayt
  └─ içinde 2.093.568 karakterlik base64 blok
```

Optimizer, `vite-plugin-wasm`'ı kendi içinde koşturuyor ve WASM'ı base64 olarak dep bundle'ına gömüyor. Sonuç: dev'de motor yine kılavuza dökülmüş oluyor. Ayrı `.wasm` isteği yok, önbellek ayrımı yok, `dist/`'te göreceğin davranışın hiçbiri yok. Bir sorunu dev'de kovalayıp production'da bulamamanın ya da tersinin klasik reçetesi.

`optimizeDeps: { exclude: ["@dimforge/rapier3d"] }` bunu kapatıyor. Kapattıktan sonra dev sunucusunun ürettiği sarmalayıcıyı çektim (depoda `npm run dev-proof`), satırlar şöyle:

```js
import __vite__wasmUrl from "/node_modules/@dimforge/rapier3d/rapier_wasm3d_bg.wasm?import&url"
import __vite__initWasm from "/__vite-plugin-wasm-helper"
const __vite__wasmModule = await __vite__initWasm({ ... });
```

`?url` var; demek ki gerçek bir ağ isteği var. Ve o `await`, kapıyı zorlayan top-level await'in ta kendisi — kaynağını gözünle görmüş olduk.

Son tuzak, `assetsInlineLimit`. Bu ayarı `2_000_000` yapıp aynı projeyi build ettim:

```
dist-inline-trap/assets/esm-BDJbUGIT.js   2.275.633 bayt   (tek dosya, .wasm yok)
```

Eklentiyi kurdun, hedefi yükselttin, dev optimizer'ı ayarladın — ve tek bir sayı yüzünden `-compat`'tan bile 39 kilobayt daha büyük tek bir dosyaya indin. Kendi elinle yaptığın işi geri aldın. Bunu tipik olarak birisi tek dosyalık bir build istediğinde ya da `vite-plugin-singlefile` gibi bir eklenti eklendiğinde görürsün; sessizce olur, hiçbir uyarı çıkmaz. `dist/` içinde `.wasm` uzantılı bir dosya arıyor olman bu yüzden.

### `-compat` Yolu: Tek `await`, Sıfır Eklenti

Bu yol iki kod bloğunda biter. Rapier'ın kinematik karakter controller'ı ve 10.000 gövdeyi tek `InstancedMesh`'e bağlama yazılarının ikisi de `-compat` kullanıyor; oradaki kurulum paragrafları hâlâ geçerli, burada tekrarlamayacağım.

Tamamı bu:

```ts
// size/compat.ts — -compat yolunun TAMAMI. esm.ts'in ikizi, tek fark init().
import RAPIER from "@dimforge/rapier3d-compat";

// WASM base64 olarak paketin içinde; init() onu çözüp motoru ayağa kaldırır.
// Bunu atlarsan World/collider çağrıları "not initialized" ile patlar.
await RAPIER.init();

const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
console.log(RAPIER.version(), world.timestep);
```

```ts
// vite.config.compat.ts — eklenti yok, sadece hedef
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  build: {
    target: "esnext",
    // Bu depoda iki yol yan yana duruyor; -compat demosunun girişi ayrı.
    // Yalnızca -compat kullanan bir projede bu satır gereksizdir.
    rollupOptions: {
      input: fileURLToPath(new URL("./compat.html", import.meta.url)),
    },
  },
  esbuild: { target: "esnext" },
  optimizeDeps: { esbuildOptions: { target: "esnext" } },
});
```

Üç ayrı yerde `esnext` yazmamın sebebi, `await RAPIER.init()`'in senin kodunda bir top-level await olması ve Vite'ın bu kodu üç ayrı boru hattından geçirmesi: build (rollup + esbuild), dev transform (`esbuild`) ve dependency pre-bundling (`optimizeDeps.esbuildOptions`). Üçünü de ayarlamazsan hangisinde patlayacağını önceden bilemezsin.

Ne zaman `-compat` seçilir? Hızlı bir prototip yapıyorsan. Eklenti zinciri kuramayacağın ya da kurmak istemeyeceğin bir ortamdaysan — mesela bir CodeSandbox, bir Observable notebook, ya da build ayarına dokunma yetkin olmayan bir kurumsal proje. Son bir durum: öğretici yazarken, okurun `vite.config.ts` yüzünden yolda kalmasını istemiyorsan.

Ne zaman seçilmez? Ölçtüğümüz iki şey yüzünden. Bundle 484 kilobayt daha büyük olacaksa ve sık deploy ediyorsan, o motoru her seferinde yeniden yollamak istemezsin. Bir de gerçekten büyük bir sahnen varsa: 2,2 megabaytlık tek bir JS dosyasını tarayıcı parse ederken ana thread bloke olur; ayrı `.wasm` ise derlenirken JS parse'ıyla paralel gidebilir.

Dürüst olayım: çoğu proje için `-compat` doğru seçim. Ben de bu seride iki kez onu seçtim ve pişman değilim. Ama seçim bilinçli olmalı, "eğitim videosunda öyle yazıyordu" diye değil.

### İlk Rigid Body ve Senkron

Motor takıldı. Şimdi ilk cismi düşürelim.

Rapier'ın ve three.js'in kesiştiği yer tek bir cümle: fizik dünyası her adımda cisimlerin nerede olduğunu günceller, sen de o konumu okuyup mesh'e yazarsın. Rapier ekranı bilmez, three.js fiziği bilmez. Aradaki köprü senin altı satırın.

Önce dünya. Simülasyonu kasten `RAPIER` namespace'ini parametre olarak alacak biçimde yazıyorum — böylece aynı dosya iki paketle de çalışıyor ve yedinci bölümde ikisini karşılaştırabileceğiz:

```ts
// src/sim.ts
import type RAPIER from "@dimforge/rapier3d";

/** İki paketin de karşıladığı ortak yüzey. Kod hangisiyle koştuğunu bilmez. */
export type RapierApi = typeof import("@dimforge/rapier3d").default;

export interface Sim {
  world: RAPIER.World;
  bodies: RAPIER.RigidBody[];
}

/** Zemin + count adet düşen küp. Hiçbir rastgelelik yok: determinizm için. */
export function createSim(R: RapierApi, count = 24): Sim {
  const world = new R.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = 1 / 60;

  // Zemin: fixed (sabit) gövde — kuvvetlerden etkilenmez, yerinden oynamaz.
  const ground = world.createRigidBody(R.RigidBodyDesc.fixed());
  world.createCollider(R.ColliderDesc.cuboid(12, 0.1, 12), ground);

  const bodies: RAPIER.RigidBody[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % 4;
    const row = (i / 4) | 0;

    // dynamic (dinamik) gövde: yerçekimi ve çarpışmalar onu iter.
    const body = world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(col * 1.1 - 1.65, 3 + row * 1.2, (i % 3) * 0.4 - 0.4)
        .setRotation({ x: 0.1, y: 0.2, z: 0.05, w: 0.973 }),
    );
    // cuboid(hx, hy, hz) YARIM boyut alır: 0.4 → 0.8 birimlik küp.
    world.createCollider(R.ColliderDesc.cuboid(0.4, 0.4, 0.4), body);
    bodies.push(body);
  }
  return { world, bodies };
}
```

İki ayrıntı: `cuboid` yarım boyut ister, tam boyut değil — karıştırırsan küpler ekranda iki katı büyük çizilir. Ve rigid body ile collider ayrı şeylerdir: gövde kütlesi ve hareketi, collider ise şekli ve teması taşır. Bir gövdeye birden fazla collider takabilirsin.

Şimdi köprü:

```ts
// src/sync.ts
import type * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d";

/** Rapier gövdesinin transform'unu bir three.js nesnesine yazar. */
export function syncBodyToObject(
  body: RAPIER.RigidBody,
  object: THREE.Object3D,
): void {
  const t = body.translation(); // {x, y, z}
  const r = body.rotation(); // {x, y, z, w} — quaternion

  object.position.set(t.x, t.y, t.z);
  object.quaternion.set(r.x, r.y, r.z, r.w);
}
```

Bu kadar. Rapier'ın döndürdüğü rotasyon zaten bir quaternion (dördey) olduğu için Euler açılarına çevirmene gerek yok — çevirirsen gimbal lock ve gereksiz trigonometri kazanırsın, başka bir şey değil.

Gelelim üçüncü parçaya, asıl önemlisi bu: fizik adımını render karesinden ayırmak.

Naif döngü şudur — her `requestAnimationFrame`'de bir `world.step()`. 60 Hz'lik bir monitörde harika görünür; 144 Hz'lik bir ekranda her şey 2,4 kat hızlı akar. Arka plandan dönen bir sekmede de tarayıcı sana 8 saniyelik bir `deltaTime` uzatır ve cisimler duvarların içinden geçer.

Çözüm bir accumulator (biriktirici). Sabit adımın neden ve nasılını bu serinin metronom yazısında uzun uzun anlatmıştım; burada Rapier'a bağlanmış en yalın hâlini bırakıyorum:

```ts
// src/stepper.ts

/**
 * Fizik adımını render karesinden ayırır. Ekran 30 Hz de olsa 144 Hz de olsa
 * dünya hep aynı büyüklükte adımlarla ilerler — determinizmin ön şartı.
 */
export class FixedStepper {
  private accumulator = 0;

  constructor(
    /** Sabit fizik adımı (saniye). Rapier'ın varsayılanı 1/60. */
    readonly dt = 1 / 60,
    /** Tek karede atılabilecek en fazla adım — ölüm sarmalı freni. */
    readonly maxStepsPerFrame = 5,
  ) {}

  /** Geçen gerçek süreyi yutar, kaç fizik adımı atılacağını söyler. */
  advance(frameSeconds: number): number {
    // Sekme arka plandan dönünce frameSeconds devasa olur. Sınırlamazsan
    // tek karede yüzlerce adım atarsın, o da bir sonraki kareyi geciktirir,
    // o da daha çok adım demektir: ölüm sarmalı.
    this.accumulator += Math.min(frameSeconds, this.dt * this.maxStepsPerFrame);

    let steps = 0;
    while (this.accumulator >= this.dt) {
      this.accumulator -= this.dt;
      steps++;
    }
    return steps;
  }

  /** İki fizik adımı arasındaki oran (0..1) — render interpolasyonu için. */
  get alpha(): number {
    return this.accumulator / this.dt;
  }
}
```

Ve hepsini birleştiren döngü:

```ts
// src/main.ts
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d"; // init() YOK — saf ESM
import { createSim } from "./sim";
import { syncBodyToObject } from "./sync";
import { FixedStepper } from "./stepper";
import { buildScene } from "./scene";
import { createHud } from "./view/hud";
import { bindControls } from "./view/controls";

const { scene, camera, renderer } = buildScene();
const { world, bodies } = createSim(RAPIER, 24);

// Her gövde için bir mesh. 24 kutu için bu tamamen yeterli;
// on binlerce gövdeye çıkarsan InstancedMesh'e geçmen gerekir.
const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
const material = new THREE.MeshStandardMaterial({ color: 0x4cc9f0 });
const meshes = bodies.map(() => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  scene.add(mesh);
  return mesh;
});

// Sunum: HUD kurulum raporunu basar (A = yeniden ölç), R = yeniden düşür.
const hud = createHud(RAPIER, { world, bodies }, "ESM");
bindControls({ world, bodies });

const stepper = new FixedStepper(1 / 60);
let last = performance.now();

renderer.setAnimationLoop(() => {
  const now = performance.now();
  const frameSeconds = (now - last) / 1000;
  last = now;

  // Kaç adım gerekiyorsa o kadar; sıfır da olabilir, üç de.
  const steps = stepper.advance(frameSeconds);
  for (let i = 0; i < steps; i++) world.step();

  // Fizik ilerledi; şimdi ekranı ona göre güncelle.
  for (let i = 0; i < bodies.length; i++) {
    syncBodyToObject(bodies[i], meshes[i]);
  }

  renderer.render(scene, camera);
  hud.update(steps);
});
```

`world.step()` çağrısının döngü içinde, `renderer.render()` çağrısının dışında olduğuna dikkat et. Fizik kendi ritmiyle, çizim kendi ritmiyle. Aralarındaki tek bağ, `steps` sayısı.

Gövde başına bir `Mesh` tutmak yirmi dört kutuda tamamen doğru karar. On bine çıkarsan aynı döngü çizim çağrılarında boğulur; o eşiği ve `InstancedMesh` çözümünü seride ayrıca ölçmüştüm — ölçekleyeceksen oradan devam et.

Ha, `alpha` değerini burada kullanmadım. 24 kutuluk bir demoda gözle görülmez; ama hızlı hareket eden cisimlerde önceki ve şimdiki transform arasında `alpha` oranıyla lerp yaparsan titremeyi bitirirsin. Enterpolasyonun ayrıntısı yine o metronom yazısında.

### Kurulum Doğru mu? Ölçülebilir Kontrol Listesi

"Çalışıyor gibi görünüyor" bir doğrulama değil. Kurulumun doğru olduğunu dört soruyla ölçebilirsin ve dördünün de programatik cevabı var.

```ts
// src/checklist.ts
import type { RapierApi } from "./sim";
import { createSim } from "./sim";

export interface SetupReport {
  version: string;
  /** timestep WASM tarafında f32 tutulur; JS'in f64'ü ile eşit ÇIKMAMALI. */
  crossesWasmBoundary: boolean;
  /** Ağda gerçek bir .wasm isteği görüldü mü? (saf ESM: evet, -compat: hayır) */
  separateWasmRequest: boolean;
  /** Aynı kurulum iki kez koşunca bit-bit aynı sonucu veriyor mu? */
  deterministic: boolean;
  finalY: number;
}

export function auditSetup(R: RapierApi): SetupReport {
  // 1) Motor gerçekten ayakta mı? version() WASM'a gidip geliyor.
  const version = R.version();

  // 2) f32 sınırı: 1/60'ı yaz, geri oku. Saf JS bir stub olsaydı
  //    aynı f64 sayı dönerdi. WASM dönüyorsa değer f32'ye yuvarlanır.
  const probe = new R.World({ x: 0, y: 0, z: 0 });
  probe.timestep = 1 / 60;
  const crossesWasmBoundary = probe.timestep !== 1 / 60;

  // 3) Ağ sekmesine programatik bakış.
  //    Burada gevşek `.includes(".wasm")` KASITLI: cevap boolean, ve Vite'ın
  //    ürettiği üç URL'nin (`?import`, `?import&url`, ham) üçü de aynı cevabı
  //    verir — biri varsa öteki de vardır. `hud.ts` ise BAYT ölçtüğü için
  //    üçünü ayırmak ZORUNDA; oradaki filtre bu yüzden katı.
  const separateWasmRequest =
    typeof performance !== "undefined" &&
    performance
      .getEntriesByType("resource")
      .some((e) => e.name.includes(".wasm"));

  // 4) Determinizm: iki özdeş dünya, aynı adım sayısı, aynı sonuç.
  const a = createSim(R, 8);
  const b = createSim(R, 8);
  for (let i = 0; i < 120; i++) {
    a.world.step();
    b.world.step();
  }
  const ay = a.bodies[0].translation().y;
  const by = b.bodies[0].translation().y;

  return {
    version,
    crossesWasmBoundary,
    separateWasmRequest,
    deterministic: ay === by,
    finalY: ay,
  };
}
```

İkinci maddeyi açayım, çünkü ilk gördüğümde ben de "bu ne biçim test" dedim. Rapier'ın `timestep` alanı WASM tarafında 32-bit float olarak saklanır. JavaScript'ten `1/60` yazarsın — o bir f64'tür, `0.016666666666666666`. Geri okuduğunda `0.01666666753590107` alırsın; f32'ye yuvarlanmış hâli. Dolayısıyla `probe.timestep === 1/60` karşılaştırması `false` döner ve bu `false` sana "veri gerçekten WASM sınırını geçti" der. Bir JS shim'i olsaydı yazdığın sayıyı aynen geri verirdi.

Üçüncü madde iki yolu birbirinden ayıran testtir. Saf ESM build'inde `performance.getEntriesByType("resource")` içinde `.wasm` uzantılı bir kayıt bulursun; `-compat`'ta bulamazsın, çünkü hiç `.wasm` isteği yoktur. Aynı şeyi DevTools'un Network sekmesinde gözünle de görebilirsin — filtreye `wasm` yazıp sayfayı yenile. Saf ESM'de tek bir satır: 1.570.176 bayt, `application/wasm`. `-compat`'ta boş liste.

Bir uyarı: `optimizeDeps.exclude` ayarını unutursan dev modunda bu üçüncü test saf ESM'de de `false` döner, çünkü optimizer WASM'ı base64'e gömmüştür. Test yalan söylemiyor; kurulumun dev'de gerçekten `-compat` gibi davranıyor. Zaten mesele de bu.

Demodaki HUD bu raporu ekranın köşesinde canlı gösteriyor:

```
RAPIER      0.19.3
wasm sınırı ✓  (timestep 0.01666666753590107)
ayrı .wasm  ✓  (1.570.176 B, application/wasm)
determinizm ✓  (y = 0.49872392416000366)
gövde       24 · collider 25 · adım/kare 1
```

### Deterministik Test: Tarayıcı Açmadan

Ve üçüncü patlama. `vitest run` dedim, şunu aldım:

```
Error: Failed to resolve entry for package "@dimforge/rapier3d".
The package may have incorrect main/module/exports specified in its package.json.
  Plugin: vite:import-analysis
```

Birinci bölümdeki `package.json` karşılaştırmasını hatırlıyor musun? Saf pakette `main` yok, `exports` yok, sadece `module` var. Vitest testleri Node tarafında koşturur ve Node çözümlemesi `main` ya da `exports` arar. Bulamıyor. Tarayıcı build'i sorunsuz çalışıyor çünkü orada rollup `module` alanını okuyor; Node yolunda kimse okumuyor.

Çözüm bir satır. Denedim, `server.deps.inline` yetmiyor; gereken şey doğrudan bir alias:

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import wasm from "vite-plugin-wasm";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [wasm()],
  test: {
    // Saf ESM paketinde "main"/"exports" yok; Node çözümlemesi giriş
    // dosyasını bulamıyor. Doğrudan gösteriyoruz.
    alias: {
      "@dimforge/rapier3d": fileURLToPath(
        new URL("./node_modules/@dimforge/rapier3d/rapier.js", import.meta.url),
      ),
    },
  },
});
```

Bir de TypeScript tarafında `moduleResolution: "bundler"` gerekiyor; `node16` ile aynı sebepten tip çözümlemesi kırılır.

Bunlar oturunca testler saf sayıya dönüşüyor. Ne tarayıcı, ne canvas, ne gerçek saniye:

```ts
// tests/determinism.test.ts
import { describe, expect, it } from "vitest";
import RAPIER_ESM from "@dimforge/rapier3d";
import RAPIER_COMPAT from "@dimforge/rapier3d-compat";
import { createSim, type RapierApi } from "../src/sim";

const ESM = RAPIER_ESM as unknown as RapierApi;
const COMPAT = RAPIER_COMPAT as unknown as RapierApi;

function runSteps(R: RapierApi, count: number, steps: number): number[] {
  const sim = createSim(R, count);
  for (let i = 0; i < steps; i++) sim.world.step();
  return sim.bodies.map((b) => b.translation().y);
}

describe("kurulum doğrulaması", () => {
  it("motor ayakta ve sürüm pinlenmiş", () => {
    expect(ESM.version()).toBe("0.19.3");
  });

  it("saf ESM'de init() yoktur — -compat'ta vardır", async () => {
    expect((RAPIER_ESM as { init?: unknown }).init).toBeUndefined();
    expect(typeof RAPIER_COMPAT.init).toBe("function");
    await RAPIER_COMPAT.init();
  });

  it("aynı girdi → bit-bit aynı çıktı", () => {
    const a = runSteps(ESM, 8, 120);
    const b = runSteps(ESM, 8, 120);
    // toBeCloseTo değil, toEqual: yaklaşık değil, tam eşitlik istiyoruz.
    expect(a).toEqual(b);
  });

  it("iki paket aynı motoru çalıştırıyor", async () => {
    await RAPIER_COMPAT.init();
    expect(runSteps(ESM, 8, 120)).toEqual(runSteps(COMPAT, 8, 120));
  });

  it("timestep gerçekten uygulanıyor", () => {
    const fast = createSim(ESM, 1);
    const slow = createSim(ESM, 1);
    slow.world.timestep = 1 / 120; // yarım adım

    for (let i = 0; i < 30; i++) {
      fast.world.step();
      slow.world.step();
    }
    // Aynı adım sayısı, yarı süre → yarı yol. Küp daha yukarıda kalmalı.
    expect(slow.bodies[0].translation().y).toBeGreaterThan(
      fast.bodies[0].translation().y,
    );
  });

  it("WASM sınırı f32'de: timestep geri okunduğunda yuvarlanmış", () => {
    const w = new ESM.World({ x: 0, y: 0, z: 0 });
    w.timestep = 1 / 60;
    expect(w.timestep).not.toBe(1 / 60);
    expect(w.timestep).toBeCloseTo(1 / 60, 7);
  });
});
```

```ts
// tests/stepper.test.ts
import { describe, expect, it } from "vitest";
import { FixedStepper } from "../src/stepper";

describe("FixedStepper", () => {
  it("tam bir dt bir adım verir", () => {
    expect(new FixedStepper(1 / 60).advance(1 / 60)).toBe(1);
  });

  it("yarım dt sıfır adım verir, artan biriktirilir", () => {
    const s = new FixedStepper(1 / 60);
    expect(s.advance(1 / 120)).toBe(0);
    expect(s.advance(1 / 120)).toBe(1); // iki yarım = bir tam
  });

  it("8 saniyelik dev kare ölüm sarmalına sokmaz", () => {
    const s = new FixedStepper(1 / 60, 5);
    expect(s.advance(8)).toBe(5); // tavana takıldı
  });

  it("alpha iki adım arasındaki oranı verir", () => {
    const s = new FixedStepper(1 / 60);
    s.advance(1 / 60 + 1 / 240); // bir tam adım + çeyrek
    expect(s.alpha).toBeCloseTo(0.25, 5);
  });
});
```

Üçüncü test bütün iddianın kalbi. `toBeCloseTo` değil `toEqual` kullanıyoruz; yaklaşık değil, tam. İki dünya bit-bit aynı sonucu vermiyorsa determinizm bir yerde kırılmış demektir — mesela sahne kurulumuna bir `Math.random()` sızmıştır. Bu test onu anında yakalar.

Dördüncü test benim en sevdiğim: iki farklı npm paketi, aynı 120 adım, aynı `y` dizisi. İkisinin de aynı motoru taşıdığının kanıtı. Kendi makinemde ilk gövdenin `y` değeri her iki pakette de `0.49872392416000366` çıktı — son basamağına kadar aynı. HUD'daki `determinizm` satırındaki sayı da bu: `auditSetup()` ile bu test birebir aynı hesabı yapıyor.

Dürüst bir dipnot: Rapier'ın determinizmi aynı sürüm ve aynı platformda garantidir. Farklı işletim sistemleri ya da farklı CPU mimarileri arasında floating point (kayan nokta) farkları çıkabilir. Bu test CI'da ve senin makinende sağlam bir guard'dır; "dünyanın her yerinde bit-bit aynı" iddiası abartı olurdu.

Demoyu görmek istersen `npm run dev`. `file://` ile `index.html`'i açarsan boş ekran görürsün — ne ES modülleri ne de WASM o protokolde yüklenir. Bunu serideki her yazıda tekrarlıyorum, çünkü ben yeterince kez yedim.

### Özetle:

1. `@dimforge/rapier3d` saf ESM'dir: WASM ayrı bir `.wasm` dosyası olarak gelir, `RAPIER.init()` **yoktur**, `package.json`'da `main`/`exports` yoktur. `@dimforge/rapier3d-compat` ise WASM'ı base64 olarak bundle'ın içine gömer, `await RAPIER.init()` ister, her ortamda çözümlenir.
2. Base64 vergisi matematiktir: 3 bayt → 4 karakter, tam %33,3. Ölçtüm, `-compat`'ın `rapier.mjs`'inin %93'ü tek bir base64 bloğu.
3. Gzip bu vergiyi silmiyor, büyütüyor. Ham fark %27,6, gzip'li fark %34,4 — base64 DEFLATE'in yakaladığı bayt örüntülerini bozuyor.
4. Asıl fark önbellekte. Saf ESM'de uygulama kodunu değiştirdiğinde `.wasm` dosyasının hash'i sabit kalır, kullanıcı 182 KB indirir. `-compat`'ta 2,2 MB'ın tamamı yeniden iner.
5. Üç hata sırayla gelir: `vite:wasm-fallback` (eklenti yok) → `Top-level await is not available` (hedef düşük) → `Failed to resolve entry for package` (vitest, `main` alanı yok).
6. TLA hatasının üç çözümünden ikisi saf ESM'de geçerli: `build.target: "esnext"` ya da `vite-plugin-top-level-await`. Async bootstrap fonksiyonu yalnızca `-compat`'ta işe yarar, çünkü orada `await`'i sen yazarsın.
7. Eklenti sırası `[wasm(), topLevelAwait()]`; tersi sessizce çalışmaz. `topLevelAwait()`'in ölçülen bedeli ~73 KB.
8. Dev ile build farklıdır. `optimizeDeps.exclude` koymazsan Vite'ın dep optimizer'ı WASM'ı base64'e gömer ve dev'de fiilen `-compat` davranışı alırsın.
9. `assetsInlineLimit` 1,5 MB'ın üstüne çıkarsa `.wasm` inline edilir ve bütün kazanç uçar — hatta `-compat`'tan 39 KB daha büyük bir dosya elde edersin.
10. Fizik adımını render karesinden ayır. Accumulator + `maxStepsPerFrame` freni olmadan 144 Hz'lik ekranda oyun hızlanır, arka plandan dönen sekmede cisimler duvardan geçer.
11. Kurulumu ölç, "çalışıyor gibi" deme: `version()`, f32'ye yuvarlanan `timestep`, ağ sekmesindeki `.wasm` kaydı ve iki özdeş dünyanın bit-bit aynı sonucu.
12. Vitest için saf ESM paketine `test.alias` gerekir ve TypeScript'te `moduleResolution: "bundler"`. `server.deps.inline` tek başına yetmiyor.

Depoda `npm test` bütün fizik katmanını tarayıcısız doğruluyor — 4 dosya, 17 test —, `npm run size` yukarıdaki bayt tablosunu senin makinende yeniden üretiyor, `npm run dev` de sana zemine dökülen yirmi dört kutuyu gösteriyor.

Bu yazıyı yazarken beklemediğim şey şu oldu: iki paket arasındaki seçim bir "kolay yol / doğru yol" ikilemi değilmiş. Kurulum çilesini ödemenin gerçek karşılığı bundle boyutu değil — o 484 kilobayt, gzip'ten sonra 212 kilobayta iniyor ve tek seferlik. Asıl karşılık, motorun kılavuzdan ayrı bir kasada durması. Kullanıcı senin oyununu ikinci kez açtığında motoru zaten indirmiş oluyor; sen o hafta kaç kez deploy etmiş olursan ol.

Yani mesele boyut değil, sahiplik. Motoru kılavuzun sayfalarına dökersen artık ayrı bir nesne değildir; her düzeltmede onu da yeniden yazarsın. Ayrı tutarsan bir kere teslim edilir ve orada durur. ⚙️
