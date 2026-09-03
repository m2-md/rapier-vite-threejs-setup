import { describe, expect, it } from "vitest";
import { FixedStepper } from "../src/stepper";

describe("FixedStepper", () => {
  it("exact single dt yields one step", () => {
    expect(new FixedStepper(1 / 60).advance(1 / 60)).toBe(1);
  });

  it("half dt yields zero steps, remainder is accumulated", () => {
    const s = new FixedStepper(1 / 60);
    expect(s.advance(1 / 120)).toBe(0);
    expect(s.advance(1 / 120)).toBe(1); // two halves = one whole
  });

  it("8-second giant frame does not trigger spiral of death", () => {
    const s = new FixedStepper(1 / 60, 5);
    expect(s.advance(8)).toBe(5); // clamped to ceiling
  });

  it("alpha yields the ratio between two steps", () => {
    const s = new FixedStepper(1 / 60);
    s.advance(1 / 60 + 1 / 240); // one full step + one quarter
    expect(s.alpha).toBeCloseTo(0.25, 5);
  });
});
