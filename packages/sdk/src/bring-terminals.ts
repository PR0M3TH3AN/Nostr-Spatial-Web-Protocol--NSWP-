/**
 * Terminals in a world its owner is building: the part with the terminal in
 * it. See `bring.ts` for what is brought and why it is trusted.
 *
 *   if (somethingBrought()) {
 *     const brought = takeBrought();
 *     if (brought) (await import("nswp-sdk/terminal")).addBroughtTerminals({ brought, controls, panels, presenting });
 *   }
 *
 * Only the owner sees these. Panels are drawn for the one who hung them, and
 * are never sent to anyone else in a room.
 */
import { DEFAULT_RELAYS, type Brought } from "@nswp/core";
import type { Panels } from "./panels.js";
import { wasRefreshed } from "./stay.js";
import { openTerminalPanel, type TerminalPanel } from "./terminal.js";
import type { Controls } from "./ui/model.js";

export interface BroughtTerminalsOptions {
  brought: Brought;
  controls: Controls;
  panels: Panels;
  presenting: () => boolean;
  accent?: number | string;
}

export interface BroughtTerminals {
  /** The open terminals, oldest first. */
  terminals(): TerminalPanel[];
  /** Bring back the ones that were open before a refresh, one at a time. Done by itself after a refresh; here for a test. */
  restore(): Promise<void>;
}

const EACH = 4;
const OPEN = "nswp:brought-open";
interface Hung {
  place: unknown;
  look: unknown;
  pin: unknown;
  cols: number;
}

export function addBroughtTerminals(o: BroughtTerminalsOptions): BroughtTerminals {
  const { brought, controls } = o;
  const open: TerminalPanel[] = [];
  const sessionKey = Uint8Array.from(brought.sessionKey.match(/../g)!.map((h) => parseInt(h, 16)));
  const expires = Number(brought.grant.tags.find((t) => t[0] === "expiration")?.[1] ?? 0);
  const ranOut = () => Date.now() / 1000 >= expires;

  controls.addSection({
    id: "computers",
    label: "Your computer",
    icon: "panel",
    note: () => `You brought this from your home, because you are building this world. A terminal here is on ${brought.name}; this world's own page draws it, so keep to worlds whose code is yours. Nobody else here sees it.`,
  });

  const note = () => {
    try {
      const hung: Hung[] = open.map((term) => ({ place: term.panel.place(), look: term.panel.look, pin: term.panel.pin, cols: term.size.cols }));
      sessionStorage.setItem(OPEN, JSON.stringify(hung));
    } catch {
      /* after a refresh they are opened by hand */
    }
  };
  addEventListener("pagehide", note);

  const openOne = (as?: Hung): TerminalPanel | null => {
    if (ranOut()) {
      controls.say("What you brought from your home has run out. Go home and come back to bring your terminals again.");
      return null;
    }
    if (open.length >= EACH) {
      controls.say(`${EACH} terminals are open. Put one away first.`);
      return null;
    }
    try {
      const headset = o.presenting();
      const term = openTerminalPanel({
        panels: o.panels,
        bridge: brought.bridge,
        held: { grant: brought.grant, sessionKey },
        relays: brought.relays.length ? brought.relays : DEFAULT_RELAYS,
        name: brought.name,
        cols: as?.cols ?? (headset ? 80 : 100),
        ...(as?.place && typeof as.place === "object" ? { place: as.place as object } : {}),
        ...(as?.look && typeof as.look === "object" ? { look: as.look as object } : {}),
        ...(Array.isArray(as?.pin) ? { pin: as.pin as [number, number, number] } : {}),
        ...(o.accent !== undefined ? { accent: o.accent } : {}),
        presenting: o.presenting,
        onStatus(status) {
          if (status.at === "asking") controls.say(`Say yes at ${brought.name}. The code is ${status.code}.`);
        },
        onClosed() {
          const at = open.indexOf(term);
          if (at >= 0) open.splice(at, 1);
          note();
        },
      });
      open.push(term);
      note();
      return term;
    } catch {
      controls.say("The terminal couldn't be opened. Put a panel away and try again.");
      return null;
    }
  };

  controls.add({ id: "brought-terminal", section: "computers", icon: "panel", label: `A terminal on ${brought.name}`, short: "Terminal", hidden: ranOut, act: () => void openOne() });

  const restore = async () => {
    let hung: Hung[] = [];
    try {
      const kept: unknown = JSON.parse(sessionStorage.getItem(OPEN) ?? "[]");
      if (Array.isArray(kept)) hung = (kept as Hung[]).filter((h) => h && typeof h.cols === "number").slice(0, EACH);
    } catch {
      return;
    }
    if (!hung.length || open.length) return;
    for (const h of hung) {
      const term = openOne(h);
      if (!term) break;
      // One question at the computer at a time.
      await new Promise<void>((done) => {
        const started = Date.now();
        const look = setInterval(() => {
          const at = term.status.at;
          if (at === "open" || at === "closed" || at === "ended" || Date.now() - started > 90_000) {
            clearInterval(look);
            done();
          }
        }, 250);
      });
    }
  };
  if (wasRefreshed()) void restore();

  return { terminals: () => [...open], restore };
}
