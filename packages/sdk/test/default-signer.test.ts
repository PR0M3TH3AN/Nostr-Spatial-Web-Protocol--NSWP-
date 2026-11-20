import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { arrival, configure } from "../src/index.js";

// Signing in is the same however a visitor came (protocol/10-identity.md, "One sign-in"): someone who opened a
// world's address themselves is offered the signer the world names, and someone a client brought is offered
// their client's, whatever the world would have liked.
describe("where a visitor signs in, by how they came", () => {
  let kept: Map<string, string>;
  beforeEach(() => {
    kept = new Map();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (k: string) => kept.get(k) ?? null,
        setItem: (k: string, v: string) => void kept.set(k, v),
        removeItem: (k: string) => void kept.delete(k),
      },
    });
    configure({ defaultSigner: null });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    configure({ defaultSigner: null });
  });

  it("offers nobody a signer where the world names none", () => {
    expect(arrival.signer()).toBeUndefined();
  });

  it("offers the world's own to someone no client brought", () => {
    configure({ defaultSigner: "https://signin.example/" });
    expect(arrival.signer()).toBe("https://signin.example/");
  });

  it("keeps to their client's word for someone a client brought", () => {
    configure({ defaultSigner: "https://signin.example/" });
    kept.set("nswp:return-airlock", "https://client.example/go/");
    kept.set("nswp:signer", "https://theirs.example/");
    expect(arrival.signer()).toBe("https://theirs.example/");
  });

  it("gives a client that named none its own way, not the world's", () => {
    configure({ defaultSigner: "https://signin.example/" });
    kept.set("nswp:return-airlock", "https://client.example/go/");
    expect(arrival.signer()).toBeUndefined();
  });

  it("takes only an https address, and none at all when told so", () => {
    expect(() => configure({ defaultSigner: "http://signin.example/" })).toThrow();
    expect(() => configure({ defaultSigner: "javascript:alert(1)" })).toThrow();
    configure({ defaultSigner: "https://signin.example/" });
    configure({ defaultSigner: "" });
    expect(arrival.signer()).toBeUndefined();
  });

  it("still offers the world's own where the browser keeps nothing for the tab", () => {
    vi.stubGlobal("window", {
      get sessionStorage(): Storage {
        throw new Error("blocked");
      },
    });
    configure({ defaultSigner: "https://signin.example/" });
    expect(arrival.signer()).toBe("https://signin.example/");
  });
});
