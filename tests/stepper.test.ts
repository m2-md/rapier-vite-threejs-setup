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
