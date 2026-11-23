import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { createControls } from "../src/ui/model.js";
import { portHere } from "../src/ui/port.js";

/**
 * The world's port (ui/port.ts; docs/plans/the-clients-menu.md, step 0): the only way the visitor's menu learns
 * anything of a world or does anything in it. Here, its direct carrier: a world's own controls, as a port.
 */
const src = (file: string) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../src", file), "utf8");

describe("the world's port, over a world's own controls", () => {
  it("is exactly its named members, and nothing else of the controls", () => {
    const port = portHere(createControls({ title: "A world" }));
    expect(Object.keys(port).sort()).toEqual(["chat", "feed", "letters", "onSay", "onSignal", "presence", "run", "say", "setPinned", "signal", "subscribe", "theme", "view"]);
    // What a world does to its controls is not the menu's to do: none of it is on the port.
    for (const name of ["add", "remove", "addSection", "setPresence", "setTheme", "claimInput", "setTarget", "setLoading", "setKeys"]) expect(name in port, name).toBe(false);
  });

  it("gives the menu what to draw, and takes a press back by its id", () => {
    const controls = createControls({ title: "A world", address: "world.example" });
    const pressed = vi.fn();
    controls.add({ id: "wave", section: "travel", label: "Wave", act: pressed });
    const port = portHere(controls);
    const view = port.view();
    expect([view.title, view.address]).toEqual(["A world", "world.example"]);
    expect(view.sections.find((s) => s.id === "travel")?.items.map((i) => i.id)).toEqual(["wave"]);
    expect(port.run("nothing-by-this-name")).toBe(false);
    expect(port.run("wave")).toBe(true);
  });

  it("tells the menu when what it draws may have changed, and what is said; and tells the world what the menu signals", () => {
    const controls = createControls({ title: "A world" });
    const port = portHere(controls);
    const changed = vi.fn();
    const said: string[] = [];
    const heard: string[] = [];
    const stop = port.subscribe(changed);
    port.onSay((text) => said.push(text));
    controls.onSignal((name) => heard.push(name));
    controls.setTarget("A door");
    expect(changed).toHaveBeenCalled();
    controls.say("Saved");
    port.say("Your bar is full.");
    expect(said).toEqual(["Saved", "Your bar is full."]);
    port.signal("menuOpen");
    expect(heard).toEqual(["menuOpen"]);
    stop();
    const before = changed.mock.calls.length;
    controls.setTarget("");
    expect(changed.mock.calls.length).toBe(before);
    // How much room the world gives the menu follows the world.
    controls.setPresence("quiet");
    expect(port.presence).toBe("quiet");
  });

  it("carries plain data, but for the few things listed as not yet words", () => {
    const controls = createControls({ title: "A world" });
    controls.addSection({ id: "bag", label: "Bag", card: () => ({ title: "A mug", tag: "", proven: false, sub: "", copy: "", text: "", picture: "", color: "", now: [], draw: () => null }) });
    controls.add({ id: "mug", section: "bag", kind: "tile", label: "A mug", act: () => {}, picture: () => null });
    const view = portHere(controls).view();
    /** Every place in what is to be drawn that holds something that can't be said in words: a function. */
    const notWords = (value: unknown, at: string): string[] =>
      typeof value === "function" ? [at] : value && typeof value === "object" ? Object.entries(value).flatMap(([k, v]) => notWords(v, at ? `${at}.${k}` : k)) : [];
    const found = notWords({ ...view, chat: undefined, feed: undefined, letters: undefined }, "").map((p) => p.replace(/\.\d+\./g, ".N."));
    expect([...new Set(found)].sort()).toEqual(["sections.N.card.draw", "sections.N.items.N.picture"]);
  });
});

describe("the menu", () => {
  it("is given a port and nothing else: it asks nothing of the controls that the port doesn't carry", () => {
    const hud = src("ui/hud.ts");
    // The menu's own code, without its notes (which name the world's side of things in passing).
    const menu = hud
      .slice(hud.indexOf("export function mountMenu("), hud.indexOf("export function mountHud("))
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");
    const asked = [...new Set([...menu.matchAll(/\bcontrols\.([a-zA-Z]+)/g)].map((m) => m[1]!))].sort();
    expect(asked).toEqual(["chat", "feed", "letters", "onSay", "onSignal", "presence", "run", "say", "setPinned", "signal", "subscribe", "theme", "view"]);
    // And the old name is the direct carrier, no more.
    expect(hud).toContain("return mountMenu(portHere(controls), opts);");
  });

  it("is a file of a world's own build, fetched by the world and not carried in its first file", () => {
    const world = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../sites/shared/world.ts"), "utf8");
    expect(world).toContain('await import("nswp-sdk/menu")');
    // `nswp-sdk/ui` carries the menu with it: a world that imported from there would have the menu in its first file.
    expect(world).not.toMatch(/from "nswp-sdk\/ui"/);
  });
});
