import type { Sim } from "../sim";

/**
 * Tek tuş: R = kutuları yeniden düşür. Otomatik süpürme, sonsuz spawn ya da
 * arka planda koşan ölçüm YOK — her ölçüm elle tetiklenir (A tuşu HUD'da).
 */
export function bindControls(sim: Sim): void {
  // Başlangıç transformları bind anında okunur; createSim'deki yerleşim
  // matematiği burada TEKRARLANMIYOR, olduğu gibi kopyalanıyor.
  const start = sim.bodies.map((body) => ({
    t: body.translation(),
    r: body.rotation(),
  }));

  const zero = { x: 0, y: 0, z: 0 };

  window.addEventListener("keydown", (event) => {
    if (event.code !== "KeyR") return;
    sim.bodies.forEach((body, i) => {
      body.setTranslation(start[i].t, true);
      body.setRotation(start[i].r, true);
      body.setLinvel(zero, true);
      body.setAngvel(zero, true);
    });
  });
}
