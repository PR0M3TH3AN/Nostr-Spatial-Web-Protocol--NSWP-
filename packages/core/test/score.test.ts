import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";
import { buildScore, cleanBoard, cleanScore, finalizeEvent, getPublicKey, isScoreAsked, parseScore, rankScores, readSignerRequest, SCORE_KIND, scoreForWorld, scoreWords, signClass, signerMessage, type NostrEvent } from "../src/index.js";

const key = (n: number) => sha256(utf8ToBytes(`nswp score test key ${n}`));
const pk = (n: number) => getPublicKey(key(n));
const WORLD = `37300:${pk(90)}:arcade`;
const URL_ = "https://arcade.example/";
const T = 1_800_000_000;
/** A score as a visitor's signer makes it for a world: marked with the site that asked. */
const post = (by: number, score: number, o: { at?: number; origin?: string; board?: string; world?: string } = {}): NostrEvent =>
  finalizeEvent(scoreForWorld({ world: o.world ?? WORLD, board: o.board ?? "lantern-run", score, origin: o.origin ?? "https://arcade.example", now: o.at ?? T })!, key(by));
const board = (events: NostrEvent[], o: Partial<Parameters<typeof rankScores>[1]> = {}) => rankScores(events, { world: WORLD, board: "lantern-run", order: "low", worldUrl: URL_, ...o });

describe("a score", () => {
  it("says who made what, on which board of which world", () => {
    const e = post(1, 42_500);
    expect(e.kind).toBe(SCORE_KIND);
    expect(parseScore(e)).toEqual({ by: pk(1), world: WORLD, board: "lantern-run", score: 42_500, at: T, askedAt: ["https://arcade.example"] });
    expect(e.tags.find((t) => t[0] === "d")?.[1]).toBe(`${WORLD}/lantern-run`);
  });

  it("is a whole number, zero or more, on a named board of a world, or it is nothing", () => {
    for (const bad of [-1, 1.5, Number.NaN, 2 ** 60, "many"]) expect(cleanScore(bad), String(bad)).toBeNull();
    expect(cleanScore("120")).toBe(120);
    expect(cleanScore(0)).toBe(0);
    for (const bad of ["", "Main", "a b", "x".repeat(33), 5]) expect(cleanBoard(bad), String(bad)).toBe("");
    expect(buildScore({ world: "30004:" + pk(1) + ":a-list", board: "main", score: 1, now: T })).toBeNull();
    expect(buildScore({ world: WORLD, board: "Main", score: 1, now: T })).toBeNull();
    const e = post(1, 10);
    expect(parseScore({ ...e, tags: e.tags.map((t) => (t[0] === "d" ? ["d", `${WORLD}/another`] : t)) })).toBeNull();
    expect(parseScore({ ...e, kind: 1 })).toBeNull();
  });

  it("is said the way its board counts", () => {
    expect(scoreWords({ format: "number" }, 1234567)).toBe("1,234,567");
    expect(scoreWords({ format: "time" }, 42_500)).toBe("42.5 s");
    expect(scoreWords({ format: "time" }, 125_340)).toBe("2 min 5.3 s");
  });

  it("is checked by the world that asked for it: theirs, that score, marked for that site", () => {
    const e = post(1, 42_500);
    const asked = { pubkey: pk(1), world: WORLD, board: "lantern-run", score: 42_500, origin: "https://arcade.example" };
    expect(isScoreAsked(e, asked)).toBe(true);
    expect(isScoreAsked(e, { ...asked, score: 1 })).toBe(false);
    expect(isScoreAsked(e, { ...asked, pubkey: pk(2) })).toBe(false);
    expect(isScoreAsked(e, { ...asked, origin: "https://elsewhere.example" })).toBe(false);
    expect(isScoreAsked(finalizeEvent(buildScore({ world: WORLD, board: "lantern-run", score: 42_500, now: T })!, key(1)), asked)).toBe(false);
  });

  it("is asked of a signer by its own message, and never by `sign`", () => {
    expect(readSignerRequest(signerMessage({ t: "score", id: "c1", world: WORLD, board: "lantern-run", score: 42_500 }))).toEqual({ t: "score", id: "c1", world: WORLD, board: "lantern-run", score: 42_500 });
    expect(readSignerRequest(signerMessage({ t: "score", id: "c1", world: "nowhere", board: "lantern-run", score: 1 }))).toBeNull();
    expect(readSignerRequest(signerMessage({ t: "score", id: "c1", world: WORLD, board: "lantern-run", score: -5 }))).toBeNull();
    expect(signClass(SCORE_KIND)).toBe("careful");
  });
});

describe("a board", () => {
  it("ranks each person's newest score, best first, and whoever posted first where two are level", () => {
    const b = board([post(1, 50_000), post(1, 41_000, { at: T + 60 }), post(2, 39_500), post(3, 41_000, { at: T + 10 })]);
    expect([...b.others].map((s) => [s.by, s.score, s.rank])).toEqual([[pk(2), 39_500, 1], [pk(3), 41_000, 2], [pk(1), 41_000, 3]]);
    expect(b.count).toBe(3);
    expect(board([post(1, 10), post(2, 30)], { order: "high" }).others.map((s) => s.by)).toEqual([pk(2), pk(1)]);
  });

  it("lists the people a reader has reason to know apart and first, with their place among everyone", () => {
    const b = board([post(1, 50_000), post(2, 39_500), post(3, 41_000), post(4, 60_000)], { counted: [pk(1)], me: pk(4) });
    expect(b.known.map((s) => [s.by, s.rank])).toEqual([[pk(1), 3], [pk(4), 4]]);
    expect(b.others.map((s) => s.by)).toEqual([pk(2), pk(3)]);
    expect(b.mine).toMatchObject({ by: pk(4), rank: 4, known: true });
  });

  it("has nothing on it that wasn't asked for at the world itself", () => {
    const elsewhere = post(2, 1, { origin: "https://cheat.example" });
    const unmarked = finalizeEvent(buildScore({ world: WORLD, board: "lantern-run", score: 2, now: T })!, key(3));
    expect(board([post(1, 50_000), elsewhere, unmarked]).others.map((s) => s.by)).toEqual([pk(1)]);
  });

  it("takes no score that isn't really signed, or is of another world or board", () => {
    const real = post(1, 50_000);
    const forged = { ...post(2, 1), pubkey: pk(1), created_at: T + 99 };
    expect(board([real, forged, post(3, 1, { board: "other" }), post(4, 1, { world: `37300:${pk(90)}:grove` })]).others.map((s) => [s.by, s.score])).toEqual([[pk(1), 50_000]]);
  });

  it("shows a few of everyone else at most, and is empty with nothing to go on", () => {
    const many = Array.from({ length: 30 }, (_, i) => post(i + 1, 1000 + i));
    expect(board(many).others.length).toBe(20);
    expect(board(many).count).toBe(30);
    expect(board([])).toEqual({ known: [], others: [], mine: null, count: 0 });
  });
});
