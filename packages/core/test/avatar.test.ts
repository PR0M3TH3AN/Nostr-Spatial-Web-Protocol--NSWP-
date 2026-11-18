import { describe, expect, it } from "vitest";
import { AVATAR_KIND, applyChoices, buildAvatarEvent, decodeLook, encodeLook, generatedLook, LOOK_PARTS, lookFromTags, lookToTags, markFor, markGrid, parseAvatarEvent } from "../src/index.js";

const KEY = "546f9f791aba0984777051d93605b66e87ce0dc88fb0053fbe8475eec19aa00c";

describe("generated looks", () => {
  it("gives a key the same look every time, whatever the case of its hex", () => {
    expect(generatedLook(KEY)).toEqual(generatedLook(KEY));
    expect(generatedLook(KEY.toUpperCase())).toEqual(generatedLook(KEY));
  });

  it("pins one key's look, so every implementation can check it draws the same", () => {
    expect(generatedLook(KEY)).toMatchInlineSnapshot(`
      {
        "accent": "#56819f",
        "accessory": "crest",
        "body": "robe",
        "build": "broad",
        "color": "#547f1a",
        "face": "slit",
        "finish": "matte",
        "head": "tall",
        "light": "#47f561",
        "mark": "2ab3",
        "pattern": "bands",
        "shoulders": "none",
      }
    `);
  });

  it("only ever picks from the closed lists, and makes real colours", () => {
    for (let i = 0; i < 300; i++) {
      const look = generatedLook(`seed-${i}`);
      for (const [part, list] of Object.entries(LOOK_PARTS)) expect(list).toContain(look[part as keyof typeof LOOK_PARTS]);
      for (const c of [look.color, look.accent, look.light]) expect(c).toMatch(/^#[0-9a-f]{6}$/);
      expect(look.mark).toMatch(/^[0-7][0-9a-f]{3}$/);
    }
  });

  it("makes people different from each other", () => {
    const seen = new Set(Array.from({ length: 300 }, (_, i) => JSON.stringify(generatedLook(`seed-${i}`))));
    expect(seen.size).toBe(300);
    const heads = new Set(Array.from({ length: 300 }, (_, i) => generatedLook(`seed-${i}`).head));
    expect(heads.size).toBe(LOOK_PARTS.head.length);
  });
});

describe("the mark", () => {
  it("is five rows of five, mirrored left to right, and belongs to the key", () => {
    const grid = markGrid(markFor(KEY));
    expect(grid.length).toBe(5);
    for (const row of grid) {
      expect(row.length).toBe(5);
      expect(row[0]).toBe(row[4]);
      expect(row[1]).toBe(row[3]);
    }
    expect(markFor(KEY)).not.toBe(markFor(KEY.replace("5", "6")));
  });

  it("can't be chosen: a look that asks for another mark keeps its own", () => {
    const base = generatedLook(KEY);
    expect(applyChoices(base, { mark: "7fff" }).look.mark).toBe(base.mark);
  });
});

describe("choices", () => {
  it("keeps what is valid and falls back for what isn't", () => {
    const base = generatedLook(KEY);
    const { look, warnings } = applyChoices(base, { head: "tall", color: "#FF8800", body: "wings", light: "red", nonsense: 1 });
    expect(look.head).toBe("tall");
    expect(look.color).toBe("#ff8800");
    expect(look.body).toBe(base.body);
    expect(look.light).toBe(base.light);
    expect(warnings.sort()).toEqual(["body", "light"]);
  });

  it("travels as tags and comes back the same", () => {
    const look = applyChoices(generatedLook(KEY), { head: "wedge", accessory: "halo", color: "#102030" }).look;
    expect(lookFromTags(lookToTags(look), KEY).look).toEqual(look);
  });

  it("travels as a short string and comes back the same, writing only what was chosen", () => {
    const seed = "guest-7f3a91c2";
    const look = applyChoices(generatedLook(seed), { face: "tee", pattern: "halves" }).look;
    const text = encodeLook(look, seed);
    expect(text.length).toBeLessThan(80);
    const back = decodeLook(text);
    expect(back.ok && back.value.look).toEqual(look);
    expect(JSON.parse(encodeLook(generatedLook(seed), seed))).toEqual({ s: seed });
  });

  it("refuses a look that is too long, isn't an object, or has no seed", () => {
    expect(decodeLook("x".repeat(601)).ok).toBe(false);
    expect(decodeLook("[]").ok).toBe(false);
    expect(decodeLook('{"head":"tall"}').ok).toBe(false);
    expect(decodeLook('{"s":"a b"}').ok).toBe(false);
  });
});

describe("avatar events", () => {
  it("builds kind 37301 and reads it back against the author's key", () => {
    const look = applyChoices(generatedLook(KEY), { head: "square", light: "#00ffaa" }).look;
    const event = buildAvatarEvent({ title: "Example", look, createdAt: 1 });
    expect(event.kind).toBe(AVATAR_KIND);
    expect(event.tags[0]).toEqual(["d", "default"]);
    const read = parseAvatarEvent({ ...event, pubkey: KEY });
    expect(read.ok && read.value.look).toEqual(look);
  });

  it("draws someone else's copied tags with their own mark, not the original's", () => {
    const look = generatedLook(KEY);
    const copied = parseAvatarEvent({ ...buildAvatarEvent({ look }), pubkey: "0".repeat(64) });
    expect(copied.ok && copied.value.look.mark).toBe(markFor("0".repeat(64)));
    expect(copied.ok && copied.value.look.head).toBe(look.head);
  });
});
