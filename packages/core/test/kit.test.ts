import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { kitAge, KIT_VERSION, parseKitVersion, parseManifest } from "../src/index.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const manifest = (extra: Record<string, unknown> = {}) => ({ schema: "nswp/manifest/0.3", publishers: { ["a".repeat(64)]: { worlds: ["w"] } }, worlds: { w: { entry: { url: "https://w.example/", modes: ["inline-3d"] } } }, ...extra });

describe("the kit's version", () => {
  it("is the spec's: the newest heading in the changelog", () => {
    const newest = /^## (\d+\.\d+\.\d+)$/m.exec(readFileSync(`${root}CHANGELOG.md`, "utf8"))?.[1];
    expect(KIT_VERSION).toBe(newest);
  });

  it("is written into the engine script and the Godot addon's copy of it, so one build can't say two things", () => {
    for (const file of ["engines/nswp-engine.js", "engines/godot/addons/nswp/web/nswp-engine.js"]) expect(readFileSync(`${root}${file}`, "utf8")).toContain(`"${KIT_VERSION}"`);
  });

  it("reads three numbers and nothing else", () => {
    expect(parseKitVersion("0.21.0")).toEqual([0, 21, 0]);
    for (const bad of ["0.21", "v0.21.0", "0.21.0-beta", "latest", "", 21, null, "1.2.3.4", "99999.1.1"]) expect(parseKitVersion(bad)).toBeNull();
  });

  it("says how a world's kit stands beside a reader's, and never minds a fix", () => {
    expect(kitAge("0.21.0", "0.21.0")).toBe("same");
    expect(kitAge("0.21.7", "0.21.0")).toBe("same");
    expect(kitAge("0.17.5", "0.21.0")).toBe("older");
    expect(kitAge("0.22.0", "0.21.0")).toBe("newer");
    expect(kitAge("1.0.0", "0.21.0")).toBe("newer");
    expect(kitAge(undefined, "0.21.0")).toBe("unknown");
    expect(kitAge("the newest", "0.21.0")).toBe("unknown");
  });
});

describe("a manifest saying which kit its site was built with", () => {
  it("is read when it is a version", () => {
    const r = parseManifest(manifest({ kit: "0.19.0" }));
    expect(r.ok && r.value.kit).toBe("0.19.0");
  });
  it("is left out, with a warning, when it isn't, and the manifest still stands", () => {
    const r = parseManifest(manifest({ kit: "<script>" }));
    expect(r.ok).toBe(true);
    expect(r.ok && r.value.kit).toBeUndefined();
    expect(r.warnings.map((w) => w.path)).toContain("kit");
  });
  it("needn't be there: a world that doesn't say is a world all the same", () => {
    const r = parseManifest(manifest());
    expect(r.ok).toBe(true);
    expect(r.ok && "kit" in r.value).toBe(false);
  });
});
