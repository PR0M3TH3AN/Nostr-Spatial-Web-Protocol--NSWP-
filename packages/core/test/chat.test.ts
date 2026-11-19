import { describe, expect, it } from "vitest";
import { bubbleSeconds, buildSay, CHAT_LIMITS, chatId, cleanChat, createChatGate, parseSay } from "../src/index.js";

const at = (code: number) => String.fromCodePoint(code);

describe("room chat: what may be shown", () => {
  it("is one line, with single spaces, trimmed", () => {
    expect(cleanChat("  hello\n\n  there\tfriend  ")).toBe("hello there friend");
  });

  it("drops what reorders or hides text", () => {
    // A right-to-left override, a zero-width space, a line separator, a byte order mark.
    const sly = `pay${at(0x202e)}me${at(0x200b)}now${at(0x2028)}ok${at(0xfeff)}`;
    const cleaned = cleanChat(sly);
    expect(cleaned).toBe("pay me now ok");
    for (const ch of cleaned) expect(ch.codePointAt(0)!).toBeLessThan(0x7f);
  });

  it("keeps the joiner inside an emoji, so a family stays one picture", () => {
    const family = `${at(0x1f468)}${at(0x200d)}${at(0x1f469)}${at(0x200d)}${at(0x1f467)}`;
    expect(cleanChat(`hi ${family}`)).toBe(`hi ${family}`);
  });

  it("cuts to the limit by characters, not by halves of them", () => {
    const globe = at(0x1f30d);
    const cleaned = cleanChat(globe.repeat(CHAT_LIMITS.chars + 50));
    expect([...cleaned]).toHaveLength(CHAT_LIMITS.chars);
    expect(cleaned.endsWith(globe)).toBe(true);
  });

  it("is nothing for nothing, and for what isn't words", () => {
    expect(cleanChat("   \n ")).toBe("");
    expect(cleanChat(undefined)).toBe("");
    expect(cleanChat(42)).toBe("");
    expect(cleanChat({ toString: () => "hi" })).toBe("");
  });

  it("doesn't walk through a megabyte to find the first words", () => {
    const started = Date.now();
    expect(cleanChat(`hello ${"x".repeat(2_000_000)}`).startsWith("hello x")).toBe(true);
    expect(Date.now() - started).toBeLessThan(200);
  });
});

describe("room chat: on the wire", () => {
  it("goes out and comes back the same", () => {
    const line = buildSay("Hello, room: how are you?", "0a1b2c3d");
    expect(line).toBe("say:0a1b2c3d:Hello, room: how are you?");
    expect(parseSay(line)).toEqual({ id: "0a1b2c3d", text: "Hello, room: how are you?" });
  });

  it("makes an id of its own when given none", () => {
    expect(chatId()).toMatch(/^[0-9a-f]{8}$/);
    expect(chatId()).not.toBe(chatId());
    expect(buildSay("hi")).toMatch(/^say:[0-9a-f]{8}:hi$/);
  });

  it("says nothing when there is nothing to say", () => {
    expect(buildSay("   ")).toBeNull();
    expect(buildSay("hi", "not-an-id")).toBeNull();
  });

  it("cleans what arrives, whoever sent it", () => {
    const long = `say:00000000:${"y".repeat(5000)}`;
    expect([...parseSay(long)!.text]).toHaveLength(CHAT_LIMITS.chars);
    expect(parseSay(`say:00000000:a${at(0x202e)}b`)!.text).toBe("a b");
  });

  it("reads nothing else as a line", () => {
    for (const not of ["", "say:", "say:0a1b2c3d", "say:0a1b2c3d:", "say:0a1b2c3d:   ", "say:0A1B2C3D:hi", "say:0a1b2c3:hi", "say:0a1b2c3dd:hi", "look:abc", "SAY:0a1b2c3d:hi", 7, null, new ArrayBuffer(4)]) {
      expect(parseSay(not)).toBeNull();
    }
  });
});

describe("room chat: how much one member may say", () => {
  it("takes a line once, however often it is repeated", () => {
    const gate = createChatGate();
    expect(gate.take("aaaaaaaa", 0)).toBe(true);
    expect(gate.take("aaaaaaaa", 180)).toBe(false);
    expect(gate.take("aaaaaaaa", 360)).toBe(false);
    expect(gate.take("bbbbbbbb", 400)).toBe(true);
  });

  it("drops what is past the limit, and its repeats with it", () => {
    const gate = createChatGate();
    for (let i = 0; i < CHAT_LIMITS.burst; i++) expect(gate.take(`0000000${i}`, i * 10)).toBe(true);
    expect(gate.room(100)).toBe(false);
    expect(gate.take("ffffffff", 100)).toBe(false);
    // The repeat of the dropped one arrives after there is room again, and still isn't shown.
    expect(gate.take("ffffffff", CHAT_LIMITS.perMs + 200)).toBe(false);
    expect(gate.room(CHAT_LIMITS.perMs + 200)).toBe(true);
    expect(gate.take("eeeeeeee", CHAT_LIMITS.perMs + 200)).toBe(true);
  });

  it("repeats don't count towards the limit", () => {
    const gate = createChatGate();
    gate.take("aaaaaaaa", 0);
    for (let i = 0; i < 20; i++) gate.take("aaaaaaaa", i);
    expect(gate.room(30)).toBe(true);
  });
});

describe("room chat: how long a line stays up", () => {
  it("is longer for more words, within reason", () => {
    expect(bubbleSeconds("hi")).toBeGreaterThan(4);
    expect(bubbleSeconds("hi")).toBeLessThan(4.5);
    expect(bubbleSeconds("x".repeat(100))).toBeCloseTo(10);
    expect(bubbleSeconds("x".repeat(240))).toBe(12);
  });
});
