import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";

/**
 * The kit's entries, and which of them load the renderer.
 *
 * A page that only draws the visitor's menu, or runs their Bag, must not load Three.js to do it: a client's page
 * above a world has no use for a renderer. An entry "names the renderer" if any file it reaches imports it, used or
 * not: a bundler may leave an unused import out, but a page that loads the kit's files as they are loads all of it.
 * (On 2026-11-23 a real client found `nswp-sdk/menu` did, through one small function kept in a file that drew, and
 * that the Bag's parts could be had from no entry without it.)
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const sdk = join(root, "packages", "sdk");
const exportsOf = (JSON.parse(readFileSync(join(sdk, "package.json"), "utf8")) as { exports: Record<string, string> }).exports;

/** Every file an entry reaches that imports Three.js, by its path from the kit's `src`. */
async function namesRenderer(file: string): Promise<string[]> {
  const built = await build({ entryPoints: [file], bundle: true, format: "esm", target: "es2022", write: false, metafile: true, logLevel: "silent", external: ["three", "three/*"], absWorkingDir: root });
  return Object.entries(built.metafile.inputs)
    .filter(([, input]) => input.imports.some((i) => i.external && /^three(\/|$)/.test(i.path)))
    .map(([path]) => path.replace(/^packages\/sdk\/src\//, ""))
    .sort();
}

describe("the kit's entries", () => {
  it("are these, each a file of the kit's own", () => {
    expect(Object.keys(exportsOf)).toEqual([".", "./three", "./home", "./ui", "./menu", "./menu-above", "./bag", "./terminal"]);
  });

  for (const entry of [".", "./ui", "./menu", "./menu-above", "./bag"]) {
    it(`${entry === "." ? "nswp-sdk" : `nswp-sdk/${entry.slice(2)}`} names no renderer: nothing it reaches imports Three.js`, async () => {
      expect(await namesRenderer(join(sdk, exportsOf[entry]!))).toEqual([]);
    }, 60000);
  }

  it("and the check sees one where there is one: nswp-sdk/three does", async () => {
    const found = await namesRenderer(join(sdk, exportsOf["./three"]!));
    expect(found).toContain("item-preview.ts");
    expect(found).toContain("library.ts");
    expect(found).toContain("play.ts");
  }, 60000);

  it("hands the Bag's parts on from nswp-sdk/bag, and from nswp-sdk/three as before", async () => {
    const bag = await import("../src/bag-entry.js");
    expect([typeof bag.createBag, typeof bag.addBagControls, typeof bag.mayHold, typeof bag.scriptAllowed]).toEqual(["function", "function", "function", "function"]);
    // What looks an item up, which the Bag can't be built without: the very one a world's own store is.
    expect(bag.createItemStore).toBe((await import("../src/item-store.js")).createItemStore);
    const store = bag.createItemStore({ query: async () => ({ events: [], relays: {} }), viewer: () => null });
    expect([typeof store.known, typeof store.describe]).toEqual(["function", "function"]);
    const play = readFileSync(join(sdk, "src", "play.ts"), "utf8");
    expect(play).toMatch(/export \{ allowScript, mayHold, scriptAllowed \};/);
    const three = readFileSync(join(sdk, "src", "three.ts"), "utf8");
    expect(three).toMatch(/export \{ allowScript, createPlay, mayHold, paintHealth, scriptAllowed,/);
    expect(three).toMatch(/export \{ addBagControls \} from "\.\/bag-pictures\.js";/);
    expect(readFileSync(join(sdk, "src", "library.ts"), "utf8")).toMatch(/export \{ fileStore \};/);
  });

  it("hands on from nswp-sdk/three the kit's way out of VR for a moment, for a world's own presses", () => {
    const three = readFileSync(join(sdk, "src", "three.ts"), "utf8");
    expect(three).toMatch(/export \{ outOfVr, whenWindowGone, type Opened, type VrAsideWhy \} from "\.\/ui\/vr-aside\.js";/);
  });

  it("hands on from nswp-sdk/three what makes an item's picture, under the names it has in the source", async () => {
    // A client's page draws the Bag's things with the kit's own code, so a thing looks the same there as in a
    // world's Bag (asked by the orchestrator for BitPortal, 2026-11-24). Until then no entry handed it on.
    const three = readFileSync(join(sdk, "src", "three.ts"), "utf8");
    expect(three).toMatch(/export \{ createItemPreviews, type ItemPreviews, type ItemPreviewsOptions \} from "\.\/item-preview\.js";/);
    // And it is the one the Bag's own pictures are made with: the same function, not a copy.
    const source = await import("../src/item-preview.js");
    expect(typeof source.createItemPreviews).toBe("function");
    expect(readFileSync(join(sdk, "src", "bag-pictures.ts"), "utf8")).toMatch(/import \{ createItemPreviews \} from "\.\/item-preview\.js";/);
    // The entry without a renderer still hands on only the type: making a picture needs one.
    const bag = readFileSync(join(sdk, "src", "bag-entry.ts"), "utf8");
    expect(bag).toMatch(/export type \{ ItemPreviews \} from "\.\/item-preview\.js";/);
    expect(bag).not.toMatch(/createItemPreviews/);
  });

  it("hands on from nswp-sdk/menu what a client's page needs beside the menu", async () => {
    const menu = readFileSync(join(sdk, "src", "menu.ts"), "utf8");
    for (const name of ["arriveWith", "changeSettings", "currentSettings", "fullscreenAction", "watchEscape", "portBelow", "mountMenu", "addSoundControls", "createSounds"]) expect(menu, name).toMatch(new RegExp(`\\b${name}\\b`));
  });
});

describe("the stand-in client", () => {
  const main = join(root, "trials", "stand-in-client", "main.ts");
  it("loads the kit only by its entries, as a client with a copy of the kit would: never by a path into it", () => {
    const from = [...readFileSync(main, "utf8").matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]!);
    expect(from.length).toBeGreaterThan(2);
    expect(from.filter((f) => f.includes("packages/"))).toEqual([]);
    expect(from.filter((f) => f.startsWith("nswp-sdk") || f.startsWith("@nswp/")).sort()).toEqual(["nswp-sdk/bag", "nswp-sdk/menu", "nswp-sdk/ui"]);
    // Its Bag is given nothing about any item: what an item is comes from the kit's store, by the item's address.
    expect(from.filter((f) => f.endsWith(".json"))).toEqual([]);
  });

  it("names no renderer, with the menu, Sound and the Bag in it", async () => {
    expect(await namesRenderer(main)).toEqual([]);
  }, 60000);
});
