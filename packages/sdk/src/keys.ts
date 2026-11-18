/**
 * A keyboard, as data: which keys there are, where each sits, and what
 * pressing one does to the words so far. No three.js and no page here, so it
 * is tested like arithmetic. `keyboard.ts` draws it in a headset.
 */

export type KeyKind = "char" | "shift" | "back" | "layer" | "space" | "enter" | "cancel" | "done" | "system" | "esc" | "tab" | "ctrl" | "up" | "down" | "left" | "right" | "close";

export interface Key {
  /** What a press of it is called: the character itself for a letter, a word for the rest. */
  id: string;
  /** What is written on it. */
  label: string;
  kind: KeyKind;
  /** How wide it is, in the width of one letter key. */
  w: number;
}

export interface PlacedKey extends Key {
  /** Its place on the board, each from 0 to 1: left edge, top edge, width, height. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Layer = "letters" | "symbols";

const chars = (row: string): Key[] => [...row].map((c) => ({ id: c, label: c, kind: "char" as const, w: 1 }));
const key = (id: string, label: string, kind: KeyKind, w: number): Key => ({ id, label, kind, w });

/** The rows of a layer, top to bottom. Every row is ten letter-widths across, or is centred if it is shorter. */
export function keyRows(layer: Layer, o: { system?: boolean; multiline?: boolean } = {}): Key[][] {
  const bottom = [key("layer", layer === "letters" ? "123" : "ABC", "layer", 1.5), ...chars(","), key("space", "space", "space", 4.5), ...chars("."), key("enter", o.multiline ? "new line" : "done", "enter", 2)];
  const actions = [key("cancel", "Cancel", "cancel", 3), ...(o.system ? [key("system", "Headset's keyboard", "system", 4)] : []), key("done", "Done", "done", 3)];
  if (layer === "letters") return [chars("qwertyuiop"), chars("asdfghjkl"), [key("shift", "shift", "shift", 1.5), ...chars("zxcvbnm"), key("back", "delete", "back", 1.5)], bottom, actions];
  return [chars("1234567890"), chars("-/:;()!?@"), [...chars("'\"_&#+=*"), key("back", "delete", "back", 2)], bottom, actions];
}

/** Where every key of a layer sits on a board ten letter-widths across. `rows` lays out other rows the same way. */
export function placeKeys(layer: Layer, o: { system?: boolean; multiline?: boolean } = {}, rows: Key[][] = keyRows(layer, o)): PlacedKey[] {
  const gap = 0.012;
  const height = 1 / rows.length;
  return rows.flatMap((row, r) => {
    const total = row.reduce((sum, k) => sum + k.w, 0);
    // The last row spreads to the edges; a short row of letters sits in the middle, as on any keyboard.
    const spread = r === rows.length - 1;
    const unit = spread ? 1 / total : 1 / 10;
    let x = spread ? 0 : (1 - total * unit) / 2;
    return row.map((k) => {
      const placed = { ...k, x: x + gap / 2, y: r * height + gap / 2, width: k.w * unit - gap, height: height - gap };
      x += k.w * unit;
      return placed;
    });
  });
}

/** The key under a point on the board (each from 0 to 1, y downwards), or null between keys. */
export function keyAt(keys: PlacedKey[], x: number, y: number): PlacedKey | null {
  return keys.find((k) => x >= k.x && x <= k.x + k.width && y >= k.y && y <= k.y + k.height) ?? null;
}

export type Shift = "off" | "once" | "lock";
export type Pressed = "typing" | "done" | "cancel" | "system";

/** The words so far, and what each key does to them. */
export class TextEntry {
  value: string;
  shift: Shift;
  layer: Layer = "letters";
  readonly multiline: boolean;
  readonly maxLength: number;

  constructor(o: { value?: string; multiline?: boolean; maxLength?: number } = {}) {
    this.multiline = o.multiline ?? false;
    this.maxLength = o.maxLength ?? 2000;
    this.value = [...(o.value ?? "")].slice(0, this.maxLength).join("");
    this.shift = this.startsSentence() ? "once" : "off";
  }

  /** Whether the next letter begins a sentence, and so is a capital unless the visitor says otherwise. */
  private startsSentence(): boolean {
    return /(^|[.!?]\s|\n)$/.test(this.value);
  }

  /** Add text as it is: from a real keyboard, or pasted. */
  type(text: string): void {
    const clean = this.multiline ? text.replace(/\r/g, "") : text.replace(/[\r\n]+/g, " ");
    this.value = [...(this.value + clean)].slice(0, this.maxLength).join("");
    if (this.shift !== "lock") this.shift = this.startsSentence() ? "once" : "off";
  }

  erase(): void {
    this.value = [...this.value].slice(0, -1).join("");
    if (this.shift !== "lock") this.shift = this.startsSentence() ? "once" : "off";
  }

  /** What a key shows now: a letter as a capital while shift is on. */
  label(k: Key): string {
    return k.kind === "char" && this.shift !== "off" ? k.label.toUpperCase() : k.label;
  }

  /** Press a key by its id. Returns what happened: still typing, finished, given up, or asked for the headset's own keyboard. */
  press(id: string, keys: Key[] = keyRows(this.layer, { multiline: this.multiline, system: true }).flat()): Pressed {
    const k = keys.find((x) => x.id === id);
    if (!k) return "typing";
    switch (k.kind) {
      case "char": {
        const was = this.shift;
        this.type(was === "off" ? k.id : k.id.toUpperCase());
        // One capital, then back to small letters, even mid-sentence.
        if (was === "once") this.shift = this.startsSentence() ? "once" : "off";
        return "typing";
      }
      case "space":
        this.type(" ");
        return "typing";
      case "back":
        this.erase();
        return "typing";
      case "shift":
        this.shift = this.shift === "off" ? "once" : this.shift === "once" ? "lock" : "off";
        return "typing";
      case "layer":
        this.layer = this.layer === "letters" ? "symbols" : "letters";
        return "typing";
      case "enter":
        if (!this.multiline) return "done";
        this.type("\n");
        return "typing";
      case "done":
        return "done";
      case "cancel":
        return "cancel";
      case "system":
        return "system";
      default:
        // A terminal's keys (term-keys.ts) are not on this board.
        return "typing";
    }
  }
}
