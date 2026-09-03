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
