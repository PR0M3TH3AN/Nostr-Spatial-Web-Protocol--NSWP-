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
  cols?: number;
  rows?: number;
  accent?: THREE.ColorRepresentation;
  /** Whether the visitor is in a headset now: there, pressing the panel brings up the drawn keyboard. */
  presenting?: () => boolean;
  iceServers?: RTCIceServer[];
  onStatus?(status: BridgeStatus): void;
  /** The panel was put away, and the connection with it. */
  onClosed?(): void;
}

export interface TerminalPanel {
  readonly panel: Panel;
  readonly status: BridgeStatus;
  /** Whether keys typed go to it. */
  readonly focused: boolean;
  focus(): void;
  blur(): void;
  /** Send keys, as if typed. */
  type(bytes: string): void;
  /** What is on its screen, as lines of text. */
  text(): string[];
  close(): void;
}

// The sixteen colours every terminal program expects, chosen to read on dark glass.
const BASE = ["#1b2430", "#ff6b6b", "#7bd88f", "#ffd166", "#6cb6ff", "#d699ff", "#5fd7d7", "#d7dee7", "#5c6b7c", "#ff8f8f", "#a5f0b4", "#ffe08a", "#9fd0ff", "#e6bcff", "#93eded", "#ffffff"];
const BG = "#0a1018";
const FG = "#dfe7ef";

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

const PAD = 20;
const STRIP = 40; // a line under the screen that says what a press will do
const CH = 30;
const FONT = `24px ui-monospace, "DejaVu Sans Mono", "Liberation Mono", Menlo, Consolas, monospace`;

export function openTerminalPanel(o: TerminalPanelOptions): TerminalPanel {
  const cols = o.cols ?? 100;
  const rows = o.rows ?? 30;
  const accent = `#${new THREE.Color(o.accent ?? 0xffb65c).getHexString()}`;
  const canvas = document.createElement("canvas");
  const g = canvas.getContext("2d")!;
  g.font = FONT;
  const CW = Math.max(8, Math.ceil(g.measureText("M").width));
  canvas.width = cols * CW + PAD * 2;
  canvas.height = rows * CH + PAD * 2 + STRIP;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  const term = new Terminal({ cols, rows, scrollback: 2000, allowProposedApi: true });
  let link: BridgeLink | null = null;
  let status: BridgeStatus = { at: "signing" };
  let focused = false;
  let closed = false;
  let scheduled = false;
  const where = o.name || "your computer";

  // ------------------------------------------------------------------ drawing
  const message = (lines: { text: string; size?: number; color?: string }[]) => {
    g.textAlign = "center";
    g.textBaseline = "middle";
    const total = lines.reduce((n, l) => n + (l.size ?? 34) * 1.5, 0);
    let y = (canvas.height - STRIP) / 2 - total / 2;
    for (const l of lines) {
      const size = l.size ?? 34;
      g.font = `${size >= 100 ? "bold " : ""}${size}px system-ui, sans-serif`;
      g.fillStyle = l.color ?? FG;
      y += size * 0.75;
      g.fillText(l.text, canvas.width / 2, y, canvas.width - 120);
      y += size * 0.75;
    }
    g.textAlign = "left";
  };

  const drawScreen = () => {
    const buffer = term.buffer.active;
    const cell = buffer.getNullCell();
    g.textBaseline = "middle";
    for (let y = 0; y < rows; y++) {
      const line = buffer.getLine(buffer.viewportY + y);
      if (!line) continue;
      const top = PAD + y * CH;
      for (let x = 0; x < cols; x++) {
        line.getCell(x, cell);
        const width = cell.getWidth();
        if (!width) continue; // the second half of a wide character
        let fg = cell.isFgDefault() ? FG : cell.isFgRGB() ? rgb(cell.getFgColor()) : paletteColor(cell.getFgColor());
        let bg = cell.isBgDefault() ? null : cell.isBgRGB() ? rgb(cell.getBgColor()) : paletteColor(cell.getBgColor());
        if (cell.isInverse()) [fg, bg] = [bg ?? BG, fg];
        const here = buffer.viewportY === buffer.baseY && y === buffer.cursorY && x === buffer.cursorX;
        if (here && focused) [fg, bg] = [BG, accent];
        if (bg) {
          g.fillStyle = bg;
          g.fillRect(PAD + x * CW, top, CW * width, CH);
        }
        if (here && !focused) {
          g.strokeStyle = accent;
          g.lineWidth = 2;
          g.strokeRect(PAD + x * CW + 1, top + 1, CW * width - 2, CH - 2);
        }
        const chars = cell.getChars();
        if (!chars || chars === " " || cell.isInvisible()) continue;
        g.font = `${cell.isItalic() ? "italic " : ""}${cell.isBold() ? "bold " : ""}${FONT}`;
        g.globalAlpha = cell.isDim() ? 0.6 : 1;
        g.fillStyle = fg;
        g.fillText(chars, PAD + x * CW, top + CH / 2 + 1);
        if (cell.isUnderline()) g.fillRect(PAD + x * CW, top + CH - 3, CW * width, 2);
        g.globalAlpha = 1;
      }
    }
  };

  const draw = () => {
    scheduled = false;
    if (closed) return;
    g.fillStyle = BG;
    g.fillRect(0, 0, canvas.width, canvas.height);
    let hint = "";
    switch (status.at) {
      case "signing":
        message([{ text: "Asking your key to allow this…" }]);
        break;
      case "finding":
        message([{ text: `Looking for ${where}…` }, { text: `If it asks, the code is ${status.code}.`, size: 28, color: "#9fb0c0" }]);
        break;
      case "asking":
        message([{ text: `Say yes at ${where}.` }, { text: status.code, size: 150, color: accent }, { text: "It is asking now, and should show this code. If the code is different, say no.", size: 28, color: "#9fb0c0" }]);
        break;
      case "connecting":
        message([{ text: "Connecting…" }]);
        break;
      case "open":
        drawScreen();
        hint = focused ? "Typing here. Press anywhere else to stop." : "Press here to type.";
        break;
      case "ended":
        drawScreen();
        hint = `The program ended${status.code ? ` (${status.code})` : ""}. Press here to open another.`;
        break;
      case "closed":
        message([{ text: status.why }, { text: "Press here to try again.", size: 28, color: "#9fb0c0" }]);
        break;
    }
    g.fillStyle = "#111a25";
    g.fillRect(0, canvas.height - STRIP, canvas.width, STRIP);
    g.textBaseline = "middle";
    g.font = "22px system-ui, sans-serif";
    g.fillStyle = focused ? accent : "#9fb0c0";
    g.fillText(hint, PAD, canvas.height - STRIP / 2 + 1, canvas.width - PAD * 2 - 300);
    g.textAlign = "right";
    g.fillStyle = "#5c6b7c";
    g.fillText(status.at === "open" ? status.name : "", canvas.width - PAD, canvas.height - STRIP / 2 + 1, 280);
    g.textAlign = "left";
    texture.needsUpdate = true;
  };
  /** Drawn when something changed, and not more often than a screen shows. A timer, because a headset stops the page's own frames. */
  const redraw = () => {
    if (scheduled || closed) return;
    scheduled = true;
    setTimeout(draw, 16);
  };

  // ------------------------------------------------------------------- typing
  const send = (bytes: string) => link?.send(forApplication(bytes, term.modes.applicationCursorKeysMode));
  // What the emulator itself answers when a program asks it something.
  term.onData((reply) => link?.send(reply));

  const onKey = (e: KeyboardEvent) => {
    const bytes = keyBytes(e);
    if (bytes === null) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    term.scrollToBottom();
    send(bytes);
  };
  const onPaste = (e: ClipboardEvent) => {
    const text = e.clipboardData?.getData("text/plain");
    if (!text) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    link?.send(pasteBytes(text, term.modes.bracketedPasteMode));
  };
  const onWheel = (e: WheelEvent) => {
    term.scrollLines(Math.sign(e.deltaY) * 3);
    redraw();
  };
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

  // --------------------------------------------------------------- connecting
  const connect = () => {
    term.reset();
    status = { at: "signing" };
    link = openBridgeLink({
      bridge: o.bridge,
      owner: o.owner,
      sign: o.sign,
      relays: o.relays,
      cols,
      rows,
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
      aspect: canvas.width / canvas.height,
      onPress() {
        if (status.at === "closed" || status.at === "ended") {
          pressedHere = true;
          return connect();
        }
        focus();
      },
      onClose() {
        if (closed) return;
        blur();
        closed = true;
        link?.close();
        term.dispose();
        texture.dispose();
        o.onClosed?.();
      },
    },
    { place: { width: 1.3 }, keep: false },
  );
  draw();
  connect();

  return {
    panel,
    get status() {
      return status;
    },
    get focused() {
      return focused;
    },
    focus,
    blur,
    type: send,
    text() {
      const buffer = term.buffer.active;
      return Array.from({ length: rows }, (_, y) => buffer.getLine(buffer.viewportY + y)?.translateToString(true) ?? "");
    },
    close: () => panel.close(),
  };
}
