/** A keyboard as data: where the keys are and what pressing them does. */
import { describe, expect, it } from "vitest";
import { keyAt, keyRows, placeKeys, TextEntry } from "../src/keys.js";

const type = (e: TextEntry, ...ids: string[]) => ids.map((id) => e.press(id)).at(-1);

describe("the keys", () => {
  it("are the letters where people expect them, with a row of things to do", () => {
    const rows = keyRows("letters");
    expect(rows[0]!.map((k) => k.id).join("")).toBe("qwertyuiop");
    expect(rows[1]!.map((k) => k.id).join("")).toBe("asdfghjkl");
    expect(rows[2]!.map((k) => k.id)).toEqual(["shift", ..."zxcvbnm", "back"]);
    expect(rows.at(-1)!.map((k) => k.id)).toEqual(["cancel", "done"]);
    expect(keyRows("letters", { system: true }).at(-1)!.map((k) => k.id)).toEqual(["cancel", "system", "done"]);
    expect(keyRows("symbols")[0]!.map((k) => k.id).join("")).toBe("1234567890");
  });

  it("each have a place on the board, inside it, and none on another", () => {
    for (const layer of ["letters", "symbols"] as const) {
      const keys = placeKeys(layer, { system: true });
      for (const k of keys) {
        expect(k.x).toBeGreaterThanOrEqual(0);
        expect(k.x + k.width).toBeLessThanOrEqual(1.0001);
        expect(k.y + k.height).toBeLessThanOrEqual(1.0001);
      }
      for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
        const [a, b] = [keys[i]!, keys[j]!];
        const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
        expect(apart, `${a.id} and ${b.id}`).toBe(true);
      }
    }
  });

  it("are found by where a ray lands, and between two keys there is nothing", () => {
    const keys = placeKeys("letters");
    const q = keys.find((k) => k.id === "q")!;
    expect(keyAt(keys, q.x + q.width / 2, q.y + q.height / 2)?.id).toBe("q");
    expect(keyAt(keys, q.x + q.width + 0.004, q.y + q.height / 2)).toBeNull();
    expect(keyAt(keys, 0.5, 0.7)?.id).toBe("space");
    expect(keyAt(keys, 2, 2)).toBeNull();
  });
});

describe("typing", () => {
  it("starts a sentence with a capital and carries on small", () => {
    const e = new TextEntry();
    expect(e.shift).toBe("once");
    type(e, "h", "i", ".", "space", "o", "k");
    expect(e.value).toBe("Hi. Ok");
  });

  it("takes one capital from shift, or stays in capitals when it is pressed twice", () => {
    const e = new TextEntry({ value: "a " });
    type(e, "shift", "b", "c");
    expect(e.value).toBe("a Bc");
    type(e, "shift", "shift", "d", "e");
    expect(e.shift).toBe("lock");
    expect(e.value).toBe("a BcDE");
    type(e, "shift", "f");
    expect(e.value).toBe("a BcDEf");
  });

  it("shows capitals on the keys while shift is on", () => {
    const e = new TextEntry({ value: "x" });
    const a = keyRows("letters").flat().find((k) => k.id === "a")!;
    expect(e.label(a)).toBe("a");
    e.press("shift");
    expect(e.label(a)).toBe("A");
  });

  it("deletes one character at a time, whole, and nothing from nothing", () => {
    const e = new TextEntry({ value: "go 🙂" });
    type(e, "back");
    expect(e.value).toBe("go ");
    type(e, "back", "back", "back", "back", "back");
    expect(e.value).toBe("");
  });

  it("has numbers and marks on a second layer", () => {
    const e = new TextEntry({ value: "at " });
    type(e, "layer", "8", ":", "3", "0", "layer", "p", "m");
    expect(e.value).toBe("at 8:30pm");
  });

  it("ends a single line with enter, and breaks a longer note", () => {
    expect(type(new TextEntry({ value: "x" }), "enter")).toBe("done");
    const note = new TextEntry({ value: "x", multiline: true });
    expect(type(note, "enter", "y")).toBe("typing");
    expect(note.value).toBe("x\nY"); // a new line starts a sentence
    expect(type(note, "done")).toBe("done");
    expect(type(note, "cancel")).toBe("cancel");
    expect(type(note, "system")).toBe("system");
  });

  it("stops at its length, and never takes a line break into a single line", () => {
    const e = new TextEntry({ maxLength: 5 });
    e.type("abcdefgh");
    expect(e.value).toBe("abcde");
    const one = new TextEntry();
    one.type("two\nlines");
    expect(one.value).toBe("two lines");
  });

  it("ignores a key that isn't there", () => {
    const e = new TextEntry({ value: "x" });
    expect(e.press("nope")).toBe("typing");
    expect(e.value).toBe("x");
  });
});
