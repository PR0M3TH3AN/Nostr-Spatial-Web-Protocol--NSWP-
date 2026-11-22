import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanLoading, createControls } from "../src/ui/model.js";

/**
 * "You're in, still loading" (docs/backlog/game-worlds-kit-gaps.md, gap e; the orchestrator's names, 2026-11-22): a
 * world says it is still loading once the visitor is in it, and the visitor's console says so, with nothing held up.
 */
describe("what a world says it is still loading", () => {
  it("is one line of plain text, at most 80 characters, with how far along held between 0 and 1", () => {
    expect(cleanLoading({ fraction: 0.4, words: "Loading the arena" })).toEqual({ fraction: 0.4, words: "Loading the arena" });
    expect(cleanLoading({ fraction: 1.7, words: "x" })).toEqual({ fraction: 1, words: "x" });
    expect(cleanLoading({ fraction: -2 })).toEqual({ fraction: 0, words: "" });
    // How far along can't be said: none, not nought.
    expect(cleanLoading({ fraction: Number.NaN, words: "Joining the match" })).toEqual({ fraction: null, words: "Joining the match" });
    expect(cleanLoading({ words: "Joining the match" })).toEqual({ fraction: null, words: "Joining the match" });
    // Lines broken, tabs and control characters: one line, spaces made one.
    expect(cleanLoading({ words: "  Loading\n\tthe\u0007  arena  " })!.words).toBe("Loading the arena");
    // Cut at 80 whole characters, an emoji counting as one.
    const long = `${"🚀".repeat(10)}${"a".repeat(100)}`;
    expect([...cleanLoading({ words: long })!.words].length).toBe(80);
    // Markup is words: shown as text, never read as HTML (the HUD sets textContent; nothing here strips it).
    expect(cleanLoading({ words: "<b>Loading</b>" })!.words).toBe("<b>Loading</b>");
    expect(cleanLoading(null)).toBeNull();
    expect(cleanLoading({ words: 7 } as never)).toEqual({ fraction: null, words: "" });
  });

  it("is in the controls' view until it is ended, and says it changed only when it did", () => {
    const c = createControls({ title: "The arena" });
    const heard = vi.fn();
    c.subscribe(heard);
    expect(c.view().loading).toBeNull();
    c.setLoading({ fraction: 0.25, words: "Loading the arena" });
    expect(c.view().loading).toEqual({ fraction: 0.25, words: "Loading the arena" });
    const after = heard.mock.calls.length;
    c.setLoading({ fraction: 0.25, words: "Loading the arena" });
    expect(heard.mock.calls.length).toBe(after);
    c.setLoading(null);
    expect(c.view().loading).toBeNull();
  });
});

describe("the engine script's loading, once the visitor is in", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("../src/engine-menu.js");
  });
  const engineWith = async () => {
    const line = vi.fn();
    vi.doMock("../src/engine-menu.js", async (real) => ({ ...(await real<typeof import("../src/engine-menu.js")>()), loadingLine: line }));
    // No page here, so no crossing's room: the visitor is taken to be in, as on a page with `data-crossing="off"`.
    const engine = await import("../src/engine.js");
    return { engine, line };
  };

  it("is the menu's line, with the world's words; loaded(), or loading(1), ends it", async () => {
    const { engine, line } = await engineWith();
    engine.loading(0.4, "Loading the arena");
    expect(line).toHaveBeenLastCalledWith({ fraction: 0.4, words: "Loading the arena" });
    engine.loading(-1, "Joining the match");
    expect(line).toHaveBeenLastCalledWith({ words: "Joining the match" });
    engine.loaded();
    expect(line).toHaveBeenLastCalledWith(null);
    engine.loading(0.9);
    engine.loading(1);
    expect(line).toHaveBeenLastCalledWith(null);
    expect(engine.VERSION).toBe(17);
  });
});
