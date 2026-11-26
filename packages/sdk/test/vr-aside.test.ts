import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Out of VR for a moment (ui/vr-aside.ts), kept rare. The owner, 2026-11-25: "the only thing that should force us
 * out of VR is the initial phone pairing and the browsers immurrsive VR site to site limitation". So this reads the
 * kit's own source: nothing still tells a visitor to leave the headset by hand, every way out is `outOfVr` for one of
 * the few reasons, and the places that do it are exactly these. A new one fails here until it is added on purpose.
 */
const src = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : f.endsWith(".ts") ? [join(dir, f)] : []));
const sources = files(src).map((f) => ({ file: relative(src, f).replaceAll("\\", "/"), text: readFileSync(f, "utf8") }));

/** Every place the kit goes out of VR, and why. Signing in from a phone is the one the owner means to stay. */
const PLACES = [
  ["console-sheet.ts", "file"],
  ["front-room.ts", "buy"],
  ["room-controls.ts", "allow"],
  ["room-controls.ts", "allow"],
  ["room-controls.ts", "buy"],
  ["ui/identity.ts", "files"],
  ["ui/identity.ts", "secure"],
  ["ui/identity.ts", "sign-in"],
  ["ui/identity.ts", "wallet"],
  ["ui/identity.ts", "wallet"],
];

describe("going out of VR, kept to a few", () => {
  it("is never left to the visitor: no line tells them to leave the headset themselves", () => {
    for (const { file, text } of sources) for (const words of ["Leave the headset view", "leave the headset view", "can't be seen from inside a headset", "Step out of the headset", "can't be seen from in here"]) expect(text.includes(words), `${file}: "${words}"`).toBe(false);
  });

  it("is only ever outOfVr, for one of the few reasons, at exactly these places", async () => {
    const { VR_ASIDE } = await import("../src/ui/vr-aside.js");
    const found: string[][] = [];
    for (const { file, text } of sources) {
      if (file === "ui/vr-aside.ts") continue;
      // The reason is outOfVr's last argument: a string after a comma, then the call's close.
      for (const m of text.matchAll(/outOfVr\([\s\S]*?,\s*"([a-z-]+)",?\s*\)(?=\s*[.;)])/g)) found.push([file, m[1]!]);
    }
    for (const [, why] of found) expect(VR_ASIDE as readonly string[], why).toContain(why);
    expect(found.sort()).toEqual([...PLACES].sort());
    expect([...VR_ASIDE]).toEqual(["sign-in", "secure", "wallet", "files", "buy", "allow", "file"]);
  });

  it("is not reached by what needs no screen of BitLogin's: the family's sign-in, a guest, notes, reactions, the bag", () => {
    // These never open a BitLogin screen, so they have no way out of VR to take: asked of the signer, answered by it.
    for (const file of ["signer.ts", "bag.ts", "bagging.ts", "people.ts", "following.ts", "messaging.ts", "achieving.ts", "scoring.ts"]) {
      const text = sources.find((s) => s.file === file)?.text ?? "";
      expect(text.includes("outOfVr("), file).toBe(false);
    }
  });
});

describe("outOfVr", () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
  });
  afterEach(() => vi.unstubAllGlobals());

  const setUp = async (presenting: boolean) => {
    const { createControls } = await import("../src/ui/model.js");
    const { hostVrAside, outOfVr, VR_ASIDE_WORDS } = await import("../src/ui/vr-aside.js");
    const c = createControls({ title: "A world" });
    const said: string[] = [];
    c.onSay((t) => said.push(t));
    const order: string[] = [];
    const host = { presenting: () => presenting, end: vi.fn(async () => void order.push("end")), back: vi.fn(() => void order.push("back")), openFromHere: vi.fn(() => void order.push("open from here")) };
    hostVrAside(c, host);
    return { c, said, order, host, outOfVr, VR_ASIDE_WORDS };
  };

  it("just opens, out of a headset", async () => {
    const k = await setUp(false);
    const open = vi.fn(() => ({ shown: true, gone: Promise.resolve() }));
    k.outOfVr(k.c, open, "files");
    expect(open).toHaveBeenCalledTimes(1);
    expect([k.said, k.host.end.mock.calls.length]).toEqual([[], 0]);
  });

  it("in one: opens in the press, then ends the session, then puts up Back into VR; told once on this device", async () => {
    const k = await setUp(true);
    const gone = Promise.resolve();
    const open = vi.fn(() => (k.order.push("open"), { shown: true, gone }));
    k.outOfVr(k.c, open, "sign-in");
    await new Promise((ok) => setTimeout(ok, 0));
    expect(k.order).toEqual(["open", "end", "back"]);
    expect(k.host.back).toHaveBeenCalledWith(gone);
    expect(k.said).toEqual([k.VR_ASIDE_WORDS]);
    expect(store.get("nswp:vr-aside-told")).toBe("1");
    k.outOfVr(k.c, open, "wallet");
    expect(k.said).toEqual([k.VR_ASIDE_WORDS]);
  });

  it("where the browser refused the window from inside VR, offers one press on the flat page instead", async () => {
    const k = await setUp(true);
    k.outOfVr(k.c, () => ({ shown: false, gone: Promise.resolve() }), "sign-in");
    await new Promise((ok) => setTimeout(ok, 0));
    expect(k.order).toEqual(["end", "open from here"]);
  });

  it("refuses a reason that isn't one of the few", async () => {
    const k = await setUp(true);
    expect(() => k.outOfVr(k.c, () => ({ shown: true, gone: Promise.resolve() }), "anything" as never)).toThrow(/not one of VR_ASIDE/);
  });
});
