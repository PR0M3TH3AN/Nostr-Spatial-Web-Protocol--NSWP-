import { describe, expect, it } from "vitest";
import { SAY_STAYS, sayStays } from "../src/ui/model.js";

/** How long words said for a moment stay up (ui/model.ts): longer the longer they are, within limits. */
describe("how long a said line stays", () => {
  it("is four seconds and a little for a short line, as it always was", () => {
    expect(sayStays("Copied.")).toBe(4200);
    expect(sayStays("A picture from The Gallery was saved to this device.")).toBe(4200);
    expect(sayStays("x".repeat(SAY_STAYS.easy))).toBe(4200);
  });

  it("is longer for a longer line, by so much a letter", () => {
    expect(sayStays("x".repeat(61))).toBe(4270);
    // The recording notice, which says that others can see: 87 letters.
    expect(sayStays("Recording, picture only, for up to 30 seconds. Others in the room can see that you are.")).toBe(4200 + 27 * 70);
    expect(sayStays("x".repeat(100))).toBeGreaterThan(sayStays("x".repeat(80)));
  });

  it("is never more than ten seconds, which the kit's longest lines come to", () => {
    expect(sayStays("x".repeat(146))).toBe(10_000);
    expect(sayStays("x".repeat(140))).toBe(4200 + 80 * 70);
    expect(sayStays("x".repeat(5000))).toBe(10_000);
  });

  it("counts letters, not the pieces a letter is stored in", () => {
    expect(sayStays("é".repeat(61))).toBe(sayStays("x".repeat(61)));
    expect(sayStays("😀".repeat(61))).toBe(sayStays("x".repeat(61)));
  });
});
