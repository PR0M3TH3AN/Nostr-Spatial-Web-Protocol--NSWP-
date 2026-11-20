/**
 * What someone has done in this world, as a few lines for their card: where they stand on its boards, and which
 * of its achievements they show (protocol/15-scores.md, protocol/16-achievements.md).
 *
 *   const about = worldPersonLines({ scores, achievements });
 *   about.lines(theirKey);   // ["Lantern Run: 41.2 s, 2nd of 14 here", "Shows 2 of 4 achievements here: First light, All twelve"]
 *
 * It says only what this world's own boards and achievements hold, which were asked of relays by world and never
 * by person. So a card is filled in without a relay ever being asked about the person on it.
 *
 * Everything it says is a claim, and the card it goes on says whose.
 */
import type { Achievements } from "./achievements.js";
import type { Scores } from "./scores.js";

/** A few lines about a person, for their card, and word of when they may have changed. */
export interface PersonLines {
  lines(pubkey: string): string[];
  onChange(fn: () => void): () => void;
}

/** "1st", "2nd", "3rd", "4th", "11th", "22nd". */
export function ordinal(n: number): string {
  const tens = n % 100;
  const last = n % 10;
  return `${n}${tens >= 11 && tens <= 13 ? "th" : last === 1 ? "st" : last === 2 ? "nd" : last === 3 ? "rd" : "th"}`;
}

/** A few names in a row, and how many more there are: "First light, All twelve and 2 more". */
export function someOf(names: readonly string[], most = 3): string {
  const shown = names.slice(0, most).join(", ");
  const rest = names.length - most;
  return rest > 0 ? `${shown} and ${rest} more` : shown;
}

export function worldPersonLines(o: { scores?: Scores | null; achievements?: Achievements | null }): PersonLines {
  const watchers = new Set<() => void>();
  const changed = () => {
    for (const fn of watchers) fn();
  };
  let asked = 0;
  /**
   * The boards and the achievements are read when someone's card is shown, and not before: afresh, so that what a
   * card says isn't what was so when the visitor last looked at a board, and again only after a minute.
   */
  const read = () => {
    if (asked && Date.now() - asked < 60_000) return;
    asked = Date.now();
    const reads: Promise<unknown>[] = [];
    for (const b of o.scores?.boards ?? []) reads.push(o.scores!.standings(b.id, true).catch(() => null));
    if (o.achievements?.list.length) reads.push(o.achievements.holders(true).catch(() => null));
    void Promise.all(reads).then(changed);
  };
  o.scores?.onChange(changed);
  o.achievements?.onChange(changed);
  return {
    lines(pubkey) {
      read();
      const out: string[] = [];
      for (const b of o.scores?.boards ?? []) {
        const at = o.scores!.standingOf(b.id, pubkey);
        if (at) out.push(`${b.title}: ${o.scores!.words(b.id, at.score)}, ${ordinal(at.rank)} of ${at.of} here`);
      }
      const held = o.achievements?.heldBy(pubkey) ?? [];
      if (held.length) out.push(`Shows ${held.length} of ${o.achievements!.list.length} achievements here: ${someOf(held.map((a) => a.title))}`);
      return out;
    },
    onChange(fn) {
      watchers.add(fn);
      return () => void watchers.delete(fn);
    },
  };
}
