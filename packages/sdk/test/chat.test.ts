import { beforeEach, describe, expect, it } from "vitest";
import { CHAT_LIMITS } from "@nswp/core";
import { createUiChat, onChatChange, resetChat, setShowsChat, showsChat, wrapWords } from "../src/ui/chat.js";
import { createControls, STANDARD_ORDER } from "../src/ui/model.js";
import { arriveWith, currentSettings, resetSettings } from "../src/settings.js";

beforeEach(() => {
  resetSettings();
  resetChat();
});

describe("seeing what people write", () => {
  it("is on until the visitor says otherwise, and goes on with them", () => {
    expect(showsChat()).toBe(true);
    expect(currentSettings().chat).toBe(true);
  });

  it("begins as they arrived", () => {
    arriveWith({ chat: false });
    expect(showsChat()).toBe(false);
    expect(currentSettings().chat).toBe(false);
  });

  it("is theirs to turn off, and whoever draws words hears of it", () => {
    let told = 0;
    onChatChange(() => told++);
    setShowsChat(false);
    expect(showsChat()).toBe(false);
    expect(currentSettings().chat).toBe(false);
    expect(told).toBe(1);
  });
});

describe("the lines the controls hold", () => {
  const made = () => {
    let changes = 0;
    const sent: string[] = [];
    const chat = createUiChat(() => changes++);
    return { chat, sent, changes: () => changes };
  };

  it("has nowhere to write until a room is joined", () => {
    const { chat } = made();
    expect(chat.view().ready).toBe(false);
    expect(chat.send("hello")).toMatch(/join the room/);
    chat.add({ who: "Alice", text: "hello" });
    expect(chat.view().lines).toEqual([]);
  });

  it("says what the visitor wrote, and passes back why it couldn't", () => {
    const { chat, sent } = made();
    let trouble: string | null = null;
    chat.attach((text) => {
      sent.push(text);
      return trouble;
    });
    expect(chat.view().ready).toBe(true);
    expect(chat.send("hello")).toBeNull();
    trouble = "Wait a moment.";
    expect(chat.send("again")).toBe("Wait a moment.");
    // Nothing to say is not said, and is nobody's trouble.
    expect(chat.send("   ")).toBeNull();
    expect(sent).toEqual(["hello", "again"]);
  });

  it("keeps lines as text, cleaned, and counts the ones not yet looked at", () => {
    const { chat, changes } = made();
    chat.attach(() => null);
    const before = changes();
    chat.add({ who: "Alice", text: "  hello\nthere  ", id: "0a1b2c3d" });
    chat.add({ who: "Me", text: "hi", mine: true });
    chat.add({ note: true, text: "Bob is here." });
    chat.add({ who: "Bob", text: "   " });
    const view = chat.view();
    expect(view.lines.map((l) => [l.who, l.text, l.mine, l.note])).toEqual([
      ["Alice", "hello there", false, false],
      ["Me", "hi", true, false],
      ["", "Bob is here.", false, true],
    ]);
    expect(new Set(view.lines.map((l) => l.key)).size).toBe(3);
    expect(view.unread).toBe(1);
    expect(changes()).toBe(before + 3);
    chat.seen();
    expect(chat.view().unread).toBe(0);
    expect(chat.view().version).toBeGreaterThan(view.version);
  });

  it("keeps no more than the limit, the newest", () => {
    const { chat } = made();
    chat.attach(() => null);
    for (let i = 0; i < CHAT_LIMITS.kept + 20; i++) chat.add({ who: "A", text: `line ${i}` });
    const lines = chat.view().lines;
    expect(lines).toHaveLength(CHAT_LIMITS.kept);
    expect(lines[lines.length - 1]!.text).toBe(`line ${CHAT_LIMITS.kept + 19}`);
  });

  it("forgets everything when the room is left", () => {
    const { chat } = made();
    chat.attach(() => null);
    chat.add({ who: "Alice", text: "hello" });
    chat.detach();
    expect(chat.view()).toMatchObject({ ready: false, lines: [], unread: 0 });
    chat.attach(() => null, { title: "Private room chat" });
    expect(chat.view()).toMatchObject({ ready: true, lines: [], title: "Private room chat" });
  });

  it("shows nothing, takes nothing and says nothing while the visitor has chat off", () => {
    const { chat, sent } = made();
    chat.attach((text) => void sent.push(text));
    chat.add({ who: "Alice", text: "before" });
    setShowsChat(false);
    expect(chat.view()).toMatchObject({ ready: false, lines: [], unread: 0 });
    chat.add({ who: "Alice", text: "while off" });
    expect(chat.send("hello")).toMatch(/join the room/);
    expect(sent).toEqual([]);
    setShowsChat(true);
    // Back on: there is somewhere to write again, and what was said meanwhile was never kept.
    expect(chat.view()).toMatchObject({ ready: true, lines: [] });
  });
});

describe("the chat in a set of controls", () => {
  it("is in every view, and has its place in the order every world shares", () => {
    const controls = createControls({ title: "A world" });
    expect(controls.view().chat).toMatchObject({ ready: false, lines: [], limit: CHAT_LIMITS.chars });
    expect(STANDARD_ORDER.indexOf("room-chat")).toBe(STANDARD_ORDER.indexOf("room-mic") + 1);
    let drawn = 0;
    controls.subscribe(() => drawn++);
    controls.chat.attach(() => null);
    controls.chat.add({ who: "Alice", text: "hello" });
    expect(drawn).toBe(2);
    expect(controls.view().chat.lines[0]!.text).toBe("hello");
  });

  it("has a key a world can change or take away, and none while a world has claimed the keys", () => {
    const controls = createControls({ title: "A world" });
    expect(controls.view().keys.chat).toBe("t");
    controls.setKeys({ chat: "Y" });
    expect(controls.view().keys.chat).toBe("y");
    controls.setKeys({ chat: "enter" as never });
    expect(controls.view().keys.chat).toBe("y");
    controls.setKeys({ chat: null });
    expect(controls.view().keys.chat).toBeNull();
    controls.setKeys({ chat: "t" });
    controls.claimInput(true);
    expect(controls.view().keys.chat).toBeNull();
  });
});

describe("fitting words into rows", () => {
  const measure = (s: string) => s.length; // one unit a character

  it("breaks between words", () => {
    expect(wrapWords("the quick brown fox jumps", measure, 10, 5)).toEqual(["the quick", "brown fox", "jumps"]);
  });

  it("breaks a word too long for a row of its own", () => {
    expect(wrapWords("a supercalifragilistic word", measure, 8, 9)).toEqual(["a", "supercal", "ifragili", "stic", "word"]);
  });

  it("ends what doesn't fit in a mark that says so, within the width", () => {
    const rows = wrapWords("one two three four five six seven", measure, 9, 2);
    expect(rows).toHaveLength(2);
    expect(rows[1]!.endsWith("…")).toBe(true);
    expect(rows[1]!.length).toBeLessThanOrEqual(9);
  });

  it("is nothing for nothing", () => {
    expect(wrapWords("", measure, 10, 3)).toEqual([]);
  });
});
