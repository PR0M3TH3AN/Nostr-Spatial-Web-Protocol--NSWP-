import { describe, expect, it } from "vitest";
import { ago, createUiFeed, FEED_LIMITS } from "../src/ui/feed.js";

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("my public feed (protocol/10-identity.md, Posting from a world)", () => {
  it("is not there until something signs for the visitor", () => {
    const feed = createUiFeed(() => {});
    expect(feed.view().ready).toBe(false);
    expect(feed.send("hello")).toMatch(/sign in/);
    feed.attach({ who: "Ada", send: async () => ({ ok: true, said: "Sent out." }) });
    expect(feed.view()).toMatchObject({ ready: true, title: "My public feed", who: "Ada", posts: [] });
    feed.detach();
    expect(feed.view().ready).toBe(false);
  });

  it("asks for their posts only when they open it, and not again within the minute", async () => {
    let asked = 0;
    let clock = 1_000_000;
    const feed = createUiFeed(
      () => {},
      () => clock,
    );
    feed.attach({
      who: "Ada",
      send: async () => ({ ok: true, said: "" }),
      load: async () => {
        asked++;
        return [
          { id: "a", text: "older", at: 100 },
          { id: "b", text: "newer", at: 200 },
        ];
      },
    });
    expect(asked).toBe(0);
    feed.opened();
    expect(feed.view().loading).toBe(true);
    await tick();
    expect(feed.view().loading).toBe(false);
    expect(feed.view().posts.map((p) => p.text)).toEqual(["newer", "older"]);
    feed.opened();
    expect(asked).toBe(1);
    clock += 61_000;
    feed.opened();
    await tick();
    expect(asked).toBe(2);
    // The same posts again are the same posts.
    expect(feed.view().posts).toHaveLength(2);
  });

  it("shows a post as plain words, cut short, whatever it holds", async () => {
    const feed = createUiFeed(() => {});
    feed.attach({ who: "Ada", send: async () => ({ ok: true, said: "" }), load: async () => [{ id: "a", text: `line one\n\nline two${String.fromCodePoint(0x202e)} ${"x".repeat(2000)}`, at: 5 }] });
    feed.opened();
    await tick();
    const text = feed.view().posts[0]!.text;
    expect(text.startsWith("line one line two")).toBe(true);
    expect(text.includes("\n") || text.includes(String.fromCodePoint(0x202e))).toBe(false);
    expect([...text].length).toBeLessThanOrEqual(FEED_LIMITS.shown);
  });

  it("says so when their posts couldn't be had, and keeps what it has", async () => {
    const feed = createUiFeed(() => {});
    feed.attach({ who: "Ada", send: async () => ({ ok: true, said: "" }), load: async () => null });
    feed.opened();
    await tick();
    expect(feed.view().said).toMatch(/couldn't be fetched/);
    expect(feed.view().posts).toEqual([]);
  });

  it("puts what is sent at the top at once, and says how it went", async () => {
    const sent: string[] = [];
    let ok = true;
    const feed = createUiFeed(() => {});
    feed.attach({
      who: "Ada",
      send: async (text) => {
        sent.push(text);
        return ok ? { ok: true, said: "Sent out, to 2 relays." } : { ok: false, said: "That wasn't sent." };
      },
    });
    expect(feed.send("  hello   world ")).toBeNull();
    expect(feed.view().posts[0]).toMatchObject({ text: "hello world", state: "sending" });
    await tick();
    expect(sent).toEqual(["hello world"]);
    expect(feed.view().posts[0]!.state).toBe("out");
    expect(feed.view().said).toBe("Sent out, to 2 relays.");
    ok = false;
    feed.send("second");
    await tick();
    expect(feed.view().posts[0]).toMatchObject({ text: "second", state: "failed" });
    // Nothing empty is sent.
    feed.send("   ");
    expect(sent).toHaveLength(2);
  });

  it("forgets one person's posts when another signs in", async () => {
    const feed = createUiFeed(() => {});
    feed.attach({ who: "Ada", send: async () => ({ ok: true, said: "" }) });
    feed.send("mine");
    feed.attach({ who: "Bo", send: async () => ({ ok: true, said: "" }) });
    await tick();
    expect(feed.view()).toMatchObject({ who: "Bo", posts: [] });
  });

  it("says how long ago in a few words", () => {
    const now = 1_000_000;
    expect(ago(now - 5, now)).toBe("just now");
    expect(ago(now - 300, now)).toBe("5 min ago");
    expect(ago(now - 7200, now)).toBe("2 h ago");
    expect(ago(now - 86400, now)).toBe("1 day ago");
    expect(ago(now - 86400 * 3, now)).toBe("3 days ago");
    expect(ago(0, 10_000_000)).toBe("1970-01-01");
  });
});
