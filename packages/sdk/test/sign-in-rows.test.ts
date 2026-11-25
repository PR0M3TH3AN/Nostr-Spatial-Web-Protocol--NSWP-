import { describe, expect, it, vi } from "vitest";
import { createControls } from "../src/ui/model.js";
import { signInRows } from "../src/ui/port-below.js";

/**
 * The client's own You rows for the world in its frame (`signInRows`), worded from the facts the world says. A guest
 * account over a world (BitPortal's live check of 0.92.0) read "Signed in to The Grove. Sign out here", the words for
 * an account. Now the world says `state.guest`, and a guest is told who they are as one, offered an account, and
 * offered to secure this one.
 */
type State = { named: boolean; guest: boolean; signIn: "none" | "ready" | "asking" | "unanswered" };
function client(state: State) {
  const c = createControls({ title: "The portal" });
  const ask = vi.fn();
  const secure = vi.fn();
  const signOut = vi.fn();
  const below = { world: { title: "The Grove", state }, signOut } as never;
  c.add(...signInRows(below, { ask, secure }));
  const shown = () => (c.view().sections.find((s) => s.id === "you")?.items ?? []).map((i) => ({ id: i.id, label: i.label }));
  return { c, ask, secure, signOut, shown };
}

describe("the client's You rows for the world in its frame", () => {
  it("to a guest account: who they are as a guest, Secure this account, and Sign in to an account; no Sign out", () => {
    const k = client({ named: true, guest: true, signIn: "ready" });
    expect(k.shown()).toEqual([
      { id: "world-guest", label: "You're a guest. Every world in BitPortal knows it's the same guest. This account lives in this browser only." },
      { id: "world-secure", label: "Secure this account" },
      { id: "world-sign-in", label: "Sign in to an account" },
    ]);
    k.c.run("world-secure");
    k.c.run("world-sign-in");
    return Promise.resolve().then(() => {
      expect([k.secure.mock.calls.length, k.ask.mock.calls.length, k.signOut.mock.calls.length]).toEqual([1, 1, 0]);
    });
  });

  it("to an account, as before: Signed in to the world, and Sign out", () => {
    const k = client({ named: true, guest: false, signIn: "ready" });
    expect(k.shown()).toEqual([{ id: "world-sign-out", label: "Signed in to The Grove. Sign out here" }]);
  });

  it("to nobody yet, as before: Sign in to the world", () => {
    const k = client({ named: false, guest: false, signIn: "ready" });
    expect(k.shown()).toEqual([{ id: "world-sign-in", label: "Sign in to The Grove" }]);
  });

  it("offers no Secure where the client has nothing to secure with", () => {
    const c = createControls({ title: "The portal" });
    c.add(...signInRows({ world: { title: "The Grove", state: { named: true, guest: true, signIn: "ready" } }, signOut: () => {} } as never, { ask: () => {} }));
    expect((c.view().sections.find((s) => s.id === "you")?.items ?? []).map((i) => i.id)).toEqual(["world-guest", "world-sign-in"]);
  });
});
