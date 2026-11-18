/** What typing into a terminal sends (term-keys.ts). */
import { describe, expect, it } from "vitest";
import { ctrlCode, forApplication, keyBytes, LiveKeys, liveRows, pasteBytes, placeLiveKeys } from "../src/term-keys.js";
import { keyAt } from "../src/keys.js";

describe("a real keyboard", () => {
  it("sends letters as they are, and the named keys as a terminal expects them", () => {
    expect(keyBytes({ key: "a" })).toBe("a");
    expect(keyBytes({ key: "A", shiftKey: true })).toBe("A");
    expect(keyBytes({ key: "é" })).toBe("é");
    expect(keyBytes({ key: "Enter" })).toBe("\r");
    expect(keyBytes({ key: "Backspace" })).toBe("\x7f");
    expect(keyBytes({ key: "Escape" })).toBe("\x1b");
    expect(keyBytes({ key: "ArrowUp" })).toBe("\x1b[A");
    expect(keyBytes({ key: "Tab", shiftKey: true })).toBe("\x1b[Z");
    expect(keyBytes({ key: "Delete" })).toBe("\x1b[3~");
  });

  it("sends Ctrl and Alt the way a shell reads them", () => {
    expect(keyBytes({ key: "c", ctrlKey: true })).toBe("\x03");
    expect(keyBytes({ key: "D", ctrlKey: true })).toBe("\x04");
    expect(keyBytes({ key: "[", ctrlKey: true })).toBe("\x1b");
    expect(keyBytes({ key: "b", altKey: true })).toBe("\x1bb");
    expect(ctrlCode("1")).toBe("1");
  });

  it("leaves the browser its own keys, and a modifier by itself sends nothing", () => {
    for (const key of ["Shift", "Control", "Alt", "Meta", "CapsLock", "F11", "Dead"]) expect(keyBytes({ key }), key).toBeNull();
    expect(keyBytes({ key: "v", ctrlKey: true })).toBeNull(); // so a paste arrives as a paste
    expect(keyBytes({ key: "C", ctrlKey: true, shiftKey: true })).toBeNull();
    expect(keyBytes({ key: "c", metaKey: true })).toBeNull();
  });

  it("sends the arrows another way to a program that asked", () => {
    expect(forApplication("\x1b[A", true)).toBe("\x1bOA");
    expect(forApplication("\x1b[A", false)).toBe("\x1b[A");
    expect(forApplication("a\x1b[A", true)).toBe("a\x1b[A");
  });

  it("pastes as typing, or wrapped for a program that asked, and a paste can't end itself", () => {
    expect(pasteBytes("one\r\ntwo\n", false)).toBe("one\rtwo\r");
    expect(pasteBytes("ls", true)).toBe("\x1b[200~ls\x1b[201~");
    expect(pasteBytes("safe\x1b[201~rm -rf ~\n", true)).toBe("\x1b[200~saferm -rf ~\r\x1b[201~");
  });
});

describe("the keyboard drawn in a headset", () => {
  it("has what a terminal needs on every layer, and every row fits the board", () => {
    for (const layer of ["letters", "symbols", "more"] as const) {
      const ids = liveRows(layer).flat().map((k) => k.id);
      for (const need of ["esc", "tab", "ctrl", "up", "down", "left", "right", "enter", "space", "back", "layer", "close"]) expect(ids, `${layer} ${need}`).toContain(need);
      expect(new Set(ids).size, layer).toBe(ids.length);
      for (const row of liveRows(layer)) expect(row.reduce((n, k) => n + k.w, 0), layer).toBeLessThanOrEqual(10.0001);
      for (const k of placeLiveKeys(layer)) {
        expect(k.x).toBeGreaterThanOrEqual(0);
        expect(k.x + k.width).toBeLessThanOrEqual(1.0001);
      }
    }
    const everything = new Set((["letters", "symbols", "more"] as const).flatMap((l) => liveRows(l).flat().map((k) => k.id)));
    for (const ch of "|~$&<>{}[]\\`'\"_#+=*%^!?@:;()/-.,") expect(everything.has(ch), ch).toBe(true);
  });

  it("sends each key as it is pressed", () => {
    const k = new LiveKeys();
    expect(k.press("l")).toEqual({ send: "l" });
    expect(k.press("s")).toEqual({ send: "s" });
    expect(k.press("enter")).toEqual({ send: "\r" });
    expect(k.press("up")).toEqual({ send: "\x1b[A" });
    expect(k.press("esc")).toEqual({ send: "\x1b" });
    expect(k.press("back")).toEqual({ send: "\x7f" });
    expect(k.press("close")).toEqual({ close: true });
    // A page at a time, for a pager or an editor: on the last layer.
    k.press("layer");
    k.press("layer");
    expect(k.press("pgup")).toEqual({ send: "\x1b[5~" });
    expect(k.press("pgdn")).toEqual({ send: "\x1b[6~" });
    expect(k.press("home")).toEqual({ send: "\x1b[H" });
    expect(k.press("end")).toEqual({ send: "\x1b[F" });
    expect(k.press("nothing")).toBeNull();
  });

  it("takes Ctrl first and the letter after, once", () => {
    const k = new LiveKeys();
    expect(k.press("ctrl")).toBeNull();
    expect(k.ctrl).toBe(true);
    expect(k.press("c")).toEqual({ send: "\x03" });
    expect(k.ctrl).toBe(false);
    expect(k.press("c")).toEqual({ send: "c" });
    k.press("ctrl");
    k.press("ctrl");
    expect(k.press("d")).toEqual({ send: "d" });
  });

  it("shifts one letter, or locks, and goes round three layers", () => {
    const k = new LiveKeys();
    k.press("shift");
    expect(k.press("a")).toEqual({ send: "A" });
    expect(k.press("a")).toEqual({ send: "a" });
    k.press("shift");
    k.press("shift");
    expect(k.shift).toBe("lock");
    expect(k.press("a")).toEqual({ send: "A" });
    expect(k.press("b")).toEqual({ send: "B" });
    k.press("layer");
    expect(k.layer).toBe("symbols");
    expect(k.press("|")).toEqual({ send: "|" });
    k.press("layer");
    expect(k.layer).toBe("more");
    k.press("layer");
    expect(k.layer).toBe("letters");
  });

  it("finds the key under a point", () => {
    const keys = placeLiveKeys("letters");
    const esc = keys.find((k) => k.id === "esc")!;
    expect(keyAt(keys, esc.x + esc.width / 2, esc.y + esc.height / 2)?.id).toBe("esc");
  });
});

describe("a key to speak with", () => {
  it("is on the keyboard only where something can listen, and typing is never mistaken for it", () => {
    expect(liveRows("letters").flat().map((k) => k.id)).not.toContain("mic");
    for (const layer of ["letters", "symbols", "more"] as const) {
      const rows = liveRows(layer, { mic: true });
      expect(rows.flat().map((k) => k.id)).toContain("mic");
      for (const row of rows) expect(row.reduce((n, k) => n + k.w, 0)).toBeLessThanOrEqual(10.0001);
    }
    const k = new LiveKeys();
    expect(k.press("mic", liveRows("letters", { mic: true }).flat())).toEqual({ mic: true });
    expect(k.press("mic")).toBeNull(); // not on a board without one
  });
});
