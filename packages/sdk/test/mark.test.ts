import { describe, expect, it } from "vitest";
import { markSvg } from "../src/ui.js";
import { MARK } from "../src/ui/mark.js";
import { DEFAULT_THEME } from "../src/ui/theme.js";

describe("the mark, as a picture", () => {
  it("is the tile and the doorway, in the kit's own colours unless given others", () => {
    const svg = markSvg();
    expect(svg.startsWith("<svg ")).toBe(true);
    expect(svg).toContain(`viewBox="0 0 ${MARK.tile.w} ${MARK.tile.h}"`);
    for (const c of [DEFAULT_THEME.accent, DEFAULT_THEME.ink, DEFAULT_THEME.glass]) expect(svg).toContain(c);
    const green = markSvg({ accent: "#4FD08B" });
    expect(green).toContain("#4fd08b");
    expect(green).not.toContain(DEFAULT_THEME.accent);
  });

  it("is drawn from the mark's own numbers: the arch where the button's is", () => {
    const { arch } = MARK;
    expect(markSvg()).toContain(`M${arch.x + arch.top} ${arch.y}H${arch.x + arch.w - arch.top}`);
  });

  it("takes nothing but a colour into the picture, and can be the doorway alone", () => {
    const odd = markSvg({ accent: 'red"/><script>', ink: "url(x)" });
    expect(odd).not.toContain("script");
    expect(odd).toContain(DEFAULT_THEME.accent);
    const alone = markSvg({ tile: false });
    expect(alone).not.toContain(DEFAULT_THEME.glass);
    expect(alone).toContain(DEFAULT_THEME.accent);
  });
});
