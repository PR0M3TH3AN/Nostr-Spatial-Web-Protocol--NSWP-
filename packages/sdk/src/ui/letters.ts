/**
 * A private conversation with one person, as the controls hold it (protocol/14-people-and-messages.md).
 *
 * It is the third side of the panel that has the room's chat and the visitor's public feed, and is kept apart
 * from both on purpose. What is written to the room goes to whoever is in it; what is sent out on the feed is
 * public; what is written here is for one person, and only they and the visitor can read it. So it has its own
 * name, says who it is with, and says so again where the words are typed.
 *
 * Whoever fills it (messaging.ts) holds the messages. This holds which conversation is up, and what is on its way.
 */
import { cleanMessage, MESSAGE_LIMITS } from "@nswp/core";

export interface LetterLine {
  key: string;
  mine: boolean;
  /** Who wrote it, as a name. */
  who: string;
  text: string;
  /** When, in seconds. */
  at: number;
  /** "out": it was sent, or it arrived. "sending": on its way. "failed": it wasn't sent. */
  state: "out" | "sending" | "failed";
}

export interface LettersView {
  /** A conversation is up. */
  ready: boolean;
  /** What the panel is called: "Ada, privately". */
  title: string;
  /** Who it is with, as a name. */
  with: string;
  /** Oldest first. */
  lines: LetterLine[];
  /** How the last thing sent went, in a few words. "" for nothing to say. */
  said: string;
  /** What the panel says where they write: who can read it. */
  lead: string;
  limit: number;
  version: number;
}

export interface LettersOptions {
  /** Who it is with, as a name. A function is asked each time: a name may arrive late. */
  with: string | (() => string);
  /** The conversation so far, oldest first. Asked each time it is drawn. */
  lines(): Omit<LetterLine, "state">[];
  /** Seal and send what they wrote. Resolves to whether it went, and a few words if it didn't. */
  send(text: string): Promise<{ ok: boolean; said: string }>;
  /** The visitor is looking at it. */
  seen?(): void;
}

export interface UiLetters {
  /** Put a conversation up. */
  attach(opts: LettersOptions): void;
  /** Put it away. */
  detach(): void;
  /** What the conversation holds has changed: draw it again. */
  touch(): void;
  /** The visitor is looking at it. */
  seen(): void;
  /** Send what the visitor wrote. Returns a few words if it couldn't even be tried, or null. */
  send(text: string): string | null;
  view(): LettersView;
}

export function createUiLetters(changed: () => void, now: () => number = () => Date.now()): UiLetters {
  let opts: LettersOptions | null = null;
  let waiting: LetterLine[] = [];
  let said = "";
  let version = 0;
  let count = 0;
  const bump = () => {
    version++;
    changed();
  };
  return {
    attach(next) {
      opts = next;
      waiting = [];
      said = "";
      bump();
    },
    detach() {
      if (!opts) return;
      opts = null;
      waiting = [];
      said = "";
      bump();
    },
    touch: bump,
    seen() {
      opts?.seen?.();
    },
    send(text) {
      const mine = opts;
      if (!mine) return "There is nobody to write to: choose someone first.";
      const words = cleanMessage(text);
      if (!words) return null;
      const line: LetterLine = { key: `new-${++count}`, mine: true, who: "You", text: words, at: Math.floor(now() / 1000), state: "sending" };
      waiting.push(line);
      said = "";
      bump();
      void mine
        .send(words)
        .catch(() => ({ ok: false, said: "That wasn't sent." }))
        .then((how) => {
          if (opts !== mine) return;
          // Sent: it is in the conversation now, and is no longer waiting. Not sent: it stays, marked so.
          if (how.ok) waiting = waiting.filter((l) => l !== line);
          else line.state = "failed";
          said = how.said;
          bump();
        });
      return null;
    },
    view() {
      const name = typeof opts?.with === "function" ? opts.with() : (opts?.with ?? "");
      // What is on its way, or didn't go, stands where it was written: not after everything that came later.
      const lines: LetterLine[] = opts ? [...opts.lines().map((l) => ({ ...l, state: "out" as const })), ...waiting].sort((a, b) => a.at - b.at) : [];
      return {
        ready: !!opts,
        title: name ? `${name}, privately` : "Private messages",
        with: name,
        lines,
        said,
        lead: name ? `Private: only you and ${name} can read what is written here. A relay is told who it is for, and nothing more.` : "",
        limit: MESSAGE_LIMITS.chars,
        version,
      };
    },
  };
}
