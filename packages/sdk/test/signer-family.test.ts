import { getPublicKey, readSignerReply, readSignerRequest, signerMessage } from "@nswp/core";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * One sign-in for a world's whole family (BitLogin's `family`): the owner, 2026-11-25, "the logged in users signing
 * doesent seem to be working across worlds ... These logins should carry. especialy when on the same domain." The
 * world asks, before the first sign-in, for every world under its own registrable domain; the signer says in its
 * state whether it took it. The signer here is a stand-in: a frame that keeps what it was sent, and is made to answer.
 */
const SIGN_IN = "https://signin.example";
const me = getPublicKey(sha256(utf8ToBytes("nswp family test key")));

type Signer = import("../src/signer.js").WorldSigner;
let hear: (e: { source: unknown; origin: string; data: unknown }) => void = () => {};
let frameWindow: { postMessage: ReturnType<typeof vi.fn> };

const sentTo = () => frameWindow.postMessage.mock.calls.map((c) => c[0] as { t: string; id: string; family?: string; more?: unknown });
const say = (reply: Parameters<typeof signerMessage>[0]) => hear({ source: frameWindow, origin: SIGN_IN, data: signerMessage(reply) });

/** A world at `world`, with its signer made and ready. */
const at = async (world: string): Promise<Signer> => {
  vi.resetModules();
  vi.useFakeTimers();
  frameWindow = { postMessage: vi.fn() };
  const frame = { contentWindow: frameWindow, style: {}, setAttribute: () => {}, addEventListener: () => {}, remove: () => {} };
  const self = { open: vi.fn(() => ({})) } as unknown as Window & { parent: unknown };
  self.parent = self;
  vi.stubGlobal("window", self);
  vi.stubGlobal("document", { createElement: () => frame, body: { append: () => {} } });
  vi.stubGlobal("location", { origin: world, search: "", pathname: "/" });
  vi.stubGlobal("addEventListener", (type: string, fn: typeof hear) => {
    if (type === "message") hear = fn;
  });
  const { createWorldSigner } = await import("../src/signer.js");
  const signer = createWorldSigner({ at: { signer: `${SIGN_IN}/signer/`, window: `${SIGN_IN}/connect/` } } as Parameters<typeof createWorldSigner>[0]);
  await vi.advanceTimersByTimeAsync(0);
  say({ t: "ready" });
  return signer;
};
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("one sign-in for a world's whole family", () => {
  it("is asked for once, before the first sign-in: every world under its own registrable domain", async () => {
    await at("https://arcade.bitblocks.network");
    const asked = sentTo().filter((m) => m.t === "want");
    expect(asked.map((m) => m.family)).toEqual(["https://*.bitblocks.network"]);
    // Before the state is asked, and with nothing else in it.
    const order = sentTo().map((m) => m.t);
    expect(order.indexOf("want")).toBeLessThan(order.indexOf("state"));
    expect(asked[0]!.more).toBeUndefined();
    // Ready again (the signer's frame came back): not asked twice.
    say({ t: "ready" });
    expect(sentTo().filter((m) => m.t === "want")).toHaveLength(1);
  });

  it("is said by the signer: taken, not taken, or nothing said, which is not offered", async () => {
    const taken = await at("https://arcade.bitblocks.network");
    expect(taken.family).toBeNull();
    say({ t: "state", unlocked: true, pubkey: me, familyTaken: true });
    expect(taken.family).toBe(true);

    const notTaken = await at("https://arcade.bitblocks.network");
    say({ t: "state", unlocked: true, pubkey: me, familyTaken: false });
    expect(notTaken.family).toBe(false);

    // An older signer: no word of it in its state.
    const older = await at("https://arcade.bitblocks.network");
    say({ t: "state", unlocked: true, pubkey: me });
    expect(older.family).toBeNull();
  });

  it("isn't asked for by a page with no registrable domain of its own, or not on https", async () => {
    for (const world of ["https://192.168.68.84:5401", "http://arcade.bitblocks.network"]) {
      await at(world);
      expect(sentTo().filter((m) => m.t === "want"), world).toEqual([]);
    }
  });

  it("is read by a signer as its form exactly, and the answer only as true or false", () => {
    expect(readSignerRequest(signerMessage({ t: "want", id: "w1", family: "https://*.bitblocks.network" }))).toEqual({ t: "want", id: "w1", family: "https://*.bitblocks.network" });
    for (const bad of ["https://bitblocks.network", "http://*.bitblocks.network", "https://*.com", "https://*.Bitblocks.network", "https://*.bitblocks.network/x"])
      expect(readSignerRequest(signerMessage({ t: "want", id: "w1", family: bad })), bad).toBeNull();
    // Asking for more, as before, still reads.
    expect(readSignerRequest(signerMessage({ t: "want", id: "w2", more: ["follows"] }))).toEqual({ t: "want", id: "w2", more: ["follows"] });
    expect((readSignerReply(signerMessage({ t: "state", unlocked: false, familyTaken: true })) as { familyTaken?: boolean }).familyTaken).toBe(true);
    expect((readSignerReply(signerMessage({ t: "state", unlocked: false, familyTaken: "yes" } as never)) as { familyTaken?: boolean }).familyTaken).toBeUndefined();
  });
});
