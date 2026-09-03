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
