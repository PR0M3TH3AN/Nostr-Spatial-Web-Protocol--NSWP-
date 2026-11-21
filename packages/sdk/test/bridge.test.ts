import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const src = (file: string) => readFileSync(join(here, "..", "src", file), "utf8");
const root = join(here, "..", "..", "..");

// A browser made for this takes a door itself (browser/spec.md). What the kit hands it, and what it never looks
// for on it, are a line the owner drew: these fail if someone moves it without meaning to.
describe("the bridge a browser may offer (window.nswp)", () => {
  const index = src("index.ts");

  it("is found by asking, and handed the door and what the visitor carries", () => {
    expect(index).toContain('typeof window.nswp?.navigate === "function"');
    expect(index).toContain("window.nswp.navigate(dest, carried(opts, immersive));");
    // Asked before the headset session is ended: when that ends is the browser's to manage.
    expect(index.indexOf("window.nswp.navigate(dest, carried(")).toBeLessThan(index.indexOf("await opts.xrSession.end()"));
    // The destination is checked first, whoever takes the door.
    expect(index.indexOf("checkDestination(dest.url)")).toBeLessThan(index.indexOf("window.nswp.navigate(dest, carried("));
  });

  it("has no identity and nothing that pays on it, anywhere in the kit", () => {
    const declared = /nswp\?: \{([^}]*)\}/.exec(index)?.[1] ?? "";
    expect(declared).toContain("navigate?:");
    expect(declared).toContain("can?:");
    expect(declared).not.toMatch(/identity|sign|pass|pay|tip|buy|have|wallet|receipt/i);
    // Nothing in the kit reaches for a browser to sign, pay or say what is held: that is the sign-in address's.
    for (const file of ["index.ts", "signer.ts", "room-controls.ts", "client-frame.ts", "ui/identity.ts"]) {
      expect(src(file), file).not.toMatch(/window\.nswp\??\.(identity|sign|pass|pay|tip|buy|have|wallet)/);
    }
  });

  it("is written down the same way in the browser's plan", () => {
    const plan = readFileSync(join(root, "browser", "spec.md"), "utf8");
    expect(plan).toContain("## 2a. What the browser never contains");
    expect(plan).toContain("`nswp.navigate(destination, carried)`");
    expect(plan).not.toMatch(/identity\.pubkey\(\)|`sign\(template\)`/);
  });
});
