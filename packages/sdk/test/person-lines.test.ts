import type { Achievement, Board } from "@nswp/core";
import { describe, expect, it } from "vitest";
import type { Achievements } from "../src/achievements.js";
import { ordinal, someOf, worldPersonLines } from "../src/person-lines.js";
import type { Scores } from "../src/scores.js";

const BOARD: Board = { id: "lantern-run", title: "Lantern Run", order: "low", format: "time" };
const LIST: Achievement[] = [
  { id: "a", title: "First light" },
  { id: "b", title: "All twelve" },
  { id: "c", title: "Under a minute" },
  { id: "d", title: "Lamplighter" },
];
const ann = "a".repeat(64);
const bo = "b".repeat(64);

describe("what someone has done here, for their card", () => {
  const scores = (read: { n: number }) =>
    ({
      boards: [BOARD],
      standings: async () => {
        read.n++;
        return null;
      },
      standingOf: (_board: string, pubkey: string) => (pubkey === ann ? { score: 41_200, rank: 2, of: 14 } : null),
      words: () => "41.2 s",
      onChange: () => () => {},
    }) as unknown as Scores;
  const achievements = (held: Achievement[]) => ({ list: LIST, holders: async () => null, heldBy: (pubkey: string) => (pubkey === ann ? held : []), onChange: () => () => {} }) as unknown as Achievements;

  it("says where they stand and what they show, and nothing of someone who has done neither", () => {
    const about = worldPersonLines({ scores: scores({ n: 0 }), achievements: achievements(LIST.slice(0, 2)) });
    expect(about.lines(ann)).toEqual(["Lantern Run: 41.2 s, 2nd of 14 here", "Shows 2 of 4 achievements here: First light, All twelve"]);
    expect(about.lines(bo)).toEqual([]);
  });

  it("names a few achievements and counts the rest", () => {
    expect(worldPersonLines({ achievements: achievements(LIST) }).lines(ann)).toEqual(["Shows 4 of 4 achievements here: First light, All twelve, Under a minute and 1 more"]);
  });

  it("reads the boards once, when a card is first shown, and tells whoever draws it", async () => {
    const read = { n: 0 };
    const about = worldPersonLines({ scores: scores(read) });
    expect(read.n).toBe(0);
    let told = 0;
    about.onChange(() => told++);
    about.lines(ann);
    about.lines(bo);
    await new Promise((r) => setTimeout(r, 0));
    expect(read.n).toBe(1);
    expect(told).toBe(1);
  });

  it("is nothing for a world that keeps no score and marks nothing", () => {
    expect(worldPersonLines({}).lines(ann)).toEqual([]);
  });

  it("counts places and lists names as people say them", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st", "111th"]);
    expect(someOf(["A", "B"])).toBe("A, B");
    expect(someOf(["A", "B", "C", "D", "E"])).toBe("A, B, C and 2 more");
  });
});
