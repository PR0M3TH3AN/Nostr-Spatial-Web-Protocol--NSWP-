/**
 * Room chat: a few written words, said to the people in the room with you
 * (protocol/06-rooms.md, "Words").
 *
 * It travels the way a pose does: straight from one browser to the others, on
 * the connection a room already has. No relay sees it, nothing signs it, and
 * nobody keeps it: it is gone when the room is left. Who said something is
 * whoever holds the connection it arrived on, so a name beside a line is the
 * member's name as the room already knows it, never anything in the line.
 *
 * This file is the pure part: what a line looks like on the wire, how it is
 * tidied before it is shown, and how many of them one member may say.
 */

export const CHAT_LIMITS = {
  /** The most characters in one thing said. Longer is cut, by the one saying it and again by the one reading. */
  chars: 240,
  /** A line is sent this many times, because the channel doesn't try again; a reader takes the first. */
  repeats: 3,
  repeatGapMs: 180,
  /** No more than `burst` lines from one member in `perMs`. The rest are dropped, unseen. */
  burst: 5,
  perMs: 10000,
  /** How many lines a reader keeps for the visit. */
  kept: 100,
  /** How many ids are remembered for each member, to know a repeat from a new line. */
  remembered: 32,
} as const;

/** Code points that are never shown: controls, and the invisible ones that reorder or hide text. */
const UNSEEN: readonly (readonly [number, number])[] = [
  [0x00, 0x1f],
  [0x7f, 0x9f],
  [0x200b, 0x200c],
  // 0x200d joins the parts of one emoji, and stays.
  [0x200e, 0x200f],
  [0x2028, 0x202f],
  [0x2060, 0x206f],
  [0xfeff, 0xfeff],
  [0xfff9, 0xfffb],
];
const unseen = (code: number): boolean => UNSEEN.some(([from, to]) => code >= from && code <= to);

/**
 * Something said, as it may be shown: one line, nothing invisible that
 * reorders or hides text, no doubled spaces, at most `CHAT_LIMITS.chars`
 * characters. Returns "" when nothing is left, or for anything not a string.
 */
export function cleanChat(text: unknown): string {
  if (typeof text !== "string") return "";
  let out = "";
  // Read no further than could matter: a megabyte of spaces isn't walked through.
  for (const ch of text.slice(0, CHAT_LIMITS.chars * 8).normalize("NFC")) out += unseen(ch.codePointAt(0)!) ? " " : ch;
  out = out.replace(/\s+/g, " ").trim();
  return [...out].slice(0, CHAT_LIMITS.chars).join("").trim();
}

/** A new id for a line: eight hex digits, random. It only tells a repeat from a new line. */
export function chatId(): string {
  const bytes = new Uint8Array(4);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** A line as it goes on the room's channel, or null if there is nothing to say. */
export function buildSay(text: string, id: string = chatId()): string | null {
  const cleaned = cleanChat(text);
  if (!cleaned || !/^[0-9a-f]{8}$/.test(id)) return null;
  return `say:${id}:${cleaned}`;
}

/** Read a line off the channel. Null for anything that isn't one, or that says nothing. */
export function parseSay(data: unknown): { id: string; text: string } | null {
  if (typeof data !== "string" || !data.startsWith("say:") || data[12] !== ":") return null;
  const id = data.slice(4, 12);
  if (!/^[0-9a-f]{8}$/.test(id)) return null;
  const text = cleanChat(data.slice(13));
  return text ? { id, text } : null;
}

export interface ChatGate {
  /**
   * Whether this line is one to show: not a repeat of one already taken, and
   * not past what one member may say in a while. `now` is in milliseconds.
   */
  take(id: string, now: number): boolean;
  /** Whether another line could be said now, without saying one. */
  room(now: number): boolean;
}

/** One member's lines, counted. A reader keeps one for each member, and one for the visitor's own. */
export function createChatGate(limits: { burst: number; perMs: number; remembered: number } = CHAT_LIMITS): ChatGate {
  const ids: string[] = [];
  let times: number[] = [];
  const recent = (now: number) => (times = times.filter((t) => now - t < limits.perMs));
  return {
    take(id, now) {
      if (ids.includes(id)) return false;
      ids.push(id);
      if (ids.length > limits.remembered) ids.shift();
      // One past the limit is remembered all the same, so its repeats are dropped with it.
      if (recent(now).length >= limits.burst) return false;
      times.push(now);
      return true;
    },
    room(now) {
      return recent(now).length < limits.burst;
    },
  };
}

/** How long a line stays over someone's head, in seconds: longer for more words, within reason. */
export function bubbleSeconds(text: string): number {
  return Math.min(12, 4 + [...text].length * 0.06);
}
