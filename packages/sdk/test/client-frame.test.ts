import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A world in its client's frame (protocol/02-doors.md, "A client that keeps the screen"): what it says to the page
 * above it, and what it takes from it. The page above is a stand-in that keeps what it was sent.
 */
type Frame = typeof import("../src/client-frame.js");
const CLIENT = { postMessage: vi.fn() };
let hear: (e: { source: unknown; data: unknown }) => void = () => {};
let frame: Frame;

const sent = (kind: string) => CLIENT.postMessage.mock.calls.map((c) => c[0] as Record<string, unknown>).filter((m) => m.nswp === kind);

beforeEach(async () => {
  vi.resetModules();
  CLIENT.postMessage.mockClear();
  const self = { parent: CLIENT } as unknown as Window;
  vi.stubGlobal("window", self);
  vi.stubGlobal("location", { pathname: "/", search: "" });
  vi.stubGlobal("addEventListener", (type: string, fn: typeof hear) => {
    if (type === "message") hear = fn;
  });
  frame = await import("../src/client-frame.js");
});
afterEach(() => vi.unstubAllGlobals());

describe("a world in its client's frame, and the sign-in address's panel", () => {
  it("says it came up, and takes the screen's state only from the page above", () => {
    expect(sent("here")).toEqual([{ nswp: "here", at: "/" }]);
    hear({ source: {}, data: { nswp: "screen", holds: true, filled: true, signIn: "https://signin.example" } });
    expect([frame.clientHoldsScreen(), frame.clientSignsInAt()]).toEqual([false, null]);
    hear({ source: CLIENT, data: { nswp: "screen", holds: true, filled: false } });
    expect([frame.clientHoldsScreen(), frame.clientScreenFilled(), frame.clientSignsInAt()]).toEqual([true, false, null]);
  });

  it("asks for the panel only of a client that said it has one, at a secure address", () => {
    expect(frame.askClientForSignIn()).toBe(false);
    for (const not of ["http://signin.example", "https://signin.example/connect/", "javascript:alert(1)", "signin.example", 7, null]) {
      hear({ source: CLIENT, data: { nswp: "screen", holds: true, filled: false, signIn: not } });
      expect(frame.clientSignsInAt(), String(not)).toBeNull();
    }
    expect(sent("sign-in")).toEqual([]);
    hear({ source: CLIENT, data: { nswp: "screen", holds: true, filled: false, signIn: "https://signin.example" } });
    expect(frame.clientSignsInAt()).toBe("https://signin.example");
    // A later word about the screen that doesn't mention it hasn't taken it back.
    hear({ source: CLIENT, data: { nswp: "screen", holds: true, filled: true } });
    expect(frame.clientSignsInAt()).toBe("https://signin.example");
    expect(frame.askClientForSignIn()).toBe(true);
    expect(frame.askClientForSignIn("switch")).toBe(true);
    // And for the sign-in address's own pages, each by its name: their account, their files, their wallet.
    for (const mode of ["account", "files", "wallet"] as const) expect(frame.askClientForSignIn(mode)).toBe(true);
    expect(sent("sign-in")).toEqual([{ nswp: "sign-in", mode: "ask" }, { nswp: "sign-in", mode: "switch" }, { nswp: "sign-in", mode: "account" }, { nswp: "sign-in", mode: "files" }, { nswp: "sign-in", mode: "wallet" }]);
  });

  it("says where its menu is, so the panel can be drawn in its place", () => {
    hear({ source: CLIENT, data: { nswp: "screen", holds: true, filled: false, signIn: "https://signin.example" } });
    frame.setMenuPlace(() => ({ left: 330, width: 780, bottom: 132 }));
    frame.askClientForSignIn();
    frame.setMenuPlace(() => null);
    frame.askClientForSignIn();
    frame.setMenuPlace(() => {
      throw new Error("no menu");
    });
    frame.askClientForSignIn();
    expect(sent("sign-in")).toEqual([{ nswp: "sign-in", mode: "ask", menu: { left: 330, width: 780, bottom: 132 } }, { nswp: "sign-in", mode: "ask" }, { nswp: "sign-in", mode: "ask" }]);
  });

  it("is told as the panel comes and goes, and whether the visitor said yes", () => {
    hear({ source: CLIENT, data: { nswp: "screen", holds: true, filled: false, signIn: "https://signin.example" } });
    const told: unknown[] = [];
    frame.onClientSignIn((open, failed, allowed) => told.push([open, failed, allowed]));
    hear({ source: {}, data: { nswp: "sign-in", open: true } });
    hear({ source: CLIENT, data: { nswp: "sign-in", open: true } });
    hear({ source: CLIENT, data: { nswp: "sign-in", open: true } });
    expect(frame.clientPanelOpen()).toBe(true);
    hear({ source: CLIENT, data: { nswp: "sign-in", open: false, allowed: true } });
    expect(frame.clientPanelOpen()).toBe(false);
    expect(told).toEqual([
      [true, false, false],
      [false, false, true],
    ]);
  });

  it("goes back to a window, for the rest of the page, when the panel never came up", () => {
    hear({ source: CLIENT, data: { nswp: "screen", holds: true, filled: false, signIn: "https://signin.example" } });
    const told: unknown[] = [];
    frame.onClientSignIn((open, failed) => told.push([open, failed]));
    expect(frame.askClientForSignIn()).toBe(true);
    hear({ source: CLIENT, data: { nswp: "sign-in", open: false, failed: true } });
    expect(told).toEqual([[false, true]]);
    expect(frame.clientSignsInAt()).toBeNull();
    // The client goes on saying it has one, with every word about the screen: it isn't believed again here.
    hear({ source: CLIENT, data: { nswp: "screen", holds: true, filled: true, signIn: "https://signin.example" } });
    expect(frame.clientSignsInAt()).toBeNull();
    expect(frame.askClientForSignIn()).toBe(false);
  });

  it("does none of it for a world opened as a page of its own", async () => {
    vi.resetModules();
    CLIENT.postMessage.mockClear();
    const self = {} as { parent: unknown };
    self.parent = self;
    vi.stubGlobal("window", self);
    const alone = await import("../src/client-frame.js");
    expect(CLIENT.postMessage).not.toHaveBeenCalled();
    expect([alone.framed(), alone.askClientForSignIn(), alone.clientSignsInAt()]).toEqual([false, false, null]);
  });
});

/**
 * A page says `here` once, as soon as the files loaded with it have all run. In a browser those run one after
 * another with nothing in between; this test runner loads them one at a time, with gaps. So the moment "once they
 * have all run" is held here by hand, and let go after the world's end of the port has loaded.
 */
const loadSpeaking = async () => {
  vi.resetModules();
  CLIENT.postMessage.mockClear();
  const held: (() => void)[] = [];
  vi.stubGlobal("queueMicrotask", (fn: () => void) => void held.push(fn));
  await import("../src/menu-above.js");
  const now = await import("../src/client-frame.js");
  expect(sent("here")).toEqual([]);
  for (const fn of held) fn();
  return now;
};

describe("a world that speaks the menu's words", () => {
  it("says so in its one here, when the world's end of the port is loaded with the page", async () => {
    await loadSpeaking();
    expect(sent("here")).toEqual([{ nswp: "here", at: "/", menu: 1 }]);
  });

  it("says nothing of it otherwise, and can't once here has been said", () => {
    expect(sent("here")).toEqual([{ nswp: "here", at: "/" }]);
    frame.speakMenu(1);
    hear({ source: CLIENT, data: { nswp: "menu", has: true, v: 1, settings: {} } });
    const heard: unknown[] = [];
    frame.hearClientMenu((w) => heard.push(w));
    // A page that never said it speaks them keeps nothing a client said about them.
    expect(heard).toEqual([]);
    expect(sent("here")).toHaveLength(1);
  });

  it("keeps what its client said before it listened, takes it only from the page above, and says its own words upward", async () => {
    const now = await loadSpeaking();
    hear({ source: {}, data: { nswp: "menu", has: true, v: 1, settings: {} } });
    hear({ source: CLIENT, data: { nswp: "menu", has: true, v: 1, settings: { text: 1.2 } } });
    const heard: unknown[] = [];
    now.hearClientMenu((w) => heard.push(w));
    expect(heard).toEqual([{ nswp: "menu", has: true, v: 1, settings: { text: 1.2 } }]);
    hear({ source: CLIENT, data: { nswp: "menu", open: true } });
    expect(heard).toHaveLength(2);
    now.sayToClient({ key: "summon", nswp: "screen" });
    expect(sent("menu")).toEqual([{ key: "summon", nswp: "menu" }]);
    expect(now.sinceHere()).toBeGreaterThanOrEqual(0);
  });
});
