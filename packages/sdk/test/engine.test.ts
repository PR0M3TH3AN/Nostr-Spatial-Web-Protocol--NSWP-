import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { check, kit } from "../src/engine-menu.js";
import { LOOK_SPEED, PITCH_LIMIT, SPRINT } from "../src/fps.js";
import { PORTAL_HEIGHT, PORTAL_WIDTH } from "../src/gate-size.js";
import { CUES } from "../src/sound-store.js";
import { DRAG_LOOK, TAP_REACH, WALK_SPEED } from "../src/stroll.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const godot = (file: string) => readFileSync(join(root, "engines", "godot", "addons", "nswp", file), "utf8");

describe("what another engine takes from the kit", () => {
  it("gives the kit's own numbers", () => {
    const k = JSON.parse(kit());
    expect(k).toMatchObject({ walkSpeed: WALK_SPEED, tapReach: TAP_REACH, sprint: SPRINT, dragLook: DRAG_LOOK, lookSpeed: LOOK_SPEED, pitchLimit: PITCH_LIMIT, gateWidth: PORTAL_WIDTH, gateHeight: PORTAL_HEIGHT });
    expect(k.gateSpring).toBeCloseTo(PORTAL_HEIGHT - PORTAL_WIDTH / 2, 9);
    expect(k.cues).toEqual([...CUES]);
  });

  it("has the same numbers written into the Godot addon, for where there is no browser", () => {
    const k = JSON.parse(kit()) as Record<string, unknown>;
    const block = /var kit: Dictionary = \{([\s\S]*?)\n\}/.exec(godot("nswp.gd"))?.[1] ?? "";
    const written = Object.fromEntries([...block.matchAll(/"(\w+)":\s*(-?[\d.]+),/g)].map((m) => [m[1]!, Number(m[2])]));
    const numbers = Object.entries(k).filter(([, v]) => typeof v === "number");
    expect(numbers.length).toBeGreaterThan(6);
    for (const [name, value] of numbers) expect(written[name], name).toBeCloseTo(value as number, 9);
  });

  it("keeps the Godot doorway's shaders at the kit's sizes", () => {
    const k = JSON.parse(kit());
    expect(godot("gate/veil.gdshader")).toContain(`uniform vec2 size = vec2(${k.gateWidth}, ${k.gateHeight});`);
    for (const file of ["gate/veil.gdshader", "gate/glow.gdshader"]) expect(godot(file)).toContain(`uniform float spring = ${k.gateSpring};`);
    expect(godot("gate/glow.gdshader")).toContain(`uniform float radius = ${k.gateWidth / 2 + 0.09};`);
  });

  it("reads a door's address the way a sign should show it", () => {
    expect(JSON.parse(check("https://gallery.bitblocks.network/"))).toMatchObject({ ok: true, domain: "bitblocks.network", prefix: "gallery." });
    expect(JSON.parse(check("http://gallery.bitblocks.network/"))).toMatchObject({ ok: false, code: "url_not_https" });
    expect(JSON.parse(check(undefined as unknown as string))).toMatchObject({ ok: false });
  });
});
