/**
 * Running an item's script in its locked box (protocol/17-items.md, "An item's own logic").
 *
 * The box is a page of its own (`@nswp/core`, `ITEM_BOX_HTML`), which the world serves as `item-box.html` under
 * rules that let it reach nothing. This file is the world's side of it: it frames that page with no rights but
 * to run script, hands it the item's script, tells it of the few things an item hears about, and takes what it
 * asks for through a closed list with a ceiling on each (`cleanAsk`, `ITEM_ASKS`).
 *
 * Nothing of the visitor or the world is ever sent in: not who they are, where they are, or what is near them.
 * What comes out is only ever one of the asks, tidied, or nothing.
 */
import { cleanAsk, createRate, ITEM_ASKS, type ItemAsk, type ItemEvent } from "@nswp/core";

export type BoxAsk = NonNullable<ReturnType<typeof cleanAsk>>;

export interface BoxHandlers {
  /** The script asked for something on the list, within its ceiling. */
  ask(ask: BoxAsk): void;
  /** The script is over: it was stopped, it stopped answering, or the box couldn't run it. */
  stopped?(why: string): void;
}

export interface BoxRun {
  /** Tell the script of something that happened to its item. */
  tell(event: ItemEvent, arg?: number): void;
  stop(): void;
  readonly running: boolean;
}

export interface ItemBoxOptions {
  /** Where the world serves the box's page. Left out, `item-box.html` beside the world's own page. */
  url?: string;
  /** How long the box is given to start, in milliseconds. */
  startMs?: number;
}

/**
 * Run a script in a box of its own. Resolves to null if it couldn't be started here: no such page, a page served
 * under rules that stop it, or a script that fails as it begins. Then the item is a shape and nothing more.
 */
export function runInBox(script: string, on: BoxHandlers, opts: ItemBoxOptions = {}): Promise<BoxRun | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const frame = document.createElement("iframe");
    // Script, and nothing else: no origin of its own to keep anything under, no forms, no windows, no way out.
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden";
    frame.src = opts.url ?? new URL("item-box.html", document.baseURI).href;
    const gates = Object.fromEntries(Object.entries(ITEM_ASKS).map(([name, g]) => [name, createRate(g.burst, g.perSecond)])) as Record<ItemAsk, ReturnType<typeof createRate>>;
    let running = false;
    let over = false;
    let began = 0;
    let ticking: ReturnType<typeof setInterval> | undefined;
    const say = (m: Record<string, unknown>) => frame.contentWindow?.postMessage({ nswpItemBox: 1, ...m }, "*");
    const end = (why: string) => {
      if (over) return;
      over = true;
      const was = running;
      running = false;
      clearInterval(ticking);
      clearTimeout(giveUp);
      removeEventListener("message", heard);
      frame.remove();
      if (was) on.stopped?.(why);
      else resolve(null);
    };
    const run: BoxRun = {
      tell(event, arg) {
        if (running) say({ t: "event", name: event, ...(arg === undefined ? {} : { arg }) });
      },
      stop: () => end("asked"),
      get running() {
        return running;
      },
    };
    const heard = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow) return;
      const m = e.data as { nswpItemBox?: number; t?: string; name?: unknown; args?: unknown; why?: unknown } | null;
      if (!m || m.nswpItemBox !== 1) return;
      if (m.t === "ready") say({ t: "run", script });
      else if (m.t === "started" && !running && !over) {
        running = true;
        began = performance.now();
        clearTimeout(giveUp);
        // The passing of time, which is also how the box knows the script still answers.
        ticking = setInterval(() => run.tell("tick", Math.round(performance.now() - began)), 100);
        resolve(run);
      } else if (m.t === "ask" && running) {
        const ask = cleanAsk(m.name, m.args);
        if (ask && gates[ask.ask].take(performance.now())) on.ask(ask);
      } else if (m.t === "stopped") end(String(m.why ?? "stopped"));
      else if (m.t === "error" && !running) end("failed");
    };
    addEventListener("message", heard);
    const giveUp = setTimeout(() => end("no box"), opts.startMs ?? 5000);
    frame.addEventListener("error", () => end("no box"));
    document.body.append(frame);
  });
}
