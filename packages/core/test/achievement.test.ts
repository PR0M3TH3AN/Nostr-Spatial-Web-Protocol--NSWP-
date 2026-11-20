import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";
import { ACHIEVEMENT_KIND, achievementForWorld, achievementsIn, buildAchievement, cleanAchievementId, finalizeEvent, getPublicKey, isAchievementAsked, parseAchievement, readSignerRequest, signClass, signerMessage, type NostrEvent } from "../src/index.js";

const key = (n: number) => sha256(utf8ToBytes(`nswp achievement test key ${n}`));
const pk = (n: number) => getPublicKey(key(n));
const WORLD = `37300:${pk(90)}:arcade`;
const T = 1_800_000_000;
/** An achievement as a visitor's signer makes it for a world: marked with the site that asked. */
const hold = (by: number, id: string, o: { at?: number; origin?: string; title?: string; world?: string } = {}): NostrEvent =>
  finalizeEvent(achievementForWorld({ world: o.world ?? WORLD, id, title: o.title ?? "All twelve", origin: o.origin ?? "https://arcade.example", now: o.at ?? T })!, key(by));
const read = (events: NostrEvent[], o: { counted?: string[]; me?: string | null } = {}) => achievementsIn(events, { world: WORLD, worldUrl: "https://arcade.example/", ...o });

describe("an achievement someone holds", () => {
  it("says who holds which achievement of which world, and what it is called", () => {
    const e = hold(1, "all-twelve", { title: "  All   twelve " });
    expect(e.kind).toBe(ACHIEVEMENT_KIND);
    expect(parseAchievement(e)).toEqual({ by: pk(1), world: WORLD, id: "all-twelve", title: "All twelve", at: T, askedAt: ["https://arcade.example"] });
    expect(e.tags.find((t) => t[0] === "d")?.[1]).toBe(`${WORLD}/all-twelve`);
  });

  it("is of a named achievement of a world, with a title, or it is nothing", () => {
    for (const bad of ["", "All Twelve", "a b", "x".repeat(33), 7]) expect(cleanAchievementId(bad), String(bad)).toBe("");
    expect(buildAchievement({ world: WORLD, id: "all-twelve", title: "   ", now: T })).toBeNull();
    expect(buildAchievement({ world: "30004:" + pk(1) + ":a-list", id: "all-twelve", title: "All twelve", now: T })).toBeNull();
    const e = hold(1, "all-twelve");
    expect(parseAchievement({ ...e, tags: e.tags.map((t) => (t[0] === "d" ? ["d", `${WORLD}/another`] : t)) })).toBeNull();
    expect(parseAchievement({ ...e, kind: 1 })).toBeNull();
    // A title is cut to a line of no great length, whatever was signed.
    expect(parseAchievement(hold(1, "all-twelve", { title: "x".repeat(300) }))!.title.length).toBe(60);
  });

  it("is checked by the world that asked for it, and asked of a signer by its own message", () => {
    const e = hold(1, "all-twelve");
    const asked = { pubkey: pk(1), world: WORLD, id: "all-twelve", title: "All twelve", origin: "https://arcade.example" };
    expect(isAchievementAsked(e, asked)).toBe(true);
    expect(isAchievementAsked(e, { ...asked, id: "first-lantern" })).toBe(false);
    expect(isAchievementAsked(e, { ...asked, title: "Something grander" })).toBe(false);
    expect(isAchievementAsked(e, { ...asked, pubkey: pk(2) })).toBe(false);
    expect(isAchievementAsked(e, { ...asked, origin: "https://elsewhere.example" })).toBe(false);
    expect(readSignerRequest(signerMessage({ t: "achieve", id: "a1", world: WORLD, achievement: "all-twelve", title: " All twelve " }))).toEqual({ t: "achieve", id: "a1", world: WORLD, achievement: "all-twelve", title: "All twelve" });
    expect(readSignerRequest(signerMessage({ t: "achieve", id: "a1", world: WORLD, achievement: "All Twelve", title: "All twelve" }))).toBeNull();
    expect(readSignerRequest(signerMessage({ t: "achieve", id: "a1", world: "nowhere", achievement: "all-twelve", title: "All twelve" }))).toBeNull();
    expect(signClass(ACHIEVEMENT_KIND)).toBe("careful");
  });
});

describe("who holds what in a world", () => {
  it("counts each person once for each achievement, and names the ones a reader knows", () => {
    const got = read([hold(1, "all-twelve"), hold(1, "all-twelve", { at: T + 9 }), hold(2, "all-twelve"), hold(3, "all-twelve"), hold(2, "first-lantern")], { counted: [pk(2)], me: pk(3) }).byId;
    expect(got.get("all-twelve")).toEqual({ id: "all-twelve", holders: 3, known: [pk(2)], mine: true });
    expect(got.get("first-lantern")).toEqual({ id: "first-lantern", holders: 1, known: [pk(2)], mine: false });
  });

  it("takes nothing that wasn't asked for at the world itself, or isn't really signed", () => {
    const elsewhere = hold(2, "all-twelve", { origin: "https://handout.example" });
    const unmarked = finalizeEvent(buildAchievement({ world: WORLD, id: "all-twelve", title: "All twelve", now: T })!, key(3));
    const forged = { ...hold(4, "all-twelve"), pubkey: pk(5) };
    const other = hold(6, "all-twelve", { world: `37300:${pk(90)}:grove` });
    const got = read([hold(1, "all-twelve"), elsewhere, unmarked, forged, other]);
    expect(got.byId.get("all-twelve")?.holders).toBe(1);
    expect(got.held.map((a) => a.by)).toEqual([pk(1)]);
  });

  it("is empty with nothing to go on", () => {
    expect(read([]).byId.size).toBe(0);
  });
});
