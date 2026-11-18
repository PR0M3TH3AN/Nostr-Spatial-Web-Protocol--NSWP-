/**
 * A terminal on the visitor's own computer, in a panel (browser/bridge.md).
 *
 * This is for a home, never for a world: it needs the owner's signer, and a
 * world is never given one. It is its own entry (`nswp-sdk/terminal`) so that
 * nothing else pays for the terminal emulator.
 *
 * The panel shows what stage the connection is at, with the code the
 * computer will show when it asks. Once open, press the panel to type into
 * it: with a real keyboard anywhere, and with the kit's drawn one in a
 * headset. Press anywhere else to stop typing into it.
 *
 * Along its foot are five buttons, each one press: back and forward through
 * what has scrolled away, larger and smaller letters, and copy. The panel's
 * own + and - change how large the whole panel is; these change how much
 * fits on it.
 *
 *   const term = openTerminalPanel({ panels, bridge, owner, relays, sign, presenting });
 *   term.close();
 */
import * as THREE from "three";
import { Terminal } from "@xterm/headless";
import { openBridgeLink, type BridgeLink, type BridgeStatus } from "./bridge-link.js";
import type { Panel, Panels } from "./panels.js";
import { forApplication, keyBytes, pasteBytes } from "./term-keys.js";
import type { EventTemplate, NostrEvent } from "@nswp/core";

export type { BridgeStatus } from "./bridge-link.js";

/** How many letters fit across, from the largest letters to the smallest. */
export const TERMINAL_COLUMNS = [60, 80, 100, 120, 140, 160] as const;

export type TerminalButton = "back" | "forward" | "larger" | "smaller" | "copy";

export interface TerminalPanelOptions {
  panels: Panels;
  /** The computer's Bridge, as 64 hex characters. */
  bridge: string;
  /** The owner's public key and signer. The signer is asked for one grant per connection. */
  owner: string;
  sign(template: EventTemplate): Promise<NostrEvent>;
  relays: string[];
  /** What the owner calls this computer, for the panel's bar. */
  name?: string;
  /** How many letters fit across to begin with: one of `TERMINAL_COLUMNS`. 100 unless told. */
  cols?: number;
  accent?: THREE.ColorRepresentation;
  /** Whether the visitor is in a headset now: there, pressing the panel brings up the drawn keyboard. */
  presenting?: () => boolean;
  iceServers?: RTCIceServer[];
  onStatus?(status: BridgeStatus): void;
  /** The visitor chose larger or smaller letters. A home may remember it. */
  onColumns?(cols: number): void;
  /** The panel was put away, and the connection with it. */
  onClosed?(): void;
}

export interface TerminalPanel {
  readonly panel: Panel;
  readonly status: BridgeStatus;
  /** Whether keys typed go to it. */
  readonly focused: boolean;
  /** How many letters fit across, and how many lines down. */
  readonly size: { cols: number; rows: number };
  focus(): void;
  blur(): void;
  /** Send keys, as if typed. */
  type(bytes: string): void;
  /** What is on its screen, as lines of text. */
  text(): string[];
  /** Go back or forward through what has scrolled away, by so many lines. */
  scroll(lines: number): void;
  /** Fit this many letters across: the nearest of `TERMINAL_COLUMNS`. The program is told its new size. */
  setColumns(cols: number): void;
  /** Put what is on the screen on the clipboard. Resolves false where the browser won't allow it. */
  copy(): Promise<boolean>;
  /** Where each button along the foot is on the panel's picture, each from 0 to 1 with y downwards. For a test to press. */
  buttons(): Record<TerminalButton, [number, number]>;
  close(): void;
}

// The sixteen colours every terminal program expects, chosen to read on dark glass.
const BASE = ["#1b2430", "#ff6b6b", "#7bd88f", "#ffd166", "#6cb6ff", "#d699ff", "#5fd7d7", "#d7dee7", "#5c6b7c", "#ff8f8f", "#a5f0b4", "#ffe08a", "#9fd0ff", "#e6bcff", "#93eded", "#ffffff"];
const BG = "#0a1018";
const FG = "#dfe7ef";
const QUIET = "#9fb0c0";

function paletteColor(n: number): string {
  if (n < 16) return BASE[n]!;
  if (n < 232) {
    const v = (i: number) => (i ? 55 + i * 40 : 0);
    const c = n - 16;
    return `rgb(${v(Math.floor(c / 36))},${v(Math.floor(c / 6) % 6)},${v(c % 6)})`;
  }
  const g = 8 + (n - 232) * 10;
  return `rgb(${g},${g},${g})`;
}
const rgb = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

// The picture is one size whatever fits on it, so the panel keeps its shape and larger letters are sharper, not stretched.
const W = 1920;
const SCREEN = 1152; // the height the lines have
const PAD = 24;
const STRIP = 92; // the foot: what a press will do, and the buttons
const H = SCREEN + PAD * 2 + STRIP;
const FACE = `ui-monospace, "DejaVu Sans Mono", "Liberation Mono", Menlo, Consolas, monospace`;
const BUTTONS: { id: TerminalButton; label: string; w: number }[] = [
  { id: "back", label: "▲", w: 104 },
  { id: "forward", label: "▼", w: 104 },
  { id: "larger", label: "A+", w: 104 },
  { id: "smaller", label: "A−", w: 104 },
  { id: "copy", label: "Copy", w: 150 },
];
const GAP = 12;

/** The nearest size there is to the one asked for. */
export function nearestColumns(cols: number): number {
  return TERMINAL_COLUMNS.reduce((best, c) => (Math.abs(c - cols) < Math.abs(best - cols) ? c : best), TERMINAL_COLUMNS[2]);
}

export function openTerminalPanel(o: TerminalPanelOptions): TerminalPanel {
  const accent = `#${new THREE.Color(o.accent ?? 0xffb65c).getHexString()}`;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  // How wide this face's letters are, as a share of their height.
  g.font = `100px ${FACE}`;
  const ratio = Math.max(0.4, g.measureText("M").width / 100);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  /** The size of one letter's cell, and how many lines fit, for so many letters across. */
  const measure = (cols: number) => {
    const cw = Math.floor((W - PAD * 2) / cols);
    const px = Math.floor(cw / ratio);
    const ch = Math.round(px * 1.22);
    return { cols, cw, px, ch, rows: Math.max(5, Math.floor(SCREEN / ch)), left: Math.floor((W - cw * cols) / 2) };
  };
  let cell = measure(nearestColumns(o.cols ?? 100));

  const term = new Terminal({ cols: cell.cols, rows: cell.rows, scrollback: 3000, allowProposedApi: true });
  let link: BridgeLink | null = null;
  let status: BridgeStatus = { at: "signing" };
  let focused = false;
  let closed = false;
  let scheduled = false;
  let said: { text: string; until: number } | null = null; // a word about the last button, for a moment
  const where = o.name || "your computer";

  // The buttons, from the right-hand end of the foot.
  const placed = (() => {
    let x = W - PAD;
    return [...BUTTONS].reverse().map((b) => {
      x -= b.w;
      const at = { ...b, x, y: H - STRIP + 14, h: STRIP - 28 };
      x -= GAP;
      return at;
    });
  })();
  const hintWidth = placed.at(-1)!.x - PAD * 2;

  // ------------------------------------------------------------------ drawing
  const message = (lines: { text: string; size?: number; color?: string }[]) => {
    g.textAlign = "center";
    g.textBaseline = "middle";
    const total = lines.reduce((n, l) => n + (l.size ?? 62) * 1.5, 0);
    let y = (H - STRIP) / 2 - total / 2;
    for (const l of lines) {
      const size = l.size ?? 62;
      g.font = `${size >= 150 ? "bold " : ""}${size}px system-ui, sans-serif`;
      g.fillStyle = l.color ?? FG;
      y += size * 0.75;
      g.fillText(l.text, W / 2, y, W - 120);
      y += size * 0.75;
    }
    g.textAlign = "left";
  };

  const drawScreen = () => {
    const buffer = term.buffer.active;
    const one = buffer.getNullCell();
    const { cw, ch, px, left } = cell;
    const face = `${px}px ${FACE}`;
    g.textBaseline = "middle";
    for (let y = 0; y < cell.rows; y++) {
      const line = buffer.getLine(buffer.viewportY + y);
      if (!line) continue;
      const top = PAD + y * ch;
      for (let x = 0; x < cell.cols; x++) {
        line.getCell(x, one);
        const width = one.getWidth();
        if (!width) continue; // the second half of a wide character
        let fg = one.isFgDefault() ? FG : one.isFgRGB() ? rgb(one.getFgColor()) : paletteColor(one.getFgColor());
        let bg = one.isBgDefault() ? null : one.isBgRGB() ? rgb(one.getBgColor()) : paletteColor(one.getBgColor());
        if (one.isInverse()) [fg, bg] = [bg ?? BG, fg];
        const here = buffer.viewportY === buffer.baseY && y === buffer.cursorY && x === buffer.cursorX;
        if (here && focused) [fg, bg] = [BG, accent];
        if (bg) {
          g.fillStyle = bg;
          g.fillRect(left + x * cw, top, cw * width, ch);
        }
        if (here && !focused) {
          g.strokeStyle = accent;
          g.lineWidth = 2;
          g.strokeRect(left + x * cw + 1, top + 1, cw * width - 2, ch - 2);
        }
        const chars = one.getChars();
        if (!chars || chars === " " || one.isInvisible()) continue;
        g.font = `${one.isItalic() ? "italic " : ""}${one.isBold() ? "bold " : ""}${face}`;
        g.globalAlpha = one.isDim() ? 0.6 : 1;
        g.fillStyle = fg;
        g.fillText(chars, left + x * cw, top + ch / 2 + 1);
        if (one.isUnderline()) g.fillRect(left + x * cw, top + ch - 3, cw * width, 2);
        g.globalAlpha = 1;
      }
    }
  };

  const live = () => status.at === "open" || status.at === "ended";
  const scrolledBack = () => term.buffer.active.viewportY < term.buffer.active.baseY;

  const draw = () => {
    scheduled = false;
    if (closed) return;
    g.fillStyle = BG;
    g.fillRect(0, 0, W, H);
    let hint = "";
    switch (status.at) {
      case "signing":
        message([{ text: "Asking your key to allow this…" }]);
        break;
      case "finding":
        message([{ text: `Looking for ${where}…` }, { text: `If it asks, the code is ${status.code}.`, size: 46, color: QUIET }]);
        break;
      case "asking":
        message([{ text: `Say yes at ${where}.` }, { text: status.code, size: 230, color: accent }, { text: "It is asking now, and should show this code. If the code is different, say no.", size: 46, color: QUIET }]);
        break;
      case "connecting":
        message([{ text: "Connecting…" }]);
        break;
      case "open":
        drawScreen();
        hint = scrolledBack() ? "Looking back. Typing returns to the end." : focused ? "Typing here. Press anywhere else to stop." : "Press here to type.";
        break;
      case "ended":
        drawScreen();
        hint = `The program ended${status.code ? ` (${status.code})` : ""}. Press here to open another.`;
        break;
      case "closed":
        message([{ text: status.why }, { text: "Press here to try again.", size: 46, color: QUIET }]);
        break;
    }
    if (said && Date.now() < said.until) hint = said.text;
    // The foot.
    g.fillStyle = "#111a25";
    g.fillRect(0, H - STRIP, W, STRIP);
    g.textBaseline = "middle";
    g.font = "32px system-ui, sans-serif";
    g.fillStyle = focused || (said && Date.now() < said.until) ? accent : QUIET;
    g.fillText(hint, PAD, H - STRIP / 2 + 1, hintWidth);
    for (const b of placed) {
      // Looking back and copying need a screen to look at; the size of the letters can be chosen any time.
      const usable = b.id === "larger" ? cell.cols > TERMINAL_COLUMNS[0] : b.id === "smaller" ? cell.cols < TERMINAL_COLUMNS.at(-1)! : live();
      g.globalAlpha = usable ? 1 : 0.35;
      g.fillStyle = "#1c2836";
      g.beginPath();
      g.roundRect(b.x, b.y, b.w, b.h, 10);
      g.fill();
      g.fillStyle = FG;
      g.textAlign = "center";
      g.font = "bold 34px system-ui, sans-serif";
      g.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 2);
      g.textAlign = "left";
      g.globalAlpha = 1;
    }
    texture.needsUpdate = true;
  };
  /** Drawn when something changed, and not more often than a screen shows. A timer, because a headset stops the page's own frames. */
  const redraw = () => {
    if (scheduled || closed) return;
    scheduled = true;
    setTimeout(draw, 16);
  };
  const say = (text: string) => {
    said = { text, until: Date.now() + 2500 };
    redraw();
    setTimeout(redraw, 2600);
  };

  // ------------------------------------------------------------------- typing
  const send = (bytes: string) => {
    term.scrollToBottom();
    link?.send(forApplication(bytes, term.modes.applicationCursorKeysMode));
  };
  // What the emulator itself answers when a program asks it something.
  term.onData((reply) => link?.send(reply));

  const onKey = (e: KeyboardEvent) => {
    const bytes = keyBytes(e);
    if (bytes === null) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    send(bytes);
  };
  const onPaste = (e: ClipboardEvent) => {
    const text = e.clipboardData?.getData("text/plain");
    if (!text) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    term.scrollToBottom();
    link?.send(pasteBytes(text, term.modes.bracketedPasteMode));
  };
  const scroll = (lines: number) => {
    term.scrollLines(Math.trunc(lines));
    redraw();
  };
  const onWheel = (e: WheelEvent) => scroll(Math.sign(e.deltaY) * 3);
  // A press that isn't on this panel takes the typing away from it.
  let pressedHere = false;
  const onDown = () => {
    pressedHere = false;
  };
  const onUp = () => setTimeout(() => !pressedHere && blur(), 80);

  const blur = () => {
    if (!focused) return;
    focused = false;
    removeEventListener("keydown", onKey, true);
    removeEventListener("paste", onPaste, true);
    removeEventListener("wheel", onWheel, true);
    removeEventListener("pointerdown", onDown, true);
    removeEventListener("pointerup", onUp, true);
    if (o.panels.keyboard.isLive) o.panels.keyboard.closeLive();
    redraw();
  };
  const focus = () => {
    pressedHere = true;
    if (status.at !== "open" || closed) return;
    if (!focused) {
      focused = true;
      addEventListener("keydown", onKey, true);
      addEventListener("paste", onPaste, true);
      addEventListener("wheel", onWheel, { capture: true, passive: true });
      addEventListener("pointerdown", onDown, true);
      addEventListener("pointerup", onUp, true);
    }
    // In a headset there may be no keys to press but the ones the kit draws.
    if (o.presenting?.() && !o.panels.keyboard.isLive) o.panels.keyboard.live({ title: `Typing into ${where}`, onKey: send, onClose: blur });
    redraw();
  };

  // ------------------------------------------------------------- the buttons
  const setColumns = (cols: number) => {
    const next = measure(nearestColumns(cols));
    if (next.cols === cell.cols) return;
    cell = next;
    term.resize(cell.cols, cell.rows);
    link?.resize(cell.cols, cell.rows);
    o.onColumns?.(cell.cols);
    say(`${cell.cols} letters across, ${cell.rows} lines.`);
  };
  const step = (by: number) => {
    const at = TERMINAL_COLUMNS.indexOf(cell.cols as (typeof TERMINAL_COLUMNS)[number]);
    const next = TERMINAL_COLUMNS[at + by];
    if (next) setColumns(next);
  };
  const text = () => {
    const buffer = term.buffer.active;
    return Array.from({ length: cell.rows }, (_, y) => buffer.getLine(buffer.viewportY + y)?.translateToString(true) ?? "");
  };
  const copy = async (): Promise<boolean> => {
    const lines = text();
    while (lines.length && !lines.at(-1)!.trim()) lines.pop();
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      say("Copied what is on the screen.");
      return true;
    } catch {
      say("This browser wouldn't let the page copy.");
      return false;
    }
  };
  const pressButton = (id: TerminalButton) => {
    if (id === "larger") return step(-1);
    if (id === "smaller") return step(1);
    if (!live()) return;
    if (id === "back") return scroll(-(cell.rows - 2));
    if (id === "forward") return scroll(cell.rows - 2);
    void copy();
  };

  // --------------------------------------------------------------- connecting
  const connect = () => {
    term.reset();
    status = { at: "signing" };
    link = openBridgeLink({
      bridge: o.bridge,
      owner: o.owner,
      sign: o.sign,
      relays: o.relays,
      cols: cell.cols,
      rows: cell.rows,
      ...(o.iceServers ? { iceServers: o.iceServers } : {}),
      onData: (bytes) => term.write(bytes, redraw),
      onStatus(next) {
        status = next;
        if (next.at !== "open") blur();
        o.onStatus?.(next);
        redraw();
      },
    });
    redraw();
  };

  const panel = o.panels.open(
    {
      kind: "custom",
      title: o.name ? `Terminal: ${o.name}` : "Terminal",
      texture,
      aspect: W / H,
      onPress(x, y) {
        // Anything pressed on this panel is the panel's: it doesn't take the typing away.
        pressedHere = true;
        const [px, py] = [x * W, y * H];
        if (py >= H - STRIP) {
          const b = placed.find((k) => px >= k.x - GAP / 2 && px <= k.x + k.w + GAP / 2);
          if (b) return pressButton(b.id);
        }
        if (status.at === "closed" || status.at === "ended") return connect();
        focus();
      },
      onClose() {
        if (closed) return;
        blur();
        closed = true;
        link?.close();
        removeEventListener("pagehide", onLeave);
        term.dispose();
        texture.dispose();
        o.onClosed?.();
      },
    },
    { place: { width: 1.3 }, keep: false },
  );
  draw();
  connect();
  // Leaving the page hangs up, so the computer knows at once.
  const onLeave = () => link?.close();
  addEventListener("pagehide", onLeave);

  return {
    panel,
    get status() {
      return status;
    },
    get focused() {
      return focused;
    },
    get size() {
      return { cols: cell.cols, rows: cell.rows };
    },
    focus,
    blur,
    type: send,
    text,
    scroll,
    setColumns,
    copy,
    buttons: () => Object.fromEntries(placed.map((b) => [b.id, [(b.x + b.w / 2) / W, (b.y + b.h / 2) / H]])) as Record<TerminalButton, [number, number]>,
    close: () => panel.close(),
  };
}
