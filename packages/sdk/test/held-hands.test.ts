// The kit's held hands (src/held-hands.ts): which controllers get them, which control the thumb is on, and the files
// the kit carries and each built site serves beside its page.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { thumbOn, wantsHeldHands } from "../src/held-hands.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const assets = join(root, "packages", "sdk", "assets", "hands");
const MODELS = ["controller-left.glb", "controller-right.glb", "hand-left.glb", "hand-right.glb"];
const button = (o: { pressed?: boolean; touched?: boolean } = {}) => ({ pressed: !!o.pressed, touched: !!o.touched, value: o.pressed ? 1 : 0 });

describe("which controllers get the held hands", () => {
  it("are a Quest's, by any of the profile ids a headset gives them", () => {
    for (const p of [["meta-quest-touch-plus", "oculus-touch-v3"], ["meta-quest-touch-plus-v2"], ["meta-quest-touch-pro"], ["oculus-touch-v2"], ["oculus-touch-v3", "oculus-touch", "generic-trigger-squeeze-thumbstick"]]) expect(wantsHeldHands(p), p.join()).toBe(true);
  });
  it("and nobody else's: the kit's own drawing is kept for them", () => {
    for (const p of [[], ["valve-index"], ["htc-vive"], ["generic-trigger-squeeze-thumbstick"], ["oculus-hand"], ["pico-4"]]) expect(wantsHeldHands(p), p.join()).toBe(false);
    expect(wantsHeldHands(undefined)).toBe(false);
  });
});

describe("which control the thumb is on", () => {
  it("is A or X below, B or Y above, the stick, the thumb rest, or none, a touch or a press each", () => {
    const pad = (i: number, o: { pressed?: boolean; touched?: boolean }) => Array.from({ length: 7 }, (_, n) => (n === i ? button(o) : button()));
    expect(thumbOn(pad(4, { touched: true }))).toBe("lower");
    expect(thumbOn(pad(5, { pressed: true }))).toBe("upper");
    expect(thumbOn(pad(3, { touched: true }))).toBe("stick");
    expect(thumbOn(pad(6, { touched: true }))).toBe("rest");
    expect(thumbOn(pad(0, { pressed: true }))).toBe("up");
    expect(thumbOn([])).toBe("up");
  });
});

describe("the files", () => {
  it("are the four models, with the controllers' licence and where each comes from", () => {
    for (const f of MODELS) expect(readFileSync(join(assets, f)).subarray(0, 4).toString("latin1"), f).toBe("glTF");
    expect(readFileSync(join(assets, "LICENSE-webxr-input-profiles.md"), "utf8")).toMatch(/^MIT License/);
    const provenance = readFileSync(join(assets, "PROVENANCE.md"), "utf8");
    expect(provenance).toContain("c30f660");
    expect(provenance).toContain("meta-quest-touch-plus");
  });

  const built = readdirSync(join(root, "sites"), { withFileTypes: true })
    // The worlds: the sites that carry the kit's sounds carry its hands beside them (not the Airlock, which is no world).
    .filter((e) => e.isDirectory() && existsSync(join(root, "sites", e.name, "dist", "sounds", "kit")))
    .map((e) => e.name);
  it.skipIf(!built.length)("are served by each built world beside its page, byte for byte, with the licence", () => {
    for (const name of built) {
      const kit = join(root, "sites", name, "dist", "hands", "kit");
      for (const f of [...MODELS, "LICENSE-webxr-input-profiles.md", "PROVENANCE.md"]) expect(existsSync(join(kit, f)), `${name}: ${f}`).toBe(true);
      for (const f of MODELS) expect(readFileSync(join(kit, f)).equals(readFileSync(join(assets, f))), `${name}: ${f}`).toBe(true);
    }
  });
});
