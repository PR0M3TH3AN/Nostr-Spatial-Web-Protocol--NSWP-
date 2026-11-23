/**
 * The client's end of the menu's port, where the client has the menu (protocol/02-doors.md, "The client has the
 * menu"; docs/plans/the-clients-menu.md).
 *
 * A client that keeps the screen shows a world in a frame and draws the visitor's menu above it, from its own copy of
 * the kit. This is what the menu is mounted on there: the client's own controls (the visitor's own tabs, the way
 * home), with the tabs the world describes laid in among them, and the words between the two pages carried for it.
 *
 * - A world's `here` that says it speaks the words is answered at once: this page has the menu.
 * - Everything a world says is read by the core's own reader and held to its limits before the menu sees any of it.
 * - A description lasts only as long as the page that sent it: it is dropped at every load of the frame.
 * - A press on something the world described goes down as a word. It is not the visitor's press in the world's
 *   page, so a row that copies is copied here, and a row typed into is typed here.
 * - Words go only to the origin that last said `here`, never to whatever happens to be in the frame.
 *
 * Nothing of the visitor's own tabs is ever said down: only their settings, and their presses on the world's rows.
 */
import { cleanMenuSettings, LEAVE_MS, MENU_LIMITS, menuVersionOf, readMenuWordUp, type MenuCard, type MenuRow, type MenuSettings, type MenuWorld, type TravelSettings } from "@nswp/core";
import { currentSettings } from "../settings.js";
import { ICONS, type IconName } from "./icons.js";
import { STANDARD_TABS, standardTab, type Controls, type UiCard, type UiItemView, type UiSectionView, type UiView } from "./model.js";
import type { WorldPort } from "./port.js";

/** Before the id of everything that is the world's, in what the menu draws: so a world's id can never be one of the client's own. */
export const WORLDS = "world:";

/** The most keys on the bar: the client's own come first, then the world's while there is room. */
const BAR_MOST = 6;

const iconOf = (name: string | undefined): IconName | null => (name && Object.prototype.hasOwnProperty.call(ICONS, name) ? (name as IconName) : null);

const itemOf = (row: MenuRow): UiItemView => ({
  id: `${WORLDS}${row.id}`,
  label: row.label,
  icon: iconOf(row.icon),
  on: row.on ?? null,
  tone: row.tone ?? "normal",
  key: "",
  short: row.short ?? row.label,
  kind: row.kind,
  ...(row.kind === "copy" ? { copy: row.copy ?? "" } : {}),
  color: row.color ?? "",
  mark: iconOf(row.mark),
  faint: row.faint === true,
  ...(row.picture !== undefined ? { picture: () => row.picture as CanvasImageSource } : {}),
});

const cardOf = (card: MenuCard): UiCard => ({
  title: card.title,
  tag: card.tag ?? "",
  // Only ever so for a page of the client's own: the core's reader drops it from any other world.
  proven: card.proven === true,
  sub: card.sub ?? "",
  copy: card.copy ?? "",
  text: card.text ?? "",
  // An address a world names is never fetched: a world's picture crosses as a bitmap, or not at all.
  picture: "",
  color: card.color ?? "",
  now: card.now ?? [],
  ...(card.picture !== undefined ? { draw: () => card.picture as CanvasImageSource } : {}),
  ...(card.acts ? { acts: card.acts.map((id) => `${WORLDS}${id}`) } : {}),
});

/**
 * What the client's menu draws over a world: the client's own view, with what the world described laid in.
 *
 * - The world's name and address head it; how much room the console takes, and whether the keys are the world's,
 *   are the world's to say.
 * - A tab every place has keeps the client's name and icon for it, and the client's rows come first in it.
 * - A tab of the world's own stands after every other, and carries the world's name.
 * - The bar is the client's keys, then the world's while there is room; the visitor's pinned tabs follow.
 * - The look is the visitor's own. A world's colour doesn't tint the menu.
 */
export function mergeView(base: UiView, world: MenuWorld | null, from: { address: string; pins: readonly string[] }): UiView {
  if (!world) return base;
  const order = (id: string) => {
    const i = STANDARD_TABS.indexOf(id);
    return i === -1 ? STANDARD_TABS.length : i;
  };
  const sections: UiSectionView[] = base.sections.map((s) => ({ ...s, items: [...s.items] }));
  const own: UiSectionView[] = [];
  const onBar: UiItemView[] = [];
  for (const said of world.sections) {
    const items = said.rows.map(itemOf);
    for (const [i, row] of said.rows.entries()) if (row.bar) onBar.push(items[i]!);
    const card = said.card ? cardOf(said.card) : null;
    const there = sections.find((s) => s.id === said.id);
    if (there) {
      there.items.push(...items);
      there.card ??= card;
      if (!there.note && said.note) there.note = said.note;
      continue;
    }
    const standard = standardTab(said.id);
    const section: UiSectionView = {
      id: said.id,
      // A tab of the world's own carries the world's name, so that it is never taken for one of the visitor's.
      label: standard ? standard.label : `${said.label ?? said.id} · ${world.title || from.address}`.slice(0, MENU_LIMITS.label),
      icon: standard ? standard.icon : iconOf(said.icon),
      note: said.note ?? "",
      card,
      items,
      pinned: from.pins.includes(said.id),
    };
    if (standard) sections.push(section);
    else own.push(section);
  };
  // In the menu's own order, the client's own extra tabs after, and the world's own last of all.
  const shown = [...sections.map((s, i) => ({ s, i })).sort((a, b) => order(a.s.id) - order(b.s.id) || a.i - b.i).map((x) => x.s), ...own];
  const bar = [...base.hotbar, ...onBar].slice(0, BAR_MOST);
  const keyOf = new Map(bar.map((item, i) => [item.id, String(i + 1)]));
  for (const s of shown) s.items = s.items.map((item) => ({ ...item, key: keyOf.get(item.id) ?? "" }));
  return {
    ...base,
    title: world.title || base.title,
    address: from.address,
    target: world.target[0] ?? "",
    detail: world.target.slice(1),
    loading: world.loading,
    presence: world.level,
    corner: world.corner ?? base.corner,
    keys: world.keys ? base.keys : { menu: null, hotbar: false, chat: null },
    sections: shown,
    hotbar: bar.map((item) => ({ ...item, key: keyOf.get(item.id) ?? "" })),
    pins: from.pins.flatMap((id, i) => {
      const tab = shown.find((x) => x.id === id);
      const n = bar.length + i + 1;
      return tab ? [{ id, label: tab.label, icon: tab.icon, key: n <= 9 ? String(n) : "" }] : [];
    }),
  };
}

export interface MenuBelowOptions {
  /** The client's own controls: the visitor's own tabs, and the way home. */
  controls: Controls;
  /**
   * Visitor's tabs this client doesn't yet run itself, and so still takes from a world (the core's
   * `MenuReadOptions.also`). None, for a client that runs them all.
   */
  also?: readonly string[];
  /** The visitor's settings as they are now. By default what this page's own parts of the kit say they are. */
  settings?: () => MenuSettings;
  /**
   * Take the visitor home: send the frame there, whatever the world in it does. `left` is true where the world
   * didn't go by itself in time, so what was in the visitor's hand is not carried.
   */
  home?: (left: boolean) => void;
  /** A world reported settings the visitor changed in its headset session: comfort and layout only, already cleaned. */
  onReported?: (settings: TravelSettings) => void;
  /** Whether something a world sent as a picture may be kept. By default a bitmap within the limit on its size. */
  picture?: (value: unknown) => boolean;
  /** For tests: where words from the frame are heard. By default this page's window. */
  hear?: { addEventListener(type: "message", fn: (e: MessageEvent) => void): void; removeEventListener(type: "message", fn: (e: MessageEvent) => void): void };
  /** For tests: this page's own origin. */
  origin?: string;
}

export interface MenuBelow {
  /** What the menu is mounted on: `mountMenu(below.port)`. */
  readonly port: WorldPort;
  /** The origin of the page that last said `here`, or "" before any has since the frame last loaded. */
  readonly origin: string;
  /** Whether that page speaks the menu's words. A client draws no menu over one that doesn't: it draws its own. */
  readonly speaks: boolean;
  /** What the world last described, as it was kept, or null. */
  readonly world: MenuWorld | null;
  /** Be told when any of those change. Returns how to stop. */
  onChange(fn: () => void): () => void;
  /** The menu that was mounted, so that the keys a world forwards act on it. */
  attach(menu: { pressKey(key: string): void } | null): void;
  /** The visitor's own Home was pressed: the world is told, and they are taken home within `LEAVE_MS` whatever it does. */
  leave(): void;
  dispose(): void;
}

const isBitmap = (value: unknown): boolean => typeof ImageBitmap !== "undefined" && value instanceof ImageBitmap && value.width <= MENU_LIMITS.picture && value.height <= MENU_LIMITS.picture;

/** The client's end of the port, for the frame the world is shown in. */
export function portBelow(frame: HTMLIFrameElement, opts: MenuBelowOptions): MenuBelow {
  const { controls } = opts;
  const hear: NonNullable<MenuBelowOptions["hear"]> = opts.hear ?? {
    addEventListener: (type, fn) => window.addEventListener(type, fn),
    removeEventListener: (type, fn) => window.removeEventListener(type, fn),
  };
  const self = opts.origin ?? location.origin;
  const settingsNow = (): MenuSettings => cleanMenuSettings(opts.settings ? opts.settings() : currentSettings());
  const watchers = new Set<() => void>();
  const viewers = new Set<() => void>();
  const sayers = new Set<(text: string) => void>();
  let origin = "";
  let speaks = false;
  let world: MenuWorld | null = null;
  let menu: { pressKey(key: string): void } | null = null;
  let open = false;
  let saidSettings = "";
  let leaving: ReturnType<typeof setTimeout> | null = null;

  const changed = () => {
    for (const fn of [...viewers]) fn();
    for (const fn of [...watchers]) fn();
  };
  /** Only to the page that said `here`: never to whatever is in the frame now. */
  const say = (word: Record<string, unknown>) => {
    if (!speaks || !origin) return;
    try {
      frame.contentWindow?.postMessage({ ...word, nswp: "menu" }, origin);
    } catch {
      /* the frame has gone */
    }
  };
  const drop = () => {
    const had = !!world || speaks || !!origin;
    origin = "";
    speaks = false;
    world = null;
    saidSettings = "";
    if (had) changed();
  };
  // At every load of the frame: one world's name and tabs never stand over the next page, or over one that says nothing.
  const onLoad = () => {
    if (leaving) clearTimeout(leaving);
    leaving = null;
    drop();
  };
  frame.addEventListener("load", onLoad);

  const onMessage = (e: MessageEvent) => {
    if (e.source !== frame.contentWindow || !e.data || typeof e.data !== "object") return;
    const data = e.data as { nswp?: unknown };
    if (data.nswp === "here") {
      // A new page is up in the frame (its `here` can come before the frame's own load is told).
      world = null;
      origin = typeof e.origin === "string" ? e.origin : "";
      speaks = menuVersionOf(data) > 0 && !!origin && origin !== "null";
      if (speaks) {
        const settings = settingsNow();
        saidSettings = JSON.stringify(settings);
        say({ has: true, v: menuVersionOf(data), settings });
        if (open) say({ open: true });
      }
      return changed();
    }
    if (data.nswp !== "menu" || !speaks || e.origin !== origin) return;
    const word = readMenuWordUp(data, { own: origin === self, ...(opts.also ? { also: opts.also } : {}), picture: opts.picture ?? isBitmap });
    if (!word) return;
    if (word.what === "world") {
      world = word.world;
      return changed();
    }
    if (word.what === "key") return void menu?.pressKey(word.key);
    // Shown under the world's name: a world's words are never put in the client's mouth.
    if (word.what === "say") {
      const text = `${world?.title || new URL(origin).host}: ${word.say}`;
      for (const fn of [...sayers]) fn(text);
      return;
    }
    // Only while its headset session runs, where only the world can draw the console.
    if (word.what === "settings") return void (world?.state.headset.presenting && opts.onReported?.(word.settings));
    if (word.what === "picture" && world) {
      for (const s of world.sections) for (const row of s.rows) if (row.id === word.id && row.picture !== undefined) row.picture = word.picture;
      changed();
    }
  };
  hear.addEventListener("message", onMessage);

  // The visitor changed a setting in this menu: the world hears, and applies what is its to apply.
  const stopControls = controls.subscribe(() => {
    if (speaks) {
      const settings = settingsNow();
      const text = JSON.stringify(settings);
      if (text !== saidSettings) {
        saidSettings = text;
        say({ settings });
      }
    }
    for (const fn of [...viewers]) fn();
  });

  const rowOf = (id: string): MenuRow | null => {
    if (!world || !id.startsWith(WORLDS)) return null;
    const rowId = id.slice(WORLDS.length);
    for (const s of world.sections) for (const row of s.rows) if (row.id === rowId) return row;
    return null;
  };
  const host = () => {
    try {
      return origin ? new URL(origin).host : "";
    } catch {
      return "";
    }
  };

  const port: WorldPort = {
    view: () => mergeView(controls.view(), speaks ? world : null, { address: host(), pins: controls.pins }),
    subscribe(fn) {
      viewers.add(fn);
      return () => void viewers.delete(fn);
    },
    run(id, typed) {
      if (!id.startsWith(WORLDS)) return controls.run(id, typed);
      const row = rowOf(id);
      // Only for something in the world's last description, and something that can be pressed.
      if (!row || row.kind === "line") return false;
      controls.signal("press");
      say({ press: row.id, ...(row.kind === "field" && typed !== undefined ? { field: typed.slice(0, MENU_LIMITS.field) } : {}) });
      return true;
    },
    say: (text) => controls.say(text),
    onSay(fn) {
      sayers.add(fn);
      const stop = controls.onSay(fn);
      return () => {
        sayers.delete(fn);
        stop();
      };
    },
    signal(name) {
      controls.signal(name);
      if (name !== "menuOpen" && name !== "menuClose") return;
      open = name === "menuOpen";
      say({ open });
      // While the menu is up this page has the keys, so nothing typed in it reaches the world. As it goes, they go
      // back to the frame: a page above a frame hears no key the frame doesn't forward, and the frame none while this
      // page has them.
      if (!open) frame.focus();
    },
    onSignal: (fn) => controls.onSignal(fn),
    setPinned: (tab, pinned) => controls.setPinned(tab, pinned),
    get presence() {
      return speaks && world ? world.level : controls.presence;
    },
    get theme() {
      return controls.theme;
    },
    get chat() {
      return controls.chat;
    },
    get feed() {
      return controls.feed;
    },
    get letters() {
      return controls.letters;
    },
  };

  return {
    port,
    get origin() {
      return origin;
    },
    get speaks() {
      return speaks;
    },
    get world() {
      return world;
    },
    onChange(fn) {
      watchers.add(fn);
      return () => void watchers.delete(fn);
    },
    attach(next) {
      menu = next;
    },
    leave() {
      if (leaving) return;
      const from = origin;
      say({ go: "home" });
      // The world may go by itself, carrying what the visitor carries: then the frame loads, and this is put away.
      // If it hasn't in `LEAVE_MS`, or it never spoke the words, the client takes them home itself.
      if (!speaks) return void opts.home?.(false);
      leaving = setTimeout(() => {
        leaving = null;
        if (origin === from) opts.home?.(true);
      }, LEAVE_MS);
    },
    dispose() {
      if (leaving) clearTimeout(leaving);
      frame.removeEventListener("load", onLoad);
      hear.removeEventListener("message", onMessage);
      stopControls();
      watchers.clear();
      viewers.clear();
      sayers.clear();
      menu = null;
    },
  };
}
