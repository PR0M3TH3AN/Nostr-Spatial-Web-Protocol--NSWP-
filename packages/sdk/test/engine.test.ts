import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES, categoryWords } from "@nswp/core";
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
    // The fastest anyone goes on foot, for an engine to keep to: a run.
    expect(k.topSpeed).toBeCloseTo(WALK_SPEED * SPRINT, 9);
    expect(godot("nswp.gd")).toContain(`"topSpeed": ${k.topSpeed}`);
    expect(k.cues).toEqual([...CUES]);
  });

  it("has the same words for each kind of place on the Godot doorway's sign", () => {
    const block = /const CATEGORY_WORDS := \{([\s\S]*?)\n\}/.exec(godot("nswp_gate.gd"))?.[1] ?? "";
    const written = Object.fromEntries([...block.matchAll(/"(\w+)":\s*"([^"]+)",/g)].map((m) => [m[1]!, m[2]!]));
    expect(written).toEqual(Object.fromEntries(CATEGORIES.map((c) => [c, categoryWords(c)])));
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

describe("crossing into a world made in another engine", () => {
  const src = (file: string) => readFileSync(join(root, "packages", "sdk", "src", file), "utf8");
  it("has no room where there is no page, and says so plainly", async () => {
    const engine = await import("../src/engine.js");
    expect(engine.crossing()).toBe("none");
    // Nothing to open, fill or fail: none of these throws for want of a page.
    expect(() => {
      engine.loading(0.5);
      engine.ready();
      engine.failed("no");
    }).not.toThrow();
    expect(engine.VERSION).toBe(10);
  });
  it("says who the visitor is as plain fields, and a guest where nobody is signed in", async () => {
    const { who } = await import("../src/engine-menu.js");
    expect(JSON.parse(who())).toEqual({ guest: true, name: "", pubkey: "", picture: "", about: "" });
  });
  it("keeps and gives back a world's save as events, and says plainly when nothing could be kept", async () => {
    const { save, load, events } = await import("../src/engine-menu.js");
    events();
    save('{"level":2}');
    load("run-2");
    await new Promise((done) => setTimeout(done, 20));
    const said = JSON.parse(events()) as { type: string; slot: string; kept?: string; found?: boolean }[];
    // No browser here, so nowhere to keep it: the engine is told so, and never left waiting.
    expect(said.find((e) => e.type === "saved")).toMatchObject({ slot: "main", kept: "nowhere" });
    expect(said.find((e) => e.type === "loaded")).toMatchObject({ slot: "run-2", found: false });
    // The Godot addon has both, by the names its docs give.
    expect(godot("nswp.gd")).toMatch(/func save\(data: String, slot: String = "main"\)/);
    expect(godot("nswp.gd")).toMatch(/func load_save\(slot: String = "main"\)/);
  });
  it("draws the room as the page, with nothing in it to press and nothing that claims a check", () => {
    const room = src("engine-crossing.ts");
    // Words are set as text, never as markup.
    expect(room).not.toMatch(/innerHTML|insertAdjacentHTML|outerHTML/);
    // No control of any kind, and no word that would stand in for the Airlock's check.
    expect(room).not.toMatch(/createElement\("(button|a|input|form)"\)|el\("(button|a|input|form)"/);
    expect(room.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/[`"'][^`"']*\bverified\b[^`"']*[`"']/i);
  });
  it("brings the room up before a visitor leaves by any way out, and names a sign-in address's row over the old one", () => {
    const engine = src("engine.ts");
    for (const way of ["portal.go(dest, st)", "portal.home(st)", "portal.doors(st)"]) expect(engine).toContain(`leaveThen(`), expect(engine).toContain(way);
    const menu = src("engine-menu.ts");
    expect(menu).toContain("signerAction(c,");
    expect(menu).toContain("hidden: () => signerNamed()");
  });
  it("gives Godot a page with no loading screen of the engine's, and nothing run from the page itself", () => {
    const shell = godot("web/shell.html");
    expect(shell).not.toMatch(/status-splash|status-progress|\$GODOT_SPLASH/);
    // Every script on it is a file, or data: no script is written into the page.
    const scripts = [...shell.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
    expect(scripts.length).toBe(4);
    for (const [, attrs, body] of scripts) expect(/\bsrc=/.test(attrs!) || /type="application\/json"/.test(attrs!), `${attrs} ${body!.slice(0, 40)}`).toBe(true);
    // The world's own tags come before the kit's script, so the room wears its name and colour from the start.
    expect(shell.indexOf("$GODOT_HEAD_INCLUDE")).toBeLessThan(shell.indexOf('src="nswp-engine.js"'));
    expect(godot("web/nswp-godot.js")).toContain("room.loading(");
    expect(readFileSync(join(root, "engines", "godot", "export_presets.cfg"), "utf8")).toContain('html/custom_html_shell="res://addons/nswp/web/shell.html"');
  });
  it("has the Godot visitor walk a pressed-out path at the kit's numbers", () => {
    const k = JSON.parse(kit());
    expect(k.pathMost).toBe(12);
    expect(k.faceRate).toBeCloseTo(2.8, 9);
    const visitor = godot("nswp_visitor.gd");
    expect(visitor).toContain("_path.append(next)");
    expect(visitor).toContain('Nswp.kit.get("faceRate"');
  });
});
