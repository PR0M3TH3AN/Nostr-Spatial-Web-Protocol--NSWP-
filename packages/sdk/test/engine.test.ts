import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES, categoryWords } from "@nswp/core";
import { describe, expect, it } from "vitest";
import { check, kit } from "../src/engine-menu.js";
import { LOOK_SPEED, PITCH_LIMIT, SPRINT } from "../src/fps.js";
import { PORTAL_HEIGHT, PORTAL_WIDTH } from "../src/gate-size.js";
import { CUES } from "../src/sound-store.js";
import { DRAG_LOOK, LEVEL_RATE, TAP_REACH, TILT_LIMIT, WALK_SPEED } from "../src/stroll.js";

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
    // How far a drag tilts the view moving the casual way, and how fast it comes back level: the addon's copy is the same.
    expect(k.tiltLimit).toBe(TILT_LIMIT);
    expect(k.levelRate).toBe(LEVEL_RATE);
    expect(godot("nswp.gd")).toContain(`"tiltLimit": ${k.tiltLimit}`);
    expect(godot("nswp.gd")).toContain(`"levelRate": ${k.levelRate}`);
    // How many places an entry point needs, and the least room between people: the addon's copy is the same.
    expect([k.entryPlacesLeast, k.entryPlacesRooms, k.entryClear]).toEqual([4, 8, 1]);
    for (const n of ["entryPlacesLeast", "entryPlacesRooms", "entryClear"]) expect(godot("nswp.gd")).toContain(`"${n}": ${k[n]}`);
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

  it("gives a paid world's gate as text, and makes nothing for a world that says it isn't paid", async () => {
    const { gate } = await import("../src/engine-menu.js");
    // A world that isn't paid: free and open, with no gate made, nothing read and nobody asked.
    expect(JSON.parse(gate('{"paid":false}'))).toEqual({ state: "free", open: true, reason: "", why: "", offers: [], until: null });
    // The script hands it on, and says it changed what its functions give.
    const engine = await import("../src/engine.js");
    expect(typeof engine.gate).toBe("function");
    expect(engine.VERSION).toBe(17);
  });

  it("has the Godot addon take the gate from the kit's script, and open it outside a browser only in the editor", () => {
    const addon = godot("nswp.gd");
    expect(addon).toMatch(/^signal gate_changed\(gate: Dictionary\)$/m);
    expect(addon).toMatch(/^func gate\(paid: bool = true\) -> Dictionary:$/m);
    expect(addon).toContain(`_js.gate(JSON.stringify({"paid": paid}))`);
    expect(addon).toMatch(/^func gate_open\(\) -> bool:\n\treturn gate_now.get\("open", false\) == true$/m);
    expect(addon).toContain(`return run("gate-buy")`);
    // The answer it acts on is the kit's: the addon checks no receipt and reads no listing itself.
    expect(addon).not.toMatch(/readReceipt|readListing|30078|RECEIPT_ISSUERS/);
    // Outside a browser: open only for the world's maker in the editor, never in an export.
    expect(addon).toContain(`var making := OS.has_feature("editor")`);
    // An answer that can't be read is not a yes.
    expect(addon).toMatch(/elif paid:\n\t\t# An answer that can't be read is not a yes\.\n\t\tgate_now = \{"state": "shut", "open": false/);
  });

  it("keeps the Godot example free and without lists: its code says it needs no gate, as its world.json does", () => {
    const main = readFileSync(join(root, "engines", "godot", "example", "main.gd"), "utf8");
    expect(main).toMatch(/^const NEEDS_GATE := false$/m);
    expect(main).toContain("Nswp.gate(NEEDS_GATE)");
    const world = JSON.parse(readFileSync(join(root, "engines", "godot", "world.json"), "utf8")) as Record<string, unknown>;
    for (const word of ["access", "keepers", "named_only", "by_invitation"]) expect(world[word], word).toBeUndefined();
  });

  it("says in Godot, too, that the world is still loading once the visitor is in: loading(1.0) ends it", () => {
    expect(godot("nswp.gd")).toMatch(/^func loading\(fraction: float, words: String = ""\) -> void:\n\tif _js != null:\n\t\t_js\.loading\(fraction, words\)$/m);
  });

  it("never names a function in the Godot addon as one of its signals: Godot won't load the script at all, and the world doesn't start", () => {
    // Found by a scripted browser, 2026-11-22: a new func loaded() beside the signal loaded stopped the Foundry starting.
    for (const file of ["nswp.gd", "nswp_visitor.gd"]) {
      const text = godot(file);
      const signals = [...text.matchAll(/^signal (\w+)/gm)].map((m) => m[1]);
      const funcs = [...text.matchAll(/^func (\w+)/gm)].map((m) => m[1]);
      expect(signals.filter((name) => funcs.includes(name)), file).toEqual([]);
    }
  });

  it("gives a jump the kit's own sound in Godot too: the visitor asks the script, and plays no cue of its own", () => {
    expect(godot("nswp.gd")).toMatch(/^func jumped\(\) -> void:\n\tif _js != null:\n\t\t_js.jumped\(\)$/m);
    const visitor = godot("nswp_visitor.gd");
    expect(visitor).toContain("Nswp.jumped()");
    expect(visitor).not.toMatch(/func jump\(\)[\s\S]*?Nswp\.play\("step"\)[\s\S]*?\n\n/);
  });

  it("reads a door's address the way a sign should show it", () => {
    expect(JSON.parse(check("https://gallery.bitblocks.network/"))).toMatchObject({ ok: true, domain: "bitblocks.network", prefix: "gallery." });
    expect(JSON.parse(check("http://gallery.bitblocks.network/"))).toMatchObject({ ok: false, code: "url_not_https" });
    expect(JSON.parse(check(undefined as unknown as string))).toMatchObject({ ok: false });
  });
});

describe("one frame for everything an engine draws", () => {
  it("says nothing until some part has something to draw, then gives each part's share", async () => {
    const world = await import("../src/engine-world.js");
    expect(world.frame("{}")).toBe("{}");
    const w = world.engineWorld();
    world.addFramePart((said, dt) => ({ heard: said.word ?? null, dt }));
    world.addFramePart(() => ({ more: 1 }));
    const out = JSON.parse(world.frame(JSON.stringify({ head: [1, 1.6, 2], turn: [0, 0, 0, 1], floor: 0, dt: 0.02, word: "hello" })));
    expect(out).toEqual({ heard: "hello", dt: 0.02, more: 1 });
    // The visitor's view is where the engine said, and they stand under it on the floor.
    expect(w.camera.position.toArray()).toEqual([1, 1.6, 2]);
    expect(w.rig.position.toArray()).toEqual([1, 0, 2]);
  });
  it("tells the engine when the kit has moved its visitor, once, and never of its own placing", async () => {
    const world = await import("../src/engine-world.js");
    const w = world.engineWorld();
    const at = (x: number, z: number) => JSON.parse(world.frame(JSON.stringify({ head: [x, 1.6, z], turn: [0, 0, 0, 1], floor: 0 })));
    at(0, 0);
    expect(at(3, 4).nudge).toBeUndefined();
    // Two people arrived in the same spot: the kit steps this one aside between frames.
    w.rig.position.x += 0.5;
    w.rig.position.z -= 0.25;
    const told = at(3, 4).nudge as number[];
    expect(told[0]).toBeCloseTo(0.5, 6);
    expect(told[1]).toBeCloseTo(-0.25, 6);
    expect(at(3.5, 3.75).nudge).toBeUndefined();
  });
  it("takes nothing that isn't a number for a place, and keeps what it sees within reason", async () => {
    const world = await import("../src/engine-world.js");
    const w = world.engineWorld();
    world.frame(JSON.stringify({ head: [1, 2, 3], turn: [0, 0, 0, 1], fov: 70 }));
    world.frame(JSON.stringify({ head: ["x", null, {}], turn: "round", fov: 9999, aspect: -3, dt: "soon" }));
    expect(w.camera.position.toArray()).toEqual([1, 2, 3]);
    expect(w.camera.fov).toBe(140);
    expect(w.camera.aspect).toBe(0.1);
    expect(() => world.frame("not json")).not.toThrow();
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
    expect(engine.VERSION).toBe(17);
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
