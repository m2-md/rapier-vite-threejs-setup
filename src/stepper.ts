/**
 * Decouples physics steps from render frames. Whether display runs at 30 Hz or 144 Hz,
 * the simulation advances with constant step sizes — prerequisite for determinism.
 */
export class FixedStepper {
  private accumulator = 0;

  constructor(
    /** Fixed physics timestep (seconds). Rapier default is 1/60. */
    readonly dt = 1 / 60,
    /** Maximum steps allowed per single frame — spiral of death brake. */
    readonly maxStepsPerFrame = 5,
  ) {}

  /** Consumes elapsed real time and returns number of physics steps to advance. */
  advance(frameSeconds: number): number {
    // When returning from background tab, frameSeconds can be huge. Without clamping,
    // hundreds of steps would run in a single frame, delaying the next frame further: spiral of death.
    this.accumulator += Math.min(frameSeconds, this.dt * this.maxStepsPerFrame);

    let steps = 0;
    while (this.accumulator >= this.dt) {
      this.accumulator -= this.dt;
      steps++;
    }
    return steps;
  }

  /** Ratio between two physics steps (0..1) — used for render interpolation. */
  get alpha(): number {
    return this.accumulator / this.dt;
  }
}
