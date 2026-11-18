/**
 * Typing into a terminal, as data: what each key sends. A terminal takes
 * bytes, not words, and takes them as they are typed, so this is a different
 * thing from `keys.ts`, where a visitor writes a line and then says done. No
 * three.js and no page here, so it is tested like arithmetic.
 */
import { keyRows, placeKeys, type Key, type KeyKind, type PlacedKey, type Shift } from "./keys.js";

const ESC = "\x1b";

/** What a letter becomes with Ctrl held: Ctrl-C is 3, Ctrl-[ is escape. Anything else is itself. */
export function ctrlCode(ch: string): string {
  if (/^[a-zA-Z]$/.test(ch)) return String.fromCharCode(ch.toUpperCase().charCodeAt(0) - 64);
  const others: Record<string, number> = { "@": 0, " ": 0, "[": 27, "\\": 28, "]": 29, "^": 30, _: 31, "?": 127 };
  return ch in others ? String.fromCharCode(others[ch]!) : ch;
}

const NAMED: Record<string, string> = {
  Enter: "\r",
  Backspace: "\x7f",
  Tab: "\t",
  Escape: ESC,
  ArrowUp: `${ESC}[A`,
  ArrowDown: `${ESC}[B`,
  ArrowRight: `${ESC}[C`,
  ArrowLeft: `${ESC}[D`,
  Home: `${ESC}[H`,
  End: `${ESC}[F`,
  Insert: `${ESC}[2~`,
  Delete: `${ESC}[3~`,
  PageUp: `${ESC}[5~`,
  PageDown: `${ESC}[6~`,
  F1: `${ESC}OP`,
  F2: `${ESC}OQ`,
  F3: `${ESC}OR`,
  F4: `${ESC}OS`,
};

export interface TypedKey {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

/**
 * What a key on a real keyboard sends, or null for one that is not the
 * terminal's: a modifier by itself, and the browser's own copy and paste
 * (Ctrl-Shift-C and -V, and Cmd with anything). Ctrl-V is left to the
 * browser too, so a paste arrives as a paste.
 */
export function keyBytes(e: TypedKey): string | null {
  if (e.metaKey) return null;
  if (e.ctrlKey && e.shiftKey && /^[cv]$/i.test(e.key)) return null;
  if (e.ctrlKey && !e.altKey && /^v$/i.test(e.key)) return null;
  if (e.key === "Tab" && e.shiftKey) return `${ESC}[Z`;
  const named = NAMED[e.key];
  if (named !== undefined) return e.altKey ? ESC + named : named;
  if ([...e.key].length !== 1) return null;
  const ch = e.ctrlKey ? ctrlCode(e.key) : e.key;
  return e.altKey ? ESC + ch : ch;
}

/** In a program that asked for it (an editor, a pager), the arrows and Home and End are sent another way. */
export function forApplication(bytes: string, applicationCursor: boolean): string {
  return applicationCursor ? bytes.replace(/^\x1b\[([ABCDHF])$/, `${ESC}O$1`) : bytes;
}

/** Text pasted in, wrapped the way a program that asked to be told about pastes expects. A paste can't end itself early. */
export function pasteBytes(text: string, bracketed: boolean): string {
  const clean = text.replace(/\r?\n/g, "\r");
  return bracketed ? `${ESC}[200~${clean.replace(/\x1b\[20[01]~/g, "")}${ESC}[201~` : clean;
}

// ------------------------------------------------------- the drawn keyboard

export type LiveLayer = "letters" | "symbols" | "more";

const chars = (row: string): Key[] => [...row].map((c) => ({ id: c, label: c, kind: "char" as const, w: 1 }));
const key = (id: string, label: string, kind: KeyKind, w: number): Key => ({ id, label, kind, w });

/**
 * The rows of the keyboard a terminal gets: the same letters, with a row
 * above them for what a terminal needs and words don't, and no Done. It
 * stays up until it is put away.
 */
export function liveRows(layer: LiveLayer): Key[][] {
  const top = [key("esc", "esc", "esc", 1.4), key("tab", "tab", "tab", 1.4), key("ctrl", "ctrl", "ctrl", 1.4), key("left", "←", "left", 1), key("down", "↓", "down", 1), key("up", "↑", "up", 1), key("right", "→", "right", 1), ...chars("/-").map((k, i) => ({ ...k, w: i ? 0.8 : 1 }))];
  const next = layer === "letters" ? "123" : layer === "symbols" ? "#+=" : "abc";
  const bottom = [key("layer", next, "layer", 1.5), ...chars(","), key("space", "space", "space", 4.5), ...chars("."), key("enter", "enter", "enter", 2)];
  const away = [key("close", "Put the keyboard away", "close", 10)];
  if (layer === "letters") return [top, ...keyRows("letters").slice(0, 3), bottom, away];
  if (layer === "symbols") return [top, chars("1234567890"), chars(":;()$&@\"'_"), [...chars("|~<>{}[]\\"), key("back", "del", "back", 1)], bottom, away];
  // The last layer has the keys a pager or an editor wants: a page at a time, and the ends of a line.
  const pages = [key("pgup", "page up", "pgup", 2.5), key("pgdn", "page down", "pgdn", 2.5), key("home", "home", "home", 1.5), key("end", "end", "end", 1.5), key("back", "delete", "back", 2)];
  return [top, chars("!?`#+=*%^"), pages, bottom, away];
}

/** Where every key sits, as `placeKeys` lays them. */
export function placeLiveKeys(layer: LiveLayer): PlacedKey[] {
  return placeKeys("letters", {}, liveRows(layer));
}

export type LivePressed = { send: string } | { close: true } | null;

/** The drawn keyboard's own state: shift, ctrl and which layer, and what each press sends. */
export class LiveKeys {
  shift: Shift = "off";
  /** Ctrl is pressed first, then the letter: there is one pointer, not ten fingers. */
  ctrl = false;
  layer: LiveLayer = "letters";

  /** Whether a key should be drawn lit. */
  lit(k: Key): boolean {
    return (k.kind === "shift" && this.shift !== "off") || (k.kind === "ctrl" && this.ctrl);
  }

  label(k: Key): string {
    return k.kind === "char" && this.shift !== "off" ? k.label.toUpperCase() : k.label;
  }

  press(id: string, keys: Key[] = liveRows(this.layer).flat()): LivePressed {
    const k = keys.find((x) => x.id === id);
    if (!k) return null;
    const send = (bytes: string): LivePressed => {
      const out = this.ctrl ? ctrlCode(bytes) : bytes;
      this.ctrl = false;
      return { send: out };
    };
    switch (k.kind) {
      case "char": {
        const ch = this.shift === "off" ? k.id : k.id.toUpperCase();
        if (this.shift === "once") this.shift = "off";
        return send(ch);
      }
      case "space":
        return send(" ");
      case "enter":
        return send("\r");
      case "back":
        return send("\x7f");
      case "tab":
        return send("\t");
      case "esc":
        return send(ESC);
      case "up":
        return send(`${ESC}[A`);
      case "down":
        return send(`${ESC}[B`);
      case "right":
        return send(`${ESC}[C`);
      case "left":
        return send(`${ESC}[D`);
      case "pgup":
        return send(`${ESC}[5~`);
      case "pgdn":
        return send(`${ESC}[6~`);
      case "home":
        return send(`${ESC}[H`);
      case "end":
        return send(`${ESC}[F`);
      case "shift":
        this.shift = this.shift === "off" ? "once" : this.shift === "once" ? "lock" : "off";
        return null;
      case "ctrl":
        this.ctrl = !this.ctrl;
        return null;
      case "layer":
        this.layer = this.layer === "letters" ? "symbols" : this.layer === "symbols" ? "more" : "letters";
        return null;
      case "close":
        return { close: true };
      default:
        return null;
    }
  }
}
