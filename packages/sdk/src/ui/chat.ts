/**
 * Written chat: what the people in a room write to each other, as the
 * controls hold it (protocol/06-rooms.md, "Words").
 *
 * This is the part every renderer shares: the lines said during this visit to
 * a room, how to say one, and whether the visitor wants to see any. The HUD
 * draws it as a panel at the side of the screen, a headset as a panel that
 * floats, and the room draws each line over the head of whoever wrote it.
 *
 * Nothing here is kept: the lines are in memory, for as long as the room is
 * joined, and are forgotten when it is left. Whether a visitor sees chat at
 * all is theirs to choose, and goes with them from world to world.
 */
import { CHAT_LIMITS, cleanChat } from "@nswp/core";
import { arrivedSettings, reportSettings } from "../settings.js";

/** Where the preference is kept, for this site. */
export const CHAT_KEY = "nswp:chat";

let shown: boolean | null = null;
const watchers = new Set<() => void>();

/** Whether this visitor sees what people write, and may write. On, unless they turned it off here or where they came from. */
export function showsChat(): boolean {
  if (shown !== null) return shown;
  const came = arrivedSettings().chat;
  let kept: string | null = null;
  try {
    kept = localStorage.getItem(CHAT_KEY);
  } catch {
    /* nothing kept */
  }
  shown = came ?? kept !== "0";
  if (came !== undefined) keep(shown);
  reportSettings("chat", () => ({ chat: showsChat() }), (now) => void (now.chat !== undefined && now.chat !== shown && setShowsChat(now.chat)));
  return shown;
}
const keep = (on: boolean): void => {
  try {
    if (on) localStorage.removeItem(CHAT_KEY);
    else localStorage.setItem(CHAT_KEY, "0");
  } catch {
    /* it lasts for this visit */
  }
};
export function setShowsChat(on: boolean): void {
  showsChat();
  shown = on;
  keep(on);
  for (const w of watchers) w();
}
/** Hear of the preference changing. Returns how to stop. */
export function onChatChange(cb: () => void): () => void {
  watchers.add(cb);
  return () => void watchers.delete(cb);
}
/** For tests: forget what was read. */
export function resetChat(): void {
  shown = null;
  watchers.clear();
}

/** One line in the panel. */
export interface ChatLine {
  /** Tells it from every other line here. */
  key: string;
  /** Who wrote it, as the room knows them. Empty for a note. */
  who: string;
  text: string;
  /** The visitor wrote it themselves. */
  mine: boolean;
  /** Not something anyone wrote: someone came, someone left. */
  note: boolean;
  /** A colour for their name, as CSS, or "". */
  color: string;
  /** When it was read here, in milliseconds. */
  at: number;
}

export interface ChatView {
  /** There is somewhere to write: a room is joined, and the visitor sees chat. */
  ready: boolean;
  /** What the panel is called. */
  title: string;
  lines: ChatLine[];
  /** How many lines have arrived since the visitor last looked. */
  unread: number;
  /** The most characters in one line. */
  limit: number;
  /** Goes up whenever anything above changes, so a renderer knows to draw again. */
  version: number;
}

export interface UiChat {
  /**
   * There is somewhere to write now: a room was joined. `send` takes what the
   * visitor wrote and says it; it returns a few words for them if it couldn't
   * be said, or nothing.
   */
  attach(send: (text: string) => string | null | void, opts?: { title?: string }): void;
  /** The room was left: there is nowhere to write, and what was written is forgotten. */
  detach(): void;
  /** A line arrived, or was said. A note is a line nobody wrote: someone came, someone left. */
  add(line: { who?: string; text: string; mine?: boolean; note?: boolean; color?: string; id?: string }): void;
  /** Say what the visitor wrote. Returns a few words for them if it couldn't be said, or null. */
  send(text: string): string | null;
  /** The visitor is looking at the lines: none are unread. */
  seen(): void;
  view(): ChatView;
}

/** The chat a set of controls holds. `changed` is called whenever a renderer should draw again. */
export function createUiChat(changed: () => void): UiChat {
  let send: ((text: string) => string | null | void) | null = null;
  let title = "Room chat";
  let lines: ChatLine[] = [];
  let unread = 0;
  let version = 0;
  let count = 0;
  const bump = () => {
    version++;
    changed();
  };
  // Turned off, what was written is put away at once, and comes back empty.
  onChatChange(() => {
    if (!showsChat()) {
      lines = [];
      unread = 0;
    }
    bump();
  });
  return {
    attach(fn, opts = {}) {
      send = fn;
      title = opts.title ?? "Room chat";
      lines = [];
      unread = 0;
      bump();
    },
    detach() {
      if (!send && !lines.length) return;
      send = null;
      lines = [];
      unread = 0;
      bump();
    },
    add(line) {
      if (!send || !showsChat()) return;
      const text = cleanChat(line.text);
      if (!text) return;
      lines.push({ key: `${line.id ?? "n"}-${++count}`, who: line.note ? "" : cleanChat(line.who ?? "").slice(0, 48), text, mine: !!line.mine, note: !!line.note, color: line.color ?? "", at: Date.now() });
      if (lines.length > CHAT_LIMITS.kept) lines = lines.slice(-CHAT_LIMITS.kept);
      if (!line.mine && !line.note) unread++;
      bump();
    },
    send(text) {
      if (!send || !showsChat()) return "There is nobody to write to: join the room first.";
      if (!cleanChat(text)) return null;
      return send(text) ?? null;
    },
    seen() {
      if (!unread) return;
      unread = 0;
      bump();
    },
    view() {
      return { ready: !!send && showsChat(), title, lines, unread, limit: CHAT_LIMITS.chars, version };
    },
  };
}

/**
 * Break a line of words into rows no wider than `width`, as `measure` counts
 * width, and no more than `rows` of them: what doesn't fit ends in "…". A word
 * too long for a row of its own is broken where it must be.
 */
export function wrapWords(text: string, measure: (s: string) => number, width: number, rows: number): string[] {
  const out: string[] = [];
  let row = "";
  const push = (word: string) => {
    // A word wider than a whole row: as much of it as fits on each.
    let rest = [...word];
    while (rest.length) {
      let n = rest.length;
      while (n > 1 && measure(rest.slice(0, n).join("")) > width) n--;
      const piece = rest.slice(0, n).join("");
      rest = rest.slice(n);
      if (rest.length) out.push(piece);
      else row = piece;
    }
  };
  for (const word of text.split(" ").filter(Boolean)) {
    const tried = row ? `${row} ${word}` : word;
    if (measure(tried) <= width) row = tried;
    else {
      if (row) out.push(row);
      row = "";
      if (measure(word) <= width) row = word;
      else push(word);
    }
  }
  if (row) out.push(row);
  if (out.length <= rows) return out;
  const kept = out.slice(0, rows);
  let last = [...kept[rows - 1]!];
  while (last.length > 1 && measure(`${last.join("")}…`) > width) last.pop();
  kept[rows - 1] = `${last.join("").trimEnd()}…`;
  return kept;
}
