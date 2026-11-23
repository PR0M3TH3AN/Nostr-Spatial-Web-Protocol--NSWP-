/**
 * The world's end of the menu's port, where a client above has the menu (protocol/02-doors.md, "The client has the
 * menu"; docs/plans/the-clients-menu.md).
 *
 * A world shown in its client's frame says in its `here` that it speaks the menu's words. If the client answers that
 * it has the menu, this page draws no console: it says upward what it is called, the tabs it fills and the state of
 * the things only it can run, and takes back the visitor's presses, their settings, and that the menu came up or
 * went. If nothing is said in time, the world draws its own menu as it always has (ui/hud.ts).
 *
 * **Loading this file is saying so.** It tells the page's `here` to carry `menu`, as it loads, so it must be
 * imported with the page's first files (a plain `import`, never `await import()`), and by a world that will keep
 * its word: once `portAbove` reports that the client has the menu, the world mounts none.
 *
 * This file is not the menu and doesn't load it. It is small, and is what lets a framed world never fetch the menu.
 */
import { LEAVE_MS, MENU_KEYS, MENU_LIMITS, MENU_VERSION, MENU_VISITOR_TABS, MENU_WAIT_MS, readMenuWordDown, type MenuKey, type MenuState } from "@nswp/core";
import { framed, hearClientMenu, sayToClient, sinceHere, speakMenu } from "./client-frame.js";
import { changeSettings } from "./settings.js";
import type { Controls, UiCard, UiItemView, UiView } from "./ui/model.js";
import { SUMMON_KEY } from "./ui/summon.js";

speakMenu(MENU_VERSION);

export interface MenuAbove {
  /** Whether a client above has the menu, once that is known: at its answer, or with none in `MENU_WAIT_MS`. */
  readonly ready: Promise<boolean>;
  /** Whether it has the menu now. */
  readonly has: boolean;
  /** Be told when that changes: a client that answered late, or stopped. Returns how to stop. */
  onChange(fn: (has: boolean) => void): () => void;
  /**
   * The client's menu, as far as a world's own parts need it: whether it is up, and a way to ask for it to come up
   * or go, as the visitor's own summons does. For the part that looks round with the mouse: when the browser takes
   * the pointer back at Escape the world hears no key, and asks for the menu here.
   */
  readonly menu: { readonly open: boolean; setOpen(open: boolean): void };
  /** Stop: nothing more is said upward or taken from above. */
  dispose(): void;
}

export interface MenuAboveOptions {
  /** The things every place has and only the world can run, as they are now. What is left out is not so. */
  state?: () => Partial<MenuState>;
  /** Leave for home, carrying what the visitor carries: the client's Home was pressed. */
  home?: () => void;
  /** For tests and other carriers: the page above. By default the one this page is framed by (client-frame.ts). */
  above?: { framed(): boolean; sinceHere(): number | null; say(word: Record<string, unknown>): void; hear(fn: ((word: unknown) => void) | null): void };
  /** For tests: where the visitor's keys are heard. By default this page's window. */
  keys?: Pick<Window, "addEventListener" | "removeEventListener">;
}

/**
 * The tabs a world doesn't describe, since the client runs them itself. Following and Messages are the visitor's
 * own too, and are still described: until a client runs them, it takes them from the world.
 */
const CLIENTS: readonly string[] = MENU_VISITOR_TABS.filter((t) => t !== "following" && t !== "messages");
/** Rows that are the visitor's in a tab the world otherwise fills: the way home and their own doors, under Travel. */
const VISITORS_ROWS: readonly string[] = ["back", "home", "go-home", "doors", "list"];
const COLOR = /^#[0-9a-f]{6}$/;
/** No oftener than eight times a second. */
const EVERY_MS = 125;

const rowOf = (item: UiItemView, onBar: boolean): Record<string, unknown> => ({
  id: item.id,
  label: item.label,
  ...(item.short && item.short !== item.label ? { short: item.short } : {}),
  ...(item.icon ? { icon: item.icon } : {}),
  kind: item.kind,
  ...(item.on === null ? {} : { on: item.on }),
  ...(item.tone === "normal" ? {} : { tone: item.tone }),
  ...(COLOR.test(item.color) ? { color: item.color } : {}),
  ...(item.mark ? { mark: item.mark } : {}),
  ...(item.faint ? { faint: true } : {}),
  ...(onBar ? { bar: true } : {}),
  ...(item.kind === "copy" ? { copy: item.copy ?? "" } : {}),
});

const cardOf = (card: UiCard): Record<string, unknown> => ({
  title: card.title,
  ...(card.tag ? { tag: card.tag } : {}),
  ...(card.proven ? { proven: true } : {}),
  ...(card.sub ? { sub: card.sub } : {}),
  ...(card.copy ? { copy: card.copy } : {}),
  ...(card.text ? { text: card.text.slice(0, MENU_LIMITS.note) } : {}),
  ...(COLOR.test(card.color) ? { color: card.color } : {}),
  ...(card.now.length ? { now: card.now } : {}),
  ...(card.acts?.length ? { acts: card.acts } : {}),
});

/**
 * What a world says of itself, from what its own menu would have drawn. Only the tabs that are the world's to fill
 * are in it: nothing of the visitor's own tabs is ever said upward.
 */
export function describeWorld(view: UiView, state: Partial<MenuState> = {}): Record<string, unknown> {
  const onBar = new Set(view.hotbar.map((i) => i.id));
  return {
    title: view.title.slice(0, MENU_LIMITS.title),
    level: view.presence,
    corner: view.corner,
    // A world that has taken every key says so, and the client leaves the digits alone.
    keys: view.keys.hotbar || view.keys.menu !== null,
    state,
    target: view.target ? [view.target, ...view.detail].slice(0, 6) : [],
    loading: view.loading,
    sections: view.sections
      .filter((s) => !CLIENTS.includes(s.id))
      .map((s) => ({
        id: s.id,
        label: s.label,
        ...(s.icon ? { icon: s.icon } : {}),
        ...(s.note ? { note: s.note } : {}),
        ...(s.card ? { card: cardOf(s.card) } : {}),
        rows: s.items.filter((i) => !(s.id === "travel" && VISITORS_ROWS.includes(i.id))).map((i) => rowOf(i, onBar.has(i.id))),
      }))
      .filter((s) => s.rows.length > 0 || s.card),
  };
}

/** The ids a description names: the only ones a press from above may be for. */
const idsOf = (world: Record<string, unknown>): Set<string> => new Set((world.sections as { rows: { id: string }[] }[]).flatMap((s) => s.rows.map((r) => r.id)));

/**
 * Meet the client above, for a world's controls. Call it once, as the world starts and before any menu is mounted;
 * then mount the world's own menu only if `ready` says no client has it, and put it away if `onChange` says one
 * now does.
 */
export function portAbove(controls: Controls, opts: MenuAboveOptions = {}): MenuAbove {
  const above = opts.above ?? { framed, sinceHere, say: sayToClient, hear: hearClientMenu };
  const keys = opts.keys ?? (typeof window === "undefined" ? null : window);
  const watchers = new Set<(has: boolean) => void>();
  let has = false;
  let known = false;
  let settle: (has: boolean) => void = () => {};
  const ready = new Promise<boolean>((resolve) => (settle = resolve));
  const know = () => {
    if (known) return;
    known = true;
    settle(has);
  };
  if (!above.framed()) {
    know();
    return { ready, has: false, onChange: () => () => {}, menu: { open: false, setOpen: () => {} }, dispose: () => {} };
  }

  let named = new Set<string>();
  let last = "";
  let lastAt = -Infinity;
  let waiting: ReturnType<typeof setTimeout> | null = null;
  const describe = () => {
    waiting = null;
    if (!has) return;
    const world = describeWorld(controls.view(), opts.state?.());
    const text = JSON.stringify(world);
    if (text === last) return;
    last = text;
    lastAt = performance.now();
    named = idsOf(world);
    above.say({ world });
  };
  const changed = () => {
    if (!has || waiting) return;
    const wait = EVERY_MS - (performance.now() - lastAt);
    if (wait <= 0) describe();
    else waiting = setTimeout(describe, wait);
  };
  const stopView = controls.subscribe(changed);
  // What the world says for a moment goes up, to be shown under its name.
  const stopSay = controls.onSay((text) => {
    if (has && text) above.say({ say: text.slice(0, MENU_LIMITS.say) });
  });

  const setHas = (next: boolean) => {
    if (next === has) return know();
    has = next;
    last = "";
    open = false;
    if (has) describe();
    else {
      if (waiting) clearTimeout(waiting);
      waiting = null;
      named = new Set();
    }
    know();
    for (const fn of [...watchers]) fn(has);
  };

  let leaving: ReturnType<typeof setTimeout> | null = null;
  let open = false;
  above.hear((data) => {
    const word = readMenuWordDown(data);
    if (!word) return;
    if (word.what === "has") {
      if (word.has) changeSettings(word.settings);
      return setHas(word.has);
    }
    // Nothing else is taken from a page that hasn't said it has the menu.
    if (!has) return;
    if (word.what === "settings") return void changeSettings(word.settings);
    // Only for something this world last described: a press is by id, and nothing else can be pressed from above.
    if (word.what === "press") return void (named.has(word.press) && controls.run(word.press, word.field));
    if (word.what === "open") {
      if (word.open === open) return;
      open = word.open;
      return controls.signal(open ? "menuOpen" : "menuClose");
    }
    if (word.what === "go" && !leaving) {
      opts.home?.();
      // Asked once. The client takes them home itself within `LEAVE_MS` if this page hasn't gone.
      leaving = setTimeout(() => (leaving = null), LEAVE_MS);
    }
  });

  // The few keys that are the visitor's, heard before the world's own code hears anything, and said upward:
  // while the world has the keyboard the page above hears none. Never any other key, and never what was typed.
  const tell = (key: MenuKey) => above.say({ key });
  const typing = (e: KeyboardEvent): boolean => {
    const at = e.composedPath?.()[0] as HTMLElement | undefined;
    return !!at && (at.tagName === "INPUT" || at.tagName === "TEXTAREA" || at.isContentEditable === true);
  };
  const onKey = (e: KeyboardEvent) => {
    if (!has || e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
    if (e.code === SUMMON_KEY) {
      // The summons is the visitor's whatever the world has done with its keys, and the world never hears it.
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!e.repeat) tell("summon");
      return;
    }
    if (e.repeat) return;
    if (e.key === "Escape") return tell("escape");
    const view = controls.view();
    if (view.presence !== "hidden" && view.keys.menu && e.key.toLowerCase() === view.keys.menu) return tell("menu");
    if (view.keys.hotbar && view.presence === "full" && (MENU_KEYS as readonly string[]).includes(e.key) && /^[1-9]$/.test(e.key)) tell(e.key as MenuKey);
  };
  const swallow = (e: KeyboardEvent) => {
    if (has && e.code === SUMMON_KEY && !e.ctrlKey && !e.metaKey && !e.altKey) e.stopImmediatePropagation();
  };
  const listening = { capture: true } as const;
  keys?.addEventListener("keydown", onKey as EventListener, listening);
  keys?.addEventListener("keyup", swallow as EventListener, listening);

  // A client answers a `here` at once. With no answer in `MENU_WAIT_MS` of it, the world draws its own menu; an
  // answer that comes later still stands, and the world's own is put away (`onChange`).
  const since = above.sinceHere();
  const left = since === null ? MENU_WAIT_MS : MENU_WAIT_MS - since;
  const giveUp = left <= 0 ? (know(), null) : setTimeout(know, left);

  return {
    ready,
    get has() {
      return has;
    },
    onChange(fn) {
      watchers.add(fn);
      return () => void watchers.delete(fn);
    },
    menu: {
      get open() {
        return has && open;
      },
      setOpen(next) {
        if (has && next !== open) tell("summon");
      },
    },
    dispose() {
      if (giveUp) clearTimeout(giveUp);
      if (waiting) clearTimeout(waiting);
      if (leaving) clearTimeout(leaving);
      stopView();
      stopSay();
      above.hear(null);
      keys?.removeEventListener("keydown", onKey as EventListener, listening);
      keys?.removeEventListener("keyup", swallow as EventListener, listening);
      watchers.clear();
      know();
    },
  };
}
